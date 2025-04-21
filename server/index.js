const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const tileRoutes = require('./routes/tileRoutes');
const config = require('./config');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON
app.use(express.json());

// Middleware for CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Ensure directories exist
async function ensureDirectories() {
  const dirs = [config.TEMP_DIR, config.TILES_DIR, config.LOGS_DIR];
  
  for (const dir of dirs) {
    try {
      await fs.access(dir);
      logger.debug(`Directory exists: ${dir}`);
    } catch (err) {
      logger.info(`Creating directory: ${dir}`);
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

// Initialize server
async function init() {
  try {
    logger.info('Server initializing...');
    await ensureDirectories();
    
    // Set up routes
    app.use('/api/tiles', tileRoutes);
    
    // Serve static files
    app.use('/assets', express.static(path.join(__dirname, 'assets')));
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  // Keep the process running, but log the error
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection:', reason);
  // Keep the process running, but log the error
});

init();
