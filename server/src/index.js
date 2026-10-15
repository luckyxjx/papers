const express = require('express');
const cors = require('cors');
const path = require('path');
const fileUpload = require('express-fileupload');
const { initDB } = require('./db');

const authRoutes = require('./routes/auth');
const docRoutes = require('./routes/documents');
const shareRoutes = require('./routes/sharing');
const uploadRoutes = require('./routes/upload');

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  abortOnLimit: true,
  createParentPath: true,
}));

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', docRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const fs = require('fs');
const http = require('http');

// Serve client dist in production if built
const clientDist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  initDB();
  const { server: collabServer } = require('./collaboration-server');

  // Start standalone collab server if COLLAB_PORT is explicitly specified or in dev
  collabServer.listen().catch(err => console.error('Collab server error:', err.message));

  const httpServer = http.createServer(app);

  // Enable single-port cloud deployment (Render, Railway, Koyeb) by forwarding WebSocket upgrades
  httpServer.on('upgrade', (request, socket, head) => {
    if (collabServer.crossws && typeof collabServer.crossws.handleUpgrade === 'function') {
      collabServer.crossws.handleUpgrade(request, socket, head);
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Ajaia Docs server running on http://localhost:${PORT}`);
  });
}

module.exports = app;

