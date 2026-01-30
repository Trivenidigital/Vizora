(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/web/src/components/Modal.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Modal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
function Modal({ isOpen, onClose, title, children, size = 'md' }) {
    _s();
    const closeButtonRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Modal.useEffect": ()=>{
            if (isOpen) {
                document.body.style.overflow = 'hidden';
                // Handle ESC key
                const handleEscape = {
                    "Modal.useEffect.handleEscape": (e)=>{
                        if (e.key === 'Escape') {
                            onClose();
                        }
                    }
                }["Modal.useEffect.handleEscape"];
                document.addEventListener('keydown', handleEscape);
                return ({
                    "Modal.useEffect": ()=>{
                        document.body.style.overflow = 'unset';
                        document.removeEventListener('keydown', handleEscape);
                    }
                })["Modal.useEffect"];
            } else {
                document.body.style.overflow = 'unset';
            }
        }
    }["Modal.useEffect"], [
        isOpen,
        onClose
    ]);
    if (!isOpen) return null;
    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl'
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-50 overflow-y-auto",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "modal-title",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex min-h-screen items-center justify-center p-4",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "fixed inset-0 bg-black bg-opacity-50 transition-opacity",
                    onClick: onClose,
                    "aria-hidden": "true"
                }, void 0, false, {
                    fileName: "[project]/web/src/components/Modal.tsx",
                    lineNumber: 55,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: `relative bg-white rounded-lg shadow-xl ${sizeClasses[size]} w-full transform transition-all`,
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-between p-6 border-b border-gray-200",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                    id: "modal-title",
                                    className: "text-xl font-semibold text-gray-900",
                                    children: title
                                }, void 0, false, {
                                    fileName: "[project]/web/src/components/Modal.tsx",
                                    lineNumber: 67,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    ref: closeButtonRef,
                                    onClick: onClose,
                                    className: "text-gray-400 hover:text-gray-600 transition focus:outline-none focus:ring-2 focus:ring-blue-500 rounded",
                                    "aria-label": "Close modal",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                        className: "w-6 h-6",
                                        fill: "none",
                                        stroke: "currentColor",
                                        viewBox: "0 0 24 24",
                                        "aria-hidden": "true",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                            strokeLinecap: "round",
                                            strokeLinejoin: "round",
                                            strokeWidth: 2,
                                            d: "M6 18L18 6M6 6l12 12"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/components/Modal.tsx",
                                            lineNumber: 81,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/web/src/components/Modal.tsx",
                                        lineNumber: 74,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/web/src/components/Modal.tsx",
                                    lineNumber: 68,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/web/src/components/Modal.tsx",
                            lineNumber: 66,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "p-6",
                            children: children
                        }, void 0, false, {
                            fileName: "[project]/web/src/components/Modal.tsx",
                            lineNumber: 92,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/web/src/components/Modal.tsx",
                    lineNumber: 62,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/web/src/components/Modal.tsx",
            lineNumber: 53,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/web/src/components/Modal.tsx",
        lineNumber: 47,
        columnNumber: 5
    }, this);
}
_s(Modal, "WH5r6PG9RTvB/dH7sKSiKcls8nc=");
_c = Modal;
var _c;
__turbopack_context__.k.register(_c, "Modal");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/components/ConfirmDialog.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ConfirmDialog
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/theme/icons.tsx [app-client] (ecmascript)");
'use client';
;
;
function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'danger' }) {
    if (!isOpen) return null;
    const buttonColors = {
        danger: 'bg-error-600 dark:bg-error-500 hover:bg-error-700 dark:hover:bg-error-600',
        warning: 'bg-warning-600 dark:bg-warning-500 hover:bg-warning-700 dark:hover:bg-warning-600',
        info: 'bg-info-600 dark:bg-info-500 hover:bg-info-700 dark:hover:bg-info-600'
    };
    const iconColors = {
        danger: 'text-error-600 dark:text-error-500',
        warning: 'text-warning-600 dark:text-warning-500',
        info: 'text-info-600 dark:text-info-500'
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-50 overflow-y-auto",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex min-h-screen items-center justify-center p-4",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "fixed inset-0 bg-black bg-opacity-50 transition-opacity",
                    onClick: onClose
                }, void 0, false, {
                    fileName: "[project]/web/src/components/ConfirmDialog.tsx",
                    lineNumber: 44,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full transform transition-all",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "p-6",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-4",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: `flex-shrink-0 ${iconColors[type]}`,
                                        children: [
                                            type === 'danger' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                                                name: "error",
                                                size: "2xl"
                                            }, void 0, false, {
                                                fileName: "[project]/web/src/components/ConfirmDialog.tsx",
                                                lineNumber: 54,
                                                columnNumber: 39
                                            }, this),
                                            type === 'warning' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                                                name: "warning",
                                                size: "2xl"
                                            }, void 0, false, {
                                                fileName: "[project]/web/src/components/ConfirmDialog.tsx",
                                                lineNumber: 55,
                                                columnNumber: 40
                                            }, this),
                                            type === 'info' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                                                name: "info",
                                                size: "2xl"
                                            }, void 0, false, {
                                                fileName: "[project]/web/src/components/ConfirmDialog.tsx",
                                                lineNumber: 56,
                                                columnNumber: 37
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/web/src/components/ConfirmDialog.tsx",
                                        lineNumber: 53,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex-1",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                className: "text-lg font-semibold text-gray-900 dark:text-gray-50 mb-2",
                                                children: title
                                            }, void 0, false, {
                                                fileName: "[project]/web/src/components/ConfirmDialog.tsx",
                                                lineNumber: 59,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm text-gray-600 dark:text-gray-400",
                                                children: message
                                            }, void 0, false, {
                                                fileName: "[project]/web/src/components/ConfirmDialog.tsx",
                                                lineNumber: 60,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/web/src/components/ConfirmDialog.tsx",
                                        lineNumber: 58,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/web/src/components/ConfirmDialog.tsx",
                                lineNumber: 52,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/web/src/components/ConfirmDialog.tsx",
                            lineNumber: 51,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-gray-50 dark:bg-gray-800 px-6 py-4 flex justify-end gap-3 rounded-b-lg",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: onClose,
                                    className: "px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition",
                                    children: cancelText
                                }, void 0, false, {
                                    fileName: "[project]/web/src/components/ConfirmDialog.tsx",
                                    lineNumber: 66,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>{
                                        onConfirm();
                                        onClose();
                                    },
                                    className: `px-4 py-2 text-sm font-medium text-white rounded-md transition ${buttonColors[type]}`,
                                    children: confirmText
                                }, void 0, false, {
                                    fileName: "[project]/web/src/components/ConfirmDialog.tsx",
                                    lineNumber: 72,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/web/src/components/ConfirmDialog.tsx",
                            lineNumber: 65,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/web/src/components/ConfirmDialog.tsx",
                    lineNumber: 50,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/web/src/components/ConfirmDialog.tsx",
            lineNumber: 42,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/web/src/components/ConfirmDialog.tsx",
        lineNumber: 41,
        columnNumber: 5
    }, this);
}
_c = ConfirmDialog;
var _c;
__turbopack_context__.k.register(_c, "ConfirmDialog");
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
"[project]/web/src/components/EmptyState.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>EmptyState
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/theme/icons.tsx [app-client] (ecmascript)");
'use client';
;
;
function EmptyState({ icon, title, description, action, variant = 'default' }) {
    if (variant === 'minimal') {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex flex-col items-center justify-center py-12 px-4",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                    name: icon,
                    size: "2xl",
                    className: "text-gray-300 mb-4"
                }, void 0, false, {
                    fileName: "[project]/web/src/components/EmptyState.tsx",
                    lineNumber: 27,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                    className: "text-lg font-semibold text-gray-900 mb-1",
                    children: title
                }, void 0, false, {
                    fileName: "[project]/web/src/components/EmptyState.tsx",
                    lineNumber: 28,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-sm text-gray-500 text-center max-w-sm",
                    children: description
                }, void 0, false, {
                    fileName: "[project]/web/src/components/EmptyState.tsx",
                    lineNumber: 29,
                    columnNumber: 9
                }, this),
                action && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    onClick: action.onClick,
                    className: "mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition",
                    children: action.label
                }, void 0, false, {
                    fileName: "[project]/web/src/components/EmptyState.tsx",
                    lineNumber: 31,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/web/src/components/EmptyState.tsx",
            lineNumber: 26,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col items-center justify-center py-16 px-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-100",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "w-16 h-16 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                    name: icon,
                    size: "2xl",
                    className: "text-blue-600"
                }, void 0, false, {
                    fileName: "[project]/web/src/components/EmptyState.tsx",
                    lineNumber: 45,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/web/src/components/EmptyState.tsx",
                lineNumber: 44,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                className: "text-xl font-semibold text-gray-900 mb-2",
                children: title
            }, void 0, false, {
                fileName: "[project]/web/src/components/EmptyState.tsx",
                lineNumber: 47,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-gray-600 text-center max-w-sm mb-6",
                children: description
            }, void 0, false, {
                fileName: "[project]/web/src/components/EmptyState.tsx",
                lineNumber: 48,
                columnNumber: 7
            }, this),
            action && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: action.onClick,
                className: "px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium",
                children: action.label
            }, void 0, false, {
                fileName: "[project]/web/src/components/EmptyState.tsx",
                lineNumber: 50,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/web/src/components/EmptyState.tsx",
        lineNumber: 43,
        columnNumber: 5
    }, this);
}
_c = EmptyState;
var _c;
__turbopack_context__.k.register(_c, "EmptyState");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/components/TimePicker.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>TimePicker
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/theme/icons.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
function TimePicker({ value, onChange, interval = 15, showFormat = '24h', className = '' }) {
    _s();
    const [isOpen, setIsOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // Parse current value
    const [hours, minutes] = value.split(':').map(Number);
    // Generate time options based on interval
    const timeOptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "TimePicker.useMemo[timeOptions]": ()=>{
            const options = [];
            for(let h = 0; h < 24; h++){
                for(let m = 0; m < 60; m += interval){
                    const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                    let label;
                    if (showFormat === '12h') {
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
                        label = `${displayHour}:${String(m).padStart(2, '0')} ${ampm}`;
                    } else {
                        label = timeString;
                    }
                    options.push({
                        label,
                        value: timeString
                    });
                }
            }
            return options;
        }
    }["TimePicker.useMemo[timeOptions]"], [
        interval,
        showFormat
    ]);
    // Get current display value
    const currentOption = timeOptions.find((opt)=>opt.value === value);
    const displayValue = currentOption?.label || value;
    // Common presets
    const presets = [
        {
            label: 'Start of Business (9:00 AM)',
            value: '09:00'
        },
        {
            label: 'Lunch Time (12:00 PM)',
            value: '12:00'
        },
        {
            label: 'End of Business (5:00 PM)',
            value: '17:00'
        },
        {
            label: 'Evening (7:00 PM)',
            value: '19:00'
        },
        {
            label: 'Midnight',
            value: '00:00'
        }
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: className,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "relative",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    onClick: ()=>setIsOpen(!isOpen),
                    className: "w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 flex items-center justify-between hover:border-gray-400 dark:hover:border-gray-600 transition-colors",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            children: displayValue
                        }, void 0, false, {
                            fileName: "[project]/web/src/components/TimePicker.tsx",
                            lineNumber: 70,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                            name: "chevronDown",
                            size: "sm"
                        }, void 0, false, {
                            fileName: "[project]/web/src/components/TimePicker.tsx",
                            lineNumber: 71,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/web/src/components/TimePicker.tsx",
                    lineNumber: 66,
                    columnNumber: 9
                }, this),
                isOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "fixed inset-0 z-10",
                            onClick: ()=>setIsOpen(false)
                        }, void 0, false, {
                            fileName: "[project]/web/src/components/TimePicker.tsx",
                            lineNumber: 76,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "absolute top-full left-0 right-0 mt-2 z-20 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "border-b border-gray-200 dark:border-gray-700 p-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-1",
                                            children: "Common Times"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/components/TimePicker.tsx",
                                            lineNumber: 81,
                                            columnNumber: 17
                                        }, this),
                                        presets.map((preset)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>{
                                                    onChange(preset.value);
                                                    setIsOpen(false);
                                                },
                                                className: `w-full text-left px-3 py-2 rounded text-sm transition-colors ${value === preset.value ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`,
                                                children: preset.label
                                            }, preset.value, false, {
                                                fileName: "[project]/web/src/components/TimePicker.tsx",
                                                lineNumber: 85,
                                                columnNumber: 19
                                            }, this))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/web/src/components/TimePicker.tsx",
                                    lineNumber: 80,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "max-h-60 overflow-y-auto",
                                    children: timeOptions.map((option)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>{
                                                onChange(option.value);
                                                setIsOpen(false);
                                            },
                                            className: `w-full text-left px-4 py-2 text-sm transition-colors ${value === option.value ? 'bg-blue-500 dark:bg-blue-600 text-white font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`,
                                            children: option.label
                                        }, option.value, false, {
                                            fileName: "[project]/web/src/components/TimePicker.tsx",
                                            lineNumber: 105,
                                            columnNumber: 19
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/web/src/components/TimePicker.tsx",
                                    lineNumber: 103,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/web/src/components/TimePicker.tsx",
                            lineNumber: 78,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true)
            ]
        }, void 0, true, {
            fileName: "[project]/web/src/components/TimePicker.tsx",
            lineNumber: 65,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/web/src/components/TimePicker.tsx",
        lineNumber: 64,
        columnNumber: 5
    }, this);
}
_s(TimePicker, "TTsYWAW9GEmqU/y9jsvExDIUd5o=");
_c = TimePicker;
var _c;
__turbopack_context__.k.register(_c, "TimePicker");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/components/DaySelector.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>DaySelector
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
'use client';
;
const DAYS = [
    {
        id: 'Monday',
        label: 'Mon',
        fullLabel: 'Monday'
    },
    {
        id: 'Tuesday',
        label: 'Tue',
        fullLabel: 'Tuesday'
    },
    {
        id: 'Wednesday',
        label: 'Wed',
        fullLabel: 'Wednesday'
    },
    {
        id: 'Thursday',
        label: 'Thu',
        fullLabel: 'Thursday'
    },
    {
        id: 'Friday',
        label: 'Fri',
        fullLabel: 'Friday'
    },
    {
        id: 'Saturday',
        label: 'Sat',
        fullLabel: 'Saturday'
    },
    {
        id: 'Sunday',
        label: 'Sun',
        fullLabel: 'Sunday'
    }
];
function DaySelector({ selected, onChange, className = '' }) {
    const toggleDay = (dayId)=>{
        if (selected.includes(dayId)) {
            onChange(selected.filter((d)=>d !== dayId));
        } else {
            onChange([
                ...selected,
                dayId
            ]);
        }
    };
    const toggleWeekdays = ()=>{
        const weekdays = [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday'
        ];
        const allWeekdaysSelected = weekdays.every((d)=>selected.includes(d));
        if (allWeekdaysSelected) {
            onChange(selected.filter((d)=>!weekdays.includes(d)));
        } else {
            const newSelected = new Set(selected);
            weekdays.forEach((d)=>newSelected.add(d));
            onChange(Array.from(newSelected));
        }
    };
    const toggleWeekends = ()=>{
        const weekends = [
            'Saturday',
            'Sunday'
        ];
        const allWeekendsSelected = weekends.every((d)=>selected.includes(d));
        if (allWeekendsSelected) {
            onChange(selected.filter((d)=>!weekends.includes(d)));
        } else {
            const newSelected = new Set(selected);
            weekends.forEach((d)=>newSelected.add(d));
            onChange(Array.from(newSelected));
        }
    };
    const toggleAll = ()=>{
        if (selected.length === 7) {
            onChange([]);
        } else {
            onChange(DAYS.map((d)=>d.id));
        }
    };
    const weekdays = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday'
    ];
    const weekends = [
        'Saturday',
        'Sunday'
    ];
    const allWeekdaysSelected = weekdays.every((d)=>selected.includes(d));
    const allWeekendsSelected = weekends.every((d)=>selected.includes(d));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: className,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex gap-2 flex-wrap",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: toggleAll,
                            className: `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selected.length === 7 ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`,
                            children: "All Days"
                        }, void 0, false, {
                            fileName: "[project]/web/src/components/DaySelector.tsx",
                            lineNumber: 78,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: toggleWeekdays,
                            className: `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${allWeekdaysSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`,
                            children: "Weekdays"
                        }, void 0, false, {
                            fileName: "[project]/web/src/components/DaySelector.tsx",
                            lineNumber: 89,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: toggleWeekends,
                            className: `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${allWeekendsSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`,
                            children: "Weekends"
                        }, void 0, false, {
                            fileName: "[project]/web/src/components/DaySelector.tsx",
                            lineNumber: 100,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/web/src/components/DaySelector.tsx",
                    lineNumber: 77,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid grid-cols-7 gap-2",
                    children: DAYS.map((day)=>{
                        const isSelected = selected.includes(day.id);
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: ()=>toggleDay(day.id),
                            className: `py-3 px-2 rounded-lg font-semibold text-sm transition-all ${isSelected ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`,
                            title: day.fullLabel,
                            children: day.label
                        }, day.id, false, {
                            fileName: "[project]/web/src/components/DaySelector.tsx",
                            lineNumber: 117,
                            columnNumber: 15
                        }, this);
                    })
                }, void 0, false, {
                    fileName: "[project]/web/src/components/DaySelector.tsx",
                    lineNumber: 113,
                    columnNumber: 9
                }, this),
                selected.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-3",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-blue-800 dark:text-blue-200",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-semibold",
                                children: selected.length
                            }, void 0, false, {
                                fileName: "[project]/web/src/components/DaySelector.tsx",
                                lineNumber: 137,
                                columnNumber: 15
                            }, this),
                            " day",
                            selected.length !== 1 ? 's' : '',
                            " selected:",
                            ' ',
                            selected.map((d)=>DAYS.find((day)=>day.id === d)?.fullLabel).join(', ')
                        ]
                    }, void 0, true, {
                        fileName: "[project]/web/src/components/DaySelector.tsx",
                        lineNumber: 136,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/web/src/components/DaySelector.tsx",
                    lineNumber: 135,
                    columnNumber: 11
                }, this),
                selected.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-lg p-3",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm text-red-800 dark:text-red-200",
                        children: "Please select at least one day"
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/DaySelector.tsx",
                        lineNumber: 145,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/web/src/components/DaySelector.tsx",
                    lineNumber: 144,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/web/src/components/DaySelector.tsx",
            lineNumber: 75,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/web/src/components/DaySelector.tsx",
        lineNumber: 74,
        columnNumber: 5
    }, this);
}
_c = DaySelector;
var _c;
__turbopack_context__.k.register(_c, "DaySelector");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/components/Toast.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Toast
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/theme/icons.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
function Toast({ message, type, onClose, duration = 5000 }) {
    _s();
    const [isVisible, setIsVisible] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Toast.useEffect": ()=>{
            const timer = setTimeout({
                "Toast.useEffect.timer": ()=>{
                    setIsVisible(false);
                    setTimeout(onClose, 300);
                }
            }["Toast.useEffect.timer"], duration);
            return ({
                "Toast.useEffect": ()=>clearTimeout(timer)
            })["Toast.useEffect"];
        }
    }["Toast.useEffect"], [
        duration,
        onClose
    ]);
    const colors = {
        success: 'bg-success-500 text-white',
        error: 'bg-error-500 text-white',
        info: 'bg-info-500 text-white',
        warning: 'bg-warning-500 text-white'
    };
    const icons = {
        success: 'success',
        error: 'delete',
        info: 'info',
        warning: 'warning'
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        role: "alert",
        "aria-live": "assertive",
        "aria-atomic": "true",
        className: `fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 rounded-lg shadow-lg text-white ${colors[type]} transform transition-all duration-300 ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                name: icons[type],
                size: "md",
                className: "text-white"
            }, void 0, false, {
                fileName: "[project]/web/src/components/Toast.tsx",
                lineNumber: 53,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "font-medium",
                children: message
            }, void 0, false, {
                fileName: "[project]/web/src/components/Toast.tsx",
                lineNumber: 54,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: ()=>{
                    setIsVisible(false);
                    setTimeout(onClose, 300);
                },
                className: "ml-4 hover:opacity-75 transition",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                    className: "w-4 h-4",
                    fill: "currentColor",
                    viewBox: "0 0 20 20",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                        fillRule: "evenodd",
                        d: "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z",
                        clipRule: "evenodd"
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/Toast.tsx",
                        lineNumber: 63,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/web/src/components/Toast.tsx",
                    lineNumber: 62,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/web/src/components/Toast.tsx",
                lineNumber: 55,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/web/src/components/Toast.tsx",
        lineNumber: 43,
        columnNumber: 5
    }, this);
}
_s(Toast, "m22S9IQwDfEe/fCJY7LYj8YPDMo=");
_c = Toast;
var _c;
__turbopack_context__.k.register(_c, "Toast");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/lib/hooks/useToast.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useToast",
    ()=>useToast
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$Toast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/Toast.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
function useToast() {
    _s();
    const [toasts, setToasts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    // Define removeToast first
    const removeToast = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useToast.useCallback[removeToast]": (id)=>{
            setToasts({
                "useToast.useCallback[removeToast]": (prev)=>prev.filter({
                        "useToast.useCallback[removeToast]": (toast)=>toast.id !== id
                    }["useToast.useCallback[removeToast]"])
            }["useToast.useCallback[removeToast]"]);
        }
    }["useToast.useCallback[removeToast]"], []);
    const showToast = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useToast.useCallback[showToast]": (message, type = 'info', duration = 5000)=>{
            const id = Math.random().toString(36).substring(7);
            setToasts({
                "useToast.useCallback[showToast]": (prev)=>[
                        ...prev,
                        {
                            id,
                            message,
                            type
                        }
                    ]
            }["useToast.useCallback[showToast]"]);
            // Auto-remove after duration
            if (duration > 0) {
                setTimeout({
                    "useToast.useCallback[showToast]": ()=>{
                        removeToast(id);
                    }
                }["useToast.useCallback[showToast]"], duration);
            }
        }
    }["useToast.useCallback[showToast]"], [
        removeToast
    ]);
    const ToastContainer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useToast.useCallback[ToastContainer]": ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: toasts.map({
                    "useToast.useCallback[ToastContainer]": (toast)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$Toast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            message: toast.message,
                            type: toast.type,
                            onClose: {
                                "useToast.useCallback[ToastContainer]": ()=>removeToast(toast.id)
                            }["useToast.useCallback[ToastContainer]"]
                        }, toast.id, false, {
                            fileName: "[project]/web/src/lib/hooks/useToast.tsx",
                            lineNumber: 36,
                            columnNumber: 11
                        }, this)
                }["useToast.useCallback[ToastContainer]"])
            }, void 0, false)
    }["useToast.useCallback[ToastContainer]"], [
        toasts,
        removeToast
    ]);
    return {
        showToast,
        success: (message)=>showToast(message, 'success'),
        error: (message)=>showToast(message, 'error'),
        info: (message)=>showToast(message, 'info'),
        warning: (message)=>showToast(message, 'warning'),
        ToastContainer
    };
}
_s(useToast, "aSV6cToIyltrq17F7wuZEkDNY1g=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/lib/hooks/useTheme.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$providers$2f$ThemeProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/providers/ThemeProvider.tsx [app-client] (ecmascript)");
'use client';
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/lib/hooks/useDebounce.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useDebounce",
    ()=>useDebounce
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function useDebounce(value, delay = 300) {
    _s();
    const [debouncedValue, setDebouncedValue] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(value);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useDebounce.useEffect": ()=>{
            // Set timeout to update debounced value after delay
            const handler = setTimeout({
                "useDebounce.useEffect.handler": ()=>{
                    setDebouncedValue(value);
                }
            }["useDebounce.useEffect.handler"], delay);
            // Cleanup timeout if value changes before delay completes
            return ({
                "useDebounce.useEffect": ()=>{
                    clearTimeout(handler);
                }
            })["useDebounce.useEffect"];
        }
    }["useDebounce.useEffect"], [
        value,
        delay
    ]);
    return debouncedValue;
}
_s(useDebounce, "KDuPAtDOgxm8PU6legVJOb3oOmA=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/lib/hooks/useAnalyticsData.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useBandwidthUsage",
    ()=>useBandwidthUsage,
    "useContentPerformance",
    ()=>useContentPerformance,
    "useDeviceDistribution",
    ()=>useDeviceDistribution,
    "useDeviceMetrics",
    ()=>useDeviceMetrics,
    "usePlaylistPerformance",
    ()=>usePlaylistPerformance,
    "useUsageTrends",
    ()=>useUsageTrends
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/api.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature(), _s4 = __turbopack_context__.k.signature(), _s5 = __turbopack_context__.k.signature();
'use client';
;
;
function useDeviceMetrics(dateRange = 'month') {
    _s();
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useDeviceMetrics.useEffect": ()=>{
            const fetchData = {
                "useDeviceMetrics.useEffect.fetchData": async ()=>{
                    try {
                        setLoading(true);
                        setError(null);
                        // Map date range to days
                        const daysMap = {
                            week: 7,
                            month: 30,
                            year: 365
                        };
                        const days = daysMap[dateRange];
                        // Try to fetch from API
                        try {
                            const response = await __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getDeviceMetrics?.(dateRange);
                            if (response && response.length > 0) {
                                setData(response);
                                return;
                            }
                        } catch (apiError) {
                            // Fall through to mock data if API not available
                            console.log('Analytics API not available, using mock data');
                        }
                        // Generate mock data if API unavailable
                        const mockData = Array.from({
                            length: days
                        }, {
                            "useDeviceMetrics.useEffect.fetchData.mockData": (_, i)=>({
                                    date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric'
                                    }),
                                    mobile: 85 + Math.random() * 10,
                                    tablet: 92 + Math.random() * 8,
                                    desktop: 98 + Math.random() * 2
                                })
                        }["useDeviceMetrics.useEffect.fetchData.mockData"]);
                        setData(mockData);
                    } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to fetch device metrics');
                        setData([]);
                    } finally{
                        setLoading(false);
                    }
                }
            }["useDeviceMetrics.useEffect.fetchData"];
            fetchData();
        }
    }["useDeviceMetrics.useEffect"], [
        dateRange
    ]);
    return {
        data,
        loading,
        error,
        dateRange
    };
}
_s(useDeviceMetrics, "C4fiAW6C7RZgaKDoEXQgZpbuUZg=");
function useContentPerformance(dateRange = 'month') {
    _s1();
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useContentPerformance.useEffect": ()=>{
            const fetchData = {
                "useContentPerformance.useEffect.fetchData": async ()=>{
                    try {
                        setLoading(true);
                        setError(null);
                        // Try to fetch from API
                        try {
                            const response = await __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getContentPerformance?.(dateRange);
                            if (response && response.length > 0) {
                                setData(response);
                                return;
                            }
                        } catch (apiError) {
                            console.log('Content performance API not available, using mock data');
                        }
                        // Mock data fallback
                        const mockData = [
                            {
                                title: 'Welcome Video',
                                views: 1240,
                                engagement: 87,
                                shares: 45
                            },
                            {
                                title: 'Product Demo',
                                views: 980,
                                engagement: 76,
                                shares: 32
                            },
                            {
                                title: 'Tutorial Series',
                                views: 2100,
                                engagement: 92,
                                shares: 58
                            },
                            {
                                title: 'Company Overview',
                                views: 650,
                                engagement: 64,
                                shares: 18
                            },
                            {
                                title: 'Customer Testimonials',
                                views: 1580,
                                engagement: 89,
                                shares: 42
                            },
                            {
                                title: 'FAQ Section',
                                views: 420,
                                engagement: 45,
                                shares: 12
                            }
                        ];
                        setData(mockData);
                    } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to fetch content performance');
                        setData([]);
                    } finally{
                        setLoading(false);
                    }
                }
            }["useContentPerformance.useEffect.fetchData"];
            fetchData();
        }
    }["useContentPerformance.useEffect"], [
        dateRange
    ]);
    return {
        data,
        loading,
        error,
        dateRange
    };
}
_s1(useContentPerformance, "C4fiAW6C7RZgaKDoEXQgZpbuUZg=");
function useUsageTrends(dateRange = 'month') {
    _s2();
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useUsageTrends.useEffect": ()=>{
            const fetchData = {
                "useUsageTrends.useEffect.fetchData": async ()=>{
                    try {
                        setLoading(true);
                        setError(null);
                        const daysMap = {
                            week: 7,
                            month: 30,
                            year: 365
                        };
                        const days = daysMap[dateRange];
                        // Try to fetch from API
                        try {
                            const response = await __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getUsageTrends?.(dateRange);
                            if (response && response.length > 0) {
                                setData(response);
                                return;
                            }
                        } catch (apiError) {
                            console.log('Usage trends API not available, using mock data');
                        }
                        // Mock data fallback
                        const mockData = Array.from({
                            length: days
                        }, {
                            "useUsageTrends.useEffect.fetchData.mockData": (_, i)=>({
                                    date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric'
                                    }),
                                    video: 2400 + Math.random() * 800,
                                    image: 1200 + Math.random() * 400,
                                    text: 600 + Math.random() * 300,
                                    interactive: 800 + Math.random() * 400
                                })
                        }["useUsageTrends.useEffect.fetchData.mockData"]);
                        setData(mockData);
                    } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to fetch usage trends');
                        setData([]);
                    } finally{
                        setLoading(false);
                    }
                }
            }["useUsageTrends.useEffect.fetchData"];
            fetchData();
        }
    }["useUsageTrends.useEffect"], [
        dateRange
    ]);
    return {
        data,
        loading,
        error,
        dateRange
    };
}
_s2(useUsageTrends, "C4fiAW6C7RZgaKDoEXQgZpbuUZg=");
function useDeviceDistribution() {
    _s3();
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useDeviceDistribution.useEffect": ()=>{
            const fetchData = {
                "useDeviceDistribution.useEffect.fetchData": async ()=>{
                    try {
                        setLoading(true);
                        setError(null);
                        // Try to fetch from API
                        try {
                            const response = await __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getDeviceDistribution?.();
                            if (response && response.length > 0) {
                                setData(response);
                                return;
                            }
                        } catch (apiError) {
                            console.log('Device distribution API not available, using mock data');
                        }
                        // Mock data fallback
                        const mockData = [
                            {
                                name: 'Smartphones',
                                value: 35,
                                color: '#3B82F6'
                            },
                            {
                                name: 'Tablets',
                                value: 25,
                                color: '#8B5CF6'
                            },
                            {
                                name: 'Desktop Displays',
                                value: 28,
                                color: '#EC4899'
                            },
                            {
                                name: 'Smart TVs',
                                value: 8,
                                color: '#F59E0B'
                            },
                            {
                                name: 'Interactive Kiosks',
                                value: 4,
                                color: '#10B981'
                            }
                        ];
                        setData(mockData);
                    } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to fetch device distribution');
                        setData([]);
                    } finally{
                        setLoading(false);
                    }
                }
            }["useDeviceDistribution.useEffect.fetchData"];
            fetchData();
        }
    }["useDeviceDistribution.useEffect"], []);
    return {
        data,
        loading,
        error
    };
}
_s3(useDeviceDistribution, "C4fiAW6C7RZgaKDoEXQgZpbuUZg=");
function useBandwidthUsage(dateRange = 'month') {
    _s4();
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useBandwidthUsage.useEffect": ()=>{
            const fetchData = {
                "useBandwidthUsage.useEffect.fetchData": async ()=>{
                    try {
                        setLoading(true);
                        setError(null);
                        const daysMap = {
                            week: 7,
                            month: 30,
                            year: 365
                        };
                        const days = daysMap[dateRange];
                        // Try to fetch from API
                        try {
                            const response = await __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getBandwidthUsage?.(dateRange);
                            if (response && response.length > 0) {
                                setData(response);
                                return;
                            }
                        } catch (apiError) {
                            console.log('Bandwidth usage API not available, using mock data');
                        }
                        // Mock data fallback
                        const mockData = Array.from({
                            length: days
                        }, {
                            "useBandwidthUsage.useEffect.fetchData.mockData": (_, i)=>({
                                    date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric'
                                    }),
                                    current: 2400 + Math.random() * 1000,
                                    average: 2200,
                                    peak: 3200
                                })
                        }["useBandwidthUsage.useEffect.fetchData.mockData"]);
                        setData(mockData);
                    } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to fetch bandwidth usage');
                        setData([]);
                    } finally{
                        setLoading(false);
                    }
                }
            }["useBandwidthUsage.useEffect.fetchData"];
            fetchData();
        }
    }["useBandwidthUsage.useEffect"], [
        dateRange
    ]);
    return {
        data,
        loading,
        error,
        dateRange
    };
}
_s4(useBandwidthUsage, "C4fiAW6C7RZgaKDoEXQgZpbuUZg=");
function usePlaylistPerformance(dateRange = 'month') {
    _s5();
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "usePlaylistPerformance.useEffect": ()=>{
            const fetchData = {
                "usePlaylistPerformance.useEffect.fetchData": async ()=>{
                    try {
                        setLoading(true);
                        setError(null);
                        // Try to fetch from API
                        try {
                            const response = await __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getPlaylistPerformance?.(dateRange);
                            if (response && response.length > 0) {
                                setData(response);
                                return;
                            }
                        } catch (apiError) {
                            console.log('Playlist performance API not available, using mock data');
                        }
                        // Mock data fallback
                        const mockData = [
                            {
                                name: 'Morning Promotions',
                                plays: 234,
                                engagement: 87,
                                uniqueDevices: 12
                            },
                            {
                                name: 'Lunch Specials',
                                plays: 189,
                                engagement: 92,
                                uniqueDevices: 10
                            },
                            {
                                name: 'Evening Content',
                                plays: 156,
                                engagement: 78,
                                uniqueDevices: 8
                            },
                            {
                                name: 'Educational Videos',
                                plays: 298,
                                engagement: 85,
                                uniqueDevices: 15
                            },
                            {
                                name: 'Emergency Alerts',
                                plays: 45,
                                engagement: 95,
                                uniqueDevices: 5
                            }
                        ];
                        setData(mockData);
                    } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to fetch playlist performance');
                        setData([]);
                    } finally{
                        setLoading(false);
                    }
                }
            }["usePlaylistPerformance.useEffect.fetchData"];
            fetchData();
        }
    }["usePlaylistPerformance.useEffect"], [
        dateRange
    ]);
    return {
        data,
        loading,
        error,
        dateRange
    };
}
_s5(usePlaylistPerformance, "C4fiAW6C7RZgaKDoEXQgZpbuUZg=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/lib/hooks/useChartData.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useBandwidthUsage",
    ()=>useBandwidthUsage,
    "useContentPerformance",
    ()=>useContentPerformance,
    "useDeviceDistribution",
    ()=>useDeviceDistribution,
    "useDeviceMetrics",
    ()=>useDeviceMetrics,
    "usePlaylistPerformance",
    ()=>usePlaylistPerformance,
    "useUsageTrends",
    ()=>useUsageTrends
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature(), _s4 = __turbopack_context__.k.signature(), _s5 = __turbopack_context__.k.signature();
'use client';
;
function useDeviceMetrics() {
    _s();
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useDeviceMetrics.useEffect": ()=>{
            const fetchData = {
                "useDeviceMetrics.useEffect.fetchData": async ()=>{
                    try {
                        setLoading(true);
                        // In production, fetch from real API
                        // For now, generate mock data
                        const mockData = Array.from({
                            length: 30
                        }, {
                            "useDeviceMetrics.useEffect.fetchData.mockData": (_, i)=>({
                                    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric'
                                    }),
                                    mobile: 85 + Math.random() * 10,
                                    tablet: 92 + Math.random() * 8,
                                    desktop: 98 + Math.random() * 2
                                })
                        }["useDeviceMetrics.useEffect.fetchData.mockData"]);
                        setData(mockData);
                        setError(null);
                    } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to fetch device metrics');
                    } finally{
                        setLoading(false);
                    }
                }
            }["useDeviceMetrics.useEffect.fetchData"];
            fetchData();
        }
    }["useDeviceMetrics.useEffect"], []);
    return {
        data,
        loading,
        error
    };
}
_s(useDeviceMetrics, "C4fiAW6C7RZgaKDoEXQgZpbuUZg=");
function useContentPerformance() {
    _s1();
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useContentPerformance.useEffect": ()=>{
            const fetchData = {
                "useContentPerformance.useEffect.fetchData": async ()=>{
                    try {
                        setLoading(true);
                        const mockData = [
                            {
                                title: 'Welcome Video',
                                views: 1240,
                                engagement: 87,
                                shares: 45
                            },
                            {
                                title: 'Product Demo',
                                views: 980,
                                engagement: 76,
                                shares: 32
                            },
                            {
                                title: 'Tutorial Series',
                                views: 2100,
                                engagement: 92,
                                shares: 58
                            },
                            {
                                title: 'Company Overview',
                                views: 650,
                                engagement: 64,
                                shares: 18
                            },
                            {
                                title: 'Customer Testimonials',
                                views: 1580,
                                engagement: 89,
                                shares: 42
                            },
                            {
                                title: 'FAQ Section',
                                views: 420,
                                engagement: 45,
                                shares: 12
                            }
                        ];
                        setData(mockData);
                        setError(null);
                    } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to fetch content performance');
                    } finally{
                        setLoading(false);
                    }
                }
            }["useContentPerformance.useEffect.fetchData"];
            fetchData();
        }
    }["useContentPerformance.useEffect"], []);
    return {
        data,
        loading,
        error
    };
}
_s1(useContentPerformance, "C4fiAW6C7RZgaKDoEXQgZpbuUZg=");
function useUsageTrends() {
    _s2();
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useUsageTrends.useEffect": ()=>{
            const fetchData = {
                "useUsageTrends.useEffect.fetchData": async ()=>{
                    try {
                        setLoading(true);
                        const mockData = Array.from({
                            length: 30
                        }, {
                            "useUsageTrends.useEffect.fetchData.mockData": (_, i)=>({
                                    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric'
                                    }),
                                    video: 2400 + Math.random() * 800,
                                    image: 1200 + Math.random() * 400,
                                    text: 600 + Math.random() * 300,
                                    interactive: 800 + Math.random() * 400
                                })
                        }["useUsageTrends.useEffect.fetchData.mockData"]);
                        setData(mockData);
                        setError(null);
                    } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to fetch usage trends');
                    } finally{
                        setLoading(false);
                    }
                }
            }["useUsageTrends.useEffect.fetchData"];
            fetchData();
        }
    }["useUsageTrends.useEffect"], []);
    return {
        data,
        loading,
        error
    };
}
_s2(useUsageTrends, "C4fiAW6C7RZgaKDoEXQgZpbuUZg=");
function useDeviceDistribution() {
    _s3();
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useDeviceDistribution.useEffect": ()=>{
            const fetchData = {
                "useDeviceDistribution.useEffect.fetchData": async ()=>{
                    try {
                        setLoading(true);
                        const mockData = [
                            {
                                name: 'Mobile Displays',
                                value: 35,
                                count: 128
                            },
                            {
                                name: 'Tablets',
                                value: 25,
                                count: 92
                            },
                            {
                                name: 'Desktop Screens',
                                value: 20,
                                count: 73
                            },
                            {
                                name: 'Smart TVs',
                                value: 15,
                                count: 55
                            },
                            {
                                name: 'Kiosks',
                                value: 5,
                                count: 18
                            }
                        ];
                        setData(mockData);
                        setError(null);
                    } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to fetch device distribution');
                    } finally{
                        setLoading(false);
                    }
                }
            }["useDeviceDistribution.useEffect.fetchData"];
            fetchData();
        }
    }["useDeviceDistribution.useEffect"], []);
    return {
        data,
        loading,
        error
    };
}
_s3(useDeviceDistribution, "C4fiAW6C7RZgaKDoEXQgZpbuUZg=");
function useBandwidthUsage() {
    _s4();
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useBandwidthUsage.useEffect": ()=>{
            const fetchData = {
                "useBandwidthUsage.useEffect.fetchData": async ()=>{
                    try {
                        setLoading(true);
                        const mockData = Array.from({
                            length: 24
                        }, {
                            "useBandwidthUsage.useEffect.fetchData.mockData": (_, i)=>{
                                const hour = String(i).padStart(2, '0');
                                return {
                                    time: `${hour}:00`,
                                    current: 45 + Math.random() * 50,
                                    average: 42,
                                    peak: 85
                                };
                            }
                        }["useBandwidthUsage.useEffect.fetchData.mockData"]);
                        setData(mockData);
                        setError(null);
                    } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to fetch bandwidth usage');
                    } finally{
                        setLoading(false);
                    }
                }
            }["useBandwidthUsage.useEffect.fetchData"];
            fetchData();
        }
    }["useBandwidthUsage.useEffect"], []);
    return {
        data,
        loading,
        error
    };
}
_s4(useBandwidthUsage, "C4fiAW6C7RZgaKDoEXQgZpbuUZg=");
function usePlaylistPerformance() {
    _s5();
    const [data, setData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "usePlaylistPerformance.useEffect": ()=>{
            const fetchData = {
                "usePlaylistPerformance.useEffect.fetchData": async ()=>{
                    try {
                        setLoading(true);
                        const mockData = [
                            {
                                name: 'Morning Briefing',
                                views: 3200,
                                avgWatchTime: 12,
                                completion: 78
                            },
                            {
                                name: 'Product Launch',
                                views: 2800,
                                avgWatchTime: 15,
                                completion: 85
                            },
                            {
                                name: 'Weekly Updates',
                                views: 2400,
                                avgWatchTime: 10,
                                completion: 72
                            },
                            {
                                name: 'Training Series',
                                views: 1900,
                                avgWatchTime: 25,
                                completion: 65
                            },
                            {
                                name: 'Event Coverage',
                                views: 1200,
                                avgWatchTime: 8,
                                completion: 55
                            }
                        ];
                        setData(mockData);
                        setError(null);
                    } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to fetch playlist performance');
                    } finally{
                        setLoading(false);
                    }
                }
            }["usePlaylistPerformance.useEffect.fetchData"];
            fetchData();
        }
    }["usePlaylistPerformance.useEffect"], []);
    return {
        data,
        loading,
        error
    };
}
_s5(usePlaylistPerformance, "C4fiAW6C7RZgaKDoEXQgZpbuUZg=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/lib/hooks/useRealtimeEvents.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Real-time Event Handlers for Vizora
// Manages Socket.io events with advanced state synchronization, optimistic updates, and error recovery
__turbopack_context__.s([
    "useRealtimeEvents",
    ()=>useRealtimeEvents
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useSocket$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useSocket.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
function useRealtimeEvents(options = {}) {
    _s();
    const { enabled = true, onDeviceStatusChange, onPlaylistChange, onHealthAlert, onScheduleExecution, onConnectionChange, onSyncStateChange, offlineQueueSize = 50, retryAttempts = 3 } = options;
    const { socket, isConnected, on } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useSocket$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSocket"])();
    const [isOffline, setIsOffline] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [syncState, setSyncState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        lastSyncTime: Date.now(),
        pendingChanges: new Map(),
        conflictedChanges: new Map()
    });
    // Offline sync queue
    const syncQueueRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])([]);
    const offlineQueueRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])([]);
    // Emit event with optimistic update support
    const emitEvent = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRealtimeEvents.useCallback[emitEvent]": (event, data, options)=>{
            if (!socket) return;
            const eventId = `${event}_${Date.now()}_${Math.random()}`;
            // Add to pending changes if optimistic
            if (options?.optimistic) {
                setSyncState({
                    "useRealtimeEvents.useCallback[emitEvent]": (prev)=>({
                            ...prev,
                            pendingChanges: new Map(prev.pendingChanges).set(eventId, {
                                event,
                                data
                            })
                        })
                }["useRealtimeEvents.useCallback[emitEvent]"]);
            }
            // Emit through socket or add to offline queue
            if (isConnected && socket) {
                socket.emit(event, {
                    ...data,
                    eventId
                });
            } else {
                // Add to offline queue
                const queueItem = {
                    id: eventId,
                    event,
                    data: {
                        ...data,
                        eventId
                    },
                    timestamp: Date.now(),
                    retryCount: 0
                };
                offlineQueueRef.current.push(queueItem);
                // Respect queue size limit
                if (offlineQueueRef.current.length > offlineQueueSize) {
                    offlineQueueRef.current.shift();
                }
                console.log('[RealtimeEvents] Event queued offline:', event, queueItem);
            }
        }
    }["useRealtimeEvents.useCallback[emitEvent]"], [
        socket,
        isConnected,
        offlineQueueSize
    ]);
    // Conflict resolution for state synchronization
    const resolveConflict = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRealtimeEvents.useCallback[resolveConflict]": (localChange, remoteChange)=>{
            // Strategy: Remote wins (server is source of truth)
            // But merge if they affect different fields
            if (typeof localChange === 'object' && typeof remoteChange === 'object' && !Array.isArray(localChange)) {
                return {
                    ...localChange,
                    ...remoteChange,
                    // Keep local timestamp for optimistic updates
                    _localTimestamp: localChange._localTimestamp,
                    _remoteTimestamp: remoteChange._remoteTimestamp
                };
            }
            return remoteChange;
        }
    }["useRealtimeEvents.useCallback[resolveConflict]"], []);
    // Sync offline queue when reconnected
    const syncOfflineQueue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRealtimeEvents.useCallback[syncOfflineQueue]": async ()=>{
            if (!isConnected || !socket) return;
            const itemsToSync = [
                ...offlineQueueRef.current
            ];
            console.log('[RealtimeEvents] Syncing offline queue, items:', itemsToSync.length);
            for (const item of itemsToSync){
                if (item.retryCount >= retryAttempts) {
                    console.warn('[RealtimeEvents] Max retries exceeded for:', item.event, item.id);
                    // Move to conflicted changes for manual resolution
                    setSyncState({
                        "useRealtimeEvents.useCallback[syncOfflineQueue]": (prev)=>({
                                ...prev,
                                conflictedChanges: new Map(prev.conflictedChanges).set(item.id, item)
                            })
                    }["useRealtimeEvents.useCallback[syncOfflineQueue]"]);
                    continue;
                }
                try {
                    socket.emit(item.event, item.data);
                    item.retryCount++;
                    // Remove from queue after successful emit
                    offlineQueueRef.current = offlineQueueRef.current.filter({
                        "useRealtimeEvents.useCallback[syncOfflineQueue]": (qi)=>qi.id !== item.id
                    }["useRealtimeEvents.useCallback[syncOfflineQueue]"]);
                    console.log('[RealtimeEvents] Successfully synced:', item.event);
                } catch (error) {
                    console.error('[RealtimeEvents] Failed to sync event:', error);
                    item.retryCount++;
                }
            }
            // Update sync state
            setSyncState({
                "useRealtimeEvents.useCallback[syncOfflineQueue]": (prev)=>({
                        ...prev,
                        lastSyncTime: Date.now()
                    })
            }["useRealtimeEvents.useCallback[syncOfflineQueue]"]);
        }
    }["useRealtimeEvents.useCallback[syncOfflineQueue]"], [
        isConnected,
        socket,
        retryAttempts
    ]);
    // Device status update handler
    const handleDeviceStatusUpdate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRealtimeEvents.useCallback[handleDeviceStatusUpdate]": (update)=>{
            console.log('[RealtimeEvents] Device status update:', update);
            onDeviceStatusChange?.(update);
            // Remove from pending changes if this was an optimistic update
            setSyncState({
                "useRealtimeEvents.useCallback[handleDeviceStatusUpdate]": (prev)=>({
                        ...prev,
                        pendingChanges: new Map([
                            ...prev.pendingChanges
                        ].filter({
                            "useRealtimeEvents.useCallback[handleDeviceStatusUpdate]": ([_, val])=>val.deviceId !== update.deviceId
                        }["useRealtimeEvents.useCallback[handleDeviceStatusUpdate]"]))
                    })
            }["useRealtimeEvents.useCallback[handleDeviceStatusUpdate]"]);
        }
    }["useRealtimeEvents.useCallback[handleDeviceStatusUpdate]"], [
        onDeviceStatusChange
    ]);
    // Playlist update handler with conflict resolution
    const handlePlaylistUpdate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRealtimeEvents.useCallback[handlePlaylistUpdate]": (update)=>{
            console.log('[RealtimeEvents] Playlist update:', update);
            onPlaylistChange?.(update);
            // Check for conflicts with pending changes
            setSyncState({
                "useRealtimeEvents.useCallback[handlePlaylistUpdate]": (prev)=>{
                    const conflicted = [
                        ...prev.pendingChanges.entries()
                    ].filter({
                        "useRealtimeEvents.useCallback[handlePlaylistUpdate].conflicted": ([_, val])=>val.playlistId === update.playlistId
                    }["useRealtimeEvents.useCallback[handlePlaylistUpdate].conflicted"]);
                    if (conflicted.length > 0) {
                        const resolved = resolveConflict(conflicted[0][1], update.payload);
                        return {
                            ...prev,
                            pendingChanges: new Map([
                                ...prev.pendingChanges
                            ].filter({
                                "useRealtimeEvents.useCallback[handlePlaylistUpdate]": ([id])=>!conflicted.some({
                                        "useRealtimeEvents.useCallback[handlePlaylistUpdate]": ([cId])=>cId === id
                                    }["useRealtimeEvents.useCallback[handlePlaylistUpdate]"])
                            }["useRealtimeEvents.useCallback[handlePlaylistUpdate]"]))
                        };
                    }
                    return prev;
                }
            }["useRealtimeEvents.useCallback[handlePlaylistUpdate]"]);
        }
    }["useRealtimeEvents.useCallback[handlePlaylistUpdate]"], [
        onPlaylistChange,
        resolveConflict
    ]);
    // Health alert handler
    const handleHealthAlert = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRealtimeEvents.useCallback[handleHealthAlert]": (alert)=>{
            console.log('[RealtimeEvents] Health alert:', alert);
            onHealthAlert?.(alert);
        }
    }["useRealtimeEvents.useCallback[handleHealthAlert]"], [
        onHealthAlert
    ]);
    // Schedule execution handler
    const handleScheduleExecution = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useRealtimeEvents.useCallback[handleScheduleExecution]": (execution)=>{
            console.log('[RealtimeEvents] Schedule execution:', execution);
            onScheduleExecution?.(execution);
        }
    }["useRealtimeEvents.useCallback[handleScheduleExecution]"], [
        onScheduleExecution
    ]);
    // Setup Socket.io event listeners
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useRealtimeEvents.useEffect": ()=>{
            if (!enabled || !socket) return;
            // Device status updates
            const unsubDeviceStatus = on('device:status-update', handleDeviceStatusUpdate);
            // Playlist changes
            const unsubPlaylist = on('playlist:updated', handlePlaylistUpdate);
            // Health alerts
            const unsubHealth = on('health:alert', handleHealthAlert);
            // Schedule execution
            const unsubSchedule = on('schedule:executed', handleScheduleExecution);
            // Connection state change
            const unsubConnect = on('connect', {
                "useRealtimeEvents.useEffect.unsubConnect": ()=>{
                    setIsOffline(false);
                    onConnectionChange?.(true);
                    console.log('[RealtimeEvents] Connected, syncing offline queue...');
                    syncOfflineQueue();
                }
            }["useRealtimeEvents.useEffect.unsubConnect"]);
            const unsubDisconnect = on('disconnect', {
                "useRealtimeEvents.useEffect.unsubDisconnect": ()=>{
                    setIsOffline(true);
                    onConnectionChange?.(false);
                    console.log('[RealtimeEvents] Disconnected, offline mode enabled');
                }
            }["useRealtimeEvents.useEffect.unsubDisconnect"]);
            // Sync state update callback
            if (onSyncStateChange) {
                onSyncStateChange(syncState);
            }
            return ({
                "useRealtimeEvents.useEffect": ()=>{
                    unsubDeviceStatus?.();
                    unsubPlaylist?.();
                    unsubHealth?.();
                    unsubSchedule?.();
                    unsubConnect?.();
                    unsubDisconnect?.();
                }
            })["useRealtimeEvents.useEffect"];
        }
    }["useRealtimeEvents.useEffect"], [
        enabled,
        socket,
        on,
        handleDeviceStatusUpdate,
        handlePlaylistUpdate,
        handleHealthAlert,
        handleScheduleExecution,
        onConnectionChange,
        onSyncStateChange,
        syncState,
        syncOfflineQueue
    ]);
    // Monitor offline/online status
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useRealtimeEvents.useEffect": ()=>{
            const handleOnline = {
                "useRealtimeEvents.useEffect.handleOnline": ()=>{
                    console.log('[RealtimeEvents] Browser online, attempting to sync...');
                    setIsOffline(false);
                    if (isConnected) {
                        syncOfflineQueue();
                    }
                }
            }["useRealtimeEvents.useEffect.handleOnline"];
            const handleOffline = {
                "useRealtimeEvents.useEffect.handleOffline": ()=>{
                    console.log('[RealtimeEvents] Browser offline, queuing events...');
                    setIsOffline(true);
                }
            }["useRealtimeEvents.useEffect.handleOffline"];
            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);
            return ({
                "useRealtimeEvents.useEffect": ()=>{
                    window.removeEventListener('online', handleOnline);
                    window.removeEventListener('offline', handleOffline);
                }
            })["useRealtimeEvents.useEffect"];
        }
    }["useRealtimeEvents.useEffect"], [
        isConnected,
        syncOfflineQueue
    ]);
    // Public API
    return {
        // State
        isConnected,
        isOffline,
        syncState,
        offlineQueueLength: offlineQueueRef.current.length,
        // Methods
        emitDeviceUpdate: (data)=>{
            emitEvent('device:update', data, {
                optimistic: true
            });
        },
        emitPlaylistUpdate: (data)=>{
            emitEvent('playlist:update', data, {
                optimistic: true
            });
        },
        emitScheduleUpdate: (data)=>{
            emitEvent('schedule:update', data, {
                optimistic: true
            });
        },
        emitCustomEvent: (event, data, options)=>{
            emitEvent(event, data, options);
        },
        // Sync management
        syncOfflineQueue,
        clearOfflineQueue: ()=>{
            console.log('[RealtimeEvents] Clearing offline queue');
            offlineQueueRef.current = [];
        },
        getOfflineQueue: ()=>[
                ...offlineQueueRef.current
            ],
        getConflictedChanges: ()=>new Map(syncState.conflictedChanges),
        resolveConflict
    };
}
_s(useRealtimeEvents, "GgYNqDIb7UKv8OqQnHfmF1x6NWU=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useSocket$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSocket"]
    ];
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/lib/hooks/useOptimisticState.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Optimistic State Management with Rollback Support
// Handles optimistic UI updates with automatic rollback on failure
__turbopack_context__.s([
    "useOptimisticState",
    ()=>useOptimisticState
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function useOptimisticState(initialState, options = {}) {
    _s();
    const { onRollback, onCommit, enableLogging = true } = options;
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialState);
    const [pendingUpdates, setPendingUpdates] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(new Map());
    const updateQueueRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])([]);
    // Apply optimistic update
    const updateOptimistic = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOptimisticState.useCallback[updateOptimistic]": (id, updater, metadata)=>{
            setState({
                "useOptimisticState.useCallback[updateOptimistic]": (prevState)=>{
                    const optimisticState = updater(prevState);
                    // Track the update
                    const update = {
                        id,
                        previousState: prevState,
                        optimisticState,
                        timestamp: Date.now(),
                        metadata
                    };
                    setPendingUpdates({
                        "useOptimisticState.useCallback[updateOptimistic]": (prev)=>new Map(prev).set(id, update)
                    }["useOptimisticState.useCallback[updateOptimistic]"]);
                    updateQueueRef.current.push(update);
                    if (enableLogging) {
                        console.log('[OptimisticState] Applied optimistic update:', id, {
                            previous: prevState,
                            optimistic: optimisticState
                        });
                    }
                    return optimisticState;
                }
            }["useOptimisticState.useCallback[updateOptimistic]"]);
        }
    }["useOptimisticState.useCallback[updateOptimistic]"], [
        enableLogging
    ]);
    // Commit optimistic update (confirm with server)
    const commitOptimistic = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOptimisticState.useCallback[commitOptimistic]": (id)=>{
            setPendingUpdates({
                "useOptimisticState.useCallback[commitOptimistic]": (prev)=>{
                    const updated = new Map(prev);
                    const update = updated.get(id);
                    if (update) {
                        if (enableLogging) {
                            console.log('[OptimisticState] Committed update:', id);
                        }
                        onCommit?.(update);
                        updated.delete(id);
                    }
                    return updated;
                }
            }["useOptimisticState.useCallback[commitOptimistic]"]);
        }
    }["useOptimisticState.useCallback[commitOptimistic]"], [
        enableLogging,
        onCommit
    ]);
    // Rollback optimistic update on failure
    const rollbackOptimistic = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOptimisticState.useCallback[rollbackOptimistic]": (id, fallbackState)=>{
            setPendingUpdates({
                "useOptimisticState.useCallback[rollbackOptimistic]": (prev)=>{
                    const updated = new Map(prev);
                    const update = updated.get(id);
                    if (update) {
                        setState(fallbackState ?? update.previousState);
                        if (enableLogging) {
                            console.log('[OptimisticState] Rolled back update:', id, {
                                previousState: update.previousState
                            });
                        }
                        onRollback?.(update);
                        updated.delete(id);
                    }
                    return updated;
                }
            }["useOptimisticState.useCallback[rollbackOptimistic]"]);
        }
    }["useOptimisticState.useCallback[rollbackOptimistic]"], [
        enableLogging,
        onRollback
    ]);
    // Rollback all pending updates
    const rollbackAll = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOptimisticState.useCallback[rollbackAll]": ()=>{
            setPendingUpdates({
                "useOptimisticState.useCallback[rollbackAll]": (prev)=>{
                    if (prev.size === 0) return prev;
                    // Get the first update to find the original state
                    const updates = Array.from(prev.values());
                    const originalState = updates[0]?.previousState;
                    if (originalState) {
                        setState(originalState);
                        if (enableLogging) {
                            console.log('[OptimisticState] Rolled back all updates:', prev.size);
                        }
                        updates.forEach({
                            "useOptimisticState.useCallback[rollbackAll]": (update)=>onRollback?.(update)
                        }["useOptimisticState.useCallback[rollbackAll]"]);
                    }
                    return new Map();
                }
            }["useOptimisticState.useCallback[rollbackAll]"]);
        }
    }["useOptimisticState.useCallback[rollbackAll]"], [
        enableLogging,
        onRollback
    ]);
    // Batch optimistic updates
    const batchUpdate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOptimisticState.useCallback[batchUpdate]": (updates)=>{
            setState({
                "useOptimisticState.useCallback[batchUpdate]": (prevState)=>{
                    let currentState = prevState;
                    updates.forEach({
                        "useOptimisticState.useCallback[batchUpdate]": ({ id, updater, metadata })=>{
                            currentState = updater(currentState);
                            const update = {
                                id,
                                previousState: prevState,
                                optimisticState: currentState,
                                timestamp: Date.now(),
                                metadata
                            };
                            setPendingUpdates({
                                "useOptimisticState.useCallback[batchUpdate]": (prev)=>new Map(prev).set(id, update)
                            }["useOptimisticState.useCallback[batchUpdate]"]);
                            updateQueueRef.current.push(update);
                            if (enableLogging) {
                                console.log('[OptimisticState] Batched update:', id);
                            }
                        }
                    }["useOptimisticState.useCallback[batchUpdate]"]);
                    return currentState;
                }
            }["useOptimisticState.useCallback[batchUpdate]"]);
        }
    }["useOptimisticState.useCallback[batchUpdate]"], [
        enableLogging
    ]);
    return {
        state,
        pendingUpdates,
        updateOptimistic,
        commitOptimistic,
        rollbackOptimistic,
        rollbackAll,
        batchUpdate,
        getPendingCount: ()=>pendingUpdates.size,
        hasPendingUpdates: ()=>pendingUpdates.size > 0,
        getUpdateQueue: ()=>[
                ...updateQueueRef.current
            ]
    };
}
_s(useOptimisticState, "8HQbnfZPhuswzipX+5SJxJ/itfE=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/lib/hooks/useErrorRecovery.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Advanced Error Recovery and Retry Logic
// Handles exponential backoff, circuit breaker pattern, and intelligent retries
__turbopack_context__.s([
    "useErrorRecovery",
    ()=>useErrorRecovery
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function useErrorRecovery(options = {}) {
    _s();
    const { onError, onRetry, onCircuitBreakerChange, retryConfig: customRetryConfig, circuitBreakerConfig: customCircuitBreakerConfig, enableLogging = true } = options;
    // Default configs
    const retryConfig = {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitter: true,
        ...customRetryConfig
    };
    const circuitBreakerConfig = {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000,
        ...customCircuitBreakerConfig
    };
    // State
    const [errors, setErrors] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(new Map());
    const [circuitBreaker, setCircuitBreaker] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        lastStateChangeTime: Date.now()
    });
    const retriesRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(new Map());
    // Calculate retry delay with exponential backoff
    const calculateDelay = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useErrorRecovery.useCallback[calculateDelay]": (retryCount)=>{
            const exponentialDelay = retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, retryCount);
            const capped = Math.min(exponentialDelay, retryConfig.maxDelay);
            const withJitter = retryConfig.jitter ? capped * (0.5 + Math.random()) : capped;
            return Math.floor(withJitter);
        }
    }["useErrorRecovery.useCallback[calculateDelay]"], [
        retryConfig
    ]);
    // Update circuit breaker state
    const updateCircuitBreakerState = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useErrorRecovery.useCallback[updateCircuitBreakerState]": (isSuccess)=>{
            setCircuitBreaker({
                "useErrorRecovery.useCallback[updateCircuitBreakerState]": (prev)=>{
                    let newState = prev.state;
                    let newFailureCount = prev.failureCount;
                    let newSuccessCount = prev.successCount;
                    if (isSuccess) {
                        newFailureCount = 0;
                        newSuccessCount = prev.successCount + 1;
                        if (prev.state === 'HALF_OPEN' && newSuccessCount >= circuitBreakerConfig.successThreshold) {
                            newState = 'CLOSED';
                            newSuccessCount = 0;
                            if (enableLogging) {
                                console.log('[ErrorRecovery] Circuit breaker CLOSED after successful recovery');
                            }
                            onCircuitBreakerChange?.(false);
                        }
                    } else {
                        newSuccessCount = 0;
                        newFailureCount = prev.failureCount + 1;
                        if (newFailureCount >= circuitBreakerConfig.failureThreshold && prev.state === 'CLOSED') {
                            newState = 'OPEN';
                            if (enableLogging) {
                                console.log('[ErrorRecovery] Circuit breaker OPENED due to repeated failures');
                            }
                            onCircuitBreakerChange?.(true);
                        }
                    }
                    return {
                        ...prev,
                        state: newState,
                        failureCount: newFailureCount,
                        successCount: newSuccessCount,
                        lastFailureTime: isSuccess ? prev.lastFailureTime : Date.now(),
                        lastStateChangeTime: newState !== prev.state ? Date.now() : prev.lastStateChangeTime
                    };
                }
            }["useErrorRecovery.useCallback[updateCircuitBreakerState]"]);
        }
    }["useErrorRecovery.useCallback[updateCircuitBreakerState]"], [
        circuitBreakerConfig,
        enableLogging,
        onCircuitBreakerChange
    ]);
    // Check if circuit breaker should transition from OPEN to HALF_OPEN
    const checkCircuitBreakerTimeout = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useErrorRecovery.useCallback[checkCircuitBreakerTimeout]": ()=>{
            setCircuitBreaker({
                "useErrorRecovery.useCallback[checkCircuitBreakerTimeout]": (prev)=>{
                    if (prev.state === 'OPEN') {
                        const timeSinceStateChange = Date.now() - prev.lastStateChangeTime;
                        if (timeSinceStateChange >= circuitBreakerConfig.timeout) {
                            if (enableLogging) {
                                console.log('[ErrorRecovery] Circuit breaker transitioning to HALF_OPEN');
                            }
                            return {
                                ...prev,
                                state: 'HALF_OPEN',
                                successCount: 0,
                                failureCount: 0,
                                lastStateChangeTime: Date.now()
                            };
                        }
                    }
                    return prev;
                }
            }["useErrorRecovery.useCallback[checkCircuitBreakerTimeout]"]);
        }
    }["useErrorRecovery.useCallback[checkCircuitBreakerTimeout]"], [
        circuitBreakerConfig.timeout,
        enableLogging
    ]);
    // Record error
    const recordError = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useErrorRecovery.useCallback[recordError]": (id, error, severity = 'warning', context)=>{
            const errorInfo = {
                id,
                error,
                severity,
                timestamp: Date.now(),
                retryCount: 0,
                context
            };
            setErrors({
                "useErrorRecovery.useCallback[recordError]": (prev)=>new Map(prev).set(id, errorInfo)
            }["useErrorRecovery.useCallback[recordError]"]);
            updateCircuitBreakerState(false);
            onError?.(errorInfo);
            if (enableLogging) {
                console.error('[ErrorRecovery] Error recorded:', {
                    id,
                    error: error instanceof Error ? error.message : error,
                    severity
                });
            }
        }
    }["useErrorRecovery.useCallback[recordError]"], [
        updateCircuitBreakerState,
        onError,
        enableLogging
    ]);
    // Retry with exponential backoff
    const retry = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useErrorRecovery.useCallback[retry]": (id, operation, onSuccess, onFailure)=>{
            checkCircuitBreakerTimeout();
            // Reject if circuit breaker is open
            if (circuitBreaker.state === 'OPEN') {
                const error = new Error('Circuit breaker is OPEN - too many failures');
                recordError(id, error, 'critical');
                onFailure?.(error);
                return Promise.reject(error);
            }
            const executeRetry = {
                "useErrorRecovery.useCallback[retry].executeRetry": (retryCount = 0)=>{
                    if (retryCount >= retryConfig.maxAttempts) {
                        const error = new Error(`Max retry attempts (${retryConfig.maxAttempts}) exceeded for ${id}`);
                        recordError(id, error, 'critical', {
                            retryCount
                        });
                        onFailure?.(error);
                        return Promise.reject(error);
                    }
                    return operation().then({
                        "useErrorRecovery.useCallback[retry].executeRetry": (result)=>{
                            // Clear retry state
                            retriesRef.current.delete(id);
                            setErrors({
                                "useErrorRecovery.useCallback[retry].executeRetry": (prev)=>{
                                    const updated = new Map(prev);
                                    updated.delete(id);
                                    return updated;
                                }
                            }["useErrorRecovery.useCallback[retry].executeRetry"]);
                            // Update circuit breaker on success
                            updateCircuitBreakerState(true);
                            onSuccess?.(result);
                            if (enableLogging) {
                                console.log('[ErrorRecovery] Operation succeeded:', {
                                    id,
                                    retryCount
                                });
                            }
                            return result;
                        }
                    }["useErrorRecovery.useCallback[retry].executeRetry"]).catch({
                        "useErrorRecovery.useCallback[retry].executeRetry": (error)=>{
                            const delay = calculateDelay(retryCount);
                            const nextRetryTime = Date.now() + delay;
                            setErrors({
                                "useErrorRecovery.useCallback[retry].executeRetry": (prev)=>{
                                    const updated = new Map(prev);
                                    const errorInfo = updated.get(id) ?? {
                                        id,
                                        error,
                                        severity: 'warning',
                                        timestamp: Date.now(),
                                        retryCount: 0
                                    };
                                    errorInfo.retryCount = retryCount + 1;
                                    errorInfo.lastRetryTime = Date.now();
                                    errorInfo.nextRetryTime = nextRetryTime;
                                    updated.set(id, errorInfo);
                                    return updated;
                                }
                            }["useErrorRecovery.useCallback[retry].executeRetry"]);
                            onRetry?.({
                                id,
                                error,
                                severity: 'warning',
                                timestamp: Date.now(),
                                retryCount: retryCount + 1,
                                lastRetryTime: Date.now(),
                                nextRetryTime
                            });
                            if (enableLogging) {
                                console.log('[ErrorRecovery] Retrying after', delay, 'ms:', {
                                    id,
                                    attempt: retryCount + 1,
                                    maxAttempts: retryConfig.maxAttempts
                                });
                            }
                            return new Promise({
                                "useErrorRecovery.useCallback[retry].executeRetry": (resolve, reject)=>{
                                    const timeout = setTimeout({
                                        "useErrorRecovery.useCallback[retry].executeRetry.timeout": ()=>executeRetry(retryCount + 1).then(resolve).catch(reject)
                                    }["useErrorRecovery.useCallback[retry].executeRetry.timeout"], delay);
                                    // Store timeout for cleanup
                                    const retryState = retriesRef.current.get(id) ?? {
                                        count: 0
                                    };
                                    retryState.timeout = timeout;
                                    retriesRef.current.set(id, retryState);
                                }
                            }["useErrorRecovery.useCallback[retry].executeRetry"]);
                        }
                    }["useErrorRecovery.useCallback[retry].executeRetry"]);
                }
            }["useErrorRecovery.useCallback[retry].executeRetry"];
            return executeRetry();
        }
    }["useErrorRecovery.useCallback[retry]"], [
        retryConfig,
        circuitBreaker,
        calculateDelay,
        recordError,
        updateCircuitBreakerState,
        checkCircuitBreakerTimeout,
        enableLogging
    ]);
    // Clear error
    const clearError = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useErrorRecovery.useCallback[clearError]": (id)=>{
            setErrors({
                "useErrorRecovery.useCallback[clearError]": (prev)=>{
                    const updated = new Map(prev);
                    updated.delete(id);
                    return updated;
                }
            }["useErrorRecovery.useCallback[clearError]"]);
            const retryState = retriesRef.current.get(id);
            if (retryState?.timeout) {
                clearTimeout(retryState.timeout);
            }
            retriesRef.current.delete(id);
        }
    }["useErrorRecovery.useCallback[clearError]"], []);
    // Clear all errors
    const clearAllErrors = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useErrorRecovery.useCallback[clearAllErrors]": ()=>{
            retriesRef.current.forEach({
                "useErrorRecovery.useCallback[clearAllErrors]": ({ timeout })=>{
                    if (timeout) clearTimeout(timeout);
                }
            }["useErrorRecovery.useCallback[clearAllErrors]"]);
            retriesRef.current.clear();
            setErrors(new Map());
        }
    }["useErrorRecovery.useCallback[clearAllErrors]"], []);
    // Reset circuit breaker
    const resetCircuitBreaker = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useErrorRecovery.useCallback[resetCircuitBreaker]": ()=>{
            setCircuitBreaker({
                state: 'CLOSED',
                failureCount: 0,
                successCount: 0,
                lastStateChangeTime: Date.now()
            });
            if (enableLogging) {
                console.log('[ErrorRecovery] Circuit breaker reset to CLOSED');
            }
            onCircuitBreakerChange?.(false);
        }
    }["useErrorRecovery.useCallback[resetCircuitBreaker]"], [
        enableLogging,
        onCircuitBreakerChange
    ]);
    return {
        // State
        errors,
        circuitBreaker,
        isCircuitBreakerOpen: circuitBreaker.state === 'OPEN',
        // Methods
        recordError,
        retry,
        clearError,
        clearAllErrors,
        resetCircuitBreaker,
        // Helpers
        getError: (id)=>errors.get(id),
        getAllErrors: ()=>new Map(errors),
        getErrorCount: ()=>errors.size,
        hasCriticalErrors: ()=>Array.from(errors.values()).some((e)=>e.severity === 'critical')
    };
}
_s(useErrorRecovery, "ZvYszGwPdVQ2cVH9zY28rk8yiV8=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/lib/hooks/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

// Export all custom hooks for easy importing
// Core hooks
__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useAuth$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useAuth.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useSocket$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useSocket.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useToast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useToast.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useTheme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useTheme.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useDebounce$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useDebounce.tsx [app-client] (ecmascript)");
// Analytics and data hooks
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useAnalyticsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useAnalyticsData.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useChartData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useChartData.ts [app-client] (ecmascript)");
// Real-time and state management hooks (Phase 8 - Socket.io integration)
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useRealtimeEvents$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useRealtimeEvents.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useOptimisticState$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useOptimisticState.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useErrorRecovery$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useErrorRecovery.ts [app-client] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/app/dashboard/schedules/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>SchedulesPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$Modal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/Modal.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ConfirmDialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/ConfirmDialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$LoadingSpinner$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/LoadingSpinner.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$EmptyState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/EmptyState.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$TimePicker$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/TimePicker.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$DaySelector$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/DaySelector.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useToast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useToast.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useRealtimeEvents$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useRealtimeEvents.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/theme/icons.tsx [app-client] (ecmascript)");
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
;
;
;
;
function SchedulesPage() {
    _s();
    const toast = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useToast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useToast"])();
    const [schedules, setSchedules] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [devices, setDevices] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [playlists, setPlaylists] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [actionLoading, setActionLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [realtimeStatus, setRealtimeStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('offline');
    const [executionHistory, setExecutionHistory] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isEditModalOpen, setIsEditModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [selectedSchedule, setSelectedSchedule] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Form state
    const [formData, setFormData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        name: '',
        startTime: '09:00',
        duration: 60,
        days: [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday'
        ],
        timezone: 'America/New_York',
        playlistId: '',
        deviceIds: []
    });
    const [formErrors, setFormErrors] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    // Real-time event handling for schedule execution
    const { isConnected } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useRealtimeEvents$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRealtimeEvents"])({
        enabled: true,
        onScheduleExecution: {
            "SchedulesPage.useRealtimeEvents": (execution)=>{
                console.log('[SchedulesPage] Schedule execution:', execution);
                // Track execution in history
                setExecutionHistory({
                    "SchedulesPage.useRealtimeEvents": (prev)=>({
                            ...prev,
                            [execution.scheduleId]: {
                                action: execution.action,
                                timestamp: execution.timestamp,
                                error: execution.error,
                                displayId: execution.displayId
                            }
                        })
                }["SchedulesPage.useRealtimeEvents"]);
                // Show notification based on execution status
                switch(execution.action){
                    case 'started':
                        toast.info(`Schedule started on device ${execution.displayId?.substring(0, 8)}...`);
                        break;
                    case 'completed':
                        toast.success(`Schedule completed on device ${execution.displayId?.substring(0, 8)}...`);
                        break;
                    case 'failed':
                        toast.error(`Schedule failed: ${execution.error || 'Unknown error'}`);
                        break;
                }
                // Update schedule status if needed
                setSchedules({
                    "SchedulesPage.useRealtimeEvents": (prev)=>prev.map({
                            "SchedulesPage.useRealtimeEvents": (schedule)=>schedule.id === execution.scheduleId ? {
                                    ...schedule,
                                    lastExecution: {
                                        action: execution.action,
                                        timestamp: execution.timestamp
                                    }
                                } : schedule
                        }["SchedulesPage.useRealtimeEvents"])
                }["SchedulesPage.useRealtimeEvents"]);
            }
        }["SchedulesPage.useRealtimeEvents"],
        onConnectionChange: {
            "SchedulesPage.useRealtimeEvents": (connected)=>{
                setRealtimeStatus(connected ? 'connected' : 'offline');
                if (connected) {
                    toast.info('Real-time schedule monitoring enabled');
                }
            }
        }["SchedulesPage.useRealtimeEvents"]
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SchedulesPage.useEffect": ()=>{
            loadData();
        }
    }["SchedulesPage.useEffect"], []);
    const loadData = async ()=>{
        try {
            setLoading(true);
            const [schedulesRes, devicesRes, playlistsRes] = await Promise.allSettled([
                __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getSchedules(),
                __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getDisplays(),
                __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getPlaylists()
            ]);
            if (schedulesRes.status === 'fulfilled') {
                setSchedules(schedulesRes.value || []);
            }
            if (devicesRes.status === 'fulfilled') {
                setDevices(devicesRes.value || []);
            }
            if (playlistsRes.status === 'fulfilled') {
                setPlaylists(playlistsRes.value || []);
            }
        } catch (error) {
            toast.error(error.message || 'Failed to load data');
        } finally{
            setLoading(false);
        }
    };
    const validateForm = ()=>{
        const errors = {};
        if (!formData.name.trim()) {
            errors.name = 'Schedule name is required';
        }
        if (formData.days.length === 0) {
            errors.days = 'Select at least one day';
        }
        if (!formData.playlistId) {
            errors.playlistId = 'Select a playlist';
        }
        if (formData.deviceIds.length === 0) {
            errors.deviceIds = 'Select at least one device';
        }
        if (formData.duration < 1 || formData.duration > 1440) {
            errors.duration = 'Duration must be between 1 and 1440 minutes';
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };
    const handleCreate = async ()=>{
        if (!validateForm()) return;
        try {
            setActionLoading(true);
            const newSchedule = {
                ...formData,
                id: Math.random().toString(36).substr(2, 9),
                active: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            // TODO: Call API when backend is ready
            // await apiClient.createSchedule(formData);
            setSchedules([
                ...schedules,
                newSchedule
            ]);
            resetForm();
            setIsCreateModalOpen(false);
            toast.success('Schedule created successfully');
        } catch (error) {
            toast.error(error.message || 'Failed to create schedule');
        } finally{
            setActionLoading(false);
        }
    };
    const handleUpdate = async ()=>{
        if (!validateForm() || !selectedSchedule) return;
        try {
            setActionLoading(true);
            // TODO: Call API when backend is ready
            // await apiClient.updateSchedule(selectedSchedule.id, formData);
            setSchedules(schedules.map((s)=>s.id === selectedSchedule.id ? {
                    ...selectedSchedule,
                    ...formData
                } : s));
            resetForm();
            setIsEditModalOpen(false);
            toast.success('Schedule updated successfully');
        } catch (error) {
            toast.error(error.message || 'Failed to update schedule');
        } finally{
            setActionLoading(false);
        }
    };
    const handleDelete = async ()=>{
        if (!selectedSchedule) return;
        try {
            setActionLoading(true);
            // TODO: Call API when backend is ready
            // await apiClient.deleteSchedule(selectedSchedule.id);
            setSchedules(schedules.filter((s)=>s.id !== selectedSchedule.id));
            setIsDeleteModalOpen(false);
            setSelectedSchedule(null);
            toast.success('Schedule deleted successfully');
        } catch (error) {
            toast.error(error.message || 'Failed to delete schedule');
        } finally{
            setActionLoading(false);
        }
    };
    const openEditModal = (schedule)=>{
        setSelectedSchedule(schedule);
        setFormData({
            name: schedule.name,
            startTime: schedule.startTime,
            duration: schedule.duration,
            days: schedule.days,
            timezone: schedule.timezone,
            playlistId: schedule.playlistId,
            deviceIds: schedule.deviceIds
        });
        setFormErrors({});
        setIsEditModalOpen(true);
    };
    const openDeleteModal = (schedule)=>{
        setSelectedSchedule(schedule);
        setIsDeleteModalOpen(true);
    };
    const resetForm = ()=>{
        setFormData({
            name: '',
            startTime: '09:00',
            duration: 60,
            days: [
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday'
            ],
            timezone: 'America/New_York',
            playlistId: '',
            deviceIds: []
        });
        setFormErrors({});
        setSelectedSchedule(null);
    };
    const getPlaylistName = (playlistId)=>{
        return playlists.find((p)=>p.id === playlistId)?.name || 'Unknown Playlist';
    };
    const getDeviceNames = (deviceIds)=>{
        return deviceIds.map((id)=>devices.find((d)=>d.id === id)?.nickname || id).join(', ');
    };
    const formatScheduleTime = (startTime, duration)=>{
        const [hours, minutes] = startTime.split(':').map(Number);
        const endHours = Math.floor((hours * 60 + minutes + duration) / 60) % 24;
        const endMinutes = (hours * 60 + minutes + duration) % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} - ${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    };
    // Calculate next 10 occurrences for preview
    const getNextOccurrences = ()=>{
        const occurrences = [];
        const dayMap = {
            Monday: 1,
            Tuesday: 2,
            Wednesday: 3,
            Thursday: 4,
            Friday: 5,
            Saturday: 6,
            Sunday: 0
        };
        const today = new Date();
        let current = new Date(today);
        while(occurrences.length < 10){
            const dayName = current.toLocaleDateString('en-US', {
                weekday: 'long'
            });
            if (formData.days.includes(dayName)) {
                occurrences.push(current.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: '2-digit'
                }));
            }
            current.setDate(current.getDate() + 1);
        }
        return occurrences;
    };
    if (loading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "bg-white dark:bg-gray-900 rounded-lg shadow p-12",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$LoadingSpinner$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                size: "lg"
            }, void 0, false, {
                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                lineNumber: 316,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
            lineNumber: 315,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex justify-between items-center",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-3xl font-bold text-gray-900 dark:text-gray-50",
                                children: "Schedules"
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                lineNumber: 326,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-2 text-gray-600 dark:text-gray-400",
                                children: [
                                    "Automate content playback with schedules (",
                                    schedules.length,
                                    " total)"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                lineNumber: 327,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                        lineNumber: 325,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>{
                            resetForm();
                            setIsCreateModalOpen(true);
                        },
                        className: "bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2 active:scale-95",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                                name: "add",
                                size: "lg",
                                className: "text-white"
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                lineNumber: 338,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Create Schedule"
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                lineNumber: 339,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                        lineNumber: 331,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                lineNumber: 324,
                columnNumber: 7
            }, this),
            schedules.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$EmptyState$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                icon: "schedules",
                title: "No schedules yet",
                description: "Create your first schedule to automate content playback on your devices",
                action: {
                    label: 'Create Schedule',
                    onClick: ()=>{
                        resetForm();
                        setIsCreateModalOpen(true);
                    }
                }
            }, void 0, false, {
                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                lineNumber: 345,
                columnNumber: 9
            }, this) : /* Schedules List */ /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-4",
                children: schedules.map((schedule)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 hover:shadow-lg transition border-l-4 border-blue-500",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-start justify-between",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-start gap-4 flex-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                                            name: "schedules",
                                            size: "2xl",
                                            className: "text-blue-600 dark:text-blue-400"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 367,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex-1 min-w-0",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center gap-3 mb-3",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                            className: "text-xl font-semibold text-gray-900 dark:text-gray-50 truncate",
                                                            children: schedule.name
                                                        }, void 0, false, {
                                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                            lineNumber: 370,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "px-3 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
                                                            children: "Active"
                                                        }, void 0, false, {
                                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                            lineNumber: 373,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                    lineNumber: 369,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "grid grid-cols-1 md:grid-cols-2 gap-4 text-sm",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "font-medium text-gray-700 dark:text-gray-300",
                                                                    children: "Time:"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                                    lineNumber: 380,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    className: "text-gray-600 dark:text-gray-400",
                                                                    children: formatScheduleTime(schedule.startTime, schedule.duration)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                                    lineNumber: 381,
                                                                    columnNumber: 25
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                            lineNumber: 379,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "font-medium text-gray-700 dark:text-gray-300",
                                                                    children: "Days:"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                                    lineNumber: 384,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    className: "text-gray-600 dark:text-gray-400",
                                                                    children: schedule.days.join(', ')
                                                                }, void 0, false, {
                                                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                                    lineNumber: 385,
                                                                    columnNumber: 25
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                            lineNumber: 383,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "font-medium text-gray-700 dark:text-gray-300",
                                                                    children: "Playlist:"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                                    lineNumber: 388,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    className: "text-gray-600 dark:text-gray-400 truncate",
                                                                    children: getPlaylistName(schedule.playlistId)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                                    lineNumber: 389,
                                                                    columnNumber: 25
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                            lineNumber: 387,
                                                            columnNumber: 23
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "font-medium text-gray-700 dark:text-gray-300",
                                                                    children: "Devices:"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                                    lineNumber: 392,
                                                                    columnNumber: 25
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                    className: "text-gray-600 dark:text-gray-400 truncate",
                                                                    children: [
                                                                        schedule.deviceIds.length,
                                                                        " device",
                                                                        schedule.deviceIds.length !== 1 ? 's' : ''
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                                    lineNumber: 393,
                                                                    columnNumber: 25
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                            lineNumber: 391,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                    lineNumber: 378,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 368,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 366,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                lineNumber: 365,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>openEditModal(schedule),
                                        className: "px-4 py-2 text-sm bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-200 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800 transition font-medium active:scale-95",
                                        children: "Edit"
                                    }, void 0, false, {
                                        fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                        lineNumber: 402,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>{
                                            setSelectedSchedule(schedule);
                                            setFormData({
                                                name: schedule.name,
                                                startTime: schedule.startTime,
                                                duration: schedule.duration,
                                                days: schedule.days,
                                                timezone: schedule.timezone,
                                                playlistId: schedule.playlistId,
                                                deviceIds: schedule.deviceIds
                                            });
                                            setIsCreateModalOpen(true);
                                        },
                                        className: "px-4 py-2 text-sm bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium active:scale-95",
                                        children: "Duplicate"
                                    }, void 0, false, {
                                        fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                        lineNumber: 408,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>openDeleteModal(schedule),
                                        className: "px-4 py-2 text-sm bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200 rounded-lg hover:bg-red-100 dark:hover:bg-red-800 transition font-medium active:scale-95",
                                        children: "Delete"
                                    }, void 0, false, {
                                        fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                        lineNumber: 426,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                lineNumber: 401,
                                columnNumber: 15
                            }, this)
                        ]
                    }, schedule.id, true, {
                        fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                        lineNumber: 361,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                lineNumber: 359,
                columnNumber: 9
            }, this),
            schedules.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                        className: "font-semibold text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                                name: "info",
                                size: "md",
                                className: "text-blue-600 dark:text-blue-400"
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                lineNumber: 442,
                                columnNumber: 13
                            }, this),
                            "Tips for Using Schedules"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                        lineNumber: 441,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        className: "text-sm text-blue-800 dark:text-blue-300 space-y-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                children: "• Schedules automatically control which playlist plays at specific times"
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                lineNumber: 446,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                children: "• You can overlap schedules - the most recently created one takes precedence"
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                lineNumber: 447,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                children: "• Devices will sync schedule changes automatically"
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                lineNumber: 448,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                children: "• If a device is offline, it will apply the schedule when it comes back online"
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                lineNumber: 449,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                        lineNumber: 445,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                lineNumber: 440,
                columnNumber: 9
            }, this),
            (isCreateModalOpen || isEditModalOpen) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$Modal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                open: isCreateModalOpen || isEditModalOpen,
                onClose: ()=>{
                    if (isCreateModalOpen) setIsCreateModalOpen(false);
                    if (isEditModalOpen) setIsEditModalOpen(false);
                    resetForm();
                },
                title: selectedSchedule ? 'Edit Schedule' : 'Create Schedule',
                actions: [
                    {
                        label: 'Cancel',
                        onClick: ()=>{
                            if (isCreateModalOpen) setIsCreateModalOpen(false);
                            if (isEditModalOpen) setIsEditModalOpen(false);
                            resetForm();
                        },
                        variant: 'secondary'
                    },
                    {
                        label: selectedSchedule ? 'Update' : 'Create',
                        onClick: selectedSchedule ? handleUpdate : handleCreate,
                        loading: actionLoading,
                        variant: 'primary'
                    }
                ],
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-6 max-h-96 overflow-y-auto",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "block text-sm font-medium text-gray-900 dark:text-gray-50 mb-2",
                                    children: [
                                        "Schedule Name ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-red-500",
                                            children: "*"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 486,
                                            columnNumber: 31
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 485,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "text",
                                    value: formData.name,
                                    onChange: (e)=>{
                                        setFormData({
                                            ...formData,
                                            name: e.target.value
                                        });
                                        if (formErrors.name) setFormErrors({
                                            ...formErrors,
                                            name: ''
                                        });
                                    },
                                    placeholder: "e.g., Morning Content, Holiday Special",
                                    className: `w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 focus:ring-2 focus:ring-blue-500 transition ${formErrors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'}`
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 488,
                                    columnNumber: 15
                                }, this),
                                formErrors.name && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-red-600 dark:text-red-400 text-sm mt-1",
                                    children: formErrors.name
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 500,
                                    columnNumber: 35
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                            lineNumber: 484,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid grid-cols-2 gap-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "block text-sm font-medium text-gray-900 dark:text-gray-50 mb-2",
                                            children: [
                                                "Start Time ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-red-500",
                                                    children: "*"
                                                }, void 0, false, {
                                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                    lineNumber: 507,
                                                    columnNumber: 30
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 506,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$TimePicker$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                            value: formData.startTime,
                                            onChange: (time)=>setFormData({
                                                    ...formData,
                                                    startTime: time
                                                }),
                                            interval: 15,
                                            showFormat: "24h"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 509,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 505,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "block text-sm font-medium text-gray-900 dark:text-gray-50 mb-2",
                                            children: [
                                                "Duration (minutes) ",
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-red-500",
                                                    children: "*"
                                                }, void 0, false, {
                                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                    lineNumber: 519,
                                                    columnNumber: 38
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 518,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            type: "number",
                                            value: formData.duration,
                                            onChange: (e)=>{
                                                setFormData({
                                                    ...formData,
                                                    duration: Math.max(1, parseInt(e.target.value) || 0)
                                                });
                                                if (formErrors.duration) setFormErrors({
                                                    ...formErrors,
                                                    duration: ''
                                                });
                                            },
                                            min: "1",
                                            max: "1440",
                                            className: `w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 focus:ring-2 focus:ring-blue-500 transition ${formErrors.duration ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'}`
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 521,
                                            columnNumber: 17
                                        }, this),
                                        formErrors.duration && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-red-600 dark:text-red-400 text-sm mt-1",
                                            children: formErrors.duration
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 534,
                                            columnNumber: 41
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 517,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                            lineNumber: 504,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "block text-sm font-medium text-gray-900 dark:text-gray-50 mb-2",
                                    children: [
                                        "Timezone ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-red-500",
                                            children: "*"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 541,
                                            columnNumber: 26
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 540,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                    value: formData.timezone,
                                    onChange: (e)=>setFormData({
                                            ...formData,
                                            timezone: e.target.value
                                        }),
                                    className: "w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 focus:ring-2 focus:ring-blue-500 transition",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "America/New_York",
                                            children: "Eastern (America/New_York)"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 548,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "America/Chicago",
                                            children: "Central (America/Chicago)"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 549,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "America/Denver",
                                            children: "Mountain (America/Denver)"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 550,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "America/Los_Angeles",
                                            children: "Pacific (America/Los_Angeles)"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 551,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "UTC",
                                            children: "UTC"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 552,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 543,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                            lineNumber: 539,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "block text-sm font-medium text-gray-900 dark:text-gray-50 mb-3",
                                    children: [
                                        "Schedule Days ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-red-500",
                                            children: "*"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 559,
                                            columnNumber: 31
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 558,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$DaySelector$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    selected: formData.days,
                                    onChange: (days)=>{
                                        setFormData({
                                            ...formData,
                                            days
                                        });
                                        if (formErrors.days) setFormErrors({
                                            ...formErrors,
                                            days: ''
                                        });
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 561,
                                    columnNumber: 15
                                }, this),
                                formErrors.days && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-red-600 dark:text-red-400 text-sm mt-2",
                                    children: formErrors.days
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 568,
                                    columnNumber: 35
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                            lineNumber: 557,
                            columnNumber: 13
                        }, this),
                        formData.days.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-800 rounded-lg p-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-sm font-medium text-purple-900 dark:text-purple-200 mb-2",
                                    children: "Next 10 Occurrences:"
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 574,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "text-xs text-purple-800 dark:text-purple-300",
                                    children: getNextOccurrences().join(' • ')
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 575,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                            lineNumber: 573,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "block text-sm font-medium text-gray-900 dark:text-gray-50 mb-2",
                                    children: [
                                        "Playlist ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-red-500",
                                            children: "*"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 584,
                                            columnNumber: 26
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 583,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                    value: formData.playlistId,
                                    onChange: (e)=>{
                                        setFormData({
                                            ...formData,
                                            playlistId: e.target.value
                                        });
                                        if (formErrors.playlistId) setFormErrors({
                                            ...formErrors,
                                            playlistId: ''
                                        });
                                    },
                                    className: `w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 focus:ring-2 focus:ring-blue-500 transition ${formErrors.playlistId ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'}`,
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "",
                                            children: "Select a playlist..."
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 596,
                                            columnNumber: 17
                                        }, this),
                                        playlists.map((p)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: p.id,
                                                children: p.name
                                            }, p.id, false, {
                                                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                lineNumber: 598,
                                                columnNumber: 19
                                            }, this))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 586,
                                    columnNumber: 15
                                }, this),
                                formErrors.playlistId && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-red-600 dark:text-red-400 text-sm mt-1",
                                    children: formErrors.playlistId
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 603,
                                    columnNumber: 41
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                            lineNumber: 582,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "block text-sm font-medium text-gray-900 dark:text-gray-50 mb-2",
                                    children: [
                                        "Devices ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-red-500",
                                            children: "*"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 609,
                                            columnNumber: 25
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 608,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "space-y-2 max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800",
                                    children: devices.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-gray-500 dark:text-gray-400",
                                        children: "No devices available"
                                    }, void 0, false, {
                                        fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                        lineNumber: 613,
                                        columnNumber: 19
                                    }, this) : devices.map((device)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                            className: "flex items-center gap-2 cursor-pointer",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                    type: "checkbox",
                                                    checked: formData.deviceIds.includes(device.id),
                                                    onChange: (e)=>{
                                                        const newDeviceIds = e.target.checked ? [
                                                            ...formData.deviceIds,
                                                            device.id
                                                        ] : formData.deviceIds.filter((id)=>id !== device.id);
                                                        setFormData({
                                                            ...formData,
                                                            deviceIds: newDeviceIds
                                                        });
                                                        if (formErrors.deviceIds) setFormErrors({
                                                            ...formErrors,
                                                            deviceIds: ''
                                                        });
                                                    },
                                                    className: "rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
                                                }, void 0, false, {
                                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                    lineNumber: 617,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-sm text-gray-700 dark:text-gray-300",
                                                    children: device.nickname
                                                }, void 0, false, {
                                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                                    lineNumber: 629,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, device.id, true, {
                                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                            lineNumber: 616,
                                            columnNumber: 21
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 611,
                                    columnNumber: 15
                                }, this),
                                formErrors.deviceIds && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-red-600 dark:text-red-400 text-sm mt-1",
                                    children: formErrors.deviceIds
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 634,
                                    columnNumber: 40
                                }, this),
                                formData.deviceIds.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-sm text-gray-600 dark:text-gray-400 mt-2",
                                    children: [
                                        formData.deviceIds.length,
                                        " device",
                                        formData.deviceIds.length !== 1 ? 's' : '',
                                        " selected"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                                    lineNumber: 636,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                            lineNumber: 607,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                    lineNumber: 482,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                lineNumber: 456,
                columnNumber: 9
            }, this),
            isDeleteModalOpen && selectedSchedule && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ConfirmDialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                open: isDeleteModalOpen,
                onClose: ()=>{
                    setIsDeleteModalOpen(false);
                    setSelectedSchedule(null);
                },
                title: "Delete Schedule",
                description: `Are you sure you want to delete "${selectedSchedule.name}"? This action cannot be undone.`,
                onConfirm: handleDelete,
                loading: actionLoading,
                variant: "danger"
            }, void 0, false, {
                fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
                lineNumber: 647,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/web/src/app/dashboard/schedules/page.tsx",
        lineNumber: 322,
        columnNumber: 5
    }, this);
}
_s(SchedulesPage, "w1c9bHovSq3NURviW5Yfr5NvYi4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useToast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useToast"],
        __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useRealtimeEvents$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRealtimeEvents"]
    ];
});
_c = SchedulesPage;
var _c;
__turbopack_context__.k.register(_c, "SchedulesPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=web_src_bbc11db1._.js.map