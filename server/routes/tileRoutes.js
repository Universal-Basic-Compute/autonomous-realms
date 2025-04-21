const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const tileService = require('../services/tileGenerationService');
const config = require('../config');
const logger = require('../utils/logger');

// Get a tile by coordinates
router.get('/:regionX/:regionY/:x/:y', async (req, res) => {
  try {
    const { regionX, regionY, x, y } = req.params;
    const position = { 
      regionX: parseInt(regionX), 
      regionY: parseInt(regionY),
      x: parseInt(x),
      y: parseInt(y)
    };
    
    logger.info(`Tile requested at position ${JSON.stringify(position)}`);
    
    // Check if tile already exists
    const tilePath = path.join(
      config.TILES_DIR, 
      `${position.regionX}_${position.regionY}_${position.x}_${position.y}.png`
    );
    
    try {
      await fs.access(tilePath);
      // Tile exists, return it
      logger.debug(`Tile found at ${tilePath}, serving existing file`);
      return res.sendFile(tilePath);
    } catch (err) {
      // Tile doesn't exist, need to generate it
      logger.info(`Tile not found, generating new tile at position ${JSON.stringify(position)}`);
      
      // For the first tile (0,0), use a base tile or generate a fallback
      if (position.x === 0 && position.y === 0) {
        const baseTilePath = path.join(config.TILES_DIR, 'base_tile.png');
        try {
          await fs.access(baseTilePath);
          // Copy base tile to the new position
          logger.debug(`Using base tile for position (0,0)`);
          await fs.copyFile(baseTilePath, tilePath);
          return res.sendFile(tilePath);
        } catch (baseErr) {
          logger.info(`Base tile not found at ${baseTilePath}, generating fallback tile`);
          // Generate a fallback tile for the base position
          const fallbackTilePath = await tileService.generateFallbackTile(position);
          return res.sendFile(fallbackTilePath);
        }
      }
      
      // For horizontal tiles (x > 0, y = 0)
      if (position.x > 0 && position.y === 0) {
        const previousTilePath = path.join(
          config.TILES_DIR, 
          `${position.regionX}_${position.regionY}_${position.x-1}_${position.y}.png`
        );
        
        try {
          await fs.access(previousTilePath);
          logger.debug(`Generating horizontal tile using previous tile at ${previousTilePath}`);
          const newTilePath = await tileService.generateNextHorizontalTile(previousTilePath, position);
          return res.sendFile(newTilePath);
        } catch (prevErr) {
          logger.error(`Previous tile not found at ${previousTilePath}`);
          return res.status(404).json({ error: 'Previous tile not found' });
        }
      }
      
      // For vertical tiles (x = 0, y > 0)
      if (position.x === 0 && position.y > 0) {
        const bottomTilePath = path.join(
          config.TILES_DIR, 
          `${position.regionX}_${position.regionY}_${position.x}_${position.y-1}.png`
        );
        
        try {
          await fs.access(bottomTilePath);
          logger.debug(`Generating vertical tile using bottom tile at ${bottomTilePath}`);
          const newTilePath = await tileService.generateNextVerticalTile(bottomTilePath, position);
          return res.sendFile(newTilePath);
        } catch (bottomErr) {
          logger.error(`Bottom tile not found at ${bottomTilePath}`);
          return res.status(404).json({ error: 'Bottom tile not found' });
        }
      }
      
      // For interior tiles (x > 0, y > 0)
      if (position.x > 0 && position.y > 0) {
        const leftTilePath = path.join(
          config.TILES_DIR, 
          `${position.regionX}_${position.regionY}_${position.x-1}_${position.y}.png`
        );
        
        const bottomTilePath = path.join(
          config.TILES_DIR, 
          `${position.regionX}_${position.regionY}_${position.x}_${position.y-1}.png`
        );
        
        try {
          await fs.access(leftTilePath);
          await fs.access(bottomTilePath);
          
          logger.debug(`Generating interior tile using left tile at ${leftTilePath} and bottom tile at ${bottomTilePath}`);
          const newTilePath = await tileService.generateInteriorTile(leftTilePath, bottomTilePath, position);
          return res.sendFile(newTilePath);
        } catch (tileErr) {
          logger.error(`Required adjacent tiles not found for interior tile generation`);
          return res.status(404).json({ error: 'Required adjacent tiles not found' });
        }
      }
      
      logger.warn(`Unsupported tile position: ${JSON.stringify(position)}`);
      return res.status(501).json({ error: 'Tile generation not implemented for this position' });
    }
  } catch (error) {
    logger.error(`Error handling tile request: ${error.message}`, { error });
    res.status(500).json({ error: 'Failed to process tile request' });
  }
});

// Get information about a tile
router.get('/:regionX/:regionY/:x/:y/info', async (req, res) => {
  try {
    const { regionX, regionY, x, y } = req.params;
    const position = { 
      regionX: parseInt(regionX), 
      regionY: parseInt(regionY),
      x: parseInt(x),
      y: parseInt(y)
    };
    
    // Check if tile exists
    const tilePath = path.join(
      config.TILES_DIR, 
      `${position.regionX}_${position.regionY}_${position.x}_${position.y}.png`
    );
    
    try {
      const stats = await fs.stat(tilePath);
      
      res.json({
        position,
        exists: true,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        terrainCode: tileService.getTerrainCodeForPosition(position)
      });
    } catch (err) {
      res.json({
        position,
        exists: false,
        terrainCode: tileService.getTerrainCodeForPosition(position)
      });
    }
  } catch (error) {
    logger.error(`Error getting tile info: ${error.message}`);
    res.status(500).json({ error: 'Failed to get tile information' });
  }
});

module.exports = router;
