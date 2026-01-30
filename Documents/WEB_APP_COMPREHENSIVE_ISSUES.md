# Vizora Web App - Comprehensive Issues & Fixes

**Testing Date:** 2026-01-27  
**Status:** 🔴 Multiple Critical Issues Found  
**Web Server:** Running on http://localhost:3002  
**API Server:** Should be http://localhost:3000/api

---

## ✅ FIXED ISSUES

### 1. API URL Configuration ✅
**File:** `web/.env.local`  
**Issue:** API URL pointed to wrong port  
**Fix Applied:**
```diff
- NEXT_PUBLIC_API_URL=http://localhost:3000/api
+ # Middleware API is on port 4000 (see middleware project.json)
+ NEXT_PUBLIC_API_URL=http://localhost:4000/api
```
⚠️ **NEEDS VERIFICATION:** Actual middleware port (check if 3000 or 4000)

---

## 🔴 CRITICAL ISSUES (Need Immediate Fix)

### 2. No Authentication Guard
**Files:** All dashboard pages  
**Impact:** HIGH - Security vulnerability  
**Issue:** Dashboard pages accessible without authentication  

**Recommendation:**
```typescript
// Create middleware.ts in web/src/
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('authToken')?.value;
  
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.response;
}

export const config = {
  matcher: '/dashboard/:path*',
};
```

### 3. Missing Error Boundaries
**File:** `web/src/app/layout.tsx`  
**Impact:** MEDIUM - Poor UX on errors  
**Issue:** No global error boundary  

**Recommendation:**
```typescript
// Create error.tsx in web/src/app/
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Something went wrong!
        </h2>
        <button
          onClick={reset}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
```

### 4. API Error Handling - No Response Interceptor
**File:** `web/src/lib/api.ts`  
**Impact:** HIGH - 401/403 responses not handled globally  
**Issue:** No automatic logout on auth failures  

**Fix Needed:**
```typescript
private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // ... existing code ...
  
  if (!response.ok) {
    // Handle 401/403 - Clear token and redirect
    if (response.status === 401 || response.status === 403) {
      this.clearToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}
```

---

## ⚠️ HIGH PRIORITY ISSUES

### 5. Promise.allSettled Not Used
**Files:** 
- `web/src/app/dashboard/page.tsx` (line 18-23)
- Other pages with parallel API calls

**Impact:** If one API call fails, all stats fail  
**Current Code:**
```typescript
const [devicesRes, contentRes, playlistsRes] = await Promise.all([
  apiClient.getDisplays().catch(() => ({ data: [] })),
  // ...
]);
```

**Better Approach:**
```typescript
const results = await Promise.allSettled([
  apiClient.getDisplays(),
  apiClient.getContent(),
  apiClient.getPlaylists(),
]);

const devices = results[0].status === 'fulfilled' ? results[0].value.data || [] : [];
const content = results[1].status === 'fulfilled' ? results[1].value.data || [] : [];
const playlists = results[2].status === 'fulfilled' ? results[2].value.data || [] : [];
```

### 6. Missing Loading States on Actions
**Files:** Multiple pages  
**Issue:** Action buttons don't show loading state consistently  
**Impact:** Poor UX - users might double-click  

**Example from devices/page.tsx:**
```typescript
const [actionLoading, setActionLoading] = useState(false);
```
This is good but needs to be applied consistently across all action buttons.

### 7. No Validation on Forms
**Files:** Login, Register, Upload modals  
**Issue:** Only HTML5 validation, no client-side validation library  
**Recommendation:** Add `react-hook-form` with `zod` validation

### 8. Toast Notifications - Memory Leak Risk
**File:** `web/src/lib/hooks/useToast.tsx`  
**Issue:** Toasts don't auto-dismiss  
**Impact:** Toasts accumulate in memory  

**Fix:**
```typescript
const showToast = useCallback((message: string, type: ToastType = 'info', duration = 5000) => {
  const id = Math.random().toString(36).substring(7);
  setToasts((prev) => [...prev, { id, message, type }]);
  
  // Auto-remove after duration
  setTimeout(() => {
    removeToast(id);
  }, duration);
}, [removeToast]);
```

---

## 🟡 MEDIUM PRIORITY ISSUES

### 9. Hardcoded User Info
**File:** `web/src/app/dashboard/layout.tsx` (line 81-84)  
**Issue:** User info is hardcoded  
```typescript
<div className="text-sm font-medium text-gray-900">Admin User</div>
<div className="text-xs text-gray-500">admin@vizora.com</div>
```

**Fix:** Fetch user info from API or JWT token

### 10. Missing Type Safety on API Responses
**File:** `web/src/lib/api.ts`  
**Issue:** API methods return `any` instead of typed responses  
**Example:**
```typescript
async getDisplays(params?: { page?: number; limit?: number }) {
  return this.request<any>(`/displays${query ? `?${query}` : ''}`);
}
```

**Should be:**
```typescript
async getDisplays(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Display>> {
  const query = new URLSearchParams(params as any).toString();
  return this.request<PaginatedResponse<Display>>(`/displays${query ? `?${query}` : ''}`);
}
```

### 11. No Debouncing on Search/Filter
**Files:** Content page, potential search fields  
**Issue:** Filter changes trigger immediate API calls  
**Recommendation:** Add debounce utility

### 12. Accessibility Issues
**Multiple Files:**
- Missing ARIA labels on icon-only buttons
- No keyboard navigation hints
- Color contrast might not meet WCAG AA standards
- No focus indicators on custom components

---

## 🟢 LOW PRIORITY / ENHANCEMENTS

### 13. No Optimistic Updates
**Impact:** UX feels slower  
**Recommendation:** Implement optimistic UI updates for faster perceived performance

### 14. No Offline Support
**Recommendation:** Add service worker for offline functionality

### 15. No Image Optimization
**Issue:** Images loaded without Next.js Image component  
**Recommendation:** Use `next/image` for automatic optimization

### 16. Hardcoded Colors
**Issue:** Tailwind colors used directly instead of theme  
**Recommendation:** Define custom color palette in tailwind.config

### 17. No Analytics/Monitoring
**Issue:** No error tracking or user analytics  
**Recommendation:** Add Sentry for error tracking

### 18. No Tests
**Issue:** No unit tests or integration tests for components  
**Recommendation:** Add Vitest + React Testing Library

---

## 🔧 QUICK WINS (Easy Fixes)

### 19. Console Errors
Check browser console for:
- Hydration mismatches
- PropType warnings
- Network errors
- Uncaught promises

### 20. Environment Variables
**File:** `.env.local`  
**Missing:**
```env
NEXT_PUBLIC_APP_NAME=Vizora
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### 21. Meta Tags & SEO
**File:** `web/src/app/layout.tsx`  
**Add:**
```typescript
export const metadata = {
  title: 'Vizora - Digital Signage Platform',
  description: 'Modern cloud-based digital signage management',
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#3B82F6',
  icons: {
    icon: '/favicon.ico',
  },
};
```

---

## 📊 TESTING CHECKLIST

### Functional Testing
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Register new account
- [ ] Create display device
- [ ] Upload content
- [ ] Create playlist
- [ ] Create schedule
- [ ] Delete operations with confirmation
- [ ] Form validation
- [ ] API error handling

### UI/UX Testing
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Loading states
- [ ] Error states
- [ ] Empty states
- [ ] Toast notifications
- [ ] Modal dialogs
- [ ] Navigation
- [ ] Accessibility (keyboard, screen reader)

### Performance Testing
- [ ] Initial load time
- [ ] Time to interactive
- [ ] API response times
- [ ] Memory leaks
- [ ] Bundle size analysis

---

## 🎯 RECOMMENDED ACTION PLAN

### Phase 1: Critical Fixes (Day 1)
1. Fix API URL configuration
2. Add authentication middleware
3. Add error boundaries
4. Fix API response handling (401/403)

### Phase 2: High Priority (Day 2-3)
1. Implement Promise.allSettled
2. Add form validation
3. Fix toast auto-dismiss
4. Add loading states consistently

### Phase 3: Medium Priority (Week 1)
1. Replace hardcoded values with API data
2. Add proper TypeScript types
3. Improve accessibility
4. Add debouncing where needed

### Phase 4: Enhancement (Week 2+)
1. Add tests
2. Implement optimistic updates
3. Add error tracking
4. Performance optimization

---

## 📝 NOTES

- Web app runs on port 3002 (auto-selected when 3000 was occupied)
- Middleware should be on port 3000 (verify)
- Realtime service on port 3001
- Most UI components are well-structured
- Code follows React/Next.js best practices overall
- TypeScript usage is good but can be improved

---

**Next Steps:**
1. Start fixing critical issues
2. Test each fix in browser
3. Document any new issues found
4. Update this report

