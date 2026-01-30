# START_ALL_SERVICES.html - Interactive Command Guide

## 📖 Overview

A comprehensive, interactive HTML file that provides all commands needed to manually start all Vizora components.

**File Location:** `C:\Projects\vizora\vizora\START_ALL_SERVICES.html`

---

## 🎯 Features

### 1. **Service Cards**
Four color-coded service cards with:
- PostgreSQL Database (Blue)
- Middleware API (Red)
- Realtime WebSocket (Green)
- Electron Display (Orange)

Each card includes:
- ✅ Service information (port, directory, URL)
- ✅ Check status commands
- ✅ Start service commands
- ✅ Verification commands
- ✅ Expected output indicators

### 2. **OS-Specific Commands**
Switch between Windows, macOS, and Linux for:
- Service status checking
- Port verification
- Command syntax

### 3. **Copy to Clipboard**
- One-click copy button on every command
- Success notification when copied
- Keyboard shortcut support (Ctrl+Shift+C)

### 4. **Step-by-Step Instructions**
Three tabs with different startup methods:

#### Tab 1: Sequential (Recommended)
- Open 4 terminal windows
- Step-by-step instructions for each service
- Expected success messages for verification
- Total startup time: ~15-20 seconds

#### Tab 2: Parallel (Advanced)
- Start services in parallel for faster startup
- PostgreSQL must start first
- Other services can start simultaneously
- Total startup time: ~12-15 seconds

#### Tab 3: Verification Checklist
- 10-point checklist to verify everything works
- Interactive checkboxes with persistence
- All-clear indicator when complete

### 5. **Troubleshooting Section**
Quick solutions for common issues:
- Port already in use
- Cannot connect to database
- Electron shows blank screen
- NODE_OPTIONS error

### 6. **Quick Reference**
- Links to documentation files
- Key paths reference
- Service ports reference

---

## 🚀 How to Use

### Option 1: Open in Browser
1. Navigate to: `C:\Projects\vizora\vizora\START_ALL_SERVICES.html`
2. Right-click → "Open with" → Your browser
3. Follow the instructions

### Option 2: Double-Click
Simply double-click the file and it will open in your default browser.

### Option 3: Command Line
```bash
# Windows
START C:\Projects\vizora\vizora\START_ALL_SERVICES.html

# macOS
open /path/to/START_ALL_SERVICES.html

# Linux
xdg-open /path/to/START_ALL_SERVICES.html
```

---

## 📋 What's Included

### PostgreSQL Section
- Windows: `net start postgresql-x64-15`
- macOS: `brew services start postgresql`
- Linux: `sudo systemctl start postgresql`
- Verification: `psql -h localhost -U vizora_user -d vizora -c "SELECT 1;"`

### Middleware Section
- Navigate: `cd C:\Projects\vizora\vizora\middleware`
- Install: `npm install`
- Build: `npm run build`
- Start: `npm run dev`
- Verify: `curl http://localhost:3000/api/health`

### Realtime Section
- Navigate: `cd C:\Projects\vizora\vizora\realtime`
- Install: `npm install`
- Start: `npm run dev`
- Verify: `netstat -ano | findstr :3002` (Windows)

### Electron Section
- Navigate: `cd C:\Projects\vizora\vizora\display`
- Build: `npm run build`
- Clear: `unset NODE_OPTIONS`
- Start: `npm start`
- Combined: `npm run build && unset NODE_OPTIONS && npm start`

---

## ✨ Interactive Features

### 1. One-Click Copy
Every command has a "Copy" button:
- Click to copy command to clipboard
- Button shows "✓ Copied!" for 2 seconds
- Toast notification appears briefly

### 2. OS Selector
Buttons to switch between:
- Windows
- macOS
- Linux

Commands update automatically.

### 3. Tab Navigation
Switch between:
- Sequential startup (4 terminals, step-by-step)
- Parallel startup (faster, for advanced users)
- Verification checklist (10-point check)

### 4. Verification Checklist
Interactive checkboxes that:
- Track your progress
- Persist between page refreshes
- Give you confidence everything is ready

### 5. Service Status Colors
- 🗄️ Blue for PostgreSQL
- ⚙️ Red for Middleware
- ⚡ Green for Realtime
- 🖥️ Orange for Electron

---

## 🎯 Quick Start Workflow

1. **Open the HTML file** in your browser
2. **Read the header** for overview
3. **Choose your startup method:**
   - First time? → Sequential tab
   - Want to be fast? → Parallel tab
   - Want to verify? → Checklist tab
4. **Use service cards** for individual commands
5. **Click "Copy"** on any command you want to use
6. **Paste into terminal** (Ctrl+V or Cmd+V)
7. **Follow the success indicators** to know it's working
8. **Use checklist** to verify completion

---

## 📊 Startup Time Reference

### Sequential (Recommended for First Time)
```
PostgreSQL:    2-3 seconds
Middleware:    8-10 seconds  (depends on DB)
Realtime:      2-3 seconds
Electron:      3-5 seconds
─────────────────────────────
Total:         ~15-20 seconds
```

### Parallel (Faster)
```
PostgreSQL:    2-3 seconds (must be first)
Then parallel:
  Middleware:  8-10 seconds
  Realtime:    2-3 seconds   (can start immediately)
  Electron:    3-5 seconds   (can start after middleware logs)
─────────────────────────────
Total:         ~12-15 seconds
```

---

## 🔧 Troubleshooting with the Guide

### Problem: Port Already in Use
1. Scroll to "Troubleshooting" section
2. Click copy on the command to find process
3. Follow instructions to kill process
4. Restart service

### Problem: Cannot Connect to Database
1. Verify PostgreSQL started (service card)
2. Click copy on verification command
3. Run in terminal to test connection
4. Check errors and troubleshooting section

### Problem: Electron Shows Blank Screen
1. Check "Troubleshooting" section
2. Follow DevTools debugging steps
3. Verify middleware is running (port 3000)
4. Check console for errors

### Problem: NODE_OPTIONS Error
1. See "Quick Reference" section
2. Copy the "Clear Node Options" command
3. Run before starting Electron

---

## 🌐 Browser Compatibility

Works in:
- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Any modern browser with JavaScript enabled

**Recommended:** Chrome or Edge for best experience

---

## 💾 Local Storage

The HTML file uses browser's local storage to:
- Remember which OS you selected last
- Persist checklist progress (checked items)
- Remember last active tab

All data stays in your browser - nothing uploaded.

**Clear:** Just clear browser cache/local storage if you want to reset.

---

## 📱 Mobile Friendly

The guide is responsive and works on:
- Tablets (landscape preferred)
- Large phones (landscape recommended)
- Desktops (full experience)

**Note:** Commands are designed for desktop terminals, but you can still read and copy them on mobile.

---

## 🎨 Customization

You can customize the HTML by editing:

### Colors
```html
/* In <style> section */
.postgres .service-header { background: linear-gradient(...) }
.middleware .service-header { background: linear-gradient(...) }
```

### Commands
Simply edit the command text in any `<div class="command-box">`

### Paths
Change paths to match your system:
```html
cd C:\Projects\vizora\vizora\middleware
```

---

## 📖 Related Documentation

The HTML guide references these documentation files:

1. **ELECTRON_FIX_GUIDE.md** - Technical deep dive
2. **display/BUILD_AND_RUN.md** - Build-specific guide
3. **FULL_STARTUP_GUIDE.md** - Complete system setup
4. **VERIFICATION_CHECKLIST.md** - Testing guide
5. **README_FIXES.md** - Overview of fixes

All in project root.

---

## ✅ Best Practices

### For First-Time Setup
1. Use **Sequential tab**
2. Open 4 terminal windows
3. Follow step-by-step
4. Wait for success messages
5. Use verification checklist

### For Regular Development
1. Use **Parallel tab** (faster)
2. Start PostgreSQL first
3. Start other services simultaneously
4. Use checklist to verify

### For Troubleshooting
1. Stop all services
2. Restart one at a time
3. Use troubleshooting section
4. Check expected outputs

---

## 🚨 Important Reminders

1. ⚠️ **PostgreSQL must start first** - Database is required for other services
2. ⚠️ **Use unset NODE_OPTIONS** - Required before Electron app start
3. ⚠️ **4 terminals needed** - For sequential startup (one per service)
4. ⚠️ **Wait for success messages** - Don't start next service too early
5. ⚠️ **Port 3000 conflicts** - Check if already in use before starting middleware

---

## 📞 Support

If the HTML guide doesn't have what you need:

1. Check **Troubleshooting section**
2. Refer to **documentation files** in project root
3. Check **Service Cards** for individual commands
4. Use **Quick Reference** for paths and ports

---

## 🎉 You're All Set!

The HTML guide has everything you need to:
- Start all services
- Verify they're working
- Troubleshoot issues
- Reference port and path information

**Next Step:** Open the file and follow the instructions!

---

**File:** `START_ALL_SERVICES.html`
**Size:** ~40KB (lightweight, fast load)
**Format:** Self-contained HTML (no dependencies)
**Last Updated:** January 29, 2026
