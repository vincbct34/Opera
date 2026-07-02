export type EventRegistrationBlockLike = {
  id: string;
  event_id?: string;
  title: string;
  description?: string | null;
  dates: Array<string | Date>;
  enabled: boolean;
  registration_enabled: boolean;
  mandatory: boolean;
  order: number;
};

export type LegacyFormationEventLike = {
  id: string;
  has_initial_formation?: boolean | null;
  is_formation_mandatory?: boolean | null;
};

export function getRegistrationBlocksWithLegacyFallback<
  T extends LegacyFormationEventLike & {
    registrationBlocks?: EventRegistrationBlockLike[] | null;
  },
>(event: T): EventRegistrationBlockLike[] {
  const blocks = event.registrationBlocks ?? [];

  if (blocks.length > 0) {
    return [...blocks].sort((left, right) => left.order - right.order);
  }

  if (!event.has_initial_formation) {
    return [];
  }

  return [
    {
      id: 'legacy-initial-formation',
      event_id: event.id,
      title: 'Formation initiale',
      description: null,
      dates: [],
      enabled: true,
      registration_enabled: true,
      mandatory: Boolean(event.is_formation_mandatory),
      order: 0,
    },
  ];
}

export function serializeRegistrationBlock(block: EventRegistrationBlockLike) {
  return {
    ...block,
    dates: block.dates.map((date) =>
      typeof date === 'string' ? new Date(date).toISOString() : date.toISOString(),
    ),
  };
}

export type FormationSelectionLike = {
  wants_to_attend: boolean;
  selected_date: Date | string | null;
  block: { title: string };
};

/**
 * Builds the "formation" label shown in registration emails, including the
 * selected date/time when the block has one (blocks without dates just show the title).
 */
export function formatFormationName(
  blockSelections: FormationSelectionLike[],
  wantFormation?: boolean | null,
): string | null {
  const attended = blockSelections.filter((selection) => selection.wants_to_attend);

  if (attended.length === 0) {
    return wantFormation ? 'Formation initiale' : null;
  }

  return attended
    .map((selection) => {
      if (!selection.selected_date) {
        return selection.block.title;
      }

      const date = new Date(selection.selected_date);
      const formattedDate = date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Paris',
      });
      const formattedTime = date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris',
      });

      return `${selection.block.title} (${formattedDate} à ${formattedTime})`;
    })
    .join(', ');
}
