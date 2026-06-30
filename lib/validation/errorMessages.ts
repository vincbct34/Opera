/**
 * Centralizes and enriches error messages returned by the API for frontend display.
 * We use simple text-to-text mapping to remain compatible as long as the API
 * does not yet provide structured error codes.
 */

const RAW_TO_FRIENDLY: Record<string, string> = {
  // Auth
  'Utilisateur non trouvé': "Aucun compte n'est associé à cette adresse email.",
  'Mot de passe incorrect': 'Mot de passe incorrect. Vérifiez vos identifiants et réessayez.',
  'Email et mot de passe requis': 'Veuillez renseigner votre email et votre mot de passe.',
  "Token d'authentification requis": 'Veuillez vous reconnecter pour continuer.',
  'Token invalide': 'Session expirée ou invalide. Veuillez vous reconnecter.',
  'Authentification requise': 'Authentification nécessaire pour accéder à cette ressource.',
  'Permissions insuffisantes': 'Vous ne disposez pas des permissions nécessaires.',

  // Register / user
  'Champs manquants': 'Veuillez remplir tous les champs obligatoires.',
  'Email déjà utilisé': 'Un compte existe déjà avec cet email.',

  // Institutions
  "Erreur lors de la création de l'institution":
    "Impossible de créer l'établissement pour le moment.",
  'Erreur lors de la recherche des institutions': 'La recherche a échoué. Réessayez plus tard.',
  "Erreur lors de la mise à jour de l'institution": "La mise à jour de l'établissement a échoué.",
  "Erreur lors de la suppression de l'institution": "La suppression de l'établissement a échoué.",
  "Erreur lors de la récupération de l'institution": "Impossible de charger l'établissement.",
  'Erreur lors de la récupération des institutions':
    'Impossible de charger la liste des établissements.',

  // Users
  "Erreur lors de la récupération de l'utilisateur": "Impossible de charger l'utilisateur.",

  // Generic internal
  'Erreur interne du serveur': 'Une erreur interne est survenue. Réessayez plus tard.',
};

/**
 * Normalise un objet de réponse d'erreur backend vers un message lisible.
 * @param payload - Objet JSON renvoyé (ou valeur quelconque) contenant potentiellement `error` ou `message`.
 * @param fallback - Message de secours si rien n'est exploitable.
 * @returns Le message d'erreur normalisé.
 */
export function normalizeApiError(payload: unknown, fallback = 'Une erreur est survenue.'): string {
  if (!payload) return fallback;
  const raw =
    typeof payload === 'string'
      ? payload.trim()
      : typeof payload === 'object' &&
          payload !== null &&
          ('error' in payload || 'message' in payload)
        ? (
            (payload as { error?: unknown; message?: unknown }).error ||
            (payload as { error?: unknown; message?: unknown }).message ||
            ''
          )
            .toString()
            .trim()
        : '';
  if (!raw) return fallback;
  return RAW_TO_FRIENDLY[raw] || raw; // Keep raw message if not mapped.
}

/**
 * Optionally expose the mapping for inspection/tests.
 * @returns The error mapping object.
 */
export function getErrorMapping() {
  return { ...RAW_TO_FRIENDLY };
}
