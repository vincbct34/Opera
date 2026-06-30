/**
 * Validation utilities for French-specific data formats.
 * Includes postal codes, phone numbers, and other French standards.
 */

/**
 * Validate French postal code format.
 * Format: 5 digits (e.g., 34000, 75001).
 * @param postalCode - Postal code to validate.
 * @returns True if valid French postal code.
 */
export function isValidFrenchPostalCode(postalCode: string): boolean {
  // Remove spaces and trim
  const cleaned = postalCode.replace(/\s/g, '').trim();

  // Check if it's exactly 5 digits
  const postalCodeRegex = /^[0-9]{5}$/;
  return postalCodeRegex.test(cleaned);
}

/**
 * Validate French phone number format.
 * Accepts various formats:
 * - 0612345678
 * - 06 12 34 56 78
 * - 06-12-34-56-78
 * - +33612345678
 * - +33 6 12 34 56 78
 * @param phoneNumber - Phone number to validate.
 * @returns True if valid French phone number.
 */
export function isValidFrenchPhoneNumber(phoneNumber: string): boolean {
  // Remove all spaces, hyphens, parentheses, and dots
  const cleaned = phoneNumber.replace(/[\s\-().]/g, '');

  // French mobile phone: starts with 06 or 07 (10 digits total)
  const mobileRegex = /^0[67][0-9]{8}$/;

  // French landline: starts with 01-05 or 09 (10 digits total)
  const landlineRegex = /^0[1-5,9][0-9]{8}$/;

  // International format: +33 followed by 9 digits
  const internationalRegex = /^\+33[1-9][0-9]{8}$/;

  return (
    mobileRegex.test(cleaned) || landlineRegex.test(cleaned) || internationalRegex.test(cleaned)
  );
}

/**
 * Validate email address format.
 * @param email - Email address to validate.
 * @returns True if valid email format.
 */
export function isValidEmail(email: string): boolean {
  // RFC 5322 compliant email regex (simplified version)
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email.trim());
}

/**
 * Format a French postal code (add space after 2 first digits if needed).
 * @param postalCode - Postal code to format.
 * @returns Formatted postal code or original if invalid.
 */
export function formatFrenchPostalCode(postalCode: string): string {
  const cleaned = postalCode.replace(/\s/g, '').trim();

  if (isValidFrenchPostalCode(cleaned)) {
    // Some prefer it without space, so just return cleaned version
    return cleaned;
  }

  return postalCode;
}

/**
 * Format a French phone number to standard format (06 12 34 56 78).
 * @param phoneNumber - Phone number to format.
 * @returns Formatted phone number or original if invalid.
 */
export function formatFrenchPhoneNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/[\s\-().]/g, '');

  if (isValidFrenchPhoneNumber(phoneNumber)) {
    // Handle international format
    if (cleaned.startsWith('+33')) {
      const national = '0' + cleaned.substring(3);
      return national.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    }

    // National format
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    }
  }

  return phoneNumber;
}

/**
 * Get the department code from a French postal code.
 * @param postalCode - French postal code.
 * @returns Department code (2 or 3 digits) or null if invalid.
 */
export function getDepartmentFromPostalCode(postalCode: string): string | null {
  const cleaned = postalCode.replace(/\s/g, '').trim();

  if (!isValidFrenchPostalCode(cleaned)) {
    return null;
  }

  // Corsica special case (2A, 2B)
  if (cleaned.startsWith('20')) {
    const code = parseInt(cleaned.substring(2, 3));
    if (code >= 0 && code <= 1) {
      return '2A'; // Corse-du-Sud
    } else {
      return '2B'; // Haute-Corse
    }
  }

  // Overseas territories (3 digits)
  if (cleaned.startsWith('97') || cleaned.startsWith('98')) {
    return cleaned.substring(0, 3);
  }

  // Metropolitan France (2 digits)
  return cleaned.substring(0, 2);
}
