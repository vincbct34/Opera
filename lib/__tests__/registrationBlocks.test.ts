import { describe, expect, test } from '@jest/globals';
import {
  formatFormationName,
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

  describe('formatFormationName', () => {
    test('returns null when no block was attended and legacy want_formation is falsy', () => {
      expect(formatFormationName([], false)).toBeNull();
      expect(formatFormationName([], null)).toBeNull();
      expect(
        formatFormationName([
          { wants_to_attend: false, selected_date: null, block: { title: 'Ignored' } },
        ]),
      ).toBeNull();
    });

    test('falls back to legacy "Formation initiale" when no block selection but want_formation is true', () => {
      expect(formatFormationName([], true)).toBe('Formation initiale');
    });

    test('returns the block title without a date when the selection has no selected_date', () => {
      expect(
        formatFormationName([
          { wants_to_attend: true, selected_date: null, block: { title: 'Atelier découverte' } },
        ]),
      ).toBe('Atelier découverte');
    });

    test('appends the formatted date and time when the selection has a selected_date', () => {
      const result = formatFormationName([
        {
          wants_to_attend: true,
          selected_date: new Date('2026-10-13T09:30:00.000+02:00'),
          block: { title: 'Formation initiale de test' },
        },
      ]);

      expect(result).toContain('Formation initiale de test (');
      expect(result).toContain('09:30');
      expect(result).toContain('2026');
    });

    test('accepts a string selected_date and joins multiple attended blocks with a comma', () => {
      const result = formatFormationName([
        { wants_to_attend: true, selected_date: null, block: { title: 'Bloc A' } },
        {
          wants_to_attend: true,
          selected_date: '2026-10-13T09:30:00.000Z',
          block: { title: 'Bloc B' },
        },
        { wants_to_attend: false, selected_date: null, block: { title: 'Bloc C (not attended)' } },
      ]);

      expect(result).toContain('Bloc A');
      expect(result).toContain('Bloc B (');
      expect(result).not.toContain('Bloc C');
      expect(result?.split(', ')).toHaveLength(2);
    });
  });
});
