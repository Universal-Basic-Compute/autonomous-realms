const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const config = require('../config');
const logger = require('../utils/logger');
const FormData = require('form-data');

// Ensure directories exist
async function ensureDirectories() {
  const dirs = [
    path.join(__dirname, '../output/terrain_map'),
    path.join(__dirname, '../output/terrain_map/islands'),
    path.join(__dirname, '../output/terrain_map/metadata')
  ];
  
  for (const dir of dirs) {
    try {
      await fs.access(dir);
      logger.debug(`Directory exists: ${dir}`);
    } catch (err) {
      logger.info(`Creating directory: ${dir}`);
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

// Read terrain reference document
async function getTerrainReference() {
  try {
    const terrainRefPath = path.join(__dirname, '../../docs/terrrain_reference.md');
    const terrainRef = await fs.readFile(terrainRefPath, 'utf8');
    return terrainRef;
  } catch (error) {
    logger.error(`Error reading terrain reference: ${error.message}`);
    return ""; // Return empty string if file can't be read
  }
}

// Generate terrain map using Claude
async function generateTerrainMap(size = 16) {
  try {
    logger.info(`Generating ${size}x${size} terrain map using Claude`);
    
    // Get terrain reference for system prompt
    const terrainReference = await getTerrainReference();
    
    // Prepare the system prompt with terrain reference
    const systemPrompt = `You are a game world designer creating floating islands for an isometric game. 
Use the following terrain reference guide to create appropriate terrain codes:

${terrainReference}`;
    
    // Prepare the user prompt
    const userPrompt = `Generate a ${size}x${size} terrain map of isolated realistic terrain tiles for an isometric game.

For each tile, provide:
1. Coordinates (x,y) from 0,0 to ${size-1},${size-1}
2. A brief description (30-50 words) of the terrain's natural features, including terrain type, vegetation, geological formations, and unique elements. DO NOT include any human constructions, settlements, buildings, or artificial structures.
3. A terrain code using the format from the terrain reference document (e.g., "F-OAK|E-SLI|X-RUI")

Make each terrain tile unique and detailed with realistic features. Include various natural terrain types like forests, mountains, plains, magical areas, etc. Each tile should be isolated and self-contained. Focus exclusively on natural landscapes without any signs of civilization.

Format the response as a JSON array of objects with properties: coordinates, description, and terrainCode.

Example:
[
  {
    "coordinates": {"x": 3, "y": 5},
    "description": "Dense pine forest with needle-covered ground and exposed granite outcroppings. Moss covers the north-facing rocks, and a small natural clearing reveals rich dark soil with ferns.",
    "terrainCode": "F-PIN|E-SLI|X-RCK|R-GRN"
  },
  ...
]`;

    // Make request to Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY || config.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-3-7-sonnet-latest",
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API request failed with status ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    logger.debug(`Claude response received`);

    // Extract the JSON array from Claude's response
    const contentText = responseData.content[0].text;
    const jsonMatch = contentText.match(/\[\s*\{.*\}\s*\]/s);
    
    if (!jsonMatch) {
      throw new Error('Could not extract valid JSON from Claude response');
    }
    
    const jsonText = jsonMatch[0];
    const terrainMap = JSON.parse(jsonText);
    
    // Save the terrain map to a file
    const mapFilePath = path.join(__dirname, '../output/terrain_map/map.json');
    await fs.writeFile(mapFilePath, JSON.stringify(terrainMap, null, 2));
    logger.info(`Terrain map saved to ${mapFilePath}`);
    
    return terrainMap;
  } catch (error) {
    logger.error(`Error generating terrain map: ${error.message}`);
    throw error;
  }
}

// Generate an image for a single island
async function generateIslandImage(island, index) {
  try {
    logger.info(`Generating image for terrain at ${island.coordinates.x},${island.coordinates.y}`);
    
    // Create a prompt for Ideogram based on the island description
    // Updated to request isolated realistic terrain tiles instead of floating islands
    const prompt = `isolated realistic terrain tile with ${island.description}, white background, clearly defined edges, photorealistic style, detailed textures, natural lighting, high quality game asset, no shadows, isolated game tile`;
    
    // Prepare request data
    const requestData = {
      image_request: {
        prompt: prompt,
        model: "V_2A_TURBO",
        aspect_ratio: "ASPECT_1_1", // Square aspect ratio for game tiles
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
    const outputPath = path.join(__dirname, `../output/terrain_map/islands/island_${island.coordinates.x}_${island.coordinates.y}.png`);
    await downloadImage(imageUrl, outputPath);
    
    // Process the image to remove background
    await removeBackground(outputPath);
    
    // Save metadata
    const metadataPath = path.join(__dirname, `../output/terrain_map/metadata/island_${island.coordinates.x}_${island.coordinates.y}.json`);
    await fs.writeFile(metadataPath, JSON.stringify({
      ...island,
      generatedPrompt: prompt,
      ideogramResponse: responseData
    }, null, 2));
    
    logger.info(`Successfully generated image for island at ${island.coordinates.x},${island.coordinates.y}`);
    
    return outputPath;
  } catch (error) {
    logger.error(`Error generating island image: ${error.message}`);
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

// Process all islands in the terrain map
async function processTerrainMap() {
  try {
    // Ensure directories exist
    await ensureDirectories();
    
    // Generate terrain map
    const terrainMap = await generateTerrainMap();
    
    // Process each island with rate limiting
    logger.info(`Processing ${terrainMap.length} islands`);
    
    for (let i = 0; i < terrainMap.length; i++) {
      const island = terrainMap[i];
      
      try {
        // Add delay between requests to respect rate limits
        if (i > 0) {
          const delay = 2000; // 2 seconds between requests
          logger.debug(`Rate limiting: waiting ${delay}ms before next request`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        await generateIslandImage(island, i);
      } catch (error) {
        logger.error(`Error processing island at ${island.coordinates.x},${island.coordinates.y}: ${error.message}`);
        // Continue with next island even if one fails
      }
    }
    
    logger.info(`Terrain map processing completed. Generated ${terrainMap.length} islands.`);
    return {
      success: true,
      islandCount: terrainMap.length,
      mapPath: path.join(__dirname, '../output/terrain_map/map.json')
    };
  } catch (error) {
    logger.error(`Error processing terrain map: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the script if called directly
if (require.main === module) {
  processTerrainMap()
    .then(result => {
      if (result.success) {
        logger.info(`Terrain map generation completed successfully with ${result.islandCount} islands`);
      } else {
        logger.error(`Terrain map generation failed: ${result.error}`);
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error(`Unhandled error: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { processTerrainMap, generateTerrainMap, generateIslandImage };
