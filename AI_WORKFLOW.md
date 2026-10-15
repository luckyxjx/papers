# AI Workflow Note

## Tools Used

- **Antigravity (Google DeepMind)** — primary pair-programming assistant throughout the build

---

## Where AI Materially Sped Up My Work

### 1. Boilerplate & Route Scaffolding at Velocity
Setting up the backend foundation — the Express application skeleton, SQLite schema, JWT authentication middleware, and four modular route handlers (`auth`, `documents`, `sharing`, `upload`) — would typically consume 60–90 minutes of mechanical typing. AI generated the initial baseline in under 5 minutes, allowing me to shift immediate focus to reviewing access control boundaries and data integrity.

### 2. TipTap Editor & Floating Toolbar
Scaffolding the TipTap v2 editor configuration (15+ formatting controls, active state tracking for marks and headings, font size dropdown, character count storage) is verbose and repetitive. AI generated the initial component structure cleanly on the first pass, including the `editor.isActive()` patterns.

### 3. Google Docs-Inspired Design System
AI accelerated translating the visual layout into a clean, modern design system: a neutral workspace canvas, centered white document sheet with subtle elevation, floating centered pill toolbar, and the documents table with tabbed filtering ("My documents" vs. "Shared with me"). Generating the baseline CSS allowed me to spend time refining spacing, typography hierarchy, and hover states rather than writing repetitive rules.

### 4. Integration Test Scaffolding
AI scaffolded the initial integration test suite using Jest, Supertest, and an in-memory SQLite database. Having the test structure pre-written saved significant setup time, giving me a fast harness to validate business logic and permission enforcement.

---

## Concrete Prompt & Output Example

**Prompt:**
> *"Create a Hocuspocus v4 server configuration in Node.js with `onAuthenticate`, `onLoadDocument`, and `onStoreDocument` hooks. It needs to verify a JWT token against SQLite for document read/write permissions, load saved binary Yjs state from a `collaborative_documents` table, migrate legacy TipTap JSON if no binary state exists yet, and debounce saves."*

**What Came Back:**
AI provided the skeleton with the Hocuspocus event lifecycle and SQLite queries. However, it made two critical architectural omissions that I had to catch and fix:
1. It used `y-prosemirror`'s `prosemirrorJSONToYDoc` without specifying the XML fragment name (defaulting to `'prosemirror'`), whereas TipTap's `Collaboration` extension defaults its root fragment to `'default'`. As a result, the migrated content existed on a disconnected branch, rendering documents blank in the client. I caught this during inspection and explicitly bound both migration and snapshots to `'default'`.
2. The initial save hook wrote directly on every tiny update without debouncing or tracking disconnect flushes, which would have saturated SQLite during rapid typing. I refactored it to debounce writes by 2 seconds with immediate flush on client disconnect.

---

## What I Changed or Rejected

### Architectural Rejections
- **Cosmetic WebSocket Mock vs. True CRDT**: AI initially proposed a superficial presence indicator using raw WebSockets that only broadcast cursor coordinates without synchronizing document content. I rejected this — a cosmetic presence feature without real document synchronization creates a misleading user experience. Instead, I architected a true collaborative engine using Yjs CRDTs and Hocuspocus, ensuring simultaneous edits merge conflict-free.
- **Prisma ORM**: AI suggested using Prisma for data access. I rejected this because Prisma introduces binary build overhead, schema migration complexity, and slower cold starts that are unnecessary for an embedded SQLite architecture. `better-sqlite3`'s synchronous API provided zero-latency execution, atomic transactions, and zero external runtime dependencies.

### Technical Corrections & Bugs Caught
- **Collaborative Content Re-hydration Bug**: When integrating TipTap's Collaboration extension, the initial React component passed both `content={initialDocument}` and `Collaboration.configure({ document: provider.document })`. This caused local client mounts to overwrite the remote collaborative document on refresh. I restructured `RichTextEditor.jsx` so that when a collaborative provider exists, TipTap strictly sources document state from Yjs and disables standard history in favor of collaborative undo/redo.
- **Auto-Save Stale Closure in React**: AI's initial save effect relied on `useEffect` with document state in the dependency array. Rapid typing caused stale closure captures of `docId`. I rewrote this to use `useRef` for pending changes and a clean debounced callback.
- **SQL Cascade Prevention on Shares**: The generated share handler used `INSERT OR REPLACE INTO shares`, which silently dropped existing primary keys and triggered unintended cascade behavior. I rewrote it into an explicit `SELECT` followed by conditional `INSERT` or `UPDATE`.
- **Test Database Isolation**: The scaffolded test configuration attempted to write to a temporary physical SQLite file. I redirected the test harness to use `:memory:` SQLite databases, ensuring each test run starts with a clean slate and avoids filesystem race conditions.

---

## How I Verified Correctness

1. **Automated Integration Tests (28 / 28 passing)**:
   - **REST API Suite (20 tests)**: Verified auth login, invalid credential rejection, document CRUD, ownership enforcement, share creation, permission upgrades (`view` → `edit`), and access revocation. I audited every expected status code against the security model (401 for unauthenticated requests, 403 for unauthorized access and view-only write attempts).
   - **Collaboration Suite (8 tests)**: Verified JWT verification in `onAuthenticate`, fail-closed rejection of unshared users, legacy JSON migration to Yjs state, binary persistence in `collaborative_documents`, and document recovery across simulated server restarts.
2. **Multi-User Live Collaboration Verification**:
   - Logged into two separate browser sessions concurrently (Alice as document owner in normal window, Bob as editor in incognito).
   - Opened the shared "Q4 planning" document in both windows simultaneously.
   - Verified that edits in Window A propagated character-by-character to Window B in real time with colored collaborator cursor flags and avatar status indicators.
   - Tested concurrent typing in different paragraphs and confirmed that Yjs CRDT merged both changes deterministically without collisions or lost edits.
3. **Permission Enforcement Audit**:
   - Logged in as Carol, who has `view` permission on "Q4 planning".
   - Verified that the editing toolbar was hidden, the canvas was locked to read-only, and any attempted REST write returned HTTP 403 Forbidden.
4. **Offline & Recovery Testing**:
   - Toggled network offline in browser DevTools during an active editing session; verified the status indicator transitioned from "Live · Saved" to "Connecting…", and that queued local edits synced seamlessly upon reconnection.

---

## Reflection

AI provided exceptional leverage on high-volume, well-defined tasks: scaffolding route skeletons, generating the TipTap toolbar controls, and drafting boilerplate test suites. This compressed hours of routine typing into minutes.

However, AI routinely failed at subtle protocol and lifecycle nuances — such as TipTap's internal XML fragment naming conventions, CRDT state ownership vs. props re-hydration, and avoiding cosmetic mock implementations. The judgment calls — choosing Yjs over simple WebSockets, enforcing a strict fail-closed security boundary, and verifying data flow with rigorous automated tests — required active engineering discipline. 

AI was an effective junior pair programmer for accelerating drafts, but architectural integrity and edge-case correctness required thorough human review.
