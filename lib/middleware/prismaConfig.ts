/**
 * Prisma Client Configuration.
 * Initializes the Prisma client using the connection string from DATABASE_URL.
 * Ensures a single instance of Prisma Client is used in development to prevent connection exhaustion.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
