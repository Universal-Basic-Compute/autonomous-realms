const path = require('path');

module.exports = {
  IDEOGRAM_API_KEY: process.env.IDEOGRAM_API_KEY || 'your-api-key',
  TEMP_DIR: path.join(__dirname, 'temp'),
  TILES_DIR: path.join(__dirname, 'assets', 'tiles'),
  API_RATE_LIMIT: 5, // requests per second
  TILE_WIDTH: 512,
  TILE_HEIGHT: 512
};
