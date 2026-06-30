import { describe, expect, test } from '@jest/globals';
import { getEventUrl, getEventApiUrl } from '@/lib/events/eventUrl';

describe('eventUrl', () => {
  describe('getEventUrl', () => {
    test('returns URL with slug when slug is available', () => {
      const event = { id: '123', slug: 'mon-evenement' };
      expect(getEventUrl(event)).toBe('/events/mon-evenement');
    });

    test('returns URL with id when slug is null', () => {
      const event = { id: '123', slug: null };
      expect(getEventUrl(event)).toBe('/events/123');
    });

    test('returns URL with id when slug is undefined', () => {
      const event = { id: '123' };
      expect(getEventUrl(event)).toBe('/events/123');
    });

    test('returns URL with id when slug is empty string', () => {
      const event = { id: '123', slug: '' };
      expect(getEventUrl(event)).toBe('/events/123');
    });
  });

  describe('getEventApiUrl', () => {
    test('returns API URL with slug when slug is available', () => {
      const event = { id: '456', slug: 'autre-evenement' };
      expect(getEventApiUrl(event)).toBe('/api/events/autre-evenement');
    });

    test('returns API URL with id when slug is null', () => {
      const event = { id: '456', slug: null };
      expect(getEventApiUrl(event)).toBe('/api/events/456');
    });

    test('returns API URL with id when slug is undefined', () => {
      const event = { id: '456' };
      expect(getEventApiUrl(event)).toBe('/api/events/456');
    });

    test('returns API URL with id when slug is empty string', () => {
      const event = { id: '456', slug: '' };
      expect(getEventApiUrl(event)).toBe('/api/events/456');
    });
  });
});
