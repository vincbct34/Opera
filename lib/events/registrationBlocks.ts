export type EventRegistrationBlockLike = {
  id: string;
  event_id?: string;
  title: string;
  description?: string | null;
  dates: Array<string | Date>;
  end_dates?: Array<string | Date>;
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
      end_dates: [],
      enabled: true,
      registration_enabled: true,
      mandatory: Boolean(event.is_formation_mandatory),
      order: 0,
    },
  ];
}

const toIsoString = (date: string | Date): string =>
  typeof date === 'string' ? new Date(date).toISOString() : date.toISOString();

export function serializeRegistrationBlock(block: EventRegistrationBlockLike) {
  return {
    ...block,
    dates: block.dates.map(toIsoString),
    end_dates: (block.end_dates ?? []).map(toIsoString),
  };
}

/**
 * Returns the end of the time slot starting at `selectedDate`, when the block
 * defines one (end_dates is aligned index-by-index with dates).
 */
export function findSlotEndDate(
  block: { dates: Array<string | Date>; end_dates?: Array<string | Date> },
  selectedDate: string | Date | null | undefined,
): Date | null {
  if (!selectedDate) return null;
  const endDates = block.end_dates ?? [];
  if (endDates.length === 0) return null;
  const selectedTime = new Date(selectedDate).getTime();
  const index = block.dates.findIndex((date) => new Date(date).getTime() === selectedTime);
  if (index < 0 || !endDates[index]) return null;
  return new Date(endDates[index]);
}

/**
 * Suffix appended after a formatted slot start to show the end of the time
 * range (" à 16:00"). Empty string when the slot has no end date.
 */
export function formatSlotEndSuffix(selectedEndDate?: string | Date | null): string {
  if (!selectedEndDate) return '';
  const time = new Date(selectedEndDate).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return ` à ${time}`;
}

export type FormationSelectionLike = {
  wants_to_attend: boolean;
  selected_date: Date | string | null;
  selected_end_date?: Date | string | null;
  block: { title: string };
};

/**
 * Builds the "formation" label shown in registration emails, including the
 * selected time slot when the block has one (blocks without dates just show the
 * title). Slots with an end date render as a time range ("de 14:00 à 16:00").
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
      const timeFormat: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris',
      };
      const formattedTime = date.toLocaleTimeString('fr-FR', timeFormat);

      if (selection.selected_end_date) {
        const formattedEndTime = new Date(selection.selected_end_date).toLocaleTimeString(
          'fr-FR',
          timeFormat,
        );
        return `${selection.block.title} (${formattedDate} de ${formattedTime} à ${formattedEndTime})`;
      }

      return `${selection.block.title} (${formattedDate} à ${formattedTime})`;
    })
    .join(', ');
}
