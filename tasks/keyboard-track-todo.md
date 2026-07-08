# Keyboard-track to production-ready (resume-until-done, plan-gated, subagent-reviewed)

Rule: hardware-bound findings (F1/F2/F3, native crash, cold-reboot pull, socket-alive self-heal)
do NOT close from here — offshore signs those off. Hard stops → pending-decisions.md + continue.

## T1 — schedules-UI interim hide + drop CRLF stash  ✅ DONE (branch feat/schedules-ui-interim-hide, cdf6aae0, HELD)
- [x] Verify CRLF stash dropped
- [x] Hide schedules: nav + server-page gate + command palette + overview quick-action; reversible flag
- [x] Subagent review (SHIP, gaps closed); 17/17 green; HELD for merge
- follow-up (not this PR): stale help/page.tsx FAQ copy

## T2 — pull-on-connect slice (cross-repo) — docs/pull-on-connect.md  ⟳ PARTIAL
- [x] findActiveSchedules content-status/expiry filter (S1-2) — vizora b624ca0c (branch feat/pull-on-connect-backend), HELD
- [x] TV app updatePlaylist same-playlist NO-OP (PD-1) — vizora-tv b0a7aaa (branch fix/pd1-updateplaylist-idempotent), HELD; UNBLOCKS Finding-2 merge
- [ ] C-7 DELIVERY (resolver + /devices/me/content + realtime schedule-awareness + client pull-on-connect + boundary re-pull + heartbeat reconcile) — SPECCED not built; large cross-app slice; de-risked because T1 hides the schedules UI (no exposure). Build plan appended to docs/pull-on-connect.md.
- [ ] Subagent review of built pieces (PD-1 + filter)

## T3 — PD-4 security slice
- [ ] Throttle overrides actually fire; rate-limit auth/login; fix checkPairingStatus JWT leak; revise dim-5
- [ ] Subagent review; HOLD for merge

## T4 — tenant-guard enforce prerequisites (flip stays QUEUED)
- [ ] Bare-id sweep (~7 svcs); device-auth guard; realtime boundary; nested creates; fail-closed
- [ ] Every warned write clean; subagent review; HOLD (do NOT flip enforce)

## Close-out
- [ ] Built-and-held / queued / revised scorecard / explicit production-ready line
