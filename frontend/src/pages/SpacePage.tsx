import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EditorContent, useEditor } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';

type SpacePermission = 'read' | 'write' | 'admin';

type PagePermissionChoice = 'inherit' | 'read' | 'write';

type PagePermissionMember = {
  userId: string;
  user?: { id: string; username: string; displayName?: string | null };
  spacePermission: SpacePermission;
  pagePermission: PagePermissionChoice;
};

type TocItem = {
  level: number;
  text: string;
  index: number;
};

type TocNode = TocItem & {
  children: TocNode[];
};

interface SpaceDetail {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  myPermission: SpacePermission;
}

interface SpaceListItem {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
}

interface PageNode {
  id: string;
  spaceId: string;
  parentId: string | null;
  title: string;
  sortOrder: number;
  children: PageNode[];
}

class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function apiFetch<T>(url: string, token: string | null, init?: RequestInit): Promise<T> {
  // 不要对无 body 的请求（如 GET、DELETE）强行加 application/json，否则 Fastify 会报：
  // "Body cannot be empty when content-type is set to 'application/json'"
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const hasBody = init?.body != null && init.body !== '';
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let message = `请求失败（${res.status}）`;
    let code: string | undefined;
    try {
      const payload = await res.json();
      if (payload?.message) message = payload.message;
      if (payload?.code) code = payload.code;
    } catch {
      // no-op
    }
    throw new ApiError(message, res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return '你没有权限执行该操作';
    if (err.status === 404) return '内容不存在或无访问权限';
    if (err.code === 'HAS_CHILDREN') {
      return '无法删除：该页面存在子页面，请先移动或删除子页面。';
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return '操作失败，请稍后重试';
}

function formatTimeHms(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const yy = String(d.getFullYear()).slice(-2);
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yy}-${mo}-${dd}  ${hh}:${mm}:${ss}`;
}

/** 保存前去掉图片 URL 中的 token，避免 JWT 写入正文 */
function stripAttachmentTokensFromDoc(doc: unknown): unknown {
  if (!doc || typeof doc !== 'object') return doc;
  const node = doc as Record<string, unknown>;
  const next: Record<string, unknown> = { ...node };
  if (next.type === 'image' && next.attrs && typeof next.attrs === 'object') {
    const attrs = { ...(next.attrs as Record<string, unknown>) };
    const src = attrs.src;
    if (typeof src === 'string' && src.includes('/api/v1/attachments/')) {
      try {
        const u = new URL(src, window.location.origin);
        u.searchParams.delete('token');
        attrs.src = u.pathname + (u.search ? u.search : '');
      } catch {
        // keep original
      }
    }
    next.attrs = attrs;
  }
  if (Array.isArray(next.content)) {
    next.content = next.content.map((c) => stripAttachmentTokensFromDoc(c));
  }
  return next;
}

function collectIdsWithChildren(nodes: PageNode[], out = new Set<string>()) {
  for (const n of nodes) {
    if (n.children.length > 0) {
      out.add(n.id);
      collectIdsWithChildren(n.children, out);
    }
  }
  return out;
}

function collectNodeText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { text?: unknown; content?: unknown };
  let out = typeof n.text === 'string' ? n.text : '';
  if (Array.isArray(n.content)) {
    for (const child of n.content) out += collectNodeText(child);
  }
  return out;
}

function extractTocItemsFromDoc(doc: unknown): TocItem[] {
  const result: TocItem[] = [];
  let index = 0;
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: unknown; attrs?: unknown; content?: unknown };
    if (n.type === 'heading') {
      const levelRaw = (n.attrs as { level?: unknown } | undefined)?.level;
      const level = typeof levelRaw === 'number' ? levelRaw : 1;
      const text = collectNodeText(n).trim() || '未命名标题';
      result.push({ level, text, index });
      index += 1;
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  };
  walk(doc);
  return result;
}

function buildTocTree(items: TocItem[]): TocNode[] {
  const roots: TocNode[] = [];
  const stack: TocNode[] = [];
  for (const item of items) {
    const node: TocNode = {
      ...item,
      // 目录最多展示到三级，避免深层级影响可读性
      level: Math.min(Math.max(item.level, 1), 3),
      children: [],
    };
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }
  return roots;
}

function firstPageIdFromTree(nodes: PageNode[]): string | null {
  if (!nodes.length) return null;
  return nodes[0]?.id ?? null;
}

type ContextMenuState = { x: number; y: number; node: PageNode } | null;

const SPACEBAR_RIGHTBAR_KEY = 'yuanti.wiki.spaceRightbarOpen';
const SPACE_LAST_VISIT_KEY = 'yuanti.wiki.spaceLastVisitMap';

function IconChevronRight() {
  return (
    <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="m10 7 5 5-5 5" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

function IconPanelOpen() {
  return (
    <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M15 3v18" />
      <path d="m10 9-3 3 3 3" />
    </svg>
  );
}

function IconPanelClose() {
  return (
    <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M15 3v18" />
      <path d="m7 9 3 3-3 3" />
    </svg>
  );
}

function IconBold() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 4h7a4 4 0 0 1 0 8H6z" /><path d="M6 12h8a4 4 0 0 1 0 8H6z" /></svg>;
}
function IconItalic() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></svg>;
}
function IconStrike() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M16 4H9a3 3 0 0 0-2.83 4" /><path d="M14 12a4 4 0 0 1 0 8H6" /><line x1="4" y1="12" x2="20" y2="12" /></svg>;
}
function IconParagraph() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M13 4v16" /><path d="M17 4v16" /><path d="M19 4H9a4 4 0 0 0 0 8h4" /></svg>;
}
function IconHeading1() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="M17 12h3" /><path d="M19 18V6" /></svg>;
}
function IconHeading2() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="M16 18h5" /><path d="M16 12a2.5 2.5 0 0 1 5 0c0 2-2 3-5 6" /></svg>;
}
function IconHeading3() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="M17 10a2 2 0 1 1 2-2" /><path d="M17 14a2 2 0 1 1 2 2" /></svg>;
}
function IconList() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;
}
function IconListOrdered() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3a1 1 0 0 0-2 0" /></svg>;
}
function IconQuote() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 21c3 0 7-1 7-8V5H4v8h6" /><path d="M14 21c3 0 7-1 7-8V5h-6v8h6" /></svg>;
}
function IconCode() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>;
}
function IconSquareCode() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="2" /><polyline points="10 10 8 12 10 14" /><polyline points="14 10 16 12 14 14" /></svg>;
}
function IconSeparator() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="18" x2="20" y2="18" /></svg>;
}
function IconLink2() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 1 0-7.07-7.07L11 5" /><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 1 0 7.07 7.07L13 19" /></svg>;
}
function IconUndo2() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-1" /></svg>;
}
function IconRedo2() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h1" /></svg>;
}
function IconImagePlus() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1" /><path d="m21 15-3.5-3.5a2 2 0 0 0-2.8 0L6 20" /><path d="M14 8v4" /><path d="M12 10h4" /></svg>;
}
function IconMoreHorizontal() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>;
}
function IconUser() {
  return <svg className="icon icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="8" r="4" /></svg>;
}
function IconCalendar() {
  return <svg className="icon icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
}
function IconHistory() {
  return <svg className="icon icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 3v6h6" /><path d="M12 7v5l3 2" /></svg>;
}
function IconEye() {
  return <svg className="icon icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function IconPencilLine() {
  return <svg className="icon icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
}
function IconFolderSimple() {
  return <svg className="icon icon-18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>;
}
function IconPlusSmall() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
}
function IconPageDoc() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>;
}
function IconNodeDot() {
  return <svg className="icon icon-16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="12" cy="12" r="2.8" /></svg>;
}

function readRightbarOpen(): boolean {
  try {
    const v = localStorage.getItem(SPACEBAR_RIGHTBAR_KEY);
    if (v === null) return true;
    return v !== 'false';
  } catch {
    return true;
  }
}

function markSpaceVisited(spaceId: string) {
  try {
    const raw = localStorage.getItem(SPACE_LAST_VISIT_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[spaceId] = Date.now();
    localStorage.setItem(SPACE_LAST_VISIT_KEY, JSON.stringify(map));
  } catch {
    // no-op
  }
}

function readLastVisitMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SPACE_LAST_VISIT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function PageTree({
  nodes,
  selectedId,
  collapsedIds,
  onToggleCollapse,
  onSelect,
  canWrite,
  onCreateChild,
  onOpenContextMenu,
}: {
  nodes: PageNode[];
  selectedId: string | null;
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  onSelect: (id: string) => void;
  canWrite: boolean;
  onCreateChild: (node: PageNode, x: number, y: number) => void;
  onOpenContextMenu: (node: PageNode, x: number, y: number) => void;
}) {
  const renderNodes = (list: PageNode[], level: number): React.ReactNode =>
    list.map((node) => {
      const hasChildren = node.children.length > 0;
      const collapsed = collapsedIds.has(node.id);
      const showChildren = hasChildren && !collapsed;

      return (
        <div key={node.id}>
          <div
            className={`tree-row ${canWrite ? 'has-actions' : ''} ${node.id === selectedId ? 'is-active' : ''}`}
            style={{ ['--tree-level' as string]: String(level) }}
          >
            {hasChildren ? (
              <button
                type="button"
                className="tree-toggle"
                aria-expanded={!collapsed}
                aria-label={collapsed ? '展开' : '收起'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse(node.id);
                }}
              >
                {collapsed ? <IconChevronRight /> : <IconChevronDown />}
              </button>
            ) : (
              <span className="tree-toggle-placeholder tree-dot-placeholder" aria-hidden>
                <IconNodeDot />
              </span>
            )}
            <div
              role="button"
              tabIndex={0}
              className={`tree-node ${node.id === selectedId ? 'is-selected' : ''}`}
              title={node.title}
              onClick={() => onSelect(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(node.id);
                }
              }}
              onContextMenu={(e) => {
                if (!canWrite) return;
                e.preventDefault();
                onOpenContextMenu(node, e.clientX, e.clientY);
              }}
            >
              <IconPageDoc />
              <span className="tree-node-label">{node.title}</span>
            </div>
            {canWrite && (
              <div className="tree-row-actions">
                <button
                  type="button"
                  className="tree-row-action-btn"
                  title="新建子页面"
                  aria-label="新建子页面"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                    onCreateChild(node, rect.left, rect.bottom + 6);
                  }}
                >
                  <IconPlusSmall />
                </button>
                <button
                  type="button"
                  className="tree-row-action-btn"
                  title="更多"
                  aria-label="更多操作"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                    onOpenContextMenu(node, rect.left, rect.bottom + 4);
                  }}
                >
                  <IconMoreHorizontal />
                </button>
              </div>
            )}
          </div>
          {showChildren && renderNodes(node.children, level + 1)}
        </div>
      );
    });

  return (
    <div>
      {renderNodes(nodes, 0)}
      {nodes.length === 0 && <p className="muted-text">当前知识库暂无页面</p>}
    </div>
  );
}

function ContextMenu({
  state,
  onClose,
  onRename,
  onDelete,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onRename: (node: PageNode) => void;
  onDelete: (node: PageNode) => void;
}) {
  useEffect(() => {
    if (!state) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest?.('[data-context-menu]')) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [state, onClose]);

  if (!state) return null;

  return (
    <div
      data-context-menu
      role="menu"
      className="context-menu"
      style={{
        position: 'fixed',
        left: state.x,
        top: state.y,
      }}
    >
      <button
        type="button"
        role="menuitem"
        className="context-item"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onRename(state.node);
          onClose();
        }}
      >
        重命名…
      </button>
      <button
        type="button"
        role="menuitem"
        className="context-item danger"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onDelete(state.node);
          onClose();
        }}
      >
        删除…
      </button>
    </div>
  );
}

export function SpacePage() {
  const navigate = useNavigate();
  const params = useParams();
  const spaceId = params.spaceId as string | undefined;
  const pageId = (params.pageId as string | undefined) ?? null;
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(pageId);
  const [statusText, setStatusText] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [pagePermDraft, setPagePermDraft] = useState<Record<string, PagePermissionChoice>>({});
  const [saveState, setSaveState] = useState<'view' | 'saving' | 'saved'>('view');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const createPagePopoverRef = useRef<HTMLDivElement>(null);
  const [rightbarOpen, setRightbarOpen] = useState(readRightbarOpen);
  const [spaceExpanded, setSpaceExpanded] = useState(false);
  const [createPagePopover, setCreatePagePopover] = useState<{ parentId: string | null; x: number; y: number } | null>(null);
  const [importStubVisible, setImportStubVisible] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [collapsedTocIndexes, setCollapsedTocIndexes] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      localStorage.setItem(SPACEBAR_RIGHTBAR_KEY, rightbarOpen ? 'true' : 'false');
    } catch {
      // no-op
    }
  }, [rightbarOpen]);

  useEffect(() => {
    if (!createPagePopover) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest?.('[data-create-page-popover]')) return;
      setCreatePagePopover(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCreatePagePopover(null);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [createPagePopover]);

  useEffect(() => {
    setImportStubVisible(false);
  }, [createPagePopover]);

  const emptyTiptapDoc = {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  };

  const {
    data: space,
    isError: isSpaceError,
    error: spaceError,
    refetch: refetchSpace,
  } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: () => apiFetch<SpaceDetail>(`/api/v1/spaces/${spaceId}`, token),
    enabled: !!spaceId,
  });

  const {
    data: treeResp,
    isLoading: isPagesLoading,
    isError: isPagesError,
    error: pagesError,
  } = useQuery({
    queryKey: ['space-pages-tree', spaceId],
    queryFn: () => apiFetch<{ tree: PageNode[] }>(`/api/v1/spaces/${spaceId}/pages?format=tree`, token),
    enabled: !!spaceId,
  });

  const tree = treeResp?.tree ?? [];

  const {
    data: spaces,
    isLoading: isSpacesLoading,
    isError: isSpacesError,
    error: spacesError,
    refetch: refetchSpaces,
  } = useQuery({
    queryKey: ['spaces'],
    queryFn: () => apiFetch<SpaceListItem[]>('/api/v1/spaces', token),
  });

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsedIds(new Set()), []);
  const collapseAll = useCallback(() => {
    setCollapsedIds(collectIdsWithChildren(tree));
  }, [tree]);

  const allRows = useMemo(() => {
    const out: PageNode[] = [];
    const walk = (nodes: PageNode[]) => {
      for (const n of nodes) {
        out.push(n);
        if (n.children.length) walk(n.children);
      }
    };
    walk(tree);
    return out;
  }, [tree]);

  const selectedPage = allRows.find((x) => x.id === selectedPageId) ?? null;
  const sortedSpaces = useMemo(() => {
    const list = [...(spaces ?? [])];
    const lastVisit = readLastVisitMap();
    list.sort((a, b) => {
      const ta = lastVisit[a.id] ?? 0;
      const tb = lastVisit[b.id] ?? 0;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
    return list;
  }, [spaces]);
  const visibleSpaces = spaceExpanded ? sortedSpaces : sortedSpaces.slice(0, 4);
  const hasMoreSpaces = sortedSpaces.length > 4;
  const canWriteSpace = space?.myPermission === 'write' || space?.myPermission === 'admin';
  const canManagePagePermissions = space?.myPermission === 'admin';
  const pageErrorText = isPagesError ? formatApiError(pagesError) : '';
  const spacesErrorText = isSpacesError ? formatApiError(spacesError) : '';

  // pageId 变更时，同步选中页，并回到只读态
  useEffect(() => {
    setSelectedPageId(pageId);
    setIsEditing(false);
    setSaveState('view');
    setHistoryOpen(false);
    setPageSettingsOpen(false);
  }, [pageId]);

  // 从知识库入口（/space/:spaceId）进入时，默认落到首篇页面
  useEffect(() => {
    if (!spaceId) return;
    if (pageId) return;
    if (isPagesLoading || isPagesError) return;
    const firstPageId = firstPageIdFromTree(tree);
    if (!firstPageId) return;
    setSelectedPageId(firstPageId);
    navigate(`/space/${spaceId}/page/${firstPageId}`, { replace: true });
  }, [spaceId, pageId, isPagesLoading, isPagesError, tree, navigate]);

  const {
    data: pageDetail,
    isLoading: isPageDetailLoading,
    isError: isPageDetailError,
    error: pageDetailError,
    refetch: refetchPageDetail,
  } = useQuery({
    queryKey: ['page-detail', spaceId, selectedPageId],
    queryFn: () =>
      apiFetch<{
        id: string;
        title: string;
        content: any;
        createdAt: string;
        updatedAt: string;
        createdBy?: { username?: string; displayName?: string | null };
        updatedBy?: { username?: string; displayName?: string | null };
        myPermission?: SpacePermission;
      }>(`/api/v1/spaces/${spaceId}/pages/${selectedPageId}`, token),
    enabled: !!spaceId && !!selectedPageId,
    refetchInterval: selectedPageId ? 3000 : false,
  });

  const canWritePage = pageDetail?.myPermission === 'write' || pageDetail?.myPermission === 'admin';
  const spaceErrorText = isSpaceError ? formatApiError(spaceError) : '';
  const pageDetailErrorText = isPageDetailError ? formatApiError(pageDetailError) : '';

  const {
    data: pagePermissionsResp,
    isLoading: isPagePermissionsLoading,
    isError: isPagePermissionsError,
    error: pagePermissionsError,
  } = useQuery({
    queryKey: ['page-permissions', spaceId, selectedPageId],
    queryFn: () =>
      apiFetch<{
        pageId: string;
        members: PagePermissionMember[];
      }>(`/api/v1/spaces/${spaceId}/pages/${selectedPageId!}/permissions`, token),
    enabled: pageSettingsOpen && !!spaceId && !!selectedPageId,
    retry: 0,
  });

  useEffect(() => {
    if (!pagePermissionsResp?.members?.length) return;
    const next: Record<string, PagePermissionChoice> = {};
    for (const m of pagePermissionsResp.members) {
      next[m.userId] = m.pagePermission ?? 'inherit';
    }
    setPagePermDraft(next);
  }, [pagePermissionsResp]);

  useEffect(() => {
    setDraftTitle(pageDetail?.title ?? selectedPage?.title ?? '');
  }, [pageDetail?.title, selectedPage?.title, selectedPageId]);

  const pagePermissionsErrorText = isPagePermissionsError ? formatApiError(pagePermissionsError) : '';

  const {
    data: pageVersionsResp,
    isLoading: isPageVersionsLoading,
    isError: isPageVersionsError,
    error: pageVersionsError,
    refetch: refetchPageVersions,
  } = useQuery({
    queryKey: ['page-versions', spaceId, selectedPageId],
    queryFn: () =>
      apiFetch<{
        versions: Array<{
          id: string;
          createdAt: string;
          createdBy?: { username?: string; displayName?: string | null };
        }>;
      }>(`/api/v1/spaces/${spaceId}/pages/${selectedPageId}/versions`, token),
    enabled: historyOpen && !!spaceId && !!selectedPageId,
  });

  const versions = pageVersionsResp?.versions ?? [];
  const pageVersionsErrorText = isPageVersionsError ? formatApiError(pageVersionsError) : '';
  const isPagePathBroken = !!selectedPageId && !selectedPage && !isPagesLoading && !isPagesError;

  useEffect(() => {
    const spaceName = space?.name ?? '知识库';
    const pageName = selectedPage?.title ?? pageDetail?.title ?? '';
    document.title = pageName ? `${pageName} - ${spaceName} - 元体WIKI` : `${spaceName} - 元体WIKI`;
  }, [space?.name, selectedPage?.title, pageDetail?.title]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Link.configure({
          autolink: true,
          openOnClick: false,
          HTMLAttributes: {
            rel: 'noopener noreferrer',
            target: '_blank',
          },
        }),
        Image.configure({
          inline: false,
          allowBase64: false,
        }),
      ],
      content: pageDetail?.content ?? emptyTiptapDoc,
      editable: canWritePage && isEditing,
      onCreate: ({ editor: ed }) => {
        setTocItems(extractTocItemsFromDoc(ed.getJSON()));
      },
      onUpdate: ({ editor: ed }) => {
        setTocItems(extractTocItemsFromDoc(ed.getJSON()));
      },
    },
    [pageDetail?.content, canWritePage, isEditing]
  );

  // 编辑器内容随后端切页/恢复更新
  useEffect(() => {
    if (!editor || !pageDetail?.content) return;
    editor.commands.setContent(pageDetail.content);
  }, [editor, pageDetail?.content]);

  useEffect(() => {
    if (editor) {
      setTocItems(extractTocItemsFromDoc(editor.getJSON()));
      return;
    }
    setTocItems(extractTocItemsFromDoc(pageDetail?.content));
  }, [editor, pageDetail?.content, selectedPageId, isEditing]);

  // 正文里存的是无 token 的附件 URL；渲染时为 <img> 补上 token 以便浏览器能拉取
  useEffect(() => {
    if (!token) return;
    const patch = () => {
      document.querySelectorAll('.doc-body img[src^="/api/v1/attachments/"]').forEach((img) => {
        const el = img as HTMLImageElement;
        const raw = el.getAttribute('src') || el.src;
        if (!raw || raw.includes('token=')) return;
        const path = raw.startsWith('http') ? new URL(raw).pathname + new URL(raw).search : raw;
        const sep = path.includes('?') ? '&' : '?';
        el.setAttribute('src', `${path}${sep}token=${encodeURIComponent(token)}`);
      });
    };
    patch();
    const bodies = document.querySelectorAll('.doc-body');
    const mo = new MutationObserver(patch);
    bodies.forEach((b) => mo.observe(b, { childList: true, subtree: true, attributes: true }));
    return () => mo.disconnect();
  }, [token, pageDetail?.updatedAt, selectedPageId, isEditing]);

  const refreshTree = async () => {
    await queryClient.invalidateQueries({ queryKey: ['space-pages-tree', spaceId] });
  };

  const createPageMutation = useMutation({
    mutationFn: async ({ title, parentId }: { title: string; parentId: string | null }) =>
      apiFetch<PageNode>(`/api/v1/spaces/${spaceId}/pages`, token, {
        method: 'POST',
        body: JSON.stringify({ title, parentId }),
      }),
    onSuccess: async () => {
      setStatusText('页面已创建');
      await refreshTree();
    },
    onError: (err) => setStatusText(formatApiError(err)),
  });

  const renamePageMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) =>
      apiFetch<PageNode>(`/api/v1/spaces/${spaceId}/pages/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      }),
    onSuccess: async () => {
      setStatusText('页面已重命名');
      await refreshTree();
    },
    onError: (err) => setStatusText(formatApiError(err)),
  });

  const deletePageMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch<void>(`/api/v1/spaces/${spaceId}/pages/${id}`, token, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      setStatusText('');
      setSelectedPageId(null);
      await refreshTree();
      if (spaceId) navigate(`/space/${spaceId}`);
    },
    onError: (err) => setStatusText(formatApiError(err)),
  });

  const saveContentMutation = useMutation({
    mutationFn: async () => {
      if (!spaceId || !selectedPageId || !editor) throw new Error('缺少页面编辑上下文');
      const title = draftTitle.trim();
      if (!title) throw new Error('标题不能为空');
      const content = stripAttachmentTokensFromDoc(editor.getJSON()) as object;
      return apiFetch<{ id: string; content: any }>(
        `/api/v1/spaces/${spaceId}/pages/${selectedPageId}`,
        token,
        { method: 'PATCH', body: JSON.stringify({ title, content }) }
      );
    },
    onMutate: () => setSaveState('saving'),
    onSuccess: async () => {
      setSaveState('saved');
      setIsEditing(false);
      setStatusText('');
      await queryClient.invalidateQueries({ queryKey: ['page-detail', spaceId, selectedPageId] });
      await queryClient.invalidateQueries({ queryKey: ['space-pages-tree', spaceId] });
      await queryClient.invalidateQueries({ queryKey: ['page-versions', spaceId, selectedPageId] });
      setTimeout(() => setSaveState('view'), 1200);
    },
    onError: (err) => {
      setSaveState('view');
      setStatusText(formatApiError(err));
    },
  });

  const restoreVersionMutation = useMutation({
    mutationFn: async (versionId: string) => {
      if (!spaceId || !selectedPageId) throw new Error('缺少页面或知识库信息');
      return apiFetch<{ restored: boolean; versionId: string }>(
        `/api/v1/spaces/${spaceId}/pages/${selectedPageId}/versions/${versionId}/restore`,
        token,
        { method: 'POST' }
      );
    },
    onSuccess: async () => {
      setStatusText('版本已恢复');
      await queryClient.invalidateQueries({ queryKey: ['page-detail', spaceId, selectedPageId] });
      await queryClient.invalidateQueries({ queryKey: ['page-versions', spaceId, selectedPageId] });
    },
    onError: (err) => setStatusText(formatApiError(err)),
  });

  const savePagePermissionsMutation = useMutation({
    mutationFn: async () => {
      if (!spaceId || !selectedPageId) throw new Error('缺少知识库或页面信息');
      const members = pagePermissionsResp?.members;
      if (!members?.length) throw new Error('缺少可配置成员');

      const permissions = members.map((m) => ({
        userId: m.userId,
        permission: pagePermDraft[m.userId] ?? m.pagePermission ?? 'inherit',
      }));

      return apiFetch<void>(
        `/api/v1/spaces/${spaceId}/pages/${selectedPageId}/permissions`,
        token,
        { method: 'PUT', body: JSON.stringify({ permissions }) }
      );
    },
    onSuccess: async () => {
      setStatusText('权限已保存');
      setPageSettingsOpen(false);
      if (spaceId && selectedPageId) {
        await queryClient.invalidateQueries({ queryKey: ['page-detail', spaceId, selectedPageId] });
        await queryClient.invalidateQueries({ queryKey: ['page-permissions', spaceId, selectedPageId] });
      }
    },
    onError: (err) => setStatusText(formatApiError(err)),
  });

  const isMutatingTree =
    createPageMutation.isPending || renamePageMutation.isPending || deletePageMutation.isPending;
  const isMutatingContent = saveContentMutation.isPending || restoreVersionMutation.isPending;
  const isMutatingPermissions = savePagePermissionsMutation.isPending;

  const submitCreateFromPopover = async () => {
    const title = newPageTitle.trim();
    if (!title) {
      setStatusText('请输入页面标题');
      return;
    }
    await createPageMutation.mutateAsync({ title, parentId: createPagePopover?.parentId ?? null });
    setCreatePagePopover(null);
    setNewPageTitle('');
  };

  const onRenamePage = async (page: PageNode) => {
    const title = window.prompt('重命名页面', page.title);
    if (!title?.trim() || title.trim() === page.title) return;
    await renamePageMutation.mutateAsync({ id: page.id, title: title.trim() });
  };

  const onDeletePage = async (page: PageNode) => {
    const ok = window.confirm(`确认删除页面「${page.title}」吗？`);
    if (!ok) return;
    await deletePageMutation.mutateAsync(page.id);
  };

  const openHistory = () => {
    if (!selectedPageId) return;
    setPageSettingsOpen(false);
    setHistoryOpen(true);
  };

  const onPickImageFile = () => imageFileInputRef.current?.click();

  const onSetLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href ?? '';
    const url = window.prompt('请输入链接 URL（留空可移除链接）', previous);
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
  };

  const onImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !spaceId || !selectedPageId || !token || !editor) return;
    setImageUploading(true);
    setStatusText('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(
        `/api/v1/spaces/${spaceId}/attachments?pageId=${encodeURIComponent(selectedPageId)}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd }
      );
      if (!res.ok) {
        let message = `上传失败（${res.status}）`;
        try {
          const payload = await res.json();
          if (payload?.message) message = payload.message;
        } catch {
          // no-op
        }
        throw new Error(message);
      }
      const data = (await res.json()) as { id: string; url: string };
      const base = data.url.startsWith('/') ? data.url : `/${data.url}`;
      const src = `${base}?token=${encodeURIComponent(token)}`;
      editor.chain().focus().setImage({ src }).run();
      setStatusText('图片插入成功');
    } catch (err) {
      setStatusText(err instanceof Error ? err.message : '上传失败');
    } finally {
      setImageUploading(false);
    }
  };

  useEffect(() => {
    if (!spaceId) return;
    markSpaceVisited(spaceId);
  }, [spaceId]);

  const openContextMenu = (node: PageNode, clientX: number, clientY: number) => {
    setSelectedPageId(node.id);
    if (spaceId) navigate(`/space/${spaceId}/page/${node.id}`);
    const MENU_W = 200;
    const MENU_H = 104;
    const x = Math.min(clientX, window.innerWidth - MENU_W - 8);
    const y = Math.min(clientY, window.innerHeight - MENU_H - 8);
    setContextMenu({ x: Math.max(8, x), y: Math.max(8, y), node });
  };

  const scrollToTocHeading = (tocIndex: number) => {
    const root = document.querySelector('#editView .doc-body.editable .ProseMirror')
      ?? document.querySelector('#readView .doc-body .ProseMirror');
    if (!root) return;
    const headings = root.querySelectorAll('h1,h2,h3,h4,h5,h6');
    const target = headings.item(tocIndex);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const tocTree = useMemo(() => buildTocTree(tocItems), [tocItems]);

  const toggleTocCollapse = (tocIndex: number) => {
    setCollapsedTocIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(tocIndex)) next.delete(tocIndex);
      else next.add(tocIndex);
      return next;
    });
  };

  const renderTocNodes = (nodes: TocNode[]) =>
    nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const collapsed = collapsedTocIndexes.has(node.index);
      return (
        <div key={`${node.index}-${node.level}-${node.text}`} className="toc-tree-node">
          <div className={`toc-row toc-level-${node.level}`}>
            {hasChildren ? (
              <button
                type="button"
                className="toc-toggle"
                aria-label={collapsed ? '展开子标题' : '收起子标题'}
                aria-expanded={!collapsed}
                onClick={() => toggleTocCollapse(node.index)}
              >
                {collapsed ? <IconChevronRight /> : <IconChevronDown />}
              </button>
            ) : (
              <span className="toc-toggle-placeholder" aria-hidden />
            )}
            <button
              type="button"
              className="toc-item"
              onClick={() => scrollToTocHeading(node.index)}
              title={node.text}
            >
              {node.text}
            </button>
          </div>
          {hasChildren && !collapsed && <div className="toc-children">{renderTocNodes(node.children)}</div>}
        </div>
      );
    });

  return (
    <Layout>
      <div className={['space-layout', rightbarOpen ? '' : 'space-layout--rightbar-collapsed'].filter(Boolean).join(' ')}>
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-section-title">知识库</div>
            {isSpacesLoading && <p className="muted-text">加载知识库中...</p>}
            {!isSpacesLoading && !isSpacesError && (
              <>
                <div className="sidebar-space-list">
                  {visibleSpaces.map((s) => (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      className={`tree-node ${s.id === spaceId ? 'active' : ''}`}
                      title={s.name}
                      onClick={() => {
                        markSpaceVisited(s.id);
                        navigate(`/space/${s.id}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          markSpaceVisited(s.id);
                          navigate(`/space/${s.id}`);
                        }
                      }}
                    >
                      <IconFolderSimple />
                      <span className="tree-node-label">{s.name}</span>
                    </div>
                  ))}
                </div>
                {hasMoreSpaces && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm sidebar-space-toggle"
                    onClick={() => setSpaceExpanded((v) => !v)}
                  >
                    {spaceExpanded ? '收起' : `显示更多（+${sortedSpaces.length - 4}）`}
                  </button>
                )}
              </>
            )}
            {isSpaceError && (
              <div style={{ padding: '8px 16px 0' }}>
                <p className="error-text" style={{ marginBottom: 8 }}>
                  {spaceErrorText}
                </p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => refetchSpace()}>
                  重试
                </button>
              </div>
            )}
            {isSpacesError && (
              <div style={{ padding: '8px 16px 0' }}>
                <p className="error-text" style={{ marginBottom: 8 }}>
                  {spacesErrorText}
                </p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => refetchSpaces()}>
                  重试
                </button>
              </div>
            )}
          </div>
          <div className="sidebar-section sidebar-section-pages">
            <div className="sidebar-section-head">
              <div className="sidebar-section-title">页面</div>
              <div className="sidebar-page-actions">
                {canWriteSpace && (
                  <div className="sidebar-page-create-wrap">
                    <button
                      type="button"
                      className="sidebar-page-action-btn"
                      aria-label="新建页面"
                      title="新建页面"
                      onClick={(e) => {
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setCreatePagePopover((prev) =>
                          prev && prev.parentId === null ? null : { parentId: null, x: rect.left, y: rect.bottom + 8 }
                        );
                        setNewPageTitle('');
                      }}
                    >
                      <IconPlusSmall />
                    </button>
                  </div>
                )}
                <details className="sidebar-page-more">
                  <summary className="sidebar-page-action-btn" aria-label="更多操作" title="更多操作">
                    <IconMoreHorizontal />
                  </summary>
                  <div className="sidebar-page-more-menu">
                    <button type="button" className="sidebar-page-more-item" onClick={expandAll} disabled={tree.length === 0}>
                      全部展开
                    </button>
                    <button
                      type="button"
                      className="sidebar-page-more-item"
                      onClick={collapseAll}
                      disabled={!tree.some((n) => n.children.length > 0)}
                    >
                      全部收起
                    </button>
                  </div>
                </details>
              </div>
            </div>
            {isPagesLoading && <p className="muted-text">页面加载中...</p>}
            {isPagesError && (
              <div style={{ padding: '0 16px' }}>
                <p className="error-text">{pageErrorText}</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['space-pages-tree', spaceId] })}
                >
                  重试
                </button>
              </div>
            )}
            {!isPagesLoading && !isPagesError && (
              <div className="page-tree-wrap">
                <PageTree
                  nodes={tree}
                  selectedId={selectedPageId}
                  collapsedIds={collapsedIds}
                  onToggleCollapse={toggleCollapse}
                  onSelect={(id) => {
                    setSelectedPageId(id);
                    if (spaceId) navigate(`/space/${spaceId}/page/${id}`);
                  }}
                  canWrite={canWriteSpace}
                  onCreateChild={(node, x, y) => {
                    setCreatePagePopover({ parentId: node.id, x, y });
                    setNewPageTitle('');
                  }}
                  onOpenContextMenu={openContextMenu}
                />
              </div>
            )}
          </div>
        </aside>

        <main className="content-area">
          <div className="content-toolbar">
            <div className="breadcrumb">
              首页 / {space?.name ?? '知识库'} / {selectedPage?.title ?? pageDetail?.title ?? '未命名'}
            </div>
            <div className="actions">
              {saveState === 'saving' && (
                <span className="save-indicator saving">
                  保存中...
                </span>
              )}
              <div className="actions-primary">
                {canWritePage && selectedPageId && isEditing && (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={saveContentMutation.isPending || imageUploading}
                      onClick={() => saveContentMutation.mutate()}
                    >
                      {saveContentMutation.isPending ? '保存中...' : '保存'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={saveContentMutation.isPending}
                      onClick={() => {
                        if (editor && pageDetail?.content) editor.commands.setContent(pageDetail.content);
                        setDraftTitle(pageDetail?.title ?? selectedPage?.title ?? '');
                        setIsEditing(false);
                        setSaveState('view');
                        setStatusText('');
                      }}
                    >
                      取消
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="content-body">
            {isSpaceError ? (
              <div className="state-panel">
                <h2>知识库暂不可用</h2>
                <p className="error-text">{spaceErrorText}</p>
                <div className="state-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
                    返回首页
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => refetchSpace()}>
                    重试
                  </button>
                </div>
              </div>
            ) : selectedPageId && isPageDetailLoading ? (
              <div className="state-panel">
                <h2>页面加载中...</h2>
                <p className="doc-meta">正在获取最新内容与权限信息。</p>
              </div>
            ) : selectedPageId && isPageDetailError ? (
              <div className="state-panel">
                <h2>页面暂不可用</h2>
                <p className="error-text">{pageDetailErrorText}</p>
                <div className="state-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setSelectedPageId(null);
                      setIsEditing(false);
                      if (spaceId) navigate(`/space/${spaceId}`);
                    }}
                  >
                    返回页面列表
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => refetchPageDetail()}>
                    重试
                  </button>
                </div>
              </div>
            ) : isPagePathBroken ? (
              <div className="state-panel">
                <h2>当前页面不在可见树中</h2>
                <p className="doc-meta">该链接可能已失效、已删除，或当前角色无可见权限。</p>
                <div className="state-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setSelectedPageId(null);
                      if (spaceId) navigate(`/space/${spaceId}`);
                    }}
                  >
                    返回页面列表
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div id="readView" style={{ display: selectedPageId && !isEditing ? 'block' : 'none' }}>
                  <h1 id="pageTitle">{selectedPage?.title ?? pageDetail?.title ?? ''}</h1>
                  <div className="doc-info-row">
                    <span className="doc-info-item" title="创建人">
                      <IconUser />
                      <span>{pageDetail?.createdBy?.displayName ?? pageDetail?.createdBy?.username ?? '-'}</span>
                    </span>
                    <span className="doc-info-item" title="创建时间">
                      <IconCalendar />
                      <span>{formatTimeHms(pageDetail?.createdAt)}</span>
                    </span>
                    <span className="doc-info-item" title="最新修改时间">
                      <IconHistory />
                      <span>{formatTimeHms(pageDetail?.updatedAt)}</span>
                    </span>
                    <span className="doc-info-item" title="浏览次数">
                      <IconEye />
                      <span>-</span>
                    </span>
                  </div>
                  {selectedPageId && (
                    <div className="doc-read-actions">
                      {canWritePage && (
                        <button
                          type="button"
                          className="btn btn-secondary doc-read-action-btn"
                          onClick={() => setIsEditing(true)}
                          disabled={isMutatingContent}
                        >
                          <IconPencilLine />
                          编辑
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary doc-read-action-btn"
                        disabled={isPageDetailLoading || isPageDetailError}
                        onClick={openHistory}
                      >
                        <IconHistory />
                        历史版本
                      </button>
                    </div>
                  )}
                  <div className="doc-body">{editor && !isEditing && <EditorContent editor={editor} />}</div>
                </div>
                <div
                  id="editView"
                  style={{ display: selectedPageId ? (isEditing ? 'block' : 'none') : 'block' }}
                >
                  {selectedPageId && isEditing ? (
                    <>
                      <div className="doc-edit-title">
                        <label htmlFor="pageTitleInput" className="doc-edit-title-label">
                          标题
                        </label>
                        <input
                          id="pageTitleInput"
                          className="doc-edit-title-input"
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          maxLength={120}
                          placeholder="请输入页面标题"
                        />
                      </div>
                      <div className="editor-toolbar">
                        <div className="editor-toolbar-group">
                          <button
                            type="button"
                            className={`editor-icon-btn ${editor?.isActive('bold') ? 'active' : ''}`}
                            title="粗体"
                            onClick={() => editor?.chain().focus().toggleBold().run()}
                          >
                            <IconBold />
                          </button>
                          <button
                            type="button"
                            className={`editor-icon-btn ${editor?.isActive('italic') ? 'active' : ''}`}
                            title="斜体"
                            onClick={() => editor?.chain().focus().toggleItalic().run()}
                          >
                            <IconItalic />
                          </button>
                          <button
                            type="button"
                            className={`editor-icon-btn ${editor?.isActive('strike') ? 'active' : ''}`}
                            title="删除线"
                            onClick={() => editor?.chain().focus().toggleStrike().run()}
                          >
                            <IconStrike />
                          </button>
                        </div>
                        <div className="editor-toolbar-group">
                          <button
                            type="button"
                            className={`editor-icon-btn ${editor?.isActive('paragraph') ? 'active' : ''}`}
                            title="正文"
                            onClick={() => editor?.chain().focus().setParagraph().run()}
                          >
                            <IconParagraph />
                          </button>
                          <button
                            type="button"
                            className={`editor-icon-btn ${editor?.isActive('heading', { level: 1 }) ? 'active' : ''}`}
                            title="一级标题"
                            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                          >
                            <IconHeading1 />
                          </button>
                          <button
                            type="button"
                            className={`editor-icon-btn ${editor?.isActive('heading', { level: 2 }) ? 'active' : ''}`}
                            title="二级标题"
                            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                          >
                            <IconHeading2 />
                          </button>
                          <button
                            type="button"
                            className={`editor-icon-btn ${editor?.isActive('heading', { level: 3 }) ? 'active' : ''}`}
                            title="三级标题"
                            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                          >
                            <IconHeading3 />
                          </button>
                        </div>
                        <div className="editor-toolbar-group">
                          <button
                            type="button"
                            className={`editor-icon-btn ${editor?.isActive('bulletList') ? 'active' : ''}`}
                            title="无序列表"
                            onClick={() => editor?.chain().focus().toggleBulletList().run()}
                          >
                            <IconList />
                          </button>
                          <button
                            type="button"
                            className={`editor-icon-btn ${editor?.isActive('orderedList') ? 'active' : ''}`}
                            title="有序列表"
                            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                          >
                            <IconListOrdered />
                          </button>
                          <button
                            type="button"
                            className={`editor-icon-btn ${editor?.isActive('blockquote') ? 'active' : ''}`}
                            title="引用"
                            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                          >
                            <IconQuote />
                          </button>
                          <button
                            type="button"
                            className={`editor-icon-btn ${editor?.isActive('code') ? 'active' : ''}`}
                            title="行内代码"
                            onClick={() => editor?.chain().focus().toggleCode().run()}
                          >
                            <IconCode />
                          </button>
                        </div>
                        <details className="editor-toolbar-more">
                          <summary className="editor-icon-btn" title="更多">
                            <IconMoreHorizontal />
                          </summary>
                          <div className="editor-toolbar-more-menu">
                            <button
                              type="button"
                              className={`editor-toolbar-more-item ${editor?.isActive('codeBlock') ? 'active' : ''}`}
                              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                            >
                              <IconSquareCode />
                              代码块
                            </button>
                            <button
                              type="button"
                              className="editor-toolbar-more-item"
                              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                            >
                              <IconSeparator />
                              分割线
                            </button>
                            <button type="button" className="editor-toolbar-more-item" onClick={onSetLink}>
                              <IconLink2 />
                              链接
                            </button>
                            <button
                              type="button"
                              className="editor-toolbar-more-item"
                              disabled={!editor?.can().chain().focus().undo().run()}
                              onClick={() => editor?.chain().focus().undo().run()}
                            >
                              <IconUndo2 />
                              撤销
                            </button>
                            <button
                              type="button"
                              className="editor-toolbar-more-item"
                              disabled={!editor?.can().chain().focus().redo().run()}
                              onClick={() => editor?.chain().focus().redo().run()}
                            >
                              <IconRedo2 />
                              重做
                            </button>
                          </div>
                        </details>
                        <input
                          ref={imageFileInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={onImageFileChange}
                        />
                        <button
                          type="button"
                          className="editor-icon-btn"
                          disabled={imageUploading || !token}
                          title={imageUploading ? '上传中...' : '插入图片'}
                          onClick={onPickImageFile}
                        >
                          <IconImagePlus />
                        </button>
                      </div>
                      <div className="doc-body editable">{editor && <EditorContent editor={editor} />}</div>
                    </>
                  ) : (
                    <div className={tree.length === 0 ? 'empty-page-state' : 'select-page-state'}>
                      <h1>{tree.length === 0 ? '当前暂无页面' : '请选择一个页面'}</h1>
                      <p className="doc-meta empty-page-state-meta">
                        {tree.length === 0
                          ? canWriteSpace
                            ? '请先创建第一个页面后开始撰写文档。'
                            : '当前角色在该知识库暂无可见页面。'
                          : '请从左侧页面树选择目标页面。'}
                      </p>
                      {tree.length === 0 && canWriteSpace && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            setCreatePagePopover({ parentId: null, x: rect.left, y: rect.bottom + 8 });
                            setNewPageTitle('');
                          }}
                          disabled={isMutatingTree}
                        >
                          创建第一个页面
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
            {!!statusText && (
              <p
                className={
                  statusText.includes('没有权限') ||
                  statusText.includes('无法删除') ||
                  statusText.includes('不存在') ||
                  statusText.includes('失败')
                    ? 'error-text'
                    : 'muted-text'
                }
              >
                {statusText}
              </p>
            )}
          </div>
        </main>

        <button
          type="button"
          className={`rightbar-splitter ${rightbarOpen ? 'is-open' : 'is-collapsed'}`}
          onClick={() => setRightbarOpen((v) => !v)}
          aria-label={rightbarOpen ? '收起右侧栏（页面大纲与信息）' : '展开右侧栏（页面大纲与信息）'}
          title={rightbarOpen ? '收起右侧栏' : '展开右侧栏'}
        >
          <span className="rightbar-splitter-icon" aria-hidden>
            {rightbarOpen ? <IconPanelClose /> : <IconPanelOpen />}
          </span>
        </button>

        <aside className={`rightbar ${rightbarOpen ? 'is-open' : 'is-collapsed'}`} aria-hidden={!rightbarOpen}>
          <div className="rightbar-top-divider" aria-hidden />
          <div className="rightbar-content">
            <div className="rightbar-section">
              <h4 className="rightbar-section-title">页面大纲</h4>
              <nav className="toc">
                {tocItems.length > 0 ? (
                  renderTocNodes(tocTree)
                ) : (
                  <span className="toc-empty">{selectedPageId ? '当前正文暂无标题' : '未选择页面'}</span>
                )}
              </nav>
            </div>
            <div className="rightbar-section">
              <h4 className="rightbar-section-title">页面信息</h4>
              <div className="page-info-list">
                <div className="page-info-item">
                  <span className="page-info-label">创建人</span>
                  <span className="page-info-value">
                    {pageDetail?.createdBy?.displayName ?? pageDetail?.createdBy?.username ?? '-'}
                  </span>
                </div>
                <div className="page-info-item">
                  <span className="page-info-label">创建时间</span>
                  <span className="page-info-value">{formatTimeHms(pageDetail?.createdAt)}</span>
                </div>
                <div className="page-info-item">
                  <span className="page-info-label">最新修改时间</span>
                  <span className="page-info-value">{formatTimeHms(pageDetail?.updatedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {canWriteSpace && (
        <ContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          onRename={(node) => onRenamePage(node)}
          onDelete={(node) => onDeletePage(node)}
        />
      )}

      {createPagePopover && (
        <div
          ref={createPagePopoverRef}
          className="sidebar-page-create-popover"
          data-create-page-popover
          style={{
            left: Math.max(8, Math.min(createPagePopover.x, window.innerWidth - 280 - 8)),
            top: Math.max(8, Math.min(createPagePopover.y, window.innerHeight - 250)),
          }}
        >
          <div className="sidebar-create-kind">
            <IconPageDoc />
            <span>Wiki 页面</span>
          </div>
          <div className="sidebar-create-input-wrap">
            <label htmlFor="newPageTitle" className="sidebar-create-label">页面标题</label>
            <input
              id="newPageTitle"
              className="sidebar-create-input"
              value={newPageTitle}
              onChange={(e) => setNewPageTitle(e.target.value)}
              placeholder="请输入页面标题"
              maxLength={120}
              autoFocus
            />
          </div>
          <button
            type="button"
            className="sidebar-create-import"
            title="导入功能暂未开放"
            onClick={() => setImportStubVisible(true)}
          >
            导入为 Wiki 页面
            <IconChevronRight />
          </button>
          {importStubVisible ? (
            <p className="sidebar-import-stub-msg" role="status">
              导入功能暂未开放，敬请期待。
            </p>
          ) : null}
          <div className="sidebar-create-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setCreatePagePopover(null);
                setNewPageTitle('');
              }}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={createPageMutation.isPending}
              onClick={submitCreateFromPopover}
            >
              {createPageMutation.isPending ? '创建中...' : '创建'}
            </button>
          </div>
        </div>
      )}

      {selectedPageId && historyOpen && (
        <>
          <div className="overlay show" onClick={() => setHistoryOpen(false)} />
          <div className="version-panel open" id="versionPanel">
            <div className="version-panel-header">
              <div>历史版本</div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHistoryOpen(false)}>
                关闭
              </button>
            </div>
            <div className="version-panel-body">
              {isPageVersionsLoading ? (
                <p className="muted-text">版本加载中...</p>
              ) : isPageVersionsError ? (
                <div style={{ padding: '0 16px' }}>
                  <p className="error-text">{pageVersionsErrorText}</p>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => refetchPageVersions()}>
                    重试
                  </button>
                </div>
              ) : versions.length === 0 ? (
                <p className="muted-text">暂无历史版本</p>
              ) : (
                versions.map((v) => (
                  <div className="version-item" key={v.id}>
                    <div className="version-item-header">
                      {v.createdAt} · {v.createdBy?.displayName ?? v.createdBy?.username ?? '未知用户'}
                    </div>
                    <div className="version-item-actions">
                      {canWritePage && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={restoreVersionMutation.isPending}
                          onClick={() => restoreVersionMutation.mutate(v.id)}
                        >
                          {restoreVersionMutation.isPending ? '恢复中...' : '恢复'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {selectedPageId && pageSettingsOpen && (
        <>
          <div className="overlay show" onClick={() => setPageSettingsOpen(false)} />
          <div className="page-settings open" id="pageSettings">
            <div className="page-settings-header">
              <h3 className="page-settings-title">页面设置</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPageSettingsOpen(false)}
              >
                关闭
              </button>
            </div>

            <p className="page-settings-sub">
              这里可以配置当前页面的页面级权限。
            </p>

            <div>
              <div className="page-settings-section-title">基础信息</div>
              <p style={{ fontSize: 13, margin: '0 0 4px' }}>
                标题：<span>{selectedPage?.title ?? pageDetail?.title ?? '-'}</span>
              </p>
              <p style={{ fontSize: 13, margin: '0 0 4px' }}>知识库：{space?.name ?? '-'}</p>
            </div>

            <div>
              <div className="page-settings-section-title">页面级权限</div>

              {isPagePermissionsLoading && <p className="muted-text">加载中...</p>}
              {isPagePermissionsError && <p className="error-text">{pagePermissionsErrorText}</p>}

              {!isPagePermissionsLoading && !isPagePermissionsError && (
                <table>
                  <thead>
                    <tr>
                      <th>成员</th>
                      <th>权限</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pagePermissionsResp?.members ?? []).map((m) => (
                      <tr key={m.userId}>
                        <td>{m.user?.displayName ?? m.user?.username ?? m.userId}</td>
                        <td>
                          <select
                            className="perm-select"
                            value={pagePermDraft[m.userId] ?? m.pagePermission ?? 'inherit'}
                            onChange={(e) => {
                              const next = e.target.value as PagePermissionChoice;
                              setPagePermDraft((prev) => ({ ...prev, [m.userId]: next }));
                            }}
                            disabled={!canManagePagePermissions}
                          >
                            <option value="inherit">继承知识库权限</option>
                            <option value="write">可编辑</option>
                            <option value="read">可查看</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="page-settings-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPageSettingsOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canManagePagePermissions || isPagePermissionsLoading || isMutatingPermissions}
                onClick={() => savePagePermissionsMutation.mutate()}
              >
                {isMutatingPermissions ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
