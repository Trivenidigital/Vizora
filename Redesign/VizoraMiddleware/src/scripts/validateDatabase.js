/**
 * Database Validation Script
 * 
 * This script validates the existing MongoDB database against the new schema
 * and reports any issues or incompatibilities that need to be addressed.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connect, disconnect } = require('../db/connection');
const logger = require('../utils/logger');

// Import models
const Display = require('../models/Display');
const Controller = require('../models/Controller');
const User = require('../models/User');
const Content = require('../models/Content');

// Define validation rules for each model
const validationRules = {
  Display: {
    requiredFields: ['deviceId', 'name'],
    enumFields: {
      status: ['offline', 'online', 'maintenance']
    }
  },
  Controller: {
    requiredFields: ['deviceId', 'name'],
    enumFields: {
      status: ['offline', 'online', 'paired']
    }
  }
};

/**
 * Main validation function
 */
async function validateDatabase() {
  try {
    logger.info('Starting database validation...');
    
    // Connect to MongoDB
    await connect();
    logger.info('Connected to MongoDB');
    
    const results = {
      Display: await validateModel(Display, validationRules.Display),
      Controller: await validateModel(Controller, validationRules.Controller)
    };
    
    // Print summary
    logger.info('Validation complete');
    logger.info('------- SUMMARY -------');
    
    let totalIssues = 0;
    for (const model in results) {
      const modelResults = results[model];
      const modelIssues = modelResults.missing.length + modelResults.invalid.length;
      totalIssues += modelIssues;
      
      logger.info(`${model}: ${modelResults.total} documents, ${modelIssues} issues`);
      
      if (modelResults.missing.length > 0) {
        logger.warn(`  - ${modelResults.missing.length} documents missing required fields`);
      }
      
      if (modelResults.invalid.length > 0) {
        logger.warn(`  - ${modelResults.invalid.length} documents with invalid field values`);
      }
    }
    
    logger.info('------------------------');
    
    if (totalIssues > 0) {
      logger.warn(`Found ${totalIssues} issues that need to be fixed. Run the migration script to resolve these issues.`);
    } else {
      logger.info('No issues found. Database is compatible with the new schema.');
    }
    
    await disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Validation failed:', error);
    process.exit(1);
  }
}

/**
 * Validate documents of a specific model
 */
async function validateModel(Model, rules) {
  const modelName = Model.modelName;
  logger.info(`Validating ${modelName} documents...`);
  
  const documents = await Model.find({});
  
  const result = {
    total: documents.length,
    missing: [],
    invalid: []
  };
  
  for (const doc of documents) {
    // Check required fields
    const missingFields = rules.requiredFields.filter(field => {
      return doc[field] === undefined || doc[field] === null || doc[field] === '';
    });
    
    if (missingFields.length > 0) {
      result.missing.push({
        id: doc._id,
        deviceId: doc.deviceId || 'unknown',
        missingFields
      });
    }
    
    // Check enum fields
    for (const field in rules.enumFields) {
      if (doc[field] && !rules.enumFields[field].includes(doc[field])) {
        result.invalid.push({
          id: doc._id,
          deviceId: doc.deviceId || 'unknown',
          field,
          value: doc[field],
          validValues: rules.enumFields[field]
        });
      }
    }
  }
  
  // Log detailed issues
  if (result.missing.length > 0) {
    logger.info(`Found ${result.missing.length} ${modelName} documents with missing required fields:`);
    result.missing.forEach(issue => {
      logger.info(`  - ID: ${issue.id}, DeviceID: ${issue.deviceId}, Missing: ${issue.missingFields.join(', ')}`);
    });
  }
  
  if (result.invalid.length > 0) {
    logger.info(`Found ${result.invalid.length} ${modelName} documents with invalid field values:`);
    result.invalid.forEach(issue => {
      logger.info(`  - ID: ${issue.id}, DeviceID: ${issue.deviceId}, Field: ${issue.field}, Value: ${issue.value}, Valid values: ${issue.validValues.join(', ')}`);
    });
  }
  
  return result;
}

// Run the validation
validateDatabase(); 