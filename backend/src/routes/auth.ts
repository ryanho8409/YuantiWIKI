import { FastifyInstance } from 'fastify';
import { compare } from 'bcryptjs';
import { signToken } from '../lib/auth';

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post<{
    Body: { username?: string; password?: string };
  }>('/auth/login', async (request, reply) => {
    const { username, password } = request.body ?? {};
    if (!username || !password) {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: '用户名和密码为必填项',
      });
    }
    const user = await app.prisma.user.findUnique({ where: { username } });
    if (!user) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: '用户名或密码错误',
      });
    }
    const ok = await compare(password, user.passwordHash);
    if (!ok) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: '用户名或密码错误',
      });
    }
    const token = signToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });
    return { token, user: { id: user.id, username: user.username, role: user.role } };
  });

  app.get('/auth/me', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: '缺少或无效的令牌',
      });
    }
    return {
      id: request.user.id,
      username: request.user.username,
      role: request.user.role,
    };
  });

  app.post('/auth/logout', async (_, reply) => {
    // 服务端无状态，由前端丢弃 token 即可
    return reply.status(204).send();
  });
}
