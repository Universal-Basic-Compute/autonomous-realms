const Airtable = require('airtable');
const logger = require('./logger');
const config = require('../config');

// Configure Airtable
const base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY || config.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID || config.AIRTABLE_BASE_ID);
const usersTable = 'USERS';

// Cost constants
const COMPUTE_COSTS = {
  CLAUDE: 1000,
  IDEOGRAM: 1000,
  KINOS: 1000
};

/**
 * Deduct COMPUTE from a user's account
 * @param {string} userId - The user's ID in Airtable
 * @param {string} serviceType - The type of service (CLAUDE, IDEOGRAM, KINOS)
 * @returns {Promise<boolean>} - Whether the deduction was successful
 */
async function deductCompute(userId, serviceType) {
  if (!userId) {
    logger.warn('No user ID provided for COMPUTE deduction');
    return false;
  }

  try {
    // Get the cost for this service type
    const cost = COMPUTE_COSTS[serviceType] || 1000;
    
    // Find user by ID
    const record = await base(usersTable).find(userId);
    
    if (!record) {
      logger.warn(`User not found for COMPUTE deduction: ${userId}`);
      return false;
    }
    
    // Get current compute balance
    const currentCompute = record.fields.Compute || 0;
    
    // Check if user has enough COMPUTE
    if (currentCompute < cost) {
      logger.warn(`User ${userId} has insufficient COMPUTE: ${currentCompute} < ${cost}`);
      return false;
    }
    
    // Update user record with new compute amount
    await base(usersTable).update([
      {
        id: userId,
        fields: {
          Compute: currentCompute - cost
        }
      }
    ]);
    
    logger.info(`Deducted ${cost} COMPUTE from user ${userId} for ${serviceType}. New balance: ${currentCompute - cost}`);
    return true;
    
  } catch (error) {
    logger.error(`Error deducting COMPUTE: ${error.message}`);
    return false;
  }
}

/**
 * Check if a user has enough COMPUTE for a service
 * @param {string} userId - The user's ID in Airtable
 * @param {string} serviceType - The type of service (CLAUDE, IDEOGRAM, KINOS)
 * @returns {Promise<boolean>} - Whether the user has enough COMPUTE
 */
async function hasEnoughCompute(userId, serviceType) {
  if (!userId) {
    logger.warn('No user ID provided for COMPUTE check');
    return false;
  }

  try {
    // Get the cost for this service type
    const cost = COMPUTE_COSTS[serviceType] || 1000;
    
    // Find user by ID
    const record = await base(usersTable).find(userId);
    
    if (!record) {
      logger.warn(`User not found for COMPUTE check: ${userId}`);
      return false;
    }
    
    // Get current compute balance
    const currentCompute = record.fields.Compute || 0;
    
    // Check if user has enough COMPUTE
    return currentCompute >= cost;
    
  } catch (error) {
    logger.error(`Error checking COMPUTE: ${error.message}`);
    return false;
  }
}

module.exports = {
  deductCompute,
  hasEnoughCompute,
  COMPUTE_COSTS
};
