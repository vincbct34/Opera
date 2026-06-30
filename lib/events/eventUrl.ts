/**
 * Génère l'URL d'un événement en utilisant le slug si disponible, sinon l'ID.
 * @param event - Objet événement avec id et slug optionnel.
 * @returns L'URL de l'événement.
 */
export function getEventUrl(event: { id: string; slug?: string | null }): string {
  return `/events/${event.slug || event.id}`;
}

/**
 * Génère l'URL d'une API événement en utilisant le slug si disponible, sinon l'ID.
 * @param event - Objet événement avec id et slug optionnel.
 * @returns L'URL de l'API de l'événement.
 */
export function getEventApiUrl(event: { id: string; slug?: string | null }): string {
  return `/api/events/${event.slug || event.id}`;
}
