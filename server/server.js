// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// In-memory session storage
const sessions = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Desktop: Create a new session
  socket.on('create-session', ({ sessionId, data }, callback) => {
    sessions.set(sessionId, data);
    socket.join(sessionId);
    console.log('Session created:', sessionId);
    callback({ success: true });
  });

  // Zebra: Join existing session
  socket.on('join-session', ({ sessionId }, callback) => {
    const data = sessions.get(sessionId);
    if (data) {
      socket.join(sessionId);
      console.log('Client joined session:', sessionId);
      callback({ success: true, data });
    } else {
      console.log('Session not found:', sessionId);
      callback({ success: false, error: 'Session not found' });
    }
  });

  // Both: Update products and broadcast to all in session
  socket.on('update-products', ({ sessionId, products }) => {
    const session = sessions.get(sessionId);
    if (session) {
      session.products = products;
      session.lastUpdated = Date.now();
      io.to(sessionId).emit('products-updated', { products });
      console.log('Products updated for session:', sessionId);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
