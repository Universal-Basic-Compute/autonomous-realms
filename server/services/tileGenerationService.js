const fetch = require('node-fetch');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

// Constants
const TILE_WIDTH = 512;
const TILE_HEIGHT = 512;

// Cache for generated tiles
const tileCache = new Map();

/**
 * Generates a horizontal tile based on a previous tile
 */
async function generateNextHorizontalTile(previousTilePath, position) {
  try {
    // Load the previous tile image
    const previousTile = await loadImage(previousTilePath);
    
    // Create expanded canvas
    const expandedCanvas = createCanvas(previousTile.width * 1.5, previousTile.height);
    const ctx = expandedCanvas.getContext('2d');
    
    // Draw the previous tile on the left side
    ctx.drawImage(previousTile, 0, 0);
    
    // Create mask canvas
    const maskCanvas = createCanvas(expandedCanvas.width, expandedCanvas.height);
    const maskCtx = maskCanvas.getContext('2d');
    
    // Fill the entire mask with black (keep original)
    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    
    // Fill the right 50% with white (area to generate)
    maskCtx.fillStyle = 'white';
    maskCtx.fillRect(previousTile.width, 0, previousTile.width * 0.5, previousTile.height);
    
    // Save temporary files for API upload
    const expandedImagePath = path.join(config.TEMP_DIR, `expanded_${Date.now()}.png`);
    const maskImagePath = path.join(config.TEMP_DIR, `mask_${Date.now()}.png`);
    
    await fs.writeFile(expandedImagePath, expandedCanvas.toBuffer('image/png'));
    await fs.writeFile(maskImagePath, maskCanvas.toBuffer('image/png'));
    
    // Create form data for API request
    const formData = new FormData();
    formData.append('image_file', await fs.readFile(expandedImagePath));
    formData.append('mask', await fs.readFile(maskImagePath));
    formData.append('model', 'V_2');
    formData.append('prompt', `Isometric game terrain tile continuing seamlessly from the left side. ${getTerrainPromptDetails(position)}. Clash Royale style, clean colors, transparent background.`);
    
    // Make API request
    const response = await fetch('https://api.ideogram.ai/edit', {
      method: 'POST',
      headers: {
        'Api-Key': config.IDEOGRAM_API_KEY
      },
      body: formData
    });
    
    const data = await response.json();
    
    // Clean up temp files
    await fs.unlink(expandedImagePath);
    await fs.unlink(maskImagePath);
    
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
    console.error('Error generating next horizontal tile:', error);
    throw error;
  }
}

/**
 * Downloads an image from a URL
 */
async function downloadImage(url) {
  const response = await fetch(url);
  const buffer = await response.buffer();
  const tempPath = path.join(config.TEMP_DIR, `download_${Date.now()}.png`);
  await fs.writeFile(tempPath, buffer);
  return tempPath;
}

/**
 * Crops the right side of an image and saves it
 */
async function cropAndSaveRightSide(imagePath, outputPath) {
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
  await fs.unlink(imagePath);
  
  return outputPath;
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
 * Gets terrain code for a position (placeholder implementation)
 */
function getTerrainCodeForPosition(position) {
  // This would normally come from a database or terrain generation algorithm
  // For now, return a default terrain type
  return "P-LUS|E-FLT";
}

module.exports = {
  generateNextHorizontalTile,
  // Add other functions as needed
};
