const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const SUPPORTED_TYPES = ['.txt', '.md', '.docx'];

// POST /api/upload/document — upload and convert file to document
router.post('/document', authenticate, async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const file = req.files.file;
  const ext = path.extname(file.name).toLowerCase();

  if (!SUPPORTED_TYPES.includes(ext)) {
    return res.status(400).json({
      error: `Unsupported file type. Supported types: ${SUPPORTED_TYPES.join(', ')}`,
    });
  }

  try {
    let content = '';
    let htmlContent = '';

    if (ext === '.txt') {
      const text = file.data.toString('utf-8');
      // Convert plain text to TipTap JSON
      const paragraphs = text.split(/\n\n+/).map(para => ({
        type: 'paragraph',
        content: [{ type: 'text', text: para.trim() }],
      })).filter(p => p.content[0].text.length > 0);

      content = JSON.stringify({
        type: 'doc',
        content: paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph', content: [] }],
      });
    } else if (ext === '.md') {
      const text = file.data.toString('utf-8');
      // Convert markdown to basic paragraphs
      const lines = text.split('\n');
      const nodes = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('# ')) {
          nodes.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: trimmed.slice(2) }] });
        } else if (trimmed.startsWith('## ')) {
          nodes.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: trimmed.slice(3) }] });
        } else if (trimmed.startsWith('### ')) {
          nodes.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: trimmed.slice(4) }] });
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          nodes.push({ type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: trimmed.slice(2) }] }] }
          ]});
        } else {
          nodes.push({ type: 'paragraph', content: [{ type: 'text', text: trimmed }] });
        }
      }

      content = JSON.stringify({
        type: 'doc',
        content: nodes.length > 0 ? nodes : [{ type: 'paragraph', content: [] }],
      });
    } else if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.convertToHtml({ buffer: file.data });
      htmlContent = result.value;
      // Store HTML string — frontend will handle import
      content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '(Imported from .docx)' }] }], _htmlImport: htmlContent });
    }

    // Create the document
    const db = getDB();
    const docId = uuidv4();
    const title = path.basename(file.name, ext);

    db.prepare(`
      INSERT INTO documents (id, title, content, owner_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(docId, title, content, req.user.id);

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);

    res.status(201).json({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      ownerId: doc.owner_id,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// POST /api/upload/attachment/:documentId — attach file to a document
router.post('/attachment/:documentId', authenticate, (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const { documentId } = req.params;
  const db = getDB();

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const isOwner = doc.owner_id === req.user.id;
  const share = db.prepare("SELECT * FROM shares WHERE document_id = ? AND shared_with_id = ? AND permission = 'edit'").get(documentId, req.user.id);
  if (!isOwner && !share) return res.status(403).json({ error: 'Write access denied' });

  const file = req.files.file;
  const attachId = uuidv4();
  const ext = path.extname(file.name);
  const filename = `${attachId}${ext}`;
  const savePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  file.mv(savePath, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to save file' });

    db.prepare(`
      INSERT INTO attachments (id, document_id, filename, original_name, mime_type, size)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(attachId, documentId, filename, file.name, file.mimetype, file.size);

    res.status(201).json({
      id: attachId,
      filename,
      originalName: file.name,
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/${filename}`,
    });
  });
});

// DELETE /api/upload/attachment/:documentId/:attachmentId — delete an attachment
router.delete('/attachment/:documentId/:attachmentId', authenticate, (req, res) => {
  const { documentId, attachmentId } = req.params;
  const db = getDB();

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const isOwner = doc.owner_id === req.user.id;
  const share = db.prepare("SELECT * FROM shares WHERE document_id = ? AND shared_with_id = ? AND permission = 'edit'").get(documentId, req.user.id);
  if (!isOwner && !share) return res.status(403).json({ error: 'Write access denied' });

  const att = db.prepare('SELECT * FROM attachments WHERE id = ? AND document_id = ?').get(attachmentId, documentId);
  if (!att) return res.status(404).json({ error: 'Attachment not found' });

  // Delete file from disk if exists
  const filePath = path.join(UPLOADS_DIR, att.filename);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (e) { console.error('Unlink error:', e); }
  }

  // Delete from database
  db.prepare('DELETE FROM attachments WHERE id = ?').run(attachmentId);

  res.json({ message: 'Attachment deleted', id: attachmentId });
});

module.exports = router;
