/**
 * Display Model Tests
 */

const mongoose = require('mongoose');
const Display = require('../../src/models/Display');
const User = require('../../src/models/User');
const { createTestUser } = require('../helpers/testHelpers');

// Clear test data between tests
afterEach(async () => {
  await Display.deleteMany({});
  await User.deleteMany({});
});

describe('Display Model', () => {
  let testUser;
  
  beforeEach(async () => {
    // Create a test user to use as owner
    const result = await createTestUser();
    testUser = result.user;
  });
  
  it('should create a new display successfully', async () => {
    const displayData = {
      name: 'Test Display',
      deviceId: 'test-device-123',
      status: 'active',
      location: {
        name: 'Test Location'
      },
      owner: testUser._id
    };
    
    const display = await Display.create(displayData);
    
    expect(display).toBeDefined();
    expect(display.name).toBe(displayData.name);
    expect(display.deviceId).toBe(displayData.deviceId);
    expect(display.status).toBe(displayData.status);
    expect(display.apiKey).toBeDefined();
  });
  
  it('should generate a pairing code', async () => {
    const display = await Display.create({
      name: 'Pairing Test Display',
      deviceId: 'pairing-test-device',
      owner: testUser._id
    });
    
    const pairingCode = await display.generatePairingCode();
    
    expect(pairingCode).toBeDefined();
    expect(pairingCode.length).toBe(6);
    expect(display.pairingCode.code).toBe(pairingCode);
    expect(display.pairingCode.expiresAt).toBeInstanceOf(Date);
  });
  
  it('should mark a display as paired', async () => {
    const display = await Display.create({
      name: 'Pairing Clear Test',
      deviceId: 'pairing-clear-test',
      owner: testUser._id
    });
    
    await display.generatePairingCode();
    await display.markAsPaired();
    
    // After marking as paired, we need to reload the display from the database
    const updatedDisplay = await Display.findOne({ deviceId: 'pairing-clear-test' });
    
    // Verify the display is marked as active
    expect(updatedDisplay.status).toBe('active');
    expect(updatedDisplay.history.length).toBeGreaterThan(0);
  });
  
  it('should correctly identify if display is online', async () => {
    const display = await Display.create({
      name: 'Status Test Display',
      deviceId: 'status-test-device',
      owner: testUser._id
    });
    
    // Set last heartbeat to just now
    display.lastHeartbeat = new Date();
    await display.save();
    
    // Create a custom threshold that's definitely in the past
    const offlineThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    
    // Mock the environment variable
    process.env.DISPLAY_OFFLINE_THRESHOLD = 60 * 60 * 1000;
    
    // Should not find our display as offline
    const offlineDisplays = await Display.findOfflineDisplays();
    expect(offlineDisplays.length).toBe(0);
    
    // Set last heartbeat to yesterday
    display.lastHeartbeat = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await display.save();
    
    // Should now find our display as offline
    const newOfflineDisplays = await Display.findOfflineDisplays();
    expect(newOfflineDisplays.length).toBe(1);
    expect(newOfflineDisplays[0].deviceId).toBe(display.deviceId);
  });
}); 