const express = require('express');
const router = express.Router();
const gameData = require('../data/gameData');
const logger = require('../utils/logger');

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

module.exports = router;
