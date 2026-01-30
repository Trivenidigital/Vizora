(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/web/src/lib/api.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// API Client for Vizora Middleware
__turbopack_context__.s([
    "apiClient",
    ()=>apiClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
const API_BASE_URL = ("TURBOPACK compile-time value", "http://localhost:3000/api") || 'http://localhost:3000/api';
class ApiClient {
    baseUrl;
    token = null;
    constructor(baseUrl){
        this.baseUrl = baseUrl;
        // Load token from localStorage if available
        if ("TURBOPACK compile-time truthy", 1) {
            this.token = localStorage.getItem('authToken');
        }
    }
    setToken(token) {
        this.token = token;
        if ("TURBOPACK compile-time truthy", 1) {
            localStorage.setItem('authToken', token);
            // Also set as cookie for middleware to access
            document.cookie = `authToken=${token}; path=/; max-age=604800; SameSite=Lax`;
            if ("TURBOPACK compile-time truthy", 1) {
                console.log('[API] Token saved securely');
            }
        }
    }
    clearToken() {
        this.token = null;
        if ("TURBOPACK compile-time truthy", 1) {
            localStorage.removeItem('authToken');
            // Also clear cookie
            document.cookie = 'authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            if ("TURBOPACK compile-time truthy", 1) {
                console.log('[API] Token cleared');
            }
        }
    }
    async request(endpoint, options = {}, retries = 3) {
        const headers = {
            'Content-Type': 'application/json',
            ...this.token && {
                Authorization: `Bearer ${this.token}`
            },
            ...options.headers
        };
        if ("TURBOPACK compile-time truthy", 1) {
            console.log(`[API] Request: ${options.method || 'GET'} ${this.baseUrl}${endpoint}`);
        }
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutMs = options.method === 'GET' ? 30000 : 30000; // 30s timeout
        const timeoutId = setTimeout(()=>controller.abort(), timeoutMs);
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if ("TURBOPACK compile-time truthy", 1) {
                console.log(`[API] Response status: ${response.status} ${response.statusText}`);
            }
            if (!response.ok) {
                if ("TURBOPACK compile-time truthy", 1) {
                    console.error(`[API] Request failed with status ${response.status}`);
                }
                // Handle authentication errors
                if (response.status === 401 || response.status === 403) {
                    this.clearToken();
                    if ("TURBOPACK compile-time truthy", 1) {
                        // Redirect to login with return URL
                        const currentPath = window.location.pathname;
                        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
                    }
                }
                const error = await response.json().catch(()=>({
                        message: 'Request failed'
                    }));
                throw new Error(error.message || `HTTP ${response.status}`);
            }
            const data = await response.json();
            if ("TURBOPACK compile-time truthy", 1) {
                console.log('[API] Response received');
            }
            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            // Handle timeout
            if (error instanceof Error && error.name === 'AbortError') {
                if (retries > 0 && (options.method === 'GET' || !options.method)) {
                    if ("TURBOPACK compile-time truthy", 1) {
                        console.warn(`[API] Request timeout, retrying... (${retries} attempts left)`);
                    }
                    return this.request(endpoint, options, retries - 1);
                }
                throw new Error('Request timeout');
            }
            throw error;
        }
    }
    // Auth
    async login(email, password) {
        if ("TURBOPACK compile-time truthy", 1) {
            console.log('[API] Login called');
        }
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email,
                password
            })
        });
        if (response.data && response.data.token) {
            this.setToken(response.data.token);
        } else {
            if ("TURBOPACK compile-time truthy", 1) {
                console.error('[API] Token not found in response');
            }
            throw new Error('Authentication failed: no token received');
        }
        return response.data;
    }
    async register(email, password, organizationName, firstName, lastName) {
        if ("TURBOPACK compile-time truthy", 1) {
            console.log('[API] Register called');
        }
        const response = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email,
                password,
                organizationName,
                firstName,
                lastName
            })
        });
        if (response.data && response.data.token) {
            this.setToken(response.data.token);
        } else {
            if ("TURBOPACK compile-time truthy", 1) {
                console.error('[API] Token not found in register response');
            }
            throw new Error('Registration failed: no token received');
        }
        return response.data;
    }
    // Displays
    async getDisplays(params) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/displays${query ? `?${query}` : ''}`);
    }
    async getDisplay(id) {
        return this.request(`/displays/${id}`);
    }
    async createDisplay(data) {
        // Backend expects 'name' and 'deviceId', frontend uses 'nickname'
        const payload = {
            name: data.nickname,
            location: data.location,
            deviceId: `device-${Date.now()}-${Math.random().toString(36).substring(7)}`
        };
        return this.request('/displays', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }
    async updateDisplay(id, data) {
        // Backend expects 'name', frontend uses 'nickname'
        const payload = {};
        if (data.nickname !== undefined) payload.name = data.nickname;
        if (data.location !== undefined) payload.location = data.location;
        if (data.currentPlaylistId !== undefined) payload.currentPlaylistId = data.currentPlaylistId;
        return this.request(`/displays/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
        });
    }
    async deleteDisplay(id) {
        return this.request(`/displays/${id}`, {
            method: 'DELETE'
        });
    }
    async generatePairingToken(id) {
        return this.request(`/displays/${id}/pair`, {
            method: 'POST'
        });
    }
    async completePairing(data) {
        return this.request('/devices/pairing/complete', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    // Content
    async getContent(params) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/content${query ? `?${query}` : ''}`);
    }
    async getContentItem(id) {
        return this.request(`/content/${id}`);
    }
    async createContent(data) {
        // Backend expects 'name' instead of 'title'
        const payload = {
            name: data.title,
            type: data.type === 'pdf' ? 'url' : data.type,
            url: data.url || '',
            metadata: data.metadata
        };
        return this.request('/content', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }
    async updateContent(id, data) {
        return this.request(`/content/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }
    async deleteContent(id) {
        return this.request(`/content/${id}`, {
            method: 'DELETE'
        });
    }
    async archiveContent(id) {
        return this.request(`/content/${id}/archive`, {
            method: 'POST'
        });
    }
    // Playlists
    async getPlaylists(params) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/playlists${query ? `?${query}` : ''}`);
    }
    async getPlaylist(id) {
        return this.request(`/playlists/${id}`);
    }
    async createPlaylist(data) {
        return this.request('/playlists', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    async updatePlaylist(id, data) {
        return this.request(`/playlists/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }
    async deletePlaylist(id) {
        return this.request(`/playlists/${id}`, {
            method: 'DELETE'
        });
    }
    async addPlaylistItem(playlistId, contentId, duration) {
        return this.request(`/playlists/${playlistId}/items`, {
            method: 'POST',
            body: JSON.stringify({
                contentId,
                duration
            })
        });
    }
    async removePlaylistItem(playlistId, itemId) {
        return this.request(`/playlists/${playlistId}/items/${itemId}`, {
            method: 'DELETE'
        });
    }
    async updatePlaylistItem(playlistId, itemId, data) {
        return this.request(`/playlists/${playlistId}/items/${itemId}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }
    // Schedules
    async getSchedules(params) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/schedules${query ? `?${query}` : ''}`);
    }
    async createSchedule(data) {
        return this.request('/schedules', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    async updateSchedule(id, data) {
        return this.request(`/schedules/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }
    async deleteSchedule(id) {
        return this.request(`/schedules/${id}`, {
            method: 'DELETE'
        });
    }
    // Generic HTTP methods
    async post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined
        });
    }
    async get(endpoint) {
        return this.request(endpoint, {
            method: 'GET'
        });
    }
    async patch(endpoint, body) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined
        });
    }
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }
}
const apiClient = new ApiClient(API_BASE_URL);
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/lib/validation.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "contentUploadSchema",
    ()=>contentUploadSchema,
    "deviceEditSchema",
    ()=>deviceEditSchema,
    "extractFieldErrors",
    ()=>extractFieldErrors,
    "loginSchema",
    ()=>loginSchema,
    "playlistCreateSchema",
    ()=>playlistCreateSchema,
    "registerSchema",
    ()=>registerSchema,
    "validateField",
    ()=>validateField,
    "validateForm",
    ()=>validateForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js [app-client] (ecmascript) <export * as z>");
;
const contentUploadSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    title: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
    type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].enum([
        'image',
        'video',
        'pdf',
        'url'
    ], {
        errorMap: ()=>({
                message: 'Please select a valid content type'
            })
    }),
    url: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'File or URL is required').max(2000, 'URL is too long')
});
const playlistCreateSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    name: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'Playlist name is required').max(100, 'Name must be less than 100 characters'),
    description: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(500, 'Description must be less than 500 characters').optional()
});
const deviceEditSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    nickname: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'Device nickname is required').max(50, 'Nickname must be less than 50 characters'),
    location: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().max(100, 'Location must be less than 100 characters').optional()
});
const loginSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    email: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'Email is required').email('Please enter a valid email address'),
    password: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'Password is required').min(6, 'Password must be at least 6 characters')
});
const registerSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].object({
    email: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'Email is required').email('Please enter a valid email address'),
    password: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'Password is required').min(8, 'Password must be at least 8 characters').regex(/[A-Z]/, 'Password must contain at least one uppercase letter').regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'Please confirm your password'),
    firstName: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'First name is required').max(50, 'First name must be less than 50 characters'),
    lastName: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters'),
    organizationName: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].string().min(1, 'Organization name is required').max(100, 'Organization name must be less than 100 characters')
}).refine((data)=>data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: [
        'confirmPassword'
    ]
});
function validateField(schema, fieldName, value, allValues) {
    try {
        // For single field validation, create partial object
        const dataToValidate = allValues || {
            [fieldName]: value
        };
        // Parse and validate
        schema.parse(dataToValidate);
        return null;
    } catch (error) {
        if (error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].ZodError) {
            // Find error for this specific field
            const fieldError = error.errors.find((err)=>err.path.join('.') === fieldName);
            return fieldError?.message || null;
        }
        return null;
    }
}
function validateForm(schema, values) {
    try {
        schema.parse(values);
        return {};
    } catch (error) {
        if (error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].ZodError) {
            const errors = {};
            error.errors.forEach((err)=>{
                const path = err.path.join('.');
                errors[path] = err.message;
            });
            return errors;
        }
        return {};
    }
}
function extractFieldErrors(zodError) {
    return zodError.errors.reduce((acc, err)=>{
        const field = err.path[0];
        // Only store first error per field
        if (!acc[field]) {
            acc[field] = err.message;
        }
        return acc;
    }, {});
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/components/LoadingSpinner.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>LoadingSpinner
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
;
function LoadingSpinner({ size = 'md' }) {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12'
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center justify-center",
        role: "status",
        "aria-live": "polite",
        "aria-label": "Loading",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: `${sizeClasses[size]} border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin`,
            "aria-hidden": "true"
        }, void 0, false, {
            fileName: "[project]/web/src/components/LoadingSpinner.tsx",
            lineNumber: 10,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/web/src/components/LoadingSpinner.tsx",
        lineNumber: 9,
        columnNumber: 5
    }, this);
}
_c = LoadingSpinner;
var _c;
__turbopack_context__.k.register(_c, "LoadingSpinner");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/components/Button.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Button
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$LoadingSpinner$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/LoadingSpinner.tsx [app-client] (ecmascript)");
'use client';
;
;
function Button({ variant = 'primary', size = 'md', loading = false, disabled, children, className = '', ...props }) {
    const baseClasses = 'font-semibold rounded-lg transition-all duration-200 focus:outline-2 focus:outline-offset-2 focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 hover:scale-105';
    const variantClasses = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
        secondary: 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-500',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
    };
    const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base'
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        className: `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`,
        disabled: disabled || loading,
        ...props,
        children: [
            loading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$LoadingSpinner$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                size: "sm"
            }, void 0, false, {
                fileName: "[project]/web/src/components/Button.tsx",
                lineNumber: 43,
                columnNumber: 19
            }, this),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/web/src/components/Button.tsx",
        lineNumber: 38,
        columnNumber: 5
    }, this);
}
_c = Button;
var _c;
__turbopack_context__.k.register(_c, "Button");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/app/(auth)/login-content.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>LoginContent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/validation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$Button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/Button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js [app-client] (ecmascript) <export * as z>");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
;
function LoginContent() {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const redirectUrl = searchParams.get('redirect') || '/dashboard';
    const [formData, setFormData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        email: '',
        password: ''
    });
    const [errors, setErrors] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const handleSubmit = async (e)=>{
        e.preventDefault();
        setLoading(true);
        setError('');
        setErrors({});
        // Validate form with Zod
        try {
            __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loginSchema"].parse(formData);
        } catch (err) {
            if (err instanceof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$25$2e$76$2f$node_modules$2f$zod$2f$v3$2f$external$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__z$3e$__["z"].ZodError) {
                const fieldErrors = {};
                err.errors.forEach((error)=>{
                    if (error.path[0]) {
                        fieldErrors[error.path[0].toString()] = error.message;
                    }
                });
                setErrors(fieldErrors);
            }
            setLoading(false);
            return;
        }
        try {
            await __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].login(formData.email, formData.password);
            console.log('[LOGIN] Login successful, redirecting to:', redirectUrl);
            router.push(redirectUrl);
            console.log('[LOGIN] Router.push called');
        } catch (err) {
            console.error('[LOGIN] Login error:', err);
            setError(err.message || 'Login failed');
        } finally{
            setLoading(false);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen flex items-center justify-center bg-gray-100",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "bg-white p-8 rounded-lg shadow-lg w-full max-w-md",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                    className: "text-3xl font-bold text-center mb-6",
                    children: "Login to Vizora"
                }, void 0, false, {
                    fileName: "[project]/web/src/app/(auth)/login-content.tsx",
                    lineNumber: 60,
                    columnNumber: 9
                }, this),
                error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4",
                    children: error
                }, void 0, false, {
                    fileName: "[project]/web/src/app/(auth)/login-content.tsx",
                    lineNumber: 63,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                    onSubmit: handleSubmit,
                    className: "space-y-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "block text-sm font-medium text-gray-700 mb-1",
                                    children: "Email"
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/(auth)/login-content.tsx",
                                    lineNumber: 70,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "email",
                                    value: formData.email,
                                    onChange: (e)=>{
                                        setFormData({
                                            ...formData,
                                            email: e.target.value
                                        });
                                        if (errors.email) setErrors({
                                            ...errors,
                                            email: ''
                                        });
                                    },
                                    className: `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`,
                                    placeholder: "you@example.com",
                                    "aria-label": "Email address",
                                    "aria-invalid": !!errors.email,
                                    "aria-describedby": errors.email ? 'email-error' : undefined
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/(auth)/login-content.tsx",
                                    lineNumber: 73,
                                    columnNumber: 13
                                }, this),
                                errors.email && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    id: "email-error",
                                    className: "mt-1 text-sm text-red-600",
                                    role: "alert",
                                    children: errors.email
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/(auth)/login-content.tsx",
                                    lineNumber: 89,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/web/src/app/(auth)/login-content.tsx",
                            lineNumber: 69,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "block text-sm font-medium text-gray-700 mb-1",
                                    children: "Password"
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/(auth)/login-content.tsx",
                                    lineNumber: 96,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "password",
                                    value: formData.password,
                                    onChange: (e)=>{
                                        setFormData({
                                            ...formData,
                                            password: e.target.value
                                        });
                                        if (errors.password) setErrors({
                                            ...errors,
                                            password: ''
                                        });
                                    },
                                    className: `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-gray-900 ${errors.password ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`,
                                    placeholder: "••••••••",
                                    "aria-label": "Password",
                                    "aria-invalid": !!errors.password,
                                    "aria-describedby": errors.password ? 'password-error' : undefined
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/(auth)/login-content.tsx",
                                    lineNumber: 99,
                                    columnNumber: 13
                                }, this),
                                errors.password && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    id: "password-error",
                                    className: "mt-1 text-sm text-red-600",
                                    role: "alert",
                                    children: errors.password
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/(auth)/login-content.tsx",
                                    lineNumber: 115,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/web/src/app/(auth)/login-content.tsx",
                            lineNumber: 95,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$Button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            type: "submit",
                            loading: loading,
                            className: "w-full",
                            "aria-label": "Log in to your account",
                            children: "Login"
                        }, void 0, false, {
                            fileName: "[project]/web/src/app/(auth)/login-content.tsx",
                            lineNumber: 121,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/web/src/app/(auth)/login-content.tsx",
                    lineNumber: 68,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-center mt-6 text-gray-600",
                    children: [
                        "Don't have an account?",
                        ' ',
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: "/register",
                            className: "text-blue-600 hover:underline",
                            children: "Sign up"
                        }, void 0, false, {
                            fileName: "[project]/web/src/app/(auth)/login-content.tsx",
                            lineNumber: 134,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/web/src/app/(auth)/login-content.tsx",
                    lineNumber: 131,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/web/src/app/(auth)/login-content.tsx",
            lineNumber: 59,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/web/src/app/(auth)/login-content.tsx",
        lineNumber: 58,
        columnNumber: 5
    }, this);
}
_s(LoginContent, "KQ/KJMDQu2uoq/GzhRa/8dqHWe8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"]
    ];
});
_c = LoginContent;
var _c;
__turbopack_context__.k.register(_c, "LoginContent");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=web_src_dbfaccc8._.js.map