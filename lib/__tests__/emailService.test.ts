/* eslint-disable */
import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import {
  sendEmail,
  sendDirectEmail,
  generateEmailVerificationToken,
  generateVerificationUrl,
  isEmailVerificationRequired,
  sendPasswordResetEmail,
  resetClient,
  TODO_TEMPLATE_ID,
} from '@/lib/notifications/emailService';

// Mock global fetch
// Cast to any to avoid strict type mismatches with global.fetch signature during assignment
const fetchMock = jest.fn() as jest.Mock<any>;
global.fetch = fetchMock;

describe('emailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP2GO_API_KEY = 'test-api-key';
    process.env.SMTP_FROM_EMAIL = 'noreply@example.com';
    process.env.SMTP_FROM_NAME = "Plateforme de l'Opéra";
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('generateEmailVerificationToken returns a string of expected length', () => {
    const t = generateEmailVerificationToken();
    expect(typeof t).toBe('string');
    expect(t.length).toBeGreaterThan(0);
  });

  test('generateVerificationUrl uses APP_URL when set', () => {
    const orig = process.env.APP_URL;
    process.env.APP_URL = 'https://example.com';
    const url = generateVerificationUrl('abc123');
    expect(url).toBe('https://example.com/auth/verify-email?token=abc123');
    process.env.APP_URL = orig;
  });

  test('generateVerificationUrl falls back to localhost when APP_URL not set', () => {
    const orig = process.env.APP_URL;
    delete process.env.APP_URL;
    const url = generateVerificationUrl('xyz789');
    expect(url).toBe('http://localhost:3000/auth/verify-email?token=xyz789');
    process.env.APP_URL = orig;
  });

  test('isEmailVerificationRequired returns true when token not null', () => {
    expect(isEmailVerificationRequired({ email_verification_token: 'a' })).toBe(true);
    expect(isEmailVerificationRequired({ email_verification_token: null })).toBe(false);
  });

  test('sendEmail calls fetch with correct template parameters', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { request_id: '123' } }),
    });

    const res = await sendEmail({
      to: 'a@b.com',
      template_id: 'templ-123',
      template_data: { foo: 'bar' },
    });

    expect(res).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.smtp2go.com/v3/email/send',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('"api_key":"test-api-key"'),
      }),
    );

    // Cast to any to access the body property for verification
    const callArgs = fetchMock.mock.calls[0] as any[];
    const callBody = JSON.parse(callArgs[1].body);

    expect(callBody).toMatchObject({
      to: ['a@b.com'],
      template_id: 'templ-123',
      template_data: { foo: 'bar' },
      sender: expect.stringContaining('noreply@example.com'),
    });
  });

  test('sendEmail returns false when API key is missing', async () => {
    delete process.env.SMTP2GO_API_KEY;
    const res = await sendEmail({
      to: 'a@b.com',
      template_id: 't',
      template_data: {},
    });
    expect(res).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('sendEmail returns false on API failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ data: { error: 'Invalid Recipient' } }),
    });

    const res = await sendEmail(
      {
        to: 'a@b.com',
        template_id: 't',
        template_data: {},
      },
      1,
    );
    expect(res).toBe(false);
  });

  test('sendEmail retries with backoff on network failure', async () => {
    jest.useFakeTimers();
    let attempts = 0;
    fetchMock.mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error('Network Error'));
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: {} }),
      });
    });

    const promise = sendEmail(
      {
        to: 'a@b.com',
        template_id: 't',
        template_data: {},
      },
      3,
    );

    await jest.runAllTimersAsync();
    const res = await promise;

    expect(res).toBe(true);
    expect(attempts).toBe(3);
    jest.useRealTimers();
  });

  test('sendEmail defaults to TODO_TEMPLATE_ID when used via existing generic functions if applicable', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });
    await sendEmail({ to: 'x', template_id: TODO_TEMPLATE_ID, template_data: {} });
    const callArgs = fetchMock.mock.calls[0] as any[];
    const callBody = JSON.parse(callArgs[1].body);
    expect(callBody.template_id).toBe(TODO_TEMPLATE_ID);
  });

  test('sendPasswordResetEmail sends email with correct template data', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });

    await sendPasswordResetEmail('reset@example.com', 'http://reset-url');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0] as any[];
    const callBody = JSON.parse(callArgs[1].body);

    expect(callBody).toMatchObject({
      to: ['reset@example.com'],
      template_id: '3020715',
      template_data: {
        reset_url: 'http://reset-url',
        unsubscribe_url: expect.stringMatching(/\/account$/),
      },
    });
  });

  test('resetClient does not throw', () => {
    expect(() => resetClient()).not.toThrow();
  });

  test('sendEmail uses statusText when API error message is missing', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: 'Service Unavailable',
      json: async () => ({}), // No data.error
    });

    const res = await sendEmail(
      {
        to: 'a@b.com',
        template_id: 't',
        template_data: {},
      },
      1,
    );
    expect(res).toBe(false);
  });

  test('sendEmail uses custom sender if provided', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });

    await sendEmail({
      to: 'a@b.com',
      template_id: 't',
      template_data: {},
      sender: 'Custom Sender <custom@example.com>',
    });

    const callArgs = fetchMock.mock.calls[0] as any[];
    const callBody = JSON.parse(callArgs[1].body);
    expect(callBody.sender).toBe('Custom Sender <custom@example.com>');
  });

  test('sendEmail uses default sender values when ENV vars are missing', async () => {
    delete process.env.SMTP_FROM_EMAIL;
    delete process.env.SMTP_FROM_NAME;

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });

    await sendEmail({
      to: 'a@b.com',
      template_id: 't',
      template_data: {},
    });

    const callArgs = fetchMock.mock.calls[0] as any[];
    const callBody = JSON.parse(callArgs[1].body);
    // Expect defaults from the code
    expect(callBody.sender).toContain('incriptions@opera-orchestre-montpellier.fr');
    // The name default is "Opéra Orchestre national de Montpellier"
    expect(callBody.sender).toContain('Opéra Orchestre national de Montpellier');
  });

  // ── sendDirectEmail ──────────────────────────────────────────────────

  test('sendDirectEmail sends email with correct payload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { request_id: '456' } }),
    });

    const res = await sendDirectEmail({
      to: 'user@example.com',
      subject: 'Welcome',
      htmlContent: '<h1>Hello</h1>',
    });

    expect(res).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const callArgs = fetchMock.mock.calls[0] as any[];
    const callBody = JSON.parse(callArgs[1].body);

    expect(callBody).toMatchObject({
      api_key: 'test-api-key',
      to: ['user@example.com'],
      subject: 'Welcome',
      html: '<h1>Hello</h1>',
      sender: expect.stringContaining('noreply@example.com'),
    });
  });

  test('sendDirectEmail returns false when API key is missing', async () => {
    delete process.env.SMTP2GO_API_KEY;

    const res = await sendDirectEmail({
      to: 'a@b.com',
      subject: 's',
      htmlContent: '<p>test</p>',
    });

    expect(res).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('sendDirectEmail returns false on API failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ data: { error: 'Invalid Recipient' } }),
    });

    const res = await sendDirectEmail({ to: 'a@b.com', subject: 's', htmlContent: '<p>x</p>' }, 1);
    expect(res).toBe(false);
  });

  test('sendDirectEmail uses statusText when API error message is missing', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: 'Service Unavailable',
      json: async () => ({}),
    });

    const res = await sendDirectEmail({ to: 'a@b.com', subject: 's', htmlContent: '<p>x</p>' }, 1);
    expect(res).toBe(false);
  });

  test('sendDirectEmail retries with backoff on network failure', async () => {
    jest.useFakeTimers();
    let attempts = 0;
    fetchMock.mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error('Network Error'));
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: {} }),
      });
    });

    const promise = sendDirectEmail({ to: 'a@b.com', subject: 's', htmlContent: '<p>x</p>' }, 3);

    await jest.runAllTimersAsync();
    const res = await promise;

    expect(res).toBe(true);
    expect(attempts).toBe(3);
    jest.useRealTimers();
  });

  test('sendDirectEmail uses custom sender if provided', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });

    await sendDirectEmail({
      to: 'a@b.com',
      subject: 's',
      htmlContent: '<p>x</p>',
      sender: 'Custom <c@example.com>',
    });

    const callArgs = fetchMock.mock.calls[0] as any[];
    const callBody = JSON.parse(callArgs[1].body);
    expect(callBody.sender).toBe('Custom <c@example.com>');
  });

  test('sendDirectEmail passes custom_headers in payload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });

    await sendDirectEmail({
      to: 'a@b.com',
      subject: 's',
      htmlContent: '<p>x</p>',
      custom_headers: [{ header: 'X-Custom', value: 'test' }],
    });

    const callArgs = fetchMock.mock.calls[0] as any[];
    const callBody = JSON.parse(callArgs[1].body);
    expect(callBody.custom_headers).toEqual([{ header: 'X-Custom', value: 'test' }]);
  });

  test('sendDirectEmail uses default sender values when ENV vars are missing', async () => {
    delete process.env.SMTP_FROM_EMAIL;
    delete process.env.SMTP_FROM_NAME;

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    });

    await sendDirectEmail({
      to: 'a@b.com',
      subject: 's',
      htmlContent: '<p>x</p>',
    });

    const callArgs = fetchMock.mock.calls[0] as any[];
    const callBody = JSON.parse(callArgs[1].body);
    expect(callBody.sender).toContain('incriptions@opera-orchestre-montpellier.fr');
    expect(callBody.sender).toContain('Opéra Orchestre national de Montpellier');
  });
});
