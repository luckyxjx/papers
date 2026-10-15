# Testing Guide - Real-Time Collaboration

## Starting the Application

### Terminal 1 - Start Backend Server:
```bash
cd server
npm run dev
```

You should see:
```
✅ Database initialized
🤝 Ajaia Docs collaboration server listening on ws://localhost:1234
🚀 Ajaia Docs server running on http://localhost:4000
```

### Terminal 2 - Start Frontend:
```bash
cd client
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

## Test Scenarios

### 🧪 Test 1: Content Persistence (Single User)

**Goal**: Verify content survives page refresh

1. Open http://localhost:5173/
2. Login as Alice:
   - Email: `alice@ajaia.com`
   - Password: `password123`
3. Click on "Q4 planning" document
4. Wait for "Live · Saved" status (green dot)
5. Make some edits (add text, change formatting, etc.)
6. Wait 3 seconds for auto-save
7. **Hard refresh the page** (Cmd+Shift+R or Ctrl+Shift+R)
8. ✅ **PASS**: Your changes should still be there
9. ❌ **FAIL**: If content is lost, check browser console for errors

### 🧪 Test 2: Real-Time Collaboration (Multi-User)

**Goal**: Verify changes sync between users in real-time

#### Setup:
1. Open **two separate browser windows** (or use Chrome normal + incognito)
2. **Window A** - Login as Alice (`alice@ajaia.com` / `password123`)
3. **Window B** - Login as Bob (`bob@ajaia.com` / `password123`)

#### Test Steps:
1. In both windows, open the **same document**: "Q4 planning"
   - This document is shared between Alice, Bob, and Carol
2. Look for the connection indicator:
   - ✅ Green dot = "Live · Saved" (connected)
   - 🟡 Yellow dot = "Connecting…"
3. In Window A (Alice), start typing a new paragraph
4. ✅ **PASS**: Window B (Bob) should see the text appear **in real-time** as Alice types
5. In Window B (Bob), make edits to a different part of the document
6. ✅ **PASS**: Window A (Alice) should see Bob's changes instantly
7. Try **concurrent editing** - both users type at the same time in different paragraphs
8. ✅ **PASS**: No conflicts, both edits should merge correctly

#### What to Look For:
- **Colored cursor indicators**: You should see other users' cursors with their names
- **Instant updates**: Changes appear character-by-character in real-time (< 100ms delay)
- **No conflicts**: Simultaneous edits don't overwrite each other
- **Collaborator avatars**: Top-right shows active users (colored circles with initials)

### 🧪 Test 3: Permission Enforcement

**Goal**: Verify read-only users can't edit

1. Logout and login as Carol:
   - Email: `carol@ajaia.com`
   - Password: `password123`
2. Open "Q4 planning" (Carol has **view-only** access)
3. ✅ **PASS**: Editor toolbar should be disabled/hidden
4. ✅ **PASS**: Clicking in the document should NOT allow typing
5. ❌ **FAIL**: If Carol can edit, permission check is broken
6. Open "Customer interview notes" (Carol is the owner)
7. ✅ **PASS**: Carol should have full edit access to her own document

### 🧪 Test 4: Multi-User Real-Time with Reload

**Goal**: New users see latest state when joining

#### Setup:
1. **Window A** - Alice editing "Q4 planning"
2. **Window B** - Keep closed for now

#### Test Steps:
1. In Window A (Alice), add a new section: "## New Section Added by Alice"
2. Wait 3 seconds for save
3. Now open **Window B** and login as Bob
4. Bob opens "Q4 planning"
5. ✅ **PASS**: Bob should immediately see Alice's "New Section"
6. Alice continues typing in real-time
7. ✅ **PASS**: Bob sees Alice's cursor and live updates
8. **Refresh both windows** (hard refresh)
9. ✅ **PASS**: Both see the same latest content
10. ✅ **PASS**: Real-time sync resumes after refresh

### 🧪 Test 5: Network Disconnect/Reconnect

**Goal**: Verify graceful handling of connection issues

1. Open document as Alice
2. Note the "Live · Saved" green indicator
3. Open browser DevTools → Network tab
4. Click "Offline" mode
5. ✅ **PASS**: Status should change to "Connecting…" with yellow/orange dot
6. Try making edits while offline
   - Edits should still work locally (Yjs CRDT works offline)
7. Turn network back online
8. ✅ **PASS**: Should reconnect and show "Live · Saved" again
9. ✅ **PASS**: Your offline edits should sync to server
10. ✅ **PASS**: Other users should receive your queued changes

## Troubleshooting

### Problem: "Connecting…" never becomes "Live · Saved"

**Check**:
1. Is collaboration server running on port 1234?
   ```bash
   lsof -i :1234
   ```
2. Check browser console for WebSocket errors
3. Verify `.env` has correct `VITE_COLLAB_URL` (should be `ws://localhost:1234`)

### Problem: Changes disappear on refresh

**Check**:
1. Browser console for errors
2. Server logs - look for "💾 Saved collaborative state for document: XXX"
3. Database - verify `collaborative_documents` table has entries:
   ```bash
   cd server
   sqlite3 data/ajaia.db "SELECT document_id, length(state), updated_at FROM collaborative_documents;"
   ```

### Problem: No real-time sync between users

**Check**:
1. Both users are viewing the **same document ID**
2. Both show "Live · Saved" (green dot)
3. Server logs show both connections:
   ```
   📄 Loaded collaborative document: doc-q4
   ```
4. Network tab shows active WebSocket connection (ws://localhost:1234)

### Problem: Can't log in / auth errors

**Check**:
1. Backend server is running on port 4000
2. Database is initialized (check `server/data/ajaia.db` exists)
3. Try re-seeding:
   ```bash
   rm server/data/ajaia.db*
   npm run dev
   ```

## Expected Console Output

### Client (Browser Console):
```
✅ Connected to collaboration server
🔄 Document synced with server
📡 Collaboration status: connected
```

### Server (Terminal):
```
📄 Loaded collaborative document: doc-q4
💾 Saved collaborative state for document: doc-q4
```

## Seeded Test Users

| Email | Password | Documents Owned | Shared Access |
|-------|----------|----------------|---------------|
| `alice@ajaia.com` | `password123` | Q4 planning, Launch checklist, Meeting notes | View: Customer interview notes; Edit: Onboarding notes |
| `bob@ajaia.com` | `password123` | Onboarding notes | Edit: Q4 planning |
| `carol@ajaia.com` | `password123` | Customer interview notes | View: Q4 planning |

## Success Criteria

✅ All tests pass
✅ No console errors in browser or server
✅ Content persists across refreshes
✅ Real-time sync works between users
✅ Permissions are enforced correctly
✅ Reconnection works after network interruption
✅ No data loss or conflicts during concurrent editing
