import { describe, expect, test } from '@jest/globals';
import {
  getRegistrationBlocksWithLegacyFallback,
  serializeRegistrationBlock,
} from '@/lib/events/registrationBlocks';

describe('registrationBlocks', () => {
  test('returns existing registration blocks sorted by order without mutating the source array', () => {
    const laterBlock = {
      id: 'block-2',
      event_id: 'event-1',
      title: 'Second block',
      description: null,
      dates: [],
      enabled: true,
      registration_enabled: true,
      mandatory: false,
      order: 2,
    };
    const earlierBlock = {
      id: 'block-1',
      event_id: 'event-1',
      title: 'First block',
      description: null,
      dates: [],
      enabled: true,
      registration_enabled: true,
      mandatory: true,
      order: 1,
    };
    const registrationBlocks = [laterBlock, earlierBlock];

    const result = getRegistrationBlocksWithLegacyFallback({
      id: 'event-1',
      has_initial_formation: true,
      registrationBlocks,
    });

    expect(result).toEqual([earlierBlock, laterBlock]);
    expect(registrationBlocks).toEqual([laterBlock, earlierBlock]);
  });

  test('returns no blocks when no explicit block or legacy formation is enabled', () => {
    expect(
      getRegistrationBlocksWithLegacyFallback({
        id: 'event-1',
        has_initial_formation: false,
        registrationBlocks: [],
      }),
    ).toEqual([]);
  });

  test('creates a mandatory legacy initial formation block when needed', () => {
    expect(
      getRegistrationBlocksWithLegacyFallback({
        id: 'event-1',
        has_initial_formation: true,
        is_formation_mandatory: true,
        registrationBlocks: null,
      }),
    ).toEqual([
      {
        id: 'legacy-initial-formation',
        event_id: 'event-1',
        title: 'Formation initiale',
        description: null,
        dates: [],
        enabled: true,
        registration_enabled: true,
        mandatory: true,
        order: 0,
      },
    ]);
  });

  test('serializes string and Date registration block dates to ISO strings', () => {
    expect(
      serializeRegistrationBlock({
        id: 'block-1',
        event_id: 'event-1',
        title: 'Block',
        description: null,
        dates: ['2026-01-01T10:00:00.000Z', new Date('2026-01-02T10:00:00.000Z')],
        enabled: true,
        registration_enabled: true,
        mandatory: false,
        order: 0,
      }),
    ).toMatchObject({
      dates: ['2026-01-01T10:00:00.000Z', '2026-01-02T10:00:00.000Z'],
    });
  });
});
