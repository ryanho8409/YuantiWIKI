import fp from 'fastify-plugin';
import { verifyToken, type JwtPayload } from '../lib/auth';

export default fp(async (app) => {
  app.decorateRequest('user', null as JwtPayload | null);

  app.addHook('preHandler', async (request) => {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
    request.user = token ? verifyToken(token) : null;
  });
});

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload | null;
  }
}
