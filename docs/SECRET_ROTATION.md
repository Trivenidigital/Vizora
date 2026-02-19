# Secret Rotation Guide

This document describes how to safely rotate JWT secrets in a Vizora deployment.

## Secrets Overview

| Secret | Purpose | Impact of Rotation |
|---|---|---|
| `JWT_SECRET` | Signs user authentication JWTs | All user sessions invalidated; users must re-login |
| `DEVICE_JWT_SECRET` | Signs device authentication JWTs | All device connections dropped; devices need re-pairing |

Both secrets must be at least 32 characters. They are independent and can be rotated separately.

## Pre-Rotation Checklist

- [ ] Schedule a maintenance window (device rotation causes temporary offline state)
- [ ] Ensure you have database access for emergency recovery
- [ ] Verify your backup is current (`scripts/backup-db.sh`)
- [ ] Notify users about upcoming session invalidation (for `JWT_SECRET` rotation)
- [ ] Have device re-pairing instructions ready (for `DEVICE_JWT_SECRET` rotation)

## Rotating JWT_SECRET (User Sessions)

### Impact

- All active user sessions are immediately invalidated
- Users will be redirected to the login page
- No data is lost; users simply need to log in again
- Token revocation list in Redis becomes stale (safe to clear)

### Steps

1. **Generate a new secret:**
   ```bash
   # Generate a cryptographically secure 64-character secret
   openssl rand -base64 48
   ```

2. **Update the environment variable:**
   ```bash
   # Edit your .env file or environment configuration
   JWT_SECRET=<new-secret-value>
   ```

3. **Clear the token revocation list in Redis** (optional but recommended):
   ```bash
   # Connect to Redis
   redis-cli -a $REDIS_PASSWORD

   # Remove all revoked token entries (they reference the old secret)
   EVAL "local keys = redis.call('keys', 'revoked_token:*'); for i,k in ipairs(keys) do redis.call('del', k) end; return #keys" 0
   ```

4. **Restart services with rolling restart:**
   ```bash
   # If using PM2:
   pm2 reload vizora-middleware
   pm2 reload vizora-web

   # The realtime gateway also validates user tokens for organization room joins:
   pm2 reload vizora-realtime
   ```

5. **Verify:**
   - Navigate to the dashboard -- you should be redirected to login
   - Log in with valid credentials
   - Confirm WebSocket connection is established (real-time status indicator)

## Rotating DEVICE_JWT_SECRET (Device Connections)

### Impact

- All connected devices are immediately disconnected
- Devices will fail to reconnect until they are re-paired
- Device status will show as "offline" in the dashboard
- The pairing flow issues new tokens signed with the new secret
- No content or configuration data is lost

### Steps

1. **Generate a new secret:**
   ```bash
   openssl rand -base64 48
   ```

2. **Update the environment variable:**
   ```bash
   DEVICE_JWT_SECRET=<new-secret-value>
   ```

3. **Invalidate existing device tokens in the database:**
   ```sql
   -- Connect to PostgreSQL and clear all stored token hashes
   -- This forces all devices to go through re-pairing
   UPDATE "Display" SET "jwtToken" = NULL, "status" = 'offline';
   ```

4. **Restart services:**
   ```bash
   # Middleware handles device pairing and token issuance:
   pm2 reload vizora-middleware

   # Realtime gateway verifies device tokens on connection:
   pm2 reload vizora-realtime
   ```

5. **Re-pair all devices:**
   - Each device will detect the connection failure and show a pairing screen
   - Users go to Dashboard > Devices > Pair Device to generate new pairing codes
   - Devices enter the code to complete re-pairing and receive new tokens

6. **Verify:**
   - Check that devices reconnect and show as "online"
   - Verify playlists are delivered to devices after re-pairing

## Rotating Both Secrets Simultaneously

If rotating both secrets at once (e.g., after a suspected compromise):

1. Generate two new secrets
2. Update both `JWT_SECRET` and `DEVICE_JWT_SECRET` in the environment
3. Clear the Redis revocation list
4. Invalidate device tokens in PostgreSQL
5. Restart all three services:
   ```bash
   pm2 reload vizora-middleware
   pm2 reload vizora-realtime
   pm2 reload vizora-web
   ```
6. Re-pair all devices
7. Users log in again

## Automation Script

If the security-fixer team has created `scripts/rotate-secrets.sh`, you can use it for automated rotation:

```bash
# Rotate user JWT secret only
./scripts/rotate-secrets.sh --user

# Rotate device JWT secret only
./scripts/rotate-secrets.sh --device

# Rotate both
./scripts/rotate-secrets.sh --all
```

Refer to the script's `--help` output for full options.

## Emergency Procedures

### If a Secret is Compromised

1. **Immediately** generate and deploy a new secret (follow steps above)
2. Check audit logs for unauthorized access:
   ```sql
   SELECT * FROM "AuditLog"
   WHERE action IN ('user_login', 'user_registered')
   ORDER BY "createdAt" DESC
   LIMIT 100;
   ```
3. Review Redis for suspicious revoked tokens:
   ```bash
   redis-cli -a $REDIS_PASSWORD KEYS "revoked_token:*"
   ```
4. Check the realtime gateway logs for unusual device connections:
   ```bash
   pm2 logs vizora-realtime --lines 200
   ```

### If Services Fail to Start After Rotation

- Verify the new secret is at least 32 characters
- Ensure the secret does not contain shell-special characters that need escaping
- Check that the `.env` file has no trailing whitespace on the secret lines
- Verify the secret is set in all environments where services run (middleware, realtime, web)

## Recommended Rotation Schedule

| Secret | Recommended Interval | Trigger Conditions |
|---|---|---|
| `JWT_SECRET` | Every 90 days | Suspected compromise, employee offboarding |
| `DEVICE_JWT_SECRET` | Every 180 days | Suspected compromise, device fleet changes |
