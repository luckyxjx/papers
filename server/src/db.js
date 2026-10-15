const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'ajaia.db');

let db;

function getDB() {
  if (!db) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDB() {
  const database = getDB();

  // Users table
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Documents table
  database.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled Document',
      content TEXT NOT NULL DEFAULT '',
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Shares table
  database.exec(`
    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      shared_with_id TEXT NOT NULL,
      permission TEXT NOT NULL DEFAULT 'view',
      shared_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(document_id, shared_with_id),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (shared_with_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Attachments table
  database.exec(`
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );
  `);

  // Collaborative documents table for Yjs binary updates
  database.exec(`
    CREATE TABLE IF NOT EXISTS collaborative_documents (
      document_id TEXT PRIMARY KEY,
      state BLOB NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );
  `);

  // Seed users
  seedUsers(database);

  console.log('✅ Database initialized');
}

function seedUsers(database) {
  const users = [
    { id: 'user-alice', email: 'alice@ajaia.com', name: 'Alice Chen', color: '#6366f1' },
    { id: 'user-bob', email: 'bob@ajaia.com', name: 'Bob Kim', color: '#10b981' },
    { id: 'user-carol', email: 'carol@ajaia.com', name: 'Carol Davis', color: '#f59e0b' },
  ];

  const insertUser = database.prepare(
    'INSERT OR IGNORE INTO users (id, email, name, password_hash, avatar_color) VALUES (?, ?, ?, ?, ?)'
  );
  const defaultPassword = bcrypt.hashSync('password123', 10);
  for (const u of users) {
    insertUser.run(u.id, u.email, u.name, defaultPassword, u.color);
  }

  // Seed sample documents matching mockups if not present
  const existingDocs = database.prepare('SELECT COUNT(*) as count FROM documents WHERE id = ?').get('doc-q4');
  if (existingDocs.count > 0) return;

  const docInsert = database.prepare(
    `INSERT OR REPLACE INTO documents (id, title, content, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const q4Content = JSON.stringify({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Q4 planning' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Draft priorities for the quarter. Comments and edits welcome from everyone with access.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Goals' }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ship the document editor to the internal team' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cut review turnaround time' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Collect feedback after two weeks' }] }] },
      ]},
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Next steps' }] },
      { type: 'orderedList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Confirm owners for each goal' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Schedule a mid-quarter check-in' }] }] },
      ]},
    ],
  });

  const onboardingContent = JSON.stringify({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Onboarding notes' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Key resources and setup steps for new engineering team members.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Getting Started' }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Clone repository and run npm install' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Review team conventions and PR workflow' }] }] },
      ]},
    ],
  });

  const launchContent = JSON.stringify({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Launch checklist' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Pre-flight items before opening internal beta release.' }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Verify document export & import workflows' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Confirm permission enforcement across viewers and editors' }] }] },
      ]},
    ],
  });

  const interviewContent = JSON.stringify({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Customer interview notes' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Synthesis from conversations with initial pilot participants.' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Key Takeaways' }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fast load time and clean aesthetic are praised.' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Requested offline support and export capabilities.' }] }] },
      ]},
    ],
  });

  const meetingContent = JSON.stringify({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Meeting notes' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Weekly sync with core design and engineering leads.' }] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Reviewed design tokens and typography hierarchy' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Aligned on roadmap and milestone timelines' }] }] },
      ]},
    ],
  });

  const now = new Date();
  const twoMinAgo = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const oct12 = new Date('2026-10-12T14:30:00Z').toISOString();
  const oct9 = new Date('2026-10-09T11:00:00Z').toISOString();
  const oct3 = new Date('2026-10-03T09:15:00Z').toISOString();

  docInsert.run('doc-q4', 'Q4 planning', q4Content, 'user-alice', twoMinAgo, twoMinAgo);
  docInsert.run('doc-onboarding', 'Onboarding notes', onboardingContent, 'user-bob', yesterday, yesterday);
  docInsert.run('doc-launch', 'Launch checklist', launchContent, 'user-alice', oct12, oct12);
  docInsert.run('doc-interview', 'Customer interview notes', interviewContent, 'user-carol', oct9, oct9);
  docInsert.run('doc-meeting', 'Meeting notes', meetingContent, 'user-alice', oct3, oct3);

  // Shares matching the mockup
  const shareInsert = database.prepare(
    `INSERT OR IGNORE INTO shares (id, document_id, shared_with_id, permission, shared_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  // Q4 planning shared with Bob (Editor) and Carol (Viewer)
  shareInsert.run('share-q4-bob', 'doc-q4', 'user-bob', 'edit', twoMinAgo);
  shareInsert.run('share-q4-carol', 'doc-q4', 'user-carol', 'view', twoMinAgo);

  // Onboarding notes (Bob) shared with Alice as Editor
  shareInsert.run('share-onboarding-alice', 'doc-onboarding', 'user-alice', 'edit', yesterday);

  // Customer interview notes (Carol) shared with Alice as Viewer
  shareInsert.run('share-interview-alice', 'doc-interview', 'user-alice', 'view', oct9);

  console.log('🌱 Seeded sample documents and permissions matching mockups');
}

module.exports = { getDB, initDB };
