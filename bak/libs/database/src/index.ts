import { PrismaClient } from './@generated/prisma-client';

const prismaClient = new PrismaClient();

export type {
  Prisma as PrismaType,
  PrismaClient as PrismaClientType,
  Round as RoundType,
} from './@generated/prisma-client';

export { prismaClient };

export * as Prisma from './@generated/prisma-client';
export { Prisma as prisma } from './@generated/prisma-client';
