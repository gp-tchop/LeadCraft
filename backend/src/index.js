require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');
const uploadRoutes = require('./routes/upload');
const jobRoutes = require('./routes/jobs');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure upload/output directories exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const outputDir = path.join(__dirname, '..', 'output');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// API Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/jobs', jobRoutes);

// Serve output files for download
app.use('/api/download', express.static(outputDir));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static frontend (built Next.js export)
const frontendDir = path.join(__dirname, '..', '..', 'frontend', 'out');
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  app.get('*', (req, res) => {
    const indexPath = path.join(frontendDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Not found');
    }
  });
}

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`LeadCraft running on port ${PORT}`);
});
