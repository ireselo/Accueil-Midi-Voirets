# Accueil Midi-Voirets

Application mobile (Android & iOS) en **React Native / Expo (TypeScript)** et **Supabase** pour la gestion des réservations, des menus et de la facturation d'une cafétéria scolaire.

## Fonctionnalités principales (100 % en français, tarifs en CHF)

- **Jours d'ouverture et services** :
  - Ouvert les **lundi, mardi, jeudi et vendredi**.
  - Deux services par jour : **12h00** et **12h50**.
  - **Clôture des inscriptions** :
    - Lundi et mardi : clôture le **vendredi précédent à 18h00**.
    - Jeudi et vendredi : clôture le **mercredi précédent à 18h00**.
  - **Capacité maximale** : **40 personnes inscrites au total par jour** (incluant les 6 personnes permanentes de la CLI).
- **Catégories d'utilisateurs et tarifs en Francs suisses (CHF)** :
  - **Adulte** : `10.00 CHF`
  - **Élève** : `8.00 CHF` (numéro de classe obligatoire à l'inscription)
  - **Élève partiellement subventionné** : `4.00 CHF` (autorisé par l'administrateur)
  - **Élève totalement subventionné** : `0.00 CHF` (autorisé par l'administrateur)
- **Paiement Twint (Payrexx) & Code QR personnel** :
  - Paiement via **Twint (Payrexx)** en CHF.
  - Génération d'un **code QR personnel unique** pour chaque client et chaque inscription, accessible dans le profil et envoyé par e-mail de confirmation.
- **Groupe spécial CLI (6 personnes inscrites d'office)** :
  - Comptabilisées automatiquement dans la limite quotidienne de **40 inscrits**.
  - Confirmation de présence **manuelle (sans code QR)** par les surveillants.
  - Facturation périodique par le comptable en fonction des jours de présence confirmés.
  - Annulation ponctuelle possible par l'administrateur ou le comptable.
- **Rôles des adultes membres de la cafétéria (cumulables)** :
  - **Surveillant** : liste des inscrits, scan des codes QR, présence manuelle CLI, inscription manuelle.
  - **Cuisinier** : saisie du menu unique du jour (*Entrée + Plat principal* ou *Plat principal + Dessert*) et liste de courses ajustée au nombre d'inscrits.
  - **Civiliste** : consultation et suivi de la liste de courses.
  - **Comptable** : suivi des paiements Twint, facturation CLI et annulation ponctuelle CLI.
  - **Administrateur** : gestion des utilisateurs, autorisation des subventions élèves, attribution des rôles staff et gestion CLI.

## Structure du projet

- `supabase/migrations/20261117000001_initial_schema.sql` : Schéma PostgreSQL complet, fonctions RPC, calcul des délais (`Europe/Zurich`), quota de 40 personnes et politiques RLS.
- `supabase/functions/create-payrexx-gateway/index.ts` : Edge Function d'initialisation du paiement Twint via Payrexx.
- `supabase/functions/payrexx-webhook/index.ts` : Edge Function de confirmation Payrexx, génération du code QR et envoi d'e-mail.
- `src/types/database.ts` : Types TypeScript du modèle de données.
- `src/utils/cafeteriaRules.ts` : Règles métier, horaires limites et formatage CHF.
- `src/theme/stitchTheme.ts` : Thème centralisé de l'interface.
- `src/context/CafeteriaContext.tsx` : État global et logique métier.
- `src/screens/AuthScreen.tsx` : Création de compte (Adulte / Élève avec numéro de classe) et sélection de profil.
- `src/screens/MenuBookingScreen.tsx` : Consultation du menu du jour, jauge sur 40 places, choix du service (`12h00` / `12h50`) et paiement Twint.
- `src/screens/ProfileQrScreen.tsx` : Profil personnel et codes QR par inscription.
- `src/screens/StaffDashboardScreen.tsx` : Tableau de bord multi-rôles (Surveillant, Cuisinier, Civiliste, Comptable, Administrateur).
