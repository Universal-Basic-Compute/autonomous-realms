const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const tileService = require('../services/tileGenerationService');
const config = require('../config');

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
    
    // Check if tile already exists
    const tilePath = path.join(
      config.TILES_DIR, 
      `${position.regionX}_${position.regionY}_${position.x}_${position.y}.png`
    );
    
    try {
      await fs.access(tilePath);
      // Tile exists, return it
      return res.sendFile(tilePath);
    } catch (err) {
      // Tile doesn't exist, need to generate it
      console.log(`Generating tile at position ${JSON.stringify(position)}`);
      
      // For the first tile (0,0), use a base tile
      if (position.x === 0 && position.y === 0) {
        const baseTilePath = path.join(config.TILES_DIR, 'base_tile.png');
        try {
          await fs.access(baseTilePath);
          // Copy base tile to the new position
          await fs.copyFile(baseTilePath, tilePath);
          return res.sendFile(tilePath);
        } catch (baseErr) {
          return res.status(404).json({ error: 'Base tile not found' });
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
          const newTilePath = await tileService.generateNextHorizontalTile(previousTilePath, position);
          return res.sendFile(newTilePath);
        } catch (prevErr) {
          return res.status(404).json({ error: 'Previous tile not found' });
        }
      }
      
      // For other positions, implement vertical and interior tile generation
      // ...
      
      return res.status(501).json({ error: 'Tile generation not implemented for this position' });
    }
  } catch (error) {
    console.error('Error handling tile request:', error);
    res.status(500).json({ error: 'Failed to process tile request' });
  }
});

module.exports = router;
