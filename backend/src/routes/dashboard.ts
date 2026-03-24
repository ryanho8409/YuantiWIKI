import { FastifyInstance } from 'fastify';

type AuthUser = { id: string; role?: string };

function requireAuth(request: { user: unknown }, reply: any): request is { user: AuthUser } {
  if (!(request as any).user) {
    reply.status(401).send({
      code: 'UNAUTHORIZED',
      message: '缺少或无效的令牌',
    });
    return false;
  }
  return true;
}

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get('/dashboard', async (request, reply) => {
    if (!requireAuth(request as any, reply)) return;

    const user = (request as any).user as AuthUser;
    const visibleSpaces =
      user.role === 'system_admin'
        ? await app.prisma.space.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true },
          })
        : await app.prisma.space.findMany({
            where: {
              deletedAt: null,
              permissions: {
                some: {
                  subjectType: 'user',
                  subjectId: user.id,
                  permission: { in: ['read', 'write', 'admin'] },
                },
              },
            },
            select: { id: true, name: true },
          });

    const spaceIds = visibleSpaces.map((s) => s.id);
    const spaceNameById = new Map(visibleSpaces.map((s) => [s.id, s.name] as const));
    if (spaceIds.length === 0) {
      return {
        stats: { totalSpaces: 0, totalPages: 0, edits7d: 0 },
        recentUpdated: [],
        recentCreated: [],
      };
    }

    const [totalPages, edits7d, recentUpdatedRows, recentCreatedRows] = await Promise.all([
      app.prisma.page.count({
        where: { deletedAt: null, spaceId: { in: spaceIds } },
      }),
      app.prisma.pageVersion.count({
        where: {
          page: { deletedAt: null, spaceId: { in: spaceIds } },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      app.prisma.page.findMany({
        where: { deletedAt: null, spaceId: { in: spaceIds } },
        orderBy: [{ updatedAt: 'desc' }],
        take: 8,
        select: { id: true, title: true, spaceId: true, updatedAt: true },
      }),
      app.prisma.page.findMany({
        where: { deletedAt: null, spaceId: { in: spaceIds } },
        orderBy: [{ createdAt: 'desc' }],
        take: 8,
        select: { id: true, title: true, spaceId: true, createdAt: true },
      }),
    ]);

    return {
      stats: {
        totalSpaces: visibleSpaces.length,
        totalPages,
        edits7d,
      },
      recentUpdated: recentUpdatedRows.map((row) => ({
        pageId: row.id,
        spaceId: row.spaceId,
        title: row.title,
        spaceName: spaceNameById.get(row.spaceId) ?? '',
        updatedAt: row.updatedAt,
      })),
      recentCreated: recentCreatedRows.map((row) => ({
        pageId: row.id,
        spaceId: row.spaceId,
        title: row.title,
        spaceName: spaceNameById.get(row.spaceId) ?? '',
        createdAt: row.createdAt,
      })),
    };
  });
}

