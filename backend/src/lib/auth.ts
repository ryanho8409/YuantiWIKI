import jwt from 'jsonwebtoken';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

export interface JwtPayload {
  id: string;
  username: string;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      'id' in decoded &&
      'username' in decoded &&
      'role' in decoded
    ) {
      const p = decoded as Record<string, unknown>;
      if (
        typeof p.id === 'string' &&
        typeof p.username === 'string' &&
        typeof p.role === 'string'
      ) {
        return { id: p.id, username: p.username, role: p.role };
      }
    }
    return null;
  } catch {
    return null;
  }
}
