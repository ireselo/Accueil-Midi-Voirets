import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  AppSettings,
  CliInvoice,
  CliMember,
  MenuCompositionType,
  MenuDay,
  PaymentRecord,
  RecipeIngredient,
  Reservation,
  ScaledShoppingItem,
  ServiceSlot,
  StaffRole,
  UserCategory,
  UserProfile,
} from '../types/database';
import {
  USER_CATEGORY_PRICES_CHF,
  isCafeteriaOpenDay,
  isRegistrationOpenNow,
} from '../utils/cafeteriaRules';

interface RegisterUserInput {
  firstName: string;
  lastName: string;
  email: string;
  initialCategory: 'adult' | 'student';
  classNumber?: string;
}

interface CafeteriaContextValue {
  settings: AppSettings;
  currentUser: UserProfile | null;
  users: UserProfile[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  availableDates: { date: string; labelFr: string }[];
  menus: MenuDay[];
  ingredients: RecipeIngredient[];
  cliMembers: CliMember[];
  reservations: Reservation[];
  payments: PaymentRecord[];
  cliInvoices: CliInvoice[];
  // Authentification & Profil
  registerNewUser: (input: RegisterUserInput) => { ok: boolean; messageFr: string };
  switchDemoUser: (userId: string) => void;
  logout: () => void;
  // Réservation & Paiement Twint (Payrexx)
  getDailyConfirmedCount: (mealDate: string) => number;
  getRemainingDailyPlaces: (mealDate: string) => number;
  bookAndPayWithTwint: (
    mealDate: string,
    service: ServiceSlot
  ) => { ok: boolean; messageFr: string; reservation?: Reservation };
  // Surveillant (Vigilante)
  confirmAttendanceByQr: (qrToken: string) => { ok: boolean; messageFr: string };
  toggleCliAttendanceManual: (reservationId: string) => void;
  registerClientManually: (
    mealDate: string,
    service: ServiceSlot,
    guestName: string,
    category: UserCategory
  ) => { ok: boolean; messageFr: string };
  // Cuisinier & Civiliste
  saveDailyMenu: (
    mealDate: string,
    compositionType: MenuCompositionType,
    starterFr: string,
    mainCourseFr: string,
    dessertFr: string,
    baseServings: number
  ) => { ok: boolean; messageFr: string };
  addRecipeIngredient: (
    mealDate: string,
    ingredientNameFr: string,
    quantityForBase: number,
    unit: string,
    categoryFr: string
  ) => { ok: boolean; messageFr: string };
  toggleShoppingItemChecked: (ingredientId: string) => void;
  getScaledShoppingListForDate: (mealDate: string) => ScaledShoppingItem[];
  // Comptable & Administrateur
  toggleCliReservationCancelled: (reservationId: string) => { ok: boolean; messageFr: string };
  updateCliSettings: (defaultService: ServiceSlot, mealPriceChf: number) => void;
  generateCliInvoiceForPeriod: (
    periodStart: string,
    periodEnd: string,
    notesFr?: string
  ) => { ok: boolean; messageFr: string; invoice?: CliInvoice };
  updateStudentSubsidy: (
    studentUserId: string,
    newCategory: 'student' | 'student_partial_subsidy' | 'student_full_subsidy'
  ) => { ok: boolean; messageFr: string };
  toggleAdultStaffRole: (adultUserId: string, role: StaffRole) => { ok: boolean; messageFr: string };
  updateBrandingNames: (appName: string, cafeteriaName: string) => void;
}

const INITIAL_DATES = [
  { date: '2026-11-23', labelFr: 'Lundi 23 nov.' },
  { date: '2026-11-24', labelFr: 'Mardi 24 nov.' },
  { date: '2026-11-26', labelFr: 'Jeudi 26 nov.' },
  { date: '2026-11-27', labelFr: 'Vendredi 27 nov.' },
];

const INITIAL_USERS: UserProfile[] = [
  {
    id: 'user-admin-multi',
    first_name: 'Sophie',
    last_name: 'Rochat',
    email: 'sophie.rochat@voirets.ch',
    category: 'adult',
    class_number: null,
    staff_roles: ['administrateur', 'surveillant', 'cuisinier', 'civiliste', 'comptable'],
    created_at: '2026-11-01T08:00:00Z',
  },
  {
    id: 'user-student-regular',
    first_name: 'Lucas',
    last_name: 'Favre',
    email: 'lucas.favre@edu.ge.ch',
    category: 'student',
    class_number: '9VG-2',
    staff_roles: [],
    created_at: '2026-11-02T09:00:00Z',
  },
  {
    id: 'user-student-partial',
    first_name: 'Emma',
    last_name: 'Berset',
    email: 'emma.berset@edu.ge.ch',
    category: 'student_partial_subsidy',
    class_number: '10LS-1',
    staff_roles: [],
    created_at: '2026-11-03T09:00:00Z',
  },
  {
    id: 'user-student-full',
    first_name: 'Noah',
    last_name: 'Keller',
    email: 'noah.keller@edu.ge.ch',
    category: 'student_full_subsidy',
    class_number: '11CT-3',
    staff_roles: [],
    created_at: '2026-11-04T09:00:00Z',
  },
];

const INITIAL_CLI_MEMBERS: CliMember[] = [1, 2, 3, 4, 5, 6].map((num) => ({
  id: `cli-member-${num}`,
  seat_number: num,
  display_name: `CLI — Personne ${num}`,
  default_service: '12h00',
  meal_price_chf: 8.0,
  is_active: true,
}));

const INITIAL_MENUS: MenuDay[] = [
  {
    id: 'menu-2026-11-23',
    meal_date: '2026-11-23',
    composition_type: 'starter_main',
    starter_fr: 'Salade mêlée de saison aux graines de courge',
    main_course_fr: 'Émincé de volaille à la zurichoise et röstis dorés',
    dessert_fr: null,
    notes_fr: 'Volaille suisse, sans porc.',
    recipe_base_servings: 20,
  },
  {
    id: 'menu-2026-11-24',
    meal_date: '2026-11-24',
    composition_type: 'main_dessert',
    starter_fr: null,
    main_course_fr: 'Lasagnes maison au bœuf et légumes du marché',
    dessert_fr: 'Dessert du jour',
    notes_fr: 'Option végétarienne disponible sur demande.',
    recipe_base_servings: 20,
  },
  {
    id: 'menu-2026-11-26',
    meal_date: '2026-11-26',
    composition_type: 'starter_main',
    starter_fr: 'Velouté de courge butternut aux croûtons',
    main_course_fr: 'Filet de colin au citron, riz parfumé et brocolis',
    dessert_fr: null,
    notes_fr: null,
    recipe_base_servings: 20,
  },
  {
    id: 'menu-2026-11-27',
    meal_date: '2026-11-27',
    composition_type: 'main_dessert',
    starter_fr: null,
    main_course_fr: 'Penne all’arrabbiata et copeaux de gruyère AOP',
    dessert_fr: 'Dessert du jour',
    notes_fr: 'Menu végétarien.',
    recipe_base_servings: 20,
  },
];

const INITIAL_INGREDIENTS: RecipeIngredient[] = [
  {
    id: 'ing-1',
    menu_id: 'menu-2026-11-23',
    ingredient_name_fr: 'Émincé de poulet suisse',
    quantity_for_base: 3.5,
    unit: 'kg',
    category_fr: 'Viande & Poisson',
    is_checked: false,
  },
  {
    id: 'ing-2',
    menu_id: 'menu-2026-11-23',
    ingredient_name_fr: 'Pommes de terre pour röstis',
    quantity_for_base: 5.0,
    unit: 'kg',
    category_fr: 'Fruits & Légumes',
    is_checked: true,
  },
  {
    id: 'ing-3',
    menu_id: 'menu-2026-11-23',
    ingredient_name_fr: 'Crème entière (sauce)',
    quantity_for_base: 1.5,
    unit: 'L',
    category_fr: 'Produits laitiers',
    is_checked: false,
  },
  {
    id: 'ing-4',
    menu_id: 'menu-2026-11-23',
    ingredient_name_fr: 'Salade verte et crudités',
    quantity_for_base: 1.2,
    unit: 'kg',
    category_fr: 'Fruits & Légumes',
    is_checked: true,
  },
];

function buildInitialReservations(): Reservation[] {
  const list: Reservation[] = [];
  // Générer automatiquement les 6 personnes de la CLI sur chaque jour d'ouverture
  for (const d of INITIAL_DATES) {
    for (const cli of INITIAL_CLI_MEMBERS) {
      list.push({
        id: `res-cli-${d.date}-${cli.seat_number}`,
        meal_date: d.date,
        service: cli.default_service,
        user_id: null,
        cli_member_id: cli.id,
        manual_guest_name: null,
        manual_guest_category: null,
        is_cli: true,
        price_chf: cli.meal_price_chf,
        status: 'confirmed',
        qr_code_token: null, // La CLI n'a pas de code QR (validation manuelle par les surveillants)
        attended: d.date === '2026-11-23' && cli.seat_number <= 5,
        attended_at: d.date === '2026-11-23' && cli.seat_number <= 5 ? '2026-11-23T12:08:00Z' : null,
        checked_in_by: 'user-admin-multi',
        created_at: '2026-11-15T10:00:00Z',
      });
    }
  }

  // Exemples d'inscriptions avec code QR personnel
  list.push({
    id: 'res-demo-lucas',
    meal_date: '2026-11-23',
    service: '12h00',
    user_id: 'user-student-regular',
    cli_member_id: null,
    manual_guest_name: null,
    manual_guest_category: null,
    is_cli: false,
    price_chf: 8.0,
    status: 'confirmed',
    qr_code_token: 'AMV-QR-20261123-LUCAS-12H00',
    attended: false,
    attended_at: null,
    checked_in_by: null,
    created_at: '2026-11-16T14:20:00Z',
  });

  list.push({
    id: 'res-demo-emma',
    meal_date: '2026-11-23',
    service: '12h50',
    user_id: 'user-student-partial',
    cli_member_id: null,
    manual_guest_name: null,
    manual_guest_category: null,
    is_cli: false,
    price_chf: 4.0,
    status: 'confirmed',
    qr_code_token: 'AMV-QR-20261123-EMMA-12H50',
    attended: true,
    attended_at: '2026-11-23T12:52:00Z',
    checked_in_by: 'user-admin-multi',
    created_at: '2026-11-16T15:10:00Z',
  });

  return list;
}

const INITIAL_PAYMENTS: PaymentRecord[] = [
  {
    id: 'pay-demo-lucas',
    reservation_id: 'res-demo-lucas',
    user_id: 'user-student-regular',
    amount_chf: 8.0,
    currency: 'CHF',
    payment_method: 'twint_payrexx',
    status: 'paid',
    payrexx_gateway_id: 'PRX-GW-89412',
    payrexx_reference_id: 'AMV-res-demo-lucas',
    payrexx_transaction_id: 'TWINT-CH-994120',
    payrexx_payment_link: 'https://voirets.payrexx.com/fr/?payment=PRX-GW-89412',
    confirmation_email_sent_at: '2026-11-16T14:20:05Z',
    paid_at: '2026-11-16T14:20:03Z',
    created_at: '2026-11-16T14:20:00Z',
  },
  {
    id: 'pay-demo-emma',
    reservation_id: 'res-demo-emma',
    user_id: 'user-student-partial',
    amount_chf: 4.0,
    currency: 'CHF',
    payment_method: 'twint_payrexx',
    status: 'paid',
    payrexx_gateway_id: 'PRX-GW-89419',
    payrexx_reference_id: 'AMV-res-demo-emma',
    payrexx_transaction_id: 'TWINT-CH-994188',
    payrexx_payment_link: 'https://voirets.payrexx.com/fr/?payment=PRX-GW-89419',
    confirmation_email_sent_at: '2026-11-16T15:10:06Z',
    paid_at: '2026-11-16T15:10:04Z',
    created_at: '2026-11-16T15:10:00Z',
  },
];

const CafeteriaContext = createContext<CafeteriaContextValue | undefined>(undefined);

export const CafeteriaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>({
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
    max_capacity: 40, // Límite de 40 personas en total por día
    capacity_scope: 'per_day',
  });

  const [users, setUsers] = useState<UserProfile[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(INITIAL_USERS[0]);
  const [selectedDate, setSelectedDate] = useState<string>(INITIAL_DATES[0].date);
  const [menus, setMenus] = useState<MenuDay[]>(INITIAL_MENUS);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(INITIAL_INGREDIENTS);
  const [cliMembers, setCliMembers] = useState<CliMember[]>(INITIAL_CLI_MEMBERS);
  const [reservations, setReservations] = useState<Reservation[]>(buildInitialReservations);
  const [payments, setPayments] = useState<PaymentRecord[]>(INITIAL_PAYMENTS);
  const [cliInvoices, setCliInvoices] = useState<CliInvoice[]>([
    {
      id: 'inv-cli-1',
      invoice_number: 'CLI-202611-001',
      period_start: '2026-11-01',
      period_end: '2026-11-24',
      total_meals_attended: 5,
      unit_price_chf: 8.0,
      total_amount_chf: 40.0,
      currency: 'CHF',
      status: 'issued',
      notes_fr: 'Facturation des repas CLI selon les présences confirmées par les surveillants.',
      created_at: '2026-11-23T15:00:00Z',
    },
  ]);

  // Nombre total d'inscrits confirmés pour la journée (inclut les 6 places CLI actives)
  const getDailyConfirmedCount = (mealDate: string): number => {
    return reservations.filter(
      (r) => r.meal_date === mealDate && r.status === 'confirmed'
    ).length;
  };

  // Places restantes sur la limite totale de 40 personnes par jour
  const getRemainingDailyPlaces = (mealDate: string): number => {
    const confirmed = getDailyConfirmedCount(mealDate);
    return Math.max(0, settings.max_capacity - confirmed);
  };

  const registerNewUser = (input: RegisterUserInput) => {
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const email = input.email.trim().toLowerCase();
    const classNumber = input.classNumber?.trim() || null;

    if (!firstName || !lastName || !email) {
      return {
        ok: false,
        messageFr: 'Veuillez renseigner votre prénom, votre nom et votre adresse e-mail.',
      };
    }

    if (input.initialCategory === 'student' && !classNumber) {
      return {
        ok: false,
        messageFr: 'Le numéro de classe est obligatoire pour créer un compte élève.',
      };
    }

    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      first_name: firstName,
      last_name: lastName,
      email,
      category: input.initialCategory,
      class_number: input.initialCategory === 'student' ? classNumber : null,
      staff_roles: [],
      created_at: new Date().toISOString(),
    };

    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    return {
      ok: true,
      messageFr: `Bienvenue ${firstName} ${lastName} ! Votre compte (${
        input.initialCategory === 'adult' ? 'Adulte' : `Élève — Classe ${classNumber}`
      }) a été créé.`,
    };
  };

  const switchDemoUser = (userId: string) => {
    const found = users.find((u) => u.id === userId);
    if (found) setCurrentUser(found);
  };

  const logout = () => setCurrentUser(null);

  const bookAndPayWithTwint = (mealDate: string, service: ServiceSlot) => {
    if (!currentUser) {
      return { ok: false, messageFr: 'Veuillez vous connecter pour réserver un repas.' };
    }

    if (!isCafeteriaOpenDay(mealDate)) {
      return {
        ok: false,
        messageFr:
          'La cafétéria est ouverte uniquement le lundi, mardi, jeudi et vendredi.',
      };
    }

    if (!isRegistrationOpenNow(mealDate)) {
      return {
        ok: false,
        messageFr:
          'Les inscriptions pour ce jour sont clôturées (vendredi 18h00 pour lundi/mardi ; mercredi 18h00 pour jeudi/vendredi).',
      };
    }

    const existing = reservations.find(
      (r) =>
        r.meal_date === mealDate &&
        r.user_id === currentUser.id &&
        r.status === 'confirmed'
    );
    if (existing) {
      return {
        ok: false,
        messageFr: `Vous êtes déjà inscrit(e) pour ce jour au service de ${existing.service}.`,
      };
    }

    const remaining = getRemainingDailyPlaces(mealDate);
    if (remaining <= 0) {
      return {
        ok: false,
        messageFr:
          'Complet : la limite maximale de 40 personnes inscrites pour cette journée est atteinte.',
      };
    }

    const priceChf = USER_CATEGORY_PRICES_CHF[currentUser.category];
    const qrToken = `AMV-QR-${mealDate.replace(/-/g, '')}-${currentUser.last_name.toUpperCase()}-${service}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;
    const nowIso = new Date().toISOString();

    const newReservation: Reservation = {
      id: `res-${Date.now()}`,
      meal_date: mealDate,
      service,
      user_id: currentUser.id,
      cli_member_id: null,
      manual_guest_name: null,
      manual_guest_category: null,
      is_cli: false,
      price_chf: priceChf,
      status: 'confirmed',
      qr_code_token: qrToken,
      attended: false,
      attended_at: null,
      checked_in_by: null,
      created_at: nowIso,
    };

    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      reservation_id: newReservation.id,
      user_id: currentUser.id,
      amount_chf: priceChf,
      currency: 'CHF',
      payment_method: priceChf === 0 ? 'free_subsidy' : 'twint_payrexx',
      status: priceChf === 0 ? 'exempt' : 'paid',
      payrexx_gateway_id: priceChf === 0 ? null : `PRX-GW-${Math.floor(10000 + Math.random() * 90000)}`,
      payrexx_reference_id: `AMV-${newReservation.id}`,
      payrexx_transaction_id:
        priceChf === 0 ? null : `TWINT-CH-${Math.floor(100000 + Math.random() * 900000)}`,
      payrexx_payment_link:
        priceChf === 0 ? null : 'https://voirets.payrexx.com/fr/?pm=twint',
      confirmation_email_sent_at: nowIso,
      paid_at: nowIso,
      created_at: nowIso,
    };

    setReservations((prev) => [newReservation, ...prev]);
    setPayments((prev) => [newPayment, ...prev]);

    return {
      ok: true,
      reservation: newReservation,
      messageFr:
        priceChf === 0
          ? `Inscription confirmée (0.00 CHF — Subvention totale) pour le service de ${service}. Votre code QR personnel a été généré et envoyé par e-mail à ${currentUser.email}.`
          : `Paiement Twint (Payrexx) de ${priceChf.toFixed(
              2
            )} CHF confirmé pour le service de ${service}. Votre code QR personnel est disponible dans votre profil et a été envoyé à ${
              currentUser.email
            }.`,
    };
  };

  const confirmAttendanceByQr = (qrToken: string) => {
    const cleanToken = qrToken.trim();
    const target = reservations.find(
      (r) => r.qr_code_token?.toLowerCase() === cleanToken.toLowerCase() && r.status === 'confirmed'
    );

    if (!target) {
      return {
        ok: false,
        messageFr: `Aucun inscrit trouvé pour le code QR « ${cleanToken} ».`,
      };
    }

    const dinerUser = users.find((u) => u.id === target.user_id);
    const dinerLabel = dinerUser
      ? `${dinerUser.first_name} ${dinerUser.last_name}`
      : target.manual_guest_name || 'Client';

    setReservations((prev) =>
      prev.map((r) =>
        r.id === target.id
          ? {
              ...r,
              attended: true,
              attended_at: new Date().toISOString(),
              checked_in_by: currentUser?.id ?? null,
            }
          : r
      )
    );

    return {
      ok: true,
      messageFr: `Présence confirmée pour ${dinerLabel} (${target.meal_date} — Service ${target.service}).`,
    };
  };

  const toggleCliAttendanceManual = (reservationId: string) => {
    setReservations((prev) =>
      prev.map((r) =>
        r.id === reservationId
          ? {
              ...r,
              attended: !r.attended,
              attended_at: !r.attended ? new Date().toISOString() : null,
              checked_in_by: currentUser?.id ?? null,
            }
          : r
      )
    );
  };

  const registerClientManually = (
    mealDate: string,
    service: ServiceSlot,
    guestName: string,
    category: UserCategory
  ) => {
    const trimmedName = guestName.trim();
    if (!trimmedName) {
      return { ok: false, messageFr: 'Veuillez indiquer le nom et prénom du client.' };
    }

    if (getRemainingDailyPlaces(mealDate) <= 0) {
      return {
        ok: false,
        messageFr: 'Complet : le maximum de 40 personnes inscrites pour cette journée est atteint.',
      };
    }

    const priceChf = USER_CATEGORY_PRICES_CHF[category];
    const qrToken = `AMV-QR-MANUEL-${Date.now().toString().slice(-5)}`;
    const nowIso = new Date().toISOString();

    const manualRes: Reservation = {
      id: `res-man-${Date.now()}`,
      meal_date: mealDate,
      service,
      user_id: null,
      cli_member_id: null,
      manual_guest_name: trimmedName,
      manual_guest_category: category,
      is_cli: false,
      price_chf: priceChf,
      status: 'confirmed',
      qr_code_token: qrToken,
      attended: true,
      attended_at: nowIso,
      checked_in_by: currentUser?.id ?? null,
      created_at: nowIso,
    };

    setReservations((prev) => [manualRes, ...prev]);
    return {
      ok: true,
      messageFr: `${trimmedName} a été inscrit(e) manuellement au service de ${service} (${priceChf.toFixed(
        2
      )} CHF).`,
    };
  };

  const saveDailyMenu = (
    mealDate: string,
    compositionType: MenuCompositionType,
    starterFr: string,
    mainCourseFr: string,
    dessertFr: string,
    baseServings: number
  ) => {
    if (!mainCourseFr.trim()) {
      return { ok: false, messageFr: 'Le plat principal est obligatoire.' };
    }
    if (compositionType === 'starter_main' && !starterFr.trim()) {
      return {
        ok: false,
        messageFr: 'Veuillez indiquer l’entrée pour la formule Entrée + Plat principal.',
      };
    }

    setMenus((prev) => {
      const exists = prev.some((m) => m.meal_date === mealDate);
      const updatedMenu: MenuDay = {
        id: exists ? prev.find((m) => m.meal_date === mealDate)!.id : `menu-${mealDate}`,
        meal_date: mealDate,
        composition_type: compositionType,
        starter_fr: compositionType === 'starter_main' ? starterFr.trim() : null,
        main_course_fr: mainCourseFr.trim(),
        dessert_fr:
          compositionType === 'main_dessert'
            ? dessertFr.trim() || 'Dessert du jour'
            : null,
        notes_fr: null,
        recipe_base_servings: Math.max(1, baseServings),
      };
      return exists
        ? prev.map((m) => (m.meal_date === mealDate ? updatedMenu : m))
        : [...prev, updatedMenu];
    });

    return { ok: true, messageFr: `Le menu du ${mealDate} a bien été enregistré.` };
  };

  const addRecipeIngredient = (
    mealDate: string,
    ingredientNameFr: string,
    quantityForBase: number,
    unit: string,
    categoryFr: string
  ) => {
    const menu = menus.find((m) => m.meal_date === mealDate);
    if (!menu) {
      return { ok: false, messageFr: 'Veuillez d’abord enregistrer un menu pour ce jour.' };
    }
    if (!ingredientNameFr.trim() || quantityForBase <= 0) {
      return { ok: false, messageFr: 'Nom d’ingrédient et quantité valides requis.' };
    }

    const newIng: RecipeIngredient = {
      id: `ing-${Date.now()}`,
      menu_id: menu.id,
      ingredient_name_fr: ingredientNameFr.trim(),
      quantity_for_base: quantityForBase,
      unit: unit.trim() || 'kg',
      category_fr: categoryFr.trim() || 'Épicerie',
      is_checked: false,
    };

    setIngredients((prev) => [...prev, newIng]);
    return { ok: true, messageFr: `Ingrédient « ${newIng.ingredient_name_fr} » ajouté à la recette.` };
  };

  const toggleShoppingItemChecked = (ingredientId: string) => {
    setIngredients((prev) =>
      prev.map((ing) =>
        ing.id === ingredientId ? { ...ing, is_checked: !ing.is_checked } : ing
      )
    );
  };

  const getScaledShoppingListForDate = (mealDate: string): ScaledShoppingItem[] => {
    const menu = menus.find((m) => m.meal_date === mealDate);
    if (!menu) return [];
    const registeredDiners = getDailyConfirmedCount(mealDate);
    const effectiveDiners = Math.max(registeredDiners, 1);

    return ingredients
      .filter((ing) => ing.menu_id === menu.id)
      .map((ing) => ({
        ingredient_id: ing.id,
        ingredient_name_fr: ing.ingredient_name_fr,
        category_fr: ing.category_fr,
        unit: ing.unit,
        base_servings: menu.recipe_base_servings,
        registered_diners: registeredDiners,
        quantity_for_base: ing.quantity_for_base,
        scaled_quantity: Number(
          ((ing.quantity_for_base * effectiveDiners) / menu.recipe_base_servings).toFixed(2)
        ),
        is_checked: ing.is_checked,
      }));
  };

  // Annulation ou réactivation ponctuelle d'un client de la CLI par l'administrateur ou le comptable
  const toggleCliReservationCancelled = (reservationId: string) => {
    let messageFr = '';
    setReservations((prev) =>
      prev.map((r) => {
        if (r.id !== reservationId) return r;
        const nextStatus = r.status === 'cancelled' ? 'confirmed' : 'cancelled';
        messageFr =
          nextStatus === 'cancelled'
            ? 'Inscription CLI annulée ponctuellement pour ce jour (libère 1 place sur les 40).'
            : 'Inscription CLI réactivée pour ce jour.';
        return {
          ...r,
          status: nextStatus,
          attended: nextStatus === 'cancelled' ? false : r.attended,
        };
      })
    );
    return { ok: true, messageFr };
  };

  const updateCliSettings = (defaultService: ServiceSlot, mealPriceChf: number) => {
    setSettings((prev) => ({
      ...prev,
      cli_default_service: defaultService,
      cli_meal_price_chf: mealPriceChf,
    }));
    setCliMembers((prev) =>
      prev.map((cm) => ({
        ...cm,
        default_service: defaultService,
        meal_price_chf: mealPriceChf,
      }))
    );
    setReservations((prev) =>
      prev.map((r) =>
        r.is_cli
          ? {
              ...r,
              service: defaultService,
              price_chf: mealPriceChf,
            }
          : r
      )
    );
  };

  const generateCliInvoiceForPeriod = (
    periodStart: string,
    periodEnd: string,
    notesFr?: string
  ) => {
    const attendedCliMeals = reservations.filter(
      (r) =>
        r.is_cli &&
        r.status === 'confirmed' &&
        r.attended &&
        r.meal_date >= periodStart &&
        r.meal_date <= periodEnd
    );

    const totalMeals = attendedCliMeals.length;
    const totalChf = Number((totalMeals * settings.cli_meal_price_chf).toFixed(2));
    const invoice: CliInvoice = {
      id: `inv-cli-${Date.now()}`,
      invoice_number: `CLI-${periodStart.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
      period_start: periodStart,
      period_end: periodEnd,
      total_meals_attended: totalMeals,
      unit_price_chf: settings.cli_meal_price_chf,
      total_amount_chf: totalChf,
      currency: 'CHF',
      status: 'issued',
      notes_fr:
        notesFr ||
        `Facture générée sur la base de ${totalMeals} repas CLI avec présence confirmée.`,
      created_at: new Date().toISOString(),
    };

    setCliInvoices((prev) => [invoice, ...prev]);
    return {
      ok: true,
      invoice,
      messageFr: `Facture ${invoice.invoice_number} générée : ${totalMeals} repas CLI présents × ${settings.cli_meal_price_chf.toFixed(
        2
      )} CHF = ${totalChf.toFixed(2)} CHF.`,
    };
  };

  const updateStudentSubsidy = (
    studentUserId: string,
    newCategory: 'student' | 'student_partial_subsidy' | 'student_full_subsidy'
  ) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === studentUserId ? { ...u, category: newCategory } : u))
    );
    if (currentUser?.id === studentUserId) {
      setCurrentUser((prev) => (prev ? { ...prev, category: newCategory } : null));
    }
    return {
      ok: true,
      messageFr: `Subvention mise à jour (${USER_CATEGORY_PRICES_CHF[newCategory].toFixed(2)} CHF / repas).`,
    };
  };

  const toggleAdultStaffRole = (adultUserId: string, role: StaffRole) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== adultUserId || u.category !== 'adult') return u;
        const hasRole = u.staff_roles.includes(role);
        const nextRoles = hasRole
          ? u.staff_roles.filter((r) => r !== role)
          : [...u.staff_roles, role];
        if (currentUser?.id === adultUserId) {
          setCurrentUser({ ...u, staff_roles: nextRoles });
        }
        return { ...u, staff_roles: nextRoles };
      })
    );
    return { ok: true, messageFr: 'Rôles de gestion mis à jour.' };
  };

  const updateBrandingNames = (appName: string, cafeteriaName: string) => {
    setSettings((prev) => ({
      ...prev,
      app_name: appName.trim() || prev.app_name,
      cafeteria_name: cafeteriaName.trim() || prev.cafeteria_name,
    }));
  };

  const value = useMemo(
    () => ({
      settings,
      currentUser,
      users,
      selectedDate,
      setSelectedDate,
      availableDates: INITIAL_DATES,
      menus,
      ingredients,
      cliMembers,
      reservations,
      payments,
      cliInvoices,
      registerNewUser,
      switchDemoUser,
      logout,
      getDailyConfirmedCount,
      getRemainingDailyPlaces,
      bookAndPayWithTwint,
      confirmAttendanceByQr,
      toggleCliAttendanceManual,
      registerClientManually,
      saveDailyMenu,
      addRecipeIngredient,
      toggleShoppingItemChecked,
      getScaledShoppingListForDate,
      toggleCliReservationCancelled,
      updateCliSettings,
      generateCliInvoiceForPeriod,
      updateStudentSubsidy,
      toggleAdultStaffRole,
      updateBrandingNames,
    }),
    [
      settings,
      currentUser,
      users,
      selectedDate,
      menus,
      ingredients,
      cliMembers,
      reservations,
      payments,
      cliInvoices,
    ]
  );

  return <CafeteriaContext.Provider value={value}>{children}</CafeteriaContext.Provider>;
};

export function useCafeteria(): CafeteriaContextValue {
  const ctx = useContext(CafeteriaContext);
  if (!ctx) {
    throw new Error('useCafeteria doit être utilisé à l’intérieur de CafeteriaProvider');
  }
  return ctx;
}
