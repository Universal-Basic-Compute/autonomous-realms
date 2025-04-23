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
    
    // Read the initial_actions.md file for the system prompt
    const actionsDocPath = path.join(__dirname, '../../docs/initial_actions.md');
    const actionsDoc = await fs.readFile(actionsDocPath, 'utf8');
    
    // Prepare the system prompt with the actions reference
    const systemPrompt = `You are a game world assistant that determines what actions are available for a given terrain type.
Use the following actions reference guide to determine appropriate actions:

${actionsDoc}`;
    
    // Prepare the user prompt
    const userPrompt = `Based on the terrain code "${terrainType}", provide a list of available actions that would be realistic and appropriate.

If the terrain code has multiple parts separated by "|" (like "F-OAK|E-SLI|X-RUI"), focus on the base terrain type (the part before the first "|").

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

    // Make request to Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY || config.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
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
    
    // Extract the JSON array from Claude's response
    const contentText = responseData.content[0].text;
    
    // Try to parse the JSON
    let actions = [];
    try {
      // Find JSON array in the response
      const jsonMatch = contentText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        actions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not find JSON array in Claude response');
      }
    } catch (parseError) {
      logger.error(`Error parsing Claude response: ${parseError.message}`);
      logger.debug(`Claude response: ${contentText}`);
      return res.status(500).json({ error: 'Failed to parse actions from AI response' });
    }
    
    // Cache the result for future use
    // (In a production system, you might want to store this in a database)
    
    res.json(actions);
  } catch (error) {
    logger.error(`Error getting AI actions for terrain type: ${error.message}`);
    res.status(500).json({ error: 'Failed to get AI actions for terrain type' });
  }
});

module.exports = router;
