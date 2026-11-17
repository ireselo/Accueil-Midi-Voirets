// Règles métier et formatage en français (Suisse - CHF) pour Accueil Midi-Voirets

import { StaffRole, UserCategory } from '../types/database';

export const USER_CATEGORY_LABELS_FR: Record<UserCategory, string> = {
  adult: 'Adulte',
  student: 'Élève',
  student_partial_subsidy: 'Élève partiellement subventionné',
  student_full_subsidy: 'Élève totalement subventionné',
};

export const USER_CATEGORY_PRICES_CHF: Record<UserCategory, number> = {
  adult: 10.0,
  student: 8.0,
  student_partial_subsidy: 4.0,
  student_full_subsidy: 0.0,
};

export const STAFF_ROLE_LABELS_FR: Record<StaffRole, { title: string; description: string }> = {
  surveillant: {
    title: 'Surveillant',
    description:
      'Consulter la liste des inscrits, scanner les codes QR, valider la présence de la CLI et inscrire manuellement.',
  },
  cuisinier: {
    title: 'Cuisinier',
    description:
      'Saisir les menus du jour et générer la liste des courses ajustée au nombre de convives.',
  },
  civiliste: {
    title: 'Civiliste',
    description: 'Consulter et cocher la liste des courses de la cafétéria.',
  },
  comptable: {
    title: 'Comptable',
    description:
      'Accéder aux paiements Twint, générer les factures pour la CLI et annuler ponctuellement la CLI.',
  },
  administrateur: {
    title: 'Administrateur',
    description:
      'Gérer les utilisateurs, autoriser les subventions des élèves, attribuer les rôles staff et gérer la CLI.',
  },
};

/**
 * Formate un montant en Francs suisses (ex: "10.00 CHF" ou "8.00 CHF")
 */
export function formatChf(amount: number): string {
  return `${amount.toFixed(2)} CHF`;
}

/**
 * Vérifie si une date (YYYY-MM-DD) est un jour d'ouverture de la cafétéria
 * Ouvert uniquement : Lundi (1), Mardi (2), Jeudi (4) et Vendredi (5)
 */
export function isCafeteriaOpenDay(mealDateIso: string): boolean {
  const [year, month, day] = mealDateIso.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = dateObj.getUTCDay(); // 0 = Dimanche, 1 = Lundi, 2 = Mardi, 3 = Mercredi, 4 = Jeudi, 5 = Vendredi, 6 = Samedi
  return dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 5;
}

/**
 * Calcule la date et l'heure limite d'inscription pour un jour de repas :
 * - Pour lundi et mardi : clôture le vendredi précédent à 18h00
 * - Pour jeudi et vendredi : clôture le mercredi précédent à 18h00
 */
export function getRegistrationDeadlineDate(mealDateIso: string): Date {
  const [year, month, day] = mealDateIso.split('-').map(Number);
  const mealDate = new Date(year, month - 1, day, 12, 0, 0);
  const dayOfWeek = mealDate.getDay(); // 1=Lun, 2=Mar, 4=Jeu, 5=Ven

  let daysToSubtract = 0;
  if (dayOfWeek === 1) {
    daysToSubtract = 3; // Lundi -> Vendredi précédent
  } else if (dayOfWeek === 2) {
    daysToSubtract = 4; // Mardi -> Vendredi précédent
  } else if (dayOfWeek === 4) {
    daysToSubtract = 1; // Jeudi -> Mercredi précédent
  } else if (dayOfWeek === 5) {
    daysToSubtract = 2; // Vendredi -> Mercredi précédent
  } else {
    throw new Error(
      'La cafétéria est ouverte uniquement le lundi, mardi, jeudi et vendredi.'
    );
  }

  return new Date(year, month - 1, day - daysToSubtract, 18, 0, 0, 0);
}

/**
 * Vérifie si les inscriptions sont ouvertes à l'instant `now`
 */
export function isRegistrationOpenNow(mealDateIso: string, now: Date = new Date()): boolean {
  if (!isCafeteriaOpenDay(mealDateIso)) {
    return false;
  }
  const deadline = getRegistrationDeadlineDate(mealDateIso);
  return now.getTime() <= deadline.getTime();
}

/**
 * Retourne un texte explicatif en français de la date limite d'inscription
 */
export function getDeadlineLabelFr(mealDateIso: string): string {
  const [year, month, day] = mealDateIso.split('-').map(Number);
  const mealDate = new Date(year, month - 1, day, 12, 0, 0);
  const dayOfWeek = mealDate.getDay();

  if (dayOfWeek === 1 || dayOfWeek === 2) {
    return 'Clôture des inscriptions le vendredi précédent à 18h00';
  }
  if (dayOfWeek === 4 || dayOfWeek === 5) {
    return 'Clôture des inscriptions le mercredi précédent à 18h00';
  }
  return 'Cafétéria fermée ce jour';
}
