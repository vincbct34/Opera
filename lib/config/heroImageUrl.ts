/**
 * Hero image URL validation.
 *
 * The homepage hero image is provided as an external URL (rather than an
 * uploaded file). To prevent embedding arbitrary third-party or malicious
 * content, the URL must be HTTPS and hosted on the Opera domain or one of its
 * subdomains. This is enforced server-side and mirrored in the CSP img-src
 * directive (see next.config.ts).
 */

/** The only domain (and its subdomains) allowed to host the hero image. */
export const HERO_IMAGE_DOMAIN = 'opera-orchestre-montpellier.fr';

export type HeroImageUrlResult = { url: string } | { error: string };

/**
 * Validates and normalizes a hero image URL.
 * @param input - The candidate URL (unknown type; comes straight from the request body).
 * @returns `{ url }` with the normalized URL on success, or `{ error }` with a
 *          user-facing French message on failure.
 */
export function validateHeroImageUrl(input: unknown): HeroImageUrlResult {
  if (typeof input !== 'string' || input.trim() === '') {
    return { error: "L'URL de l'image est requise" };
  }

  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return { error: 'URL invalide' };
  }

  if (parsed.protocol !== 'https:') {
    return { error: "L'URL doit utiliser HTTPS" };
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== HERO_IMAGE_DOMAIN && !host.endsWith(`.${HERO_IMAGE_DOMAIN}`)) {
    return {
      error: `L'URL doit pointer vers ${HERO_IMAGE_DOMAIN} ou un de ses sous-domaines`,
    };
  }

  return { url: parsed.toString() };
}
