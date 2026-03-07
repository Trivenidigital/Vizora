# Security Notes

## Git History Contains Stale Development Secrets

Commits `a42675b` through `fb1bdf6` contain a `.env` file with development-only secrets:
- `JWT_SECRET=vizora-dev-secret-key-change-in-production-32chars`
- `DEVICE_JWT_SECRET=vizora-device-secret-key-change-in-production`
- MinIO default credentials (`minioadmin`)

**Status:** All production secrets have been rotated and are different from these values.

**Action taken:** The `.env` file was removed from git tracking. `.gitignore` blocks future commits.

**Recommendation:** If this repo is ever made public or shared with untrusted parties, use BFG Repo-Cleaner to purge history:
```
bfg --delete-files .env
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```
