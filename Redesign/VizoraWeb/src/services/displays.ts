import axios from 'axios';
import { USE_MOCK_DATA } from '../utils/env';

export interface DisplayData {
  name: string;
  location: string;
  qrCode: string;
}

export interface Display {
  _id: string;
  name: string;
  location: string;
  qrCode: string;
  user: string;
  status: 'active' | 'inactive' | 'maintenance';
  lastConnected: string;
  ipAddress?: string;
  currentContent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PushContentRequest {
  displayId: string;
  contentId: string;
  schedule?: {
    startTime?: string;
    endTime?: string;
    repeat?: 'daily' | 'weekly' | 'monthly' | 'none';
  };
}

// Mock data for displays to use during development
const MOCK_DISPLAYS: Display[] = [
  {
    _id: 'disp-001',
    name: 'Main Lobby Display',
    location: 'Main Lobby',
    qrCode: 'QLOB01',
    user: 'user-001',
    status: 'active',
    lastConnected: new Date().toISOString(),
    ipAddress: '192.168.1.101',
    currentContent: 'Welcome Screen',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: 'disp-002',
    name: 'Conference Room A',
    location: 'Conference Room A',
    qrCode: 'CONA01',
    user: 'user-001',
    status: 'inactive',
    lastConnected: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: 'disp-003',
    name: 'Cafeteria Display',
    location: 'Cafeteria',
    qrCode: 'CAFE01',
    user: 'user-001',
    status: 'active',
    lastConnected: new Date().toISOString(),
    ipAddress: '192.168.1.103',
    currentContent: 'Weekly Menu',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const API_URL = '/api';

const displayService = {
  /**
   * Get all displays for the current user
   */
  getDisplays: async (): Promise<Display[]> => {
    if (USE_MOCK_DATA) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      return [...MOCK_DISPLAYS];
    }
    
    const response = await axios.get(`${API_URL}/displays`);
    return response.data;
  },

  /**
   * Pair a display with the current user
   */
  pairDisplay: async (displayData: DisplayData): Promise<Display> => {
    if (USE_MOCK_DATA) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newDisplay: Display = {
        _id: `disp-${Math.floor(Math.random() * 1000)}`,
        name: displayData.name,
        location: displayData.location,
        qrCode: displayData.qrCode,
        user: 'user-001',
        status: 'active',
        lastConnected: new Date().toISOString(),
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Add to mock data
      MOCK_DISPLAYS.push(newDisplay);
      return newDisplay;
    }
    
    const response = await axios.post(`${API_URL}/displays/pair`, displayData);
    return response.data;
  },

  /**
   * Get display details by ID
   */
  getDisplay: async (id: string): Promise<Display> => {
    if (USE_MOCK_DATA) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const display = MOCK_DISPLAYS.find(d => d._id === id);
      if (!display) {
        throw new Error('Display not found');
      }
      
      return {...display};
    }
    
    const response = await axios.get(`${API_URL}/displays/${id}`);
    return response.data;
  },

  /**
   * Update display details
   */
  updateDisplay: async (id: string, displayData: Partial<Display>): Promise<Display> => {
    if (USE_MOCK_DATA) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const index = MOCK_DISPLAYS.findIndex(d => d._id === id);
      if (index === -1) {
        throw new Error('Display not found');
      }
      
      // Update the display
      MOCK_DISPLAYS[index] = {
        ...MOCK_DISPLAYS[index],
        ...displayData,
        updatedAt: new Date().toISOString()
      };
      
      return {...MOCK_DISPLAYS[index]};
    }
    
    const response = await axios.put(`${API_URL}/displays/${id}`, displayData);
    return response.data;
  },

  /**
   * Unpair a display
   */
  unpairDisplay: async (id: string): Promise<void> => {
    if (USE_MOCK_DATA) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 700));
      
      const index = MOCK_DISPLAYS.findIndex(d => d._id === id);
      if (index === -1) {
        throw new Error('Display not found');
      }
      
      // Remove the display
      MOCK_DISPLAYS.splice(index, 1);
      return;
    }
    
    await axios.delete(`${API_URL}/displays/${id}`);
  },

  /**
   * Push content to a display
   */
  pushContent: async (request: PushContentRequest): Promise<Display> => {
    if (USE_MOCK_DATA) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const index = MOCK_DISPLAYS.findIndex(d => d._id === request.displayId);
      if (index === -1) {
        throw new Error('Display not found');
      }
      
      // Make sure the display is active
      if (MOCK_DISPLAYS[index].status !== 'active') {
        throw new Error('Cannot push content to inactive display');
      }
      
      // Update the display with the new content
      MOCK_DISPLAYS[index] = {
        ...MOCK_DISPLAYS[index],
        currentContent: `Content ID: ${request.contentId}`,
        updatedAt: new Date().toISOString()
      };
      
      return {...MOCK_DISPLAYS[index]};
    }
    
    const response = await axios.post(`${API_URL}/displays/push-content`, request);
    return response.data;
  },

  /**
   * Get the status of all displays
   */
  getDisplaysStatus: async (): Promise<{ active: number, inactive: number, maintenance: number }> => {
    if (USE_MOCK_DATA) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const active = MOCK_DISPLAYS.filter(d => d.status === 'active').length;
      const inactive = MOCK_DISPLAYS.filter(d => d.status === 'inactive').length;
      const maintenance = MOCK_DISPLAYS.filter(d => d.status === 'maintenance').length;
      
      return { active, inactive, maintenance };
    }
    
    const response = await axios.get(`${API_URL}/displays/status`);
    return response.data;
  },

  addDisplay: async (displayData: Omit<Display, '_id' | 'createdAt'>): Promise<Display> => {
    const response = await axios.post(`${API_URL}/displays`, displayData);
    return response.data;
  }
};

export default displayService; 