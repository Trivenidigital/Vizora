(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
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
"[project]/web/src/theme/colors.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Semantic Color System for Vizora
 * Provides consistent color usage across the application
 * with light and dark mode variants
 */ __turbopack_context__.s([
    "getContrastColor",
    ()=>getContrastColor,
    "getSemanticColor",
    ()=>getSemanticColor,
    "semanticColors",
    ()=>semanticColors,
    "statusColors",
    ()=>statusColors
]);
const semanticColors = {
    // Primary action color - main brand color
    primary: {
        light: '#0284c7',
        dark: '#0ea5e9',
        50: '#f0f9ff',
        100: '#e0f2fe',
        200: '#bae6fd',
        300: '#7dd3fc',
        400: '#38bdf8',
        500: '#0ea5e9',
        600: '#0284c7',
        700: '#0369a1',
        800: '#075985',
        900: '#0c3d66'
    },
    // Success state - positive actions and confirmations
    success: {
        light: '#16a34a',
        dark: '#22c55e',
        50: '#f0fdf4',
        100: '#dcfce7',
        200: '#bbf7d0',
        300: '#86efac',
        400: '#4ade80',
        500: '#22c55e',
        600: '#16a34a',
        700: '#15803d',
        800: '#166534',
        900: '#145231'
    },
    // Warning state - caution and attention needed
    warning: {
        light: '#d97706',
        dark: '#fbbf24',
        50: '#fffbeb',
        100: '#fef3c7',
        200: '#fde68a',
        300: '#fcd34d',
        400: '#fbbf24',
        500: '#f59e0b',
        600: '#d97706',
        700: '#b45309',
        800: '#92400e',
        900: '#78350f'
    },
    // Error state - failures and destructive actions
    error: {
        light: '#dc2626',
        dark: '#ef4444',
        50: '#fef2f2',
        100: '#fee2e2',
        200: '#fecaca',
        300: '#fca5a5',
        400: '#f87171',
        500: '#ef4444',
        600: '#dc2626',
        700: '#b91c1c',
        800: '#991b1b',
        900: '#7f1d1d'
    },
    // Info state - informational messages
    info: {
        light: '#2563eb',
        dark: '#3b82f6',
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a'
    },
    // Neutral/Gray - backgrounds, borders, text
    neutral: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827',
        950: '#030712'
    }
};
const statusColors = {
    online: semanticColors.success,
    offline: semanticColors.error,
    idle: semanticColors.warning,
    connecting: semanticColors.info,
    active: semanticColors.success,
    inactive: semanticColors.neutral,
    processing: semanticColors.info,
    completed: semanticColors.success,
    failed: semanticColors.error,
    pending: semanticColors.warning
};
function getContrastColor(bgColor, lightColor = '#ffffff', darkColor = '#000000') {
    // Simple implementation - in production, use more sophisticated contrast calculation
    // Check if background is considered "light" or "dark"
    const isLight = bgColor.includes('light') || bgColor.includes('50') || bgColor.includes('100');
    return isLight ? darkColor : lightColor;
}
function getSemanticColor(colorType, mode = 'light') {
    const color = semanticColors[colorType];
    const modeKey = mode;
    const colorValue = color[modeKey];
    return colorValue || color['500'] || '#000000';
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/theme/chartConfig.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Recharts Configuration & Theme System
 * Provides consistent chart styling across the application
 * with dark mode and light mode support
 */ __turbopack_context__.s([
    "chartAnimations",
    ()=>chartAnimations,
    "chartColorPalette",
    ()=>chartColorPalette,
    "chartColorPaletteDark",
    ()=>chartColorPaletteDark,
    "chartColors",
    ()=>chartColors,
    "chartResponsiveConfig",
    ()=>chartResponsiveConfig,
    "defaultChartOptions",
    ()=>defaultChartOptions,
    "getChartTheme",
    ()=>getChartTheme
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/theme/colors.ts [app-client] (ecmascript)");
;
const chartColors = {
    light: {
        primary: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].primary[600],
        secondary: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].info[600],
        success: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].success[600],
        warning: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].warning[600],
        error: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].error[600],
        neutral: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].neutral[400],
        background: '#ffffff',
        text: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].neutral[900],
        gridStroke: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].neutral[200],
        tooltipBg: '#ffffff',
        tooltipBorder: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].neutral[200]
    },
    dark: {
        primary: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].primary[400],
        secondary: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].info[400],
        success: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].success[500],
        warning: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].warning[400],
        error: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].error[500],
        neutral: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].neutral[500],
        background: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].neutral[900],
        text: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].neutral[50],
        gridStroke: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].neutral[700],
        tooltipBg: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].neutral[800],
        tooltipBorder: __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].neutral[700]
    }
};
const chartColorPalette = [
    __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].primary[600],
    __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].success[600],
    __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].warning[500],
    __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].error[600],
    __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].info[600],
    __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].primary[400],
    __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].success[400],
    __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].warning[400]
];
const chartColorPaletteDark = [
    __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].primary[400],
    __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].success[500],
    __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].warning[400],
    __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].error[500],
    __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].info[400],
    __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].primary[300],
    __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].success[300],
    __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["semanticColors"].warning[300]
];
function getChartTheme(mode = 'light') {
    const colors = mode === 'dark' ? chartColors.dark : chartColors.light;
    const palette = mode === 'dark' ? chartColorPaletteDark : chartColorPalette;
    return {
        colors,
        palette,
        responsive: {
            containerClassName: 'w-full h-full',
            width: '100%',
            height: 300
        },
        cartesianGrid: {
            strokeDasharray: '3 3',
            stroke: colors.gridStroke,
            vertical: false
        },
        tooltip: {
            contentStyle: {
                backgroundColor: colors.tooltipBg,
                border: `1px solid ${colors.tooltipBorder}`,
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                color: colors.text
            },
            cursor: {
                fill: 'rgba(0, 0, 0, 0.05)'
            }
        },
        legend: {
            wrapperStyle: {
                color: colors.text
            },
            iconType: 'line'
        },
        xAxis: {
            stroke: colors.gridStroke,
            style: {
                fontSize: '12px',
                fill: colors.text
            }
        },
        yAxis: {
            stroke: colors.gridStroke,
            style: {
                fontSize: '12px',
                fill: colors.text
            }
        }
    };
}
const chartAnimations = {
    enabled: true,
    duration: 800,
    easing: 'ease-in-out'
};
const chartResponsiveConfig = {
    small: {
        width: '100%',
        height: 250
    },
    medium: {
        width: '100%',
        height: 300
    },
    large: {
        width: '100%',
        height: 400
    },
    fullscreen: {
        width: '100%',
        height: 500
    }
};
const defaultChartOptions = {
    margin: {
        top: 5,
        right: 30,
        left: 0,
        bottom: 5
    },
    cartesianGrid: true,
    tooltip: true,
    legend: true,
    responsive: true
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/components/charts/LineChart.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LineChart",
    ()=>LineChart
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$LineChart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/chart/LineChart.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$Line$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/Line.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$XAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/XAxis.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$YAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/YAxis.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$CartesianGrid$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/CartesianGrid.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Tooltip$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/component/Tooltip.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Legend$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/component/Legend.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/component/ResponsiveContainer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useTheme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useTheme.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$providers$2f$ThemeProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/providers/ThemeProvider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/theme/chartConfig.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
const CustomTooltip = ({ active, payload, label })=>{
    if (active && payload && payload.length) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-800",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-sm font-semibold text-neutral-900 dark:text-neutral-50",
                    children: label
                }, void 0, false, {
                    fileName: "[project]/web/src/components/charts/LineChart.tsx",
                    lineNumber: 49,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                payload.map((entry, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm",
                        style: {
                            color: entry.color
                        },
                        children: [
                            entry.name,
                            ": ",
                            entry.value
                        ]
                    }, `item-${index}`, true, {
                        fileName: "[project]/web/src/components/charts/LineChart.tsx",
                        lineNumber: 53,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)))
            ]
        }, void 0, true, {
            fileName: "[project]/web/src/components/charts/LineChart.tsx",
            lineNumber: 48,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    }
    return null;
};
_c = CustomTooltip;
const LineChart = ({ data, dataKeys, xAxisKey, yAxisLabel, xAxisLabel, height = 300, showGrid = true, showLegend = true, showTooltip = true, smooth = true, className })=>{
    _s();
    const { isDark } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$providers$2f$ThemeProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"])();
    const theme = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getChartTheme"])(isDark ? 'dark' : 'light');
    const palette = isDark ? __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["chartColorPaletteDark"] : __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["chartColorPalette"];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `w-full ${className || ''}`,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ResponsiveContainer"], {
            width: "100%",
            height: height,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$LineChart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LineChart"], {
                data: data,
                margin: theme.colors,
                children: [
                    showGrid && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$CartesianGrid$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CartesianGrid"], {
                        ...theme.cartesianGrid
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/LineChart.tsx",
                        lineNumber: 88,
                        columnNumber: 24
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$XAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["XAxis"], {
                        dataKey: xAxisKey,
                        stroke: theme.colors.gridStroke,
                        style: {
                            fontSize: '12px',
                            fill: theme.colors.text
                        },
                        label: xAxisLabel ? {
                            value: xAxisLabel,
                            position: 'insideBottomRight',
                            offset: -5
                        } : undefined
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/LineChart.tsx",
                        lineNumber: 89,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$YAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["YAxis"], {
                        stroke: theme.colors.gridStroke,
                        style: {
                            fontSize: '12px',
                            fill: theme.colors.text
                        },
                        label: yAxisLabel ? {
                            value: yAxisLabel,
                            angle: -90,
                            position: 'insideLeft'
                        } : undefined
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/LineChart.tsx",
                        lineNumber: 103,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    showTooltip && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Tooltip$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
                        content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CustomTooltip, {}, void 0, false, {
                            fileName: "[project]/web/src/components/charts/LineChart.tsx",
                            lineNumber: 112,
                            columnNumber: 45
                        }, void 0)
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/LineChart.tsx",
                        lineNumber: 112,
                        columnNumber: 27
                    }, ("TURBOPACK compile-time value", void 0)),
                    showLegend && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Legend$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Legend"], {}, void 0, false, {
                        fileName: "[project]/web/src/components/charts/LineChart.tsx",
                        lineNumber: 113,
                        columnNumber: 26
                    }, ("TURBOPACK compile-time value", void 0)),
                    dataKeys.map((item, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$Line$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Line"], {
                            type: smooth ? 'monotone' : 'linear',
                            dataKey: item.key,
                            name: item.name,
                            stroke: item.color || palette[index % palette.length],
                            strokeWidth: item.strokeWidth || 2,
                            dot: {
                                r: 4
                            },
                            activeDot: {
                                r: 6
                            },
                            isAnimationActive: true
                        }, item.key, false, {
                            fileName: "[project]/web/src/components/charts/LineChart.tsx",
                            lineNumber: 115,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)))
                ]
            }, void 0, true, {
                fileName: "[project]/web/src/components/charts/LineChart.tsx",
                lineNumber: 87,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/web/src/components/charts/LineChart.tsx",
            lineNumber: 86,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/web/src/components/charts/LineChart.tsx",
        lineNumber: 85,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(LineChart, "p8LwrWNaEMX2B6gWWkmgIiuCFNw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$providers$2f$ThemeProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"]
    ];
});
_c1 = LineChart;
var _c, _c1;
__turbopack_context__.k.register(_c, "CustomTooltip");
__turbopack_context__.k.register(_c1, "LineChart");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/components/charts/BarChart.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BarChart",
    ()=>BarChart
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$BarChart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/chart/BarChart.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$Bar$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/Bar.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$XAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/XAxis.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$YAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/YAxis.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$CartesianGrid$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/CartesianGrid.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Tooltip$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/component/Tooltip.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Legend$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/component/Legend.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/component/ResponsiveContainer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useTheme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useTheme.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$providers$2f$ThemeProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/providers/ThemeProvider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/theme/chartConfig.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
const CustomTooltip = ({ active, payload, label })=>{
    if (active && payload && payload.length) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-800",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-sm font-semibold text-neutral-900 dark:text-neutral-50",
                    children: label
                }, void 0, false, {
                    fileName: "[project]/web/src/components/charts/BarChart.tsx",
                    lineNumber: 49,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                payload.map((entry, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm",
                        style: {
                            color: entry.color
                        },
                        children: [
                            entry.name,
                            ": ",
                            entry.value
                        ]
                    }, `item-${index}`, true, {
                        fileName: "[project]/web/src/components/charts/BarChart.tsx",
                        lineNumber: 53,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)))
            ]
        }, void 0, true, {
            fileName: "[project]/web/src/components/charts/BarChart.tsx",
            lineNumber: 48,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    }
    return null;
};
_c = CustomTooltip;
const BarChart = ({ data, dataKeys, xAxisKey, yAxisLabel, xAxisLabel, height = 300, layout = 'horizontal', showGrid = true, showLegend = true, showTooltip = true, className })=>{
    _s();
    const { isDark } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$providers$2f$ThemeProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"])();
    const theme = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getChartTheme"])(isDark ? 'dark' : 'light');
    const palette = isDark ? __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["chartColorPaletteDark"] : __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["chartColorPalette"];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `w-full ${className || ''}`,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ResponsiveContainer"], {
            width: "100%",
            height: height,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$BarChart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BarChart"], {
                data: data,
                layout: layout,
                margin: theme.colors,
                children: [
                    showGrid && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$CartesianGrid$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CartesianGrid"], {
                        ...theme.cartesianGrid
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/BarChart.tsx",
                        lineNumber: 92,
                        columnNumber: 24
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$XAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["XAxis"], {
                        type: layout === 'vertical' ? 'number' : 'category',
                        dataKey: layout === 'vertical' ? undefined : xAxisKey,
                        stroke: theme.colors.gridStroke,
                        style: {
                            fontSize: '12px',
                            fill: theme.colors.text
                        },
                        label: xAxisLabel ? {
                            value: xAxisLabel,
                            position: 'insideBottomRight',
                            offset: -5
                        } : undefined
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/BarChart.tsx",
                        lineNumber: 93,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$YAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["YAxis"], {
                        type: layout === 'vertical' ? 'category' : 'number',
                        dataKey: layout === 'vertical' ? xAxisKey : undefined,
                        stroke: theme.colors.gridStroke,
                        style: {
                            fontSize: '12px',
                            fill: theme.colors.text
                        },
                        label: yAxisLabel ? {
                            value: yAxisLabel,
                            angle: -90,
                            position: 'insideLeft'
                        } : undefined
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/BarChart.tsx",
                        lineNumber: 108,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    showTooltip && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Tooltip$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
                        content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CustomTooltip, {}, void 0, false, {
                            fileName: "[project]/web/src/components/charts/BarChart.tsx",
                            lineNumber: 119,
                            columnNumber: 45
                        }, void 0)
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/BarChart.tsx",
                        lineNumber: 119,
                        columnNumber: 27
                    }, ("TURBOPACK compile-time value", void 0)),
                    showLegend && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Legend$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Legend"], {}, void 0, false, {
                        fileName: "[project]/web/src/components/charts/BarChart.tsx",
                        lineNumber: 120,
                        columnNumber: 26
                    }, ("TURBOPACK compile-time value", void 0)),
                    dataKeys.map((item, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$Bar$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Bar"], {
                            dataKey: item.key,
                            name: item.name,
                            fill: item.color || palette[index % palette.length],
                            stackId: item.stackId,
                            radius: [
                                8,
                                8,
                                0,
                                0
                            ]
                        }, item.key, false, {
                            fileName: "[project]/web/src/components/charts/BarChart.tsx",
                            lineNumber: 122,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)))
                ]
            }, void 0, true, {
                fileName: "[project]/web/src/components/charts/BarChart.tsx",
                lineNumber: 87,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/web/src/components/charts/BarChart.tsx",
            lineNumber: 86,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/web/src/components/charts/BarChart.tsx",
        lineNumber: 85,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(BarChart, "p8LwrWNaEMX2B6gWWkmgIiuCFNw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$providers$2f$ThemeProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"]
    ];
});
_c1 = BarChart;
var _c, _c1;
__turbopack_context__.k.register(_c, "CustomTooltip");
__turbopack_context__.k.register(_c1, "BarChart");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/components/charts/PieChart.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PieChart",
    ()=>PieChart
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$PieChart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/chart/PieChart.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$polar$2f$Pie$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/polar/Pie.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Cell$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/component/Cell.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Legend$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/component/Legend.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Tooltip$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/component/Tooltip.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/component/ResponsiveContainer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useTheme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useTheme.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$providers$2f$ThemeProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/providers/ThemeProvider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/theme/chartConfig.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
const CustomTooltip = ({ active, payload })=>{
    if (active && payload && payload.length) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-800",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-sm font-semibold text-neutral-900 dark:text-neutral-50",
                    children: payload[0].name
                }, void 0, false, {
                    fileName: "[project]/web/src/components/charts/PieChart.tsx",
                    lineNumber: 40,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-sm",
                    style: {
                        color: payload[0].fill
                    },
                    children: [
                        "Value: ",
                        payload[0].value
                    ]
                }, void 0, true, {
                    fileName: "[project]/web/src/components/charts/PieChart.tsx",
                    lineNumber: 43,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-xs text-neutral-500 dark:text-neutral-400",
                    children: [
                        (payload[0].value / 100).toFixed(1),
                        "%"
                    ]
                }, void 0, true, {
                    fileName: "[project]/web/src/components/charts/PieChart.tsx",
                    lineNumber: 46,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            ]
        }, void 0, true, {
            fileName: "[project]/web/src/components/charts/PieChart.tsx",
            lineNumber: 39,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    }
    return null;
};
_c = CustomTooltip;
const PieChart = ({ data, dataKey = 'value', nameKey = 'name', height = 300, showLegend = true, showTooltip = true, showLabel = true, className })=>{
    _s();
    const { isDark } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$providers$2f$ThemeProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"])();
    const palette = isDark ? __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["chartColorPaletteDark"] : __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["chartColorPalette"];
    const colors = data.map((item, index)=>item.color || palette[index % palette.length]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `flex justify-center w-full ${className || ''}`,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ResponsiveContainer"], {
            width: "100%",
            height: height,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$PieChart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PieChart"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$polar$2f$Pie$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Pie"], {
                        data: data,
                        dataKey: dataKey,
                        nameKey: nameKey,
                        cx: "50%",
                        cy: "50%",
                        outerRadius: 100,
                        label: showLabel ? {
                            position: 'outside',
                            formatter: (value)=>`${value}%`
                        } : false,
                        isAnimationActive: true,
                        children: colors.map((color, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Cell$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Cell"], {
                                fill: color
                            }, `cell-${index}`, false, {
                                fileName: "[project]/web/src/components/charts/PieChart.tsx",
                                lineNumber: 92,
                                columnNumber: 15
                            }, ("TURBOPACK compile-time value", void 0)))
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/PieChart.tsx",
                        lineNumber: 74,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    showTooltip && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Tooltip$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
                        content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CustomTooltip, {}, void 0, false, {
                            fileName: "[project]/web/src/components/charts/PieChart.tsx",
                            lineNumber: 95,
                            columnNumber: 45
                        }, void 0)
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/PieChart.tsx",
                        lineNumber: 95,
                        columnNumber: 27
                    }, ("TURBOPACK compile-time value", void 0)),
                    showLegend && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Legend$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Legend"], {}, void 0, false, {
                        fileName: "[project]/web/src/components/charts/PieChart.tsx",
                        lineNumber: 96,
                        columnNumber: 26
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/web/src/components/charts/PieChart.tsx",
                lineNumber: 73,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/web/src/components/charts/PieChart.tsx",
            lineNumber: 72,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/web/src/components/charts/PieChart.tsx",
        lineNumber: 71,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(PieChart, "p8LwrWNaEMX2B6gWWkmgIiuCFNw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$providers$2f$ThemeProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"]
    ];
});
_c1 = PieChart;
var _c, _c1;
__turbopack_context__.k.register(_c, "CustomTooltip");
__turbopack_context__.k.register(_c1, "PieChart");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/components/charts/AreaChart.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AreaChart",
    ()=>AreaChart
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$AreaChart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/chart/AreaChart.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$Area$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/Area.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$XAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/XAxis.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$YAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/YAxis.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$CartesianGrid$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/CartesianGrid.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Tooltip$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/component/Tooltip.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Legend$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/component/Legend.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/component/ResponsiveContainer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useTheme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useTheme.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$providers$2f$ThemeProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/providers/ThemeProvider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/theme/chartConfig.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
const CustomTooltip = ({ active, payload, label })=>{
    if (active && payload && payload.length) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-800",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-sm font-semibold text-neutral-900 dark:text-neutral-50",
                    children: label
                }, void 0, false, {
                    fileName: "[project]/web/src/components/charts/AreaChart.tsx",
                    lineNumber: 49,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                payload.map((entry, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm",
                        style: {
                            color: entry.color
                        },
                        children: [
                            entry.name,
                            ": ",
                            entry.value
                        ]
                    }, `item-${index}`, true, {
                        fileName: "[project]/web/src/components/charts/AreaChart.tsx",
                        lineNumber: 53,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)))
            ]
        }, void 0, true, {
            fileName: "[project]/web/src/components/charts/AreaChart.tsx",
            lineNumber: 48,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    }
    return null;
};
_c = CustomTooltip;
const AreaChart = ({ data, dataKeys, xAxisKey, yAxisLabel, xAxisLabel, height = 300, showGrid = true, showLegend = true, showTooltip = true, stacked = false, className })=>{
    _s();
    const { isDark } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$providers$2f$ThemeProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"])();
    const theme = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getChartTheme"])(isDark ? 'dark' : 'light');
    const palette = isDark ? __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["chartColorPaletteDark"] : __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["chartColorPalette"];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `w-full ${className || ''}`,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ResponsiveContainer"], {
            width: "100%",
            height: height,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$AreaChart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AreaChart"], {
                data: data,
                margin: theme.colors,
                children: [
                    showGrid && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$CartesianGrid$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CartesianGrid"], {
                        ...theme.cartesianGrid
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/AreaChart.tsx",
                        lineNumber: 88,
                        columnNumber: 24
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$XAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["XAxis"], {
                        dataKey: xAxisKey,
                        stroke: theme.colors.gridStroke,
                        style: {
                            fontSize: '12px',
                            fill: theme.colors.text
                        },
                        label: xAxisLabel ? {
                            value: xAxisLabel,
                            position: 'insideBottomRight',
                            offset: -5
                        } : undefined
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/AreaChart.tsx",
                        lineNumber: 89,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$YAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["YAxis"], {
                        stroke: theme.colors.gridStroke,
                        style: {
                            fontSize: '12px',
                            fill: theme.colors.text
                        },
                        label: yAxisLabel ? {
                            value: yAxisLabel,
                            angle: -90,
                            position: 'insideLeft'
                        } : undefined
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/AreaChart.tsx",
                        lineNumber: 103,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    showTooltip && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Tooltip$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
                        content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CustomTooltip, {}, void 0, false, {
                            fileName: "[project]/web/src/components/charts/AreaChart.tsx",
                            lineNumber: 112,
                            columnNumber: 45
                        }, void 0)
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/AreaChart.tsx",
                        lineNumber: 112,
                        columnNumber: 27
                    }, ("TURBOPACK compile-time value", void 0)),
                    showLegend && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Legend$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Legend"], {}, void 0, false, {
                        fileName: "[project]/web/src/components/charts/AreaChart.tsx",
                        lineNumber: 113,
                        columnNumber: 26
                    }, ("TURBOPACK compile-time value", void 0)),
                    dataKeys.map((item, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$Area$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Area"], {
                            type: "monotone",
                            dataKey: item.key,
                            name: item.name,
                            stroke: item.color || palette[index % palette.length],
                            fill: item.color || palette[index % palette.length],
                            fillOpacity: 0.6,
                            stackId: stacked ? 'area' : undefined,
                            strokeWidth: item.strokeWidth || 2,
                            isAnimationActive: true
                        }, item.key, false, {
                            fileName: "[project]/web/src/components/charts/AreaChart.tsx",
                            lineNumber: 115,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0)))
                ]
            }, void 0, true, {
                fileName: "[project]/web/src/components/charts/AreaChart.tsx",
                lineNumber: 87,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/web/src/components/charts/AreaChart.tsx",
            lineNumber: 86,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/web/src/components/charts/AreaChart.tsx",
        lineNumber: 85,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(AreaChart, "p8LwrWNaEMX2B6gWWkmgIiuCFNw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$providers$2f$ThemeProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"]
    ];
});
_c1 = AreaChart;
var _c, _c1;
__turbopack_context__.k.register(_c, "CustomTooltip");
__turbopack_context__.k.register(_c1, "AreaChart");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/components/charts/ComposedChart.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ComposedChart",
    ()=>ComposedChart
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$ComposedChart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/chart/ComposedChart.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$Bar$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/Bar.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$Line$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/Line.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$XAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/XAxis.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$YAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/YAxis.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$CartesianGrid$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/cartesian/CartesianGrid.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Tooltip$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/component/Tooltip.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Legend$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/component/Legend.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/recharts@2.15.4_react-dom@19.2.4_react@19.2.4__react@19.2.4/node_modules/recharts/es6/component/ResponsiveContainer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useTheme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useTheme.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$providers$2f$ThemeProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/providers/ThemeProvider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/theme/chartConfig.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
const CustomTooltip = ({ active, payload, label })=>{
    if (active && payload && payload.length) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-800",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-sm font-semibold text-neutral-900 dark:text-neutral-50",
                    children: label
                }, void 0, false, {
                    fileName: "[project]/web/src/components/charts/ComposedChart.tsx",
                    lineNumber: 54,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0)),
                payload.map((entry, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm",
                        style: {
                            color: entry.color
                        },
                        children: [
                            entry.name,
                            ": ",
                            entry.value
                        ]
                    }, `item-${index}`, true, {
                        fileName: "[project]/web/src/components/charts/ComposedChart.tsx",
                        lineNumber: 58,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)))
            ]
        }, void 0, true, {
            fileName: "[project]/web/src/components/charts/ComposedChart.tsx",
            lineNumber: 53,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0));
    }
    return null;
};
_c = CustomTooltip;
const ComposedChart = ({ data, series, xAxisKey, yAxisLabel, xAxisLabel, height = 300, showGrid = true, showLegend = true, showTooltip = true, dualAxis = false, className })=>{
    _s();
    const { isDark } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$providers$2f$ThemeProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"])();
    const theme = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getChartTheme"])(isDark ? 'dark' : 'light');
    const palette = isDark ? __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["chartColorPaletteDark"] : __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$chartConfig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["chartColorPalette"];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `w-full ${className || ''}`,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$ResponsiveContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ResponsiveContainer"], {
            width: "100%",
            height: height,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$chart$2f$ComposedChart$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ComposedChart"], {
                data: data,
                margin: theme.colors,
                children: [
                    showGrid && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$CartesianGrid$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CartesianGrid"], {
                        ...theme.cartesianGrid
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/ComposedChart.tsx",
                        lineNumber: 93,
                        columnNumber: 24
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$XAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["XAxis"], {
                        dataKey: xAxisKey,
                        stroke: theme.colors.gridStroke,
                        style: {
                            fontSize: '12px',
                            fill: theme.colors.text
                        },
                        label: xAxisLabel ? {
                            value: xAxisLabel,
                            position: 'insideBottomRight',
                            offset: -5
                        } : undefined
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/ComposedChart.tsx",
                        lineNumber: 94,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$YAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["YAxis"], {
                        yAxisId: "left",
                        stroke: theme.colors.gridStroke,
                        style: {
                            fontSize: '12px',
                            fill: theme.colors.text
                        },
                        label: yAxisLabel ? {
                            value: yAxisLabel,
                            angle: -90,
                            position: 'insideLeft'
                        } : undefined
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/ComposedChart.tsx",
                        lineNumber: 108,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    dualAxis && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$YAxis$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["YAxis"], {
                        yAxisId: "right",
                        orientation: "right",
                        stroke: theme.colors.gridStroke,
                        style: {
                            fontSize: '12px',
                            fill: theme.colors.text
                        }
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/ComposedChart.tsx",
                        lineNumber: 119,
                        columnNumber: 13
                    }, ("TURBOPACK compile-time value", void 0)),
                    showTooltip && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Tooltip$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tooltip"], {
                        content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CustomTooltip, {}, void 0, false, {
                            fileName: "[project]/web/src/components/charts/ComposedChart.tsx",
                            lineNumber: 126,
                            columnNumber: 45
                        }, void 0)
                    }, void 0, false, {
                        fileName: "[project]/web/src/components/charts/ComposedChart.tsx",
                        lineNumber: 126,
                        columnNumber: 27
                    }, ("TURBOPACK compile-time value", void 0)),
                    showLegend && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$component$2f$Legend$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Legend"], {}, void 0, false, {
                        fileName: "[project]/web/src/components/charts/ComposedChart.tsx",
                        lineNumber: 127,
                        columnNumber: 26
                    }, ("TURBOPACK compile-time value", void 0)),
                    series.map((item, index)=>{
                        const baseProps = {
                            key: item.key,
                            dataKey: item.key,
                            name: item.name,
                            yAxisId: item.yAxisId || 'left',
                            fill: item.color || palette[index % palette.length],
                            stroke: item.color || palette[index % palette.length]
                        };
                        if (item.type === 'bar') {
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$Bar$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Bar"], {
                                ...baseProps,
                                stackId: item.stackId,
                                radius: [
                                    8,
                                    8,
                                    0,
                                    0
                                ]
                            }, void 0, false, {
                                fileName: "[project]/web/src/components/charts/ComposedChart.tsx",
                                lineNumber: 140,
                                columnNumber: 17
                            }, ("TURBOPACK compile-time value", void 0));
                        }
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$recharts$40$2$2e$15$2e$4_react$2d$dom$40$19$2e$2$2e$4_react$40$19$2e$2$2e$4_$5f$react$40$19$2e$2$2e$4$2f$node_modules$2f$recharts$2f$es6$2f$cartesian$2f$Line$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Line"], {
                            ...baseProps,
                            type: "monotone",
                            strokeWidth: 2,
                            dot: {
                                r: 4
                            }
                        }, void 0, false, {
                            fileName: "[project]/web/src/components/charts/ComposedChart.tsx",
                            lineNumber: 149,
                            columnNumber: 15
                        }, ("TURBOPACK compile-time value", void 0));
                    })
                ]
            }, void 0, true, {
                fileName: "[project]/web/src/components/charts/ComposedChart.tsx",
                lineNumber: 92,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/web/src/components/charts/ComposedChart.tsx",
            lineNumber: 91,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/web/src/components/charts/ComposedChart.tsx",
        lineNumber: 90,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(ComposedChart, "p8LwrWNaEMX2B6gWWkmgIiuCFNw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$providers$2f$ThemeProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"]
    ];
});
_c1 = ComposedChart;
var _c, _c1;
__turbopack_context__.k.register(_c, "CustomTooltip");
__turbopack_context__.k.register(_c1, "ComposedChart");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/components/charts/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$LineChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/charts/LineChart.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$BarChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/charts/BarChart.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$PieChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/charts/PieChart.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$AreaChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/charts/AreaChart.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$ComposedChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/charts/ComposedChart.tsx [app-client] (ecmascript)");
;
;
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/components/ui/Card.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Card",
    ()=>Card
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
'use client';
;
const CardRoot = ({ children, className })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm hover:shadow-md transition-shadow ${className || ''}`,
        children: children
    }, void 0, false, {
        fileName: "[project]/web/src/components/ui/Card.tsx",
        lineNumber: 26,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
_c = CardRoot;
const CardHeader = ({ children, className })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 ${className || ''}`,
        children: children
    }, void 0, false, {
        fileName: "[project]/web/src/components/ui/Card.tsx",
        lineNumber: 36,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
_c1 = CardHeader;
const CardBody = ({ children, className })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `px-6 py-4 ${className || ''}`,
        children: children
    }, void 0, false, {
        fileName: "[project]/web/src/components/ui/Card.tsx",
        lineNumber: 46,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
_c2 = CardBody;
const CardFooter = ({ children, className })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `px-6 py-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 rounded-b-lg ${className || ''}`,
        children: children
    }, void 0, false, {
        fileName: "[project]/web/src/components/ui/Card.tsx",
        lineNumber: 50,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
_c3 = CardFooter;
const Card = Object.assign(CardRoot, {
    Header: CardHeader,
    Body: CardBody,
    Footer: CardFooter
});
_c4 = Card;
var _c, _c1, _c2, _c3, _c4;
__turbopack_context__.k.register(_c, "CardRoot");
__turbopack_context__.k.register(_c1, "CardHeader");
__turbopack_context__.k.register(_c2, "CardBody");
__turbopack_context__.k.register(_c3, "CardFooter");
__turbopack_context__.k.register(_c4, "Card");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/web/src/components/ui/Badge.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Badge",
    ()=>Badge
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$lucide$2d$react$40$0$2e$300$2e$0_react$40$19$2e$2$2e$4$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/lucide-react@0.300.0_react@19.2.4/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
'use client';
;
;
const variantStyles = {
    primary: 'bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-100 border border-primary-300 dark:border-primary-700',
    success: 'bg-success-100 dark:bg-success-900 text-success-800 dark:text-success-100 border border-success-300 dark:border-success-700',
    warning: 'bg-warning-100 dark:bg-warning-900 text-warning-800 dark:text-warning-100 border border-warning-300 dark:border-warning-700',
    error: 'bg-error-100 dark:bg-error-900 text-error-800 dark:text-error-100 border border-error-300 dark:border-error-700',
    info: 'bg-info-100 dark:bg-info-900 text-info-800 dark:text-info-100 border border-info-300 dark:border-info-700',
    neutral: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-600'
};
const sizeStyles = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
};
const Badge = ({ children, variant = 'primary', size = 'md', dismissible = false, onDismiss, className })=>{
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `inline-flex items-center gap-2 rounded-full font-medium transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className || ''}`,
        children: [
            children,
            dismissible && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                onClick: onDismiss,
                className: "ml-1 inline-flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors",
                "aria-label": "Dismiss badge",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$lucide$2d$react$40$0$2e$300$2e$0_react$40$19$2e$2$2e$4$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                    className: "w-3 h-3"
                }, void 0, false, {
                    fileName: "[project]/web/src/components/ui/Badge.tsx",
                    lineNumber: 52,
                    columnNumber: 11
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/web/src/components/ui/Badge.tsx",
                lineNumber: 47,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/web/src/components/ui/Badge.tsx",
        lineNumber: 42,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = Badge;
var _c;
__turbopack_context__.k.register(_c, "Badge");
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
"[project]/web/src/app/dashboard/analytics/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AnalyticsPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.11_@babel+core@7._2c2d61b4ce987e30ba34ffda50ec852c/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/web/src/components/charts/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$LineChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/charts/LineChart.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$BarChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/charts/BarChart.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$PieChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/charts/PieChart.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$AreaChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/charts/AreaChart.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$ComposedChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/charts/ComposedChart.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/ui/Card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/components/ui/Badge.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/theme/icons.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useRealtimeEvents$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useRealtimeEvents.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useToast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useToast.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useAnalyticsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/web/src/lib/hooks/useAnalyticsData.ts [app-client] (ecmascript)");
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
const KPICard = ({ label, value, change, changeType = 'neutral', icon })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
        className: "hover:shadow-lg transition-shadow",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"].Body, {
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-start justify-between",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-sm font-medium text-neutral-600 dark:text-neutral-400",
                                children: label
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 38,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-3xl font-bold text-neutral-900 dark:text-neutral-50 mt-2",
                                children: value
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 41,
                                columnNumber: 11
                            }, ("TURBOPACK compile-time value", void 0)),
                            change && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: `text-sm mt-2 ${changeType === 'positive' ? 'text-success-600 dark:text-success-400' : changeType === 'negative' ? 'text-error-600 dark:text-error-400' : 'text-neutral-600 dark:text-neutral-400'}`,
                                children: [
                                    changeType === 'positive' && '↑ ',
                                    changeType === 'negative' && '↓ ',
                                    change
                                ]
                            }, void 0, true, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 45,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                        lineNumber: 37,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    icon && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$theme$2f$icons$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"], {
                        name: icon,
                        size: "lg",
                        className: "text-neutral-400 dark:text-neutral-600"
                    }, void 0, false, {
                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                        lineNumber: 61,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                lineNumber: 36,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
            lineNumber: 35,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
        lineNumber: 34,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
_c = KPICard;
function AnalyticsPage() {
    _s();
    const toast = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useToast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useToast"])();
    const [dateRange, setDateRange] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('month');
    const [realtimeStatus, setRealtimeStatus] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('offline');
    const [lastUpdate, setLastUpdate] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const deviceMetrics = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useAnalyticsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDeviceMetrics"])(dateRange);
    const contentPerformance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useAnalyticsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContentPerformance"])(dateRange);
    const usageTrends = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useAnalyticsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUsageTrends"])(dateRange);
    const deviceDistribution = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useAnalyticsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDeviceDistribution"])();
    const bandwidthUsage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useAnalyticsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBandwidthUsage"])(dateRange);
    const playlistPerformance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useAnalyticsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePlaylistPerformance"])(dateRange);
    // Real-time analytics updates
    const { isConnected } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useRealtimeEvents$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRealtimeEvents"])({
        enabled: true,
        onDeviceStatusChange: {
            "AnalyticsPage.useRealtimeEvents": ()=>{
                // Device status changes may affect uptime metrics
                setLastUpdate(new Date());
            }
        }["AnalyticsPage.useRealtimeEvents"],
        onConnectionChange: {
            "AnalyticsPage.useRealtimeEvents": (connected)=>{
                setRealtimeStatus(connected ? 'connected' : 'offline');
                if (connected) {
                    toast.info('Real-time analytics enabled');
                }
            }
        }["AnalyticsPage.useRealtimeEvents"]
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "text-3xl font-bold text-neutral-900 dark:text-neutral-50",
                                children: "Analytics"
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 105,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-2 text-neutral-600 dark:text-neutral-400",
                                children: [
                                    "Real-time performance metrics and insights",
                                    realtimeStatus === 'connected' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "ml-2 inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse"
                                            }, void 0, false, {
                                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                                lineNumber: 112,
                                                columnNumber: 17
                                            }, this),
                                            "Real-time active"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                        lineNumber: 111,
                                        columnNumber: 15
                                    }, this),
                                    lastUpdate && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "ml-2 text-xs text-gray-500",
                                        children: [
                                            "Updated ",
                                            Math.round((Date.now() - lastUpdate.getTime()) / 1000),
                                            "s ago"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                        lineNumber: 117,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 108,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                        lineNumber: 104,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-2",
                        children: [
                            'week',
                            'month',
                            'year'
                        ].map((range)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>setDateRange(range),
                                className: `px-4 py-2 rounded-lg font-medium transition-colors capitalize ${dateRange === range ? 'bg-primary-600 dark:bg-primary-400 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-50 hover:bg-neutral-300 dark:hover:bg-neutral-600'}`,
                                children: range
                            }, range, false, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 125,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                        lineNumber: 123,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                lineNumber: 103,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(KPICard, {
                        label: "Total Devices",
                        value: "366",
                        change: "12% from last month",
                        changeType: "positive",
                        icon: "devices"
                    }, void 0, false, {
                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                        lineNumber: 142,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(KPICard, {
                        label: "Content Served",
                        value: "12.5K",
                        change: "23% from last month",
                        changeType: "positive",
                        icon: "content"
                    }, void 0, false, {
                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                        lineNumber: 149,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(KPICard, {
                        label: "Avg. Bandwidth",
                        value: "2.4 GB/h",
                        change: "5% from last month",
                        changeType: "negative",
                        icon: "analytics"
                    }, void 0, false, {
                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                        lineNumber: 156,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(KPICard, {
                        label: "System Uptime",
                        value: "98.5%",
                        change: "Above target",
                        changeType: "positive",
                        icon: "overview"
                    }, void 0, false, {
                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                        lineNumber: 163,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                lineNumber: 141,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-1 lg:grid-cols-2 gap-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                        className: "lg:col-span-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"].Header, {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center justify-between",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                            className: "text-lg font-semibold text-neutral-900 dark:text-neutral-50",
                                            children: "Device Uptime Timeline"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                            lineNumber: 178,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                            variant: "info",
                                            size: "sm",
                                            children: "Last 30 Days"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                            lineNumber: 181,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 177,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 176,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"].Body, {
                                children: deviceMetrics.loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-80 flex items-center justify-center",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "animate-spin",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "w-8 h-8 border-4 border-neutral-200 dark:border-neutral-700 border-t-primary-600 dark:border-t-primary-400 rounded-full"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                            lineNumber: 190,
                                            columnNumber: 19
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                        lineNumber: 189,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 188,
                                    columnNumber: 15
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$LineChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LineChart"], {
                                    data: deviceMetrics.data,
                                    dataKeys: [
                                        {
                                            key: 'mobile',
                                            name: 'Mobile Displays'
                                        },
                                        {
                                            key: 'tablet',
                                            name: 'Tablets'
                                        },
                                        {
                                            key: 'desktop',
                                            name: 'Desktop Screens'
                                        }
                                    ],
                                    xAxisKey: "date",
                                    yAxisLabel: "Uptime %",
                                    height: 300
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 194,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 186,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                        lineNumber: 175,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"].Header, {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                    className: "text-lg font-semibold text-neutral-900 dark:text-neutral-50",
                                    children: "Content Performance"
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 212,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 211,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"].Body, {
                                children: contentPerformance.loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-80 flex items-center justify-center",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "animate-spin",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "w-8 h-8 border-4 border-neutral-200 dark:border-neutral-700 border-t-primary-600 dark:border-t-primary-400 rounded-full"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                            lineNumber: 220,
                                            columnNumber: 19
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                        lineNumber: 219,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 218,
                                    columnNumber: 15
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$BarChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BarChart"], {
                                    data: contentPerformance.data,
                                    dataKeys: [
                                        {
                                            key: 'views',
                                            name: 'Views'
                                        }
                                    ],
                                    xAxisKey: "title",
                                    height: 300,
                                    layout: "vertical"
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 224,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 216,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                        lineNumber: 210,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"].Header, {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                    className: "text-lg font-semibold text-neutral-900 dark:text-neutral-50",
                                    children: "Device Distribution"
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 238,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 237,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"].Body, {
                                children: deviceDistribution.loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-80 flex items-center justify-center",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "animate-spin",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "w-8 h-8 border-4 border-neutral-200 dark:border-neutral-700 border-t-primary-600 dark:border-t-primary-400 rounded-full"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                            lineNumber: 246,
                                            columnNumber: 19
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                        lineNumber: 245,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 244,
                                    columnNumber: 15
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$PieChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PieChart"], {
                                    data: deviceDistribution.data,
                                    dataKey: "value",
                                    nameKey: "name",
                                    height: 300,
                                    showLabel: true
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 250,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 242,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                        lineNumber: 236,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                        className: "lg:col-span-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"].Header, {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                    className: "text-lg font-semibold text-neutral-900 dark:text-neutral-50",
                                    children: "Usage Trends by Content Type"
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 264,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 263,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"].Body, {
                                children: usageTrends.loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-80 flex items-center justify-center",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "animate-spin",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "w-8 h-8 border-4 border-neutral-200 dark:border-neutral-700 border-t-primary-600 dark:border-t-primary-400 rounded-full"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                            lineNumber: 272,
                                            columnNumber: 19
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                        lineNumber: 271,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 270,
                                    columnNumber: 15
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$AreaChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AreaChart"], {
                                    data: usageTrends.data,
                                    dataKeys: [
                                        {
                                            key: 'video',
                                            name: 'Video'
                                        },
                                        {
                                            key: 'image',
                                            name: 'Images'
                                        },
                                        {
                                            key: 'text',
                                            name: 'Text'
                                        },
                                        {
                                            key: 'interactive',
                                            name: 'Interactive'
                                        }
                                    ],
                                    xAxisKey: "date",
                                    yAxisLabel: "Views",
                                    height: 300,
                                    stacked: true
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 276,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 268,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                        lineNumber: 262,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                        className: "lg:col-span-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"].Header, {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                    className: "text-lg font-semibold text-neutral-900 dark:text-neutral-50",
                                    children: "Bandwidth Usage (24h)"
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 296,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 295,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"].Body, {
                                children: bandwidthUsage.loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-80 flex items-center justify-center",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "animate-spin",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "w-8 h-8 border-4 border-neutral-200 dark:border-neutral-700 border-t-primary-600 dark:border-t-primary-400 rounded-full"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                            lineNumber: 304,
                                            columnNumber: 19
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                        lineNumber: 303,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 302,
                                    columnNumber: 15
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$ComposedChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ComposedChart"], {
                                    data: bandwidthUsage.data,
                                    series: [
                                        {
                                            type: 'line',
                                            key: 'current',
                                            name: 'Current Usage'
                                        },
                                        {
                                            type: 'line',
                                            key: 'average',
                                            name: 'Average'
                                        },
                                        {
                                            type: 'bar',
                                            key: 'peak',
                                            name: 'Peak'
                                        }
                                    ],
                                    xAxisKey: "time",
                                    yAxisLabel: "MB/s",
                                    height: 300
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 308,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 300,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                        lineNumber: 294,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                        className: "lg:col-span-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"].Header, {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                    className: "text-lg font-semibold text-neutral-900 dark:text-neutral-50",
                                    children: "Top Playlists by Engagement"
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 326,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 325,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"].Body, {
                                children: playlistPerformance.loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-80 flex items-center justify-center",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "animate-spin",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "w-8 h-8 border-4 border-neutral-200 dark:border-neutral-700 border-t-primary-600 dark:border-t-primary-400 rounded-full"
                                        }, void 0, false, {
                                            fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                            lineNumber: 334,
                                            columnNumber: 19
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                        lineNumber: 333,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 332,
                                    columnNumber: 15
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$11_$40$babel$2b$core$40$7$2e$_2c2d61b4ce987e30ba34ffda50ec852c$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$components$2f$charts$2f$BarChart$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BarChart"], {
                                    data: playlistPerformance.data,
                                    dataKeys: [
                                        {
                                            key: 'views',
                                            name: 'Views'
                                        },
                                        {
                                            key: 'completion',
                                            name: 'Completion %'
                                        }
                                    ],
                                    xAxisKey: "name",
                                    height: 300,
                                    layout: "vertical"
                                }, void 0, false, {
                                    fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                    lineNumber: 338,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                                lineNumber: 330,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                        lineNumber: 324,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
                lineNumber: 173,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/web/src/app/dashboard/analytics/page.tsx",
        lineNumber: 101,
        columnNumber: 5
    }, this);
}
_s(AnalyticsPage, "j2sn/Z0yY2nTLzgKcaBdAaPUBw4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useToast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useToast"],
        __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useAnalyticsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDeviceMetrics"],
        __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useAnalyticsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContentPerformance"],
        __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useAnalyticsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUsageTrends"],
        __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useAnalyticsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDeviceDistribution"],
        __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useAnalyticsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBandwidthUsage"],
        __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useAnalyticsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePlaylistPerformance"],
        __TURBOPACK__imported__module__$5b$project$5d2f$web$2f$src$2f$lib$2f$hooks$2f$useRealtimeEvents$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRealtimeEvents"]
    ];
});
_c1 = AnalyticsPage;
var _c, _c1;
__turbopack_context__.k.register(_c, "KPICard");
__turbopack_context__.k.register(_c1, "AnalyticsPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=web_src_afa85828._.js.map