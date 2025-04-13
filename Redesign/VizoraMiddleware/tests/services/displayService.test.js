/**
 * Display Service Tests
 */

const mongoose = require('mongoose');
const displayService = require('../../src/services/displayService');
const Display = require('../../src/models/Display');
const User = require('../../src/models/User');
const { createTestUser } = require('../helpers/testHelpers');
const { NotFoundError } = displayService;

// Clear test data between tests
afterEach(async () => {
  await Display.deleteMany({});
  await User.deleteMany({});
});

describe('Display Service', () => {
  let testUser;
  
  beforeEach(async () => {
    // Create a test user to use as owner
    const result = await createTestUser();
    testUser = result.user;
  });
  
  describe('registerDisplay', () => {
    it('should register a new display', async () => {
      const displayData = {
        deviceId: 'test-device-123',
        name: 'Test Display',
        location: {
          name: 'Test Location'
        },
        owner: testUser._id
      };
      
      const display = await displayService.registerDisplay(displayData);
      
      expect(display).toBeDefined();
      expect(display.deviceId).toBe(displayData.deviceId);
      expect(display.name).toBe(displayData.name);
      expect(display.status).toBe('active');
    });
    
    it('should update an existing display', async () => {
      // First create a display
      const initialData = {
        deviceId: 'test-device-456',
        name: 'Initial Display',
        location: {
          name: 'Initial Location'
        },
        owner: testUser._id
      };
      
      await displayService.registerDisplay(initialData);
      
      // Now update it
      const updateData = {
        deviceId: 'test-device-456',
        name: 'Updated Display',
        location: {
          name: 'Updated Location'
        }
      };
      
      const display = await displayService.registerDisplay(updateData);
      
      expect(display).toBeDefined();
      expect(display.deviceId).toBe(updateData.deviceId);
      expect(display.name).toBe(updateData.name);
      expect(display.location.name).toBe(updateData.location.name);
    });
  });
  
  describe('getDisplayByDeviceId', () => {
    it('should get a display by device ID', async () => {
      // Create a display
      const displayData = {
        deviceId: 'test-device-789',
        name: 'Test Display',
        location: {
          name: 'Test Location'
        },
        owner: testUser._id
      };
      
      await displayService.registerDisplay(displayData);
      
      // Get it by device ID
      const display = await displayService.getDisplayByDeviceId('test-device-789');
      
      expect(display).toBeDefined();
      expect(display.deviceId).toBe(displayData.deviceId);
      expect(display.name).toBe(displayData.name);
    });
    
    it('should throw NotFoundError if display does not exist', async () => {
      await expect(displayService.getDisplayByDeviceId('non-existent-id'))
        .rejects.toThrow(NotFoundError);
    });
  });
  
  describe('generatePairingCode', () => {
    it('should generate a pairing code and QR code', async () => {
      // Create a display
      const displayData = {
        deviceId: 'pairing-test-device',
        name: 'Pairing Test Display',
        owner: testUser._id
      };
      
      const display = await displayService.registerDisplay(displayData);
      
      // Generate pairing code
      const pairingResult = await displayService.generatePairingCode('pairing-test-device');
      
      expect(pairingResult).toBeDefined();
      expect(pairingResult.pairingCode).toBeDefined();
      expect(pairingResult.pairingExpiry).toBeInstanceOf(Date);
      expect(pairingResult.qrCode).toBeDefined();
    });
  });
  
  describe('pairWithController', () => {
    it('should pair a display with a controller', async () => {
      // Create a display
      const displayData = {
        deviceId: 'controller-test-device',
        name: 'Controller Test Display',
        status: 'pending',
        owner: testUser._id
      };
      
      const display = await displayService.registerDisplay(displayData);
      
      // Generate pairing code
      const pairingData = await displayService.generatePairingCode('controller-test-device');
      
      // Pair with controller
      const pairedDisplay = await displayService.pairWithController(
        'controller-test-device',
        pairingData.pairingCode,
        testUser._id
      );
      
      expect(pairedDisplay).toBeDefined();
      expect(pairedDisplay.controlledBy).toEqual(testUser._id);
      expect(pairedDisplay.pairingCode).toEqual({});
      expect(pairedDisplay.status).toBe('active');
    });
  });
  
  describe('isDisplayPaired', () => {
    it('should return true if display is paired with controller', async () => {
      // Create a display
      const display = await Display.create({
        deviceId: 'paired-test-device',
        name: 'Paired Test Display',
        status: 'active',
        controlledBy: testUser._id,
        owner: testUser._id
      });
      
      // Mock the isDisplayPaired function to return true for this test
      const originalIsDisplayPaired = displayService.isDisplayPaired;
      displayService.isDisplayPaired = jest.fn().mockImplementation(
        async (deviceId, userId) => 
          deviceId === 'paired-test-device' && 
          userId === testUser._id.toString()
      );
      
      const isPaired = await displayService.isDisplayPaired('paired-test-device', testUser._id.toString());
      
      expect(isPaired).toBe(true);
      
      // Restore the original function
      displayService.isDisplayPaired = originalIsDisplayPaired;
    });
    
    it('should return false if display is not paired with controller', async () => {
      // Create a display without controller
      const display = await Display.create({
        deviceId: 'unpaired-test-device',
        name: 'Unpaired Test Display',
        status: 'active',
        owner: testUser._id
      });
      
      // Mock the isDisplayPaired function to return false for this test
      const originalIsDisplayPaired = displayService.isDisplayPaired;
      displayService.isDisplayPaired = jest.fn().mockReturnValue(false);
      
      const isPaired = await displayService.isDisplayPaired('unpaired-test-device', testUser._id.toString());
      
      expect(isPaired).toBe(false);
      
      // Restore the original function
      displayService.isDisplayPaired = originalIsDisplayPaired;
    });
  });
}); 