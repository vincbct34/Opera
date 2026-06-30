/**
 * Prisma Client Configuration.
 * Initializes the Prisma client with Accelerate extension for improved performance.
 * Ensures a single instance of Prisma Client is used in development to prevent connection exhaustion.
 */

import { PrismaClient } from '@/app/generated/prisma';
import { withAccelerate } from '@prisma/extension-accelerate';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const prisma = globalForPrisma.prisma || new PrismaClient().$extends(withAccelerate());

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
