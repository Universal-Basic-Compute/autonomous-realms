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

// Remove background using Pixelcut API
async function removeBackground(imagePath) {
  try {
    logger.info(`Removing background from image using Pixelcut API: ${imagePath}`);
    
    // First, we need to upload the image to a temporary URL or use a file upload approach
    // For this implementation, we'll read the file and convert it to base64
    const imageBuffer = await fs.readFile(imagePath);
    
    // Create a temporary file URL using a service like ImgBB or similar
    // For now, we'll use a direct file upload approach with the Pixelcut API
    
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
      body: formData
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
    logger.info(`Background removed successfully using Pixelcut API: ${imagePath}`);
    
    return imagePath;
  } catch (error) {
    logger.error(`Error removing background with Pixelcut API: ${error.message}`);
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
        prompt: "floating island with medieval cottages, small garden, stone paths, waterfall flowing off edge, tethered by magical chains, white background, isometric view, clearly defined edges, Clash Royale style, vibrant colors, game asset, no shadows, isolated game tile, pure white background",
        model: "V_2A_TURBO",
        aspect_ratio: "ASPECT_1_1", // Square aspect ratio for game tiles
        style_type: "REALISTIC"  // Changed to REALISTIC
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
