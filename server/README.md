# Socket.IO Server for Manager Stoc Piese

This server enables real-time synchronization between Desktop and Zebra scanner devices.

## Architecture

```
Desktop (PC)                    Zebra Terminal
    |                                |
    |-------- WebSocket -------------|
    |                                |
    v                                v
    Socket.IO Server (Railway.app)
    - Stores active sessions
    - Broadcasts updates in real-time
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

The server will run on `http://localhost:3000`

## Deployment to Railway.app

1. Create a new GitHub repository: `Manager-Stoc-Piese-Server`
2. Push this server code to the repository
3. Go to [Railway.app](https://railway.app/)
4. Create a new project
5. Connect your GitHub repository
6. Railway will auto-detect the `package.json` and deploy
7. Copy the deployment URL (e.g., `https://manager-stoc-piese-server.up.railway.app`)
8. Update `SOCKET_SERVER` in `services/websocket.ts` with the deployment URL

## Environment Variables

No environment variables required - the server uses `process.env.PORT` which Railway sets automatically.

## API

### Events

**create-session**
- Sent by: Desktop
- Payload: `{ sessionId: string, data: SessionData }`
- Response: `{ success: boolean }`

**join-session**
- Sent by: Zebra
- Payload: `{ sessionId: string }`
- Response: `{ success: boolean, data?: SessionData, error?: string }`

**update-products**
- Sent by: Both
- Payload: `{ sessionId: string, products: ProductItem[] }`
- Broadcasts: `products-updated` to all clients in the session

**products-updated**
- Broadcast to: All clients in session
- Payload: `{ products: ProductItem[] }`

## Notes

- Sessions are stored in memory and will be lost on server restart
- For production use, consider adding Redis or database persistence
- Socket.IO handles reconnection automatically
- CORS is configured to allow all origins (adjust for production)
