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

// Get actions for a terrain using Claude AI
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
    
    // If we found local actions, use those instead of calling Claude
    if (actions.length > 0) {
      logger.info(`Using local actions for ${baseTerrainCode} (${actions.length} actions found)`);
      return res.json(actions);
    }
    
    // Read the initial_actions.md file for the system prompt
    const actionsDocPath = path.join(__dirname, '../../docs/initial_actions.md');
    const actionsDoc = await fs.readFile(actionsDocPath, 'utf8');
    
    // Prepare the system prompt with the actions reference
    const systemPrompt = `You are a game world assistant that determines what actions are available for a given terrain type.
Use the following actions reference guide to determine appropriate actions:

${actionsDoc}`;
    
    // Prepare the user prompt
    const userPrompt = `Based on the terrain code "${terrainType}", provide a list of available actions that would be realistic and appropriate.

The base terrain type is "${baseTerrainCode}" (the part before the first "|").

Return your response as a JSON array of action objects with these properties:
- code: The action code from the reference (e.g., "G-001")
- name: The name of the action (e.g., "Gather Wild Grasses")
- description: A brief description of the action

If the exact terrain type isn't in the reference, use the most similar terrain type from the same category.

Example response format:
[
  {
    "code": "G-001",
    "name": "Gather Wild Grasses",
    "description": "Collect grasses for various uses"
  },
  {
    "code": "H-001",
    "name": "Hunt Small Game",
    "description": "Hunt rabbits, rodents, and other small animals"
  }
]`;

    logger.debug(`Making Claude API request for terrain ${baseTerrainCode}`);
    
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
      logger.error(`Claude API request failed with status ${response.status}: ${errorText}`);
      
      // If we have a Claude API error but found local actions as fallback, use those
      if (actions.length > 0) {
        logger.info(`Using fallback local actions after Claude API error`);
        return res.json(actions);
      }
      
      // If we have no local actions, generate some basic ones based on terrain type
      logger.info(`Generating basic fallback actions for ${baseTerrainCode}`);
      const fallbackActions = generateFallbackActions(baseTerrainCode);
      return res.json(fallbackActions);
    }

    const responseData = await response.json();
    logger.debug(`Claude API response received`);
    
    // Extract the JSON array from Claude's response
    const contentText = responseData.content[0].text;
    
    // Try to parse the JSON
    try {
      // Find JSON array in the response
      const jsonMatch = contentText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        actions = JSON.parse(jsonMatch[0]);
        logger.info(`Successfully parsed ${actions.length} actions from Claude response`);
      } else {
        throw new Error('Could not find JSON array in Claude response');
      }
    } catch (parseError) {
      logger.error(`Error parsing Claude response: ${parseError.message}`);
      logger.debug(`Claude response: ${contentText}`);
      
      // If we have local actions as fallback, use those
      if (actions.length > 0) {
        logger.info(`Using fallback local actions after Claude response parsing error`);
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
    { code: "X-001", name: "Survey Area", description: "Explore and map the surrounding terrain" },
    { code: "G-001", name: "Gather Resources", description: "Collect useful materials from the environment" },
    { code: "C-001", name: "Build Basic Shelter", description: "Construct a simple protective structure" }
  ];
  
  // Add terrain-specific actions based on the prefix
  switch (prefix) {
    case 'P': // Plains
      return [
        ...defaultActions,
        { code: "G-002", name: "Collect Wild Plants", description: "Gather edible and useful plants" },
        { code: "H-001", name: "Hunt Small Game", description: "Hunt small animals in the grassland" }
      ];
    case 'F': // Forest
      return [
        ...defaultActions,
        { code: "G-008", name: "Gather Fallen Wood", description: "Collect wood from the forest floor" },
        { code: "H-004", name: "Hunt Forest Animals", description: "Hunt creatures that live in the forest" }
      ];
    case 'M': // Mountains
      return [
        ...defaultActions,
        { code: "G-023", name: "Gather Mountain Plants", description: "Collect unique plants from high elevations" },
        { code: "M-001", name: "Collect Surface Stones", description: "Gather useful rocks and stones" },
        { code: "X-009", name: "Scout Mountain Passes", description: "Find routes through difficult terrain" }
      ];
    case 'W': // Water
      return [
        ...defaultActions,
        { code: "G-030", name: "Gather Water Plants", description: "Collect plants growing in or near water" },
        { code: "H-017", name: "Fish Waters", description: "Catch fish from the water" }
      ];
    case 'D': // Desert
      return [
        ...defaultActions,
        { code: "G-018", name: "Collect Desert Plants", description: "Gather drought-resistant vegetation" },
        { code: "W-003", name: "Search for Water", description: "Look for hidden water sources" }
      ];
    case 'R': // Rocky
      return [
        ...defaultActions,
        { code: "M-007", name: "Find Special Stones", description: "Search for unusual or useful rocks" },
        { code: "T-022", name: "Make Stone Tools", description: "Craft implements from available stone" }
      ];
    case 'T': // Tundra
      return [
        ...defaultActions,
        { code: "G-036", name: "Gather Tundra Plants", description: "Collect hardy plants from cold environment" },
        { code: "T-019", name: "Craft Cold-Weather Gear", description: "Create clothing for extreme conditions" }
      ];
    case 'L': // Wasteland
      return [
        ...defaultActions,
        { code: "X-029", name: "Find Safe Passages", description: "Discover routes with minimal hazards" },
        { code: "X-030", name: "Locate Surviving Resources", description: "Find usable materials in harsh conditions" }
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
    const ttsResponse = await generateTTS(narration);
    
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

// Add this function to generate narration using Claude AI
async function generateAINarrationForTerrain(terrainCode) {
  try {
    // Extract the base terrain code and any modifiers
    const parts = terrainCode.split('|');
    const baseTerrainCode = parts[0];
    const modifiers = parts.slice(1);
    
    // Create a prompt for Claude to generate a narration
    const prompt = `Write a single, vivid sentence describing settlers arriving at a ${getTerrainDescription(baseTerrainCode)} terrain for the first time. The sentence should evoke the feeling of discovery and the unique characteristics of this terrain. Keep it under 150 characters if possible.

Terrain code: ${baseTerrainCode}
Modifiers: ${modifiers.join(', ')}`;

    // Make request to Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY || config.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-3-7-sonnet-latest", // Updated from claude-3-haiku-20240307
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API request failed with status ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    const narration = responseData.content[0].text.trim();
    
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
async function generateTTS(text) {
  try {
    logger.info(`Generating TTS for text: "${text.substring(0, 50)}..."`);
    
    const response = await fetch('https://api.kinos-engine.ai/v2/tts?format=json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KINOS_API_KEY || config.KINOS_API_KEY}`
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
        errorDetails: errorText
      };
    }
    
    const data = await response.json();
    logger.info(`Successfully generated TTS, received audio URL: ${data.audio_url ? 'Yes' : 'No'}`);
    return data;
  } catch (error) {
    logger.error(`Error generating TTS: ${error.message}`, { error });
    return { 
      error: error.message,
      stack: error.stack
    };
  }
}

module.exports = router;
