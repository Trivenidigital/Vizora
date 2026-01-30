# 🔍 Login Debug Instructions

**Date:** 2026-01-27 8:35 PM  
**Status:** Debug logging enabled + Test page created

---

## ✅ What I Just Did

### 1. Added Detailed Console Logging
Updated `web/src/lib/api.ts` with extensive logging:
- Every API request logs URL and method
- Every response logs status code
- Login/Register methods log full response structure
- Token extraction logged step-by-step
- localStorage operations logged

### 2. Created Test Page
Created standalone test page: `web/public/test-login.html`

---

## 🧪 HOW TO DEBUG

### Option 1: Use Test Page (RECOMMENDED)

1. **Start your servers:**
   ```powershell
   # In 3 separate terminals:
   pnpm --filter middleware dev
   pnpm --filter realtime dev
   pnpm --filter web dev
   ```

2. **Open test page:**
   - Go to: http://localhost:3002/test-login.html
   - Fill in credentials (or use defaults)
   - Click "1️⃣ Register New User"
   - Then click "2️⃣ Test Login"
   - Watch detailed logs appear on page

3. **What to look for:**
   - Does it say "✅ TOKEN FOUND"?
   - Does it say "✅ Token saved to localStorage"?
   - If ❌ appears, screenshot the error

### Option 2: Use Main App with Console Logging

1. **Start servers**

2. **Open main app with DevTools:**
   - Go to: http://localhost:3002/register
   - Press `F12` to open DevTools
   - Go to **Console** tab
   - Keep console visible

3. **Try registration:**
   - Fill form and click "Create Account"
   - Watch console for logs starting with `[API]`
   - Look for:
     ```
     [API] Register response received: {...}
     [API] ✅ Token found in register, calling setToken()
     [API] ✅ Token saved to localStorage
     ```

4. **Try login:**
   - If registration worked, logout
   - Go to login page
   - Try logging in
   - Watch console for `[API]` logs

5. **Screenshot console if login fails**

---

## 📋 What I Need From You

Please do **ONE** of these:

### Quick Test (5 minutes):
1. Open http://localhost:3002/test-login.html
2. Click "1️⃣ Register New User"
3. Click "2️⃣ Test Login"
4. Screenshot the results section
5. Send me the screenshot

### Full Test (10 minutes):
1. Open http://localhost:3002/register with DevTools (F12)
2. Go to Console tab
3. Register a new user
4. Screenshot the console logs
5. Try to login
6. Screenshot console logs again
7. Send me both screenshots

---

## 🎯 What The Logs Will Show

The console will show EXACTLY where the process fails:

**If backend is wrong:**
```
[API] Response data: { success: false, message: "..." }
[API] ❌ TOKEN NOT FOUND in response!
```

**If frontend parsing is wrong:**
```
[API] Response data: { success: true, data: {...} }
[API] Response structure: { hasToken: false }
[API] ❌ TOKEN NOT FOUND in response!
```

**If everything works:**
```
[API] Response data: { success: true, data: { token: "..." } }
[API] ✅ Token found, calling setToken()
[API] ✅ Token saved to localStorage
```

---

## 🔧 Files Changed

1. `web/src/lib/api.ts` - Added console.log() throughout
2. `web/public/test-login.html` - New standalone test page

**Both will show detailed logs when you test.**

---

## 📞 Next Steps

1. **Start all 3 servers**
2. **Open test page** (http://localhost:3002/test-login.html)
3. **Click buttons and screenshot results**
4. **Send me screenshot**

Then I can see EXACTLY what's happening and fix the specific issue.

---

**The logging will reveal the truth!** 🔍
