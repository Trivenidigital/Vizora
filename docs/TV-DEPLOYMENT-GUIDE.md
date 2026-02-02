# Vizora TV Deployment Guide

This guide explains how to deploy Vizora display clients on various TV platforms.

## Overview

Vizora supports multiple deployment methods to cover all major Smart TV platforms:

| Platform | Method | Recommended For |
|----------|--------|-----------------|
| Android TV / Google TV | APK Install | Large deployments |
| Amazon Fire TV | APK Sideload | Fire TV devices |
| Samsung Tizen | Web Browser / Tizen App | Samsung Smart TVs |
| LG webOS | Web Browser / webOS App | LG Smart TVs |
| Roku | Web Browser (limited) | Roku devices |
| Raspberry Pi | Chromium Kiosk | DIY/Budget setups |
| Windows/Mac/Linux | Electron App | PCs connected to displays |

---

## Method 1: Web-Based Display (Universal)

**Works on: ALL Smart TVs with a web browser**

This is the easiest method and works on any device with a modern web browser.

### Setup Steps:

1. **On Your Server:**
   ```bash
   cd display-web
   npm install
   npm run build
   ```

   Deploy the `dist` folder to your web server (e.g., `https://display.yourdomain.com`)

2. **On Each TV:**
   - Open the TV's web browser
   - Navigate to your display URL: `https://display.yourdomain.com`
   - The pairing screen will appear with a QR code and pairing code
   - From your Vizora dashboard, pair the device using the code

3. **For Kiosk Mode (recommended):**
   - Samsung: Use "URL Launcher" app from Samsung Business
   - LG: Use "Pro:Centric" or web browser in kiosk mode
   - Android TV: Use "Fully Kiosk Browser" app

### Configuration via URL Parameters:

```
https://display.yourdomain.com?api_url=https://api.vizora.io&realtime_url=wss://realtime.vizora.io
```

---

## Method 2: Android TV / Fire TV (APK)

**Works on: Android TV, Google TV, Amazon Fire TV, Fire TV Stick**

### Building the APK:

We use Capacitor to convert the web app to a native Android app.

1. **Setup Capacitor:**
   ```bash
   cd display-android
   npm install
   npx cap init "Vizora Display" "com.vizora.display"
   npx cap add android
   ```

2. **Build:**
   ```bash
   npm run build
   npx cap sync android
   cd android
   ./gradlew assembleRelease
   ```

3. **APK Location:** `android/app/build/outputs/apk/release/app-release.apk`

### Installing on Android TV:

**Option A: Google Play Store (recommended for production)**
- Enroll in Google Play Developer program
- Upload APK and submit for review
- Users install from Play Store

**Option B: Sideload via USB**
1. Enable Developer Mode on the TV
2. Connect USB drive with APK
3. Use a file manager to install

**Option C: Sideload via ADB**
```bash
adb connect <TV_IP_ADDRESS>
adb install app-release.apk
```

### Installing on Fire TV:

1. Enable "Apps from Unknown Sources" in Settings
2. Download "Downloader" app from Amazon App Store
3. Enter URL to your hosted APK
4. Install and launch

---

## Method 3: Samsung Tizen

**Works on: Samsung Smart TVs (2015+)**

### Option A: Web Browser (Quick Setup)
1. Press Home button on remote
2. Navigate to "Internet" or "Web Browser"
3. Enter your display URL
4. Bookmark for quick access
5. For kiosk mode, use Samsung Business TV "URL Launcher"

### Option B: Native Tizen App (Enterprise)

1. **Install Tizen Studio:** https://developer.samsung.com/tizen

2. **Create Tizen Web App:**
   ```bash
   cd display-tizen
   tizen build-web
   tizen package -t wgt -s <certificate>
   ```

3. **Deploy:**
   - For development: `tizen install -n VizorDisplay.wgt`
   - For production: Submit to Samsung Seller Office

---

## Method 4: LG webOS

**Works on: LG Smart TVs (2014+)**

### Option A: Web Browser (Quick Setup)
1. Press Home button
2. Launch "Web Browser"
3. Navigate to your display URL
4. Add to bookmarks

### Option B: Native webOS App (Enterprise)

1. **Install webOS SDK:** https://webostv.developer.lge.com/

2. **Create webOS App:**
   ```bash
   cd display-webos
   ares-package .
   ares-install com.vizora.display_1.0.0_all.ipk
   ```

3. **For Commercial Displays:**
   - Use LG Pro:Centric or SuperSign
   - Contact LG Business Solutions

---

## Method 5: Raspberry Pi (Budget Option)

**Perfect for: Budget deployments, DIY setups, legacy TVs**

### Hardware Needed:
- Raspberry Pi 4 (2GB+ RAM recommended)
- MicroSD Card (16GB+)
- HDMI cable
- Power supply
- Optional: Case, cooling

### Setup:

1. **Flash Raspberry Pi OS Lite:**
   ```bash
   # On your computer
   # Use Raspberry Pi Imager to flash the OS
   ```

2. **Configure Auto-Start Browser:**
   ```bash
   # SSH into Pi
   sudo apt update
   sudo apt install chromium-browser xorg

   # Create autostart script
   sudo nano /etc/xdg/lxsession/LXDE-pi/autostart
   ```

   Add:
   ```
   @xset s off
   @xset -dpms
   @xset s noblank
   @chromium-browser --kiosk --noerrdialogs --disable-infobars https://display.yourdomain.com
   ```

3. **Reboot and Test:**
   ```bash
   sudo reboot
   ```

### Alternative: Raspberry Pi Signage OS

Use a dedicated signage OS like:
- **Screenly OSE** (free, open source)
- **Yodeck** (managed service)
- **PiSignage** (enterprise features)

---

## Method 6: Electron App (Desktop/Windows)

**Works on: Windows, macOS, Linux PCs connected to TVs/Displays**

### Building Installers:

```bash
cd display
npm install
npm run build

# Windows
npm run package:win

# macOS
npm run package:mac

# Linux
npm run package:linux
```

### Output Files:
- Windows: `dist/Vizora Display Setup.exe`
- macOS: `dist/Vizora Display.dmg`
- Linux: `dist/vizora-display.AppImage`

---

## Production Deployment Checklist

### Server Configuration:

1. **Environment Variables:**
   ```env
   # API Server
   API_BASE_URL=https://api.yourdomain.com

   # Realtime Server (WebSocket)
   REALTIME_URL=wss://realtime.yourdomain.com

   # Dashboard
   DASHBOARD_URL=https://dashboard.yourdomain.com
   ```

2. **CORS Configuration:**
   Ensure your API allows requests from display clients.

3. **SSL Certificates:**
   All production URLs must use HTTPS/WSS.

### TV Configuration Best Practices:

1. **Network:**
   - Use wired Ethernet when possible
   - Ensure firewall allows WebSocket connections
   - Configure static IP for easier management

2. **Power Management:**
   - Disable auto-sleep/screen saver
   - Configure TV to auto-power on after power loss
   - Use CEC to control power via HDMI

3. **Security:**
   - Change default passwords
   - Disable unnecessary services
   - Keep firmware updated

4. **Monitoring:**
   - Set up heartbeat monitoring
   - Configure alerts for offline devices
   - Use remote management when available

---

## Troubleshooting

### Display shows "Connecting..."
- Check network connectivity
- Verify realtime server is running
- Check WebSocket port is accessible (usually 3002)

### QR Code not scanning
- Ensure camera app supports QR codes
- Try entering pairing code manually
- Check if display URL is accessible

### Content not loading
- Verify content URLs are accessible from TV network
- Check CORS settings on content server
- Ensure content format is supported by platform

### Black screen after pairing
- Verify playlist is assigned to the device
- Check realtime server logs for errors
- Restart display app

---

## Support Matrix

| Feature | Web | Android | Electron | Tizen | webOS |
|---------|-----|---------|----------|-------|-------|
| Images (JPG, PNG) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Videos (MP4, WebM) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Web Pages | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| 4K Support | ✅ | ✅ | ✅ | ✅ | ✅ |
| HDR Support | ⚠️ | ✅ | ⚠️ | ✅ | ✅ |
| Remote Management | ✅ | ✅ | ✅ | ✅ | ✅ |
| Offline Caching | ❌ | ✅ | ✅ | ❌ | ❌ |
| Auto-Start | ⚠️ | ✅ | ✅ | ✅ | ✅ |

✅ = Full support | ⚠️ = Partial/platform-dependent | ❌ = Not supported
