# Testing the Vizora Display App

## Prerequisites

1. **Middleware must be running:**
   ```bash
   # In the middleware directory
   npm run dev
   ```
   - Should be accessible at http://localhost:3000
   - Check: http://localhost:3000/api (should return 401 Unauthorized - that's expected)

2. **Build the display app:**
   ```bash
   # In this directory (vizora/display)
   npm run build
   ```

## Running the App

### Option 1: Using npm start (Recommended)
```bash
npm start
```

### Option 2: Direct electron execution
```bash
# Clear NODE_OPTIONS to avoid warnings
$env:NODE_OPTIONS=$null
.\node_modules\.bin\electron.cmd .
```

## What You Should See

### 1. Electron Window Opens
- Window size: 1200x800
- DevTools panel open (for debugging)
- Clean console output (no red errors)

### 2. Pairing Screen (If No Device Token Stored)
You should see:
- **Title:** "Welcome to Vizora"
- **Instructions:** "Pair this device with your Vizora account"
- **QR Code:** A generated QR code (white background)
- **Pairing Code:** 6-character code (e.g., "5KX2HQ")
- **URL:** "Enter this code at app.vizora.com/devices/pair"
- **Loading Spinner:** Animated spinner with "Waiting for pairing..." text

### 3. Console Output (In DevTools)
```
[Preload] Initializing electronAPI...
[Preload] ✅ electronAPI exposed successfully
[App] electronAPI initialized successfully
```

## Testing the Pairing Flow

1. **Note the pairing code** displayed in the app
2. **Open a browser** to http://localhost:3001/dashboard/devices/pair?code=YOUR_CODE
3. **Complete the pairing** in the web UI
4. **Watch the electron app** - it should automatically detect the pairing and switch to the content screen

## Common Issues

### Black Screen with No Content
**Fixed!** This was the original issue. If you still see this:
- Check DevTools console for errors
- Verify preload script logs appear
- Rebuild: `npm run build`

### "window.electronAPI is undefined" Error
**Fixed!** The defensive checks now prevent this from crashing the app.
If you see the preload error screen:
- Check that preload.js exists in dist/electron/
- Verify main.ts has correct preload path
- Rebuild the electron TypeScript: `npx tsc -p tsconfig.electron.json`

### Middleware Connection Errors
Check console for errors like "Failed to get pairing code"
- Verify middleware is running: `curl http://localhost:3000/api`
- Check middleware logs for errors
- Ensure API_URL environment variable is correct (defaults to http://localhost:3000)

### Dev Server Still Running
If app loads from http://localhost:4200 instead of dist:
```bash
# Kill any webpack-dev-server processes
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force
```

## Verification Checklist

- [ ] Electron window opens successfully
- [ ] DevTools show no red errors
- [ ] Preload logs appear in console
- [ ] App initialization logs appear
- [ ] Pairing screen is visible (not black)
- [ ] Pairing code is displayed
- [ ] QR code image is visible
- [ ] Code updates when page refreshes
- [ ] Pairing detection works (test with middleware)

## Debug Mode

To see more detailed logging:
1. Open DevTools (should open automatically)
2. Check Console tab
3. Look for `[Preload]` and `[App]` prefixed messages

## Clean Rebuild

If you encounter issues:
```bash
# Clean build artifacts
Remove-Item -Recurse -Force dist

# Rebuild everything
npm run build

# Run app
npm start
```

## Success Criteria

✅ **The fix is successful if:**
1. Window shows UI (not black)
2. Pairing screen displays all elements
3. No "window.electronAPI is undefined" errors
4. App can request pairing codes from middleware
5. QR code and pairing code are visible

---

**For further testing:**
- Test content playback (requires paired device and playlist)
- Test WebSocket realtime connection
- Test heartbeat functionality
- Test error recovery

**Status:** Ready for visual verification and end-to-end integration testing
