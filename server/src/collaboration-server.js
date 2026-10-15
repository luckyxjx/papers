const { Server } = require('@hocuspocus/server');
const Y = require('yjs');
const { getSchema } = require('@tiptap/core');
const StarterKit = require('@tiptap/starter-kit').default;
const Image = require('@tiptap/extension-image').default;
const Link = require('@tiptap/extension-link').default;
const Underline = require('@tiptap/extension-underline').default;
const { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } = require('y-prosemirror');
const { getDB } = require('./db');
const { verifyToken } = require('./middleware/auth');

// TipTap schema used to convert legacy TipTap JSON <-> Y.Doc
const schema = getSchema([StarterKit, Image, Link, Underline]);

const PORT = parseInt(process.env.COLLAB_PORT || '1234', 10);

// Debounce saves to avoid excessive database writes
const saveDebounceTimers = new Map();
const SAVE_DEBOUNCE_MS = 2000; // Save after 2 seconds of inactivity

function getDocId(documentName) {
  return documentName ? documentName.replace(/^document\./, '') : '';
}

// 1. Verify user token and document permissions
async function verifyUserAndDocumentAccess(token, documentName) {
  if (!token) return null;
  const docId = getDocId(documentName);
  if (!docId) return null;

  try {
    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) return null;

    const db = getDB();
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    if (!doc) return null;

    const isOwner = doc.owner_id === decoded.id;
    const share = db.prepare(
      'SELECT * FROM shares WHERE document_id = ? AND shared_with_id = ?'
    ).get(docId, decoded.id);

    if (!isOwner && !share) {
      return null;
    }

    // Fetch user details for presence cursor
    const userRow = db.prepare('SELECT id, name, email, avatar_color FROM users WHERE id = ?').get(decoded.id);

    return {
      id: decoded.id,
      name: userRow?.name || decoded.name || 'Anonymous',
      email: userRow?.email || decoded.email,
      color: userRow?.avatar_color || '#6366f1',
      permission: isOwner ? 'owner' : share.permission,
      isReadOnly: !isOwner && share.permission === 'view',
    };
  } catch (err) {
    console.error('Collab auth error:', err.message);
    return null;
  }
}

// 2. Load Yjs binary state from collaborative_documents table, or migrate existing content
async function loadYjsState(documentName) {
  const docId = getDocId(documentName);
  if (!docId) return null;

  const db = getDB();

  // Check if we already have collaborative Yjs state saved
  const row = db.prepare('SELECT state FROM collaborative_documents WHERE document_id = ?').get(docId);
  if (row && row.state) {
    return new Uint8Array(row.state);
  }

  // If no Yjs state exists yet, migrate from existing documents.content
  const doc = db.prepare('SELECT content FROM documents WHERE id = ?').get(docId);
  if (doc && doc.content) {
    try {
      const json = JSON.parse(doc.content);
      if (json && (json.content || json.type === 'doc')) {
        const initialYDoc = prosemirrorJSONToYDoc(schema, json, 'default');
        const binaryState = Y.encodeStateAsUpdate(initialYDoc);

        // Store initial state into collaborative_documents
        db.prepare(`
          INSERT OR REPLACE INTO collaborative_documents (document_id, state, updated_at)
          VALUES (?, ?, datetime('now'))
        `).run(docId, Buffer.from(binaryState));

        console.log(`✨ Migrated document "${docId}" to initial collaborative Yjs state`);
        return binaryState;
      }
    } catch (e) {
      console.warn(`Could not parse JSON content for doc "${docId}", starting with empty state:`, e.message);
    }
  }

  return null;
}

// 3. Persist Yjs binary state and sync snapshot to documents table (debounced)
async function saveYjsState(documentName, binaryState, ydoc, immediate = false) {
  const docId = getDocId(documentName);
  if (!docId) return;

  // Clear any existing timer
  if (saveDebounceTimers.has(docId)) {
    clearTimeout(saveDebounceTimers.get(docId));
  }

  if (immediate || process.env.NODE_ENV === 'test') {
    performSave(docId, binaryState, ydoc);
    return;
  }

  // Set new debounced save
  const timer = setTimeout(() => {
    saveDebounceTimers.delete(docId);
    performSave(docId, binaryState, ydoc);
  }, SAVE_DEBOUNCE_MS);

  saveDebounceTimers.set(docId, timer);
}

// Actual database save operation
function performSave(docId, binaryState, ydoc) {
  const db = getDB();

  try {
    // 1. Save authoritative binary state in collaborative_documents
    db.prepare(`
      INSERT INTO collaborative_documents (document_id, state, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(document_id) DO UPDATE SET
        state = excluded.state,
        updated_at = excluded.updated_at
    `).run(docId, Buffer.from(binaryState));

    // 2. Update compatibility JSON snapshot in documents.content so search, export, and API lists stay in sync
    if (ydoc) {
      try {
        const json = yDocToProsemirrorJSON(ydoc, 'default');
        if (json) {
          db.prepare(`
            UPDATE documents
            SET content = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(JSON.stringify(json), docId);
        }
      } catch (err) {
        console.warn(`Snapshot conversion error for doc ${docId}:`, err.message);
      }
    }
    
    console.log(`💾 Saved collaborative state for document: ${docId}`);
  } catch (err) {
    console.error(`Save error for doc ${docId}:`, err.message);
  }
}

// Initialize Hocuspocus Server
const server = new Server({
  port: PORT,

  async onAuthenticate({ token, documentName }) {
    const user = await verifyUserAndDocumentAccess(token, documentName);
    if (!user) {
      throw new Error('Not authorized');
    }
    return { user };
  },

  async onLoadDocument({ documentName, document }) {
    const savedState = await loadYjsState(documentName);
    if (savedState) {
      Y.applyUpdate(document, savedState);
      console.log(`📄 Loaded collaborative document: ${getDocId(documentName)}`);
    }
    return document;
  },

  async onStoreDocument({ documentName, document }) {
    const savedState = Y.encodeStateAsUpdate(document);
    await saveYjsState(documentName, savedState, document);
  },

  // Also save when connection closes to ensure we don't lose data
  async onDisconnect({ documentName, document }) {
    const docId = getDocId(documentName);
    // Clear debounce timer and save immediately on disconnect
    if (saveDebounceTimers.has(docId)) {
      clearTimeout(saveDebounceTimers.get(docId));
      saveDebounceTimers.delete(docId);
    }
    const savedState = Y.encodeStateAsUpdate(document);
    performSave(docId, savedState, document);
  },

  async onListen() {
    console.log(`🤝 Ajaia Docs collaboration server listening on ws://localhost:${PORT}`);
  },
});

if (require.main === module) {
  server.listen();
}

module.exports = { server, verifyUserAndDocumentAccess, loadYjsState, saveYjsState, performSave };
