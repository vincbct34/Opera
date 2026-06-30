/**
 * Jest setup file
 * Adds necessary polyfills for the test environment
 */

import { TextEncoder, TextDecoder } from 'util';

/*
  This file runs only in the Jest test environment. We avoid augmenting the
  global `fetch` type here because that would affect the whole project
  (TypeScript picks up declarations in included files). Instead we cast to
  `any` when assigning a minimal polyfill so we don't change global types.
*/

// Keep TextEncoder/TextDecoder typings minimal to avoid TS complaints when
// assigning the util implementations to the global object.
declare global {
  var TextEncoder: typeof TextEncoder;
  var TextDecoder: typeof TextDecoder;
}

// Polyfill for TextEncoder/TextDecoder (needed for Prisma in Jest)
// Use a safe unknown-cast when assigning to globals so TypeScript's
// stricter DOM/Node typings don't conflict with the util exports.
(globalThis as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder = TextEncoder;
(globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder = TextDecoder;

// Polyfill for fetch (needed for Prisma Accelerate in Jest)
// Assign a simple async function to global.fetch. Tests that need
// jest mock features should set up their own mocks in test files.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).fetch = async () => ({
  ok: true,
  json: async () => ({}),
});

// Polyfill for Request/Response (needed for Next.js in Jest)
// Use Node's built-in fetch implementation if available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).Request === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Request = class {
    constructor(
      url: string,
      options?: {
        headers?: Record<string, string>;
        method?: string;
        body?: unknown;
      },
    ) {
      this.url = url;
      this.headers = new Map(Object.entries(options?.headers || {}));
      this.method = options?.method || 'GET';
    }

    url: string;
    headers: Map<string, string>;
    method: string;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).Response === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Response = class {
    constructor(
      body?: Record<string, unknown> | null,
      init?: {
        status?: number;
        statusText?: string;
        headers?: Record<string, string>;
      },
    ) {
      this.body = body;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      this.headers = new Map(Object.entries(init?.headers || {}));
    }

    body?: unknown;
    status: number;
    statusText: string;
    headers: Map<string, string>;

    json() {
      return Promise.resolve(this.body || {});
    }

    text() {
      return Promise.resolve('');
    }

    static json(data: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new (globalThis as any).Response(data, init);
    }
  };
}

// Ensure React.act exists for Testing Library compatibility with React 19

import * as reactTestUtils from 'react-dom/test-utils';
// Patch global React export with act for libraries that read React.act

import * as actualReact from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = { ...actualReact, act: reactTestUtils.act };
// Inform Testing Library that we're in an act-enabled environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
