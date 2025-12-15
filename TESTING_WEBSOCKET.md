# WebSocket Implementation Testing Guide

## Overview
This document describes how to manually test the new WebSocket-based synchronization system.

## Prerequisites
1. Start the development server: `npm run dev`
2. Open the application in two browser windows/tabs:
   - **Window 1**: Desktop mode (for uploading Excel)
   - **Window 2**: Zebra/Scanner mode (for joining session)

## Test Scenario 1: Desktop Creates Session

### Steps:
1. **Desktop Window**:
   - Click "📂 Încarcă Fișier Excel"
   - Select a test Excel file with columns: Code, Description, Stock
   - Verify the mapping screen appears
   - Select correct columns:
     - Code column (e.g., Column A)
     - Description column (e.g., Column B)
     - Stock column (e.g., Column C)
   - Click "Confirmă și Începe"

2. **Expected Results**:
   - ✅ Console shows: "🔑 Generated session ID: [4-digit-code]"
   - ✅ Console shows: "✅ Session created successfully!"
   - ✅ QR code modal appears with:
     - QR code image (containing the session URL)
     - 4-digit session code (e.g., 1234)
   - ✅ App mode changes to ACTIVE
   - ✅ Product list is displayed
   - ✅ Header shows "Sesiune: [4-digit-code]" with green indicator

## Test Scenario 2: Zebra Joins Session (Manual Code Entry)

### Steps:
1. **Zebra Window**:
   - Note the 4-digit session code from Desktop (e.g., 1234)
   - Enter the code in the "Cod Sesiune" input field
   - Click "START"

2. **Expected Results**:
   - ✅ Console shows: "🔍 Attempting to join session: [code]"
   - ✅ Console shows: "✅ Joined session: [code]"
   - ✅ Console shows: "✅ Successfully joined session!"
   - ✅ App mode changes to ACTIVE
   - ✅ Product list appears (same as Desktop)
   - ✅ Header shows "Sesiune: [code]" with green indicator

## Test Scenario 3: Zebra Joins Session (QR Code Scan)

### Steps:
1. **Desktop Window**:
   - After session is created, QR code modal is shown
   - Copy the URL from browser (should be like: `http://localhost:5173/?session=1234`)

2. **Zebra Window**:
   - Paste the URL with session parameter
   - Page should auto-join after 500ms

3. **Expected Results**:
   - ✅ Console shows: "🔍 Auto-joining session from URL: [code]"
   - ✅ Console shows: "✅ Successfully auto-joined session!"
   - ✅ App loads directly in ACTIVE mode with products

## Test Scenario 4: Real-Time Sync (Zebra → Desktop)

### Steps:
1. **Zebra Window**:
   - In the search bar, enter a product code (or scan if using a barcode scanner)
   - Press Enter or click "Caută"
   - In the quantity modal, enter a quantity (e.g., 5)
   - Click confirm

2. **Expected Results**:
   - ✅ **Zebra**: Console shows "📤 Products sent to server"
   - ✅ **Zebra**: Product row updates with scanned quantity
   - ✅ **Desktop**: Console shows "📦 Received product update from Zebra"
   - ✅ **Desktop**: Product row updates automatically with same quantity
   - ✅ **Both**: Row is highlighted in blue (scanned items)

## Test Scenario 5: Real-Time Sync (Desktop → Zebra)

### Steps:
1. **Desktop Window**:
   - Click the "+" button on any product row
   - Quantity should increase by 1

2. **Expected Results**:
   - ✅ **Desktop**: Console shows "📤 Products sent to server"
   - ✅ **Desktop**: Product quantity updates immediately
   - ✅ **Zebra**: Console shows "📦 Received product update from Desktop"
   - ✅ **Zebra**: Product quantity updates automatically

## Test Scenario 6: Export Excel

### Steps:
1. **Either Window** (Desktop or Zebra):
   - Click "💾 Export" button in header

2. **Expected Results**:
   - ✅ Excel file downloads
   - ✅ File name includes original name + timestamp
   - ✅ Scanned quantities are in the correct column
   - ✅ All product data is preserved

## WebSocket Connection Verification

### Console Messages to Look For:

**On Page Load**:
```
✅ WebSocket connected: [socket-id]
```

**On Session Creation**:
```
🔑 Generated session ID: [code]
✅ Session created: [code]
✅ Session created successfully!
```

**On Session Join**:
```
🔍 Attempting to join session: [code]
✅ Joined session: [code]
✅ Successfully joined session!
```

**On Product Update**:
```
📤 Products sent to server
📦 Products updated from server
```

**On Connection Error**:
```
❌ WebSocket connection error: [error details]
```

## Known Limitations

1. **WebSocket Server**: Using a public test server (`socket-io-server.up.railway.app`)
   - Sessions may not persist long-term
   - For production, deploy your own Socket.IO server

2. **QR Code**: QRCode library is loaded from CDN
   - Requires internet connection
   - Alternative: Install as npm package

3. **Session Expiry**: Sessions are stored in server memory
   - Sessions will be lost if server restarts
   - For production, implement session persistence (Redis, database, etc.)

## Troubleshooting

### Issue: QR Code doesn't appear
- Check browser console for JavaScript errors
- Verify QRCode library is loaded: `typeof QRCode !== 'undefined'`
- Check that `showQRCode` state is true

### Issue: Session not found
- Verify WebSocket server is running and accessible
- Check that session code is correct (4 digits)
- Check browser console for connection errors

### Issue: Products not syncing
- Check both windows' console for WebSocket messages
- Verify both are connected to the same session ID
- Check that `isConnected` state is true in both windows

### Issue: WebSocket connection fails
- Check network connectivity
- Try using a different WebSocket server URL
- Check browser console for CORS or connection errors
