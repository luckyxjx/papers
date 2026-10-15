const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/shares/:documentId — share a document with a user
router.post('/:documentId', authenticate, (req, res) => {
  const db = getDB();
  const { documentId } = req.params;
  const { userId, permission = 'view' } = req.body;

  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (!['view', 'edit'].includes(permission)) {
    return res.status(400).json({ error: 'Permission must be "view" or "edit"' });
  }

  // Only owner can share
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the document owner can share it' });
  }

  // Can't share with yourself
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Cannot share with yourself' });
  }

  // Check target user exists
  const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  // Upsert share
  const existing = db.prepare('SELECT * FROM shares WHERE document_id = ? AND shared_with_id = ?').get(documentId, userId);

  if (existing) {
    db.prepare('UPDATE shares SET permission = ? WHERE document_id = ? AND shared_with_id = ?')
      .run(permission, documentId, userId);
  } else {
    db.prepare('INSERT INTO shares (id, document_id, shared_with_id, permission) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), documentId, userId, permission);
  }

  const share = db.prepare(`
    SELECT s.*, u.name, u.email, u.avatar_color
    FROM shares s
    JOIN users u ON u.id = s.shared_with_id
    WHERE s.document_id = ? AND s.shared_with_id = ?
  `).get(documentId, userId);

  res.status(201).json({
    id: share.id,
    userId: share.shared_with_id,
    name: share.name,
    email: share.email,
    avatarColor: share.avatar_color,
    permission: share.permission,
    sharedAt: share.shared_at,
  });
});

// DELETE /api/shares/:documentId/:userId — revoke access
router.delete('/:documentId/:userId', authenticate, (req, res) => {
  const db = getDB();
  const { documentId, userId } = req.params;

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the document owner can revoke access' });
  }

  db.prepare('DELETE FROM shares WHERE document_id = ? AND shared_with_id = ?').run(documentId, userId);
  res.json({ success: true });
});

module.exports = router;
