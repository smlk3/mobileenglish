/**
 * Chat Session Store
 * Manages chat session metadata (id, title, lastMessage, timestamps)
 * using AsyncStorage — no DB migration required.
 *
 * Auto-generates a name from the first user message.
 * Title is manually editable by the user.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'chat_sessions_v1';

export interface ChatSessionMeta {
    id: string;
    title: string;
    createdAt: number;
    lastMessage: string;
    lastMessageAt: number;
    messageCount: number;
}

// ─── Internal helpers ─────────────────────────────────────

async function readAll(): Promise<ChatSessionMeta[]> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as ChatSessionMeta[];
    } catch {
        return [];
    }
}

async function writeAll(sessions: ChatSessionMeta[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

/** Generate a readable short title from first user message */
function autoTitle(firstUserMessage: string): string {
    const clean = firstUserMessage.trim().replace(/\n+/g, ' ');
    return clean.length > 40 ? clean.slice(0, 37) + '…' : clean;
}

// ─── Public API ────────────────────────────────────────────

/** List all sessions, newest first */
export async function listSessions(): Promise<ChatSessionMeta[]> {
    const sessions = await readAll();
    return sessions.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

/** Create a new session and return its metadata */
export async function createSession(): Promise<ChatSessionMeta> {
    const now = Date.now();
    const session: ChatSessionMeta = {
        id: uuidv4(),
        title: 'New Chat',
        createdAt: now,
        lastMessage: '',
        lastMessageAt: now,
        messageCount: 0,
    };
    const sessions = await readAll();
    sessions.push(session);
    await writeAll(sessions);
    return session;
}

/**
 * Update session preview after a new message.
 * If the session still has the default title and a user message arrives,
 * auto-generate a title from it.
 */
export async function updateSessionMeta(
    sessionId: string,
    lastMessage: string,
    role: 'user' | 'assistant',
): Promise<void> {
    const sessions = await readAll();
    const idx = sessions.findIndex((s) => s.id === sessionId);
    if (idx === -1) return;

    const session = sessions[idx];
    session.lastMessage = lastMessage.slice(0, 80);
    session.lastMessageAt = Date.now();
    session.messageCount = (session.messageCount || 0) + 1;

    // Auto-title from first user message if still default
    if (role === 'user' && session.title === 'New Chat') {
        session.title = autoTitle(lastMessage);
    }

    sessions[idx] = session;
    await writeAll(sessions);
}

/** Rename a session manually */
export async function renameSession(sessionId: string, newTitle: string): Promise<void> {
    const sessions = await readAll();
    const idx = sessions.findIndex((s) => s.id === sessionId);
    if (idx === -1) return;
    sessions[idx].title = newTitle.trim() || 'Untitled';
    await writeAll(sessions);
}

/** Delete a session's metadata (caller must also delete messages from DB) */
export async function deleteSession(sessionId: string): Promise<void> {
    const sessions = await readAll();
    await writeAll(sessions.filter((s) => s.id !== sessionId));
}

/** Get a single session by id */
export async function getSession(sessionId: string): Promise<ChatSessionMeta | null> {
    const sessions = await readAll();
    return sessions.find((s) => s.id === sessionId) ?? null;
}
