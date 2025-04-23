const express = require('express');
const router = express.Router();
const gameData = require('../data/gameData');
const logger = require('../utils/logger');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

// Get all terrain types
router.get('/terrain', (req, res) => {
  try {
    res.json(gameData.terrainTypes);
  } catch (error) {
    logger.error(`Error getting terrain data: ${error.message}`);
    res.status(500).json({ error: 'Failed to get terrain data' });
  }
});

// Get terrain by category
router.get('/terrain/:category', (req, res) => {
  try {
    const { category } = req.params;
    
    if (!gameData.terrainTypes[category]) {
      return res.status(404).json({ error: `Terrain category '${category}' not found` });
    }
    
    res.json(gameData.terrainTypes[category]);
  } catch (error) {
    logger.error(`Error getting terrain category: ${error.message}`);
    res.status(500).json({ error: 'Failed to get terrain category' });
  }
});

// Get all resources
router.get('/resources', (req, res) => {
  try {
    res.json(gameData.resources);
  } catch (error) {
    logger.error(`Error getting resource data: ${error.message}`);
    res.status(500).json({ error: 'Failed to get resource data' });
  }
});

// Get resources by category
router.get('/resources/:category', (req, res) => {
  try {
    const { category } = req.params;
    
    if (!gameData.resources[category]) {
      return res.status(404).json({ error: `Resource category '${category}' not found` });
    }
    
    res.json(gameData.resources[category]);
  } catch (error) {
    logger.error(`Error getting resource category: ${error.message}`);
    res.status(500).json({ error: 'Failed to get resource category' });
  }
});

// Get all actions
router.get('/actions', (req, res) => {
  try {
    res.json(gameData.actions);
  } catch (error) {
    logger.error(`Error getting action data: ${error.message}`);
    res.status(500).json({ error: 'Failed to get action data' });
  }
});

// Get actions for a specific terrain type
router.get('/actions/:terrainType', (req, res) => {
  try {
    const { terrainType } = req.params;
    
    logger.debug(`Looking for actions for terrain type: ${terrainType}`);
    
    // Find the terrain category that contains this terrain type
    let terrainActions = null;
    
    // Check each terrain category (plains, forest, etc.)
    for (const category in gameData.actions) {
      if (gameData.actions[category][terrainType]) {
        logger.debug(`Found actions for ${terrainType} in category ${category}`);
        terrainActions = gameData.actions[category][terrainType];
        break;
      }
    }
    
    if (!terrainActions) {
      // Try to determine the category from the terrain code prefix
      const prefix = terrainType.split('-')[0];
      let categoryMap = {
        'P': 'plains',
        'F': 'forest',
        'D': 'desert',
        'M': 'mountains',
        'W': 'water',
        'T': 'tundra',
        'R': 'rocky',
        'S': 'special',
        'L': 'wasteland'
      };
      
      const category = categoryMap[prefix];
      if (category && gameData.actions[category]) {
        // Look for similar terrain types in the same category as fallback
        logger.debug(`No exact match found, looking for similar terrain types in ${category} category`);
        
        // Use the first terrain type in the category as fallback
        const firstTerrainType = Object.keys(gameData.actions[category])[0];
        if (firstTerrainType) {
          logger.debug(`Using ${firstTerrainType} as fallback for ${terrainType}`);
          terrainActions = gameData.actions[category][firstTerrainType];
        }
      }
    }
    
    if (!terrainActions) {
      logger.debug(`No actions found for terrain type: ${terrainType}`);
      // If no specific actions found, return an empty array instead of 404
      // This allows for terrain types that don't have specific actions
      return res.json([]);
    }
    
    logger.debug(`Returning ${terrainActions.length} actions for ${terrainType}`);
    res.json(terrainActions);
  } catch (error) {
    logger.error(`Error getting actions for terrain type: ${error.message}`);
    res.status(500).json({ error: 'Failed to get actions for terrain type' });
  }
});

// Get all culture data
router.get('/culture', (req, res) => {
  try {
    res.json(gameData.culture);
  } catch (error) {
    logger.error(`Error getting culture data: ${error.message}`);
    res.status(500).json({ error: 'Failed to get culture data' });
  }
});

// Get culture by category
router.get('/culture/:category', (req, res) => {
  try {
    const { category } = req.params;
    
    if (!gameData.culture[category]) {
      return res.status(404).json({ error: `Culture category '${category}' not found` });
    }
    
    res.json(gameData.culture[category]);
  } catch (error) {
    logger.error(`Error getting culture category: ${error.message}`);
    res.status(500).json({ error: 'Failed to get culture category' });
  }
});

// Get actions for a terrain using KinOS analysis
router.get('/actions/ai/:terrainType', async (req, res) => {
  try {
    const { terrainType } = req.params;
    logger.info(`Getting AI-generated actions for terrain type: ${terrainType}`);
    
    // Extract the base terrain code (before any | character)
    const baseTerrainCode = terrainType.split('|')[0];
    logger.debug(`Base terrain code: ${baseTerrainCode}`);
    
    // First try to get actions from the local gameData
    // This serves as a fallback if the AI call fails
    let actions = [];
    
    // Check each terrain category for the base terrain code
    for (const category in gameData.actions) {
      if (gameData.actions[category][baseTerrainCode]) {
        logger.debug(`Found local actions for ${baseTerrainCode} in category ${category}`);
        actions = gameData.actions[category][baseTerrainCode];
        break;
      }
    }
    
    // If we found local actions, use those instead of calling KinOS
    if (actions.length > 0) {
      logger.info(`Using local actions for ${baseTerrainCode} (${actions.length} actions found)`);
      return res.json(actions);
    }
    
    // Read the initial_actions.md file for the system prompt
    const actionsDocPath = path.join(__dirname, '../../docs/initial_actions.md');
    const actionsDoc = await fs.readFile(actionsDocPath, 'utf8');
    
    // Prepare the message for KinOS analysis
    const userPrompt = `Based on the terrain code "${terrainType}", provide a list of available actions that would be realistic and appropriate.

The base terrain type is "${baseTerrainCode}" (the part before the first "|").

Return your response as a JSON array of action objects with these properties:
- code: The action code from the reference (e.g., "G-001")
- name: The name of the action (e.g., "Gather Wild Grasses")
- description: A brief description of the action
- emoji: An appropriate emoji that represents this action visually

Choose emojis that clearly represent the action's purpose (e.g., 🌾 for gathering grasses, 🏹 for hunting, 🏗️ for construction).

If the exact terrain type isn't in the reference, use the most similar terrain type from the same category.

Example response format:
[
  {
    "code": "G-001",
    "name": "Gather Wild Grasses",
    "description": "Collect grasses for various uses",
    "emoji": "🌾"
  },
  {
    "code": "H-001",
    "name": "Hunt Small Game",
    "description": "Hunt rabbits, rodents, and other small animals",
    "emoji": "🏹"
  }
]`;

    // Additional system instructions
    const systemInstructions = `You are a game world assistant that determines what actions are available for a given terrain type.
Use the following actions reference guide to determine appropriate actions:

${actionsDoc}`;

    logger.debug(`Making KinOS analysis request for terrain ${baseTerrainCode}`);
    
    // Make request to KinOS analysis endpoint
    const response = await fetch('http://localhost:5000/v2/blueprints/autonomousrealms/kins/defaultcolony/analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KINOS_API_KEY || config.KINOS_API_KEY}`
      },
      body: JSON.stringify({
        message: userPrompt,
        model: "claude-3-7-sonnet-latest",
        addSystem: systemInstructions
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`KinOS analysis request failed with status ${response.status}: ${errorText}`);
      
      // If we have local actions as fallback, use those
      if (actions.length > 0) {
        logger.info(`Using fallback local actions after KinOS API error`);
        return res.json(actions);
      }
      
      // If we have no local actions, generate some basic ones based on terrain type
      logger.info(`Generating basic fallback actions for ${baseTerrainCode}`);
      const fallbackActions = generateFallbackActions(baseTerrainCode);
      return res.json(fallbackActions);
    }

    const responseData = await response.json();
    logger.debug(`KinOS analysis response received`);
    
    if (!responseData.response) {
      throw new Error('Invalid response from KinOS: No response field found');
    }
    
    // Extract the JSON array from Claude's response
    const contentText = responseData.response;
    
    // Try to parse the JSON
    try {
      // Find JSON array in the response
      const jsonMatch = contentText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        actions = JSON.parse(jsonMatch[0]);
        logger.info(`Successfully parsed ${actions.length} actions from KinOS response`);
      } else {
        throw new Error('Could not find JSON array in KinOS response');
      }
    } catch (parseError) {
      logger.error(`Error parsing KinOS response: ${parseError.message}`);
      logger.debug(`KinOS response: ${contentText}`);
      
      // If we have local actions as fallback, use those
      if (actions.length > 0) {
        logger.info(`Using fallback local actions after KinOS response parsing error`);
        return res.json(actions);
      }
      
      // If we have no local actions, generate some basic ones based on terrain type
      logger.info(`Generating basic fallback actions for ${baseTerrainCode}`);
      actions = generateFallbackActions(baseTerrainCode);
    }
    
    res.json(actions);
  } catch (error) {
    logger.error(`Error getting AI actions for terrain type: ${error.message}`);
    
    // Generate basic fallback actions in case of any error
    const baseTerrainCode = req.params.terrainType.split('|')[0];
    const fallbackActions = generateFallbackActions(baseTerrainCode);
    
    res.json(fallbackActions);
  }
});

// Helper function to generate fallback actions based on terrain prefix
function generateFallbackActions(terrainCode) {
  // Extract the prefix (first letter before the hyphen)
  const prefix = terrainCode.charAt(0);
  
  // Default actions that work for most terrain types
  const defaultActions = [
    { code: "X-001", name: "Survey Area", description: "Explore and map the surrounding terrain", emoji: "🧭" },
    { code: "G-001", name: "Gather Resources", description: "Collect useful materials from the environment", emoji: "🧺" },
    { code: "C-001", name: "Build Basic Shelter", description: "Construct a simple protective structure", emoji: "🏕️" }
  ];
  
  // Add terrain-specific actions based on the prefix
  switch (prefix) {
    case 'P': // Plains
      return [
        ...defaultActions,
        { code: "G-002", name: "Collect Wild Plants", description: "Gather edible and useful plants", emoji: "🌿" },
        { code: "H-001", name: "Hunt Small Game", description: "Hunt small animals in the grassland", emoji: "🏹" }
      ];
    case 'F': // Forest
      return [
        ...defaultActions,
        { code: "G-008", name: "Gather Fallen Wood", description: "Collect wood from the forest floor", emoji: "🪵" },
        { code: "H-004", name: "Hunt Forest Animals", description: "Hunt creatures that live in the forest", emoji: "🦌" }
      ];
    case 'M': // Mountains
      return [
        ...defaultActions,
        { code: "G-023", name: "Gather Mountain Plants", description: "Collect unique plants from high elevations", emoji: "🏔️" },
        { code: "M-001", name: "Collect Surface Stones", description: "Gather useful rocks and stones", emoji: "🪨" },
        { code: "X-009", name: "Scout Mountain Passes", description: "Find routes through difficult terrain", emoji: "🧗" }
      ];
    case 'W': // Water
      return [
        ...defaultActions,
        { code: "G-030", name: "Gather Water Plants", description: "Collect plants growing in or near water", emoji: "🌊" },
        { code: "H-017", name: "Fish Waters", description: "Catch fish from the water", emoji: "🎣" }
      ];
    case 'D': // Desert
      return [
        ...defaultActions,
        { code: "G-018", name: "Collect Desert Plants", description: "Gather drought-resistant vegetation", emoji: "🌵" },
        { code: "W-003", name: "Search for Water", description: "Look for hidden water sources", emoji: "💧" }
      ];
    case 'R': // Rocky
      return [
        ...defaultActions,
        { code: "M-007", name: "Find Special Stones", description: "Search for unusual or useful rocks", emoji: "💎" },
        { code: "T-022", name: "Make Stone Tools", description: "Craft implements from available stone", emoji: "🔨" }
      ];
    case 'T': // Tundra
      return [
        ...defaultActions,
        { code: "G-036", name: "Gather Tundra Plants", description: "Collect hardy plants from cold environment", emoji: "❄️" },
        { code: "T-019", name: "Craft Cold-Weather Gear", description: "Create clothing for extreme conditions", emoji: "🧤" }
      ];
    case 'L': // Wasteland
      return [
        ...defaultActions,
        { code: "X-029", name: "Find Safe Passages", description: "Discover routes with minimal hazards", emoji: "🧪" },
        { code: "X-030", name: "Locate Surviving Resources", description: "Find usable materials in harsh conditions", emoji: "🔍" }
      ];
    default:
      return defaultActions;
  }
}

// Add this new endpoint after the existing /actions/ai/:terrainType endpoint
router.get('/actions/ai/:terrainCode/narration', async (req, res) => {
  try {
    const { terrainCode } = req.params;
    
    // Extract the base terrain type (before any | character)
    const baseTerrainCode = terrainCode.split('|')[0];
    
    logger.info(`Generating narration for terrain code: ${terrainCode}`);
    
    // Use Claude API to generate a narration based on the terrain code
    const narration = await generateAINarrationForTerrain(terrainCode);
    
    // Call the TTS API to convert the narration to speech
    const ttsResponse = await generateTTS(narration, terrainCode);
    
    // Check if there was an error with TTS
    if (ttsResponse.error) {
      logger.error(`TTS generation failed: ${ttsResponse.error}`);
      
      // Return the narration text but with the error for the audio
      return res.json({
        terrainCode,
        narration,
        audio: null,
        error: {
          message: "Failed to generate audio narration",
          details: ttsResponse.error
        }
      });
    }
    
    res.json({
      terrainCode,
      narration,
      audio: ttsResponse
    });
  } catch (error) {
    logger.error(`Error generating narration: ${error.message}`, { error });
    res.status(500).json({ 
      error: 'Failed to generate narration', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Add this function to generate narration using KinOS analysis
async function generateAINarrationForTerrain(terrainCode) {
  try {
    // Extract the base terrain code and any modifiers
    const parts = terrainCode.split('|');
    const baseTerrainCode = parts[0];
    const modifiers = parts.slice(1);
    
    // Create a prompt for KinOS analysis
    const prompt = `Write a single, vivid sentence describing settlers arriving at a ${getTerrainDescription(baseTerrainCode)} terrain for the first time. The sentence should evoke the feeling of discovery and the unique characteristics of this terrain. Keep it under 150 characters if possible.

Terrain code: ${baseTerrainCode}
Modifiers: ${modifiers.join(', ')}`;

    // Make request to KinOS analysis endpoint
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
      throw new Error(`KinOS analysis request failed with status ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    
    if (!responseData.response) {
      throw new Error('Invalid response from KinOS: No response field found');
    }
    
    const narration = responseData.response.trim();
    
    // Log the generated narration
    logger.info(`Generated narration for ${terrainCode}: ${narration}`);
    
    return narration;
  } catch (error) {
    logger.error(`Error generating AI narration: ${error.message}`);
    // Return a fallback narration if AI generation fails
    return `The settlers arrived at the new terrain, surveying the ${getTerrainDescription(terrainCode.split('|')[0])} with cautious optimism.`;
  }
}

// Helper function to get a human-readable description of a terrain code
function getTerrainDescription(baseTerrainCode) {
  const terrainDescriptions = {
    // Plains
    "P-BAS": "basic grassland",
    "P-LUS": "lush grassland",
    "P-TAL": "tall grass prairie",
    "P-FLW": "flower-dotted meadow",
    "P-DRY": "dry savanna",
    "P-SCR": "scrubland",
    "P-STN": "stony plain",
    "P-BUR": "burned grassland",
    "P-FRT": "fertile plain",
    "P-RCH": "rich soil plain",
    
    // Forest
    "F-OAK": "oak forest",
    "F-PIN": "pine forest",
    "F-SPR": "spruce forest",
    "F-BIR": "birch forest",
    "F-JUN": "jungle",
    "F-PAL": "palm grove",
    "F-BAM": "bamboo forest",
    "F-RED": "redwood forest",
    "F-MIX": "mixed forest",
    "F-AUT": "autumn forest",
    
    // Desert
    "D-SND": "sandy desert",
    "D-ROC": "rocky desert",
    "D-DUN": "sand dunes",
    "D-FLT": "flat desert",
    "D-SAL": "salt flat",
    "D-OAS": "oasis",
    
    // Mountains
    "M-LOW": "low mountains",
    "M-HIG": "high mountains",
    "M-PEA": "snowy peaks",
    "M-VOL": "volcanic mountain",
    
    // Water
    "W-RIV": "river",
    "W-LAK": "lake",
    "W-SWP": "swamp",
    "W-BOG": "bog",
    
    // Default
    "DEFAULT": "unknown terrain"
  };
  
  return terrainDescriptions[baseTerrainCode] || terrainDescriptions["DEFAULT"];
}

// Add this function to generate TTS using the KinOS API
async function generateTTS(text, terrainCode) {
  try {
    logger.info(`Generating TTS for text: "${text.substring(0, 50)}..."`);
    
    // First check if we already have a cached narration for this terrain
    const narrationDir = path.join(__dirname, '../assets/audio/narration');
    const narrationFilename = `narration_${terrainCode.replace(/\|/g, '_')}.mp3`;
    const narrationPath = path.join(narrationDir, narrationFilename);
    
    // Check if the narration file already exists
    try {
      await fs.access(narrationPath);
      logger.info(`Using cached narration audio for ${terrainCode}`);
      
      // Return the path to the cached audio file
      return {
        audio_url: `/assets/audio/narration/${narrationFilename}`
      };
    } catch (err) {
      // File doesn't exist, generate new audio
      logger.debug(`No cached narration found for ${terrainCode}, generating new audio`);
    }
    
    // Make sure the narration directory exists
    await fs.mkdir(narrationDir, { recursive: true });
    
    // Make a direct request for binary audio data
    try {
      const response = await fetch('https://api.kinos-engine.ai/v2/tts?format=mp3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.KINOS_API_KEY || config.KINOS_API_KEY}`,
          'Accept': 'application/json' // Explicitly request JSON response
        },
        body: JSON.stringify({
          text: text,
          voice_id: "IKne3meq5aSn9XLyUdCD",
          model: "eleven_flash_v2_5"
        })
      });
        
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`TTS API request failed with status ${response.status}: ${errorText}`);
        return { 
          error: `TTS API request failed with status ${response.status}`,
          errorDetails: errorText,
          audio_url: `/assets/audio/narration/dummy.mp3` // Add fallback audio URL
        };
      }
        
      // Check if the response is binary audio data or JSON
      const contentType = response.headers.get('content-type');
      logger.debug(`TTS API response content-type: ${contentType}`);
      
      // First check if the response is binary data by examining the first few bytes
      const clonedResponse = response.clone(); // Clone the response so we can examine it without consuming it
      const firstChunk = await clonedResponse.arrayBuffer();
      const firstBytes = new Uint8Array(firstChunk.slice(0, 4));
      const firstBytesHex = Array.from(firstBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      logger.debug(`First bytes of response: ${firstBytesHex}`);
      
      // Check for MP3 header (ID3 - 49 44 33) or other audio format signatures
      const isBinaryAudio = firstBytesHex.startsWith('49443') || // ID3 for MP3
                            firstBytesHex.startsWith('fff') ||   // MP3 without ID3
                            firstBytesHex.startsWith('4f676753'); // OGG
        
      // Handle binary audio data (MP3)
      if (isBinaryAudio || (contentType && contentType.includes('audio/'))) {
        try {
          // Get the audio as an ArrayBuffer
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
            
          // Save the audio file
          await fs.writeFile(narrationPath, buffer);
            
          logger.info(`Saved narration audio to ${narrationPath}`);
            
          // Return the URL to the saved file
          return {
            audio_url: `/assets/audio/narration/${narrationFilename}`
          };
        } catch (bufferError) {
          logger.error(`Error processing audio buffer: ${bufferError.message}`);
          return { 
            error: `Failed to process audio data: ${bufferError.message}`,
            audio_url: `/assets/audio/narration/dummy.mp3` // Add fallback audio URL
          };
        }
      } 
      // Handle JSON response
      else if (contentType && contentType.includes('application/json')) {
        try {
          const data = await response.json();
          logger.info(`Received JSON response with audio URL: ${data.audio_url ? 'Yes' : 'No'}`);
            
          // If we have an audio URL, download and save the file
          if (data.audio_url || data.result_url) {
            try {
              const audioUrl = data.audio_url || data.result_url;
              const audioResponse = await fetch(audioUrl);
                
              if (!audioResponse.ok) {
                throw new Error(`Failed to download audio: ${audioResponse.status}`);
              }
                
              const audioBuffer = await audioResponse.buffer();
              await fs.writeFile(narrationPath, audioBuffer);
                
              logger.info(`Saved narration audio to ${narrationPath}`);
                
              // Update the response to use our local path
              data.audio_url = `/assets/audio/narration/${narrationFilename}`;
            } catch (downloadError) {
              logger.error(`Error saving audio file: ${downloadError.message}`);
              // Continue with the original response even if saving fails
              // Add fallback if no audio_url exists
              if (!data.audio_url && !data.result_url) {
                data.audio_url = `/assets/audio/narration/dummy.mp3`;
              }
            }
          } else {
            // Add fallback if no audio_url exists
            data.audio_url = `/assets/audio/narration/dummy.mp3`;
          }
            
          return data;
        } catch (jsonError) {
          logger.error(`Error parsing JSON response: ${jsonError.message}`);
          return { 
            error: `Failed to process TTS response: ${jsonError.message}`,
            audio_url: `/assets/audio/narration/dummy.mp3` // Add fallback audio URL
          };
        }
      }
      // Unknown content type - try to save as binary anyway
      else {
        try {
          logger.warn(`Unknown content type from TTS API: ${contentType}, attempting to save as binary`);
          const buffer = await response.buffer();
            
          // Save the audio file
          await fs.writeFile(narrationPath, buffer);
            
          logger.info(`Saved unknown content to ${narrationPath}`);
            
          // Return the URL to the saved file
          return {
            audio_url: `/assets/audio/narration/${narrationFilename}`,
            warning: `Unknown content type: ${contentType}`
          };
        } catch (unknownError) {
          logger.error(`Error handling unknown content type: ${unknownError.message}`);
          return { 
            error: `Failed to process unknown response type: ${unknownError.message}`,
            audio_url: `/assets/audio/narration/dummy.mp3` // Add fallback audio URL
          };
        }
      }
    } catch (error) {
      logger.error(`Error with TTS request: ${error.message}`);
      return { 
        error: error.message,
        stack: error.stack,
        audio_url: `/assets/audio/narration/dummy.mp3` // Add fallback audio URL
      };
    }
  } catch (error) {
    logger.error(`Error generating TTS: ${error.message}`, { error });
    return { 
      error: error.message,
      stack: error.stack,
      audio_url: `/assets/audio/narration/dummy.mp3` // Add fallback audio URL
    };
  }
}

module.exports = router;
