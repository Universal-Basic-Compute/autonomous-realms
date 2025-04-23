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
    const userPrompt = `Generate a ${size}x${size} terrain map for an isometric game with connected, coherent terrain features.

For each tile, provide:
1. Coordinates (x,y) from 0,0 to ${size-1},${size-1}
2. A brief description (30-50 words) of the terrain's natural features, including terrain type, vegetation, geological formations, and unique elements. DO NOT include any human constructions, settlements, buildings, or artificial structures.
3. A terrain code using the format from the terrain reference document (e.g., "F-OAK|E-SLI|X-RUI")

IMPORTANT: Create connected terrain features that span multiple tiles. For example:
- Rivers should flow across multiple tiles in logical paths
- Forests should extend across adjacent tiles with appropriate transitions
- Mountain ranges should form coherent chains
- Coastlines should create realistic shores with beaches and cliffs
- Terrain should transition naturally between different biomes

Make each terrain tile detailed with realistic features. Include various natural terrain types like forests, mountains, plains, etc. Focus exclusively on natural landscapes without any signs of civilization.

IMPORTANT: Create only realistic terrain with features at a realistic advancement level. DO NOT include any magical or fantasy elements (no glowing terrain, enchanted forests, magical crystals, etc.). All terrain should be geologically and biologically plausible in a real-world setting.

Format the response as a JSON array of objects with properties: coordinates, description, and terrainCode.

Example:
[
  {
    "coordinates": {"x": 3, "y": 5},
    "description": "Dense pine forest with needle-covered ground and exposed granite outcroppings. Moss covers the north-facing rocks, and a small natural clearing reveals rich dark soil with ferns.",
    "terrainCode": "F-PIN|E-SLI|X-RCK|R-GRN"
  },
  {
    "coordinates": {"x": 3, "y": 6},
    "description": "The pine forest continues here but begins to thin out. The ground slopes gently downward with more exposed granite and the first signs of a small stream forming from spring water.",
    "terrainCode": "F-PIN|E-SLI|X-RCK|W-STR"
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
        max_tokens: 64000, // Increased from 4000 to 64000
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt + "\n\nIMPORTANT: Respond ONLY with the JSON array. Do not include any explanations, markdown formatting, or additional text before or after the JSON array."
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

    // Log the full response for debugging
    logger.debug(`Claude full response: ${JSON.stringify(responseData)}`);

    // Extract the JSON array from Claude's response
    const contentText = responseData.content[0].text;
    logger.info(`Claude response length: ${contentText.length} characters`);
    logger.debug(`Claude response first 500 chars: ${contentText.substring(0, 500)}...`);
    logger.debug(`Claude response last 500 chars: ...${contentText.substring(contentText.length - 500)}`);

    // Try to find JSON in the response using multiple approaches
    let jsonText = null;
    let terrainMap = null;

    // Approach 1: Find the first [ and the last ]
    try {
      const firstBrace = contentText.indexOf('[');
      const lastBrace = contentText.lastIndexOf(']');
      
      if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        jsonText = contentText.substring(firstBrace, lastBrace + 1);
        logger.debug(`Approach 1 - JSON extraction found text of length: ${jsonText.length}`);
        terrainMap = JSON.parse(jsonText);
        logger.info(`Successfully parsed terrain map with ${terrainMap.length} entries using approach 1`);
      } else {
        logger.warn('Approach 1 failed: Could not find valid JSON brackets');
      }
    } catch (parseError) {
      logger.warn(`Approach 1 failed to parse JSON: ${parseError.message}`);
    }

    // Approach 2: Use regex to find JSON array
    if (!terrainMap) {
      try {
        const jsonRegex = /\[\s*\{\s*"coordinates"/s;
        const match = contentText.match(jsonRegex);
        
        if (match) {
          const startIndex = match.index;
          let bracketCount = 0;
          let endIndex = startIndex;
          
          // Find the matching closing bracket by counting opening and closing brackets
          for (let i = startIndex; i < contentText.length; i++) {
            if (contentText[i] === '[') bracketCount++;
            if (contentText[i] === ']') bracketCount--;
            
            if (bracketCount === 0 && contentText[i] === ']') {
              endIndex = i + 1;
              break;
            }
          }
          
          if (endIndex > startIndex) {
            jsonText = contentText.substring(startIndex, endIndex);
            logger.debug(`Approach 2 - JSON extraction found text of length: ${jsonText.length}`);
            terrainMap = JSON.parse(jsonText);
            logger.info(`Successfully parsed terrain map with ${terrainMap.length} entries using approach 2`);
          } else {
            logger.warn('Approach 2 failed: Could not find matching closing bracket');
          }
        } else {
          logger.warn('Approach 2 failed: Could not find JSON array pattern');
        }
      } catch (parseError) {
        logger.warn(`Approach 2 failed to parse JSON: ${parseError.message}`);
      }
    }

    // Approach 3: Try to extract any JSON array from the response
    if (!terrainMap) {
      try {
        // Look for any JSON array in the text
        const possibleJsons = contentText.match(/\[[\s\S]*?\]/g);
        
        if (possibleJsons && possibleJsons.length > 0) {
          // Try each possible JSON array, starting with the longest one
          const sortedJsons = possibleJsons.sort((a, b) => b.length - a.length);
          
          for (const possibleJson of sortedJsons) {
            try {
              if (possibleJson.includes('"coordinates"')) {
                jsonText = possibleJson;
                logger.debug(`Approach 3 - JSON extraction found text of length: ${jsonText.length}`);
                terrainMap = JSON.parse(jsonText);
                logger.info(`Successfully parsed terrain map with ${terrainMap.length} entries using approach 3`);
                break;
              }
            } catch (e) {
              // Continue to the next possible JSON
              continue;
            }
          }
        }
        
        if (!terrainMap) {
          logger.warn('Approach 3 failed: Could not find valid JSON array');
        }
      } catch (parseError) {
        logger.warn(`Approach 3 failed: ${parseError.message}`);
      }
    }

    // If all approaches failed, throw an error
    if (!terrainMap) {
      // Save the problematic response to a file for analysis
      const errorResponsePath = path.join(__dirname, '../logs/claude_error_response.txt');
      await fs.writeFile(errorResponsePath, contentText);
      logger.error(`Saved problematic Claude response to ${errorResponsePath}`);
      
      throw new Error('Could not extract valid JSON from Claude response. Response saved to logs for analysis.');
    }
    
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
async function generateIslandImage(island, index, terrainMap = []) {
  try {
    logger.info(`Generating image for terrain at ${island.coordinates.x},${island.coordinates.y}`);
    
    // Find adjacent tiles to provide context for coherent generation
    const adjacentTiles = findAdjacentTiles(island.coordinates, terrainMap);
    const adjacentContext = createAdjacentContext(adjacentTiles);
    
    // Create a prompt for Ideogram based on the island description and adjacent context
    const prompt = `isometric view of realistic terrain tile with ${island.description}, white background, clearly defined edges, photorealistic style, detailed textures, natural lighting, high quality game asset, no shadows, isolated game tile, top-down isometric perspective, pure white background. 
    
    IMPORTANT: This tile should connect seamlessly with adjacent terrain: ${adjacentContext}`;
    
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
    
    // Re-enable background removal
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
    const response = await fetch(url, {
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'Terrain-Icon-Generator'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    
    // Check if we actually got an image
    if (buffer.length < 100) {
      throw new Error('Downloaded file is too small to be a valid image');
    }
    
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
    
    // Check if terrain map already exists
    const mapFilePath = path.join(__dirname, '../output/terrain_map/map.json');
    let terrainMap;
    
    try {
      // Try to read the existing map file
      const mapContent = await fs.readFile(mapFilePath, 'utf8');
      terrainMap = JSON.parse(mapContent);
      logger.info(`Using existing terrain map with ${terrainMap.length} islands from ${mapFilePath}`);
    } catch (err) {
      // If file doesn't exist or can't be parsed, generate a new map
      logger.info('No existing terrain map found, generating new map');
      terrainMap = await generateTerrainMap();
    }
    
    // Process each island with rate limiting
    logger.info(`Processing ${terrainMap.length} islands`);
    
    for (let i = 0; i < terrainMap.length; i++) {
      const island = terrainMap[i];
      
      try {
        // Check if island image already exists
        const islandImagePath = path.join(
          __dirname, 
          `../output/terrain_map/islands/island_${island.coordinates.x}_${island.coordinates.y}.png`
        );
        
        try {
          await fs.access(islandImagePath);
          logger.info(`Island image already exists for ${island.coordinates.x},${island.coordinates.y}, skipping generation`);
          continue; // Skip to next island
        } catch (imageErr) {
          // Image doesn't exist, generate it
        }
        
        // Add delay between requests to respect rate limits
        if (i > 0) {
          const delay = 2000; // 2 seconds between requests
          logger.debug(`Rate limiting: waiting ${delay}ms before next request`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Pass the full terrain map to provide context for adjacent tiles
        await generateIslandImage(island, i, terrainMap);
      } catch (error) {
        logger.error(`Error processing island at ${island.coordinates.x},${island.coordinates.y}: ${error.message}`);
        // Continue with next island even if one fails
      }
    }
    
    logger.info(`Terrain map processing completed. Generated ${terrainMap.length} islands.`);
    return {
      success: true,
      islandCount: terrainMap.length,
      mapPath: mapFilePath
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

// Find adjacent tiles in the terrain map
function findAdjacentTiles(coordinates, terrainMap) {
  const { x, y } = coordinates;
  const adjacentPositions = [
    { x: x-1, y: y, direction: "west" },
    { x: x+1, y: y, direction: "east" },
    { x: x, y: y-1, direction: "north" },
    { x: x, y: y+1, direction: "south" }
  ];
  
  const adjacentTiles = [];
  
  for (const pos of adjacentPositions) {
    const adjacentTile = terrainMap.find(tile => 
      tile.coordinates.x === pos.x && tile.coordinates.y === pos.y
    );
    
    if (adjacentTile) {
      adjacentTiles.push({
        ...adjacentTile,
        direction: pos.direction
      });
    }
  }
  
  return adjacentTiles;
}

// Create a description of adjacent terrain for the prompt
function createAdjacentContext(adjacentTiles) {
  if (adjacentTiles.length === 0) {
    return "no adjacent tiles available";
  }
  
  return adjacentTiles.map(tile => {
    return `${tile.direction}: ${getTerrainSummary(tile.terrainCode)} (${tile.terrainCode})`;
  }).join(", ");
}

// Get a short summary of terrain based on terrain code
function getTerrainSummary(terrainCode) {
  const parts = terrainCode.split('|');
  const baseCode = parts[0];
  
  // Map base terrain codes to simple descriptions
  const terrainMap = {
    "P-BAS": "basic grassland",
    "P-LUS": "lush grassland",
    "F-OAK": "oak forest",
    "F-PIN": "pine forest",
    "D-SND": "sandy desert",
    "M-LOW": "low mountains",
    "M-HIG": "high mountains",
    "W-RIV": "river",
    "W-LAK": "lake",
    "W-OCE": "ocean",
    "W-SEA": "sea"
    // Add more mappings as needed
  };
  
  return terrainMap[baseCode] || "unknown terrain";
}

module.exports = { processTerrainMap, generateTerrainMap, generateIslandImage };
