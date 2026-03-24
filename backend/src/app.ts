import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import prismaPlugin from './plugins/prisma';
import authPlugin from './plugins/auth';
import { registerHealthRoutes } from './routes/health';
import { registerAuthRoutes } from './routes/auth';
import { registerSpaceRoutes } from './routes/spaces';
import { registerSpacePermissionRoutes } from './routes/space-permissions';
import { registerPageRoutes } from './routes/pages';
import { registerSearchRoutes } from './routes/search';
import { registerPagePermissionRoutes } from './routes/page-permissions';
import { registerAttachmentRoutes } from './routes/attachments';
import { registerAdminRoutes } from './routes/admin';
import { registerDashboardRoutes } from './routes/dashboard';

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  // 浏览器访问后端根地址时会自动请求 favicon，返回 204 避免无意义 404 噪音
  app.get('/favicon.ico', async (_, reply) => {
    return reply.status(204).send();
  });

  app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });
  app.register(prismaPlugin);
  app.register(authPlugin);
  app.register(registerHealthRoutes, { prefix: '/api' });
  app.register(registerAuthRoutes, { prefix: '/api/v1' });
  app.register(registerSpaceRoutes, { prefix: '/api/v1' });
  app.register(registerSpacePermissionRoutes, { prefix: '/api/v1' });
  app.register(registerPageRoutes, { prefix: '/api/v1' });
  app.register(registerSearchRoutes, { prefix: '/api/v1' });
  app.register(registerPagePermissionRoutes, { prefix: '/api/v1' });
  app.register(registerAttachmentRoutes, { prefix: '/api/v1' });
  app.register(registerAdminRoutes, { prefix: '/api/v1' });
  app.register(registerDashboardRoutes, { prefix: '/api/v1' });

  return app;
}

