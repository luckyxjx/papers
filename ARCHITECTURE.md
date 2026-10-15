# System Architecture

## Overview

Ajaia Docs is a lightweight collaborative document editor inspired by Google Docs. The system is architected around a clean separation of concerns:
- **Express REST API + SQLite**: Document catalog, user authentication, permissions, file upload/import, and attachments.
- **TipTap + ProseMirror**: Headless, accessible rich-text editing engine running in the client.
- **Yjs CRDT + Hocuspocus Server**: Real-time multi-user document synchronization, conflict-free state merging, and collaborative presence over WebSockets.
- **Dual Persistence Strategy**: Authoritative binary CRDT state stored in SQLite alongside backward-compatible JSON snapshots for search and export APIs.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (React + Vite)                    │
│  ┌──────────────────────┐             ┌──────────────────────┐  │
│  │   TipTap Editor UI   │             │   Presence / Peers   │  │
│  └──────────┬───────────┘             └──────────┬───────────┘  │
│             │                                    │              │
│             ▼                                    ▼              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │             Yjs CRDT Doc + Hocuspocus Provider            │  │
│  └──────────────────────────────┬────────────────────────────┘  │
└─────────────────────────────────┼───────────────────────────────┘
                                  │ WebSockets
                                  │ (Port 1234 or unified port)
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (Node.js / Express)                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │             Hocuspocus Real-Time Collab Server            │  │
│  │  - onAuthenticate: JWT verification & document access     │  │
│  │  - onLoadDocument: Load/migrate binary CRDT state         │  │
│  │  - onStoreDocument: Debounced Yjs binary write & snapshot │  │
│  └──────────────┬────────────────────────────────────────────┘  │
│                 │                                               │
│                 │ (SQLite DB: collaborative_documents)          │
│                 ▼                                               │
│  ┌──────────────────────────────┬────────────────────────────┐  │
│  │    SQLite (better-sqlite3)   │      Express REST API      │  │
│  │ - users                      │ - /api/auth                │  │
│  │ - documents                  │ - /api/documents           │  │
│  │ - shares                     │ - /api/shares              │  │
│  │ - attachments                │ - /api/upload              │  │
│  │ - collaborative_documents    │                            │  │
│  └──────────────────────────────┴────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend
- **Node.js (v20+) & Express**: REST routing, middleware pipeline, static asset streaming.
- **SQLite via `better-sqlite3`**: Zero-configuration, high-performance synchronous storage with WAL mode enabled for concurrent reads.
- **`@hocuspocus/server`**: High-throughput WebSocket collaboration server tailored for Yjs CRDTs.
- **`yjs` & `y-prosemirror`**: CRDT data structures for real-time conflict-free editing, collaborative undo/redo, and ProseMirror document tree projection.
- **JWT (`jsonwebtoken`)**: Stateless token authentication with claims for user ID, email, and display name.
- **`mammoth`**: Parsing Word documents (`.docx`) to semantic HTML for document imports.
- **`express-fileupload`**: Multipart stream handling for file attachments and embedded images.

### Frontend
- **React 18 & Vite**: Fast HMR, component tree encapsulation, and optimized production bundling.
- **TipTap v2 (ProseMirror)**: Headless rich-text editor engine. Configured with:
  - `@tiptap/starter-kit` (headings, lists, blockquote, code blocks, bold, italic, strike)
  - `@tiptap/extension-underline`
  - `@tiptap/extension-highlight`
  - `@tiptap/extension-text-align`
  - `@tiptap/extension-link`
  - `@tiptap/extension-image` (inline and block image embedding)
  - `@tiptap/extension-text-style` & custom `FontSize` extension
  - `@tiptap/extension-collaboration` (binds ProseMirror to Yjs XML fragment `'default'`)
  - `@tiptap/extension-collaboration-cursor` (renders remote caret positions with user badges)
- **`@hocuspocus/provider`**: WebSocket client managing reconnection, awareness state, and binary update broadcasting.
- **Lucide Icons**: Consistent, lightweight SVG icon system.

---

## Data Model & Persistence

The database schema separates relational metadata from CRDT state:

### 1. `users`
- `id` (TEXT, PK): e.g., `'user-alice'`
- `email` (TEXT, UNIQUE): Login identifier
- `password_hash` (TEXT): bcrypt-hashed credentials
- `name` (TEXT): Collaborator display name
- `avatar_color` (TEXT): Hex color assigned for cursor presence and avatars

### 2. `documents`
- `id` (TEXT, PK): Unique document slug (e.g., `'doc-q4'`)
- `title` (TEXT): Document title
- `content` (TEXT): Compatibility JSON snapshot (ProseMirror schema)
- `owner_id` (TEXT, FK → users.id)
- `created_at` / `updated_at` (DATETIME)

### 3. `shares`
- `id` (TEXT, PK)
- `document_id` (TEXT, FK → documents.id)
- `shared_with_id` (TEXT, FK → users.id)
- `permission` (TEXT): `'view'` (read-only) or `'edit'` (read-write)

### 4. `attachments`
- `id` (TEXT, PK)
- `document_id` (TEXT, FK → documents.id)
- `filename` (TEXT): Stored filename in `/uploads/`
- `original_name` (TEXT): User-facing filename
- `mime_type` (TEXT), `size` (INTEGER)

### 5. `collaborative_documents`
- `document_id` (TEXT, PK)
- `state` (BLOB): Authoritative Yjs binary state vector (`Y.encodeStateAsUpdate`)
- `updated_at` (DATETIME)

---

## Real-Time Synchronization Lifecycle

1. **Authentication (`onAuthenticate`)**:
   - Client sends JWT token with document name parameter (`document.<docId>`).
   - Server decodes JWT, verifies user existence in SQLite, and validates that the user is either the owner or has an active share (`view` or `edit`).
   - If unauthorized, connection fails closed immediately.

2. **Hydration & Migration (`onLoadDocument`)**:
   - Server checks `collaborative_documents` table for saved binary state.
   - If found, applies update vector to the memory Y.Doc.
   - If not found (first time an existing document is opened collaboratively), converts `documents.content` JSON to Y.Doc using `prosemirrorJSONToYDoc(schema, json, 'default')`, persists to SQLite, and returns the initialized document.

3. **Live Collaboration (`awareness` & CRDT updates)**:
   - Keystrokes generate binary update deltas sent over WebSocket.
   - Cursors and selections broadcast user names and hex colors across connected peers.
   - Standard history (undo/redo) is disabled in favor of Yjs collaborative history so undo only affects the local user's keystrokes.

4. **Persistence & Snapshots (`onStoreDocument`)**:
   - Binary CRDT state is written to `collaborative_documents` (debounced by 2 seconds or on client disconnect).
   - Simultaneously, a ProseMirror JSON compatibility snapshot is extracted via `yDocToProsemirrorJSON(ydoc, 'default')` and updated in `documents.content` to keep search, exports, and REST list endpoints completely in sync.

---

## Deployment & Single-Port Cloud Architecture

Cloud PaaS environments like **Render** expose a single dynamic external port (`$PORT`) to the outside world. To support both HTTP traffic and WebSocket collaboration without requiring multiple paid services:

1. **Static Build Serving**: In production (`NODE_ENV=production`), Express statically serves the production frontend from `client/dist`.
2. **WebSocket Upgrade Forwarding**: The root HTTP server listens on `$PORT` and attaches an `'upgrade'` listener that forwards incoming WebSocket requests directly to Hocuspocus:
   ```javascript
   httpServer.on('upgrade', async (request, socket, head) => {
     if (collabServer.crossws?.handleUpgrade) {
       await collabServer.hocuspocus?.hooks('onUpgrade', { request, socket, head, instance: collabServer.hocuspocus });
       collabServer.crossws.handleUpgrade(request, socket, head);
     }
   });
   ```
3. **Smart Client Fallback**: The client automatically selects `wss://${window.location.host}` in production HTTPS, or `ws://${window.location.hostname}:1234` in local development.
