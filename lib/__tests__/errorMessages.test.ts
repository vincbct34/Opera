import { describe, expect, test } from '@jest/globals';
import { normalizeApiError, getErrorMapping } from '@/lib/validation/errorMessages';

describe('errorMessages', () => {
  test('normalizeApiError returns fallback on falsy payload', () => {
    expect(normalizeApiError(null)).toBe('Une erreur est survenue.');
    expect(normalizeApiError(undefined, 'fallback')).toBe('fallback');
  });

  test('normalizeApiError maps known raw messages', () => {
    const mapping = getErrorMapping();
    // Pick a known key from mapping
    const keys = Object.keys(mapping);
    expect(keys.length).toBeGreaterThan(0);
    const sampleRaw = keys[0];
    const friendly = mapping[sampleRaw];
    expect(normalizeApiError(sampleRaw)).toBe(friendly);
  });

  test('normalizeApiError returns raw string if unmapped', () => {
    expect(normalizeApiError('Some unknown error')).toBe('Some unknown error');
    expect(normalizeApiError({ error: 'Champs manquants' })).toBe(
      'Veuillez remplir tous les champs obligatoires.',
    );
  });

  test('normalizeApiError handles object with message field', () => {
    expect(normalizeApiError({ message: 'Utilisateur non trouvé' })).toBe(
      "Aucun compte n'est associé à cette adresse email.",
    );
    expect(normalizeApiError({ message: 'Unknown message' })).toBe('Unknown message');
  });

  test('normalizeApiError handles empty string', () => {
    expect(normalizeApiError('')).toBe('Une erreur est survenue.');
    expect(normalizeApiError({ error: '' })).toBe('Une erreur est survenue.');
    expect(normalizeApiError({ message: '   ' })).toBe('Une erreur est survenue.');
  });

  test('normalizeApiError handles objects without error or message', () => {
    expect(normalizeApiError({ foo: 'bar' })).toBe('Une erreur est survenue.');
  });

  test('normalizeApiError converts non-string error values to string', () => {
    expect(normalizeApiError({ error: 123 })).toBe('123');
    expect(normalizeApiError({ message: 456 })).toBe('456');
  });

  test('normalizeApiError handles null message', () => {
    expect(normalizeApiError({ message: null })).toBe('Une erreur est survenue.');
  });
});
