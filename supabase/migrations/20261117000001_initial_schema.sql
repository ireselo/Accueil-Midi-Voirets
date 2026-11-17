-- ============================================================================
-- Accueil Midi-Voirets — Schéma complet Supabase (PostgreSQL)
-- Gestion des réservations, menus, rôles, paiements Twint (Payrexx) et CLI
-- ============================================================================

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TYPES ÉNUMÉRÉS (ENUMS)
-- ============================================================================

-- Catégories d'utilisateurs
CREATE TYPE public.user_category AS ENUM (
  'adult',                    -- Adulte (10 CHF)
  'student',                  -- Élève (8 CHF)
  'student_partial_subsidy',  -- Élève partiellement subventionné (4 CHF)
  'student_full_subsidy'      -- Élève totalement subventionné (0 CHF)
);

-- Rôles de gestion de la cafétéria (uniquement pour les adultes membres)
CREATE TYPE public.staff_role AS ENUM (
  'surveillant',     -- Vigilante : liste des inscrits, scan QR, présence CLI, inscription manuelle
  'cuisinier',       -- Cocinero : menus et liste de courses selon le nombre de personnes
  'civiliste',       -- Civiliste : consultation et suivi de la liste de courses
  'comptable',       -- Contable : accès aux paiements, facturation CLI, annulation CLI
  'administrateur'   -- Administrateur : gestion des utilisateurs, subventions, rôles, annulation CLI
);

-- Deux services par jour d'ouverture (12h00 et 12h50)
CREATE TYPE public.service_slot AS ENUM (
  '12h00',
  '12h50'
);

-- Structure du menu : Entrée + Plat principal OU Plat principal + Dessert
CREATE TYPE public.menu_composition_type AS ENUM (
  'starter_main',  -- Entrée + Plat principal
  'main_dessert'   -- Plat principal + Dessert (souvent sans spécifier quel dessert)
);

-- Statut d'une réservation
CREATE TYPE public.reservation_status AS ENUM (
  'pending_payment', -- En attente du paiement Twint (Payrexx)
  'confirmed',       -- Confirmée (QR généré ou inscription CLI / manuelle)
  'cancelled'        -- Annulée (ex: annulation ponctuelle CLI par admin/comptable)
);

-- Statut d'un paiement
CREATE TYPE public.payment_status AS ENUM (
  'pending',      -- En attente sur Payrexx (Twint)
  'paid',         -- Payé et confirmé
  'failed',       -- Échec ou expiré
  'refunded',     -- Remboursé
  'exempt',       -- Exonéré (0 CHF - Élève totalement subventionné)
  'invoiced_cli'  -- Facturé via facturation périodique CLI
);

-- Statut d'une facture CLI
CREATE TYPE public.invoice_status AS ENUM (
  'draft',
  'issued',
  'paid',
  'cancelled'
);

-- ============================================================================
-- 2. PARAMÈTRES GLOBAUX DE L'APPLICATION (app_settings)
-- ============================================================================

CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  app_name text NOT NULL DEFAULT 'Accueil Midi-Voirets',
  cafeteria_name text NOT NULL DEFAULT 'Cafétéria Scolaire',
  currency text NOT NULL DEFAULT 'CHF' CHECK (currency = 'CHF'),
  -- Tarifs par catégorie en CHF
  price_adult_chf numeric(6,2) NOT NULL DEFAULT 10.00,
  price_student_chf numeric(6,2) NOT NULL DEFAULT 8.00,
  price_student_partial_chf numeric(6,2) NOT NULL DEFAULT 4.00,
  price_student_full_chf numeric(6,2) NOT NULL DEFAULT 0.00,
  -- Configuration du groupe spécial CLI (6 personnes inscrites par défaut)
  cli_group_size integer NOT NULL DEFAULT 6,
  cli_default_service public.service_slot NOT NULL DEFAULT '12h00',
  cli_meal_price_chf numeric(6,2) NOT NULL DEFAULT 8.00,
  -- Capacité maximale d'inscrits (40 personnes au total par jour)
  max_capacity integer NOT NULL DEFAULT 40,
  capacity_scope text NOT NULL DEFAULT 'per_day' CHECK (capacity_scope IN ('per_service', 'per_day')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. PROFILS DES UTILISATEURS (profiles)
-- ============================================================================

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL UNIQUE,
  category public.user_category NOT NULL DEFAULT 'student',
  class_number text, -- Obligatoire pour les élèves
  staff_roles public.staff_role[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Contrainte : le numéro de classe est obligatoire si l'utilisateur est un élève
  CONSTRAINT chk_student_class_required CHECK (
    category = 'adult' OR (class_number IS NOT NULL AND length(trim(class_number)) > 0)
  ),
  -- Contrainte : seuls les adultes peuvent avoir des rôles de gestion de la cafétéria
  CONSTRAINT chk_staff_roles_only_adults CHECK (
    category = 'adult' OR cardinality(staff_roles) = 0
  )
);

-- ============================================================================
-- 4. MEMBRES DU GROUPE CLI (6 personnes inscrites en permanence)
-- ============================================================================

CREATE TABLE public.cli_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_number integer NOT NULL UNIQUE CHECK (seat_number BETWEEN 1 AND 20),
  display_name text NOT NULL,
  default_service public.service_slot NOT NULL DEFAULT '12h00',
  meal_price_chf numeric(6,2) NOT NULL DEFAULT 8.00,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insertion initiale des 6 places CLI
INSERT INTO public.cli_members (seat_number, display_name, default_service, meal_price_chf)
VALUES
  (1, 'CLI - Personne 1', '12h00', 8.00),
  (2, 'CLI - Personne 2', '12h00', 8.00),
  (3, 'CLI - Personne 3', '12h00', 8.00),
  (4, 'CLI - Personne 4', '12h00', 8.00),
  (5, 'CLI - Personne 5', '12h00', 8.00),
  (6, 'CLI - Personne 6', '12h00', 8.00)
ON CONFLICT (seat_number) DO NOTHING;

-- ============================================================================
-- 5. MENUS ET LISTE DE COURSES (menus & recipe_ingredients)
-- ============================================================================

CREATE TABLE public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_date date NOT NULL UNIQUE,
  composition_type public.menu_composition_type NOT NULL DEFAULT 'starter_main',
  starter_fr text,                         -- Entrée (si composition_type = 'starter_main')
  main_course_fr text NOT NULL,            -- Plat principal (toujours obligatoire)
  dessert_fr text DEFAULT 'Dessert du jour', -- Dessert (si 'main_dessert', peut rester générique)
  notes_fr text,
  recipe_base_servings integer NOT NULL DEFAULT 40 CHECK (recipe_base_servings > 0),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Ouverture uniquement lundi (1), mardi (2), jeudi (4) et vendredi (5)
  CONSTRAINT chk_open_days CHECK (EXTRACT(ISODOW FROM meal_date) IN (1, 2, 4, 5)),
  -- Validation de la composition du menu
  CONSTRAINT chk_menu_composition CHECK (
    (composition_type = 'starter_main' AND starter_fr IS NOT NULL AND length(trim(starter_fr)) > 0)
    OR
    (composition_type = 'main_dessert')
  )
);

CREATE TABLE public.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  ingredient_name_fr text NOT NULL,
  quantity_for_base numeric(10,2) NOT NULL CHECK (quantity_for_base > 0),
  unit text NOT NULL DEFAULT 'kg', -- ex: kg, g, L, dl, pièce, boîte
  category_fr text NOT NULL DEFAULT 'Général', -- ex: Légumes, Viande, Épicerie, Frais
  is_checked boolean NOT NULL DEFAULT false, -- Permet aux civilistes/cuisiniers de cocher les achats
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. RÉSERVATIONS / INSCRIPTIONS (reservations)
-- ============================================================================

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_date date NOT NULL,
  service public.service_slot NOT NULL,
  -- Soit un utilisateur de l'application, soit un membre de la CLI, soit un invité manuel
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  cli_member_id uuid REFERENCES public.cli_members(id) ON DELETE CASCADE,
  manual_guest_name text,
  manual_guest_category public.user_category,
  is_cli boolean NOT NULL DEFAULT false,
  price_chf numeric(6,2) NOT NULL DEFAULT 0.00 CHECK (price_chf >= 0),
  status public.reservation_status NOT NULL DEFAULT 'pending_payment',
  -- Code QR personnel par client et par inscription (NULL pour la CLI qui est validée manuellement)
  qr_code_token uuid UNIQUE,
  -- Confirmation de présence par les surveillants
  attended boolean NOT NULL DEFAULT false,
  attended_at timestamptz,
  checked_in_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Traçabilité pour inscriptions manuelles (surveillant) ou annulations CLI (admin/comptable)
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Contrainte : jour d'ouverture (lundi, mardi, jeudi, vendredi)
  CONSTRAINT chk_reservation_open_days CHECK (EXTRACT(ISODOW FROM meal_date) IN (1, 2, 4, 5)),
  -- Contrainte : identification du convive
  CONSTRAINT chk_diner_identity CHECK (
    (is_cli = true AND cli_member_id IS NOT NULL AND user_id IS NULL AND qr_code_token IS NULL)
    OR
    (is_cli = false AND (user_id IS NOT NULL OR (manual_guest_name IS NOT NULL AND length(trim(manual_guest_name)) > 0)))
  ),
  -- Un utilisateur ne peut s'inscrire qu'une seule fois par jour
  CONSTRAINT uq_user_meal_date UNIQUE (user_id, meal_date),
  -- Un membre de la CLI ne peut avoir qu'une seule ligne par jour
  CONSTRAINT uq_cli_member_meal_date UNIQUE (cli_member_id, meal_date)
);

CREATE INDEX idx_reservations_date_service ON public.reservations(meal_date, service, status);
CREATE INDEX idx_reservations_qr_token ON public.reservations(qr_code_token) WHERE qr_code_token IS NOT NULL;

-- ============================================================================
-- 7. PAIEMENTS TWINT / PAYREXX (payments)
-- ============================================================================

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL UNIQUE REFERENCES public.reservations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount_chf numeric(6,2) NOT NULL CHECK (amount_chf >= 0),
  currency text NOT NULL DEFAULT 'CHF' CHECK (currency = 'CHF'),
  payment_method text NOT NULL DEFAULT 'twint_payrexx' CHECK (
    payment_method IN ('twint_payrexx', 'free_subsidy', 'manual_on_site', 'cli_invoice')
  ),
  status public.payment_status NOT NULL DEFAULT 'pending',
  -- Champs spécifiques Payrexx
  payrexx_gateway_id text UNIQUE,
  payrexx_reference_id text UNIQUE,
  payrexx_transaction_id text,
  payrexx_payment_link text,
  confirmation_email_sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8. FACTURATION DU GROUPE CLI (cli_invoices)
-- ============================================================================

CREATE TABLE public.cli_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  period_start date NOT NULL,
  period_end date NOT NULL CHECK (period_end >= period_start),
  total_meals_attended integer NOT NULL DEFAULT 0,
  unit_price_chf numeric(6,2) NOT NULL,
  total_amount_chf numeric(8,2) NOT NULL,
  currency text NOT NULL DEFAULT 'CHF' CHECK (currency = 'CHF'),
  status public.invoice_status NOT NULL DEFAULT 'issued',
  notes_fr text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 9. FONCTIONS MÉTIER (DÉLAIS, TARIFS, CLI, QUOTA 40 PLACES, LISTE DE COURSES)
-- ============================================================================

-- 9.1 Vérifier si un utilisateur possède un rôle staff spécifique
CREATE OR REPLACE FUNCTION public.has_staff_role(p_user_id uuid, p_role public.staff_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND category = 'adult'
      AND p_role = ANY(staff_roles)
  );
$$;

-- 9.2 Calculer la date/heure limite d'inscription (Fuseau Europe/Zurich)
-- Lundi (1) et Mardi (2) -> Vendredi précédent à 18h00
-- Jeudi (4) et Vendredi (5) -> Mercredi précédent à 18h00
CREATE OR REPLACE FUNCTION public.get_registration_deadline(p_meal_date date)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_isodow int := EXTRACT(ISODOW FROM p_meal_date);
  v_deadline_date date;
BEGIN
  IF v_isodow = 1 THEN
    -- Lundi -> Vendredi précédent (-3 jours)
    v_deadline_date := p_meal_date - INTERVAL '3 days';
  ELSIF v_isodow = 2 THEN
    -- Mardi -> Vendredi précédent (-4 jours)
    v_deadline_date := p_meal_date - INTERVAL '4 days';
  ELSIF v_isodow = 4 THEN
    -- Jeudi -> Mercredi précédent (-1 jour)
    v_deadline_date := p_meal_date - INTERVAL '1 day';
  ELSIF v_isodow = 5 THEN
    -- Vendredi -> Mercredi précédent (-2 jours)
    v_deadline_date := p_meal_date - INTERVAL '2 days';
  ELSE
    RAISE EXCEPTION 'La cafétéria est fermée ce jour-là (ouverte uniquement lundi, mardi, jeudi et vendredi).';
  END IF;

  RETURN (v_deadline_date::text || ' 18:00:00')::timestamp AT TIME ZONE 'Europe/Zurich';
END;
$$;

-- 9.3 Vérifier si les inscriptions sont encore ouvertes pour une date donnée
CREATE OR REPLACE FUNCTION public.is_registration_open(p_meal_date date, p_now timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF EXTRACT(ISODOW FROM p_meal_date) NOT IN (1, 2, 4, 5) THEN
    RETURN false;
  END IF;
  RETURN p_now <= public.get_registration_deadline(p_meal_date);
END;
$$;

-- 9.4 Obtenir le tarif en CHF selon la catégorie d'utilisateur
CREATE OR REPLACE FUNCTION public.get_price_for_category(p_category public.user_category)
RETURNS numeric(6,2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_settings public.app_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_settings FROM public.app_settings WHERE id = 1;
  CASE p_category
    WHEN 'adult' THEN RETURN v_settings.price_adult_chf;
    WHEN 'student' THEN RETURN v_settings.price_student_chf;
    WHEN 'student_partial_subsidy' THEN RETURN v_settings.price_student_partial_chf;
    WHEN 'student_full_subsidy' THEN RETURN v_settings.price_student_full_chf;
  END CASE;
END;
$$;

-- 9.5 Générer automatiquement les 6 inscriptions permanentes de la CLI pour une date donnée
-- (Si une inscription CLI a déjà été annulée ponctuellement par l'admin/comptable, son statut 'cancelled' est préservé)
CREATE OR REPLACE FUNCTION public.ensure_cli_reservations_for_date(p_meal_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXTRACT(ISODOW FROM p_meal_date) NOT IN (1, 2, 4, 5) THEN
    RETURN;
  END IF;

  INSERT INTO public.reservations (
    meal_date,
    service,
    cli_member_id,
    is_cli,
    price_chf,
    status,
    qr_code_token
  )
  SELECT
    p_meal_date,
    cm.default_service,
    cm.id,
    true,
    cm.meal_price_chf,
    'confirmed'::public.reservation_status,
    NULL
  FROM public.cli_members cm
  WHERE cm.is_active = true
  ON CONFLICT (cli_member_id, meal_date) DO NOTHING;
END;
$$;

-- 9.6 Compter le nombre de places occupées (inclut les 6 personnes de la CLI non annulées)
CREATE OR REPLACE FUNCTION public.get_remaining_capacity(
  p_meal_date date,
  p_service public.service_slot
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings public.app_settings%ROWTYPE;
  v_occupied integer;
BEGIN
  -- S'assurer que les 6 membres CLI sont bien initialisés pour ce jour
  PERFORM public.ensure_cli_reservations_for_date(p_meal_date);

  SELECT * INTO v_settings FROM public.app_settings WHERE id = 1;

  IF v_settings.capacity_scope = 'per_day' THEN
    SELECT count(*) INTO v_occupied
    FROM public.reservations
    WHERE meal_date = p_meal_date
      AND status IN ('confirmed', 'pending_payment');
  ELSE
    SELECT count(*) INTO v_occupied
    FROM public.reservations
    WHERE meal_date = p_meal_date
      AND service = p_service
      AND status IN ('confirmed', 'pending_payment');
  END IF;

  RETURN GREATEST(0, v_settings.max_capacity - v_occupied);
END;
$$;

-- 9.7 Calculer la liste de courses adaptée au nombre réel de personnes inscrites
CREATE OR REPLACE FUNCTION public.get_scaled_shopping_list(p_meal_date date)
RETURNS TABLE (
  ingredient_id uuid,
  ingredient_name_fr text,
  category_fr text,
  unit text,
  base_servings integer,
  registered_diners bigint,
  quantity_for_base numeric(10,2),
  scaled_quantity numeric(10,2),
  is_checked boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_diners bigint;
BEGIN
  PERFORM public.ensure_cli_reservations_for_date(p_meal_date);

  SELECT count(*) INTO v_diners
  FROM public.reservations r
  WHERE r.meal_date = p_meal_date
    AND r.status = 'confirmed';

  RETURN QUERY
  SELECT
    ri.id AS ingredient_id,
    ri.ingredient_name_fr,
    ri.category_fr,
    ri.unit,
    m.recipe_base_servings AS base_servings,
    v_diners AS registered_diners,
    ri.quantity_for_base,
    ROUND(
      (ri.quantity_for_base * GREATEST(v_diners, 1)::numeric) / m.recipe_base_servings::numeric,
      2
    ) AS scaled_quantity,
    ri.is_checked
  FROM public.menus m
  JOIN public.recipe_ingredients ri ON ri.menu_id = m.id
  WHERE m.meal_date = p_meal_date
  ORDER BY ri.category_fr, ri.ingredient_name_fr;
END;
$$;

-- 9.8 Générer une facture pour la CLI en fonction des jours de présence confirmés
CREATE OR REPLACE FUNCTION public.generate_cli_invoice(
  p_period_start date,
  p_period_end date,
  p_notes_fr text DEFAULT NULL
)
RETURNS public.cli_invoices
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_meals_count integer;
  v_total_chf numeric(8,2);
  v_unit_price numeric(6,2);
  v_invoice_num text;
  v_invoice public.cli_invoices%ROWTYPE;
BEGIN
  IF NOT (public.has_staff_role(v_caller, 'comptable') OR public.has_staff_role(v_caller, 'administrateur')) THEN
    RAISE EXCEPTION 'Accès refusé : seuls le comptable ou l''administrateur peuvent générer une facture CLI.';
  END IF;

  SELECT cli_meal_price_chf INTO v_unit_price FROM public.app_settings WHERE id = 1;

  SELECT
    count(*)::integer,
    COALESCE(sum(r.price_chf), 0.00)
  INTO v_meals_count, v_total_chf
  FROM public.reservations r
  WHERE r.is_cli = true
    AND r.status = 'confirmed'
    AND r.attended = true
    AND r.meal_date BETWEEN p_period_start AND p_period_end;

  v_invoice_num := 'CLI-' || to_char(p_period_start, 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 4);

  INSERT INTO public.cli_invoices (
    invoice_number,
    period_start,
    period_end,
    total_meals_attended,
    unit_price_chf,
    total_amount_chf,
    status,
    notes_fr,
    created_by
  ) VALUES (
    upper(v_invoice_num),
    p_period_start,
    p_period_end,
    v_meals_count,
    v_unit_price,
    v_total_chf,
    'issued',
    p_notes_fr,
    v_caller
  )
  RETURNING * INTO v_invoice;

  RETURN v_invoice;
END;
$$;

-- ============================================================================
-- 10. TRIGGER DE CRÉATION AUTOMATIQUE DE PROFIL LORS DE L'INSCRIPTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_initial_category text;
  v_category public.user_category;
BEGIN
  -- Lors de l'inscription, l'utilisateur ne peut choisir qu'entre 'adult' et 'student'.
  -- Les subventions ('student_partial_subsidy', 'student_full_subsidy') sont attribuées par l'administrateur.
  v_initial_category := COALESCE(NEW.raw_user_meta_data->>'category', 'student');
  IF v_initial_category = 'adult' THEN
    v_category := 'adult';
  ELSE
    v_category := 'student';
  END IF;

  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    category,
    class_number
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Prénom'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'Nom'),
    NEW.email,
    v_category,
    CASE WHEN v_category = 'student' THEN COALESCE(NEW.raw_user_meta_data->>'class_number', 'Non renseignée') ELSE NULL END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================================
-- 11. POLITIQUES DE SÉCURITÉ (ROW LEVEL SECURITY - RLS)
-- ============================================================================

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cli_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cli_invoices ENABLE ROW LEVEL SECURITY;

-- app_settings : lecture pour tous les utilisateurs authentifiés, écriture pour administrateur/comptable
CREATE POLICY "Lecture des paramètres pour tous"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Modification des paramètres par admin ou comptable"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (
    public.has_staff_role(auth.uid(), 'administrateur')
    OR public.has_staff_role(auth.uid(), 'comptable')
  );

-- profiles : chacun voit son profil ; le staff voit les profils ; seul l'admin modifie les subventions/rôles
CREATE POLICY "Lecture de son propre profil ou par le staff"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.has_staff_role(auth.uid(), 'administrateur')
    OR public.has_staff_role(auth.uid(), 'surveillant')
    OR public.has_staff_role(auth.uid(), 'comptable')
  );

CREATE POLICY "Mise à jour par l'administrateur"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_staff_role(auth.uid(), 'administrateur'));

-- menus : lecture pour tous, gestion par les cuisiniers et administrateurs
CREATE POLICY "Lecture des menus pour tous"
  ON public.menus FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gestion des menus par cuisiniers et admins"
  ON public.menus FOR ALL
  TO authenticated
  USING (
    public.has_staff_role(auth.uid(), 'cuisinier')
    OR public.has_staff_role(auth.uid(), 'administrateur')
  );

-- recipe_ingredients : lecture/modification par cuisiniers, civilistes et administrateurs
CREATE POLICY "Accès liste de courses pour cuisiniers, civilistes et admins"
  ON public.recipe_ingredients FOR ALL
  TO authenticated
  USING (
    public.has_staff_role(auth.uid(), 'cuisinier')
    OR public.has_staff_role(auth.uid(), 'civiliste')
    OR public.has_staff_role(auth.uid(), 'administrateur')
  );

-- cli_members : lecture par staff, modification par admin et comptable
CREATE POLICY "Lecture CLI par staff"
  ON public.cli_members FOR SELECT
  TO authenticated
  USING (
    public.has_staff_role(auth.uid(), 'surveillant')
    OR public.has_staff_role(auth.uid(), 'comptable')
    OR public.has_staff_role(auth.uid(), 'administrateur')
    OR public.has_staff_role(auth.uid(), 'cuisinier')
  );

CREATE POLICY "Modification CLI par admin et comptable"
  ON public.cli_members FOR ALL
  TO authenticated
  USING (
    public.has_staff_role(auth.uid(), 'administrateur')
    OR public.has_staff_role(auth.uid(), 'comptable')
  );

-- reservations : chacun voit ses réservations ; surveillants, comptables, cuisiniers et admins voient toutes les réservations
CREATE POLICY "Lecture des réservations"
  ON public.reservations FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_staff_role(auth.uid(), 'surveillant')
    OR public.has_staff_role(auth.uid(), 'comptable')
    OR public.has_staff_role(auth.uid(), 'cuisinier')
    OR public.has_staff_role(auth.uid(), 'administrateur')
  );

CREATE POLICY "Création de réservation par l'utilisateur ou un surveillant/admin"
  ON public.reservations FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_staff_role(auth.uid(), 'surveillant')
    OR public.has_staff_role(auth.uid(), 'administrateur')
  );

CREATE POLICY "Mise à jour des réservations par surveillant, comptable ou admin"
  ON public.reservations FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_staff_role(auth.uid(), 'surveillant')
    OR public.has_staff_role(auth.uid(), 'comptable')
    OR public.has_staff_role(auth.uid(), 'administrateur')
  );

-- payments : l'utilisateur voit ses paiements ; le comptable et l'admin ont accès à tous les paiements
CREATE POLICY "Lecture des paiements"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_staff_role(auth.uid(), 'comptable')
    OR public.has_staff_role(auth.uid(), 'administrateur')
  );

-- cli_invoices : réservé au comptable et à l'administrateur
CREATE POLICY "Gestion des factures CLI par comptable et admin"
  ON public.cli_invoices FOR ALL
  TO authenticated
  USING (
    public.has_staff_role(auth.uid(), 'comptable')
    OR public.has_staff_role(auth.uid(), 'administrateur')
  );
