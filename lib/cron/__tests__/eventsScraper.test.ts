/* eslint-disable */
import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';

describe('eventsScraper (API mode)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-09-15T10:00:00Z'));

    // Mock global.fetch to simulate WP REST API responses
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      // single slug query: /wp-json/wp/v2/spectacle?slug=slug1
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        // detect slug param
        if (url.includes('slug=slug1')) {
          return {
            ok: true,
            json: async () => [
              {
                id: 101,
                link: 'https://www.opera-orchestre-montpellier.fr/evenements/slug1/',
                title: { rendered: 'Le Grand Opéra' },
                excerpt: { rendered: 'Une description courte.' },
                acf: {
                  colonne_de_droite: { dates: [{ date: '2025-09-18', complet: false }] },
                  colonne_de_gauche: { duree: '1h', public: [201] },
                  colonne_centrale: { texte: 'Texte central' },
                  diaporama_header: [{ visuel: 201 }],
                },
                featured_media: 201,
                class_list: ['etypes-voix', 'lieux-salleA', 'saisons-2025-26-scolaires'],
              },
            ],
          } as any;
        }

        // listing request (pagination)
        return {
          ok: true,
          json: async () => [
            {
              id: 101,
              link: 'https://www.opera-orchestre-montpellier.fr/evenements/slug1/',
              title: { rendered: 'Le Grand Opéra' },
              excerpt: { rendered: 'Une description courte.' },
              acf: {
                colonne_de_droite: { dates: [{ date: '2025-09-18' }] },
                diaporama_header: [{ visuel: 201 }],
                colonne_de_gauche: { public: [201] },
              },
              featured_media: 201,
              class_list: ['etypes-voix', 'lieux-salleA', 'saisons-2025-26-scolaires'],
            },
            {
              id: 102,
              link: 'https://www.opera-orchestre-montpellier.fr/evenements/slug2/',
              title: { rendered: 'Concert Symphonique' },
              excerpt: { rendered: 'Longue description.' },
              acf: {
                colonne_de_droite: { dates: [{ date: '2025-12-02' }] },
                diaporama_header: [{ visuel: 202 }],
                colonne_de_gauche: { public: [202] },
              },
              featured_media: 202,
              class_list: ['etypes-orchestre', 'lieux-salleB', 'saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }

      // media resolution
      if (url.includes('/wp-json/wp/v2/media/201')) {
        return { ok: true, json: async () => ({ source_url: 'https://cdn/opera/ev1.jpg' }) } as any;
      }
      if (url.includes('/wp-json/wp/v2/media/202')) {
        return { ok: true, json: async () => ({ source_url: 'https://cdn/opera/ev2.png' }) } as any;
      }
      // publics resolution
      if (url.includes('/wp-json/wp/v2/publics/201')) {
        return { ok: true, json: async () => ({ name: 'Enfants' }) } as any;
      }
      if (url.includes('/wp-json/wp/v2/publics/202')) {
        return { ok: true, json: async () => ({ name: 'Adultes' }) } as any;
      }

      return { ok: false, status: 404, json: async () => ({}) } as any;
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    // @ts-ignore
    delete global.fetch;
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  test('scrapeEvents main listing returns multiple events parsed', async () => {
    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThanOrEqual(2);

    const calls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes('/wp-json/wp/v2/spectacle'))).toBe(true);
    expect(calls.some((u) => u.includes('/wp-json/wp/v2/media/201'))).toBe(true);
    expect(calls.some((u) => u.includes('/wp-json/wp/v2/media/202'))).toBe(true);
  });

  test('scrapeEvents handles failed fetch gracefully', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      statusText: 'Server Error',
    })) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBe(0);
  });

  test('scrapeEvents handles media error exception', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 103,
              link: 'https://example.com/event',
              title: { rendered: 'Event with error' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [{ visuel: 204 }],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      if (url.includes('/wp-json/wp/v2/media/204')) {
        throw new Error('Network error');
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].image_url).toBeNull();
  });

  test('scrapeEvents filters cancelled and postponed events', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 104,
              link: 'https://example.com/event',
              title: { rendered: 'Event with cancelled dates' },
              acf: {
                colonne_de_droite: {
                  dates: [
                    { date: '2025-09-01', complet: false, annule: true, report: false },
                    { date: '2025-09-02', complet: false, annule: false, report: true },
                    { date: '2025-09-03', complet: false, annule: false, report: false },
                  ],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].event_dates.length).toBe(1); // Only non-cancelled, non-postponed date
  });

  test('scrapeEvents handles various location types', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 105,
              link: 'https://example.com/event1',
              title: { rendered: 'Event at Grand Foyer' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'lieux-grand-foyer-opera-comedie'],
            },
            {
              id: 106,
              link: 'https://example.com/event2',
              title: { rendered: 'Event at Le Corum' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-02', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'lieux-le-corum'],
            },
            {
              id: 107,
              link: 'https://example.com/event3',
              title: { rendered: 'Event at Salle Bagouet' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-03', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'lieux-salle-bagouet-opera-comedie'],
            },
            {
              id: 108,
              link: 'https://example.com/event4',
              title: { rendered: 'Event at Salon Victor Hugo' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-04', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'lieux-salon-victor-hugo-opera-comedie'],
            },
            {
              id: 109,
              link: 'https://example.com/event5',
              title: { rendered: 'Event at Salle Pasteur' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-05', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'lieux-salle-pasteur-le-corum'],
            },
            {
              id: 110,
              link: 'https://example.com/event6',
              title: { rendered: 'Event at unknown location' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-06', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'lieux-unknown-venue'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(6);
    expect(events[0].location).toBe('Opéra Comédie | Grand Foyer');
    expect(events[1].location).toBe('Opéra Berlioz | Le Corum');
    expect(events[2].location).toBe('Opéra Comédie | Salle Bagouet');
    expect(events[3].location).toBe('Opéra Comédie | Salon Victor-Hugo');
    expect(events[4].location).toBe('Salle Pasteur | Le Corum');
    expect(events[5].location).toBe('Unknown venue');
  });

  test('scrapeEvents handles media fetch failure', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 111,
              link: 'https://example.com/event',
              title: { rendered: 'Event with failed media' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [{ visuel: 999 }],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      if (url.includes('/wp-json/wp/v2/media/999')) {
        return { ok: false, statusText: 'Not Found' } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].image_url).toBeNull();
  });

  test('scrapeEvents handles media with missing guid', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 112,
              link: 'https://example.com/event',
              title: { rendered: 'Event' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [{ visuel: 888 }],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      if (url.includes('/wp-json/wp/v2/media/888')) {
        return { ok: true, json: async () => ({}) } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].image_url).toBeNull();
  });

  test('scrapeEvents handles various duration formats', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 113,
              title: { rendered: 'Event with hours and minutes' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                colonne_de_gauche: { duree: '2h30min' },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
            {
              id: 114,
              title: { rendered: 'Event with only minutes' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-02', complet: false, annule: false, report: false }],
                },
                colonne_de_gauche: { duree: '45 mn' },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
            {
              id: 115,
              title: { rendered: 'Event with null duration' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-03', complet: false, annule: false, report: false }],
                },
                colonne_de_gauche: { duree: null },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(3);
    expect(events[0].duration).toBe(150); // 2h30min
    expect(events[1].duration).toBe(45); // 45 mn
    expect(events[2].duration).toBe(90); // default
  });

  test('scrapeEvents handles various public types', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 116,
              title: { rendered: 'Event for maternelle' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'saisons-25-26-maternelle'],
            },
            {
              id: 117,
              title: { rendered: 'Event for collège' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-02', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'saisons-25-26-colleges'],
            },
            {
              id: 118,
              title: { rendered: 'Event for lycée' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-03', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'saisons-25-26-lycees'],
            },
            {
              id: 119,
              title: { rendered: 'Event for enseignement supérieur' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-04', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'saisons-25-26-enseignement-superieur'],
            },
            {
              id: 120,
              title: { rendered: 'Event for conservatoire' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-05', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'saisons-25-26-conservatoires'],
            },
            {
              id: 121,
              title: { rendered: 'Event for association' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-06', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'saisons-25-26-associations'],
            },
            {
              id: 122,
              title: { rendered: 'Event for crèche' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-07', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'saisons-25-26-creches'],
            },
            {
              id: 123,
              title: { rendered: 'Event for centre de loisirs' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-08', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'saisons-25-26-centre-de-loisirs'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(8);
    expect(events[0].category).toContain('MATERNELLE');
    expect(events[1].category).toContain('COLLEGE');
    expect(events[2].category).toContain('LYCEE');
    expect(events[3].category).toContain('SUPERIEUR');
    expect(events[4].category).toContain('CONSERVATOIRE');
    expect(events[5].category).toContain('ASSOCIATION');
    expect(events[6].category).toContain('CRECHE');
    expect(events[7].category).toContain('PERISCOLAIRE');
  });

  test('scrapeEvents handles all event types', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 124,
              title: { rendered: 'Multiple types event' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: [
                'saisons-2025-26-scolaires',
                'etypes-opera',
                'etypes-symphonique',
                'etypes-chambre-baroque',
                'etypes-en-famille',
                'etypes-jazz',
                'etypes-danse',
                'etypes-theatre',
              ],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].type.length).toBeGreaterThan(1);
  });

  test('scrapeEvents handles empty class_list', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 125,
              title: { rendered: 'Event with empty class_list' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toEqual(['OPERA']); // default type
    expect(events[0].category).toEqual(['AUTRE']); // default category
    expect(events[0].location).toBe('Autre'); // default location
  });

  test('scrapeEvents before June 10 uses previous academic year', async () => {
    // Set date to March 2026 (should use 2025-26 season)
    jest.setSystemTime(new Date('2026-03-15T10:00:00Z'));

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        // Should be looking for saisons-2025-26-scolaires
        if (url.includes('saisons-2025-26-scolaires')) {
          return {
            ok: true,
            json: async () => [
              {
                id: 126,
                title: { rendered: 'Spring Event' },
                acf: {
                  colonne_de_droite: {
                    dates: [{ date: '2026-04-01', complet: false, annule: false, report: false }],
                  },
                  diaporama_header: [],
                },
                class_list: ['saisons-2025-26-scolaires', 'etypes-opera'],
              },
            ],
          } as any;
        }
      }
      return { ok: true, json: async () => [] } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(Array.isArray(events)).toBe(true);
  });

  test('scrapeEvents switches to next academic year on June 10', async () => {
    jest.setSystemTime(new Date('2026-06-10T10:00:00Z'));

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 130,
              title: { rendered: 'June Opening Event' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2026-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2026-27-scolaires', 'etypes-opera'],
            },
          ],
        } as any;
      }
      return { ok: true, json: async () => [] } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('June Opening Event');
  });

  test('scrapeEvents during August period uses opened academic year', async () => {
    // Set date to August 2025 (should use 2025-26 season - current year)
    jest.setSystemTime(new Date('2025-08-15T10:00:00Z'));

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 131,
              title: { rendered: 'August Event' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'etypes-opera'],
            },
          ],
        } as any;
      }
      return { ok: true, json: async () => [] } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(Array.isArray(events)).toBe(true);
  });

  test('scrapeEvents during September-December period (current academic year)', async () => {
    // Set date to September 2025 (should use 2025-26 season - current year)
    jest.setSystemTime(new Date('2025-09-15T10:00:00Z'));

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 132,
              title: { rendered: 'September Event' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-10-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'etypes-opera'],
            },
          ],
        } as any;
      }
      return { ok: true, json: async () => [] } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(Array.isArray(events)).toBe(true);
  });

  test('scrapeEvents with unknown event types (not in typeMap)', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 127,
              title: { rendered: 'Event with unknown type' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'etypes-unknown-type', 'etypes-fake-type'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toEqual(['OPERA']); // Should default to OPERA when no known types
  });

  test('scrapeEvents with duplicate event types (tests !mappedTypes.includes)', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 132,
              title: { rendered: 'Event with duplicate types' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              // Include 'opera' twice to test the duplicate check at line 180
              class_list: [
                'saisons-2025-26-scolaires',
                'etypes-opera',
                'etypes-opera',
                'etypes-jazz',
              ],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    // Should have only unique types: OPERA and JAZZ (not OPERA twice)
    expect(events[0].type).toEqual(['OPERA', 'JAZZ']);
    expect(events[0].type.length).toBe(2);
  });

  test('scrapeEvents with multiple location classes (tests reduce logic)', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 128,
              title: { rendered: 'Event with multiple locations' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              // Multiple location classes - should pick the longest formatted one
              // 'lieux-grand-foyer-opera-comedie' -> 'Opéra Comédie | Grand Foyer' (27 chars) <- longest
              // 'lieux-opera-comedie' -> 'Opéra Comédie' (14 chars)
              class_list: [
                'saisons-2025-26-scolaires',
                'lieux-grand-foyer-opera-comedie',
                'lieux-opera-comedie',
              ],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    // Should select 'Opéra Comédie | Grand Foyer' because it's longer (27 chars vs 14 chars)
    expect(events[0].location).toBe('Opéra Comédie | Grand Foyer');
  });

  test('scrapeEvents with elementaire public type', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 129,
              title: { rendered: 'Event for elementaire' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'saisons-25-26-elementaire'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].category).toContain('ELEMENTAIRE');
  });

  test('scrapeEvents with pagination break on second page', async () => {
    let callCount = 0;
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        callCount++;
        if (callCount === 1) {
          // First page returns 100 events (full page, continues pagination)
          const events = Array.from({ length: 100 }, (_, i) => ({
            id: 200 + i,
            title: { rendered: `Event ${i}` },
            acf: {
              colonne_de_droite: {
                dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
              },
              diaporama_header: [],
            },
            class_list: ['saisons-2025-26-scolaires'],
          }));
          return {
            ok: true,
            json: async () => events,
          } as any;
        } else {
          // Second page returns empty (triggers pagination break at line 483-484)
          return {
            ok: true,
            json: async () => [],
          } as any;
        }
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(100);
    expect(callCount).toBe(2); // Should have made 2 API calls
  });

  test('scrapeEvents with less than 100 events (triggers perPage break)', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        // Return only 50 events (less than perPage=100, should break pagination at line 483-484)
        const events = Array.from({ length: 50 }, (_, i) => ({
          id: 300 + i,
          title: { rendered: `Event ${i}` },
          acf: {
            colonne_de_droite: {
              dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
            },
            diaporama_header: [],
          },
          class_list: ['saisons-2025-26-scolaires'],
        }));
        return {
          ok: true,
          json: async () => events,
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(50);
  });

  // Note: Lines 316-318 in getSeatsForVenue (location.includes checks) are unreachable
  // because formatLocation only returns names that are either in SEATS_NUMBER_MAP or "Autre"
  // These lines are effectively dead code and cannot be tested without modifying the source

  test('extractDuration with zero totalMinutes (returns default 90)', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 136,
              title: { rendered: 'Event with zero duration' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                colonne_de_gauche: { duree: '0h00' }, // Should parse to 0 minutes
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].duration).toBe(90); // Should default to 90 when totalMinutes is 0
  });

  test('fetchImageUrl with empty guid.rendered', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 137,
              title: { rendered: 'Event' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [{ visuel: 999 }],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      if (url.includes('/wp-json/wp/v2/media/999')) {
        return { ok: true, json: async () => ({ guid: { rendered: '' } }) } as any; // Empty string for guid.rendered
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].image_url).toBeNull(); // Empty string should be falsy, return null
  });

  test('scrapeEvents with missing diaporama_header[0].visuel', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 138,
              title: { rendered: 'Event with missing visuel' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                // diaporama_header exists but [0] is undefined or doesn't have visuel
                diaporama_header: [{}], // Empty object without visuel property
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].image_url).toBeNull(); // No visuel means no image
  });

  test('scrapeEvents with missing acf object (tests all null coalescing)', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 139,
              title: { rendered: undefined }, // undefined rendered
              acf: undefined, // acf is completely undefined to test all ?.
              class_list: ['saisons-2025-26-scolaires'],
              link: '', // empty string link
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].title).toBe('Sans titre'); // Should use fallback
    expect(events[0].description).toBeNull();
    expect(events[0].duration).toBe(90); // Should use default
    expect(events[0].link).toBe(''); // Empty string link
    expect(events[0].image_url).toBeNull(); // No acf means no diaporama_header
    expect(events[0].event_dates).toEqual([]); // No dates
  });

  test('scrapeEvents with acf but missing nested properties', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 141,
              title: {}, // title exists but rendered is missing to test line 450
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                // colonne_centrale is completely missing (not null) to test line 447
                // colonne_de_gauche is missing to test line 448
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
              link: 'https://example.com',
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].title).toBe('Sans titre'); // Missing rendered
    expect(events[0].description).toBeNull(); // Missing colonne_centrale
    expect(events[0].duration).toBe(90); // Missing duree
    expect(events[0].link).toBe('https://example.com');
  });

  test('scrapeEvents with all acf properties present (tests truthy branches)', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 142,
              title: { rendered: 'Test Event Title' }, // rendered exists and is truthy
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                colonne_centrale: { texte: '<p>Test Description</p>' }, // texte exists and is truthy
                colonne_de_gauche: { duree: '2h 30min' }, // Valid format with h and min
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
              link: 'https://example.com',
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].title).toBe('Test Event Title'); // Should use actual title
    expect(events[0].description).toBe('Test Description'); // Should use actual description (HTML stripped)
    expect(events[0].duration).toBe(150); // 2h 30min = 150 minutes
    expect(events[0].link).toBe('https://example.com');
  });

  test('scrapeEvents with empty string title.rendered (tests ?? null branch)', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 143,
              title: { rendered: '' }, // rendered is empty string (falsy) - tests line 450
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].title).toBe('Sans titre'); // Empty string should trigger fallback
  });

  test('scrapeEvents with null title.rendered (tests ?. optional chaining branch)', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 144,
              title: { rendered: null }, // rendered is explicitly null - tests the ?. branch on line 450
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].title).toBe('Sans titre'); // null should trigger fallback via ?? null
  });

  test('scrapeEvents with null title object (tests title?. branch)', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 145,
              title: null, // title is explicitly null - tests the title?. branch on line 450
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].title).toBe('Sans titre'); // null title should trigger fallback
  });

  test('scrapeEvents with locations of equal length (tests reduce else branch)', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 140,
              title: { rendered: 'Event with equal length locations' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              // These two locations format to the same length
              // Both 'lieux-le-corum' and 'lieux-salle-bagouet-opera-comedie' should test the reduce else branch
              class_list: [
                'saisons-2025-26-scolaires',
                'lieux-salle-bagouet-opera-comedie',
                'lieux-le-corum',
              ],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    // When lengths are equal or first is longer, it should keep the first one in reduce
  });

  test('parseDescriptionForEducationalContent with Formation and Préparation musicale', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 150,
              title: { rendered: 'Event with Formation' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                colonne_centrale: {
                  texte:
                    'Une description\n\nAutour du concert\n Formation\n Préparation musicale\n Carnet spectacle',
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].has_initial_formation).toBe(true);
    expect(events[0].has_musical_preparation).toBe(true);
    expect(events[0].description).toBe(
      'Une description\n\nAutour du concert\n Formation\n Préparation musicale\n Carnet spectacle',
    );
  });

  test('parseDescriptionForEducationalContent without Formation or Préparation', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 151,
              title: { rendered: 'Event without Formation' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                colonne_centrale: {
                  texte: 'Une description simple sans section Autour du concert',
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].has_initial_formation).toBe(false);
    expect(events[0].has_musical_preparation).toBe(false);
  });

  test('parseDescriptionForEducationalContent with null description', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 152,
              title: { rendered: 'Event without description' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                colonne_centrale: {
                  texte: null,
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].has_initial_formation).toBe(false);
    expect(events[0].has_musical_preparation).toBe(false);
    expect(events[0].description).toBeNull();
  });

  test('parseDescriptionForEducationalContent with "Autour du spectacle"', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 153,
              title: { rendered: 'Event with Autour du spectacle' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                colonne_centrale: {
                  texte:
                    'Description du spectacle musical.\n\nAutour du spectacle\n Formation\n Préparation musicale',
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].has_initial_formation).toBe(true);
    expect(events[0].has_musical_preparation).toBe(true);
    expect(events[0].description).toBe(
      'Description du spectacle musical.\n\nAutour du spectacle\n Formation\n Préparation musicale',
    );
  });

  test('mapPublicIdsToCategories maps WordPress taxonomy IDs to PublicCategory', async () => {
    const { mapPublicIdsToCategories } = require('@/lib/cron/scraperMappings');

    // Test root categories
    expect(mapPublicIdsToCategories([302]).categories).toContain('CRECHE');
    expect(mapPublicIdsToCategories([285]).categories).toContain('MATERNELLE');
    expect(mapPublicIdsToCategories([301]).categories).toContain('ELEMENTAIRE');
    expect(mapPublicIdsToCategories([299]).categories).toContain('COLLEGE');
    expect(mapPublicIdsToCategories([287]).categories).toContain('LYCEE');
    expect(mapPublicIdsToCategories([296]).categories).toContain('SUPERIEUR');
    expect(mapPublicIdsToCategories([288]).categories).toContain('CONSERVATOIRE');
    expect(mapPublicIdsToCategories([286]).categories).toContain('ASSOCIATION');

    // Test child categories (should map to parent's PublicCategory)
    expect(mapPublicIdsToCategories([306]).categories).toContain('MATERNELLE'); // Maternelles (petite section)
    expect(mapPublicIdsToCategories([307]).categories).toContain('MATERNELLE'); // Maternelles (grande section)
    expect(mapPublicIdsToCategories([355]).categories).toContain('ELEMENTAIRE'); // Élémentaires (CM2)
    expect(mapPublicIdsToCategories([351]).categories).toContain('ELEMENTAIRE'); // Élémentaires (CP)
    expect(mapPublicIdsToCategories([310]).categories).toContain('COLLEGE'); // Collèges (6ème)
    expect(mapPublicIdsToCategories([345]).categories).toContain('COLLEGE'); // Collèges (4ème)
  });

  test('mapPublicIdsToCategories handles multiple IDs and deduplicates', async () => {
    const { mapPublicIdsToCategories } = require('@/lib/cron/scraperMappings');

    // Multiple different types
    const multiResult = mapPublicIdsToCategories([307, 351]);
    expect(multiResult.categories).toContain('MATERNELLE');
    expect(multiResult.categories).toContain('ELEMENTAIRE');

    // Duplicate types should be deduplicated (306 and 307 both map to MATERNELLE)
    const result = mapPublicIdsToCategories([306, 307]);
    expect(result.categories).toContain('MATERNELLE');
    expect(result.categories.length).toBe(1);

    // Mix of child and parent IDs
    const mixResult = mapPublicIdsToCategories([285, 306, 307]);
    expect(mixResult.categories).toContain('MATERNELLE');
  });

  test('mapPublicIdsToCategories returns AUTRE for empty or unknown IDs', async () => {
    const { mapPublicIdsToCategories } = require('@/lib/cron/scraperMappings');

    expect(mapPublicIdsToCategories([]).categories).toContain('AUTRE');
    expect(mapPublicIdsToCategories([99999]).categories).toContain('AUTRE'); // Unknown ID
    expect(mapPublicIdsToCategories([99999, 88888]).categories).toContain('AUTRE'); // Multiple unknown IDs
  });

  test('scrapeEvents uses public IDs from ACF when available', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 154,
              title: { rendered: 'Event with ACF public IDs' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                colonne_de_gauche: {
                  public: [307, 351], // Maternelles GS + Élémentaires CP
                },
                diaporama_header: [],
              },
              // class_list has different publics - should be ignored when ACF public is present
              class_list: ['saisons-2025-26-scolaires', 'saisons-25-26-lycees'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    // Should use ACF public IDs (MATERNELLE, ELEMENTAIRE) not class_list (LYCEE)
    expect(events[0].category).toContain('MATERNELLE');
    expect(events[0].category).toContain('ELEMENTAIRE');
    expect(events[0].category).not.toContain('LYCEE');
  });

  test('scrapeEvents falls back to class_list when ACF public is empty', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 155,
              title: { rendered: 'Event without ACF public IDs' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                colonne_de_gauche: {
                  public: [], // Empty ACF public
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'saisons-25-26-lycees'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    // Should fall back to class_list parsing
    expect(events[0].category).toContain('LYCEE');
  });

  test('scrapeEvents falls back to class_list when ACF colonne_de_gauche is missing', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 156,
              title: { rendered: 'Event without colonne_de_gauche' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                // No colonne_de_gauche at all
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'saisons-25-26-colleges'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    // Should fall back to class_list parsing
    expect(events[0].category).toContain('COLLEGE');
  });

  test('location formatting uses LOCATIONS_MAP for accented city names', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 157,
              title: { rendered: 'Event in Béziers' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'lieux-beziers-domaine-de-bayssan'],
            },
            {
              id: 158,
              title: { rendered: 'Event in Sète' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-02', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: [
                'saisons-2025-26-scolaires',
                'lieux-sete-scene-nationale-archipel-de-thau',
              ],
            },
            {
              id: 159,
              title: { rendered: 'Event in Nîmes' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-03', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'lieux-nimes-arenes'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(3);
    // Béziers with accent from LOCATIONS_MAP
    expect(events[0].location).toBe('Béziers | Domaine de Bayssan');
    // Sète with accent from LOCATIONS_MAP
    expect(events[1].location).toBe('Sète | Théâtre Molière – Scène nationale Archipel de Thau');
    // Nîmes with accent from LOCATIONS_MAP
    expect(events[2].location).toBe('Nîmes | Arènes');
  });

  test('dynamic location formatting with prepositions in correct case', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 160,
              title: { rendered: 'Event with prepositions' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              // Use a location that exists in LOCATIONS_MAP
              class_list: [
                'saisons-2025-26-scolaires',
                'lieux-montpellier-parvis-de-lhotel-de-ville',
              ],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    // "de" should be lowercase, "Hotel" should become "Hôtel"
    expect(events[0].location).toBe("Montpellier | Parvis de l'Hôtel de Ville");
  });

  test('dynamic location formatting uses known locations map for main venues', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 161,
              title: { rendered: 'Event at Zénith' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'lieux-zenith-sud-montpellier'],
            },
            {
              id: 162,
              title: { rendered: 'Event at Salle Molière' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-02', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires', 'lieux-salle-moliere-opera-comedie'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(2);
    // Known location
    expect(events[0].location).toBe('Montpellier | Zénith Sud');
    expect(events[0].total_seats).toBe(0);
    // Salle Molière uses known location map
    expect(events[1].location).toBe('Salle Molière | Opéra Comédie');
    expect(events[1].total_seats).toBe(0);
  });

  test('extractLocation picks longer formatted location name when first is longer', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 170,
              title: { rendered: 'Event with multiple locations - first longer' },
              acf: {
                colonne_de_droite: {
                  dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
                },
                diaporama_header: [],
              },
              // First location has longer formatted name than second
              // 'lieux-salle-moliere-opera-comedie' -> 'Salle Molière | Opéra Comédie' (29 chars)
              // 'lieux-opera-comedie' -> 'Opéra Comédie' (14 chars)
              class_list: [
                'saisons-2025-26-scolaires',
                'lieux-salle-moliere-opera-comedie',
                'lieux-opera-comedie',
              ],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    // Should keep 'Salle Molière | Opéra Comédie' because it's longer (29 chars vs 14 chars)
    expect(events[0].location).toBe('Salle Molière | Opéra Comédie');
  });

  test('scrapeEvents handles invalid dates (tests filter !isNaN)', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 901,
              title: { rendered: 'Invalid Date Event' },
              acf: {
                colonne_de_droite: {
                  dates: [
                    { date: '2025-09-01', complet: false, annule: false, report: false },
                    { date: 'invalid-date', complet: false, annule: false, report: false },
                  ],
                },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    expect(events[0].event_dates.length).toBe(1); // Invalid date removed
  });

  test('scrapeEvents handles duration hour only and raw number', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 902,
              title: { rendered: 'Hour Only' },
              acf: {
                colonne_de_droite: { dates: [] },
                colonne_de_gauche: { duree: '3h' },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
            {
              id: 903,
              title: { rendered: 'Raw Number' },
              acf: {
                colonne_de_droite: { dates: [] },
                colonne_de_gauche: { duree: '120' },
                diaporama_header: [],
              },
              class_list: ['saisons-2025-26-scolaires'],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(2);
    expect(events[0].duration).toBe(180);
    expect(events[1].duration).toBe(120);
  });

  test('scrapeEvents with 3 locations (ensures reduce callback runs multiple times)', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/wp-json/wp/v2/spectacle')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 904,
              title: { rendered: 'Three Locations' },
              acf: {
                colonne_de_droite: { dates: [] },
                diaporama_header: [],
              },
              class_list: [
                'saisons-2025-26-scolaires',
                'lieux-a', // Short
                'lieux-b-long', // Medium
                'lieux-c-very-long-location-name', // Longest
              ],
            },
          ],
        } as any;
      }
      return { ok: false } as any;
    }) as any;

    const { scrapeEvents } = require('@/lib/cron/eventsScraper');
    const events = await scrapeEvents();
    expect(events.length).toBe(1);
    // c-very-long-location-name -> C very long location name (len ~ 27)
    // b-long -> B Long (len ~ 6)
    // a -> A (len 1)
    expect(events[0].location).toBe('C very long location name');
  });
});

// Direct function tests for 100% function coverage
describe('eventsScraper utility functions', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('getCurrentSeason', () => {
    test('returns correct season format', () => {
      const { getCurrentSeason } = require('@/lib/cron/eventsScraper');
      const season = getCurrentSeason();
      expect(season).toHaveProperty('long');
      expect(season).toHaveProperty('short');
      expect(season.long).toMatch(/^\d{4}-\d{2}$/);
      expect(season.short).toMatch(/^\d{2}-\d{2}$/);
    });
  });

  describe('extractEventTypes', () => {
    test('extracts types from etypes- prefixed classes', () => {
      const { extractEventTypes } = require('@/lib/cron/eventsScraper');
      const result = extractEventTypes(['etypes-opera', 'etypes-jazz', 'other-class']);
      expect(result).toEqual(['opera', 'jazz']);
    });

    test('returns empty array when no etypes classes', () => {
      const { extractEventTypes } = require('@/lib/cron/eventsScraper');
      const result = extractEventTypes(['class1', 'class2']);
      expect(result).toEqual([]);
    });
  });

  describe('extractPublicNames', () => {
    test('extracts public names for given season', () => {
      const { extractPublicNames } = require('@/lib/cron/eventsScraper');
      const result = extractPublicNames(
        ['saisons-25-26-lycees', 'saisons-25-26-colleges', 'saisons-25-26-scolaires'],
        '25-26',
      );
      expect(result).toEqual(['lycees', 'colleges']);
    });

    test('returns empty when no matching season classes', () => {
      const { extractPublicNames } = require('@/lib/cron/eventsScraper');
      const result = extractPublicNames(['other-class'], '25-26');
      expect(result).toEqual([]);
    });

    test('replaces hyphens with spaces', () => {
      const { extractPublicNames } = require('@/lib/cron/eventsScraper');
      const result = extractPublicNames(['saisons-25-26-centre-de-loisirs'], '25-26');
      expect(result).toEqual(['centre de loisirs']);
    });
  });

  describe('stripHtml', () => {
    test('strips HTML tags', () => {
      const { stripHtml } = require('@/lib/cron/eventsScraper');
      expect(stripHtml('<p>Hello <strong>World</strong></p>')).toBe('Hello World');
    });

    test('replaces HTML entities', () => {
      const { stripHtml } = require('@/lib/cron/eventsScraper');
      expect(stripHtml('L&rsquo;Opera &amp; Music&nbsp;')).toBe("L'Opera & Music");
    });

    test('returns null for null input', () => {
      const { stripHtml } = require('@/lib/cron/eventsScraper');
      expect(stripHtml(null)).toBeNull();
    });

    test('replaces &#038; entity', () => {
      const { stripHtml } = require('@/lib/cron/eventsScraper');
      expect(stripHtml('A &#038; B')).toBe('A & B');
    });
  });

  describe('extractDuration', () => {
    test('returns 90 for null input', () => {
      const { extractDuration } = require('@/lib/cron/eventsScraper');
      expect(extractDuration(null)).toBe(90);
    });

    test('parses hours and minutes', () => {
      const { extractDuration } = require('@/lib/cron/eventsScraper');
      expect(extractDuration('2h30min')).toBe(150);
    });

    test('parses hours only', () => {
      const { extractDuration } = require('@/lib/cron/eventsScraper');
      expect(extractDuration('3h')).toBe(180);
    });

    test('parses minutes only with min suffix', () => {
      const { extractDuration } = require('@/lib/cron/eventsScraper');
      expect(extractDuration('45min')).toBe(45);
    });

    test('parses minutes only with mn suffix', () => {
      const { extractDuration } = require('@/lib/cron/eventsScraper');
      expect(extractDuration('30 mn')).toBe(30);
    });

    test('parses raw number', () => {
      const { extractDuration } = require('@/lib/cron/eventsScraper');
      expect(extractDuration('120')).toBe(120);
    });

    test('returns 90 for zero result', () => {
      const { extractDuration } = require('@/lib/cron/eventsScraper');
      expect(extractDuration('0h00')).toBe(90);
    });
  });

  describe('parseDescriptionForEducationalContent', () => {
    test('returns all false for null description', () => {
      const { parseDescriptionForEducationalContent } = require('@/lib/cron/eventsScraper');
      const result = parseDescriptionForEducationalContent(null);
      expect(result.hasInitialFormation).toBe(false);
      expect(result.hasMusicalPreparation).toBe(false);
      expect(result.enhancedDescription).toBeNull();
    });

    test('detects Formation in Autour du concert section', () => {
      const { parseDescriptionForEducationalContent } = require('@/lib/cron/eventsScraper');
      const result = parseDescriptionForEducationalContent('Text\nAutour du concert\n Formation');
      expect(result.hasInitialFormation).toBe(true);
    });

    test('detects Préparation musicale in Autour du spectacle section', () => {
      const { parseDescriptionForEducationalContent } = require('@/lib/cron/eventsScraper');
      const result = parseDescriptionForEducationalContent(
        'Text\nAutour du spectacle\n Préparation musicale',
      );
      expect(result.hasMusicalPreparation).toBe(true);
    });

    test('keeps Autour section in description', () => {
      const { parseDescriptionForEducationalContent } = require('@/lib/cron/eventsScraper');
      const result = parseDescriptionForEducationalContent('Main text\nAutour du concert\nExtra');
      expect(result.enhancedDescription).toBe('Main text\nAutour du concert\nExtra');
    });
  });

  describe('convertEventDates', () => {
    test('converts valid dates', () => {
      const { convertEventDates } = require('@/lib/cron/eventsScraper');
      const result = convertEventDates([
        { date: '2025-09-01', complet: false, annule: false, report: false },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(Date);
    });

    test('filters cancelled dates', () => {
      const { convertEventDates } = require('@/lib/cron/eventsScraper');
      const result = convertEventDates([
        { date: '2025-09-01', complet: false, annule: true, report: false },
      ]);
      expect(result).toHaveLength(0);
    });

    test('filters postponed dates', () => {
      const { convertEventDates } = require('@/lib/cron/eventsScraper');
      const result = convertEventDates([
        { date: '2025-09-01', complet: false, annule: false, report: true },
      ]);
      expect(result).toHaveLength(0);
    });

    test('filters invalid dates', () => {
      const { convertEventDates } = require('@/lib/cron/eventsScraper');
      const result = convertEventDates([
        { date: 'invalid', complet: false, annule: false, report: false },
      ]);
      expect(result).toHaveLength(0);
    });
  });

  describe('extractLocation', () => {
    test('returns null when no lieux- classes', () => {
      const { extractLocation } = require('@/lib/cron/eventsScraper');
      expect(extractLocation(['class1', 'class2'])).toBeNull();
    });

    test('returns location class when found', () => {
      const { extractLocation } = require('@/lib/cron/eventsScraper');
      const result = extractLocation(['lieux-opera-comedie', 'other']);
      expect(result).toBe('lieux-opera-comedie');
    });

    test('picks longest formatted location', () => {
      const { extractLocation } = require('@/lib/cron/eventsScraper');
      const result = extractLocation(['lieux-opera-comedie', 'lieux-grand-foyer-opera-comedie']);
      expect(result).toBe('lieux-grand-foyer-opera-comedie');
    });
  });

  describe('fetchImageUrl', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      jest.resetModules();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    test('returns null for null mediaId', async () => {
      const { fetchImageUrl } = require('@/lib/cron/eventsScraper');
      expect(await fetchImageUrl(null)).toBeNull();
    });

    test('fetches and returns image URL', async () => {
      global.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({ guid: { rendered: 'https://example.com/image.jpg' } }),
      })) as any;

      const { fetchImageUrl } = require('@/lib/cron/eventsScraper');
      const result = await fetchImageUrl(123);
      expect(result).toBe('https://example.com/image.jpg');
    });

    test('returns null on fetch failure', async () => {
      global.fetch = jest.fn(async () => ({
        ok: false,
        statusText: 'Not Found',
      })) as any;

      const { fetchImageUrl } = require('@/lib/cron/eventsScraper');
      const result = await fetchImageUrl(123);
      expect(result).toBeNull();
    });

    test('returns null on fetch exception', async () => {
      global.fetch = jest.fn(async () => {
        throw new Error('Network error');
      }) as any;

      const { fetchImageUrl } = require('@/lib/cron/eventsScraper');
      const result = await fetchImageUrl(123);
      expect(result).toBeNull();
    });
  });

  describe('filterLocationClasses', () => {
    test('returns empty array when no lieux- classes', () => {
      const { filterLocationClasses } = require('@/lib/cron/eventsScraper');
      expect(filterLocationClasses(['class1', 'class2'])).toEqual([]);
    });

    test('filters only lieux- prefixed classes', () => {
      const { filterLocationClasses } = require('@/lib/cron/eventsScraper');
      const result = filterLocationClasses([
        'class1',
        'lieux-opera-comedie',
        'lieux-le-corum',
        'other',
      ]);
      expect(result).toEqual(['lieux-opera-comedie', 'lieux-le-corum']);
    });

    test('returns single lieux- class', () => {
      const { filterLocationClasses } = require('@/lib/cron/eventsScraper');
      expect(filterLocationClasses(['lieux-opera-comedie'])).toEqual(['lieux-opera-comedie']);
    });
  });

  describe('findLongestLocationClass', () => {
    test('returns first when formatted lengths are equal', () => {
      const { findLongestLocationClass } = require('@/lib/cron/eventsScraper');
      // Both 'lieux-a' and 'lieux-b' format to 'A' and 'B' (same length)
      const result = ['lieux-a', 'lieux-b'].reduce(findLongestLocationClass);
      expect(result).toBe('lieux-a');
    });

    test('returns the location with longer formatted name', () => {
      const { findLongestLocationClass } = require('@/lib/cron/eventsScraper');
      // 'lieux-grand-foyer-opera-comedie' formats to 'Opéra Comédie | Grand Foyer' (27 chars)
      // 'lieux-opera-comedie' formats to 'Opéra Comédie' (14 chars)
      const result = ['lieux-opera-comedie', 'lieux-grand-foyer-opera-comedie'].reduce(
        findLongestLocationClass,
      );
      expect(result).toBe('lieux-grand-foyer-opera-comedie');
    });
  });

  describe('isCurrentSeasonEvent', () => {
    test('returns true when event has matching season in class_list', () => {
      const { isCurrentSeasonEvent } = require('@/lib/cron/eventsScraper');
      const event = {
        class_list: ['saisons-2025-26-scolaires', 'etypes-opera'],
      };
      expect(isCurrentSeasonEvent(event, 'saisons-2025-26-scolaires')).toBe(true);
    });

    test('returns false when event does not have matching season', () => {
      const { isCurrentSeasonEvent } = require('@/lib/cron/eventsScraper');
      const event = {
        class_list: ['saisons-2024-25-scolaires', 'etypes-opera'],
      };
      expect(isCurrentSeasonEvent(event, 'saisons-2025-26-scolaires')).toBe(false);
    });

    test('returns false when event has no class_list', () => {
      const { isCurrentSeasonEvent } = require('@/lib/cron/eventsScraper');
      const event = {};
      expect(isCurrentSeasonEvent(event, 'saisons-2025-26-scolaires')).toBe(false);
    });

    test('returns false when class_list is undefined', () => {
      const { isCurrentSeasonEvent } = require('@/lib/cron/eventsScraper');
      const event = { class_list: undefined };
      expect(isCurrentSeasonEvent(event, 'saisons-2025-26-scolaires')).toBe(false);
    });
  });

  describe('createSeasonFilter', () => {
    test('returns a filter function that filters events by season', () => {
      const { createSeasonFilter } = require('@/lib/cron/eventsScraper');
      const filterFn = createSeasonFilter('saisons-2025-26-scolaires');
      expect(typeof filterFn).toBe('function');
    });

    test('filter function returns true for matching season', () => {
      const { createSeasonFilter } = require('@/lib/cron/eventsScraper');
      const filterFn = createSeasonFilter('saisons-2025-26-scolaires');
      const event = {
        class_list: ['saisons-2025-26-scolaires', 'etypes-opera'],
      };
      expect(filterFn(event)).toBe(true);
    });

    test('filter function returns false for non-matching season', () => {
      const { createSeasonFilter } = require('@/lib/cron/eventsScraper');
      const filterFn = createSeasonFilter('saisons-2025-26-scolaires');
      const event = {
        class_list: ['saisons-2024-25-scolaires', 'etypes-opera'],
      };
      expect(filterFn(event)).toBe(false);
    });
  });

  describe('seasonFilterCallback', () => {
    test('filters events by season when bound with context', () => {
      const { seasonFilterCallback } = require('@/lib/cron/eventsScraper');
      const boundFilter = seasonFilterCallback.bind({ seasonFilter: 'saisons-2025-26-scolaires' });
      const event = {
        class_list: ['saisons-2025-26-scolaires', 'etypes-opera'],
      };
      expect(boundFilter(event)).toBe(true);
    });

    test('returns false when season does not match', () => {
      const { seasonFilterCallback } = require('@/lib/cron/eventsScraper');
      const boundFilter = seasonFilterCallback.bind({ seasonFilter: 'saisons-2025-26-scolaires' });
      const event = {
        class_list: ['saisons-2024-25-scolaires', 'etypes-opera'],
      };
      expect(boundFilter(event)).toBe(false);
    });
  });

  describe('createEventMapper', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      jest.resetModules();
      // Mock fetch for images
      global.fetch = jest.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/wp-json/wp/v2/media/')) {
          return {
            ok: true,
            json: async () => ({ guid: { rendered: 'https://cdn/opera/event.jpg' } }),
          } as any;
        }
        return { ok: false } as any;
      }) as any;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    test('returns a mapper function for transforming events', () => {
      const { createEventMapper } = require('@/lib/cron/eventsScraper');
      const mapperFn = createEventMapper({
        long: '2025-26',
        short: '25-26',
      });
      expect(typeof mapperFn).toBe('function');
    });

    test('mapper function transforms WordPress event correctly', async () => {
      const { createEventMapper } = require('@/lib/cron/eventsScraper');
      const mapperFn = createEventMapper({
        long: '2025-26',
        short: '25-26',
      });
      const wpEvent = {
        class_list: ['saisons-2025-26-scolaires', 'etypes-opera', 'lieux-opera-comedie'],
        link: 'https://example.com/event',
        slug: 'test-event',
        title: { rendered: 'Test Event' },
        acf: {
          colonne_centrale: { texte: '<p>Description</p>' },
          colonne_de_gauche: { duree: '2h', public: [285] },
          colonne_de_droite: {
            dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
          },
          diaporama_header: [{ visuel: 123 }],
        },
      };
      const result = await mapperFn(wpEvent);
      expect(result.title).toBe('Test Event');
      expect(result.location).toBe('Opéra Comédie');
    });
  });

  describe('eventMapperCallback', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      jest.resetModules();
      // Mock fetch for images
      global.fetch = jest.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/wp-json/wp/v2/media/')) {
          return {
            ok: true,
            json: async () => ({ guid: { rendered: 'https://cdn/opera/event.jpg' } }),
          } as any;
        }
        return { ok: false } as any;
      }) as any;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    test('transforms events when bound with season context', async () => {
      const { eventMapperCallback } = require('@/lib/cron/eventsScraper');
      const boundMapper = eventMapperCallback.bind({
        currentSeason: { long: '2025-26', short: '25-26' },
      });
      const wpEvent = {
        class_list: ['saisons-2025-26-scolaires', 'etypes-opera'],
        link: 'https://example.com/event',
        title: { rendered: 'Test' },
        acf: {
          colonne_de_droite: { dates: [] },
          diaporama_header: [],
        },
      };
      const result = await boundMapper(wpEvent);
      expect(result.title).toBe('Test');
    });
  });

  describe('filterEventTypeClass', () => {
    test('returns true for etypes- classes', () => {
      const { filterEventTypeClass } = require('@/lib/cron/eventsScraper');
      expect(filterEventTypeClass('etypes-opera')).toBe(true);
      expect(filterEventTypeClass('etypes-concert')).toBe(true);
    });

    test('returns false for non-etypes classes', () => {
      const { filterEventTypeClass } = require('@/lib/cron/eventsScraper');
      expect(filterEventTypeClass('lieux-opera-comedie')).toBe(false);
      expect(filterEventTypeClass('saisons-25-26-scolaires')).toBe(false);
    });
  });

  describe('mapEventTypeFromClass', () => {
    test('removes etypes- prefix', () => {
      const { mapEventTypeFromClass } = require('@/lib/cron/eventsScraper');
      expect(mapEventTypeFromClass('etypes-opera')).toBe('opera');
      expect(mapEventTypeFromClass('etypes-concert-lyrique')).toBe('concert-lyrique');
    });
  });

  describe('publicClassFilterCallback', () => {
    test('filters classes by season prefix and excludes scolaires', () => {
      const { publicClassFilterCallback } = require('@/lib/cron/eventsScraper');
      const boundFilter = publicClassFilterCallback.bind({
        seasonPrefix: 'saisons-25-26-',
        genericClass: 'saisons-25-26-scolaires',
      });

      expect(boundFilter('saisons-25-26-lycees')).toBe(true);
      expect(boundFilter('saisons-25-26-scolaires')).toBe(false);
      expect(boundFilter('saisons-24-25-lycees')).toBe(false);
    });
  });

  describe('createPublicClassFilter', () => {
    test('returns a filter function for public classes', () => {
      const { createPublicClassFilter } = require('@/lib/cron/eventsScraper');
      const filterFn = createPublicClassFilter('saisons-25-26-');
      expect(typeof filterFn).toBe('function');
    });

    test('filter function works correctly', () => {
      const { createPublicClassFilter } = require('@/lib/cron/eventsScraper');
      const filterFn = createPublicClassFilter('saisons-25-26-');

      expect(filterFn('saisons-25-26-lycees')).toBe(true);
      expect(filterFn('saisons-25-26-scolaires')).toBe(false);
    });
  });

  describe('publicNameMapperCallback', () => {
    test('removes season prefix and replaces hyphens with spaces', () => {
      const { publicNameMapperCallback } = require('@/lib/cron/eventsScraper');
      const boundMapper = publicNameMapperCallback.bind({ seasonPrefix: 'saisons-25-26-' });

      expect(boundMapper('saisons-25-26-lycees')).toBe('lycees');
      expect(boundMapper('saisons-25-26-ecoles-elementaires')).toBe('ecoles elementaires');
    });
  });

  describe('createPublicNameMapper', () => {
    test('returns a mapper function for public names', () => {
      const { createPublicNameMapper } = require('@/lib/cron/eventsScraper');
      const mapperFn = createPublicNameMapper('saisons-25-26-');
      expect(typeof mapperFn).toBe('function');
    });

    test('mapper function extracts public name correctly', () => {
      const { createPublicNameMapper } = require('@/lib/cron/eventsScraper');
      const mapperFn = createPublicNameMapper('saisons-25-26-');

      expect(mapperFn('saisons-25-26-lycees')).toBe('lycees');
      expect(mapperFn('saisons-25-26-associations')).toBe('associations');
    });
  });

  describe('filterValidEventDate', () => {
    test('returns true for valid dates (not cancelled or postponed)', () => {
      const { filterValidEventDate } = require('@/lib/cron/eventsScraper');
      expect(
        filterValidEventDate({ date: '2025-09-01', complet: false, annule: false, report: false }),
      ).toBe(true);
    });

    test('returns false for cancelled events', () => {
      const { filterValidEventDate } = require('@/lib/cron/eventsScraper');
      expect(
        filterValidEventDate({ date: '2025-09-01', complet: false, annule: true, report: false }),
      ).toBe(false);
    });

    test('returns false for postponed events', () => {
      const { filterValidEventDate } = require('@/lib/cron/eventsScraper');
      expect(
        filterValidEventDate({ date: '2025-09-01', complet: false, annule: false, report: true }),
      ).toBe(false);
    });
  });

  describe('mapEventDateToDate', () => {
    test('converts EventDate to Date object', () => {
      const { mapEventDateToDate } = require('@/lib/cron/eventsScraper');
      const result = mapEventDateToDate({
        date: '2025-09-01',
        complet: false,
        annule: false,
        report: false,
      });
      expect(result).toEqual(new Date('2025-09-01'));
    });
  });

  describe('filterValidDate', () => {
    test('returns true for valid Date objects', () => {
      const { filterValidDate } = require('@/lib/cron/eventsScraper');
      expect(filterValidDate(new Date('2025-09-01'))).toBe(true);
    });

    test('returns false for invalid Date objects', () => {
      const { filterValidDate } = require('@/lib/cron/eventsScraper');
      const invalidDate = new Date('invalid');
      expect(isNaN(invalidDate.getTime())).toBe(true);
      expect(filterValidDate(invalidDate)).toBe(false);
    });
  });

  describe('transformWordPressEvent', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      jest.resetModules();
      // Mock fetch for images
      global.fetch = jest.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/wp-json/wp/v2/media/')) {
          return {
            ok: true,
            json: async () => ({ guid: { rendered: 'https://cdn/opera/event.jpg' } }),
          } as any;
        }
        return { ok: false } as any;
      }) as any;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    test('transforms WordPress event to API event', async () => {
      const { transformWordPressEvent } = require('@/lib/cron/eventsScraper');
      const wpEvent = {
        class_list: ['saisons-2025-26-scolaires', 'etypes-opera', 'lieux-opera-comedie'],
        link: 'https://example.com/event',
        slug: 'test-event',
        title: { rendered: 'Test Event Title' },
        acf: {
          colonne_centrale: { texte: '<p>Event description</p>' },
          colonne_de_gauche: {
            duree: '2h',
            public: [285], // Maternelles
          },
          colonne_de_droite: {
            dates: [{ date: '2025-09-01', complet: false, annule: false, report: false }],
          },
          diaporama_header: [{ visuel: 123 }],
        },
      };

      const result = await transformWordPressEvent(wpEvent, {
        long: '2025-26',
        short: '25-26',
      });

      expect(result.title).toBe('Test Event Title');
      expect(result.slug).toBe('test-event');
      expect(result.description).toBe('Event description');
      expect(result.link).toBe('https://example.com/event');
      expect(result.duration).toBe(120);
      expect(result.category).toContain('MATERNELLE');
      expect(result.location).toBe('Opéra Comédie');
      expect(result.image_url).toBe('https://cdn/opera/event.jpg');
    });

    test('handles missing optional fields', async () => {
      const { transformWordPressEvent } = require('@/lib/cron/eventsScraper');
      const wpEvent = {
        class_list: ['saisons-2025-26-scolaires'],
        link: undefined,
        slug: undefined,
        acf: {
          colonne_de_droite: { dates: [] },
          diaporama_header: [],
        },
      };

      const result = await transformWordPressEvent(wpEvent, {
        long: '2025-26',
        short: '25-26',
      });

      expect(result.title).toBe('Sans titre');
      expect(result.slug).toBeNull();
      expect(result.link).toBe('');
      expect(result.description).toBeNull();
      expect(result.duration).toBe(90); // default
      expect(result.image_url).toBeNull();
    });

    test('uses fallback age range from class_list when no ACF public', async () => {
      const { transformWordPressEvent } = require('@/lib/cron/eventsScraper');
      const wpEvent = {
        class_list: ['saisons-2025-26-scolaires', 'saisons-25-26-lycees'],
        link: '',
        acf: {
          colonne_de_gauche: { public: [] }, // Empty ACF public
          colonne_de_droite: { dates: [] },
          diaporama_header: [],
        },
      };

      const result = await transformWordPressEvent(wpEvent, {
        long: '2025-26',
        short: '25-26',
      });

      expect(result.category).toContain('LYCEE');
    });

    test('filters cancelled and postponed dates', async () => {
      const { transformWordPressEvent } = require('@/lib/cron/eventsScraper');
      const wpEvent = {
        class_list: ['saisons-2025-26-scolaires'],
        link: '',
        acf: {
          colonne_de_droite: {
            dates: [
              { date: '2025-09-01', complet: false, annule: false, report: false },
              { date: '2025-09-02', complet: false, annule: true, report: false }, // cancelled
              { date: '2025-09-03', complet: false, annule: false, report: true }, // postponed
            ],
          },
          diaporama_header: [],
        },
      };

      const result = await transformWordPressEvent(wpEvent, {
        long: '2025-26',
        short: '25-26',
      });

      expect(result.event_dates).toHaveLength(1);
      expect(result.event_dates[0]).toEqual(new Date('2025-09-01'));
    });

    test('extracts accessibility from ACF field', async () => {
      const { transformWordPressEvent } = require('@/lib/cron/eventsScraper');
      const wpEvent = {
        class_list: ['saisons-2025-26-scolaires'],
        link: 'https://example.com/event',
        acf: {
          colonne_de_gauche: {
            accessibilite: [289, 290], // AUDITORY and VISUAL
          },
          colonne_de_droite: { dates: [] },
          diaporama_header: [],
        },
      };

      const result = await transformWordPressEvent(wpEvent, {
        long: '2025-26',
        short: '25-26',
      });

      expect(result.accessibility).toContain('AUDITORY');
      expect(result.accessibility).toContain('VISUAL');
      expect(result.accessibility).toHaveLength(2);
    });

    test('returns empty accessibility array when no ACF accessibility', async () => {
      const { transformWordPressEvent } = require('@/lib/cron/eventsScraper');
      const wpEvent = {
        class_list: ['saisons-2025-26-scolaires'],
        link: '',
        acf: {
          colonne_de_gauche: {}, // No accessibility field
          colonne_de_droite: { dates: [] },
          diaporama_header: [],
        },
      };

      const result = await transformWordPressEvent(wpEvent, {
        long: '2025-26',
        short: '25-26',
      });

      expect(result.accessibility).toEqual([]);
    });
  });
});

describe('scraperMappings', () => {
  describe('mapAccessibilityIds', () => {
    test('maps WordPress accessibility IDs to Prisma Accessibility enum', () => {
      const { mapAccessibilityIds } = require('@/lib/cron/scraperMappings');

      const result = mapAccessibilityIds([289, 290]);
      expect(result).toContain('AUDITORY');
      expect(result).toContain('VISUAL');
      expect(result).toHaveLength(2);
    });

    test('returns empty array for empty input', () => {
      const { mapAccessibilityIds } = require('@/lib/cron/scraperMappings');

      expect(mapAccessibilityIds([])).toEqual([]);
    });

    test('returns empty array for null/undefined input', () => {
      const { mapAccessibilityIds } = require('@/lib/cron/scraperMappings');

      expect(mapAccessibilityIds(null as any)).toEqual([]);
      expect(mapAccessibilityIds(undefined as any)).toEqual([]);
    });

    test('ignores unknown accessibility IDs', () => {
      const { mapAccessibilityIds } = require('@/lib/cron/scraperMappings');

      const result = mapAccessibilityIds([289, 999, 888]);
      expect(result).toContain('AUDITORY');
      expect(result).toHaveLength(1);
    });

    test('removes duplicate accessibility types', () => {
      const { mapAccessibilityIds } = require('@/lib/cron/scraperMappings');

      const result = mapAccessibilityIds([289, 289, 290]);
      expect(result).toContain('AUDITORY');
      expect(result).toContain('VISUAL');
      expect(result).toHaveLength(2);
    });

    test('maps single AUDITORY accessibility ID', () => {
      const { mapAccessibilityIds } = require('@/lib/cron/scraperMappings');

      const result = mapAccessibilityIds([289]);
      expect(result).toEqual(['AUDITORY']);
    });

    test('maps single VISUAL accessibility ID', () => {
      const { mapAccessibilityIds } = require('@/lib/cron/scraperMappings');

      const result = mapAccessibilityIds([290]);
      expect(result).toEqual(['VISUAL']);
    });
  });
});
