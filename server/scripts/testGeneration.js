const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
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
