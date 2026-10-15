const Y = require('yjs');
const { getDB, initDB } = require('../src/db');
const { signToken } = require('../src/middleware/auth');
const {
  verifyUserAndDocumentAccess,
  loadYjsState,
  saveYjsState
} = require('../src/collaboration-server');
const { yDocToProsemirrorJSON } = require('y-prosemirror');

describe('Real-Time Collaboration & Persistence', () => {
  let db;
  let aliceToken;
  let bobToken;
  let carolToken;
  const testDocId = 'doc-collab-test';

  beforeAll(() => {
    initDB();
    db = getDB();

    aliceToken = signToken({ id: 'user-alice', name: 'Alice Chen', email: 'alice@example.com' });
    bobToken = signToken({ id: 'user-bob', name: 'Bob Kim', email: 'bob@example.com' });
    carolToken = signToken({ id: 'user-carol', name: 'Carol Davis', email: 'carol@example.com' });

    // Clean up any existing test doc
    db.prepare('DELETE FROM documents WHERE id = ?').run(testDocId);
    db.prepare('DELETE FROM shares WHERE document_id = ?').run(testDocId);
    db.prepare('DELETE FROM collaborative_documents WHERE document_id = ?').run(testDocId);

    // Create a test doc owned by Alice
    const initialContent = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Initial Collaborative Plan' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'This is paragraph one from legacy DB.' }]
        }
      ]
    });

    db.prepare(`
      INSERT INTO documents (id, title, content, owner_id)
      VALUES (?, ?, ?, ?)
    `).run(testDocId, 'Collab Test Document', initialContent, 'user-alice');

    // Share with Bob (edit)
    db.prepare(`
      INSERT INTO shares (id, document_id, shared_with_id, permission)
      VALUES (?, ?, ?, ?)
    `).run('share-collab-bob', testDocId, 'user-bob', 'edit');
  });

  afterAll(() => {
    db.prepare('DELETE FROM documents WHERE id = ?').run(testDocId);
    db.prepare('DELETE FROM shares WHERE document_id = ?').run(testDocId);
    db.prepare('DELETE FROM collaborative_documents WHERE document_id = ?').run(testDocId);
  });

  describe('Authentication & Access Control', () => {
    test('Owner (Alice) is authorized to connect', async () => {
      const user = await verifyUserAndDocumentAccess(aliceToken, `document.${testDocId}`);
      expect(user).toBeTruthy();
      expect(user.id).toBe('user-alice');
      expect(user.permission).toBe('owner');
      expect(user.isReadOnly).toBe(false);
    });

    test('Shared collaborator with edit permission (Bob) is authorized', async () => {
      const user = await verifyUserAndDocumentAccess(bobToken, `document.${testDocId}`);
      expect(user).toBeTruthy();
      expect(user.id).toBe('user-bob');
      expect(user.permission).toBe('edit');
      expect(user.isReadOnly).toBe(false);
    });

    test('Unshared user (Carol) fails closed and is rejected', async () => {
      const user = await verifyUserAndDocumentAccess(carolToken, `document.${testDocId}`);
      expect(user).toBeNull();
    });

    test('Invalid or missing token fails closed', async () => {
      const noToken = await verifyUserAndDocumentAccess(null, `document.${testDocId}`);
      expect(noToken).toBeNull();

      const badToken = await verifyUserAndDocumentAccess('invalid-token', `document.${testDocId}`);
      expect(badToken).toBeNull();
    });
  });

  describe('Document Migration to Yjs State', () => {
    test('Migrates existing document JSON to Yjs binary state with default fragment', async () => {
      // First load should migrate
      const binary = await loadYjsState(`document.${testDocId}`);
      expect(binary).toBeTruthy();
      expect(binary instanceof Uint8Array).toBe(true);

      // Verify row was inserted into collaborative_documents
      const row = db.prepare('SELECT * FROM collaborative_documents WHERE document_id = ?').get(testDocId);
      expect(row).toBeTruthy();
      expect(row.state).toBeTruthy();

      // Check that decoding the binary contains the 'default' fragment and original text
      const loadedDoc = new Y.Doc();
      Y.applyUpdate(loadedDoc, binary);
      const json = yDocToProsemirrorJSON(loadedDoc, 'default');
      expect(json.content[0].content[0].text).toBe('Initial Collaborative Plan');
      expect(json.content[1].content[0].text).toBe('This is paragraph one from legacy DB.');
    });

    test('Subsequent loads return persisted state directly from collaborative_documents table', async () => {
      const binary = await loadYjsState(`document.${testDocId}`);
      expect(binary).toBeTruthy();
    });
  });

  describe('Document Updates, Merging, and Persistence', () => {
    test('Saves Yjs binary state and updates compatibility snapshot in documents table', async () => {
      // Simulate live edits on the Yjs document
      const loadedDoc = new Y.Doc();
      const binary = await loadYjsState(`document.${testDocId}`);
      Y.applyUpdate(loadedDoc, binary);

      // Alice adds a second paragraph
      const xmlFrag = loadedDoc.getXmlFragment('default');
      // Create new paragraph element via Y.XmlText
      const p = new Y.XmlElement('paragraph');
      const text = new Y.XmlText();
      text.insert(0, 'Added concurrently during collaboration session.');
      p.insert(0, [text]);
      xmlFrag.push([p]);

      const updatedBinary = Y.encodeStateAsUpdate(loadedDoc);
      await saveYjsState(`document.${testDocId}`, updatedBinary, loadedDoc);

      // Verify collaborative_documents has updated state
      const row = db.prepare('SELECT state FROM collaborative_documents WHERE document_id = ?').get(testDocId);
      expect(row.state).toBeTruthy();

      // Verify documents.content snapshot is kept in sync
      const docRecord = db.prepare('SELECT content FROM documents WHERE id = ?').get(testDocId);
      const parsedSnapshot = JSON.parse(docRecord.content);
      expect(parsedSnapshot.content.length).toBe(3);
      expect(parsedSnapshot.content[2].content[0].text).toBe('Added concurrently during collaboration session.');
    });

    test('Restarting or reloading preserves all edits without data loss', async () => {
      // Load fresh state as if server restarted
      const reloadedBinary = await loadYjsState(`document.${testDocId}`);
      const freshDoc = new Y.Doc();
      Y.applyUpdate(freshDoc, reloadedBinary);

      const json = yDocToProsemirrorJSON(freshDoc, 'default');
      expect(json.content.length).toBe(3);
      expect(json.content[2].content[0].text).toBe('Added concurrently during collaboration session.');
    });
  });
});
