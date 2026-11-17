// Types TypeScript alignés avec le schéma Supabase (Accueil Midi-Voirets)

export type UserCategory =
  | 'adult'
  | 'student'
  | 'student_partial_subsidy'
  | 'student_full_subsidy';

export type StaffRole =
  | 'surveillant'
  | 'cuisinier'
  | 'civiliste'
  | 'comptable'
  | 'administrateur';

export type ServiceSlot = '12h00' | '12h50';

export type MenuCompositionType = 'starter_main' | 'main_dessert';

export type ReservationStatus = 'pending_payment' | 'confirmed' | 'cancelled';

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'exempt'
  | 'invoiced_cli';

export interface AppSettings {
  id: number;
  app_name: string;
  cafeteria_name: string;
  currency: 'CHF';
  price_adult_chf: number;
  price_student_chf: number;
  price_student_partial_chf: number;
  price_student_full_chf: number;
  cli_group_size: number;
  cli_default_service: ServiceSlot;
  cli_meal_price_chf: number;
  max_capacity: number;
  capacity_scope: 'per_service' | 'per_day';
}

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  category: UserCategory;
  class_number: string | null;
  staff_roles: StaffRole[];
  created_at: string;
}

export interface CliMember {
  id: string;
  seat_number: number;
  display_name: string;
  default_service: ServiceSlot;
  meal_price_chf: number;
  is_active: boolean;
}

export interface MenuDay {
  id: string;
  meal_date: string; // YYYY-MM-DD (Lundi, Mardi, Jeudi, Vendredi)
  composition_type: MenuCompositionType;
  starter_fr: string | null;
  main_course_fr: string;
  dessert_fr: string | null;
  notes_fr: string | null;
  recipe_base_servings: number;
}

export interface RecipeIngredient {
  id: string;
  menu_id: string;
  ingredient_name_fr: string;
  quantity_for_base: number;
  unit: string;
  category_fr: string;
  is_checked: boolean;
}

export interface ScaledShoppingItem {
  ingredient_id: string;
  ingredient_name_fr: string;
  category_fr: string;
  unit: string;
  base_servings: number;
  registered_diners: number;
  quantity_for_base: number;
  scaled_quantity: number;
  is_checked: boolean;
}

export interface Reservation {
  id: string;
  meal_date: string;
  service: ServiceSlot;
  user_id: string | null;
  cli_member_id: string | null;
  manual_guest_name: string | null;
  manual_guest_category: UserCategory | null;
  is_cli: boolean;
  price_chf: number;
  status: ReservationStatus;
  qr_code_token: string | null;
  attended: boolean;
  attended_at: string | null;
  checked_in_by: string | null;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  reservation_id: string;
  user_id: string | null;
  amount_chf: number;
  currency: 'CHF';
  payment_method: 'twint_payrexx' | 'free_subsidy' | 'manual_on_site' | 'cli_invoice';
  status: PaymentStatus;
  payrexx_gateway_id: string | null;
  payrexx_reference_id: string | null;
  payrexx_transaction_id: string | null;
  payrexx_payment_link: string | null;
  confirmation_email_sent_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface CliInvoice {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  total_meals_attended: number;
  unit_price_chf: number;
  total_amount_chf: number;
  currency: 'CHF';
  status: 'draft' | 'issued' | 'paid' | 'cancelled';
  notes_fr: string | null;
  created_at: string;
}
