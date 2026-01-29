# Vizora Database MCP Server

**MCP server for querying and managing Vizora's PostgreSQL database via Prisma**

## Features

🔍 **Safe Querying**
- Read-only queries by default
- Maximum 100 records per query
- Filtered queries with Prisma syntax

📊 **Database Inspection**
- View table schemas
- Count records
- Get database statistics

🧪 **Test Data Management**
- Seed minimal test data
- Clean test data
- Safe operations only

---

## Installation

```bash
cd mcp-servers/vizora-database
pnpm install
pnpm exec prisma generate
pnpm build
```

---

## Available Tools

### 1. `vizora_db_query`
Query a Prisma model with optional filters (read-only, max 100 records).

**Input:**
```json
{
  "model": "Playlist",
  "filters": {
    "organizationId": "8fceb3f9-a1df-49ca-9704-6b9a4e953246"
  }
}
```

**Output:**
```json
[
  {
    "id": "cmkxkfp2l0005f2pu7kaqd5j1",
    "name": "Test Playlist",
    "organizationId": "8fceb3f9-a1df-49ca-9704-6b9a4e953246",
    "createdAt": "2026-01-27T10:30:00.000Z",
    "updatedAt": "2026-01-27T10:30:00.000Z"
  }
]
```

### 2. `vizora_db_get`
Get a single record by ID.

**Input:**
```json
{
  "model": "Display",
  "id": "cmkxd91jk0000f2pu1234abcd"
}
```

**Output:**
```json
{
  "id": "cmkxd91jk0000f2pu1234abcd",
  "name": "Food1",
  "location": "Kitchen",
  "paired": true,
  "organizationId": "8fceb3f9-a1df-49ca-9704-6b9a4e953246",
  "currentPlaylistId": "cmkxkfp2l0005f2pu7kaqd5j1",
  "status": "online",
  "lastSeen": "2026-01-28T01:00:00.000Z"
}
```

### 3. `vizora_db_count`
Count records in a model with optional filters.

**Input:**
```json
{
  "model": "Content",
  "filters": {
    "type": "image"
  }
}
```

**Output:**
```
Content count: 15
```

### 4. `vizora_db_inspect`
Get schema information for a model or all models.

**Input:**
```json
{
  "model": "Playlist"
}
```

**Output:**
```
model Playlist {
  id             String         @id @default(cuid())
  name           String
  organizationId String
  organization   Organization   @relation(fields: [organizationId], references: [id])
  items          PlaylistItem[]
  schedules      Schedule[]
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}
```

### 5. `vizora_db_stats`
Get record counts for all models (database overview).

**Input:** None

**Output:**
```json
{
  "User": 5,
  "Organization": 2,
  "Display": 10,
  "Content": 45,
  "Playlist": 12,
  "PlaylistItem": 60,
  "Schedule": 8
}
```

### 6. `vizora_db_seed`
Seed minimal test data (test organization + test user).

**Input:** None

**Output:**
```
Test data seeded successfully:
- Organization: Test Organization (8fceb3f9-a1df-49ca-9704-6b9a4e953246)
- User: test@test.com
```

### 7. `vizora_db_clean`
Remove test data (deletes test organization and associated records).

**Input:** None

**Output:**
```
Test data cleaned successfully
```

---

## Supported Models

- `User` - User accounts
- `Organization` - Organizations/tenants
- `Display` - Digital display devices
- `Content` - Media content (images, videos, URLs)
- `Playlist` - Content playlists
- `PlaylistItem` - Items in playlists
- `Schedule` - Playlist schedules

---

## Configuration

### Database Connection

Set `DATABASE_URL` in `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vizora?schema=public"
```

### Clawdbot Integration

Add to your Clawdbot config (`~/.clawdbot/config.json`):

```json
{
  "mcpServers": {
    "vizora-database": {
      "command": "node",
      "args": [
        "C:/Projects/vizora/vizora/mcp-servers/vizora-database/dist/index.js"
      ],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/vizora?schema=public"
      }
    }
  }
}
```

---

## Usage Examples

### Check Database Stats
```typescript
// AI assistant calls:
vizora_db_stats()

// Response:
{
  "User": 5,
  "Organization": 2,
  "Display": 10,
  "Content": 45,
  "Playlist": 12,
  "PlaylistItem": 60,
  "Schedule": 8
}
```

### Find All Displays for an Organization
```typescript
vizora_db_query({
  model: "Display",
  filters: {
    organizationId: "8fceb3f9-a1df-49ca-9704-6b9a4e953246"
  }
})

// Response: Array of display objects
```

### Verify Playlist Assignment
```typescript
vizora_db_get({
  model: "Display",
  id: "cmkxd91jk0000f2pu1234abcd"
})

// Check currentPlaylistId field in response
```

### Count Active Displays
```typescript
vizora_db_count({
  model: "Display",
  filters: {
    status: "online"
  }
})

// Response: "Display count: 7"
```

---

## Safety Features

### Read-Only by Default
All query operations are read-only. No `update`, `delete`, or `create` operations are exposed (except for test data management).

### Record Limits
Queries are limited to 100 records maximum to prevent memory issues.

### Filtered Models
Only safe, non-sensitive models are exposed. No access to:
- Password hashes (query User but hash is returned)
- Session tokens
- API keys
- Internal system tables

### Error Handling
All operations have comprehensive error handling with descriptive messages.

---

## Real-World Use Cases

### Debugging "Playlist Assignment Fails"
```typescript
// 1. Check if playlist exists
vizora_db_get({ model: "Playlist", id: "playlist-id" })

// 2. Check if display exists
vizora_db_get({ model: "Display", id: "display-id" })

// 3. Verify assignment
vizora_db_query({
  model: "Display",
  filters: { currentPlaylistId: "playlist-id" }
})

// All in seconds, no manual queries needed!
```

### Verifying Content Push
```typescript
// 1. Check playlist items
vizora_db_query({
  model: "PlaylistItem",
  filters: { playlistId: "playlist-id" }
})

// 2. Check display's current playlist
vizora_db_get({ model: "Display", id: "display-id" })

// 3. Verify content exists
vizora_db_get({ model: "Content", id: "content-id" })
```

### Monitoring System Health
```typescript
// Get overview
vizora_db_stats()

// Check active displays
vizora_db_count({ model: "Display", filters: { status: "online" } })

// Find offline displays
vizora_db_query({ model: "Display", filters: { status: "offline" } })
```

---

## BMAD Status

### ✅ Build Phase (Complete)
- [x] Project structure created
- [x] Prisma schema configured
- [x] Database connection established
- [x] All 7 tools implemented
- [x] Error handling added
- [x] Safety features implemented
- [x] Documentation written

### 🔄 Measure Phase (In Progress)
- [ ] Test each tool manually
- [ ] Verify query accuracy
- [ ] Test error scenarios
- [ ] Measure response times

### ⏳ Analyze Phase (Pending)
- [ ] Review security
- [ ] Identify edge cases
- [ ] Document limitations
- [ ] Performance analysis

### ⏳ Deploy Phase (Pending)
- [ ] Add to Clawdbot config
- [ ] Test with AI assistant
- [ ] Update main documentation
- [ ] Create CHANGELOG

---

## Limitations

1. **Read-Only (Mostly):** Can't directly update records (except test data)
2. **Record Limit:** Max 100 records per query
3. **No Transactions:** Can't execute multi-step transactions
4. **Schema Sync:** Must manually sync schema changes
5. **Connection Pool:** Uses single Prisma client (not pooled)

---

## Future Enhancements

- [ ] Write operations (with safety checks & confirmation)
- [ ] Transaction support
- [ ] Connection pooling
- [ ] Query result pagination
- [ ] Raw SQL queries (with validation)
- [ ] Backup/restore operations
- [ ] Migration management
- [ ] Schema diff tool

---

## Troubleshooting

### "Cannot find module '@prisma/client'"
```bash
pnpm exec prisma generate
```

### "Connection error"
Check `.env` file and verify PostgreSQL is running:
```bash
# Windows
netstat -ano | findstr :5432

# Or try connecting manually
psql -U postgres -d vizora
```

### "Module not found" errors
```bash
pnpm install
pnpm build
```

---

## Contributing

Follow BMAD methodology for all changes:
1. **Build:** Implement feature
2. **Measure:** Test thoroughly
3. **Analyze:** Review results
4. **Deploy:** Integrate and document

---

## License

MIT

---

**Created:** 2026-01-28 01:22 AM  
**Build Time:** ~10 minutes  
**Status:** 🟡 Build Complete, Testing In Progress  
**Next:** Manual testing and Clawdbot integration
