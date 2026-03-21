# Component Map

## Shared UI Components (`web/src/components/ui/`)

| Component | Purpose |
|-----------|---------|
| `Card.tsx` | Container card with header/body/footer slots |
| `Badge.tsx` | Status/category badges |
| `Tabs.tsx` | Tab navigation |
| `DataTable.tsx` | Sortable, filterable data table (uses TanStack Table) |
| `Accordion.tsx` | Collapsible sections |
| `Avatar.tsx` | User/org avatar |
| `IconButton.tsx` | Icon-only button |
| `Progress.tsx` | Progress bar |
| `Stepper.tsx` | Multi-step wizard indicator |
| `index.ts` | Barrel export |

These are custom components, NOT shadcn/ui. Do not import from `@/components/ui` expecting shadcn APIs.

## Core Shared Components (`web/src/components/`)

| Component | Purpose | Reusable? |
|-----------|---------|-----------|
| `Button.tsx` | Primary button component | Yes |
| `Modal.tsx` | Generic modal dialog | Yes |
| `ConfirmDialog.tsx` | Confirmation modal with cancel/confirm | Yes |
| `LoadingSpinner.tsx` | Spinner with size variants | Yes |
| `EmptyState.tsx` | Empty list placeholder with icon + message | Yes |
| `ErrorBoundary.tsx` | React error boundary wrapper | Yes |
| `Toast.tsx` | Toast notification | Yes |
| `Tooltip.tsx` | Hover tooltip | Yes |
| `SearchFilter.tsx` | Search input + filter dropdowns | Yes |
| `ViewToggle.tsx` | Grid/list view toggle | Yes |
| `Breadcrumbs.tsx` | Navigation breadcrumbs | Yes |
| `FieldError.tsx` | Form field error message | Yes |
| `DaySelector.tsx` | Day-of-week selector | Yes |
| `TimePicker.tsx` | Time picker input | Yes |
| `CommandPalette.tsx` | Keyboard command palette (Cmd+K) | Yes |
| `CommandPaletteWrapper.tsx` | Context wrapper for command palette | Yes |
| `ThemeToggle.tsx` | Dark/light mode toggle | Yes |
| `TrialBanner.tsx` | Trial expiration warning banner | Page-specific |
| `UpgradeBanner.tsx` | Plan upgrade CTA banner | Page-specific |
| `NotificationBell.tsx` | Header notification bell | Page-specific |
| `NotificationDropdown.tsx` | Notification list dropdown | Page-specific |

## Domain-Specific Components

### Content (`web/src/components/content/`)
- Content upload, preview, folder management components

### Playlist (`web/src/components/playlist/`)
- Playlist builder, item list, duration controls

### Templates (`web/src/components/templates/`)
| Component | Purpose |
|-----------|---------|
| `TemplateCard.tsx` | Template preview card in library grid |
| `TemplateCardSkeleton.tsx` | Loading skeleton for template cards |
| `TemplateDetailModal.tsx` | Full template preview with metadata |
| `TemplateHeroSearch.tsx` | Hero-styled search bar on template page |
| `TemplateSidebar.tsx` | Category/orientation/difficulty filters |
| `AIDesignerModal.tsx` | AI template generation (placeholder) |

### Template Editor (`web/src/components/template-editor/`)
| Component | Purpose |
|-----------|---------|
| `TemplateEditorCanvas.tsx` | iframe container + postMessage bridge |
| `editor-runtime.js` | IIFE injected into iframe for element interaction |
| `FloatingToolbar.tsx` | Text formatting toolbar (follows selection) |
| `PropertyPanel.tsx` | Right sidebar for element properties |
| `TextProperties.tsx` | Text element property controls |
| `ImageProperties.tsx` | Image element property controls |
| `ContainerProperties.tsx` | Container/div property controls |
| `DisplayPickerModal.tsx` | Modal to push template to display device |
| `useCanvasZoom.ts` | Zoom level hook with presets |
| `useEditorHistory.ts` | Undo/redo history hook |

### Code Editor (`web/src/components/TemplateEditor.tsx`)
- CodeMirror 6 based HTML editor with preview
- Used in "Create Template" page (separate from visual editor)

### Auth (`web/src/components/auth/`)
- Login form, register form, forgot password

### Charts (`web/src/components/charts/`)
- Analytics chart components (Recharts-based)

### Landing Page (`web/src/components/landing/`)
| Component | Purpose |
|-----------|---------|
| `HeroSection.tsx` | Landing page hero with CTA |
| `FeatureShowcasesSection.tsx` | Feature grid showcase |
| `HowItWorksSection.tsx` | Step-by-step how it works |
| `SolutionsSection.tsx` | Industry solutions |
| `PricingSection.tsx` | Pricing tier cards |
| `TestimonialsSection.tsx` | Customer testimonials |
| `FAQSection.tsx` | FAQ accordion |
| `DemoVideoSection.tsx` | Demo video embed |
| `AIFeaturesSection.tsx` | AI features showcase |
| `StatsSection.tsx` | Platform stats |
| `SecuritySection.tsx` | Security features |
| `MidPageCTASection.tsx` | Mid-page call to action |
| `FinalCTASection.tsx` | Bottom CTA |
| `NavigationSection.tsx` | Landing page nav |
| `FooterSection.tsx` | Landing page footer |
| `StickyBottomBar.tsx` | Sticky bottom CTA bar |
| `shared.tsx` | Shared landing page utilities |

### Device/Display Components
| Component | Purpose |
|-----------|---------|
| `DeviceHealthMonitor.tsx` | Device health status panel |
| `DevicePreviewModal.tsx` | Live device preview modal |
| `DeviceStatusIndicator.tsx` | Online/offline status dot |
| `DeviceGroupSelector.tsx` | Device group picker |
| `ContentTagger.tsx` | Tag assignment for content |
| `FolderTree.tsx` | Folder hierarchy tree |
| `FolderBreadcrumb.tsx` | Folder path breadcrumb |
| `PlaylistPreview.tsx` | Playlist content preview |
| `PlaylistQuickSelect.tsx` | Quick playlist picker |
| `PreviewModal.tsx` | Content preview modal |
| `ScheduleCalendar.tsx` | Schedule calendar (react-big-calendar) |

### Providers (`web/src/components/providers/`)
- React context providers (theme, auth, socket, etc.)

### Support (`web/src/components/support/`)
- Support ticket widget components

## Design System

### Theme Files (`web/src/theme/`)
- `tokens.ts` -- CSS custom property definitions
- `colors.ts` -- Color palette constants
- `icons.tsx` -- Icon component wrapping Lucide icons
- `chartConfig.ts` -- Recharts theme config

### CSS Variable Pattern
Components use CSS variables, not direct Tailwind colors:
```css
bg-[var(--surface)]
text-[var(--foreground)]
border-[var(--border)]
```

### Brand Colors
- Primary green: `#00E5A0`
- Primary green hover: `#00CC8E`
- Dark background: `#061A21`
- These are hardcoded in components, not in Tailwind config

### Fonts
- Headings: `font-[var(--font-sora)]` (Sora)
- Body: Inter (implied default)

## Custom Hooks (`web/src/lib/hooks/`)

| Hook | Purpose |
|------|---------|
| `useAuth.ts` | Authentication state, login/logout |
| `useSocket.ts` | Socket.IO connection management |
| `useRealtimeEvents.ts` | Subscribe to real-time events |
| `useQueryHooks.ts` | TanStack Query wrapper hooks |
| `useAnalyticsData.ts` | Analytics data fetching |
| `useChartData.ts` | Chart data transformation |
| `useDebounce.ts` | Debounced value hook |
| `useErrorRecovery.ts` | Error recovery with retry |
| `useNotifications.ts` | Notification state |
| `useOptimisticState.ts` | Optimistic UI updates |
| `usePlaylistHistory.ts` | Playlist change history |
| `useTheme.ts` | Theme toggle |
| `useToast.tsx` | Toast notification hook |
