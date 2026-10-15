const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Set up test DB path before requiring app
process.env.NODE_ENV = 'test';

// Override DB path for tests
jest.mock('../src/db', () => {
  const Database = require('better-sqlite3');
  const bcrypt = require('bcryptjs');
  const testDbPath = ':memory:';
  let db;

  function getDB() {
    if (!db) {
      db = new Database(testDbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
    }
    return db;
  }

  function initDB() {
    const database = getDB();

    database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_color TEXT NOT NULL DEFAULT '#6366f1',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'Untitled Document',
        content TEXT NOT NULL DEFAULT '',
        owner_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      );
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

    const hash = bcrypt.hashSync('password123', 10);
    database.prepare('INSERT OR IGNORE INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)').run('user-alice', 'alice@ajaia.com', 'Alice Chen', hash);
    database.prepare('INSERT OR IGNORE INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)').run('user-bob', 'bob@ajaia.com', 'Bob Kim', hash);
  }

  return { getDB, initDB };
});

const app = require('../src/index');
const { initDB } = require('../src/db');

let aliceToken;
let bobToken;
let testDocId;

beforeAll(() => {
  initDB();
});

describe('Auth Routes', () => {
  test('POST /api/auth/login — valid credentials return token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@ajaia.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.name).toBe('Alice Chen');
    aliceToken = res.body.token;
  });

  test('POST /api/auth/login — invalid password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@ajaia.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login — missing fields returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@ajaia.com' });
    expect(res.status).toBe(400);
  });

  test('GET /api/auth/users — returns list of users', async () => {
    const res = await request(app).get('/api/auth/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Document Routes', () => {
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@ajaia.com', password: 'password123' });
    bobToken = res.body.token;
  });

  test('GET /api/documents — requires auth', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(401);
  });

  test('POST /api/documents — create document', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Test Document', content: '{"type":"doc","content":[]}' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Test Document');
    expect(res.body.role).toBe(undefined); // newly created doesn't have role
    testDocId = res.body.id;
  });

  test('GET /api/documents — owner sees their document', async () => {
    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.owned.some(d => d.id === testDocId)).toBe(true);
  });

  test('GET /api/documents/:id — owner can fetch', async () => {
    const res = await request(app)
      .get(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Test Document');
    expect(res.body.role).toBe('owner');
  });

  test('GET /api/documents/:id — non-shared user gets 403', async () => {
    const res = await request(app)
      .get(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(403);
  });

  test('PUT /api/documents/:id — owner can update', async () => {
    const res = await request(app)
      .put(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title');
  });

  test('PUT /api/documents/:id — non-owner without share gets 403', async () => {
    const res = await request(app)
      .put(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ title: 'Hacked Title' });

    expect(res.status).toBe(403);
  });
});

describe('Sharing Routes', () => {
  test('POST /api/shares/:documentId — owner can share with view permission', async () => {
    const res = await request(app)
      .post(`/api/shares/${testDocId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ userId: 'user-bob', permission: 'view' });

    expect(res.status).toBe(201);
    expect(res.body.permission).toBe('view');
    expect(res.body.name).toBe('Bob Kim');
  });

  test('GET /api/documents/:id — shared user can now access', async () => {
    const res = await request(app)
      .get(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('view');
  });

  test('GET /api/documents — shared doc appears in bobs shared list', async () => {
    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shared.some(d => d.id === testDocId)).toBe(true);
  });

  test('PUT /api/documents/:id — view-only user cannot edit', async () => {
    const res = await request(app)
      .put(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ title: 'Should Fail' });

    expect(res.status).toBe(403);
  });

  test('POST /api/shares/:documentId — upgrade to edit permission', async () => {
    const res = await request(app)
      .post(`/api/shares/${testDocId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ userId: 'user-bob', permission: 'edit' });

    expect(res.status).toBe(201);
    expect(res.body.permission).toBe('edit');
  });

  test('PUT /api/documents/:id — editor can now update', async () => {
    const res = await request(app)
      .put(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ title: 'Bob Edited This' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Bob Edited This');
  });

  test('DELETE /api/shares/:documentId/:userId — owner can revoke access', async () => {
    const res = await request(app)
      .delete(`/api/shares/${testDocId}/user-bob`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
  });

  test('GET /api/documents/:id — revoked user gets 403 again', async () => {
    const res = await request(app)
      .get(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(403);
  });

  test('DELETE /api/documents/:id — owner can delete', async () => {
    const res = await request(app)
      .delete(`/api/documents/${testDocId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
  });
});
