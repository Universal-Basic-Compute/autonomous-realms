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

/**
 * Generates a horizontal tile based on a previous tile
 */
async function generateNextHorizontalTile(previousTilePath, position) {
  logger.info(`Generating horizontal tile at position ${JSON.stringify(position)}`);
  
  try {
    // Load the previous tile image
    const previousTile = await loadImage(previousTilePath);
    
    // Create expanded canvas
    const expandedCanvas = createCanvas(previousTile.width * 1.5, previousTile.height);
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
      
      // Fill the right 50% with white (area to generate)
      maskCtx.fillStyle = 'white';
      maskCtx.fillRect(previousTile.width, 0, previousTile.width * 0.5, previousTile.height);
      
      // Save the mask for future use
      await fs.mkdir(config.MASKS_DIR, { recursive: true });
      await fs.writeFile(maskPath, maskCanvas.toBuffer('image/png'));
      
      maskImagePath = maskPath;
    }
    
    // Save temporary file for API upload
    const expandedImagePath = path.join(config.TEMP_DIR, `expanded_${Date.now()}.png`);
    await fs.writeFile(expandedImagePath, expandedCanvas.toBuffer('image/png'));
    
    logger.debug('Created expanded image and mask for API request');
    
    // Queue the API request to respect rate limits
    const newTilePath = await queueApiRequest(async () => {
      // Create a temporary directory for the response
      const responseDir = path.join(config.TEMP_DIR, 'responses');
      await fs.mkdir(responseDir, { recursive: true });
      const responseFilePath = path.join(responseDir, `response_${Date.now()}.json`);
      
      // Prepare the prompt
      const prompt = `Isometric game terrain tile continuing seamlessly from the left side. ${getTerrainPromptDetails(position)}. Clash Royale style, clean colors, transparent background.`;
      
      // Build the cURL command - escape quotes in the prompt
      const escapedPrompt = prompt.replace(/"/g, '\\"');
      const curlCommand = `curl -X POST "https://api.ideogram.ai/reframe" -H "Api-Key: ${config.IDEOGRAM_API_KEY}" -F "image_file=@${expandedImagePath}" -F "resolution=RESOLUTION_1024_768" -F "model=${config.IDEOGRAM_MODEL}" -F "prompt=${escapedPrompt}" -o "${responseFilePath}"`;
      
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
    const expandedCanvas = createCanvas(bottomTile.width, bottomTile.height * 1.5);
    const ctx = expandedCanvas.getContext('2d');
    
    // Draw the bottom tile at the bottom
    ctx.drawImage(bottomTile, 0, expandedCanvas.height - bottomTile.height);
    
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
      
      // Fill the top 50% with white (area to generate)
      maskCtx.fillStyle = 'white';
      maskCtx.fillRect(0, 0, bottomTile.width, bottomTile.height * 0.5);
      
      // Save the mask for future use
      await fs.mkdir(config.MASKS_DIR, { recursive: true });
      await fs.writeFile(maskPath, maskCanvas.toBuffer('image/png'));
      
      maskImagePath = maskPath;
    }
    
    // Save temporary file for API upload
    const expandedImagePath = path.join(config.TEMP_DIR, `expanded_${Date.now()}.png`);
    await fs.writeFile(expandedImagePath, expandedCanvas.toBuffer('image/png'));
    
    logger.debug('Created expanded image and mask for API request');
    
    // Queue the API request to respect rate limits
    const newTilePath = await queueApiRequest(async () => {
      // Create a temporary directory for the response
      const responseDir = path.join(config.TEMP_DIR, 'responses');
      await fs.mkdir(responseDir, { recursive: true });
      const responseFilePath = path.join(responseDir, `response_${Date.now()}.json`);
      
      // Prepare the prompt
      const prompt = `Isometric game terrain tile continuing seamlessly from the bottom side. ${getTerrainPromptDetails(position)}. Clash Royale style, clean colors, transparent background.`;
      
      // Build the cURL command - escape quotes in the prompt
      const escapedPrompt = prompt.replace(/"/g, '\\"');
      const curlCommand = `curl -X POST "https://api.ideogram.ai/reframe" -H "Api-Key: ${config.IDEOGRAM_API_KEY}" -F "image_file=@${expandedImagePath}" -F "resolution=RESOLUTION_768_1024" -F "model=${config.IDEOGRAM_MODEL}" -F "prompt=${escapedPrompt}" -o "${responseFilePath}"`;
      
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
    
    logger.debug('Created composite image and mask for API request');
    
    // Queue the API request to respect rate limits
    const newTilePath = await queueApiRequest(async () => {
      // Create a temporary directory for the response
      const responseDir = path.join(config.TEMP_DIR, 'responses');
      await fs.mkdir(responseDir, { recursive: true });
      const responseFilePath = path.join(responseDir, `response_${Date.now()}.json`);
      
      // Prepare the prompt
      const prompt = `Isometric game terrain tile continuing seamlessly from the left and bottom sides. ${getTerrainPromptDetails(position)}. Clash Royale style, clean colors, transparent background.`;
      
      // Build the cURL command - escape quotes in the prompt
      const escapedPrompt = prompt.replace(/"/g, '\\"');
      const curlCommand = `curl -X POST "https://api.ideogram.ai/reframe" -H "Api-Key: ${config.IDEOGRAM_API_KEY}" -F "image_file=@${compositeImagePath}" -F "resolution=RESOLUTION_1024_1024" -F "model=${config.IDEOGRAM_MODEL}" -F "prompt=${escapedPrompt}" -o "${responseFilePath}"`;
      
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
    return tempPath;
  } catch (error) {
    logger.error(`Error downloading image: ${error.message}`);
    throw error;
  }
}

/**
 * Crops the right side of an image and saves it
 */
async function cropAndSaveRightSide(imagePath, outputPath) {
  logger.debug(`Cropping right side of image ${imagePath} to ${outputPath}`);
  
  try {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(TILE_WIDTH, TILE_HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Draw only the right 66.6% of the generated image
    ctx.drawImage(
      image,
      image.width / 3,  // Source X (start from 1/3 of the way)
      0,                // Source Y
      image.width * 2/3,// Source Width (take 2/3 of the image)
      image.height,     // Source Height
      0,                // Destination X
      0,                // Destination Y
      canvas.width,     // Destination Width
      canvas.height     // Destination Height
    );
    
    await fs.writeFile(outputPath, canvas.toBuffer('image/png'));
    
    // Clean up temp file
    await fs.unlink(imagePath).catch(err => logger.warn(`Failed to delete temp file: ${err.message}`));
    
    return outputPath;
  } catch (error) {
    logger.error(`Error cropping image: ${error.message}`);
    throw error;
  }
}

/**
 * Crops the top side of an image and saves it
 */
async function cropAndSaveTopSide(imagePath, outputPath) {
  logger.debug(`Cropping top side of image ${imagePath} to ${outputPath}`);
  
  try {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(TILE_WIDTH, TILE_HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Draw only the top 66.6% of the generated image
    ctx.drawImage(
      image,
      0,                // Source X
      0,                // Source Y
      image.width,      // Source Width
      image.height * 2/3,// Source Height (take 2/3 of the image)
      0,                // Destination X
      0,                // Destination Y
      canvas.width,     // Destination Width
      canvas.height     // Destination Height
    );
    
    await fs.writeFile(outputPath, canvas.toBuffer('image/png'));
    
    // Clean up temp file
    await fs.unlink(imagePath).catch(err => logger.warn(`Failed to delete temp file: ${err.message}`));
    
    return outputPath;
  } catch (error) {
    logger.error(`Error cropping image: ${error.message}`);
    throw error;
  }
}

/**
 * Crops the top-right quadrant of an image and saves it
 */
async function cropAndSaveTopRightQuadrant(imagePath, outputPath) {
  logger.debug(`Cropping top-right quadrant of image ${imagePath} to ${outputPath}`);
  
  try {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(TILE_WIDTH, TILE_HEIGHT);
    const ctx = canvas.getContext('2d');
    
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
    
    await fs.writeFile(outputPath, canvas.toBuffer('image/png'));
    
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
 * Queues an API request to respect rate limits
 */
async function queueApiRequest(requestFunction) {
  return new Promise((resolve, reject) => {
    apiQueue.push({
      requestFunction,
      resolve,
      reject,
      timestamp: Date.now()
    });
    
    if (!processingQueue) {
      processQueue();
    }
  });
}

/**
 * Processes the API request queue
 */
async function processQueue() {
  if (apiQueue.length === 0) {
    processingQueue = false;
    return;
  }
  
  processingQueue = true;
  const { requestFunction, resolve, reject, timestamp } = apiQueue.shift();
  
  try {
    // Calculate time to wait based on rate limit
    const now = Date.now();
    const timeElapsed = now - timestamp;
    const timeToWait = Math.max(0, 1000 / config.API_RATE_LIMIT - timeElapsed);
    
    if (timeToWait > 0) {
      logger.debug(`Rate limiting: waiting ${timeToWait}ms before next API request`);
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    
    // Execute the request
    const result = await requestFunction();
    resolve(result);
  } catch (error) {
    logger.error(`API request failed: ${error.message}`);
    reject(error);
  } finally {
    // Continue with queue even on error
    setTimeout(() => {
      processQueue();
    }, 100);
  }
}

module.exports = {
  generateNextHorizontalTile,
  generateNextVerticalTile,
  generateInteriorTile,
  generateFallbackTile,
  getTerrainCodeForPosition
};
