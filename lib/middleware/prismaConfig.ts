/**
 * Prisma Client Configuration.
 * Initializes the Prisma client over a Direct TCP connection using the
 * node-postgres driver adapter (required by Prisma v7's Rust-free client).
 * Ensures a single instance of Prisma Client is used in development to prevent connection exhaustion.
 */

import { PrismaClient } from '@/app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
