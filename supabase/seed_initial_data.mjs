// Script d'initialisation des données dans Supabase (https://ypbqpjcskybkzzhhehme.supabase.co)
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

  console.log('2. Insertion des menus de la semaine en français (Lun, Mar, Jeu, Ven)...');
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

  console.log('3. Génération automatique des 6 inscriptions permanentes CLI pour la semaine...');
  for (const m of menus) {
    await callRpc('ensure_cli_reservations_for_date', { p_meal_date: m.meal_date });
  }

  console.log(`✅ Base de données Supabase (ypbqpjcskybkzzhhehme) prête et synchronisée !`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
