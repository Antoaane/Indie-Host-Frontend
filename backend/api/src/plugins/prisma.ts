import fp from 'fastify-plugin';
import { env } from '../config/env.js';
import { createPrismaClient } from '../lib/prismaClient.js';

const prisma = createPrismaClient(env.DATABASE_URL);

export const prismaPlugin = fp(async (fastify) => {
  await prisma.$connect();

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
