const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const { createCanvas, loadImage } = require('canvas');
const config = require('../config');
const logger = require('../utils/logger');
const tileService = require('./tileGenerationService');

// Constants
const CLOSE_MAP_SIZE = 16;
const TILE_WIDTH = 128;
const TILE_HEIGHT = 128;

/**
 * Generate a close map for a specific tile
 */
async function generateCloseMap(regionX, regionY, tileX, tileY, terrainCode, terrainDescription) {
  try {
    logger.info(`Generating close map for tile (${regionX},${regionY},${tileX},${tileY}) with terrain ${terrainCode}`);
    
    // Create directory for this close map
    const closeMapDir = path.join(
      config.TILES_DIR, 
      'close_maps',
      `${regionX}_${regionY}_${tileX}_${tileY}`
    );
    
    await fs.mkdir(closeMapDir, { recursive: true });
    
    // Check if we already have metadata for this close map
    const metadataPath = path.join(closeMapDir, 'metadata.json');
    let tileDescriptions = [];
    
    try {
      // Check if metadata already exists
      const existingMetadata = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(existingMetadata);
      
      if (metadata && metadata.tileDescriptions && metadata.tileDescriptions.length === CLOSE_MAP_SIZE * CLOSE_MAP_SIZE) {
        logger.info(`Using existing close map metadata for tile (${regionX},${regionY},${tileX},${tileY})`);
        tileDescriptions = metadata.tileDescriptions;
      } else {
        // Metadata exists but is incomplete, regenerate
        logger.info(`Existing metadata is incomplete, regenerating for tile (${regionX},${regionY},${tileX},${tileY})`);
        tileDescriptions = await generateTileDescriptions(terrainCode, terrainDescription);
      }
    } catch (err) {
      // Metadata doesn't exist, generate it
      logger.info(`Generating new close map metadata for tile (${regionX},${regionY},${tileX},${tileY})`);
      tileDescriptions = await generateTileDescriptions(terrainCode, terrainDescription);
    }
    
    // Save metadata
    const metadata = {
      regionX,
      regionY,
      tileX,
      tileY,
      terrainCode,
      terrainDescription,
      size: CLOSE_MAP_SIZE,
      tileDescriptions,
      generatedAt: new Date().toISOString()
    };
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    // Generate tiles in batches of 4x4
    await generateTilesInBatches(closeMapDir, tileDescriptions);
    
    return {
      success: true,
      message: `Close map generated for tile (${regionX},${regionY},${tileX},${tileY})`,
      metadata
    };
  } catch (error) {
    logger.error(`Error generating close map: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Generate descriptions for all tiles in the close map using Claude
 */
async function generateTileDescriptions(terrainCode, terrainDescription) {
  try {
    logger.info(`Generating tile descriptions for terrain ${terrainCode}`);
    
    // Extract the base terrain code (before any | character)
    const baseTerrainCode = terrainCode.split('|')[0];
    
    // Prepare the prompt for Claude
    const prompt = `
You are generating a detailed 16x16 grid of terrain tiles for a close-up view of a ${terrainDescription} (terrain code: ${terrainCode}).

Each tile should be a simple, specific terrain feature that would be found in this biome. Most tiles should be simple descriptions like "grass", "trees", "rocks", etc.

The grid should be coherent and realistic for this biome. Include appropriate features like:
- Vegetation (trees, bushes, grass, flowers)
- Terrain features (rocks, hills, depressions)
- Water features if appropriate (puddles, streams)
- Any special features that would make this biome unique

IMPORTANT GUIDELINES:
1. Keep descriptions very short (1-3 words)
2. Make the terrain cohesive and realistic
3. Include some variation but maintain the overall biome feel
4. Group similar features together to create natural patterns
5. Include paths or clearings where appropriate

Return your response as a JSON array of 256 strings (16x16 grid), ordered row by row from top-left to bottom-right.

Example format:
[
  "tall grass", "tall grass", "short grass", "wildflowers", ... (16 items in first row)
  "tall grass", "boulder", "short grass", "wildflowers", ... (16 items in second row)
  ... (16 rows total)
]
`;

    // Make request to Claude API via KinOS
    const response = await fetch('http://localhost:5000/v2/blueprints/autonomousrealms/kins/defaultcolony/analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KINOS_API_KEY || config.KINOS_API_KEY}`
      },
      body: JSON.stringify({
        message: prompt,
        model: "claude-3-7-sonnet-latest"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API request failed with status ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    
    if (!responseData.response) {
      throw new Error('Invalid response from Claude: No response field found');
    }
    
    // Extract the JSON array from Claude's response
    const contentText = responseData.response;
    
    // Try to parse the JSON
    try {
      // Find JSON array in the response
      const jsonMatch = contentText.match(/\[\s*"[\s\S]*"\s*\]/);
      if (jsonMatch) {
        const tileDescriptions = JSON.parse(jsonMatch[0]);
        logger.info(`Successfully parsed ${tileDescriptions.length} tile descriptions from Claude response`);
        
        // Validate that we have the correct number of descriptions
        if (tileDescriptions.length !== CLOSE_MAP_SIZE * CLOSE_MAP_SIZE) {
          logger.warn(`Expected ${CLOSE_MAP_SIZE * CLOSE_MAP_SIZE} tile descriptions, but got ${tileDescriptions.length}`);
          
          // Pad or truncate the array to the correct size
          if (tileDescriptions.length < CLOSE_MAP_SIZE * CLOSE_MAP_SIZE) {
            // Pad with default descriptions
            const defaultDescription = getDefaultDescription(baseTerrainCode);
            while (tileDescriptions.length < CLOSE_MAP_SIZE * CLOSE_MAP_SIZE) {
              tileDescriptions.push(defaultDescription);
            }
          } else {
            // Truncate
            tileDescriptions.length = CLOSE_MAP_SIZE * CLOSE_MAP_SIZE;
          }
        }
        
        return tileDescriptions;
      } else {
        throw new Error('Could not find JSON array in Claude response');
      }
    } catch (parseError) {
      logger.error(`Error parsing Claude response: ${parseError.message}`);
      logger.debug(`Claude response: ${contentText}`);
      
      // Generate fallback descriptions
      return generateFallbackDescriptions(baseTerrainCode);
    }
  } catch (error) {
    logger.error(`Error generating tile descriptions: ${error.message}`, { error });
    
    // Generate fallback descriptions
    return generateFallbackDescriptions(terrainCode.split('|')[0]);
  }
}

/**
 * Generate fallback descriptions if Claude API fails
 */
function generateFallbackDescriptions(baseTerrainCode) {
  logger.info(`Generating fallback descriptions for terrain ${baseTerrainCode}`);
  
  // Define basic descriptions based on terrain type
  let primaryDescription = "grass";
  let secondaryDescription = "tall grass";
  let tertiaryDescription = "rocks";
  let specialFeature = "wildflowers";
  
  // Customize based on terrain code
  switch (baseTerrainCode.charAt(0)) {
    case 'P': // Plains
      primaryDescription = "grass";
      secondaryDescription = "tall grass";
      tertiaryDescription = "small rocks";
      specialFeature = "wildflowers";
      break;
    case 'F': // Forest
      primaryDescription = "trees";
      secondaryDescription = "bushes";
      tertiaryDescription = "fallen logs";
      specialFeature = "mushrooms";
      break;
    case 'D': // Desert
      primaryDescription = "sand";
      secondaryDescription = "dry soil";
      tertiaryDescription = "small rocks";
      specialFeature = "cactus";
      break;
    case 'M': // Mountains
      primaryDescription = "rocky ground";
      secondaryDescription = "boulders";
      tertiaryDescription = "gravel";
      specialFeature = "mountain flowers";
      break;
    case 'W': // Water
      primaryDescription = "shallow water";
      secondaryDescription = "reeds";
      tertiaryDescription = "mud";
      specialFeature = "water lilies";
      break;
    // Add more cases as needed
  }
  
  // Create a 16x16 grid with these descriptions
  const descriptions = [];
  for (let y = 0; y < CLOSE_MAP_SIZE; y++) {
    for (let x = 0; x < CLOSE_MAP_SIZE; x++) {
      // Use a simple algorithm to distribute features
      const random = Math.random();
      
      if (random < 0.6) {
        descriptions.push(primaryDescription);
      } else if (random < 0.8) {
        descriptions.push(secondaryDescription);
      } else if (random < 0.95) {
        descriptions.push(tertiaryDescription);
      } else {
        descriptions.push(specialFeature);
      }
    }
  }
  
  return descriptions;
}

/**
 * Get default description for a terrain type
 */
function getDefaultDescription(baseTerrainCode) {
  switch (baseTerrainCode.charAt(0)) {
    case 'P': return "grass";
    case 'F': return "trees";
    case 'D': return "sand";
    case 'M': return "rocky ground";
    case 'W': return "shallow water";
    default: return "grass";
  }
}

/**
 * Generate tiles in batches of 4x4
 */
async function generateTilesInBatches(closeMapDir, tileDescriptions) {
  try {
    logger.info(`Generating tiles in batches for close map in ${closeMapDir}`);
    
    // Process in batches of 4x4
    const batchSize = 4;
    const totalBatches = (CLOSE_MAP_SIZE / batchSize) * (CLOSE_MAP_SIZE / batchSize);
    let completedBatches = 0;
    
    // Process each 4x4 batch
    for (let batchY = 0; batchY < CLOSE_MAP_SIZE; batchY += batchSize) {
      for (let batchX = 0; batchX < CLOSE_MAP_SIZE; batchX += batchSize) {
        // Extract the descriptions for this batch
        const batchDescriptions = [];
        for (let y = 0; y < batchSize; y++) {
          for (let x = 0; x < batchSize; x++) {
            const index = (batchY + y) * CLOSE_MAP_SIZE + (batchX + x);
            batchDescriptions.push({
              x: batchX + x,
              y: batchY + y,
              description: tileDescriptions[index]
            });
          }
        }
        
        // Check if all tiles in this batch already exist
        let allTilesExist = true;
        for (const tile of batchDescriptions) {
          const tilePath = path.join(closeMapDir, `${tile.x}_${tile.y}.png`);
          try {
            await fs.access(tilePath);
          } catch (err) {
            allTilesExist = false;
            break;
          }
        }
        
        if (allTilesExist) {
          logger.debug(`Skipping batch at (${batchX},${batchY}) as all tiles already exist`);
          completedBatches++;
          continue;
        }
        
        // Generate this batch
        await generateBatch(closeMapDir, batchDescriptions);
        
        completedBatches++;
        logger.info(`Completed batch ${completedBatches}/${totalBatches} for close map`);
      }
    }
    
    logger.info(`All batches completed for close map in ${closeMapDir}`);
    return true;
  } catch (error) {
    logger.error(`Error generating tiles in batches: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Generate a batch of tiles
 */
async function generateBatch(closeMapDir, batchDescriptions) {
  try {
    logger.debug(`Generating batch of ${batchDescriptions.length} tiles`);
    
    // Create a composite prompt for all tiles in this batch
    const batchPrompt = createBatchPrompt(batchDescriptions);
    
    // Queue the API request to respect rate limits
    await tileService.queueApiRequest(async () => {
      // Create a temporary directory for the response
      const responseDir = path.join(config.TEMP_DIR, 'responses');
      await fs.mkdir(responseDir, { recursive: true });
      const responseFilePath = path.join(responseDir, `response_${Date.now()}.json`);
      
      // Prepare the prompt for Ideogram
      const prompt = `Isometric game terrain tiles for a close-up view. Top-down perspective. Clash Royale style, clean colors. ${batchPrompt}`;
      
      // Build the cURL command - escape quotes in the prompt
      const escapedPrompt = prompt.replace(/"/g, '\\"');
      const curlCommand = `curl -X POST "https://api.ideogram.ai/generate" -H "Api-Key: ${config.IDEOGRAM_API_KEY}" -H "Content-Type: application/json" -d "{\\"image_request\\":{\\"prompt\\":\\"${escapedPrompt}\\",\\"model\\":\\"${config.IDEOGRAM_MODEL}\\",\\"aspect_ratio\\":\\"ASPECT_1_1\\",\\"style_type\\":\\"REALISTIC\\",\\"min_files\\":4,\\"max_files\\":4}}" -o "${responseFilePath}"`;
      
      logger.debug(`Executing cURL command for batch generation`);
      
      // Execute the cURL command with retry logic
      let retryCount = 0;
      let errorText = '';
      
      while (retryCount < config.MAX_RETRIES) {
        try {
          logger.debug(`API request attempt ${retryCount + 1}/${config.MAX_RETRIES}`);
          
          // Execute the cURL command
          const { exec } = require('child_process');
          const util = require('util');
          const execPromise = util.promisify(exec);
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
          
          if (!data.data || data.data.length === 0) {
            throw new Error('Invalid response from Ideogram API: No images found');
          }
          
          logger.debug(`Received ${data.data.length} images from Ideogram API`);
          
          // Download and process each image
          for (let i = 0; i < data.data.length && i < batchDescriptions.length; i++) {
            const imageUrl = data.data[i].url;
            const tile = batchDescriptions[i];
            
            // Download the image
            const tempImagePath = await downloadImage(imageUrl);
            
            // Process and save the tile
            const tilePath = path.join(closeMapDir, `${tile.x}_${tile.y}.png`);
            await processAndSaveTile(tempImagePath, tilePath);
            
            logger.debug(`Saved tile at (${tile.x},${tile.y}) to ${tilePath}`);
          }
          
          // Clean up temp files
          await fs.unlink(responseFilePath).catch(() => {});
          
          // Success, break out of retry loop
          break;
        } catch (error) {
          logger.warn(`API request failed (attempt ${retryCount + 1}/${config.MAX_RETRIES}): ${error.message}`);
          errorText = error.message;
          
          // Wait before retrying (exponential backoff)
          const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          
          retryCount++;
        }
      }
      
      // If we've exhausted all retries, generate fallback tiles
      if (retryCount >= config.MAX_RETRIES) {
        logger.error(`API request failed after ${config.MAX_RETRIES} attempts. Last error: ${errorText}`);
        
        // Generate fallback tiles for this batch
        for (const tile of batchDescriptions) {
          const tilePath = path.join(closeMapDir, `${tile.x}_${tile.y}.png`);
          await generateFallbackTileWithDescription(tilePath, tile.description);
        }
      }
    });
    
    return true;
  } catch (error) {
    logger.error(`Error generating batch: ${error.message}`, { error });
    
    // Generate fallback tiles for this batch
    for (const tile of batchDescriptions) {
      const tilePath = path.join(closeMapDir, `${tile.x}_${tile.y}.png`);
      await generateFallbackTileWithDescription(tilePath, tile.description);
    }
    
    return false;
  }
}

/**
 * Create a prompt for a batch of tiles
 */
function createBatchPrompt(batchDescriptions) {
  // Create a prompt that describes all tiles in the batch
  const descriptions = batchDescriptions.map(tile => tile.description);
  const uniqueDescriptions = [...new Set(descriptions)];
  
  if (uniqueDescriptions.length === 1) {
    return `Generate 4 variations of ${uniqueDescriptions[0]} tiles with slight differences.`;
  } else {
    return `Generate these terrain tiles: ${descriptions.join(', ')}.`;
  }
}

/**
 * Download an image from a URL
 */
async function downloadImage(url) {
  try {
    logger.debug(`Downloading image from ${url}`);
    
    const tempPath = path.join(config.TEMP_DIR, `download_${Date.now()}.png`);
    
    // Build the cURL command
    const curlCommand = `curl -s "${url}" -o "${tempPath}"`;
    
    // Execute the cURL command
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    await execPromise(curlCommand);
    
    logger.debug(`Image downloaded to ${tempPath}`);
    
    return tempPath;
  } catch (error) {
    logger.error(`Error downloading image: ${error.message}`);
    throw error;
  }
}

/**
 * Process and save a tile
 */
async function processAndSaveTile(sourcePath, outputPath) {
  try {
    logger.debug(`Processing tile from ${sourcePath} to ${outputPath}`);
    
    // Load the image
    const image = await loadImage(sourcePath);
    
    // Create a canvas with the desired dimensions
    const canvas = createCanvas(TILE_WIDTH, TILE_HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Draw the image, resizing if necessary
    ctx.drawImage(image, 0, 0, TILE_WIDTH, TILE_HEIGHT);
    
    // Apply image enhancements
    tileService.enhanceImage(ctx, TILE_WIDTH, TILE_HEIGHT);
    
    // Save the processed image
    await fs.writeFile(outputPath, canvas.toBuffer('image/png'));
    
    // Clean up temp file
    await fs.unlink(sourcePath).catch(() => {});
    
    return outputPath;
  } catch (error) {
    logger.error(`Error processing tile: ${error.message}`);
    throw error;
  }
}

/**
 * Generate a fallback tile with a specific description
 */
async function generateFallbackTileWithDescription(outputPath, description) {
  try {
    logger.info(`Generating fallback tile for description: ${description}`);
    
    // Create a basic canvas
    const canvas = createCanvas(TILE_WIDTH, TILE_HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Get base color from description
    const baseColor = getColorFromDescription(description);
    
    // Fill with base color
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add description text
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.font = '14px Arial';
    ctx.fillText(description, 10, canvas.height / 2);
    
    // Save the fallback tile
    await fs.writeFile(outputPath, canvas.toBuffer('image/png'));
    
    logger.info(`Fallback tile saved to ${outputPath}`);
    return outputPath;
  } catch (error) {
    logger.error(`Error generating fallback tile: ${error.message}`);
    throw error;
  }
}

/**
 * Generate a fallback tile for a position
 */
async function generateFallbackTile(position) {
  try {
    logger.info(`Generating fallback tile for position ${JSON.stringify(position)}`);
    
    // Create directory for this close map if it doesn't exist
    const closeMapDir = path.join(
      config.TILES_DIR, 
      'close_maps',
      `${position.regionX}_${position.regionY}_${position.tileX}_${position.tileY}`
    );
    
    await fs.mkdir(closeMapDir, { recursive: true });
    
    // Create the tile path
    const tilePath = path.join(closeMapDir, `${position.x}_${position.y}.png`);
    
    // Create a basic canvas
    const canvas = createCanvas(TILE_WIDTH, TILE_HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Fill with a default color
    ctx.fillStyle = '#8BC34A'; // Light green
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add position text for debugging
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.font = '12px Arial';
    ctx.fillText(`Close Map: ${position.regionX},${position.regionY}`, 10, 20);
    ctx.fillText(`Tile: ${position.tileX},${position.tileY}`, 10, 40);
    ctx.fillText(`Position: ${position.x},${position.y}`, 10, 60);
    
    // Save the fallback tile
    await fs.writeFile(tilePath, canvas.toBuffer('image/png'));
    
    logger.info(`Fallback tile saved to ${tilePath}`);
    return tilePath;
  } catch (error) {
    logger.error(`Error generating fallback tile: ${error.message}`);
    throw error;
  }
}

/**
 * Get a color based on a description
 */
function getColorFromDescription(description) {
  description = description.toLowerCase();
  
  if (description.includes('grass')) return '#4CAF50';
  if (description.includes('tall grass')) return '#388E3C';
  if (description.includes('tree')) return '#2E7D32';
  if (description.includes('forest')) return '#1B5E20';
  if (description.includes('water')) return '#2196F3';
  if (description.includes('river')) return '#1976D2';
  if (description.includes('lake')) return '#0D47A1';
  if (description.includes('sand')) return '#FDD835';
  if (description.includes('desert')) return '#F9A825';
  if (description.includes('rock')) return '#757575';
  if (description.includes('mountain')) return '#616161';
  if (description.includes('snow')) return '#ECEFF1';
  if (description.includes('ice')) return '#CFD8DC';
  if (description.includes('flower')) return '#E91E63';
  if (description.includes('mud')) return '#795548';
  if (description.includes('path')) return '#8D6E63';
  if (description.includes('road')) return '#6D4C41';
  
  // Default color
  return '#8BC34A'; // Light green
}

module.exports = {
  generateCloseMap,
  generateFallbackTile
};
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const { createCanvas, loadImage } = require('canvas');
const config = require('../config');
const logger = require('../utils/logger');

// Constants
const CLOSE_MAP_SIZE = 16;
const TILE_WIDTH = 128;
const TILE_HEIGHT = 128;

/**
 * Generate a close map for a specific tile
 */
async function generateCloseMap(regionX, regionY, tileX, tileY, terrainCode, terrainDescription) {
  try {
    logger.info(`Generating close map for tile (${regionX},${regionY},${tileX},${tileY}) with terrain ${terrainCode}`);
    
    // Create directory for this close map
    const closeMapDir = path.join(
      config.TILES_DIR, 
      'close_maps',
      `${regionX}_${regionY}_${tileX}_${tileY}`
    );
    
    await fs.mkdir(closeMapDir, { recursive: true });
    
    // Generate a simple metadata file with placeholder data
    const metadata = {
      regionX,
      regionY,
      tileX,
      tileY,
      terrainCode,
      terrainDescription,
      size: CLOSE_MAP_SIZE,
      tileDescriptions: generatePlaceholderDescriptions(terrainCode),
      generatedAt: new Date().toISOString()
    };
    
    // Save metadata
    const metadataPath = path.join(closeMapDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    // Generate placeholder tiles
    for (let y = 0; y < CLOSE_MAP_SIZE; y++) {
      for (let x = 0; x < CLOSE_MAP_SIZE; x++) {
        const tilePath = path.join(closeMapDir, `${x}_${y}.png`);
        await generateFallbackTileWithDescription(tilePath, metadata.tileDescriptions[y * CLOSE_MAP_SIZE + x]);
      }
    }
    
    return {
      success: true,
      message: `Close map generated for tile (${regionX},${regionY},${tileX},${tileY})`,
      metadata
    };
  } catch (error) {
    logger.error(`Error generating close map: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Generate placeholder descriptions for a close map
 */
function generatePlaceholderDescriptions(terrainCode) {
  // Extract the base terrain code (before any | character)
  const baseTerrainCode = terrainCode.split('|')[0];
  
  // Define basic descriptions based on terrain type
  let primaryDescription = "grass";
  let secondaryDescription = "tall grass";
  let tertiaryDescription = "rocks";
  let specialFeature = "wildflowers";
  
  // Customize based on terrain code
  switch (baseTerrainCode.charAt(0)) {
    case 'P': // Plains
      primaryDescription = "grass";
      secondaryDescription = "tall grass";
      tertiaryDescription = "small rocks";
      specialFeature = "wildflowers";
      break;
    case 'F': // Forest
      primaryDescription = "trees";
      secondaryDescription = "bushes";
      tertiaryDescription = "fallen logs";
      specialFeature = "mushrooms";
      break;
    case 'D': // Desert
      primaryDescription = "sand";
      secondaryDescription = "dry soil";
      tertiaryDescription = "small rocks";
      specialFeature = "cactus";
      break;
    case 'M': // Mountains
      primaryDescription = "rocky ground";
      secondaryDescription = "boulders";
      tertiaryDescription = "gravel";
      specialFeature = "mountain flowers";
      break;
    case 'W': // Water
      primaryDescription = "shallow water";
      secondaryDescription = "reeds";
      tertiaryDescription = "mud";
      specialFeature = "water lilies";
      break;
    // Add more cases as needed
  }
  
  // Create a 16x16 grid with these descriptions
  const descriptions = [];
  for (let y = 0; y < CLOSE_MAP_SIZE; y++) {
    for (let x = 0; x < CLOSE_MAP_SIZE; x++) {
      // Use a simple algorithm to distribute features
      const random = Math.random();
      
      if (random < 0.6) {
        descriptions.push(primaryDescription);
      } else if (random < 0.8) {
        descriptions.push(secondaryDescription);
      } else if (random < 0.95) {
        descriptions.push(tertiaryDescription);
      } else {
        descriptions.push(specialFeature);
      }
    }
  }
  
  return descriptions;
}

/**
 * Generate a fallback tile with a specific description
 */
async function generateFallbackTileWithDescription(outputPath, description) {
  try {
    logger.info(`Generating fallback tile for description: ${description}`);
    
    // Create a basic canvas
    const canvas = createCanvas(TILE_WIDTH, TILE_HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Get base color from description
    const baseColor = getColorFromDescription(description);
    
    // Fill with base color
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add description text
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.font = '14px Arial';
    ctx.fillText(description, 10, canvas.height / 2);
    
    // Save the fallback tile
    await fs.writeFile(outputPath, canvas.toBuffer('image/png'));
    
    logger.info(`Fallback tile saved to ${outputPath}`);
    return outputPath;
  } catch (error) {
    logger.error(`Error generating fallback tile: ${error.message}`);
    throw error;
  }
}

/**
 * Generate a fallback tile for a position
 */
async function generateFallbackTile(position) {
  try {
    logger.info(`Generating fallback tile for position ${JSON.stringify(position)}`);
    
    // Create directory for this close map if it doesn't exist
    const closeMapDir = path.join(
      config.TILES_DIR, 
      'close_maps',
      `${position.regionX}_${position.regionY}_${position.tileX}_${position.tileY}`
    );
    
    await fs.mkdir(closeMapDir, { recursive: true });
    
    // Create the tile path
    const tilePath = path.join(closeMapDir, `${position.x}_${position.y}.png`);
    
    // Create a basic canvas
    const canvas = createCanvas(TILE_WIDTH, TILE_HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Fill with a default color
    ctx.fillStyle = '#8BC34A'; // Light green
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add position text for debugging
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.font = '12px Arial';
    ctx.fillText(`Close Map: ${position.regionX},${position.regionY}`, 10, 20);
    ctx.fillText(`Tile: ${position.tileX},${position.tileY}`, 10, 40);
    ctx.fillText(`Position: ${position.x},${position.y}`, 10, 60);
    
    // Save the fallback tile
    await fs.writeFile(tilePath, canvas.toBuffer('image/png'));
    
    logger.info(`Fallback tile saved to ${tilePath}`);
    return tilePath;
  } catch (error) {
    logger.error(`Error generating fallback tile: ${error.message}`);
    throw error;
  }
}

/**
 * Get a color based on a description
 */
function getColorFromDescription(description) {
  description = description.toLowerCase();
  
  if (description.includes('grass')) return '#4CAF50';
  if (description.includes('tall grass')) return '#388E3C';
  if (description.includes('tree')) return '#2E7D32';
  if (description.includes('forest')) return '#1B5E20';
  if (description.includes('water')) return '#2196F3';
  if (description.includes('river')) return '#1976D2';
  if (description.includes('lake')) return '#0D47A1';
  if (description.includes('sand')) return '#FDD835';
  if (description.includes('desert')) return '#F9A825';
  if (description.includes('rock')) return '#757575';
  if (description.includes('mountain')) return '#616161';
  if (description.includes('snow')) return '#ECEFF1';
  if (description.includes('ice')) return '#CFD8DC';
  if (description.includes('flower')) return '#E91E63';
  if (description.includes('mud')) return '#795548';
  if (description.includes('path')) return '#8D6E63';
  if (description.includes('road')) return '#6D4C41';
  
  // Default color
  return '#8BC34A'; // Light green
}

module.exports = {
  generateCloseMap,
  generateFallbackTile
};
