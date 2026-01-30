# How to Start the Vizora Display App with QR Code Support

## Prerequisites

The display app requires the **middleware service** to be running in order to generate pairing codes and QR codes.

## Step-by-Step Instructions

### Option 1: Start Middleware First, Then Display App (Recommended)

#### 1. Start the Middleware (in Terminal 1)

```bash
cd C:\Projects\vizora\vizora\middleware
npx ts-node src/main.ts
```

You should see output like:
```
[Info] Vizora Middleware Server
[Info] Server is running on port 3000
```

#### 2. Start the Display App (in Terminal 2)

```bash
cd C:\Projects\vizora\vizora\display
npm start
```

The Electron app should launch and show:
- **Pairing Screen** with "Welcome to Vizora" title
- **6-character pairing code** (displayed in large monospace font)
- **QR code** in a white container (340x340px)
- "Enter this code at app.vizora.com/devices/pair" message

### Option 2: Use One-Line Startup Scripts

#### On Windows (PowerShell):

```powershell
# Terminal 1
cd C:\Projects\vizora\vizora\middleware; npx ts-node src/main.ts

# Terminal 2
cd C:\Projects\vizora\vizora\display; npm start
```

#### On macOS/Linux:

```bash
# Terminal 1
cd ~/path/to/vizora/middleware && npx ts-node src/main.ts &

# Terminal 2
cd ~/path/to/vizora/display && npm start
```

## Expected Output

### Middleware Console (Terminal 1)
```
[Pairing Service] Initialized
[Server] Listening on http://127.0.0.1:3000
```

### Display App Console (Terminal 2 - DevTools)
```
[Preload] ✅ electronAPI exposed successfully
[App] electronAPI initialized successfully
[Main] *** INITIALIZING DEVICE CLIENT ***
[Main] Device token loaded: NONE - WILL REQUEST PAIRING
[Main] *** SENDING PAIRING-REQUIRED EVENT TO RENDERER ***
[App] *** PAIRING REQUIRED EVENT FIRED ***
[App] showPairingScreen(): Displaying pairing screen
[App] Requesting pairing code from device client...
[DeviceClient] Requesting pairing code from: http://127.0.0.1:3000/api/devices/pairing/request
[DeviceClient] ✅ Pairing code received successfully: ABC123
[DeviceClient] QR Code present: YES
[App] *** PAIRING CODE RECEIVED ***
[App] Result keys: ['code', 'qrCode', 'expiresAt', 'expiresInSeconds', 'pairingUrl']
[App] Calling displayQRCode...
[App] displayQRCode(): Rendering QR code, URL length: 3218
[App] SUCCESS: QR code image loaded
[App] QR code container shown
```

## What You Should See

1. **Black window with white text appears** - This is the pairing screen
2. **"Welcome to Vizora" heading** in large white text
3. **"Pair this device with your Vizora account"** subtitle
4. **6-character code** in huge monospace font (e.g., "ABC123")
5. **White box containing a QR code** - This QR code can be scanned to initiate pairing
6. **"Enter this code at app.vizora.com/devices/pair"** instruction
7. **Loading spinner** with "Waiting for pairing..." message

## Troubleshooting

### Issue: QR code doesn't appear

**Check #1: Is middleware running?**
- In the display app console, look for: `[DeviceClient] ✅ Pairing code received successfully`
- If you see an error instead, middleware is not running

**Check #2: Verify middleware is on correct port**
- Middleware must be on http://127.0.0.1:3000
- Check `src/electron/main.ts` line 93: `const apiUrl = process.env.API_URL || 'http://localhost:3000'`

### Issue: Pairing code doesn't appear (but pairing screen shows)

- This means `getPairingCode()` request is failing
- Check browser DevTools console for error messages
- Ensure middleware is running and accessible

### Issue: Black screen with no content

- Check if a device token exists: `C:\Users\[YOU]\AppData\Roaming\@vizora\display\config.json`
- If it does and has a valid token, the app tries to connect with that token instead of pairing
- Delete the config file if you want to see the pairing screen again

### Issue: "Cannot find module" errors

Run these commands:
```bash
cd C:\Projects\vizora\vizora\display
npm install
npm run build
```

## Key Files

- **Display App Entry**: `C:\Projects\vizora\vizora\display\src\renderer\app.ts`
- **Middleware**: `C:\Projects\vizora\vizora\middleware\src\main.ts`
- **Config Storage**: `C:\Users\[username]\AppData\Roaming\@vizora\display\config.json`

## Port Requirements

- **Middleware API**: http://127.0.0.1:3000
- **Display App Dev Server**: http://127.0.0.1:4200 (optional, for development)
- **Realtime Gateway**: ws://127.0.0.1:3002 (after pairing)

## Next Steps After QR Code Appears

1. Scan the QR code with a mobile device to initiate pairing
2. Or manually enter the 6-character code at app.vizora.com/devices/pair
3. After successful pairing, the display app will show content

---

**Compiled by**: Comprehensive QR Code Fix
**Last Updated**: 2026-01-30
**Status**: Ready for Testing
