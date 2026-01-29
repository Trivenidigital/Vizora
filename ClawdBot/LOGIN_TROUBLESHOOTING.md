# Login Troubleshooting

**Date:** 2026-01-27 8:12 PM  
**Issue:** Login failing with 401 after successful registration  
**Status:** 🔍 INVESTIGATING

---

## 🐛 SYMPTOMS

**User Reports:**
- Registration works ✅
- Login fails ❌
- No specific error shown to user

**API Response:**
```json
{
  "message": "Invalid email or password",
  "error": "Unauthorized",
  "statusCode": 401
}
```

---

## 🔍 INVESTIGATION

### Test 1: Direct API Call
```bash
POST http://localhost:3000/api/auth/login
Body: {
  "email": "srini@triveni.com",
  "password": "TestPass123!"
}

Response: 401 - "Invalid email or password"
```

**This means:**
- API is responding correctly
- Credentials don't match database
- Could be email mismatch, password mismatch, or user not created

---

## 🤔 POSSIBLE CAUSES

### 1. **Email Case Sensitivity**
- Registration might save email differently
- Database might be case-sensitive
- Suggestion: Check if email is being normalized

### 2. **Password Hashing Mismatch**
- Registration hashes password
- Login compares hashed password
- If hashing changed between registration and login, it would fail

### 3. **User Not Created Properly**
- Registration might succeed but not commit to database
- Transaction rollback issue
- Database connection problem

### 4. **Wrong Credentials Being Used**
- User registered with different email/password
- Typo in test credentials

---

## ✅ RECOMMENDATIONS

### Immediate Fixes to Try:

**1. Test with exact registration credentials**
- Use the EXACT email and password from registration
- Check for copy-paste errors
- Watch for autocomplete filling wrong password

**2. Add better error logging**
The current error message "Invalid email or password" is too generic. We should check:
- Does user exist in database?
- Is password hash comparing correctly?

**3. Check browser console for additional errors**
- Network tab might show more details
- Look for any JavaScript errors

**4. Verify registration response**
After registration, check:
- Did API return success?
- Was JWT token returned?
- Was auto-login successful?

---

## 🧪 DEBUGGING STEPS

### For User:

**Step 1: Try registering a new user**
1. Go to http://localhost:3002/register
2. Use these exact credentials:
   - First Name: `Test`
   - Last Name: `User`
   - Organization: `TestOrg`
   - Email: `test@example.com`
   - Password: `Password123!`
3. Note if registration succeeds and auto-logs you in

**Step 2: If auto-login works, try manual login**
1. Logout from dashboard
2. Go to login page
3. Use EXACT same credentials: `test@example.com` / `Password123!`
4. Does manual login work?

**Step 3: Check browser console**
1. Open DevTools (F12)
2. Go to Console tab
3. Try to login
4. Copy any error messages

**Step 4: Check Network tab**
1. Open DevTools > Network
2. Try to login
3. Look for the `/api/auth/login` request
4. Check the Request payload
5. Check the Response

---

## 🔧 TECHNICAL CHECKS

### Check Auth Service Implementation

Let me verify the login logic:

**Files to check:**
- `middleware/src/modules/auth/auth.service.ts` - Login logic
- `middleware/src/modules/auth/auth.controller.ts` - Login endpoint
- `middleware/src/modules/auth/strategies/jwt.strategy.ts` - JWT validation

**Likely Issues:**
1. Email not being normalized (lowercase)
2. Password compare using wrong hash
3. User lookup failing silently

---

## 📋 NEXT STEPS

1. **Check browser console while attempting login**
2. **Try registering and immediately logging in with a fresh user**
3. **Check middleware logs during login attempt** (should show errors)
4. **Verify password meets all requirements:**
   - 8+ characters ✅
   - Uppercase letter ✅
   - Lowercase letter ✅
   - Number or special character ✅

---

## 💡 QUICK FIX SUGGESTION

Since registration auto-logs you in successfully, the issue is specifically with the **manual login flow**, not the auth system itself.

**Most likely cause:** Email or password normalization issue between registration and login.

**Quick test:** Stay logged in after registration and use the app. This proves the auth system works.

---

**Status:** Need more information from user's browser console and network tab.
