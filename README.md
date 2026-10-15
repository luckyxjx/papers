# Ajaia Docs

A lightweight, real-time collaborative document editor inspired by Google Docs. Built with **Node.js, Express, SQLite, TipTap, Yjs CRDTs, and Hocuspocus WebSockets**.

---

## Features

- 🤝 **Real-Time Google Docs-Style Collaboration**: Concurrent editing powered by Yjs Conflict-Free Replicated Data Types (CRDTs). Simultaneous edits merge deterministically without data loss.
- 👥 **Presence & Caret Awareness**: Live collaborator flags with real-time cursor tracking, custom user colors, and active peer avatar stacks.
- 🎨 **Google Docs Design & Canvas**: Clean, centered white sheet canvas on a neutral gray backdrop, paired with a floating centered formatting toolbar.
- ✍️ **Comprehensive Rich-Text Formatting**:
  - Font size selector (12px, 15px, 18px, 24px, and default)
  - Headings (H1, H2, H3)
  - Bold, Italic, Underline, Strikethrough, Code, and Highlight
  - Bulleted and numbered lists with indentation
  - Text alignment (Left, Center, Right), Blockquotes, and Dividers
  - Collaborative Undo & Redo (isolated to the local user's edit history)
- 📎 **Attachments & Direct Image Embedding**:
  - Embed images directly into document canvas from disk (`.png`, `.jpg`, `.gif`) or web URL
  - Attach documents, PDFs, or archives with inline clickable badge links
  - Attachment tray to open, insert, or delete attached files
- 🔒 **Granular Access Control & Sharing**:
  - Document ownership, `edit` permissions, and `view` permissions
  - Read-only enforcement for view-only users (disabled toolbar, locked canvas)
  - Instant access revocation
- 📁 **File Import & Export**:
  - Import `.txt`, `.md`, and `.docx` (via mammoth) into formatted documents
  - Export to Markdown (`.md`) or trigger browser print / Save as PDF
- 💾 **Dual-Storage Persistence**:
  - Authoritative Yjs binary state saved in SQLite (`collaborative_documents` table)
  - Backward-compatible ProseMirror JSON snapshots kept in `documents.content` for search and REST API consumers
- 🧪 **28 Passing Integration Tests**: Comprehensive automated test suite covering authentication, REST document CRUD, sharing logic, and WebSocket CRDT persistence.

---

## Quick Start (Local Setup)

### Prerequisites

- **Node.js** ≥ 18 (Node 20+ recommended)
- **npm** ≥ 9

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/your-username/aajia-docs.git
cd aajia-docs

# Install dependencies for both backend and frontend
npm --prefix server install
npm --prefix client install
```

### 2. Start Backend & Collaboration Server

```bash
cd server
npm run dev
```

- **Express REST API**: `http://localhost:4000`
- **Hocuspocus WebSocket Server**: `ws://localhost:1234`
- SQLite database initializes automatically with seeded demo data at `server/data/ajaia.db`.

### 3. Start Frontend

```bash
cd client
npm run dev
```

- Open **`http://localhost:5173`** in your browser.

---

## Seeded Test Accounts

All demo accounts share the password: **`password123`**

| Name | Email | Role in Demo |
|------|-------|--------------|
| **Alice Chen** | `alice@ajaia.com` | Document owner of "Q4 planning", "Launch checklist", "Meeting notes" |
| **Bob Kim** | `bob@ajaia.com` | Collaborator with `edit` permission on "Q4 planning"; owner of "Onboarding notes" |
| **Carol Davis** | `carol@ajaia.com` | Collaborator with `view` permission on "Q4 planning"; owner of "Customer interview notes" |

### How to Test Collaboration Locally

1. Open `http://localhost:5173` in a standard browser window and log in as **Alice**.
2. Open `http://localhost:5173` in an incognito window and log in as **Bob**.
3. In both windows, open the shared document **"Q4 planning"**.
4. Type in either window — see keystrokes and colored cursor flags synchronize in real time!
5. For step-by-step scenarios, see [TESTING_GUIDE.md](file:///Users/lucky./VISUAL_PROJECTS/aajia%20testfte/TESTING_GUIDE.md).

---

## Running the Automated Test Suite

```bash
# Run all 28 integration tests
npm test
```

Test coverage includes:
- **Authentication**: Valid login, bad password rejections, token verification.
- **Document CRUD**: Creation, ownership verification, access restrictions (403).
- **Sharing Lifecycle**: Granting access, permission upgrades (`view` → `edit`), and revocation.
- **Real-Time Collaboration**: Token authentication, legacy JSON migration to Yjs state, binary persistence in SQLite, and snapshot synchronization.

---

## Deployment to Render

This application includes built-in support for single-service cloud deployments on **Render** (as well as Railway or Fly.io).

### Step-by-Step Render Deployment:

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "feat: initial commit of Ajaia Docs collaborative editor"
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

2. **Create New Web Service in Render**:
   - Log into [render.com](https://render.com) and click **New +** → **Web Service**.
   - Select your GitHub repository.

3. **Configure the Service**:
   - **Name**: `ajaia-docs` (or your preferred name)
   - **Runtime**: `Node`
   - **Branch**: `main`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (or `Starter`)

4. **Environment Variables**:
   Add the following in Render's Environment Variables tab:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: `generate-a-secure-random-key`
   - `PORT`: `10000` (Render defaults to 10000 or dynamically assigns `$PORT`)

5. **How It Works in Production**:
   - `npm run build` installs dependencies and compiles the React application into `client/dist`.
   - `npm start` starts the Express server. In production, Express automatically serves the static frontend from `client/dist` and proxies incoming WebSocket upgrade requests on `$PORT` to Hocuspocus.
   - The client detects production HTTPS/WSS automatically (`wss://${window.location.host}`), requiring zero extra port configuration.

---

## Project Structure

```
aajia-docs/
├── client/                     # Frontend React + Vite application
│   ├── src/
│   │   ├── components/         # Dashboard, DocumentEditor, RichTextEditor, ShareModal, UploadModal
│   │   ├── contexts/           # AuthContext, ToastContext
│   │   ├── extensions/         # Custom TipTap extensions (FontSize)
│   │   ├── api.js              # Axios API client with interceptors
│   │   ├── App.jsx             # React router and route protection
│   │   └── index.css           # Design tokens, typography, and layout styles
│   ├── package.json
│   └── vite.config.js
│
├── server/                     # Backend Node.js / Express application
│   ├── src/
│   │   ├── collaboration-server.js  # Hocuspocus WebSocket collaboration server & Yjs persistence
│   │   ├── db.js                    # SQLite database schema, migrations, and seed data
│   │   ├── index.js                 # Express server, route mounting, single-port WS upgrade
│   │   ├── middleware/              # JWT authentication middleware
│   │   └── routes/                  # Auth, Documents, Sharing, and Upload routes
│   ├── tests/
│   │   ├── api.test.js              # REST API integration tests
│   │   └── collaboration.test.js    # WebSocket & CRDT persistence tests
│   └── package.json
│
├── ARCHITECTURE.md             # Detailed architectural specification & design tradeoffs
├── SUBMISSION.md               # Assessment checklist, feature matrix, and credentials
├── TESTING_GUIDE.md            # Step-by-step multi-user testing scenarios
├── render.yaml                 # Render Blueprint configuration
├── package.json                # Root package.json with unified build/start/test scripts
└── README.md
```

---

## Documentation

- [System Architecture & Design Decisions](file:///Users/lucky./VISUAL_PROJECTS/aajia%20testfte/ARCHITECTURE.md)
- [Testing & Collaboration Scenarios](file:///Users/lucky./VISUAL_PROJECTS/aajia%20testfte/TESTING_GUIDE.md)
- [Project Submission Overview](file:///Users/lucky./VISUAL_PROJECTS/aajia%20testfte/SUBMISSION.md)
