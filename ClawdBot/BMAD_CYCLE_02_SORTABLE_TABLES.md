# BMAD Cycle 02: Sortable Table Columns

**Gap ID:** #23  
**Feature:** Sortable columns for devices/content/playlists tables  
**Status:** 🟡 IN PROGRESS - BUILD  
**Start Time:** 2026-01-28 10:50 AM  

---

## BUILD Phase 🔄

### Dependencies:
- ✅ Installing `@tanstack/react-table` (React Table v8)

### Implementation Plan:

**Step 1: Create Reusable Table Component**
- `web/src/components/SortableTable.tsx`
- Generic TypeScript component
- Takes columns config + data
- Handles sorting state internally
- Returns table with sort indicators

**Step 2: Devices Table (Primary Implementation)**
- Convert existing devices table to use SortableTable
- Define column config (Device, Status, Location, Last Seen)
- Add sort handlers
- Style sort indicators (↑ ↓)

**Step 3: Content & Playlists Tables**
- Apply same pattern to content grid (if applicable)
- Apply to playlists (if we convert to table view)
- Or create SortableGrid component for card layouts

### Design Decisions:

**Sort Behavior:**
- Click header → Sort ASC
- Click again → Sort DESC  
- Click third time → Remove sort (original order)
- Only one column sorted at a time (simplicity)

**Visual Indicators:**
- Unsorted: No arrow
- ASC: ↑ arrow
- DESC: ↓ arrow
- Hover: Underline + pointer cursor

**State Management:**
- Local state in component (no URL params for v1)
- Can add URL params later for shareable sorted views

---

## Files to Create:
1. `web/src/components/SortableTable.tsx` - Main component
2. `web/src/types/table.ts` - TypeScript types

## Files to Modify:
1. `web/src/app/dashboard/devices/page.tsx` - Use SortableTable
2. Potentially content/playlists pages if time permits

---

## Acceptance Criteria:
- [ ] Click column header sorts ASC
- [ ] Click again sorts DESC
- [ ] Click third time removes sort
- [ ] Visual indicator shows current sort
- [ ] All device columns sortable
- [ ] Sort works with search filtering
- [ ] No performance issues with 100+ items

---

## MEASURE Phase
⏳ Pending BUILD completion

---

## ANALYZE Phase
⏳ Pending

---

## DECIDE Phase
⏳ Pending

---

**Status:** Installing dependencies, ready to code...
