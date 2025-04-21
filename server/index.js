const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const tileRoutes = require('./routes/tileRoutes');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure directories exist
async function ensureDirectories() {
  const dirs = [config.TEMP_DIR, config.TILES_DIR];
  
  for (const dir of dirs) {
    try {
      await fs.access(dir);
    } catch (err) {
      console.log(`Creating directory: ${dir}`);
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

// Initialize server
async function init() {
  try {
    await ensureDirectories();
    
    // Set up routes
    app.use('/api/tiles', tileRoutes);
    
    // Serve static files
    app.use('/assets', express.static(path.join(__dirname, 'assets')));
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

init();
