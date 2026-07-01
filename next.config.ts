import type { NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  // Cap build/static-generation worker count.
  // Machine has 20 cores but limited RAM; unbounded workers peg every core.
  experimental: {
    cpus: 4,
  },

  images: {
    unoptimized: true,
    remotePatterns: [new URL('https://www.opera-orchestre-montpellier.fr/**')],
  },

  // Force HTTPS redirects in production
  async redirects() {
    // Only redirect HTTP to HTTPS in production
    // In development, we allow HTTP for localhost
    if (!isDevelopment) {
      return [
        {
          source: '/:path*',
          has: [
            {
              type: 'header',
              key: 'x-forwarded-proto',
              value: 'http',
            },
          ],
          destination: 'https://:host/:path*',
          permanent: true, // 308 redirect
        },
      ];
    }
    return [];
  },

  // Security Headers
  async headers() {
    // Build Content Security Policy
    // Note: Next.js requires 'unsafe-inline' and 'unsafe-eval' for framework functionality
    // See CSP_NONCE_RESEARCH.md for detailed explanation
    const cspDirectives = [
      "default-src 'self'",
      // Script policy: unsafe-inline required by Next.js/React for hydration
      // unsafe-eval only in development for HMR and source maps
      `script-src 'self' 'unsafe-inline' ${isDevelopment ? "'unsafe-eval'" : ''}`,
      // Style policy: unsafe-inline required for CSS-in-JS and Next.js
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Font policy
      "font-src 'self' https://fonts.gstatic.com data:",
      // Image policy: allow Opera website for event images
      "img-src 'self' https://www.opera-orchestre-montpellier.fr data: blob:",
      // Connect policy: allow API calls
      "connect-src 'self'",
      // Frame policy
      "frame-src 'self'",
      // Worker policy
      "worker-src 'self'",
      // Child policy
      "child-src 'self'",
      // Frame ancestors: prevent clickjacking
      "frame-ancestors 'self'",
      // Base URI
      "base-uri 'self'",
      // Form action
      "form-action 'self'",
      // Object policy: no plugins
      "object-src 'none'",
      // Upgrade insecure requests
      'upgrade-insecure-requests',
    ];

    // Add CSP violation reporting in production
    if (!isDevelopment) {
      cspDirectives.push('report-uri /api/csp-report');
    }

    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Content-Security-Policy',
            value: cspDirectives.join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
