const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const { generateAllTerrainIcons } = require('../scripts/generateTerrainIcons');

// Get all terrain icons
router.get('/terrain', async (req, res) => {
  try {
    const iconDir = path.join(__dirname, '../assets/icons/terrain');
    
    try {
      await fs.access(iconDir);
    } catch (err) {
      // Directory doesn't exist, create it
      await fs.mkdir(iconDir, { recursive: true });
    }
    
    // Get all icon files
    const files = await fs.readdir(iconDir);
    const iconFiles = files.filter(file => file.endsWith('.png'));
    
    // Map to icon objects
    const icons = iconFiles.map(file => {
      const code = file.replace('.png', '').replace('_', '-').toUpperCase();
      return {
        code,
        filename: file,
        url: `/assets/icons/terrain/${file}`
      };
    });
    
    res.json({
      count: icons.length,
      icons
    });
  } catch (error) {
    logger.error(`Error getting terrain icons: ${error.message}`);
    res.status(500).json({ error: 'Failed to get terrain icons' });
  }
});

// Get a specific terrain icon
router.get('/terrain/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const filename = code.toLowerCase().replace('-', '_') + '.png';
    const iconPath = path.join(__dirname, '../assets/icons/terrain', filename);
    
    try {
      await fs.access(iconPath);
      return res.sendFile(iconPath);
    } catch (err) {
      return res.status(404).json({ error: 'Icon not found' });
    }
  } catch (error) {
    logger.error(`Error getting terrain icon: ${error.message}`);
    res.status(500).json({ error: 'Failed to get terrain icon' });
  }
});

// Generate all terrain icons
router.post('/terrain/generate', async (req, res) => {
  try {
    // Check for API key in request
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Start the generation process
    res.json({ message: 'Terrain icon generation started', status: 'processing' });
    
    // Run the generation in the background
    generateAllTerrainIcons()
      .then(result => {
        logger.info(`Terrain icon generation completed with status: ${result.success ? 'success' : 'failure'}`);
      })
      .catch(error => {
        logger.error(`Error in terrain icon generation: ${error.message}`);
      });
  } catch (error) {
    logger.error(`Error starting terrain icon generation: ${error.message}`);
    res.status(500).json({ error: 'Failed to start terrain icon generation' });
  }
});

module.exports = router;
