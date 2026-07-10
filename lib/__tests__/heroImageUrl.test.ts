import { describe, expect, it } from '@jest/globals';
import { validateHeroImageUrl, HERO_IMAGE_DOMAIN } from '../config/heroImageUrl';

describe('validateHeroImageUrl', () => {
  it('accepts an https URL on the apex domain', () => {
    const result = validateHeroImageUrl(`https://${HERO_IMAGE_DOMAIN}/img/hero.jpg`);
    expect(result).toEqual({ url: `https://${HERO_IMAGE_DOMAIN}/img/hero.jpg` });
  });

  it('accepts an https URL on a subdomain', () => {
    const result = validateHeroImageUrl('https://cdn.opera-orchestre-montpellier.fr/hero.webp');
    expect(result).toEqual({ url: 'https://cdn.opera-orchestre-montpellier.fr/hero.webp' });
  });

  it('accepts the www subdomain', () => {
    const result = validateHeroImageUrl('https://www.opera-orchestre-montpellier.fr/a.png');
    expect(result).toEqual({ url: 'https://www.opera-orchestre-montpellier.fr/a.png' });
  });

  it('trims surrounding whitespace and normalizes', () => {
    const result = validateHeroImageUrl(`  https://${HERO_IMAGE_DOMAIN}/x.jpg  `);
    expect(result).toEqual({ url: `https://${HERO_IMAGE_DOMAIN}/x.jpg` });
  });

  it('rejects a non-string input', () => {
    expect(validateHeroImageUrl(null)).toEqual({ error: expect.stringContaining('requise') });
    expect(validateHeroImageUrl(123)).toEqual({ error: expect.stringContaining('requise') });
  });

  it('rejects an empty / whitespace-only string', () => {
    expect(validateHeroImageUrl('')).toEqual({ error: expect.stringContaining('requise') });
    expect(validateHeroImageUrl('   ')).toEqual({ error: expect.stringContaining('requise') });
  });

  it('rejects a malformed URL', () => {
    expect(validateHeroImageUrl('not a url')).toEqual({ error: 'URL invalide' });
  });

  it('rejects non-https protocols', () => {
    expect(validateHeroImageUrl(`http://${HERO_IMAGE_DOMAIN}/hero.jpg`)).toEqual({
      error: expect.stringContaining('HTTPS'),
    });
  });

  it('rejects a foreign domain', () => {
    expect(validateHeroImageUrl('https://evil.com/hero.jpg')).toEqual({
      error: expect.stringContaining(HERO_IMAGE_DOMAIN),
    });
  });

  it('rejects a look-alike domain that only ends with the brand as a substring', () => {
    // notopera-orchestre-montpellier.fr must NOT match; ".domain" suffix check guards this.
    expect(validateHeroImageUrl('https://xopera-orchestre-montpellier.fr/hero.jpg')).toEqual({
      error: expect.stringContaining(HERO_IMAGE_DOMAIN),
    });
  });

  it('rejects a domain that embeds the brand as a subdomain of another host', () => {
    expect(
      validateHeroImageUrl('https://opera-orchestre-montpellier.fr.evil.com/hero.jpg'),
    ).toEqual({ error: expect.stringContaining(HERO_IMAGE_DOMAIN) });
  });
});
