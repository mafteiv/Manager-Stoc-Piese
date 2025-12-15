import { ProductItem } from '../types';

export interface SessionData {
  sessionId: string;
  fileName: string;
  products: ProductItem[];
  originalHeaders: any[];
  columnMapping: any;
  createdAt: number;
  lastUpdated: number;
}

const SESSION_PREFIX = 'stock-session-';

// Create a new session in localStorage
export const createSession = (sessionId: string, data: Omit<SessionData, 'lastUpdated'>): void => {
  const sessionData: SessionData = {
    ...data,
    lastUpdated: Date.now()
  };
  localStorage.setItem(SESSION_PREFIX + sessionId, JSON.stringify(sessionData));
  console.log('✅ Session saved to localStorage:', sessionId);
};

// Check if session exists
export const sessionExists = (sessionId: string): boolean => {
  const data = localStorage.getItem(SESSION_PREFIX + sessionId);
  return data !== null;
};

// Get session data
export const getSession = (sessionId: string): SessionData | null => {
  const data = localStorage.getItem(SESSION_PREFIX + sessionId);
  if (!data) {
    console.error('❌ Session not found:', sessionId);
    return null;
  }
  try {
    const parsed = JSON.parse(data);
    console.log('✅ Session loaded from localStorage:', sessionId);
    return parsed;
  } catch (e) {
    console.error('❌ Failed to parse session data:', e);
    return null;
  }
};

// Update products in session
export const updateSessionProducts = (sessionId: string, products: ProductItem[]): void => {
  const session = getSession(sessionId);
  if (!session) {
    console.error('❌ Cannot update - session not found:', sessionId);
    return;
  }
  
  session.products = products;
  session.lastUpdated = Date.now();
  
  localStorage.setItem(SESSION_PREFIX + sessionId, JSON.stringify(session));
  console.log('✅ Products updated in localStorage. Count:', products.length);
};

// Get last updated timestamp for a session
export const getLastUpdated = (sessionId: string): number => {
  const session = getSession(sessionId);
  return session?.lastUpdated || 0;
};

// Clean up old sessions (optional - remove sessions older than 24 hours)
export const cleanupOldSessions = (): void => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(SESSION_PREFIX)) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        if (now - data.createdAt > maxAge) {
          localStorage.removeItem(key);
          console.log('🧹 Cleaned up old session:', key);
        }
      } catch (e) {
        // Invalid data, remove it
        localStorage.removeItem(key);
      }
    }
  });
};
