# Testing Content Push - Step by Step Guide

## ✅ Prerequisites Check

All services should be running:
- ✅ **Middleware API**: http://localhost:3000/api (Port 3000)
- ✅ **Web App**: http://localhost:3001 (Port 3001)  
- ✅ **Realtime Gateway**: ws://localhost:3002 (Port 3002)
- ✅ **Display App**: Electron app with paired device

### Services Status (as of 10:25 PM)
```
✅ Middleware: Running (PID 38980)
✅ Web App: Running (PID 31244)
✅ Realtime: Running (PID 37536) - JUST STARTED
✅ Display: Running (PID 24960) - Already paired as "Food1"
✅ Redis: Connected
```

## 📋 Testing Steps

### Step 1: Verify All Services Running
Open browser console and check:
1. Navigate to http://localhost:3001/dashboard
2. Open DevTools (F12)
3. Check Network tab for API calls

### Step 2: Navigate to Content Library
1. From dashboard, click "Content" in sidebar
2. You should see existing content (e.g., the content uploaded earlier)

### Step 3: Push Content to Device
1. Find the content item you want to push
2. Click the **"Push"** button (green button with upload icon)
3. A modal should appear: "Push to Devices"
4. Check the device "Food1" (should show as "online")
5. Click **"Push to 1 Device(s)"** button

### Step 4: Observe What Happens

**Expected Behavior:**

#### In Web App Browser Console:
```
[API] Request: POST http://localhost:3000/api/playlists
[API] Response status: 201 OK
[API] Request: PATCH http://localhost:3000/api/displays/{id}
[API] Response status: 200 OK
```

#### In Middleware Console:
```log
[DisplaysService] Notified realtime service of playlist update for display {id}
```

#### In Realtime Console:
```log
[AppController] Received playlist push request for device {id}
[DeviceGateway] Sent playlist update to device: {id}
```

#### In Display App DevTools Console:
```log
[RENDERER-INFO] Received playlist update: {playlist data}
[App] Received playlist update: {playlist}
[App] Playing content...
```

#### On Display Screen:
**The content should appear within 2-3 seconds!** 🎉
- Image → Shows on screen
- Video → Starts playing
- URL → Loads in iframe

### Step 5: Verify Content is Playing
1. Look at the Display app window
2. Content should be rendered
3. Check DevTools console for any errors

## 🐛 Troubleshooting

### Issue: Display shows black screen

**Check #1: Is device connected to WebSocket?**
```
In Display App Console, look for:
"Connected to realtime gateway" ✅
```

**Check #2: Did playlist update event fire?**
```
Look for: "Received playlist update: {data}"
If missing → WebSocket not receiving updates
```

**Check #3: Are there rendering errors?**
```
Look for: "[RENDERER-ERROR]" messages
Common issues:
- Image load failed → Check URL
- Video load failed → Check format/codec
- Content source invalid
```

### Issue: "Failed to push content" error in web app

**Check middleware logs:**
```
- Is HTTP service injected?
- Is realtime URL correct?
- Did POST to realtime fail?
```

**Check realtime logs:**
```
- Did it receive the POST request?
- Did sendPlaylistUpdate() execute?
```

### Issue: Content pushes but display doesn't update

**Most likely:** Display is not connected to WebSocket

**Solution:**
1. Check Display App → DevTools → Console
2. Look for "Connected to realtime gateway"
3. If disconnected, check:
   - Device token valid?
   - Realtime service running on port 3002?
   - WebSocket connection established?

## 📊 Log Analysis

### Successful Push Flow

**1. Web App** (Browser Console):
```
[API] Request: POST http://localhost:3000/api/playlists
[API] Response status: 201 OK
  data: {
    id: "cm6hp...",
    name: "Quick Push - {content title}",
    items: [...]
  }

[API] Request: PATCH http://localhost:3000/api/displays/cm6hp...
  body: { currentPlaylistId: "cm6hp..." }
[API] Response status: 200 OK
```

**2. Middleware** (Terminal):
```
[DisplaysService] Updating display cm6hp...
[DisplaysService] Fetching playlist cm6hp... with items
[DisplaysService] Notified realtime service of playlist update for display cm6hp...
```

**3. Realtime** (Terminal):
```
[AppController] POST /api/push/playlist
[AppController] deviceId: cm6hp..., playlist: {...}
[DeviceGateway] Sent playlist update to device: cm6hp...
```

**4. Display App** (DevTools):
```
[RENDERER-INFO] Received playlist update: {
  playlist: {
    id: "cm6hp...",
    name: "Quick Push - ...",
    items: [
      {
        content: {
          type: "image",
          source: "http://..."
        },
        duration: 30
      }
    ]
  }
}
[App] Received playlist update
[App] updatePlaylist called
[App] currentIndex = 0
[App] playContent called
[App] Rendering image: http://...
[App] logImpression sent
```

**5. Display Screen**:
```
🖼️ IMAGE RENDERED ON SCREEN
```

## 🔍 Quick Checks

Run these commands in PowerShell to verify services:

```powershell
# Check ports
Test-NetConnection localhost -Port 3000  # Middleware
Test-NetConnection localhost -Port 3001  # Web
Test-NetConnection localhost -Port 3002  # Realtime

# Check processes
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Select-Object Id, ProcessName

# Check Redis
redis-cli ping  # Should return "PONG"
```

## 📝 What Was Fixed

### Before (Bug):
```typescript
const confirmPush = async () => {
  const playlist = await apiClient.createPlaylist({...});
  
  // ❌ TODO: Assign to devices
  toast.success("Content pushed");  // LIE!
}
```

### After (Fixed):
```typescript
const confirmPush = async () => {
  const playlist = await apiClient.createPlaylist({...});
  
  // ✅ Actually assign to devices
  await Promise.all(
    selectedDevices.map(deviceId =>
      apiClient.updateDisplay(deviceId, { 
        currentPlaylistId: playlist.id 
      })
    )
  );
  
  // ✅ Middleware notifies realtime service
  // ✅ Realtime service pushes to device via WebSocket
  
  toast.success("Content pushed");  // TRUTH!
}
```

## 🎯 Success Criteria

- ✅ Playlist created in database
- ✅ Display's `currentPlaylistId` updated
- ✅ Middleware calls realtime service
- ✅ Realtime service emits WebSocket event
- ✅ Display app receives `playlist:update`
- ✅ Display app calls `updatePlaylist()`
- ✅ Content renders on screen
- ✅ User sees content within 3 seconds

---

**Ready to test!** 🚀

Follow the steps above and report back what you see!
