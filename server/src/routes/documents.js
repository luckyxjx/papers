const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/documents — get all docs visible to current user
router.get('/', authenticate, (req, res) => {
  const db = getDB();
  const userId = req.user.id;

  // Owned documents
  const owned = db.prepare(`
    SELECT d.*, 'owner' as role, u.name as owner_name, u.avatar_color as owner_avatar_color
    FROM documents d
    JOIN users u ON u.id = d.owner_id
    WHERE d.owner_id = ?
    ORDER BY d.updated_at DESC
  `).all(userId);

  // Shared documents
  const shared = db.prepare(`
    SELECT d.*, s.permission as role, u.name as owner_name, u.avatar_color as owner_avatar_color
    FROM documents d
    JOIN shares s ON s.document_id = d.id AND s.shared_with_id = ?
    JOIN users u ON u.id = d.owner_id
    ORDER BY d.updated_at DESC
  `).all(userId);

  res.json({
    owned: owned.map(formatDoc),
    shared: shared.map(formatDoc),
  });
});

// POST /api/documents — create new document
router.post('/', authenticate, (req, res) => {
  const db = getDB();
  const id = uuidv4();
  const { title = 'Untitled Document', content = '' } = req.body;

  db.prepare(`
    INSERT INTO documents (id, title, content, owner_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(id, title, content, req.user.id);

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  res.status(201).json(formatDoc(doc));
});

// GET /api/documents/:id — get single document
router.get('/:id', authenticate, (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const userId = req.user.id;

  const doc = db.prepare(`
    SELECT d.*, u.name as owner_name, u.avatar_color as owner_avatar_color
    FROM documents d
    JOIN users u ON u.id = d.owner_id
    WHERE d.id = ?
  `).get(id);

  if (!doc) return res.status(404).json({ error: 'Document not found' });

  // Check access
  const isOwner = doc.owner_id === userId;
  const share = db.prepare('SELECT * FROM shares WHERE document_id = ? AND shared_with_id = ?').get(id, userId);

  if (!isOwner && !share) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Get attachments
  const attachments = db.prepare('SELECT * FROM attachments WHERE document_id = ? ORDER BY uploaded_at DESC').all(id);

  // Get shares (only for owner)
  let shares = [];
  if (isOwner) {
    shares = db.prepare(`
      SELECT s.*, u.name, u.email, u.avatar_color
      FROM shares s
      JOIN users u ON u.id = s.shared_with_id
      WHERE s.document_id = ?
    `).all(id);
  }

  res.json({
    ...formatDoc(doc),
    role: isOwner ? 'owner' : share.permission,
    attachments: attachments.map(a => ({
      id: a.id,
      filename: a.filename,
      originalName: a.original_name,
      mimeType: a.mime_type,
      size: a.size,
      uploadedAt: a.uploaded_at,
      url: `/uploads/${a.filename}`,
    })),
    shares: shares.map(s => ({
      id: s.id,
      userId: s.shared_with_id,
      name: s.name,
      email: s.email,
      avatarColor: s.avatar_color,
      permission: s.permission,
      sharedAt: s.shared_at,
    })),
  });
});

// PUT /api/documents/:id — update document
router.put('/:id', authenticate, (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const userId = req.user.id;

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  // Check write access
  const isOwner = doc.owner_id === userId;
  const share = db.prepare("SELECT * FROM shares WHERE document_id = ? AND shared_with_id = ? AND permission = 'edit'").get(id, userId);

  if (!isOwner && !share) {
    return res.status(403).json({ error: 'Write access denied' });
  }

  const { title, content } = req.body;
  const updates = [];
  const values = [];

  if (title !== undefined) { updates.push('title = ?'); values.push(title); }
  if (content !== undefined) { updates.push('content = ?'); values.push(content); }
  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  res.json(formatDoc(updated));
});

// DELETE /api/documents/:id
router.delete('/:id', authenticate, (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const userId = req.user.id;

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.owner_id !== userId) return res.status(403).json({ error: 'Only the owner can delete this document' });

  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  res.json({ success: true });
});

function formatDoc(doc) {
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    ownerId: doc.owner_id,
    ownerName: doc.owner_name,
    ownerAvatarColor: doc.owner_avatar_color,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    role: doc.role,
  };
}

module.exports = router;
