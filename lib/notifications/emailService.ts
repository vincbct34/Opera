import { randomBytes } from 'crypto';
import { getServerBaseUrl } from '../utils/getBaseUrl';
import { logger } from '../middleware/logger';

/**
 * Options for sending an email using SMTP2GO Templates.
 */
interface EmailOptions {
  to: string;
  template_id: string; // The ID of the SMTP2GO template
  template_data: Record<string, unknown>; // Key-value pairs for template variables
  sender?: string; // Optional sender override
  custom_headers?: Array<{ header: string; value: string }>;
}

/**
 * Options for sending a direct email (without template) using SMTP2GO API.
 */
interface DirectEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  sender?: string; // Optional sender override
  custom_headers?: Array<{ header: string; value: string }>;
}

const SMTP2GO_API_URL = 'https://api.smtp2go.com/v3/email/send';

// Placeholder for templates that haven't been created yet
export const TODO_TEMPLATE_ID = 'TODO_TEMPLATE_ID';

/**
 * Sends an email with automatic retry on failure.
 * Uses SMTP2GO API via fetch with Server-Side Templates.
 * @param options - Email options (recipient, template_id, template_data).
 * @param retries - Number of remaining retries (default: 3).
 * @returns true if the email was sent successfully, false otherwise.
 */
export async function sendEmail(options: EmailOptions, retries = 3): Promise<boolean> {
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'incriptions@opera-orchestre-montpellier.fr';
  const fromName = process.env.SMTP_FROM_NAME || 'Opéra Orchestre national de Montpellier';
  const apiKey = process.env.SMTP2GO_API_KEY;

  if (!apiKey) {
    logger.error('SMTP2GO_API_KEY is not defined in environment variables.');
    return false;
  }

  // Construct the exact payload format required by SMTP2GO
  const payload = {
    api_key: apiKey,
    to: [options.to],
    sender: options.sender || `"${fromName}" <${fromEmail}>`,
    template_id: options.template_id,
    template_data: options.template_data,
    custom_headers: options.custom_headers,
  };

  try {
    const response = await fetch(SMTP2GO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`SMTP2GO API Error: ${data.data?.error || response.statusText}`);
    }

    logger.info(`Email envoyé avec succès à ${options.to} (Template: ${options.template_id})`);
    return true;
  } catch (error) {
    logger.error(
      `Erreur lors de l'envoi de l'email (tentatives restantes: ${retries - 1}):`,
      error,
    );

    // Retry avec backoff exponentiel si des tentatives restent
    if (retries > 1) {
      const delay = (4 - retries) * 2000; // 2s, 4s
      logger.info(`Nouvelle tentative dans ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return sendEmail(options, retries - 1);
    }

    return false;
  }
}

/**
 * Sends a direct email without using a template.
 * Uses SMTP2GO API with HTML content.
 * @param options - Direct email options (recipient, subject, htmlContent).
 * @param retries - Number of remaining retries (default: 3).
 * @returns true if the email was sent successfully, false otherwise.
 */
export async function sendDirectEmail(options: DirectEmailOptions, retries = 3): Promise<boolean> {
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'incriptions@opera-orchestre-montpellier.fr';
  const fromName = process.env.SMTP_FROM_NAME || 'Opéra Orchestre national de Montpellier';
  const apiKey = process.env.SMTP2GO_API_KEY;

  if (!apiKey) {
    logger.error('SMTP2GO_API_KEY is not defined in environment variables.');
    return false;
  }

  // Construct the payload format required by SMTP2GO for direct emails
  const payload = {
    api_key: apiKey,
    to: [options.to],
    sender: options.sender || `"${fromName}" <${fromEmail}>`,
    subject: options.subject,
    html: options.htmlContent,
    custom_headers: options.custom_headers,
  };

  try {
    const response = await fetch(SMTP2GO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`SMTP2GO API Error: ${data.data?.error || response.statusText}`);
    }

    logger.info(`Email envoyé avec succès à ${options.to} (Subject: ${options.subject})`);
    return true;
  } catch (error) {
    logger.error(
      `Erreur lors de l'envoi de l'email (tentatives restantes: ${retries - 1}):`,
      error,
    );

    // Retry avec backoff exponentiel si des tentatives restent
    if (retries > 1) {
      const delay = (4 - retries) * 2000; // 2s, 4s
      logger.info(`Nouvelle tentative dans ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return sendDirectEmail(options, retries - 1);
    }

    return false;
  }
}

/**
 * Resets the client (No-op in API implementation, kept for compatibility)
 * @internal
 */
export function resetClient(): void {
  // No persistent client to reset for fetch
}

/**
 * Generates a secure random token for email verification.
 * Uses crypto.randomBytes for cryptographic security.
 * @returns A 64-character hexadecimal string token.
 */
export function generateEmailVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generates the full URL for email verification.
 * @param token - The verification token.
 * @returns The complete verification URL.
 */
export function generateVerificationUrl(token: string): string {
  // Centralized base URL logic
  const baseUrl = getServerBaseUrl();
  return `${baseUrl}/auth/verify-email?token=${token}`;
}

/**
 * Checks if a user needs to verify their email.
 * @param user - The user object containing the verification token.
 * @returns true if verification is required, false otherwise.
 */
export function isEmailVerificationRequired(user: {
  email_verification_token: string | null;
}): boolean {
  return user.email_verification_token !== null;
}

/**
 * Sends a password reset email to the user.
 * @param to - Recipient email address.
 * @param resetUrl - The password reset URL.
 * @returns true if the email was sent successfully.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  return sendEmail({
    to,
    template_id: '3020715',
    template_data: {
      reset_url: resetUrl,
      unsubscribe_url: `${getServerBaseUrl()}/account`,
    },
  });
}
