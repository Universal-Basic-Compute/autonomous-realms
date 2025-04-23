const { createCanvas, loadImage } = require('canvas');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const config = require('../config');

// Set up logging
const logger = require('../utils/logger');

// Constants
const TILE_WIDTH = config.TILE_WIDTH;
const TILE_HEIGHT = config.TILE_HEIGHT;

// API request queue for rate limiting
const apiQueue = [];
let processingQueue = false;
const BATCH_SIZE = 4; // Process 4 API calls at a time
let activeBatchCount = 0; // Track how many batches are currently processing

/**
 * Generates a horizontal tile based on a previous tile
 */
async function generateNextHorizontalTile(previousTilePath, position) {
  logger.info(`Generating horizontal tile at position ${JSON.stringify(position)}`);
  
  try {
    // Load the previous tile image
    const previousTile = await loadImage(previousTilePath);
    
    // Create expanded canvas
    const expandedCanvas = createCanvas(previousTile.width * 1.2, previousTile.height);
    const ctx = expandedCanvas.getContext('2d');
    
    // Draw the previous tile on the left side
    ctx.drawImage(previousTile, 0, 0);
    
    // Check if a mask already exists for this type of operation
    const maskFilename = `horizontal_mask_${TILE_WIDTH}x${TILE_HEIGHT}.png`;
    const maskPath = path.join(config.MASKS_DIR, maskFilename);
    
    let maskImagePath;
    
    try {
      // Check if the mask already exists
      await fs.access(maskPath);
      logger.debug(`Using existing horizontal mask from ${maskPath}`);
      maskImagePath = maskPath;
    } catch (err) {
      // Mask doesn't exist, create it
      logger.debug('Creating new horizontal mask');
      
      // Create mask canvas
      const maskCanvas = createCanvas(expandedCanvas.width, expandedCanvas.height);
      const maskCtx = maskCanvas.getContext('2d');
      
      // Fill the entire mask with black (keep original)
      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      
      // Fill the right 20% with white (area to generate)
      maskCtx.fillStyle = 'white';
      maskCtx.fillRect(previousTile.width * 0.8, 0, previousTile.width * 0.2, previousTile.height);
      
      // Save the mask for future use
      await fs.mkdir(config.MASKS_DIR, { recursive: true });
      await fs.writeFile(maskPath, maskCanvas.toBuffer('image/png'));
      
      maskImagePath = maskPath;
    }
    
    // Save temporary file for API upload
    const expandedImagePath = path.join(config.TEMP_DIR, `expanded_${Date.now()}.png`);
    await fs.writeFile(expandedImagePath, expandedCanvas.toBuffer('image/png'));
    
    // Save the expanded image for debugging
    const debugDir = path.join(config.TEMP_DIR, 'debug');
    await fs.mkdir(debugDir, { recursive: true });
    const expandedImageDebugPath = path.join(debugDir, `expanded_${position.regionX}_${position.regionY}_${position.x}_${position.y}.png`);
    await fs.copyFile(expandedImagePath, expandedImageDebugPath);
    logger.debug(`Saved expanded image to ${expandedImageDebugPath}`);
    
    logger.debug('Created expanded image and mask for API request');
    
    // Queue the API request to respect rate limits
    const newTilePath = await queueApiRequest(async () => {
      // Create a temporary directory for the response
      const responseDir = path.join(config.TEMP_DIR, 'responses');
      await fs.mkdir(responseDir, { recursive: true });
      const responseFilePath = path.join(responseDir, `response_${Date.now()}.json`);
      
      // Prepare the prompt
      const prompt = `Isometric game terrain tile with continuous, seamless connection from the left side. ${getTerrainPromptDetails(position)}. Ensure perfect continuity at the edges. Clash Royale style, clean colors.`;
      
      // Build the cURL command - escape quotes in the prompt
      const escapedPrompt = prompt.replace(/"/g, '\\"');
      const curlCommand = `curl -X POST "https://api.ideogram.ai/reframe" -H "Api-Key: ${config.IDEOGRAM_API_KEY}" -F "image_file=@${expandedImagePath}" -F "resolution=RESOLUTION_1152_864" -F "model=${config.IDEOGRAM_MODEL}" -F "style_type=REALISTIC" -F "prompt=${escapedPrompt}" -o "${responseFilePath}"`;
      
      // Log the request details for debugging
      logger.debug(`API request details: 
        - Model: ${config.IDEOGRAM_MODEL || 'V_2_TURBO'}
        - Image size: ${await getFileSize(expandedImagePath)} bytes
        - Mask size: ${await getFileSize(maskImagePath)} bytes
        - Prompt length: ${prompt.length} chars`);
      
      logger.debug(`Executing cURL command: ${curlCommand.replace(config.IDEOGRAM_API_KEY, config.IDEOGRAM_API_KEY.substring(0, 8) + '...')}`);
      
      // Execute the cURL command with retry logic
      let retryCount = 0;
      let curlResult;
      let errorText = '';
      
      while (retryCount < config.MAX_RETRIES) {
        try {
          logger.debug(`API request attempt ${retryCount + 1}/${config.MAX_RETRIES}`);
          
          // Execute the cURL command
          curlResult = await execPromise(curlCommand, { maxBuffer: 1024 * 1024 * 10 });
          
          // Check if the response file exists and has content
          const stats = await fs.stat(responseFilePath);
          if (stats.size === 0) {
            throw new Error('Empty response file');
          }
          
          // Read the response file
          const responseText = await fs.readFile(responseFilePath, 'utf8');
          
          // Parse the response
          const data = JSON.parse(responseText);
          
          // Log the full response for debugging
          logger.debug(`API response: ${JSON.stringify(data)}`);
          
          if (!data.data || !data.data[0] || !data.data[0].url) {
            throw new Error('Invalid response from Ideogram API: ' + JSON.stringify(data));
          }
          
          logger.debug('Received successful response from Ideogram API');
          
          // Clean up temp files
          await fs.unlink(expandedImagePath).catch(err => logger.warn(`Failed to delete temp file: ${err.message}`));
          await fs.unlink(responseFilePath).catch(err => logger.warn(`Failed to delete temp file: ${err.message}`));
          
          // Download the generated image
          const generatedImageUrl = data.data[0].url;
          const generatedImage = await downloadImage(generatedImageUrl);
          
          // Crop and save the new tile
          const newTilePath = path.join(
            config.TILES_DIR, 
            `${position.regionX}_${position.regionY}_${position.x}_${position.y}.png`
          );
          
          await cropAndSaveRightSide(generatedImage, newTilePath);
          
          return newTilePath;
        } catch (error) {
          logger.warn(`API request failed (attempt ${retryCount + 1}/${config.MAX_RETRIES}): ${error.message}`);
          errorText = error.message;
          
          // Wait before retrying (exponential backoff)
          const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          
          retryCount++;
        }
      }
      
      throw new Error(`API request failed after ${config.MAX_RETRIES} attempts. Last error: ${errorText}`);
      
      // Crop and save the new tile
      const newTilePath = path.join(
        config.TILES_DIR, 
        `${position.regionX}_${position.regionY}_${position.x}_${position.y}.png`
      );
      
      await cropAndSaveRightSide(generatedImage, newTilePath);
      
      return newTilePath;
    });
    
    logger.info(`Successfully generated horizontal tile at ${newTilePath}`);
    return newTilePath;
    
  } catch (error) {
    logger.error(`Error generating horizontal tile: ${error.message}`, { position, error });
    
    // Generate fallback tile if needed
    if (config.USE_FALLBACK_TILES) {
      logger.warn('Generating fallback tile');
      return generateFallbackTile(position);
    }
    
    throw error;
  }
}

/**
 * Generates a vertical tile based on a bottom tile
 */
async function generateNextVerticalTile(bottomTilePath, position) {
  logger.info(`Generating vertical tile at position ${JSON.stringify(position)}`);
  
  try {
    // Load the bottom tile image
    const bottomTile = await loadImage(bottomTilePath);
    
    // Create expanded canvas
    const expandedCanvas = createCanvas(bottomTile.width, bottomTile.height * 1.75);
    const ctx = expandedCanvas.getContext('2d');
    
    // Draw the bottom tile at the bottom
    ctx.drawImage(bottomTile, 0, expandedCanvas.height - bottomTile.height * 0.25);
    
    // Check if a mask already exists for this type of operation
    const maskFilename = `vertical_mask_${TILE_WIDTH}x${TILE_HEIGHT}.png`;
    const maskPath = path.join(config.MASKS_DIR, maskFilename);
    
    let maskImagePath;
    
    try {
      // Check if the mask already exists
      await fs.access(maskPath);
      logger.debug(`Using existing vertical mask from ${maskPath}`);
      maskImagePath = maskPath;
    } catch (err) {
      // Mask doesn't exist, create it
      logger.debug('Creating new vertical mask');
      
      // Create mask canvas
      const maskCanvas = createCanvas(expandedCanvas.width, expandedCanvas.height);
      const maskCtx = maskCanvas.getContext('2d');
      
      // Fill the entire mask with black (keep original)
      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      
      // Fill the top 75% with white (area to generate)
      maskCtx.fillStyle = 'white';
      maskCtx.fillRect(0, 0, bottomTile.width, bottomTile.height * 0.75);
      
      // Save the mask for future use
      await fs.mkdir(config.MASKS_DIR, { recursive: true });
      await fs.writeFile(maskPath, maskCanvas.toBuffer('image/png'));
      
      maskImagePath = maskPath;
    }
    
    // Save temporary file for API upload
    const expandedImagePath = path.join(config.TEMP_DIR, `expanded_${Date.now()}.png`);
    await fs.writeFile(expandedImagePath, expandedCanvas.toBuffer('image/png'));
    
    // Save the expanded image for debugging
    const debugDir = path.join(config.TEMP_DIR, 'debug');
    await fs.mkdir(debugDir, { recursive: true });
    const expandedImageDebugPath = path.join(debugDir, `expanded_vertical_${position.regionX}_${position.regionY}_${position.x}_${position.y}.png`);
    await fs.copyFile(expandedImagePath, expandedImageDebugPath);
    logger.debug(`Saved expanded image to ${expandedImageDebugPath}`);
    
    logger.debug('Created expanded image and mask for API request');
    
    // Queue the API request to respect rate limits
    const newTilePath = await queueApiRequest(async () => {
      // Create a temporary directory for the response
      const responseDir = path.join(config.TEMP_DIR, 'responses');
      await fs.mkdir(responseDir, { recursive: true });
      const responseFilePath = path.join(responseDir, `response_${Date.now()}.json`);
      
      // Prepare the prompt
      const prompt = `Isometric game terrain tile with continuous, seamless connection from the bottom side. ${getTerrainPromptDetails(position)}. Ensure perfect continuity at the edges. Clash Royale style, clean colors.`;
      
      // Build the cURL command - escape quotes in the prompt
      const escapedPrompt = prompt.replace(/"/g, '\\"');
      const curlCommand = `curl -X POST "https://api.ideogram.ai/reframe" -H "Api-Key: ${config.IDEOGRAM_API_KEY}" -F "image_file=@${expandedImagePath}" -F "resolution=RESOLUTION_864_1152" -F "model=${config.IDEOGRAM_MODEL}" -F "style_type=REALISTIC" -F "prompt=${escapedPrompt}" -o "${responseFilePath}"`;
      
      // Log the request details for debugging
      logger.debug(`API request details: 
        - Model: ${config.IDEOGRAM_MODEL || 'V_2_TURBO'}
        - Image size: ${await getFileSize(expandedImagePath)} bytes
        - Mask size: ${await getFileSize(maskImagePath)} bytes
        - Prompt length: ${prompt.length} chars`);
      
      logger.debug(`Executing cURL command: ${curlCommand.replace(config.IDEOGRAM_API_KEY, config.IDEOGRAM_API_KEY.substring(0, 8) + '...')}`);
      
      // Execute the cURL command with retry logic
      let retryCount = 0;
      let errorText = '';
      
      while (retryCount < config.MAX_RETRIES) {
        try {
          logger.debug(`API request attempt ${retryCount + 1}/${config.MAX_RETRIES}`);
          
          // Execute the cURL command
          await execPromise(curlCommand, { maxBuffer: 1024 * 1024 * 10 });
          
          // Check if the response file exists and has content
          const stats = await fs.stat(responseFilePath);
          if (stats.size === 0) {
            throw new Error('Empty response file');
          }
          
          // Read the response file
          const responseText = await fs.readFile(responseFilePath, 'utf8');
          
          // Parse the response
          const data = JSON.parse(responseText);
          
          // Log the full response for debugging
          logger.debug(`API response: ${JSON.stringify(data)}`);
          
          if (!data.data || !data.data[0] || !data.data[0].url) {
            throw new Error('Invalid response from Ideogram API: ' + JSON.stringify(data));
          }
          
          logger.debug('Received successful response from Ideogram API');
          
          // Clean up temp files
          await fs.unlink(expandedImagePath).catch(err => logger.warn(`Failed to delete temp file: ${err.message}`));
          await fs.unlink(responseFilePath).catch(err => logger.warn(`Failed to delete temp file: ${err.message}`));
          
          // Download the generated image
          const generatedImageUrl = data.data[0].url;
          const generatedImage = await downloadImage(generatedImageUrl);
          
          // Crop and save the new tile
          const newTilePath = path.join(
            config.TILES_DIR, 
            `${position.regionX}_${position.regionY}_${position.x}_${position.y}.png`
          );
          
          await cropAndSaveTopSide(generatedImage, newTilePath);
          
          return newTilePath;
        } catch (error) {
          logger.warn(`API request failed (attempt ${retryCount + 1}/${config.MAX_RETRIES}): ${error.message}`);
          errorText = error.message;
          
          // Wait before retrying (exponential backoff)
          const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          
          retryCount++;
        }
      }
      
      throw new Error(`API request failed after ${config.MAX_RETRIES} attempts. Last error: ${errorText}`);
      
      // Crop and save the new tile
      const newTilePath = path.join(
        config.TILES_DIR, 
        `${position.regionX}_${position.regionY}_${position.x}_${position.y}.png`
      );
      
      await cropAndSaveTopSide(generatedImage, newTilePath);
      
      return newTilePath;
    });
    
    logger.info(`Successfully generated vertical tile at ${newTilePath}`);
    return newTilePath;
    
  } catch (error) {
    logger.error(`Error generating vertical tile: ${error.message}`, { position, error });
    
    // Generate fallback tile if needed
    if (config.USE_FALLBACK_TILES) {
      logger.warn('Generating fallback tile');
      return generateFallbackTile(position);
    }
    
    throw error;
  }
}

/**
 * Generates an interior tile based on left and bottom tiles
 */
async function generateInteriorTile(leftTilePath, bottomTilePath, position) {
  logger.info(`Generating interior tile at position ${JSON.stringify(position)}`);
  
  try {
    // Load the left and bottom tiles
    const leftTile = await loadImage(leftTilePath);
    const bottomTile = await loadImage(bottomTilePath);
    
    // Create composite canvas
    const compositeCanvas = createCanvas(leftTile.width + bottomTile.width / 3, bottomTile.height + leftTile.height / 3);
    const ctx = compositeCanvas.getContext('2d');
    
    // Draw the bottom tile
    ctx.drawImage(
      bottomTile,
      0,                        // Source X
      0,                        // Source Y
      bottomTile.width,         // Source Width
      bottomTile.height,        // Source Height
      0,                        // Destination X
      compositeCanvas.height - bottomTile.height, // Destination Y
      bottomTile.width,         // Destination Width
      bottomTile.height         // Destination Height
    );
    
    // Draw the left tile
    ctx.drawImage(
      leftTile,
      0,                        // Source X
      0,                        // Source Y
      leftTile.width,           // Source Width
      leftTile.height,          // Source Height
      0,                        // Destination X
      0,                        // Destination Y
      leftTile.width,           // Destination Width
      leftTile.height           // Destination Height
    );
    
    // Check if a mask already exists for this type of operation
    const maskFilename = `interior_mask_${TILE_WIDTH}x${TILE_HEIGHT}.png`;
    const maskPath = path.join(config.MASKS_DIR, maskFilename);
    
    let maskImagePath;
    
    try {
      // Check if the mask already exists
      await fs.access(maskPath);
      logger.debug(`Using existing interior mask from ${maskPath}`);
      maskImagePath = maskPath;
    } catch (err) {
      // Mask doesn't exist, create it
      logger.debug('Creating new interior mask');
      
      // Create mask showing only the area to be generated
      const maskCanvas = createCanvas(compositeCanvas.width, compositeCanvas.height);
      const maskCtx = maskCanvas.getContext('2d');
      
      // Fill with black (keep original)
      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      
      // Fill the top-right quadrant with white (area to generate)
      maskCtx.fillStyle = 'white';
      maskCtx.fillRect(
        leftTile.width * 2/3,        // X position (2/3 of the way through left tile)
        0,                            // Y position
        compositeCanvas.width - leftTile.width * 2/3,  // Width
        compositeCanvas.height - bottomTile.height * 2/3   // Height
      );
      
      // Save the mask for future use
      await fs.mkdir(config.MASKS_DIR, { recursive: true });
      await fs.writeFile(maskPath, maskCanvas.toBuffer('image/png'));
      
      maskImagePath = maskPath;
    }
    
    // Save temporary file for API upload
    const compositeImagePath = path.join(config.TEMP_DIR, `composite_${Date.now()}.png`);
    await fs.writeFile(compositeImagePath, compositeCanvas.toBuffer('image/png'));
    
    // Save the composite image for debugging
    const debugDir = path.join(config.TEMP_DIR, 'debug');
    await fs.mkdir(debugDir, { recursive: true });
    const compositeImageDebugPath = path.join(debugDir, `composite_${position.regionX}_${position.regionY}_${position.x}_${position.y}.png`);
    await fs.copyFile(compositeImagePath, compositeImageDebugPath);
    logger.debug(`Saved composite image to ${compositeImageDebugPath}`);
    
    logger.debug('Created composite image and mask for API request');
    
    // Queue the API request to respect rate limits
    const newTilePath = await queueApiRequest(async () => {
      // Create a temporary directory for the response
      const responseDir = path.join(config.TEMP_DIR, 'responses');
      await fs.mkdir(responseDir, { recursive: true });
      const responseFilePath = path.join(responseDir, `response_${Date.now()}.json`);
      
      // Prepare the prompt
      const prompt = `Isometric game terrain tile with continuous, seamless connection from the left and bottom sides. ${getTerrainPromptDetails(position)}. Ensure perfect continuity at all edges. Clash Royale style, clean colors.`;
      
      // Build the cURL command - escape quotes in the prompt
      const escapedPrompt = prompt.replace(/"/g, '\\"');
      const curlCommand = `curl -X POST "https://api.ideogram.ai/reframe" -H "Api-Key: ${config.IDEOGRAM_API_KEY}" -F "image_file=@${compositeImagePath}" -F "resolution=RESOLUTION_1024_1024" -F "model=${config.IDEOGRAM_MODEL}" -F "style_type=REALISTIC" -F "prompt=${escapedPrompt}" -o "${responseFilePath}"`;
      
      // Log the request details for debugging
      logger.debug(`API request details: 
        - Model: ${config.IDEOGRAM_MODEL || 'V_2_TURBO'}
        - Image size: ${await getFileSize(compositeImagePath)} bytes
        - Mask size: ${await getFileSize(maskImagePath)} bytes
        - Prompt length: ${prompt.length} chars`);
      
      logger.debug(`Executing cURL command: ${curlCommand.replace(config.IDEOGRAM_API_KEY, config.IDEOGRAM_API_KEY.substring(0, 8) + '...')}`);
      
      // Execute the cURL command with retry logic
      let retryCount = 0;
      let errorText = '';
      
      while (retryCount < config.MAX_RETRIES) {
        try {
          logger.debug(`API request attempt ${retryCount + 1}/${config.MAX_RETRIES}`);
          
          // Execute the cURL command
          await execPromise(curlCommand, { maxBuffer: 1024 * 1024 * 10 });
          
          // Check if the response file exists and has content
          const stats = await fs.stat(responseFilePath);
          if (stats.size === 0) {
            throw new Error('Empty response file');
          }
          
          // Read the response file
          const responseText = await fs.readFile(responseFilePath, 'utf8');
          logger.debug(`API response text: ${responseText.substring(0, 500)}${responseText.length > 500 ? '...(truncated)' : ''}`);
          
          // Parse the response
          const data = JSON.parse(responseText);
          
          if (!data.data || !data.data[0] || !data.data[0].url) {
            throw new Error('Invalid response from Ideogram API: ' + JSON.stringify(data));
          }
          
          logger.debug('Received successful response from Ideogram API');
          
          // Clean up temp files
          await fs.unlink(compositeImagePath).catch(err => logger.warn(`Failed to delete temp file: ${err.message}`));
          await fs.unlink(responseFilePath).catch(err => logger.warn(`Failed to delete temp file: ${err.message}`));
          
          // Download the generated image
          const generatedImageUrl = data.data[0].url;
          const generatedImage = await downloadImage(generatedImageUrl);
          
          // Crop and save the new tile
          const newTilePath = path.join(
            config.TILES_DIR, 
            `${position.regionX}_${position.regionY}_${position.x}_${position.y}.png`
          );
          
          await cropAndSaveTopRightQuadrant(generatedImage, newTilePath);
          
          return newTilePath;
        } catch (error) {
          logger.warn(`API request failed (attempt ${retryCount + 1}/${config.MAX_RETRIES}): ${error.message}`);
          errorText = error.message;
          
          // Wait before retrying (exponential backoff)
          const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          
          retryCount++;
        }
      }
      
      throw new Error(`API request failed after ${config.MAX_RETRIES} attempts. Last error: ${errorText}`);
      
      // Crop and save the new tile
      const newTilePath = path.join(
        config.TILES_DIR, 
        `${position.regionX}_${position.regionY}_${position.x}_${position.y}.png`
      );
      
      await cropAndSaveTopRightQuadrant(generatedImage, newTilePath);
      
      return newTilePath;
    });
    
    logger.info(`Successfully generated interior tile at ${newTilePath}`);
    return newTilePath;
    
  } catch (error) {
    logger.error(`Error generating interior tile: ${error.message}`, { position, error });
    
    // Generate fallback tile if needed
    if (config.USE_FALLBACK_TILES) {
      logger.warn('Generating fallback tile');
      return generateFallbackTile(position);
    }
    
    throw error;
  }
}

/**
 * Downloads an image from a URL using cURL
 */
async function downloadImage(url) {
  logger.debug(`Downloading image from ${url}`);
  
  try {
    const tempPath = path.join(config.TEMP_DIR, `download_${Date.now()}.png`);
    
    // Build the cURL command
    const curlCommand = `curl -s "${url}" -o "${tempPath}"`;
    
    // Execute the cURL command
    await execPromise(curlCommand);
    
    logger.debug(`Image downloaded to ${tempPath}`);
    
    // Process the image to remove background and shadows
    await removeBackground(tempPath);
    
    return tempPath;
  } catch (error) {
    logger.error(`Error downloading image: ${error.message}`);
    throw error;
  }
}

/**
 * Remove background using Pixelcut API with enhanced error handling, caching, and fallback
 */
async function removeBackground(imagePath) {
  try {
    logger.info(`Removing background from image using Pixelcut API: ${imagePath}`);
    
    // Check if we have a cached version of this processed image
    const imageHash = await getImageHash(imagePath);
    const cachedImagePath = path.join(config.TEMP_DIR, 'bg_cache', `${imageHash}.png`);
    
    try {
      // Check if a cached version exists
      await fs.access(cachedImagePath);
      logger.info(`Using cached background-removed image: ${cachedImagePath}`);
      
      // Copy the cached version to the target path
      await fs.copyFile(cachedImagePath, imagePath);
      return imagePath;
    } catch (err) {
      // No cached version, proceed with API call
      logger.debug(`No cached version found, proceeding with API call`);
    }
    
    // Read the file for processing
    const imageBuffer = await fs.readFile(imagePath);
    
    // Try Pixelcut API first
    try {
      // Create form data for the API request
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('image', imageBuffer, { filename: path.basename(imagePath) });
      formData.append('format', 'png');
      
      // Make the API request to Pixelcut
      logger.debug(`Sending request to Pixelcut API`);
      const response = await fetch('https://api.developer.pixelcut.ai/v1/remove-background', {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.PIXELCUT_API_KEY || config.PIXELCUT_API_KEY,
          'Accept': 'application/json'
        },
        body: formData,
        timeout: 30000 // 30 second timeout
      });
      
      // Check if the request was successful
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pixelcut API request failed with status ${response.status}: ${errorText}`);
      }
      
      // Get the response with the URL to the processed image
      const data = await response.json();
      
      if (!data.result_url) {
        throw new Error('Invalid response from Pixelcut API: No result URL found');
      }
      
      // Download the processed image
      logger.debug(`Downloading processed image from ${data.result_url}`);
      const processedImageResponse = await fetch(data.result_url);
      
      if (!processedImageResponse.ok) {
        throw new Error(`Failed to download processed image: ${processedImageResponse.status}`);
      }
      
      // Get the processed image with transparent background
      const buffer = await processedImageResponse.buffer();
      
      // Save the processed image back to the original path
      await fs.writeFile(imagePath, buffer);
      
      // Also save to cache for future use
      await fs.mkdir(path.join(config.TEMP_DIR, 'bg_cache'), { recursive: true });
      await fs.writeFile(cachedImagePath, buffer);
      
      logger.info(`Background removed successfully using Pixelcut API: ${imagePath}`);
      logger.debug(`Cached background-removed image at: ${cachedImagePath}`);
      
      return imagePath;
    } catch (pixelcutError) {
      // Log the Pixelcut error
      logger.warn(`Pixelcut API error: ${pixelcutError.message}, trying Remove.bg API as fallback`);
      
      // Try Remove.bg API as fallback
      try {
        // Create form data for the Remove.bg API request
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('image_file', imageBuffer, { filename: path.basename(imagePath) });
        formData.append('size', 'auto');
        
        // Make the API request to Remove.bg
        logger.debug(`Sending request to Remove.bg API`);
        const response = await fetch('https://api.remove.bg/v1.0/removebg', {
          method: 'POST',
          headers: {
            'X-Api-Key': process.env.REMOVE_BG_API_KEY || config.REMOVE_BG_API_KEY,
          },
          body: formData,
          timeout: 30000 // 30 second timeout
        });
        
        // Check if the request was successful
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Remove.bg API request failed with status ${response.status}: ${errorText}`);
        }
        
        // Get the processed image with transparent background
        const buffer = await response.buffer();
        
        // Save the processed image back to the original path
        await fs.writeFile(imagePath, buffer);
        
        // Also save to cache for future use
        await fs.mkdir(path.join(config.TEMP_DIR, 'bg_cache'), { recursive: true });
        await fs.writeFile(cachedImagePath, buffer);
        
        logger.info(`Background removed successfully using Remove.bg API: ${imagePath}`);
        logger.debug(`Cached background-removed image at: ${cachedImagePath}`);
        
        return imagePath;
      } catch (removeBgError) {
        // Log the Remove.bg error
        logger.warn(`Remove.bg API error: ${removeBgError.message}, falling back to local processing`);
        throw new Error(`Both background removal APIs failed: ${pixelcutError.message} and ${removeBgError.message}`);
      }
    }
  } catch (error) {
    logger.error(`Error removing background: ${error.message}`);
    
    // Try local image processing as a last resort
    try {
      logger.info(`Attempting local background removal for ${imagePath}`);
      
      // Load the image using canvas
      const { Image } = require('canvas');
      const img = new Image();
      img.src = await fs.readFile(imagePath);
      
      // Create a canvas with the same dimensions
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      
      // Draw the image
      ctx.drawImage(img, 0, 0);
      
      // Get the image data
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const data = imageData.data;
      
      // Simple background removal - make white/light pixels transparent
      // This is a basic approach and won't work well for all images
      for (let i = 0; i < data.length; i += 4) {
        // Check if pixel is very light (close to white)
        if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
          // Make it transparent
          data[i + 3] = 0;
        }
      }
      
      // Put the modified image data back
      ctx.putImageData(imageData, 0, 0);
      
      // Save the processed image
      const buffer = canvas.toBuffer('image/png');
      await fs.writeFile(imagePath, buffer);
      
      logger.info(`Basic local background removal completed for ${imagePath}`);
      return imagePath;
    } catch (localError) {
      logger.error(`Local background removal failed: ${localError.message}`);
      // Return the original image path if all processing fails
      return imagePath;
    }
  }
}

/**
 * Generate a hash for an image file to use for caching
 */
async function getImageHash(imagePath) {
  try {
    const crypto = require('crypto');
    const fileBuffer = await fs.readFile(imagePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex').substring(0, 16); // Use first 16 chars of hash
  } catch (error) {
    logger.error(`Error generating image hash: ${error.message}`);
    // Fallback to a timestamp-based identifier
    return `nohash_${Date.now()}`;
  }
}

/**
 * Crops the right side of an image and saves it with enhanced image processing
 */
async function cropAndSaveRightSide(imagePath, outputPath) {
  logger.debug(`Cropping right side of image ${imagePath} to ${outputPath}`);
  
  try {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(TILE_WIDTH, TILE_HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Save the uncropped image for debugging
    const debugDir = path.join(config.TEMP_DIR, 'debug');
    await fs.mkdir(debugDir, { recursive: true });
    const uncropeedFilename = path.basename(outputPath).replace('.png', '_uncropped.png');
    const uncropeedPath = path.join(debugDir, uncropeedFilename);
    
    // Copy the original image to the debug directory
    await fs.copyFile(imagePath, uncropeedPath);
    logger.debug(`Saved uncropped image to ${uncropeedPath}`);
    
    // Draw only the right 20% of the generated image (the newly generated part)
    ctx.drawImage(
      image,
      image.width * 0.8,  // Source X (start from 80% of the way)
      0,                  // Source Y
      image.width * 0.2,  // Source Width (take 20% of the image)
      image.height,       // Source Height
      0,                  // Destination X
      0,                  // Destination Y
      canvas.width,       // Destination Width
      canvas.height       // Destination Height
    );
    
    // Apply image enhancements
    enhanceImage(ctx, canvas.width, canvas.height);
    
    // Save the cropped image
    await fs.writeFile(outputPath, canvas.toBuffer('image/png'));
    
    // Also save a copy of the cropped image to the debug directory
    const croppedFilename = path.basename(outputPath).replace('.png', '_cropped.png');
    const croppedPath = path.join(debugDir, croppedFilename);
    await fs.writeFile(croppedPath, canvas.toBuffer('image/png'));
    logger.debug(`Saved cropped image to ${croppedPath}`);
    
    // Clean up temp file
    await fs.unlink(imagePath).catch(err => logger.warn(`Failed to delete temp file: ${err.message}`));
    
    return outputPath;
  } catch (error) {
    logger.error(`Error cropping image: ${error.message}`);
    throw error;
  }
}

/**
 * Apply image enhancements to improve visual quality
 */
function enhanceImage(ctx, width, height) {
  try {
    // Get the image data
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Enhance contrast and saturation slightly
    for (let i = 0; i < data.length; i += 4) {
      // Skip fully transparent pixels
      if (data[i + 3] === 0) continue;
      
      // Increase saturation slightly
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Calculate luminance (brightness)
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Saturation factor (1.1 = 10% more saturated)
      const saturationFactor = 1.1;
      
      // Apply saturation adjustment
      data[i] = Math.max(0, Math.min(255, luminance + saturationFactor * (r - luminance)));
      data[i + 1] = Math.max(0, Math.min(255, luminance + saturationFactor * (g - luminance)));
      data[i + 2] = Math.max(0, Math.min(255, luminance + saturationFactor * (b - luminance)));
    }
    
    // Put the modified image data back
    ctx.putImageData(imageData, 0, 0);
    
    // Apply a very slight sharpening effect
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.1;
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    
  } catch (error) {
    logger.warn(`Image enhancement failed, continuing with original: ${error.message}`);
    // Continue with the original image if enhancement fails
  }
}

/**
 * Crops the top side of an image and saves it with enhanced image processing
 */
async function cropAndSaveTopSide(imagePath, outputPath) {
  logger.debug(`Cropping top side of image ${imagePath} to ${outputPath}`);
  
  try {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(TILE_WIDTH, TILE_HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Save the uncropped image for debugging
    const debugDir = path.join(config.TEMP_DIR, 'debug');
    await fs.mkdir(debugDir, { recursive: true });
    const uncropeedFilename = path.basename(outputPath).replace('.png', '_uncropped.png');
    const uncropeedPath = path.join(debugDir, uncropeedFilename);
    
    // Copy the original image to the debug directory
    await fs.copyFile(imagePath, uncropeedPath);
    logger.debug(`Saved uncropped image to ${uncropeedPath}`);
    
    // Draw only the top 75% of the generated image (the newly generated part)
    ctx.drawImage(
      image,
      0,                  // Source X
      0,                  // Source Y
      image.width,        // Source Width
      image.height * 0.75,   // Source Height (take 75% of the image)
      0,                  // Destination X
      0,                  // Destination Y
      canvas.width,       // Destination Width
      canvas.height       // Destination Height
    );
    
    // Apply image enhancements
    enhanceImage(ctx, canvas.width, canvas.height);
    
    // Save the cropped image
    await fs.writeFile(outputPath, canvas.toBuffer('image/png'));
    
    // Also save a copy of the cropped image to the debug directory
    const croppedFilename = path.basename(outputPath).replace('.png', '_cropped.png');
    const croppedPath = path.join(debugDir, croppedFilename);
    await fs.writeFile(croppedPath, canvas.toBuffer('image/png'));
    logger.debug(`Saved cropped image to ${croppedPath}`);
    
    // Clean up temp file
    await fs.unlink(imagePath).catch(err => logger.warn(`Failed to delete temp file: ${err.message}`));
    
    return outputPath;
  } catch (error) {
    logger.error(`Error cropping image: ${error.message}`);
    throw error;
  }
}

/**
 * Crops the top-right quadrant of an image and saves it with enhanced image processing
 */
async function cropAndSaveTopRightQuadrant(imagePath, outputPath) {
  logger.debug(`Cropping top-right quadrant of image ${imagePath} to ${outputPath}`);
  
  try {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(TILE_WIDTH, TILE_HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Save the uncropped image for debugging
    const debugDir = path.join(config.TEMP_DIR, 'debug');
    await fs.mkdir(debugDir, { recursive: true });
    const uncropeedFilename = path.basename(outputPath).replace('.png', '_uncropped.png');
    const uncropeedPath = path.join(debugDir, uncropeedFilename);
    
    // Copy the original image to the debug directory
    await fs.copyFile(imagePath, uncropeedPath);
    logger.debug(`Saved uncropped image to ${uncropeedPath}`);
    
    // Calculate the position of the top-right quadrant
    const sourceX = image.width * 2/3;
    const sourceY = 0;
    const sourceWidth = image.width / 3;
    const sourceHeight = image.height * 2/3;
    
    // Draw only the top-right quadrant
    ctx.drawImage(
      image,
      sourceX,          // Source X
      sourceY,          // Source Y
      sourceWidth,      // Source Width
      sourceHeight,     // Source Height
      0,                // Destination X
      0,                // Destination Y
      canvas.width,     // Destination Width
      canvas.height     // Destination Height
    );
    
    // Apply image enhancements
    enhanceImage(ctx, canvas.width, canvas.height);
    
    // Save the cropped image
    await fs.writeFile(outputPath, canvas.toBuffer('image/png'));
    
    // Also save a copy of the cropped image to the debug directory
    const croppedFilename = path.basename(outputPath).replace('.png', '_cropped.png');
    const croppedPath = path.join(debugDir, croppedFilename);
    await fs.writeFile(croppedPath, canvas.toBuffer('image/png'));
    logger.debug(`Saved cropped image to ${croppedPath}`);
    
    // Clean up temp file
    await fs.unlink(imagePath).catch(err => logger.warn(`Failed to delete temp file: ${err.message}`));
    
    return outputPath;
  } catch (error) {
    logger.error(`Error cropping image: ${error.message}`);
    throw error;
  }
}

/**
 * Helper function to get file size
 */
async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    logger.error(`Error getting file size: ${error.message}`);
    return 'unknown';
  }
}

/**
 * Gets terrain prompt details based on position
 */
function getTerrainPromptDetails(position) {
  // Get terrain code for this position from our region data
  const terrainCode = getTerrainCodeForPosition(position);
  
  // Parse the code to extract components
  const [baseType, ...modifiers] = terrainCode.split('|');
  
  // Build a detailed prompt based on the terrain code
  let prompt = "";
  
  switch (baseType) {
    case "P-LUS":
      prompt = "lush green grassland with short grass and some wildflowers";
      break;
    case "F-OAK":
      prompt = "dense oak forest with mature trees and undergrowth";
      break;
    case "W-RIV":
      prompt = "flowing river with clear water and subtle ripples";
      break;
    default:
      prompt = "grassy plains with subtle texture variations";
  }
  
  // Add details from modifiers if they exist
  if (modifiers && modifiers.length > 0) {
    modifiers.forEach(mod => {
      if (mod.startsWith("E-")) {
        // Elevation modifiers
        switch (mod) {
          case "E-FLT":
            prompt += ", completely flat terrain";
            break;
          case "E-SLI":
            prompt += ", with slight elevation changes";
            break;
          default:
            // No additional prompt
        }
      } else if (mod.startsWith("X-")) {
        // Feature modifiers
        switch (mod) {
          case "X-TRE":
            prompt += ", with scattered trees";
            break;
          case "X-RCK":
            prompt += ", with small rocks and pebbles";
            break;
          default:
            // No additional prompt
        }
      }
    });
  }
  
  return prompt;
}

/**
 * Gets terrain code for a position
 */
function getTerrainCodeForPosition(position) {
  // This would normally come from a database or terrain generation algorithm
  // For now, use a simple deterministic approach based on position
  
  // Use position to seed a simple terrain type
  const sum = position.x + position.y + position.regionX * 10 + position.regionY * 10;
  
  // Base terrain types
  const baseTypes = ["P-LUS", "F-OAK", "W-RIV"];
  const baseType = baseTypes[sum % baseTypes.length];
  
  // Elevation modifiers
  const elevations = ["E-FLT", "E-SLI"];
  const elevation = elevations[(sum * 3) % elevations.length];
  
  // Feature modifiers
  const features = ["X-TRE", "X-RCK", ""];
  const feature = features[(sum * 7) % features.length];
  
  // Combine modifiers
  let terrainCode = baseType + "|" + elevation;
  if (feature) {
    terrainCode += "|" + feature;
  }
  
  logger.debug(`Generated terrain code ${terrainCode} for position ${JSON.stringify(position)}`);
  return terrainCode;
}

/**
 * Generates a fallback tile when API generation fails
 */
async function generateFallbackTile(position) {
  logger.info(`Generating fallback tile for position ${JSON.stringify(position)}`);
  
  try {
    // Create a basic canvas
    const canvas = createCanvas(TILE_WIDTH, TILE_HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Get base color from terrain type
    const terrainCode = getTerrainCodeForPosition(position);
    const baseColor = getTerrainBaseColor(terrainCode);
    
    // Fill with base color
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add position text for debugging
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.font = '20px Arial';
    ctx.fillText(`Region: ${position.regionX},${position.regionY}`, 20, 30);
    ctx.fillText(`Tile: ${position.x},${position.y}`, 20, 60);
    ctx.fillText(`Terrain: ${terrainCode}`, 20, 90);
    
    // Save the fallback tile
    const tilePath = path.join(
      config.TILES_DIR, 
      `${position.regionX}_${position.regionY}_${position.x}_${position.y}.png`
    );
    
    await fs.writeFile(tilePath, canvas.toBuffer('image/png'));
    
    logger.info(`Fallback tile saved to ${tilePath}`);
    return tilePath;
  } catch (error) {
    logger.error(`Error generating fallback tile: ${error.message}`);
    throw error;
  }
}

/**
 * Gets a base color for a terrain type
 */
function getTerrainBaseColor(terrainCode) {
  const baseType = terrainCode.split('|')[0];
  
  switch (baseType) {
    case "P-LUS":
      return '#4CAF50';  // Green
    case "F-OAK":
      return '#2E7D32';  // Dark green
    case "W-RIV":
      return '#2196F3';  // Blue
    default:
      return '#8BC34A';  // Light green
  }
}

/**
 * Queues an API request to respect rate limits with improved queue management
 */
async function queueApiRequest(requestFunction) {
  return new Promise((resolve, reject) => {
    const queuePosition = apiQueue.length + 1;
    const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    apiQueue.push({
      id: requestId,
      requestFunction,
      resolve,
      reject,
      timestamp: Date.now(),
      priority: 1 // Default priority (higher number = higher priority)
    });
    
    logger.debug(`Added request ${requestId} to queue (position ${queuePosition})`);
    
    // Set a timeout to increase priority of this request if it waits too long
    setTimeout(() => {
      const queueItem = apiQueue.find(item => item.id === requestId);
      if (queueItem) {
        queueItem.priority += 1;
        logger.debug(`Increased priority of request ${requestId} to ${queueItem.priority} due to wait time`);
        
        // Re-sort the queue based on priority
        apiQueue.sort((a, b) => b.priority - a.priority);
      }
    }, 60000); // After 1 minute, increase priority
    
    if (!processingQueue) {
      processQueue();
    }
  });
}

/**
 * Processes the API request queue in batches with improved error handling and retry logic
 */
async function processQueue() {
  if (apiQueue.length === 0) {
    processingQueue = false;
    return;
  }
  
  processingQueue = true;
  
  // If we're already processing the maximum number of batches, wait
  if (activeBatchCount >= 1) {
    setTimeout(() => {
      processQueue();
    }, 500);
    return;
  }
  
  // Increase the active batch count
  activeBatchCount++;
  
  // Sort the queue by priority before processing
  apiQueue.sort((a, b) => b.priority - a.priority);
  
  // Take up to BATCH_SIZE requests from the queue
  const batchSize = Math.min(BATCH_SIZE, apiQueue.length);
  const batch = apiQueue.splice(0, batchSize);
  
  logger.info(`Processing batch of ${batchSize} API requests (${apiQueue.length} remaining in queue)`);
  
  // Process all requests in the batch concurrently
  const batchPromises = batch.map(async (request, index) => {
    try {
      // Add a small delay between requests in the same batch to avoid overwhelming the API
      const staggerDelay = index * 250; // 250ms between each request in the batch
      if (staggerDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, staggerDelay));
      }
      
      // Execute the request with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API request timeout')), config.API_TIMEOUT || 120000);
      });
      
      const result = await Promise.race([
        request.requestFunction(),
        timeoutPromise
      ]);
      
      logger.debug(`Request ${request.id} completed successfully`);
      request.resolve(result);
    } catch (error) {
      logger.error(`API request ${request.id} in batch failed: ${error.message}`);
      
      // Check if we should retry this request
      if (!request.retryCount || request.retryCount < 2) { // Max 2 retries
        request.retryCount = (request.retryCount || 0) + 1;
        request.priority += 2; // Increase priority for retries
        
        logger.info(`Requeueing request ${request.id} for retry attempt ${request.retryCount}`);
        
        // Put back in the queue with higher priority
        apiQueue.push(request);
      } else {
        logger.warn(`Request ${request.id} failed after ${request.retryCount} retry attempts`);
        request.reject(error);
      }
    }
  });
  
  // Wait for all requests in the batch to complete
  await Promise.all(batchPromises)
    .catch(err => logger.error(`Error processing batch: ${err.message}`));
  
  // Decrease the active batch count
  activeBatchCount--;
  
  // Calculate dynamic delay based on queue size
  const queueSizeMultiplier = Math.max(0.5, Math.min(2, apiQueue.length / 10)); // Between 0.5 and 2
  const dynamicDelay = Math.round(1000 * queueSizeMultiplier);
  
  // Add a delay before processing the next batch to respect rate limits
  setTimeout(() => {
    processQueue();
  }, dynamicDelay);
  
  logger.debug(`Next batch will process in ${dynamicDelay}ms (queue size: ${apiQueue.length})`);
}

module.exports = {
  generateNextHorizontalTile,
  generateNextVerticalTile,
  generateInteriorTile,
  generateFallbackTile,
  getTerrainCodeForPosition,
  removeBackground,
  enhanceImage,
  getImageHash,
  // Add these exports
  apiQueue,
  activeBatchCount,
  BATCH_SIZE,
  // Add queue management utilities
  queueApiRequest,
  processQueue
};
