const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const logger = require('../utils/logger');
const config = require('../config');
const path = require('path');
const fs = require('fs').promises;
const computeManager = require('../utils/computeManager');

// Create a new kin
router.post('/kins', async (req, res) => {
  try {
    const { name } = req.body;
    
    logger.info(`Creating new kin with name: ${name}`);
    
    // Ensure we're using the correct API base URL
    const apiBaseUrl = process.env.KINOS_API_BASE_URL || config.KINOS_API_BASE_URL;
    const response = await fetch(`${apiBaseUrl}/blueprints/autonomousrealms/kins`, {
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
    
    // Get user ID from request headers or query params
    const userId = req.headers['user-id'] || req.query.userId || req.body.userId;
    
    // Check if user has enough COMPUTE
    if (userId) {
      const hasEnough = await computeManager.hasEnoughCompute(userId, 'KINOS');
      if (!hasEnough) {
        return res.status(402).json({ 
          error: 'Insufficient COMPUTE balance',
          message: 'You need at least 1000 COMPUTE to use this service'
        });
      }
    }
    
    logger.info(`Sending message to kin: ${kinName}`);
    
    // Ensure we're using the correct API base URL
    const apiBaseUrl = process.env.KINOS_API_BASE_URL || config.KINOS_API_BASE_URL;
    const response = await fetch(`${apiBaseUrl}/blueprints/autonomousrealms/kins/${kinName}/messages`, {
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
    
    // Deduct COMPUTE if successful and userId is provided
    if (userId) {
      await computeManager.deductCompute(userId, 'KINOS');
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
    
    // Get user ID from request headers or query params
    const userId = req.headers['user-id'] || req.query.userId || req.body.userId;
    
    // Check if user has enough COMPUTE
    if (userId) {
      const hasEnough = await computeManager.hasEnoughCompute(userId, 'IDEOGRAM');
      if (!hasEnough) {
        return res.status(402).json({ 
          error: 'Insufficient COMPUTE balance',
          message: 'You need at least 1000 COMPUTE to use this service'
        });
      }
    }
    
    logger.info(`Generating image for kin: ${kinName}`);
    
    // Try KinOS endpoint first
    try {
      // Ensure we're using the correct API base URL
      const apiBaseUrl = process.env.KINOS_API_BASE_URL || config.KINOS_API_BASE_URL;
      const response = await fetch(`${apiBaseUrl}/blueprints/autonomousrealms/kins/${kinName}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.KINOS_API_KEY || config.KINOS_API_KEY}`
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio,
          model,
          magic_prompt_option: magic_prompt_option || (magic_prompt ? "AUTO" : undefined),
          message: "Generate an image based on the provided prompt" // Add required message parameter
        })
      });
    
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`KinOS image API error: ${JSON.stringify(data)}`);
      }
      
      // Deduct COMPUTE if successful and userId is provided
      if (userId) {
        await computeManager.deductCompute(userId, 'IDEOGRAM');
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
      
      try {
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
        
        // Ensure directory exists
        const imagesDir = path.join(__dirname, '../assets/images');
        await fs.mkdir(imagesDir, { recursive: true });
        const filePath = path.join(imagesDir, filename);
        
        // Download and save the image
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.buffer();
        await fs.writeFile(filePath, imageBuffer);
        
        // Deduct COMPUTE if successful and userId is provided
        if (userId) {
          await computeManager.deductCompute(userId, 'IDEOGRAM');
        }
        
        logger.info(`Successfully generated image for kin: ${kinName} via Ideogram directly`);
        return res.json({
          success: true,
          data: {
            url: imageUrl
          },
          local_path: `/assets/images/${filename}`
        });
      } catch (ideogramError) {
        logger.error(`Ideogram API error: ${ideogramError.message}`);
        
        // Return a fallback response with a placeholder image URL
        return res.json({
          success: false,
          error: 'Image generation failed',
          message: ideogramError.message,
          data: {
            url: 'https://via.placeholder.com/512x512?text=Image+Generation+Failed'
          }
        });
      }
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
    
    // Get user ID from request headers or query params
    const userId = req.headers['user-id'] || req.query.userId || req.body.userId;
    
    // Check if user has enough COMPUTE
    if (userId) {
      const hasEnough = await computeManager.hasEnoughCompute(userId, 'KINOS');
      if (!hasEnough) {
        return res.status(402).json({ 
          error: 'Insufficient COMPUTE balance',
          message: 'You need at least 1000 COMPUTE to use this service',
          audio_url: '/assets/audio/narration/dummy.mp3'
        });
      }
    }
    
    logger.info(`Generating TTS for text: "${text.substring(0, 50)}..."`);
    
    // First try the KinOS endpoint
    try {
      // Ensure we're using the correct API base URL
      const apiBaseUrl = process.env.KINOS_API_BASE_URL || config.KINOS_API_BASE_URL;
      const response = await fetch(`${apiBaseUrl}/tts?format=${format}`, {
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
      
      // Check if the response is binary audio data or JSON
      const contentType = response.headers.get('content-type');
      logger.debug(`KinOS TTS response content-type: ${contentType}`);
      
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
          const filename = `tts_${Date.now()}.mp3`;
          const filePath = path.join(__dirname, '../assets/audio/narration', filename);
          
          // Ensure directory exists
          await fs.mkdir(path.join(__dirname, '../assets/audio/narration'), { recursive: true });
          
          // Write the file
          await fs.writeFile(filePath, buffer);
          
          // Deduct COMPUTE if successful and userId is provided
          if (userId) {
            await computeManager.deductCompute(userId, 'KINOS');
          }
          
          logger.info(`Successfully generated TTS via KinOS (binary response)`);
          return res.json({
            success: true,
            audio_url: `/assets/audio/narration/${filename}`
          });
        } catch (bufferError) {
          logger.error(`Error processing audio buffer: ${bufferError.message}`);
          throw new Error(`Failed to process audio data: ${bufferError.message}`);
        }
      } 
      // Handle JSON response
      else if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(`KinOS TTS API error: ${JSON.stringify(data)}`);
        }
        
        // Deduct COMPUTE if successful and userId is provided
        if (userId) {
          await computeManager.deductCompute(userId, 'KINOS');
        }
        
        logger.info(`Successfully generated TTS via KinOS (JSON response)`);
        return res.json(data);
      }
      // Unknown content type - try to save as binary anyway
      else {
        logger.warn(`Unknown content type from KinOS TTS API: ${contentType}, attempting to save as binary`);
        const buffer = await response.buffer();
        
        // Save the audio file
        const filename = `tts_${Date.now()}.mp3`;
        const filePath = path.join(__dirname, '../assets/audio/narration', filename);
        
        // Ensure directory exists
        await fs.mkdir(path.join(__dirname, '../assets/audio/narration'), { recursive: true });
        
        // Write the file
        await fs.writeFile(filePath, buffer);
        
        logger.info(`Saved unknown content to file`);
        
        // Return the URL to the saved file
        return res.json({
          success: true,
          audio_url: `/assets/audio/narration/${filename}`,
          warning: `Unknown content type: ${contentType}`
        });
      }
    } catch (kinosError) {
      // If KinOS endpoint fails, try the ElevenLabs API directly
      logger.warn(`KinOS TTS failed, trying ElevenLabs directly: ${kinosError.message}`);
      
      // Check if we have a valid API key before making the request
      const apiKey = process.env.ELEVENLABS_API_KEY || config.ELEVENLABS_API_KEY;
      if (!apiKey) {
        // If no ElevenLabs API key, return a dummy audio URL
        logger.warn('No ElevenLabs API key available, returning dummy audio');
        return res.json({
          success: false,
          error: 'TTS generation failed: No valid API key',
          // Return a dummy audio URL that will show the UI but not actually play
          audio_url: '/assets/audio/narration/dummy.mp3'
        });
      }
      
      const elevenLabsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
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
        
        // Return a dummy audio URL if ElevenLabs fails
        return res.json({
          success: false,
          error: 'TTS generation failed: ElevenLabs API error',
          details: errorData,
          // Return a dummy audio URL that will show the UI but not actually play
          audio_url: '/assets/audio/narration/dummy.mp3'
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
      
      // Deduct COMPUTE if successful and userId is provided
      if (userId) {
        await computeManager.deductCompute(userId, 'KINOS');
      }
      
      logger.info(`Successfully generated TTS via ElevenLabs directly`);
      return res.json({
        success: true,
        audio_url: `/assets/audio/narration/${filename}`
      });
    }
  } catch (error) {
    logger.error(`Error generating TTS: ${error.message}`);
    
    // Return a dummy audio URL on error
    return res.json({
      success: false,
      error: 'Failed to generate TTS',
      message: error.message,
      // Return a dummy audio URL that will show the UI but not actually play
      audio_url: '/assets/audio/narration/dummy.mp3'
    });
  }
});

module.exports = router;
