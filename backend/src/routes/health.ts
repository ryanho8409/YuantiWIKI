import { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    try {
      // simple DB ping via Prisma if available
      // @ts-ignore prisma will be decorated by plugin at runtime
      if (app.prisma) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await app.prisma.$queryRaw`SELECT 1`;
      }
      return { status: 'ok' };
    } catch (e) {
      app.log.error(e);
      return { status: 'error' };
    }
  });
}

