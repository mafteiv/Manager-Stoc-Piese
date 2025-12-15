# Quick Start Deployment Guide

## 🚀 Deploy in 3 Steps

### Step 1: Deploy the Socket.IO Server (5 minutes)

1. **Create a new GitHub repository:**
   - Go to GitHub and create a new repository named `Manager-Stoc-Piese-Server`
   - Make it public or private (doesn't matter)

2. **Copy server files:**
   ```bash
   cd server
   git init
   git add .
   git commit -m "Initial server setup"
   git remote add origin https://github.com/YOUR_USERNAME/Manager-Stoc-Piese-Server.git
   git push -u origin main
   ```

3. **Deploy to Railway:**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Click "Deploy from GitHub repo"
   - Select your `Manager-Stoc-Piese-Server` repository
   - Wait for deployment to complete (1-2 minutes)
   - **Copy the deployment URL** (e.g., `https://manager-stoc-piese-server-production.up.railway.app`)

### Step 2: Update Client Configuration (1 minute)

1. **Edit `services/websocket.ts`:**
   ```typescript
   // Line 6 - Replace with your Railway URL
   const SOCKET_SERVER = 'https://your-railway-url.up.railway.app';
   ```

2. **Save the file**

### Step 3: Build and Deploy Frontend (2 minutes)

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Deploy to your hosting provider:**
   - **Netlify**: Drag and drop the `dist/` folder
   - **Vercel**: `vercel --prod`
   - **GitHub Pages**: Copy `dist/` contents to `gh-pages` branch
   - **Any static host**: Upload the `dist/` folder

## ✅ Verify It's Working

1. **Open your deployed app in two browser windows**
2. **Window 1 (Desktop):** Upload an Excel file and create a session
3. **Window 2 (Zebra):** Enter the session code and join
4. **Test sync:** Scan a product on Window 2, verify it appears on Window 1

## 🐛 Troubleshooting

### "WebSocket connection error"
- ✅ Verify Railway deployment is running
- ✅ Check SOCKET_SERVER URL is correct in `services/websocket.ts`
- ✅ Make sure you rebuilt after changing the URL: `npm run build`

### "Session not found"
- ✅ Make sure Desktop created the session first
- ✅ Double-check the 4-digit session code
- ✅ Railway server might have restarted (sessions are in-memory)

### QR code not showing
- ✅ Check browser console for errors
- ✅ Verify internet connection (QR library loads from CDN)
- ✅ Use manual code entry as alternative

## 📊 Expected Performance

- **Connection time:** < 1 second
- **Update latency:** < 1 second between devices
- **Server response:** < 100ms
- **Works on:** Same network OR different networks/locations

## 🔐 Security Notes

⚠️ **For Production Use:**
- Update CORS in `server/server.js` to restrict allowed origins
- Consider adding authentication
- Implement session expiration
- Add rate limiting

## 💡 Tips

- Railway free tier is perfect for testing
- Server auto-restarts if it crashes
- Sessions stored in memory (lost on restart)
- For persistence, add Redis to your Railway project

## 📞 Need Help?

1. Check browser console for error messages
2. Review `TESTING_WEBSOCKET.md` for detailed testing steps
3. Check Railway logs for server errors
4. Ensure both devices use the same session ID

---

**That's it! You're ready to use cross-device inventory scanning! 🎉**
