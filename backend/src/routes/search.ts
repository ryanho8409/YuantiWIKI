import { FastifyInstance } from 'fastify';

function requireAuth(request: { user: unknown }, reply: any): boolean {
  if (!(request as any).user) {
    reply.status(401).send({
      code: 'UNAUTHORIZED',
      message: '缺少或无效的令牌',
    });
    return false;
  }
  return true;
}

function extractTextFromTiptapJson(doc: unknown): string {
  let out = '';

  const walk = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    if (typeof node !== 'object') return;

    const anyNode = node as any;
    if (anyNode.type === 'text' && typeof anyNode.text === 'string') {
      out += anyNode.text;
    }
    for (const k of Object.keys(anyNode)) {
      walk(anyNode[k]);
    }
  };

  walk(doc);
  return out;
}

function makeExcerpt(text: string, query: string): string {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = t.indexOf(q);
  if (idx === -1) return text.slice(0, 140);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + q.length + 80);
  return text.slice(start, end);
}

export async function registerSearchRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { q?: string };
  }>('/search', async (request, reply) => {
    if (!requireAuth(request as any, reply)) return;
    const q = (request.query?.q ?? '').trim();
    if (!q) {
      reply.status(400).send({ code: 'BAD_REQUEST', message: '搜索关键词不能为空' });
      return;
    }

    const user = (request as any).user as { id: string; role?: string };
    const qLower = q.toLowerCase();

    const spaces = user.role === 'system_admin'
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

    const spaceIdSet = new Set(spaces.map((s) => s.id));
    const spaceNameById = new Map(spaces.map((s) => [s.id, s.name] as const));

    const pages = await app.prisma.page.findMany({
      where: {
        spaceId: { in: Array.from(spaceIdSet) },
        deletedAt: null,
      },
      select: { id: true, spaceId: true, title: true, content: true },
    });

    const results = pages
      .map((p) => {
        const text = extractTextFromTiptapJson(p.content).trim();
        if (!text) return null;
        if (!text.toLowerCase().includes(qLower)) return null;
        const excerpt = makeExcerpt(text, q);
        const path = `${spaceNameById.get(p.spaceId) ?? '知识库'} / ${p.title}`;
        return {
          spaceId: p.spaceId,
          pageId: p.id,
          title: p.title,
          path,
          excerpt,
        };
      })
      .filter(Boolean) as Array<{
      spaceId: string;
      pageId: string;
      title: string;
      path: string;
      excerpt: string;
    }>;

    // 简单排序：优先标题命中，其次按 excerpt 命中位置（近似）
    results.sort((a, b) => {
      const aHitTitle = a.title.toLowerCase().includes(qLower) ? 0 : 1;
      const bHitTitle = b.title.toLowerCase().includes(qLower) ? 0 : 1;
      return aHitTitle - bHitTitle;
    });

    return { query: q, count: results.length, results };
  });
}

