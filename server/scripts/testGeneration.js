const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const config = require('../config');
const logger = require('../utils/logger');

// Ensure output directory exists
async function ensureOutputDirectory() {
  const outputDir = path.join(__dirname, '../output');
  
  try {
    await fs.access(outputDir);
    logger.debug(`Output directory exists: ${outputDir}`);
  } catch (err) {
    logger.info(`Creating output directory: ${outputDir}`);
    await fs.mkdir(outputDir, { recursive: true });
  }
  
  return outputDir;
}

// Get next available file number
async function getNextFileNumber(outputDir) {
  try {
    const files = await fs.readdir(outputDir);
    const imageFiles = files.filter(file => file.startsWith('generated_') && file.endsWith('.png'));
    
    if (imageFiles.length === 0) {
      return 1;
    }
    
    const numbers = imageFiles.map(file => {
      const match = file.match(/generated_(\d+)\.png/);
      return match ? parseInt(match[1], 10) : 0;
    });
    
    return Math.max(...numbers) + 1;
  } catch (err) {
    logger.error(`Error getting next file number: ${err.message}`);
    return 1;
  }
}

// Download image from URL
async function downloadImage(url, outputPath) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    await fs.writeFile(outputPath, buffer);
    logger.info(`Image downloaded successfully to ${outputPath}`);
  } catch (error) {
    logger.error(`Error downloading image: ${error.message}`);
    throw error;
  }
}

// Remove background and shadows from image
async function removeBackground(imagePath) {
  try {
    logger.info(`Removing background from image: ${imagePath}`);
    
    // Load the image
    const { createCanvas, loadImage } = require('canvas');
    const image = await loadImage(imagePath);
    
    // Create a new canvas with the same dimensions
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Draw the original image
    ctx.drawImage(image, 0, 0);
    
    // Get image data to process pixels
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Define what we consider "white" or "near white" for background
    const isWhiteOrNearWhite = (r, g, b) => {
      // Check if the color is close to white (allowing some variation)
      return r > 240 && g > 240 && b > 240;
    };
    
    // Detect background color from corners (sampling multiple points)
    const cornerSamples = [
      { x: 0, y: 0 },                                  // Top-left
      { x: canvas.width - 1, y: 0 },                   // Top-right
      { x: 0, y: canvas.height - 1 },                  // Bottom-left
      { x: canvas.width - 1, y: canvas.height - 1 },   // Bottom-right
      { x: 5, y: 5 },                                  // Near top-left
      { x: canvas.width - 6, y: 5 },                   // Near top-right
      { x: 5, y: canvas.height - 6 },                  // Near bottom-left
      { x: canvas.width - 6, y: canvas.height - 6 }    // Near bottom-right
    ];
    
    // Sample colors from corners to determine background color
    let backgroundColors = [];
    for (const point of cornerSamples) {
      const idx = (point.y * canvas.width + point.x) * 4;
      backgroundColors.push({
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
        a: data[idx + 3]
      });
    }
    
    // Filter out non-white colors from our background samples
    backgroundColors = backgroundColors.filter(color => 
      isWhiteOrNearWhite(color.r, color.g, color.b)
    );
    
    // If we don't have enough white samples, use a default white
    const defaultBackground = { r: 255, g: 255, b: 255 };
    const backgroundColor = backgroundColors.length > 3 
      ? backgroundColors[0] 
      : defaultBackground;
    
    logger.debug(`Detected background color: RGB(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b})`);
    
    // Process the image - remove shadows and ensure transparent background
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      // Check if this pixel is likely part of the background or shadow
      // 1. If it's very close to white, make it transparent
      if (isWhiteOrNearWhite(r, g, b)) {
        data[i] = 0;       // R (doesn't matter for transparent pixels)
        data[i + 1] = 0;   // G (doesn't matter for transparent pixels)
        data[i + 2] = 0;   // B (doesn't matter for transparent pixels)
        data[i + 3] = 0;   // A (0 = fully transparent)
        continue;
      }
      
      // 2. Check for shadows (grayish colors with similar RGB values)
      const isGray = Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && Math.abs(r - b) < 15;
      const isBrightGray = isGray && (r + g + b) / 3 > 200;
      
      if (isBrightGray) {
        // This is likely a shadow - make it transparent
        data[i] = 0;       // R
        data[i + 1] = 0;   // G
        data[i + 2] = 0;   // B
        data[i + 3] = 0;   // A (fully transparent)
        continue;
      }
      
      // 3. For semi-transparent pixels that are light, make them fully transparent
      if (a < 240 && (r + g + b) / 3 > 220) {
        // Light semi-transparent pixel - make it transparent
        data[i] = 0;       // R
        data[i + 1] = 0;   // G
        data[i + 2] = 0;   // B
        data[i + 3] = 0;   // A (fully transparent)
      }
    }
    
    // Put the processed image data back
    ctx.putImageData(imageData, 0, 0);
    
    // Save the processed image
    await fs.writeFile(imagePath, canvas.toBuffer('image/png'));
    logger.info(`Background removed successfully from ${imagePath} (made transparent)`);
    
    return imagePath;
  } catch (error) {
    logger.error(`Error removing background: ${error.message}`);
    // Return the original image path if processing fails
    return imagePath;
  }
}

// Main function to generate test image
async function generateTestImage() {
  try {
    logger.info('Starting test image generation');
    
    // Ensure output directory exists
    const outputDir = await ensureOutputDirectory();
    
    // Get next file number
    const fileNumber = await getNextFileNumber(outputDir);
    const outputPath = path.join(outputDir, `generated_${fileNumber}.png`);
    
    // Prepare request data
    const requestData = {
      image_request: {
        prompt: "isometric small medieval cottage, thatched roof, wooden beams, single-story, white background, clearly defined tile edges, clean lines, Clash Royale style, game asset, no shadows, flat colors, isolated isometric game tile",
        model: "V_2A_TURBO",
        aspect_ratio: "ASPECT_1_1", // Square aspect ratio for game tiles
        style_type: "GENERAL"  // Add style type parameter
      }
    };
    
    logger.info(`API Key length: ${config.IDEOGRAM_API_KEY ? config.IDEOGRAM_API_KEY.length : 0}`);
    logger.info(`API Key first few chars: ${config.IDEOGRAM_API_KEY ? config.IDEOGRAM_API_KEY.substring(0, 4) + '...' : 'none'}`);
    logger.debug(`Using API key: ${config.IDEOGRAM_API_KEY.substring(0, 8)}...`);
    logger.debug(`Request data: ${JSON.stringify(requestData)}`);
    
    // Make API request
    const response = await fetch('https://api.ideogram.ai/generate', {
      method: 'POST',
      headers: {
        'Api-Key': config.IDEOGRAM_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    // Check response
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }
    
    // Parse response
    const responseData = await response.json();
    logger.debug(`API response: ${JSON.stringify(responseData)}`);
    
    // Check if we have valid image data
    if (!responseData.data || !responseData.data[0] || !responseData.data[0].url) {
      throw new Error('Invalid response from Ideogram API: No image URL found');
    }
    
    // Download the generated image
    const imageUrl = responseData.data[0].url;
    await downloadImage(imageUrl, outputPath);
    
    // Process the image to remove background and shadows
    await removeBackground(outputPath);
    
    logger.info(`Successfully generated image #${fileNumber}`);
    logger.info(`Image saved to: ${outputPath}`);
    
    // Save metadata alongside the image
    const metadataPath = path.join(outputDir, `generated_${fileNumber}_metadata.json`);
    await fs.writeFile(metadataPath, JSON.stringify(responseData, null, 2));
    logger.info(`Metadata saved to: ${metadataPath}`);
    
    return {
      success: true,
      imagePath: outputPath,
      metadataPath: metadataPath
    };
  } catch (error) {
    logger.error(`Error generating test image: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the script if called directly
if (require.main === module) {
  generateTestImage()
    .then(result => {
      if (result.success) {
        logger.info('Test image generation completed successfully');
      } else {
        logger.error(`Test image generation failed: ${result.error}`);
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error(`Unhandled error: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { generateTestImage };
