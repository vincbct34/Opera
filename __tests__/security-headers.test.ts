/**
 * Security Headers Test
 *
 * This test verifies that all required security headers are properly configured
 * in next.config.ts and will be applied to all routes.
 */

import nextConfig from '../next.config';
import { describe, expect, it } from '@jest/globals';

describe('Security Headers Configuration', () => {
  it('should have headers configuration', async () => {
    expect(nextConfig.headers).toBeDefined();
    expect(typeof nextConfig.headers).toBe('function');
  });

  it('should return security headers for all paths', async () => {
    if (!nextConfig.headers) {
      throw new Error('Headers configuration not found');
    }

    const headers = await nextConfig.headers();

    expect(headers).toBeDefined();
    expect(Array.isArray(headers)).toBe(true);
    expect(headers.length).toBeGreaterThan(0);

    // Check that headers apply to all paths
    const allPathsConfig = headers.find((h) => h.source === '/:path*');
    expect(allPathsConfig).toBeDefined();
  });

  it('should include all critical security headers', async () => {
    if (!nextConfig.headers) {
      throw new Error('Headers configuration not found');
    }

    const headers = await nextConfig.headers();
    const allPathsConfig = headers.find((h) => h.source === '/:path*');

    if (!allPathsConfig) {
      throw new Error('All paths configuration not found');
    }

    const headerKeys = allPathsConfig.headers.map((h) => h.key);

    // Critical security headers
    const requiredHeaders = [
      'Strict-Transport-Security',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Content-Security-Policy',
      'Referrer-Policy',
      'Permissions-Policy',
    ];

    requiredHeaders.forEach((headerName) => {
      expect(headerKeys).toContain(headerName);
    });
  });

  it('should have HSTS header with proper configuration', async () => {
    if (!nextConfig.headers) {
      throw new Error('Headers configuration not found');
    }

    const headers = await nextConfig.headers();
    const allPathsConfig = headers.find((h) => h.source === '/:path*');

    if (!allPathsConfig) {
      throw new Error('All paths configuration not found');
    }

    const hstsHeader = allPathsConfig.headers.find((h) => h.key === 'Strict-Transport-Security');

    expect(hstsHeader).toBeDefined();
    expect(hstsHeader?.value).toContain('max-age=');
    expect(hstsHeader?.value).toContain('includeSubDomains');
  });

  it('should have X-Frame-Options to prevent clickjacking', async () => {
    if (!nextConfig.headers) {
      throw new Error('Headers configuration not found');
    }

    const headers = await nextConfig.headers();
    const allPathsConfig = headers.find((h) => h.source === '/:path*');

    if (!allPathsConfig) {
      throw new Error('All paths configuration not found');
    }

    const frameOptions = allPathsConfig.headers.find((h) => h.key === 'X-Frame-Options');

    expect(frameOptions).toBeDefined();
    expect(['DENY', 'SAMEORIGIN']).toContain(frameOptions?.value);
  });

  it('should have X-Content-Type-Options to prevent MIME sniffing', async () => {
    if (!nextConfig.headers) {
      throw new Error('Headers configuration not found');
    }

    const headers = await nextConfig.headers();
    const allPathsConfig = headers.find((h) => h.source === '/:path*');

    if (!allPathsConfig) {
      throw new Error('All paths configuration not found');
    }

    const contentTypeOptions = allPathsConfig.headers.find(
      (h) => h.key === 'X-Content-Type-Options',
    );

    expect(contentTypeOptions).toBeDefined();
    expect(contentTypeOptions?.value).toBe('nosniff');
  });

  it('should have CSP header with secure defaults', async () => {
    if (!nextConfig.headers) {
      throw new Error('Headers configuration not found');
    }

    const headers = await nextConfig.headers();
    const allPathsConfig = headers.find((h) => h.source === '/:path*');

    if (!allPathsConfig) {
      throw new Error('All paths configuration not found');
    }

    const csp = allPathsConfig.headers.find((h) => h.key === 'Content-Security-Policy');

    expect(csp).toBeDefined();
    expect(csp?.value).toContain("default-src 'self'");
    expect(csp?.value).toContain('object-src');
    expect(csp?.value).toContain('frame-ancestors');
  });

  it('should have Referrer-Policy configured', async () => {
    if (!nextConfig.headers) {
      throw new Error('Headers configuration not found');
    }

    const headers = await nextConfig.headers();
    const allPathsConfig = headers.find((h) => h.source === '/:path*');

    if (!allPathsConfig) {
      throw new Error('All paths configuration not found');
    }

    const referrerPolicy = allPathsConfig.headers.find((h) => h.key === 'Referrer-Policy');

    expect(referrerPolicy).toBeDefined();
    expect(referrerPolicy?.value).toBeTruthy();
  });

  it('should have Permissions-Policy to restrict browser features', async () => {
    if (!nextConfig.headers) {
      throw new Error('Headers configuration not found');
    }

    const headers = await nextConfig.headers();
    const allPathsConfig = headers.find((h) => h.source === '/:path*');

    if (!allPathsConfig) {
      throw new Error('All paths configuration not found');
    }

    const permissionsPolicy = allPathsConfig.headers.find((h) => h.key === 'Permissions-Policy');

    expect(permissionsPolicy).toBeDefined();
    // Should restrict camera, microphone, geolocation
    expect(permissionsPolicy?.value).toContain('camera=()');
    expect(permissionsPolicy?.value).toContain('microphone=()');
    expect(permissionsPolicy?.value).toContain('geolocation=()');
  });

  it('should allow images from Opera website in CSP', async () => {
    if (!nextConfig.headers) {
      throw new Error('Headers configuration not found');
    }

    const headers = await nextConfig.headers();
    const allPathsConfig = headers.find((h) => h.source === '/:path*');

    if (!allPathsConfig) {
      throw new Error('All paths configuration not found');
    }

    const csp = allPathsConfig.headers.find((h) => h.key === 'Content-Security-Policy');

    expect(csp).toBeDefined();
    expect(csp?.value).toContain('opera-orchestre-montpellier.fr');
  });

  it('should allow fonts from Google Fonts in CSP', async () => {
    if (!nextConfig.headers) {
      throw new Error('Headers configuration not found');
    }

    const headers = await nextConfig.headers();
    const allPathsConfig = headers.find((h) => h.source === '/:path*');

    if (!allPathsConfig) {
      throw new Error('All paths configuration not found');
    }

    const csp = allPathsConfig.headers.find((h) => h.key === 'Content-Security-Policy');

    expect(csp).toBeDefined();
    expect(csp?.value).toContain('fonts.googleapis.com');
    expect(csp?.value).toContain('fonts.gstatic.com');
  });
});
