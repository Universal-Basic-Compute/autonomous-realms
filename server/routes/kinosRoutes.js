const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const logger = require('../utils/logger');
const config = require('../config');

// Create a new kin
router.post('/kins', async (req, res) => {
  try {
    const { name } = req.body;
    
    logger.info(`Creating new kin with name: ${name}`);
    
    const response = await fetch('http://localhost:5000/v2/blueprints/autonomousrealms/kins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KINOS_API_KEY || config.KINOS_API_KEY}`
      },
      body: JSON.stringify({
        name
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      logger.error(`Error from KinOS API: ${JSON.stringify(data)}`);
      return res.status(response.status).json(data);
    }
    
    logger.info(`Successfully created kin: ${name}`);
    res.json(data);
  } catch (error) {
    logger.error(`Error creating kin: ${error.message}`);
    res.status(500).json({ error: 'Failed to create kin' });
  }
});

// Send a message to a kin
router.post('/kins/:kinName/messages', async (req, res) => {
  try {
    const { kinName } = req.params;
    const { content, model, mode, addSystem } = req.body;
    
    logger.info(`Sending message to kin: ${kinName}`);
    
    const response = await fetch(`http://localhost:5000/v2/blueprints/autonomousrealms/kins/${kinName}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KINOS_API_KEY || config.KINOS_API_KEY}`
      },
      body: JSON.stringify({
        content,
        model,
        mode,
        addSystem
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      logger.error(`Error from KinOS API: ${JSON.stringify(data)}`);
      return res.status(response.status).json(data);
    }
    
    logger.info(`Successfully sent message to kin: ${kinName}`);
    res.json(data);
  } catch (error) {
    logger.error(`Error sending message to kin: ${error.message}`);
    res.status(500).json({ error: 'Failed to send message to kin' });
  }
});

// Generate an image
router.post('/kins/:kinName/images', async (req, res) => {
  try {
    const { kinName } = req.params;
    const { prompt, aspect_ratio, model, magic_prompt_option } = req.body;
    
    logger.info(`Generating image for kin: ${kinName}`);
    
    const response = await fetch(`http://localhost:5000/v2/blueprints/autonomousrealms/kins/${kinName}/images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KINOS_API_KEY || config.KINOS_API_KEY}`
      },
      body: JSON.stringify({
        prompt,
        aspect_ratio,
        model,
        magic_prompt_option
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      logger.error(`Error from KinOS API: ${JSON.stringify(data)}`);
      return res.status(response.status).json(data);
    }
    
    logger.info(`Successfully generated image for kin: ${kinName}`);
    res.json(data);
  } catch (error) {
    logger.error(`Error generating image for kin: ${error.message}`);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

// Generate TTS
router.post('/tts', async (req, res) => {
  try {
    const { text, voice_id, model } = req.body;
    const format = req.query.format || 'mp3';
    
    logger.info(`Generating TTS for text: "${text.substring(0, 50)}..."`);
    
    const response = await fetch(`http://localhost:5000/v2/tts?format=${format}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KINOS_API_KEY || config.KINOS_API_KEY}`
      },
      body: JSON.stringify({
        text,
        voice_id,
        model
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      logger.error(`Error from KinOS API: ${JSON.stringify(data)}`);
      return res.status(response.status).json(data);
    }
    
    logger.info(`Successfully generated TTS`);
    res.json(data);
  } catch (error) {
    logger.error(`Error generating TTS: ${error.message}`);
    res.status(500).json({ error: 'Failed to generate TTS' });
  }
});

module.exports = router;
