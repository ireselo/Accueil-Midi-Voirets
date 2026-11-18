// Script d'initialisation des données et des comptes dans Supabase (https://ypbqpjcskybkzzhhehme.supabase.co)
// Exécuter avec : node --env-file=.env supabase/seed_initial_data.mjs

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ypbqpjcskybkzzhhehme.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Erreur : SUPABASE_SERVICE_ROLE_KEY manquant dans .env');
  process.exit(1);
}

async function upsertRest(table, rows, onConflict) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${
    onConflict ? `?on_conflict=${onConflict}` : ''
  }`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Erreur sur ${table} (${res.status}): ${text}`);
  }
  return JSON.parse(text);
}

async function callRpc(fnName, params) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/${fnName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erreur RPC ${fnName} (${res.status}): ${text}`);
  }
}

async function ensureAuthUser(userSpec) {
  // Créer l'utilisateur via l'API Admin Auth de Supabase avec mot de passe chiffré
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: userSpec.email,
      password: userSpec.password,
      email_confirm: true,
      user_metadata: {
        first_name: userSpec.first_name,
        last_name: userSpec.last_name,
        category: userSpec.category === 'adult' ? 'adult' : 'student',
        class_number: userSpec.class_number,
      },
    }),
  });

  // Mettre à jour la catégorie exacte (ex: subvention partielle/totale) et les rôles staff dans public.profiles
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(userSpec.email)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        category: userSpec.category,
        class_number: userSpec.class_number,
        staff_roles: userSpec.staff_roles,
      }),
    }
  );
  if (profileRes.ok) {
    console.log(`   ✓ Compte vérifié : ${userSpec.email} (${userSpec.category})`);
  }
}

async function main() {
  console.log('1. Configuration des paramètres globaux (CHF & limite 40 personnes au total)...');
  await upsertRest(
    'app_settings',
    [
      {
        id: 1,
        app_name: 'Accueil Midi-Voirets',
        cafeteria_name: 'Cafétéria Scolaire des Voirets',
        currency: 'CHF',
        price_adult_chf: 10.0,
        price_student_chf: 8.0,
        price_student_partial_chf: 4.0,
        price_student_full_chf: 0.0,
        cli_group_size: 6,
        cli_default_service: '12h00',
        cli_meal_price_chf: 8.0,
        max_capacity: 40,
        capacity_scope: 'per_day',
      },
    ],
    'id'
  );

  console.log('2. Création des comptes utilisateurs initiaux avec mot de passe (Voirets2026!)...');
  const demoUsers = [
    {
      email: 'sophie.rochat@voirets.ch',
      password: 'Voirets2026!',
      first_name: 'Sophie',
      last_name: 'Rochat',
      category: 'adult',
      class_number: null,
      staff_roles: ['administrateur', 'surveillant', 'cuisinier', 'civiliste', 'comptable'],
    },
    {
      email: 'lucas.favre@edu.ge.ch',
      password: 'Voirets2026!',
      first_name: 'Lucas',
      last_name: 'Favre',
      category: 'student',
      class_number: '9VG-2',
      staff_roles: [],
    },
    {
      email: 'emma.berset@edu.ge.ch',
      password: 'Voirets2026!',
      first_name: 'Emma',
      last_name: 'Berset',
      category: 'student_partial_subsidy',
      class_number: '10LS-1',
      staff_roles: [],
    },
    {
      email: 'noah.keller@edu.ge.ch',
      password: 'Voirets2026!',
      first_name: 'Noah',
      last_name: 'Keller',
      category: 'student_full_subsidy',
      class_number: '11CT-3',
      staff_roles: [],
    },
  ];

  for (const u of demoUsers) {
    await ensureAuthUser(u);
  }

  console.log('3. Insertion des menus de la semaine en français (Lun, Mar, Jeu, Ven)...');
  const menus = await upsertRest(
    'menus',
    [
      {
        meal_date: '2026-11-23',
        composition_type: 'starter_main',
        starter_fr: 'Salade mêlée de saison aux graines de courge',
        main_course_fr: 'Émincé de volaille à la zurichoise et röstis dorés',
        dessert_fr: null,
        notes_fr: 'Volaille suisse, fait maison.',
        recipe_base_servings: 20,
      },
      {
        meal_date: '2026-11-24',
        composition_type: 'main_dessert',
        starter_fr: null,
        main_course_fr: 'Lasagnes maison au bœuf et légumes du marché',
        dessert_fr: 'Dessert du jour',
        notes_fr: 'Option végétarienne disponible.',
        recipe_base_servings: 20,
      },
      {
        meal_date: '2026-11-26',
        composition_type: 'starter_main',
        starter_fr: 'Velouté de courge butternut aux croûtons',
        main_course_fr: 'Filet de colin au citron, riz parfumé et brocolis',
        dessert_fr: null,
        notes_fr: null,
        recipe_base_servings: 20,
      },
      {
        meal_date: '2026-11-27',
        composition_type: 'main_dessert',
        starter_fr: null,
        main_course_fr: 'Penne all’arrabbiata et copeaux de gruyère AOP',
        dessert_fr: 'Dessert du jour',
        notes_fr: 'Menu végétarien.',
        recipe_base_servings: 20,
      },
    ],
    'meal_date'
  );

  console.log('4. Génération automatique des 6 inscriptions permanentes CLI pour la semaine...');
  for (const m of menus) {
    await callRpc('ensure_cli_reservations_for_date', { p_meal_date: m.meal_date });
  }

  console.log(`✅ Base de données et comptes Auth Supabase (ypbqpjcskybkzzhhehme) synchronisés !`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
