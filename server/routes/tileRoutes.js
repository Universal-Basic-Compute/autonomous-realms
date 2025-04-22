const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const fetch = require('node-fetch');
const FormData = require('form-data');
const { createCanvas } = require('canvas');
const tileService = require('../services/tileGenerationService');
const config = require('../config');
const logger = require('../utils/logger');

// Get a tile by coordinates
// Add a route for API diagnostics
router.get('/api-test', async (req, res) => {
  try {
    logger.info('Running API diagnostic test');
    
    // Create a simple test image
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, 256, 256);
    
    // Check if a test mask already exists
    const testMaskPath = path.join(config.MASKS_DIR, 'api_test_mask.png');
    let maskCanvas;
    
    try {
      // Check if the mask already exists
      await fs.access(testMaskPath);
      logger.debug(`Using existing API test mask`);
      maskCanvas = await loadImage(testMaskPath);
    } catch (err) {
      // Mask doesn't exist, create it
      logger.debug('Creating new API test mask');
      
      // Create a simple mask
      maskCanvas = createCanvas(256, 256);
      const maskCtx = maskCanvas.getContext('2d');
      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, 256, 256);
      maskCtx.fillStyle = 'white';
      maskCtx.fillRect(128, 0, 128, 256);
      
      // Save the mask
      await fs.mkdir(config.MASKS_DIR, { recursive: true });
      await fs.writeFile(testMaskPath, maskCanvas.toBuffer('image/png'));
    }
    
    // Save temporary test image
    const testImagePath = path.join(config.TEMP_DIR, `api_test_image_${Date.now()}.png`);
    await fs.writeFile(testImagePath, canvas.toBuffer('image/png'));
    
    // Create form data
    const formData = new FormData();
    formData.append('image_file', await fs.readFile(testImagePath));
    formData.append('mask', await fs.readFile(testMaskPath));
    formData.append('model', config.IDEOGRAM_MODEL || 'V_2_TURBO'); // Use configurable model
    formData.append('prompt', 'Simple test image with grass texture. Clash Royale style.');
    
    // Log the request details for debugging
    logger.debug(`API test request details: 
      - Model: ${config.IDEOGRAM_MODEL || 'V_2_TURBO'}
      - API Key first chars: ${config.IDEOGRAM_API_KEY ? config.IDEOGRAM_API_KEY.substring(0, 4) + '...' : 'none'}
      - Image size: ${(await fs.stat(testImagePath)).size} bytes
      - Mask size: ${(await fs.stat(testMaskPath)).size} bytes`);
    
    // Make API request
    logger.info('Sending test request to Ideogram API');
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.ideogram.ai/edit', {
        method: 'POST',
        headers: {
          'Api-Key': config.IDEOGRAM_API_KEY,
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data'
        },
        body: formData,
        timeout: config.API_TIMEOUT // Use the timeout from config
      });
      
      const responseTime = Date.now() - startTime;
      
      // Get response as text first to ensure we can see error messages
      const responseText = await response.text();
      
      // Try to parse as JSON if possible
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = null;
      }
      
      // Clean up temp files
      await fs.unlink(testImagePath).catch(() => {});
      await fs.unlink(testMaskPath).catch(() => {});
      
      // Return diagnostic information
      return res.json({
        success: response.ok,
        statusCode: response.status,
        statusText: response.statusText,
        responseTime: `${responseTime}ms`,
        headers: Object.fromEntries([...response.headers]),
        apiKeyProvided: !!config.IDEOGRAM_API_KEY,
        apiKeyFirstChars: config.IDEOGRAM_API_KEY ? config.IDEOGRAM_API_KEY.substring(0, 4) + '...' : 'none',
        responseData: responseData,
        rawResponse: responseText.substring(0, 1000) + (responseText.length > 1000 ? '...(truncated)' : '')
      });
    } catch (error) {
      logger.error(`API test request failed: ${error.message}`);
      
      // Clean up temp files
      await fs.unlink(testImagePath).catch(() => {});
      await fs.unlink(testMaskPath).catch(() => {});
      
      return res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack,
        apiKeyProvided: !!config.IDEOGRAM_API_KEY,
        apiKeyFirstChars: config.IDEOGRAM_API_KEY ? config.IDEOGRAM_API_KEY.substring(0, 4) + '...' : 'none'
      });
    }
  } catch (error) {
    logger.error(`Error setting up API test: ${error.message}`);
    res.status(500).json({ error: 'Failed to run API test', details: error.message });
  }
});

router.get('/:regionX/:regionY/:x/:y', async (req, res) => {
  try {
    const { regionX, regionY, x, y } = req.params;
    const position = { 
      regionX: parseInt(regionX), 
      regionY: parseInt(regionY),
      x: parseInt(x),
      y: parseInt(y)
    };
    
    logger.info(`Tile requested at position ${JSON.stringify(position)}`);
    
    // Check if tile already exists
    const tilePath = path.join(
      config.TILES_DIR, 
      `${position.regionX}_${position.regionY}_${position.x}_${position.y}.png`
    );
    
    try {
      await fs.access(tilePath);
      // Tile exists, return it
      logger.debug(`Tile found at ${tilePath}, serving existing file`);
      return res.sendFile(tilePath);
    } catch (err) {
      // Tile doesn't exist, need to generate it
      logger.info(`Tile not found, generating new tile at position ${JSON.stringify(position)}`);
      
      // For the first tile (0,0), use a base tile or generate a fallback
      if (position.x === 0 && position.y === 0) {
        const baseTilePath = path.join(config.TILES_DIR, 'base_tile.png');
        try {
          await fs.access(baseTilePath);
          // Copy base tile to the new position
          logger.debug(`Using base tile for position (0,0)`);
          await fs.copyFile(baseTilePath, tilePath);
          return res.sendFile(tilePath);
        } catch (baseErr) {
          logger.info(`Base tile not found at ${baseTilePath}, generating fallback tile`);
          // Generate a fallback tile for the base position
          const fallbackTilePath = await tileService.generateFallbackTile(position);
          return res.sendFile(fallbackTilePath);
        }
      }
      
      // For horizontal tiles (x > 0, y = 0)
      if (position.x > 0 && position.y === 0) {
        const previousTilePath = path.join(
          config.TILES_DIR, 
          `${position.regionX}_${position.regionY}_${position.x-1}_${position.y}.png`
        );
        
        try {
          await fs.access(previousTilePath);
          logger.debug(`Generating horizontal tile using previous tile at ${previousTilePath}`);
          const newTilePath = await tileService.generateNextHorizontalTile(previousTilePath, position);
          return res.sendFile(newTilePath);
        } catch (prevErr) {
          logger.error(`Previous tile not found at ${previousTilePath}`);
          return res.status(404).json({ error: 'Previous tile not found' });
        }
      }
      
      // For vertical tiles (x = 0, y > 0)
      if (position.x === 0 && position.y > 0) {
        const bottomTilePath = path.join(
          config.TILES_DIR, 
          `${position.regionX}_${position.regionY}_${position.x}_${position.y-1}.png`
        );
        
        try {
          await fs.access(bottomTilePath);
          logger.debug(`Generating vertical tile using bottom tile at ${bottomTilePath}`);
          const newTilePath = await tileService.generateNextVerticalTile(bottomTilePath, position);
          return res.sendFile(newTilePath);
        } catch (bottomErr) {
          logger.error(`Bottom tile not found at ${bottomTilePath}`);
          return res.status(404).json({ error: 'Bottom tile not found' });
        }
      }
      
      // For interior tiles (x > 0, y > 0)
      if (position.x > 0 && position.y > 0) {
        const leftTilePath = path.join(
          config.TILES_DIR, 
          `${position.regionX}_${position.regionY}_${position.x-1}_${position.y}.png`
        );
        
        const bottomTilePath = path.join(
          config.TILES_DIR, 
          `${position.regionX}_${position.regionY}_${position.x}_${position.y-1}.png`
        );
        
        try {
          await fs.access(leftTilePath);
          await fs.access(bottomTilePath);
          
          logger.debug(`Generating interior tile using left tile at ${leftTilePath} and bottom tile at ${bottomTilePath}`);
          const newTilePath = await tileService.generateInteriorTile(leftTilePath, bottomTilePath, position);
          return res.sendFile(newTilePath);
        } catch (tileErr) {
          logger.error(`Required adjacent tiles not found for interior tile generation`);
          return res.status(404).json({ error: 'Required adjacent tiles not found' });
        }
      }
      
      logger.warn(`Unsupported tile position: ${JSON.stringify(position)}`);
      return res.status(501).json({ error: 'Tile generation not implemented for this position' });
    }
  } catch (error) {
    logger.error(`Error handling tile request: ${error.message}`, { error });
    res.status(500).json({ error: 'Failed to process tile request' });
  }
});

// Get information about a tile
router.get('/:regionX/:regionY/:x/:y/info', async (req, res) => {
  try {
    const { regionX, regionY, x, y } = req.params;
    const position = { 
      regionX: parseInt(regionX), 
      regionY: parseInt(regionY),
      x: parseInt(x),
      y: parseInt(y)
    };
    
    // Check if tile exists
    const tilePath = path.join(
      config.TILES_DIR, 
      `${position.regionX}_${position.regionY}_${position.x}_${position.y}.png`
    );
    
    try {
      const stats = await fs.stat(tilePath);
      
      res.json({
        position,
        exists: true,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        terrainCode: tileService.getTerrainCodeForPosition(position)
      });
    } catch (err) {
      res.json({
        position,
        exists: false,
        terrainCode: tileService.getTerrainCodeForPosition(position)
      });
    }
  } catch (error) {
    logger.error(`Error getting tile info: ${error.message}`);
    res.status(500).json({ error: 'Failed to get tile information' });
  }
});

module.exports = router;
