const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const config = require('../config');
const logger = require('../utils/logger');

// Ensure output directories exist
async function ensureDirectories() {
  const iconDir = path.join(__dirname, '../assets/icons/terrain');
  
  try {
    await fs.access(iconDir);
    logger.debug(`Icon directory exists: ${iconDir}`);
  } catch (err) {
    logger.info(`Creating icon directory: ${iconDir}`);
    await fs.mkdir(iconDir, { recursive: true });
  }
  
  return iconDir;
}

// Parse terrain reference document to extract terrain types
async function parseTerrainReference() {
  try {
    const terrainRefPath = path.join(__dirname, '../../docs/terrrain_reference.md');
    const terrainRef = await fs.readFile(terrainRefPath, 'utf8');
    
    // Define the categories we want to extract
    const categories = [
      { name: 'Plains', prefix: 'P-', section: 'Plains (P)' },
      { name: 'Forest', prefix: 'F-', section: 'Forest (F)' },
      { name: 'Desert', prefix: 'D-', section: 'Desert (D)' },
      { name: 'Mountains', prefix: 'M-', section: 'Mountains (M)' },
      { name: 'Water', prefix: 'W-', section: 'Water (W)' },
      { name: 'Tundra', prefix: 'T-', section: 'Tundra/Arctic (T)' },
      { name: 'Rocky', prefix: 'R-', section: 'Rocky (R)' },
      { name: 'Farmland', prefix: 'A-', section: 'Farmland (A)' },
      { name: 'Special', prefix: 'S-', section: 'Special/Magical (S)' },
      { name: 'Wasteland', prefix: 'L-', section: 'Wasteland (L)' }
    ];
    
    // Extract terrain types from each category
    const terrainTypes = [];
    
    for (const category of categories) {
      // Find the section in the markdown
      const sectionRegex = new RegExp(`### ${category.section}[\\s\\S]*?(?=###|$)`, 'g');
      const sectionMatch = terrainRef.match(sectionRegex);
      
      if (sectionMatch) {
        // Extract all terrain codes and descriptions
        const codeRegex = /`([A-Z]-[A-Z]{3})`:\s*(.*?)$/gm;
        let match;
        
        while ((match = codeRegex.exec(sectionMatch[0])) !== null) {
          const code = match[1];
          const description = match[2].trim();
          
          terrainTypes.push({
            category: category.name,
            code,
            description,
            filename: code.toLowerCase().replace('-', '_')
          });
        }
      }
    }
    
    logger.info(`Extracted ${terrainTypes.length} terrain types from reference document`);
    return terrainTypes;
  } catch (error) {
    logger.error(`Error parsing terrain reference: ${error.message}`);
    throw error;
  }
}

// Generate a single terrain icon
async function generateTerrainIcon(terrainType, iconDir) {
  try {
    logger.info(`Generating icon for ${terrainType.code}: ${terrainType.description}`);
    
    // Create a prompt for Ideogram based on the terrain type
    const prompt = `Simple icon representing ${terrainType.description} for a game UI, top-down view, minimalist design, single color with transparency, white icon on transparent background, clean vector style, consistent with other terrain icons, no text, 128x128 pixels`;
    
    // Prepare request data
    const requestData = {
      image_request: {
        prompt: prompt,
        model: "V_2A_TURBO",
        aspect_ratio: "ASPECT_1_1",
        style_type: "REALISTIC"
      }
    };
    
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
    
    // Check if we have valid image data
    if (!responseData.data || !responseData.data[0] || !responseData.data[0].url) {
      throw new Error('Invalid response from Ideogram API: No image URL found');
    }
    
    // Download the generated image
    const imageUrl = responseData.data[0].url;
    const outputPath = path.join(iconDir, `${terrainType.filename}.png`);
    await downloadImage(imageUrl, outputPath);
    
    // Process the image to ensure it's suitable for an icon
    await processIconImage(outputPath);
    
    // Save metadata
    const metadataPath = path.join(iconDir, `${terrainType.filename}_metadata.json`);
    await fs.writeFile(metadataPath, JSON.stringify({
      ...terrainType,
      generatedPrompt: prompt,
      ideogramResponse: responseData
    }, null, 2));
    
    logger.info(`Successfully generated icon for ${terrainType.code}`);
    
    return outputPath;
  } catch (error) {
    logger.error(`Error generating icon for ${terrainType.code}: ${error.message}`);
    throw error;
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

// Process the icon image to ensure it's suitable for UI
async function processIconImage(imagePath) {
  try {
    logger.info(`Processing icon image: ${imagePath}`);
    
    // For now, we'll just use the image as-is
    // In a more advanced implementation, you could:
    // 1. Resize to a standard size (e.g., 128x128)
    // 2. Convert to PNG with transparency
    // 3. Apply any necessary filters or adjustments
    
    return imagePath;
  } catch (error) {
    logger.error(`Error processing icon image: ${error.message}`);
    // Return the original image path if processing fails
    return imagePath;
  }
}

// Main function to generate all terrain icons
async function generateAllTerrainIcons() {
  try {
    logger.info('Starting terrain icon generation');
    
    // Ensure output directory exists
    const iconDir = await ensureDirectories();
    
    // Parse terrain reference to get all terrain types
    const terrainTypes = await parseTerrainReference();
    
    // Process each terrain type with rate limiting
    logger.info(`Generating icons for ${terrainTypes.length} terrain types`);
    
    const results = [];
    
    for (let i = 0; i < terrainTypes.length; i++) {
      const terrainType = terrainTypes[i];
      
      try {
        // Add delay between requests to respect rate limits
        if (i > 0) {
          const delay = 2000; // 2 seconds between requests
          logger.debug(`Rate limiting: waiting ${delay}ms before next request`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const iconPath = await generateTerrainIcon(terrainType, iconDir);
        results.push({
          code: terrainType.code,
          success: true,
          path: iconPath
        });
      } catch (error) {
        logger.error(`Error generating icon for ${terrainType.code}: ${error.message}`);
        results.push({
          code: terrainType.code,
          success: false,
          error: error.message
        });
      }
    }
    
    // Generate a summary report
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    const summaryPath = path.join(iconDir, 'generation_summary.json');
    await fs.writeFile(summaryPath, JSON.stringify({
      totalIcons: terrainTypes.length,
      successCount,
      failureCount,
      results
    }, null, 2));
    
    logger.info(`Terrain icon generation completed. Generated ${successCount} icons (${failureCount} failed).`);
    return {
      success: true,
      iconCount: successCount,
      failureCount,
      iconDir
    };
  } catch (error) {
    logger.error(`Error generating terrain icons: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the script if called directly
if (require.main === module) {
  generateAllTerrainIcons()
    .then(result => {
      if (result.success) {
        logger.info(`Terrain icon generation completed successfully with ${result.iconCount} icons`);
      } else {
        logger.error(`Terrain icon generation failed: ${result.error}`);
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error(`Unhandled error: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { generateAllTerrainIcons };
