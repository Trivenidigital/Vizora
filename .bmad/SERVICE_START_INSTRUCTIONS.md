# 🚀 Vizora Services - Start Instructions

**Date:** 2026-01-28  
**Status:** Services need manual start

---

## ❌ Issue Encountered

While trying to auto-start services, encountered build issues:
- Middleware has Prisma client path resolution issues
- Webpack build failing due to missing `generated/prisma/index.js`

---

## ✅ Manual Start Instructions

### Option 1: Use Existing Running Processes (If Any)

If you already have terminals running these services, just verify they're working:

```powershell
# Test middleware
curl http://localhost:3000/api/health

# Test web app
curl http://localhost:3001

# Test realtime
curl http://localhost:3002
```

---

### Option 2: Start Services Manually

**Terminal 1 - Middleware:**
```powershell
cd C:\Projects\vizora\vizora\middleware
# Try development mode with ts-node
npx ts-node -r tsconfig-paths/register src/main.ts

# OR if that doesn't work, try:
node dist/main.js
```

**Terminal 2 - Web App:**
```powershell
cd C:\Projects\vizora\vizora\web
npm run dev
# OR
npx next dev -p 3001
```

**Terminal 3 - Realtime (Already Running ✅):**
```powershell
# Already confirmed running on port 3002
# No action needed
```

---

### Option 3: Use NX (If Build Works)

```powershell
cd C:\Projects\vizora\vizora

# Terminal 1 - Middleware
npx nx serve middleware

# Terminal 2 - Web
npx nx serve web

# Terminal 3 - Realtime (already running)
```

---

## 🔧 Fixing Prisma Issue (If Needed)

If middleware won't start due to Prisma:

```powershell
cd C:\Projects\vizora\vizora\packages\database

# Regenerate Prisma client
npx prisma generate

# Rebuild package
npx tsc --build

# Copy generated files to dist
New-Item -ItemType Directory -Force -Path "dist\generated\prisma"
Copy-Item "src\generated\prisma\*" -Destination "dist\generated\prisma\" -Recurse -Force
```

---

## ✅ Verify Services Running

```powershell
# Check ports
netstat -ano | findstr ":3000"  # Middleware
netstat -ano | findstr ":3001"  # Web
netstat -ano | findstr ":3002"  # Realtime

# OR use PowerShell
Test-NetConnection -ComputerName localhost -Port 3000
Test-NetConnection -ComputerName localhost -Port 3001
Test-NetConnection -ComputerName localhost -Port 3002
```

---

## 🌐 Access URLs

Once running:
- **Middleware API:** http://localhost:3000/api/health
- **Web App:** http://localhost:3001
- **Realtime:** http://localhost:3002 (WebSocket)

---

## 🎯 Quick Status Check

Run this to check all services:

```powershell
$services = @(
    @{Name="Middleware"; Port=3000},
    @{Name="Web App"; Port=3001},
    @{Name="Realtime"; Port=3002}
)

foreach ($svc in $services) {
    $test = Test-NetConnection -ComputerName localhost -Port $svc.Port -WarningAction SilentlyContinue -InformationLevel Quiet
    if ($test) {
        Write-Host "✅ $($svc.Name) (port $($svc.Port)): RUNNING" -ForegroundColor Green
    } else {
        Write-Host "❌ $($svc.Name) (port $($svc.Port)): NOT RUNNING" -ForegroundColor Red
    }
}
```

---

## 📋 What to Do Next

1. **Check if services are already running** (you may have them open in other terminals)
2. **If not**, open 2 new terminals and start middleware + web manually
3. **Verify** all 3 services respond
4. **Then** proceed with testing!

---

## 🆘 If Still Having Issues

Check these common problems:

**Port already in use:**
```powershell
# Find process using port
netstat -ano | findstr ":3000"
# Kill process
Stop-Process -Id <PID> -Force
```

**Database not running:**
```powershell
# Check if PostgreSQL is running
Get-Service -Name postgresql*
```

**Redis not running:**
```powershell
# Check if Redis is running
Get-Process redis-server -ErrorAction SilentlyContinue
```

---

**Status:** Manual start required  
**Next:** Start services, then begin testing!
