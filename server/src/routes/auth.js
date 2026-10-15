const express = require('express');
const bcrypt = require('bcryptjs');
const { getDB } = require('../db');
const { signToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken({ id: user.id, email: user.email, name: user.name });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarColor: user.avatar_color,
    },
  });
});

// GET /api/auth/users — list all users (for sharing UI)
router.get('/users', (req, res) => {
  const db = getDB();
  const users = db.prepare('SELECT id, email, name, avatar_color FROM users').all();
  res.json(users.map(u => ({ id: u.id, email: u.email, name: u.name, avatarColor: u.avatar_color })));
});

module.exports = router;
