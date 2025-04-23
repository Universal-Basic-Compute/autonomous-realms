const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Airtable = require('airtable');
const logger = require('../utils/logger');
const config = require('../config');

// Configure Airtable
const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY || config.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID || config.AIRTABLE_BASE_ID);
const usersTable = 'USERS';

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if username or email already exists
    const existingRecords = await base(usersTable).select({
      filterByFormula: `OR({Username} = '${username}', {Email} = '${email}')`
    }).firstPage();
    
    if (existingRecords.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    
    // Hash password
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Create user in Airtable
    const createdRecords = await base(usersTable).create([
      {
        fields: {
          Username: username,
          Email: email,
          PasswordHash: passwordHash,
          PasswordSalt: salt,
          CreatedAt: new Date().toISOString()
        }
      }
    ]);
    
    if (createdRecords.length === 0) {
      throw new Error('Failed to create user record');
    }
    
    res.status(201).json({ 
      success: true, 
      message: 'User registered successfully',
      userId: createdRecords[0].id
    });
    
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find user by username
    const records = await base(usersTable).select({
      filterByFormula: `{Username} = '${username}'`
    }).firstPage();
    
    if (records.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const user = records[0];
    const passwordHash = user.fields.PasswordHash;
    
    // Compare password
    const passwordMatch = await bcrypt.compare(password, passwordHash);
    
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Return success with user info
    res.json({
      success: true,
      message: 'Login successful',
      userId: user.id,
      username: user.fields.Username,
      email: user.fields.Email
    });
    
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

module.exports = router;
