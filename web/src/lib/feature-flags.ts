/**
 * Minimal build-time feature flags. `NEXT_PUBLIC_*` values are inlined at build,
 * so these are plain constants usable in server and client components.
 */

/**
 * SCHEDULES_ENABLED — default OFF (interim C-7 mitigation).
 *
 * Time-based scheduling is hidden because schedule-only content is currently
 * delivered to devices by NO path (no writer sets currentPlaylistId from a
 * schedule, no push, no client poll — see docs/finding2-reconnect-rehydration.md
 * / pending-decisions.md PD-3). A customer who assigns content via a schedule
 * gets a blank screen while the dashboard reports it "active" — a silent failure.
 * Hidden from the UI until the pull-on-connect slice (docs/pull-on-connect.md)
 * lands the schedule delivery path AND the findActiveSchedules status/expiry
 * filter.
 *
 * RE-ENABLING: `NEXT_PUBLIC_*` is inlined at BUILD time (baked into `.next` and the
 * Docker image), so flipping `NEXT_PUBLIC_SCHEDULES_ENABLED=true` on a running
 * instance does nothing — it requires a rebuild + redeploy of the web app.
 */
export const SCHEDULES_ENABLED = process.env.NEXT_PUBLIC_SCHEDULES_ENABLED === 'true';
