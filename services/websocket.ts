import { io, Socket } from 'socket.io-client';
import { ProductItem } from '../types';

// Server URL - Render.com deployment
const SOCKET_SERVER = 'https://manager-stoc-piese-server.onrender.com';

let socket: Socket | null = null;

export interface SessionData {
  sessionId: string;
  fileName: string;
  products: ProductItem[];
  originalHeaders: string[];
  columnMapping: {
    codeIndex: number;
    descIndex: number;
    stockIndex: number;
  };
  createdAt: number;
}

// Initialize socket connection
export const connectSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_SERVER, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });
    
    socket.on('connect', () => {
      console.log('✅ WebSocket connected:', socket?.id);
    });
    
    socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
    });
    
    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
    });
  }
  return socket;
};

// Desktop: Create a new session
export const createSession = (sessionId: string, data: SessionData): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const s = connectSocket();
    s.emit('create-session', { sessionId, data }, (response: any) => {
      if (response.success) {
        console.log('✅ Session created on server:', sessionId);
        resolve(true);
      } else {
        console.error('❌ Failed to create session:', response.error);
        reject(new Error(response.error || 'Failed to create session'));
      }
    });
  });
};

// Zebra: Join an existing session
export const joinSession = (sessionId: string): Promise<SessionData> => {
  return new Promise((resolve, reject) => {
    const s = connectSocket();
    s.emit('join-session', { sessionId }, (response: any) => {
      if (response.success && response.data) {
        console.log('✅ Joined session on server:', sessionId);
        resolve(response.data);
      } else {
        console.error('❌ Failed to join session:', response.error);
        reject(new Error(response.error || 'Session not found'));
      }
    });
  });
};

// Both: Listen for real-time product updates
// Note: We remove previous listeners to prevent duplicates. This is safe because
// this function is only called when joining/creating a session, and we only want
// one active listener at a time.
export const onProductsUpdate = (callback: (products: ProductItem[]) => void): void => {
  const s = connectSocket();
  s.off('products-updated'); // Remove previous listeners to prevent duplicates
  s.on('products-updated', (data: { products: ProductItem[] }) => {
    console.log('📦 Products updated from server');
    callback(data.products);
  });
};

// Both: Update products and broadcast to all connected clients
export const updateProducts = (sessionId: string, products: ProductItem[]): void => {
  const s = connectSocket();
  s.emit('update-products', { sessionId, products });
  console.log('📤 Products sent to server');
};

// Cleanup
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
