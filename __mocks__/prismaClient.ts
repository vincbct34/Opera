/**
 * Jest runtime stub for the generated Prisma v7 client.
 *
 * The real `app/generated/prisma/client.ts` uses `import.meta.url`, which is
 * invalid under ts-jest's CommonJS transform ("Cannot use 'import.meta' outside
 * a module"). Unit tests never need a real client — they mock
 * `@/lib/middleware/prismaConfig` — so we only need to provide the runtime
 * surface that source code references from the client module: the `Prisma`
 * namespace sentinels and a `PrismaClient` placeholder. All TS types are erased
 * at transpile time and resolved against the real client via tsconfig paths.
 */

export const Prisma = {
  JsonNull: 'JsonNull',
  DbNull: 'DbNull',
  AnyNull: 'AnyNull',
} as const;

export class PrismaClient {}
