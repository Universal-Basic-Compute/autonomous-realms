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
    const { prompt, aspect_ratio, model, magic_prompt, magic_prompt_option } = req.body;
    
    logger.info(`Generating image for kin: ${kinName}`);
    
    // Try KinOS endpoint first
    try {
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
          magic_prompt_option: magic_prompt_option || (magic_prompt ? "AUTO" : undefined)
        })
      });
    
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`KinOS image API error: ${JSON.stringify(data)}`);
      }
      
      logger.info(`Successfully generated image for kin: ${kinName} via KinOS`);
      return res.json(data);
    } catch (kinosError) {
      // If KinOS endpoint fails, try the Ideogram API directly
      logger.warn(`KinOS image generation failed, trying Ideogram directly: ${kinosError.message}`);
      
      // Map aspect ratio to Ideogram format
      let ideogramAspectRatio = "ASPECT_1_1";
      if (aspect_ratio === "16:9" || aspect_ratio === "ASPECT_16_9") {
        ideogramAspectRatio = "ASPECT_16_9";
      } else if (aspect_ratio === "4:3" || aspect_ratio === "ASPECT_4_3") {
        ideogramAspectRatio = "ASPECT_4_3";
      }
      
      // Map model to Ideogram format
      let ideogramModel = "V_2A_TURBO";
      if (model === "ideogram-v2") {
        ideogramModel = "V_2A_TURBO";
      }
      
      const ideogramResponse = await fetch('https://api.ideogram.ai/generate', {
        method: 'POST',
        headers: {
          'Api-Key': process.env.IDEOGRAM_API_KEY || config.IDEOGRAM_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          image_request: {
            prompt: prompt,
            model: ideogramModel,
            aspect_ratio: ideogramAspectRatio,
            style_type: "REALISTIC"
          }
        })
      });
      
      if (!ideogramResponse.ok) {
        const errorText = await ideogramResponse.text();
        logger.error(`Ideogram API error: ${errorText}`);
        return res.status(ideogramResponse.status).json({ 
          error: 'Image generation failed',
          details: errorText
        });
      }
      
      const ideogramData = await ideogramResponse.json();
      
      if (!ideogramData.data || !ideogramData.data[0] || !ideogramData.data[0].url) {
        logger.error('Invalid response from Ideogram API: No image URL found');
        return res.status(500).json({ error: 'Invalid response from image generation API' });
      }
      
      // Download the image to save locally
      const imageUrl = ideogramData.data[0].url;
      const filename = `tribe_image_${Date.now()}.png`;
      const filePath = path.join(__dirname, '../assets/images', filename);
      
      // Ensure directory exists
      await fs.mkdir(path.join(__dirname, '../assets/images'), { recursive: true });
      
      // Download and save the image
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.buffer();
      await fs.writeFile(filePath, imageBuffer);
      
      logger.info(`Successfully generated image for kin: ${kinName} via Ideogram directly`);
      return res.json({
        success: true,
        data: {
          url: imageUrl
        },
        local_path: `/assets/images/${filename}`
      });
    }
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
    
    // First try the KinOS endpoint
    try {
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
        throw new Error(`KinOS TTS API error: ${JSON.stringify(data)}`);
      }
      
      logger.info(`Successfully generated TTS via KinOS`);
      return res.json(data);
    } catch (kinosError) {
      // If KinOS endpoint fails, try the ElevenLabs API directly
      logger.warn(`KinOS TTS failed, trying ElevenLabs directly: ${kinosError.message}`);
      
      const elevenLabsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY || config.ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: model || "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });
      
      if (!elevenLabsResponse.ok) {
        const errorData = await elevenLabsResponse.text();
        logger.error(`ElevenLabs API error: ${errorData}`);
        return res.status(elevenLabsResponse.status).json({ 
          error: 'TTS generation failed',
          details: errorData
        });
      }
      
      // Get audio data
      const audioBuffer = await elevenLabsResponse.arrayBuffer();
      
      // Save to a file
      const filename = `tts_${Date.now()}.mp3`;
      const filePath = path.join(__dirname, '../assets/audio/narration', filename);
      
      // Ensure directory exists
      await fs.mkdir(path.join(__dirname, '../assets/audio/narration'), { recursive: true });
      
      // Write the file
      await fs.writeFile(filePath, Buffer.from(audioBuffer));
      
      logger.info(`Successfully generated TTS via ElevenLabs directly`);
      return res.json({
        success: true,
        audio_url: `/assets/audio/narration/${filename}`
      });
    }
  } catch (error) {
    logger.error(`Error generating TTS: ${error.message}`);
    res.status(500).json({ error: 'Failed to generate TTS' });
  }
});

module.exports = router;
