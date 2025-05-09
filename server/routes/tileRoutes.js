const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const fetch = require('node-fetch');
const FormData = require('form-data');
const { createCanvas } = require('canvas');
const { exec } = require('child_process');
const tileService = require('../services/tileGenerationService');
const config = require('../config');
const logger = require('../utils/logger');
const computeManager = require('../utils/computeManager');

// Get a generated island tile
router.get('/islands/:x/:y', async (req, res) => {
  try {
    const { x, y } = req.params;
    const position = { 
      x: parseInt(x), 
      y: parseInt(y)
    };
    
    logger.info(`Island tile requested at position (${x}, ${y})`);
    
    // Check if island tile exists
    const islandPath = path.join(
      __dirname, 
      '../output/terrain_map/islands', 
      `island_${position.x}_${position.y}.png`
    );
    
    try {
      await fs.access(islandPath);
      // Island exists, return it
      logger.debug(`Island found at ${islandPath}, serving existing file`);
      return res.sendFile(islandPath);
    } catch (err) {
      // Island doesn't exist, return 404 instead of fallback
      logger.warn(`Island not found at position (${x}, ${y}), returning 404`);
      return res.status(404).json({ error: 'Island not found' });
    }
  } catch (error) {
    logger.error(`Error handling island request: ${error.message}`, { error });
    res.status(500).json({ error: 'Failed to process island request' });
  }
});

// Test endpoint to list all available islands
router.get('/islands/test', async (req, res) => {
  try {
    // List all island files
    const islandsDir = path.join(__dirname, '../output/terrain_map/islands');
    const files = await fs.readdir(islandsDir);
    
    res.json({
      success: true,
      islandCount: files.length,
      islands: files.map(file => ({
        filename: file,
        url: `/api/tiles/islands/${file.replace('island_', '').replace('.png', '')}`
      }))
    });
  } catch (error) {
    logger.error(`Error testing islands: ${error.message}`);
    res.status(500).json({ error: 'Failed to test islands' });
  }
});

// Get information about an island
router.get('/islands/:x/:y/info', async (req, res) => {
  try {
    const { x, y } = req.params;
    const position = { 
      x: parseInt(x), 
      y: parseInt(y)
    };
    
    // Check if island metadata exists
    const metadataPath = path.join(
      __dirname, 
      '../output/terrain_map/metadata', 
      `island_${position.x}_${position.y}.json`
    );
    
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);
      
      res.json({
        position,
        exists: true,
        description: metadata.description,
        terrainCode: metadata.terrainCode,
        coordinates: metadata.coordinates
      });
    } catch (err) {
      res.json({
        position,
        exists: false
      });
    }
  } catch (error) {
    logger.error(`Error getting island info: ${error.message}`);
    res.status(500).json({ error: 'Failed to get island information' });
  }
});

// Add this route to handle tile redrawing
router.post('/islands/:x/:y/redraw', async (req, res) => {
  try {
    const { x, y } = req.params;
    const position = { 
      x: parseInt(x), 
      y: parseInt(y)
    };
    
    logger.info(`Redraw requested for island tile at position (${x}, ${y})`);
    
    // Check if island metadata exists
    const metadataPath = path.join(
      __dirname, 
      '../output/terrain_map/metadata', 
      `island_${position.x}_${position.y}.json`
    );
    
    let metadata;
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      metadata = JSON.parse(metadataContent);
    } catch (err) {
      return res.status(404).json({ error: 'Island metadata not found' });
    }
    
    // Get the island image path
    const islandPath = path.join(
      __dirname, 
      '../output/terrain_map/islands', 
      `island_${position.x}_${position.y}.png`
    );
    
    // Delete the existing image if it exists
    try {
      await fs.access(islandPath);
      await fs.unlink(islandPath);
      logger.info(`Deleted existing island image at ${islandPath}`);
    } catch (err) {
      // File doesn't exist, which is fine
    }
    
    // Generate a new image using the existing metadata
    const terrainMap = require('../scripts/generateTerrainMap');
    await terrainMap.generateIslandImage(metadata, 0);
    
    logger.info(`Successfully regenerated island image at ${position.x},${position.y}`);
    
    res.json({ 
      success: true, 
      message: `Island at (${x}, ${y}) has been redrawn`,
      imageUrl: `/api/tiles/islands/${x}/${y}?t=${Date.now()}`
    });
  } catch (error) {
    logger.error(`Error redrawing island: ${error.message}`, { error });
    res.status(500).json({ error: 'Failed to redraw island' });
  }
});

// Add this route to handle close map generation
router.post('/close-map/generate', async (req, res) => {
  try {
    const { tileX, tileY, regionX, regionY, terrainCode, terrainDescription } = req.body;
    
    // Get user ID from request headers or query params
    const userId = req.headers['user-id'] || req.query.userId || req.body.userId;
    
    logger.info(`Close map generation requested for tile at (${regionX},${regionY},${tileX},${tileY}) with terrain ${terrainCode}`);
    
    if (!terrainCode || !terrainDescription) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Check if user has enough COMPUTE
    if (userId) {
      const hasEnough = await computeManager.hasEnoughCompute(userId, 'CLAUDE');
      if (!hasEnough) {
        return res.status(402).json({ 
          error: 'Insufficient COMPUTE balance',
          message: 'You need at least 1000 COMPUTE to use this service'
        });
      }
    }
    
    // Generate the close map
    const closeMapService = require('../services/closeMapService');
    const result = await closeMapService.generateCloseMap(regionX, regionY, tileX, tileY, terrainCode, terrainDescription);
    
    // Deduct COMPUTE if successful and userId is provided
    if (userId && result.success) {
      await computeManager.deductCompute(userId, 'CLAUDE');
    }
    
    res.json(result);
  } catch (error) {
    logger.error(`Error generating close map: ${error.message}`, { error });
    res.status(500).json({ 
      error: 'Failed to generate close map', 
      message: error.message
    });
  }
});

// Add this route to get close map tiles
router.get('/close-map/:regionX/:regionY/:tileX/:tileY/:x/:y', async (req, res) => {
  try {
    const { regionX, regionY, tileX, tileY, x, y } = req.params;
    const position = { 
      regionX: parseInt(regionX), 
      regionY: parseInt(regionY),
      tileX: parseInt(tileX),
      tileY: parseInt(tileY),
      x: parseInt(x),
      y: parseInt(y)
    };
    
    logger.debug(`Close map tile requested at position ${JSON.stringify(position)}`);
    
    // Check if tile already exists
    const tilePath = path.join(
      config.TILES_DIR, 
      'close_maps',
      `${position.regionX}_${position.regionY}_${position.tileX}_${position.tileY}`,
      `${position.x}_${position.y}.png`
    );
    
    try {
      await fs.access(tilePath);
      // Tile exists, return it
      return res.sendFile(tilePath);
    } catch (err) {
      // Tile doesn't exist, return a fallback
      logger.warn(`Close map tile not found at ${tilePath}`);
      
      // Generate a fallback tile
      const closeMapService = require('../services/closeMapService');
      const fallbackTilePath = await closeMapService.generateFallbackTile(position);
      return res.sendFile(fallbackTilePath);
    }
  } catch (error) {
    logger.error(`Error serving close map tile: ${error.message}`, { error });
    res.status(500).json({ error: 'Failed to serve close map tile' });
  }
});

// Add this route to get close map metadata
router.get('/close-map/:regionX/:regionY/:tileX/:tileY/metadata', async (req, res) => {
  try {
    const { regionX, regionY, tileX, tileY } = req.params;
    const position = { 
      regionX: parseInt(regionX), 
      regionY: parseInt(regionY),
      tileX: parseInt(tileX),
      tileY: parseInt(tileY)
    };
    
    // Check if metadata exists
    const metadataPath = path.join(
      config.TILES_DIR, 
      'close_maps',
      `${position.regionX}_${position.regionY}_${position.tileX}_${position.tileY}`,
      'metadata.json'
    );
    
    try {
      const metadata = await fs.readFile(metadataPath, 'utf8');
      return res.json(JSON.parse(metadata));
    } catch (err) {
      return res.status(404).json({ 
        error: 'Close map metadata not found',
        message: 'The close map may not have been generated yet'
      });
    }
  } catch (error) {
    logger.error(`Error getting close map metadata: ${error.message}`, { error });
    res.status(500).json({ error: 'Failed to get close map metadata' });
  }
});

// Add this route to list music files (legacy endpoint - will be deprecated)
router.get('/audio/music/list', async (req, res) => {
  try {
    logger.warn('Deprecated endpoint /api/tiles/audio/music/list used, please update to /api/data/music/list');
    const musicDir = path.join(__dirname, '../data/music');
    
    // Read the directory
    const files = await fs.readdir(musicDir);
    
    // Filter for audio files
    const musicFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.mp3' || ext === '.ogg' || ext === '.wav' || ext === '.m4a';
    });
    
    res.json({ tracks: musicFiles });
  } catch (error) {
    logger.error(`Error listing music files: ${error.message}`);
    res.status(500).json({ error: 'Failed to list music files' });
  }
});

// Add a route for cURL diagnostics
router.get('/curl-test', async (req, res) => {
  try {
    logger.info('Running cURL diagnostic test');
    
    // Create a simple test image
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, 256, 256);
    
    // Save temporary test image
    const testImagePath = path.join(config.TEMP_DIR, `curl_test_image_${Date.now()}.png`);
    await fs.writeFile(testImagePath, canvas.toBuffer('image/png'));
    
    // Generate a shell command for cURL - fix for Windows
    // Use double quotes for the whole command and single quotes for values
    const curlCommand = `curl -X POST "https://api.ideogram.ai/reframe" -H "Api-Key: ${config.IDEOGRAM_API_KEY}" -F "image_file=@${testImagePath}" -F "resolution=RESOLUTION_1152_864" -F "model=${config.IDEOGRAM_MODEL}"`;
    
    // Execute the cURL command
    exec(curlCommand, { maxBuffer: 1024 * 1024 * 10 }, async (error, stdout, stderr) => {
      // Clean up temp file
      await fs.unlink(testImagePath).catch(() => {});
      
      if (error) {
        logger.error(`cURL execution error: ${error.message}`);
        return res.status(500).json({
          success: false,
          error: error.message,
          stderr: stderr,
          apiKeyProvided: !!config.IDEOGRAM_API_KEY,
          apiKeyFirstChars: config.IDEOGRAM_API_KEY ? config.IDEOGRAM_API_KEY.substring(0, 8) + '...' : 'none',
          command: curlCommand.replace(config.IDEOGRAM_API_KEY, config.IDEOGRAM_API_KEY.substring(0, 8) + '...')
        });
      }
      
      // Try to parse the response as JSON
      let responseData;
      try {
        responseData = JSON.parse(stdout);
      } catch (e) {
        responseData = null;
      }
      
      return res.json({
        success: true,
        curlCommand: curlCommand.replace(config.IDEOGRAM_API_KEY, config.IDEOGRAM_API_KEY.substring(0, 8) + '...'),
        stdout: stdout.substring(0, 1000) + (stdout.length > 1000 ? '...(truncated)' : ''),
        stderr: stderr,
        responseData: responseData,
        apiKeyProvided: !!config.IDEOGRAM_API_KEY,
        apiKeyFirstChars: config.IDEOGRAM_API_KEY ? config.IDEOGRAM_API_KEY.substring(0, 8) + '...' : 'none'
      });
    });
  } catch (error) {
    logger.error(`Error setting up cURL test: ${error.message}`);
    res.status(500).json({ error: 'Failed to run cURL test', details: error.message });
  }
});

// Add this route to generate action visualization images
router.post('/generate-action-image', async (req, res) => {
  try {
    logger.info(`Action image generation endpoint hit`);
    const { prompt, action, terrainCode, min_files = 1, max_files = 1 } = req.body;
    
    // Get user ID from request headers or query params
    const userId = req.headers['user-id'] || req.query.userId || req.body.userId;
    
    if (!prompt) {
      logger.warn('No prompt provided for image generation');
      return res.status(400).json({ error: 'No prompt provided for image generation' });
    }
    
    // Check if user has enough COMPUTE
    if (userId) {
      const hasEnough = await computeManager.hasEnoughCompute(userId, 'IDEOGRAM');
      if (!hasEnough) {
        return res.status(402).json({ 
          error: 'Insufficient COMPUTE balance',
          message: 'You need at least 1000 COMPUTE to use this service'
        });
      }
    }
    
    logger.info(`Generating action visualization image for action ${action} on terrain ${terrainCode}`);
    
    // Generate a unique filename for this action image
    const imageId = `action_${action}_${terrainCode ? terrainCode.split('|')[0] : 'unknown'}_${Date.now()}`;
    const imageFilename = `${imageId}.png`;
    const imageDir = path.join(__dirname, '../assets/images/actions');
    const imagePath = path.join(imageDir, imageFilename);
    
    // Make sure the directory exists
    await fs.mkdir(imageDir, { recursive: true });
    
    // Prepare request data for Ideogram API
    const requestData = {
      image_request: {
        prompt: prompt,
        model: config.IDEOGRAM_MODEL || "V_2_TURBO",
        aspect_ratio: "ASPECT_1_1", // Square aspect ratio for action images
        style_type: config.IDEOGRAM_STYLE_TYPE || "REALISTIC",
        min_files: parseInt(min_files),
        max_files: parseInt(max_files)
      }
    };
    
    // Make API request to Ideogram
    const response = await fetch('https://api.ideogram.ai/generate', {
      method: 'POST',
      headers: {
        'Api-Key': config.IDEOGRAM_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestData),
      timeout: config.API_TIMEOUT
    });
    
    // Check response
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }
    
    // Parse response
    const responseData = await response.json();
    
    // Check if we have valid image data
    if (!responseData.data || !responseData.data[0] || !responseData.data[0].url) {
      throw new Error('Invalid response from Ideogram API: No image URL found');
    }
    
    // Download the generated image
    const imageUrl = responseData.data[0].url;
    
    // Use tileService.downloadImage if available, otherwise fetch directly
    if (tileService && typeof tileService.downloadImage === 'function') {
      await tileService.downloadImage(imageUrl, imagePath);
    } else {
      const imageResponse = await fetch(imageUrl);
      const buffer = await imageResponse.buffer();
      await fs.writeFile(imagePath, buffer);
    }
    
    // Deduct COMPUTE if successful and userId is provided
    if (userId && responseData.data && responseData.data[0]) {
      await computeManager.deductCompute(userId, 'IDEOGRAM');
    }
    
    // Return the URL to the saved image
    res.json({
      success: true,
      imageUrl: `/assets/images/actions/${imageFilename}`,
      prompt: prompt,
      totalImages: responseData.data.length
    });
    
  } catch (error) {
    logger.error(`Error generating action image: ${error.message}`, { error });
    res.status(500).json({ 
      error: 'Failed to generate action image', 
      message: error.message
    });
  }
});

// Add this route to update a tile with activity
router.post('/update-with-activity', async (req, res) => {
  try {
    const { tileX, tileY, prompt, action, terrainCode, removeBackground } = req.body;
    
    // Get user ID from request headers or query params
    const userId = req.headers['user-id'] || req.query.userId || req.body.userId;
    
    if (!prompt || !tileX || !tileY) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Check if user has enough COMPUTE
    if (userId) {
      const hasEnough = await computeManager.hasEnoughCompute(userId, 'IDEOGRAM');
      if (!hasEnough) {
        return res.status(402).json({ 
          error: 'Insufficient COMPUTE balance',
          message: 'You need at least 1000 COMPUTE to use this service'
        });
      }
    }
    
    logger.info(`Updating tile at (${tileX}, ${tileY}) with activity: ${action}`);
    
    // Generate a unique filename for this updated tile
    const activityId = `activity_${tileX}_${tileY}_${action}_${Date.now()}`;
    const imageFilename = `${activityId}.png`;
    const imageDir = path.join(__dirname, '../assets/images/activities');
    const imagePath = path.join(imageDir, imageFilename);
    
    // Make sure the directory exists
    await fs.mkdir(imageDir, { recursive: true });
    
    // Prepare request data for Ideogram API
    const requestData = {
      image_request: {
        prompt: prompt,
        model: config.IDEOGRAM_MODEL || "V_2_TURBO",
        aspect_ratio: "ASPECT_1_1", // Square aspect ratio for tiles
        style_type: config.IDEOGRAM_STYLE_TYPE || "REALISTIC"
      }
    };
    
    // Make API request to Ideogram
    const response = await fetch('https://api.ideogram.ai/generate', {
      method: 'POST',
      headers: {
        'Api-Key': config.IDEOGRAM_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestData),
      timeout: config.API_TIMEOUT
    });
    
    // Check response
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }
    
    // Parse response
    const responseData = await response.json();
    
    // Check if we have valid image data
    if (!responseData.data || !responseData.data[0] || !responseData.data[0].url) {
      throw new Error('Invalid response from Ideogram API: No image URL found');
    }
    
    // Download the generated image
    const imageUrl = responseData.data[0].url;
    let finalImagePath = imagePath;
    
    // Use tileService.downloadImage if available, otherwise fetch directly
    if (tileService && typeof tileService.downloadImage === 'function') {
      await tileService.downloadImage(imageUrl, imagePath);
      
      // Remove background if requested
      if (removeBackground === true && tileService.removeBackground) {
        logger.info(`Removing background from activity image at ${imagePath}`);
        try {
          // Process the image to remove background
          const processedImagePath = await tileService.removeBackground(imagePath);
          if (processedImagePath) {
            finalImagePath = processedImagePath;
            logger.info(`Successfully removed background, new image at ${processedImagePath}`);
          }
        } catch (bgError) {
          logger.error(`Error removing background: ${bgError.message}`, { error: bgError });
          // Continue with the original image if background removal fails
        }
      }
    } else {
      const imageResponse = await fetch(imageUrl);
      const buffer = await imageResponse.buffer();
      await fs.writeFile(imagePath, buffer);
    }
    
    // Deduct COMPUTE if successful and userId is provided
    if (userId && responseData.data && responseData.data[0]) {
      await computeManager.deductCompute(userId, 'IDEOGRAM');
    }
    
    // Return the URL to the saved image
    res.json({
      success: true,
      imageUrl: `/assets/images/activities/${path.basename(finalImagePath)}`,
      prompt: prompt
    });
    
  } catch (error) {
    logger.error(`Error updating tile with activity: ${error.message}`, { error });
    res.status(500).json({ 
      error: 'Failed to update tile with activity', 
      message: error.message
    });
  }
});

// Add a route to monitor the queue status
router.get('/queue-status', (req, res) => {
  try {
    const queueStatus = {
      queueLength: tileService.apiQueue.length,
      activeBatchCount: tileService.activeBatchCount,
      isProcessing: tileService.apiQueue.length > 0,
      batchSize: tileService.BATCH_SIZE
    };
    
    res.json(queueStatus);
  } catch (error) {
    logger.error(`Error getting queue status: ${error.message}`);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

// Add a test endpoint for action image generation
router.get('/test-action-image', (req, res) => {
  logger.info('Test action image endpoint hit');
  res.json({ 
    success: true, 
    message: 'Action image generation endpoint is working' 
  });
});

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
    formData.append('model', config.IDEOGRAM_MODEL || 'V_2_TURBO'); // Use configurable model
    formData.append('resolution', 'RESOLUTION_1152_864'); // For testing horizontal expansion
    formData.append('style_type', 'REALISTIC'); // Already set to REALISTIC
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
      const response = await fetch('https://api.ideogram.ai/reframe', {
        method: 'POST',
        headers: {
          'Api-Key': config.IDEOGRAM_API_KEY,
          'Accept': 'application/json'
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
        apiKeyFirstChars: config.IDEOGRAM_API_KEY ? config.IDEOGRAM_API_KEY.substring(0, 8) + '...' : 'none',
        apiKeyLength: config.IDEOGRAM_API_KEY ? config.IDEOGRAM_API_KEY.length : 0,
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
        apiKeyFirstChars: config.IDEOGRAM_API_KEY ? config.IDEOGRAM_API_KEY.substring(0, 8) + '...' : 'none',
        apiKeyLength: config.IDEOGRAM_API_KEY ? config.IDEOGRAM_API_KEY.length : 0
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
        // Use a deterministic "random" selection based on region coordinates
        // This ensures the same base tile is always used for the same region
        const seed = (position.regionX * 100 + position.regionY) % 4 + 1;
        const baseTilePath = path.join(config.TILES_DIR, `base_tile_${seed}.png`);
        
        try {
          await fs.access(baseTilePath);
          // Copy base tile to the new position
          logger.debug(`Using base tile ${seed} for position (0,0)`);
          await fs.copyFile(baseTilePath, tilePath);
          return res.sendFile(tilePath);
        } catch (baseErr) {
          // Try the default base tile as fallback
          const defaultBaseTilePath = path.join(config.TILES_DIR, 'base_tile.png');
          try {
            await fs.access(defaultBaseTilePath);
            logger.debug(`Base tile ${seed} not found, using default base tile`);
            await fs.copyFile(defaultBaseTilePath, tilePath);
            return res.sendFile(tilePath);
          } catch (defaultBaseErr) {
            logger.info(`No base tiles found, generating fallback tile`);
            // Generate a fallback tile for the base position
            const fallbackTilePath = await tileService.generateFallbackTile(position);
            return res.sendFile(fallbackTilePath);
          }
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
