require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const connectDB = require('./config/db');
// const { startCleanupScheduler } = require('./services/uploadCleanup');


const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;
connectDB();

// ----------------------------------------- Middleware ------------------------------------------------------
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()) : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

// Gzip compression — skip binary uploads, compress JSON/text responses
app.use(compression({
  filter: (req, res) => {
    // Don't compress multipart uploads
    if (req.headers['content-type']?.startsWith('multipart/')) return false;
    return compression.filter(req, res);
  },
  level: 6, // balanced speed vs ratio (default is 6 anyway)
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically (optional — useful for debugging)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ------------  Routes ---------------------------------------------
app.use('/api/upload', require('./routes/upload'));
app.use('/api/validate', require('./routes/validate'));
app.use('/api/rules', require('./routes/rules'));

// Health-check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'QA Tool Backend API Working Fine'
  });
});

// --------------------------------------  404 handler-------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ---------------------------------------------- Global error handler ------------------------------------------------
//?  eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(422).json({ success: false, message: messages.join(', ') });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid ID format.' });
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File too large.' });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected file field. Use field name "file".',
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});


const server = app.listen(PORT, "0.0.0.0" , () => {
  console.log(`QA Tool backend up and running on ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  // startCleanupScheduler();
});



// Allow very large file uploads / long validation runs (6 hours max)
server.timeout = 6 * 60 * 60 * 1000;
server.keepAliveTimeout = 6 * 60 * 60 * 1000;
server.headersTimeout = 0; // Disable the 60 s default — large uploads arrive slowly

// Per-socket optimisations for high-throughput file transfers
server.on('connection', (socket) => {
  socket.setNoDelay(true);           // Disable Nagle's algorithm — send chunks immediately
  socket.setKeepAlive(true, 30000);  // TCP keep-alive every 30 s
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app; // for testing
