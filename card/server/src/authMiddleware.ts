// ============================================================
// authMiddleware.ts — Socket.io middleware that verifies the
// Supabase JWT sent in the handshake and attaches the user ID
// to socket.data. Unauthenticated sockets can still connect
// (for list_rooms browsing) but are marked accordingly.
// ============================================================

import type { Socket } from 'socket.io';
import { supabaseAdmin } from './supabaseAdmin';

/**
 * Socket.io middleware — runs once per connection.
 * Reads `socket.handshake.auth.token`, verifies it with Supabase,
 * and sets `socket.data.userId` on success.
 */
export async function authMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> {
  const token = socket.handshake.auth?.token as string | undefined;

  if (!token) {
    // Allow unauthenticated connections (they can browse rooms
    // but cannot create/join games).
    socket.data.userId = null;
    return next();
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      console.warn('[auth] JWT verify failed:', error?.message ?? 'no user');
      socket.data.userId = null;
      return next(); // Don't reject — let them browse
    }

    socket.data.userId = user.id;
    socket.data.userEmail = user.email;
    next();
  } catch (err) {
    console.error('[auth] middleware exception:', err);
    socket.data.userId = null;
    next();
  }
}
