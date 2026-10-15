# Project Submission — Ajaia Docs

## Summary

A lightweight, real-time collaborative document editor inspired by Google Docs, built with **Node.js, Express, SQLite, TipTap (ProseMirror), Yjs CRDTs, and Hocuspocus WebSockets**.

---

## What's Included

| Item | Location |
|------|----------|
| Source code (backend) | [`server/`](file:///Users/lucky./VISUAL_PROJECTS/aajia%20testfte/server) |
| Source code (frontend) | [`client/`](file:///Users/lucky./VISUAL_PROJECTS/aajia%20testfte/client) |
| Architecture documentation | [`ARCHITECTURE.md`](file:///Users/lucky./VISUAL_PROJECTS/aajia%20testfte/ARCHITECTURE.md) |
| AI workflow note | [`AI_WORKFLOW.md`](file:///Users/lucky./VISUAL_PROJECTS/aajia%20testfte/AI_WORKFLOW.md) |
| Testing guide & scenarios | [`TESTING_GUIDE.md`](file:///Users/lucky./VISUAL_PROJECTS/aajia%20testfte/TESTING_GUIDE.md) |
| Deployment blueprint | [`render.yaml`](file:///Users/lucky./VISUAL_PROJECTS/aajia%20testfte/render.yaml) |
| Walkthrough video link | [`WALKTHROUGH.txt`](file:///Users/lucky./VISUAL_PROJECTS/aajia%20testfte/WALKTHROUGH.txt) |
| Readme & local setup | [`README.md`](file:///Users/lucky./VISUAL_PROJECTS/aajia%20testfte/README.md) |

---

## Feature Matrix

### ✅ Fully Implemented & Working

| Feature Area | Details |
|--------------|---------|
| **Real-time Collaboration** | Google Docs-style multi-user editing powered by Yjs CRDTs over WebSockets (Hocuspocus). Real-time presence indicators, collaborator cursor flags with user names and hex colors, and conflict-free concurrent editing. |
| **Authentication & Access Control** | JWT authentication with 3 seeded demo accounts. Strict access control on both REST API and WebSocket connection (`onAuthenticate` fails closed for unauthorized users). |
| **Rich Text Editor (TipTap)** | Clean, centered white sheet canvas on modern light workspace background. Floating centered formatting toolbar: Bold, Italic, Underline, Font Size selector (12px, 15px, 18px, 24px), Headings (H1, H2, H3), Bullet List, Numbered List, Undo, Redo, Alignment, Highlight, Strikethrough, Code, and Blockquote. |
| **Image & File Attachments** | Dedicated Attach dropdown menu: Embed image into document canvas from disk (`.png`, `.jpg`, `.gif`) or web URL; attach arbitrary files (`.pdf`, `.docx`, `.zip`) with inline clickable badge links in the document; download, open in new tab, or delete attachments. |
| **Document Sharing** | Share modal with user selector and granular permissions (`view` vs. `edit`). Real-time permission enforcement: view-only users see a read-only document without editing privileges. Revoke access immediately cuts permissions. |
| **Dashboard** | Modern header with user switcher avatar, "My documents" and "Shared with me" tabs, search filter, document creation, and document table with access badges, owners, and relative update timestamps. |
| **File Import** | Import `.txt`, `.md`, and `.docx` (via mammoth) into new formatted documents directly from the dashboard. |
| **Document Export** | Export any document as Markdown (`.md`) or trigger browser print / Save as PDF. |
| **Dual Persistence Engine** | Authoritative binary Yjs CRDT state stored in SQLite `collaborative_documents` table (`BLOB`). Automatic ProseMirror JSON compatibility snapshot kept in `documents.content` for search and API listings. |
| **Automated Testing** | 28 automated integration tests covering REST APIs (auth, CRUD, sharing) and WebSocket collaboration (authentication, migration, persistence, snapshot generation). |

---

## Demo Test Accounts

All accounts share the password: **`password123`**

| Name | Email | Role in Demo |
|------|-------|--------------|
| **Alice Chen** | `alice@ajaia.com` | Document owner of "Q4 planning", "Launch checklist", "Meeting notes" |
| **Bob Kim** | `bob@ajaia.com` | Collaborator with `edit` permission on "Q4 planning"; owner of "Onboarding notes" |
| **Carol Davis** | `carol@ajaia.com` | Collaborator with `view` permission on "Q4 planning"; owner of "Customer interview notes" |

---

## Quick Start (Local Development)

```bash
# 1. Install root, backend, and frontend dependencies
npm --prefix server install
npm --prefix client install

# 2. Start Backend & Collab Server (Terminal 1)
cd server && npm run dev
# -> Express running on http://localhost:4000
# -> Hocuspocus running on ws://localhost:1234

# 3. Start Frontend (Terminal 2)
cd client && npm run dev
# -> Vite running on http://localhost:5173

# 4. Run Automated Test Suite
npm test
# -> 28 / 28 tests passing
```

---

## Live Deployment URL

🔗 **Live Production URL**: [https://papers-gyp2.onrender.com](https://papers-gyp2.onrender.com)

---

## Cloud Deployment (Render)

This repository is deployed as a single web service on **Render**:

1. Push your repository to GitHub.
2. In Render, select **New → Web Service** and connect your GitHub repo.
3. Configure the service:
   - **Environment**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `NODE_ENV`: `production`
     - `JWT_SECRET`: `<any secure random string>`
4. Click **Deploy**.
   - Render automatically runs `npm run build` (building the React bundle into `client/dist` and installing server dependencies).
   - In production, Express serves the static frontend and reverse-proxies WebSocket upgrades on `$PORT` directly to Hocuspocus.
