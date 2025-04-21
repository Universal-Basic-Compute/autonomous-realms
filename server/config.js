const path = require('path');

module.exports = {
  IDEOGRAM_API_KEY: process.env.IDEOGRAM_API_KEY || 'your-api-key',
  TEMP_DIR: path.join(__dirname, 'temp'),
  TILES_DIR: path.join(__dirname, 'assets', 'tiles'),
  LOGS_DIR: path.join(__dirname, 'logs'),
  API_RATE_LIMIT: 5, // requests per second
  TILE_WIDTH: 512,
  TILE_HEIGHT: 512,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  USE_FALLBACK_TILES: process.env.USE_FALLBACK_TILES === 'true' || true,
  MAX_RETRIES: 3
};
