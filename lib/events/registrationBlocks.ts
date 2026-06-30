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
