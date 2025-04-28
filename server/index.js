require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const tileRoutes = require('./routes/tileRoutes');
const config = require('./config');
const logger = require('./utils/logger');

console.log('Server starting - console.log test');
logger.info('Server starting - logger.info test');
logger.error('Server starting - logger.error test');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON
app.use(express.json());

// Middleware for CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, User-ID');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Ensure directories exist
async function ensureDirectories() {
  const dirs = [config.TEMP_DIR, config.TILES_DIR, config.LOGS_DIR, config.MASKS_DIR];
  
  for (const dir of dirs) {
    try {
      await fs.access(dir);
      logger.debug(`Directory exists: ${dir}`);
    } catch (err) {
      logger.info(`Creating directory: ${dir}`);
      await fs.mkdir(dir, { recursive: true });
    }
  }
  
  // Add close maps directory
  const closeMapDir = path.join(config.TILES_DIR, 'close_maps');
  try {
    await fs.access(closeMapDir);
    logger.debug(`Directory exists: ${closeMapDir}`);
  } catch (err) {
    logger.info(`Creating directory: ${closeMapDir}`);
    await fs.mkdir(closeMapDir, { recursive: true });
  }
}

// Create a dummy audio file for fallback
async function createDummyAudioFile() {
  const dummyAudioPath = path.join(__dirname, 'assets/audio/narration/dummy.mp3');
  
  try {
    // Check if the file already exists
    await fs.access(dummyAudioPath);
    logger.debug('Dummy audio file already exists');
  } catch (err) {
    // File doesn't exist, create the directory and an empty file
    logger.info('Creating dummy audio file for fallback');
    await fs.mkdir(path.join(__dirname, 'assets/audio/narration'), { recursive: true });
    
    // Create a minimal valid MP3 file (1 second of silence)
    // You can replace this with a real MP3 file if you have one
    // For now, we'll just create an empty file
    await fs.writeFile(dummyAudioPath, Buffer.from(''));
    
    logger.info(`Created dummy audio file at ${dummyAudioPath}`);
  }
}

// Initialize server
async function init() {
  try {
    logger.info('Server initializing...');
    await ensureDirectories();
    await createDummyAudioFile();
    
    // Debug API key (showing only first 8 chars for security)
    logger.debug(`Using API key: ${config.IDEOGRAM_API_KEY.substring(0, 8)}... (${config.IDEOGRAM_API_KEY ? 'provided' : 'missing'}, length: ${config.IDEOGRAM_API_KEY ? config.IDEOGRAM_API_KEY.length : 0})`);
    logger.debug(`Fallback tiles enabled: ${config.USE_FALLBACK_TILES}`);
    
    // Set up routes
    app.use('/api/tiles', tileRoutes);
    app.use('/api/icons', require('./routes/iconRoutes'));
    app.use('/api/data', require('./routes/dataRoutes'));
    app.use('/api/kinos', require('./routes/kinosRoutes'));
    app.use('/api/auth', require('./routes/authRoutes'));
    
    // Route for action image generation is now in tileRoutes.js
    
    // Serve static files
    app.use('/assets', express.static(path.join(__dirname, 'assets')));
    app.use('/assets/audio', express.static(path.join(__dirname, 'assets/audio')));
    app.use('/assets/audio/music', express.static(path.join(__dirname, 'data/music')));
    app.use('/assets/audio/narration', express.static(path.join(__dirname, 'assets/audio/narration')));
    app.use('/api/data/music/play', express.static(path.join(__dirname, 'data/music')));
    app.use('/assets/images/actions', express.static(path.join(__dirname, 'assets/images/actions')));
    app.use('/assets/images/activities', express.static(path.join(__dirname, 'assets/images/activities')));
    app.use('/output', express.static(path.join(__dirname, 'output')));
    app.use('/docs', express.static(path.join(__dirname, '../docs')));
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    // Root route
    app.get('/', (req, res) => {
      res.send(`
        <html>
          <head>
            <title>Autonomous Realms Tile Generator</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
              h1 { color: #333; }
              pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
              .endpoint { margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <h1>Autonomous Realms Tile Generator</h1>
            <p>This server generates terrain tiles for the Autonomous Realms game using Ideogram AI.</p>
            
            <h2>Available Endpoints:</h2>
            
            <div class="endpoint">
              <h3>Get a Tile</h3>
              <pre>GET /api/tiles/:regionX/:regionY/:x/:y</pre>
              <p>Returns a PNG image of the requested tile.</p>
            </div>
            
            <div class="endpoint">
              <h3>API Diagnostic Test</h3>
              <pre>GET /api/tiles/api-test</pre>
              <p>Tests the Ideogram API connection and returns diagnostic information.</p>
            </div>
            
            <div class="endpoint">
              <h3>cURL Diagnostic Test</h3>
              <pre>GET /api/tiles/curl-test</pre>
              <p>Tests the Ideogram API using cURL and returns diagnostic information.</p>
            </div>
            
            <div class="endpoint">
              <h3>Get Tile Info</h3>
              <pre>GET /api/tiles/:regionX/:regionY/:x/:y/info</pre>
              <p>Returns JSON metadata about the requested tile.</p>
            </div>
            
            <div class="endpoint">
              <h3>Health Check</h3>
              <pre>GET /health</pre>
              <p>Returns server status information.</p>
            </div>
            
            <h2>Example:</h2>
            <p>To get the tile at region (0,0), position (0,0):</p>
            <pre>GET /api/tiles/0/0/0/0</pre>
            
            <p>To get information about this tile:</p>
            <pre>GET /api/tiles/0/0/0/0/info</pre>
          </body>
        </html>
      `);
    });
    
    // Log the port we're about to use
    logger.info(`Starting server on port ${PORT}`);

    // Start server - bind to all interfaces (0.0.0.0) to ensure it's accessible from outside the container
    app.listen(PORT, '0.0.0.0', () => {
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
