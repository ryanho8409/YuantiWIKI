export type SpacePermissionLevel = 'read' | 'write' | 'admin';

export function satisfiesSpacePermission(
  current: SpacePermissionLevel,
  required: SpacePermissionLevel
) {
  const rank: Record<SpacePermissionLevel, number> = {
    read: 1,
    write: 2,
    admin: 3,
  };
  return rank[current] >= rank[required];
}

