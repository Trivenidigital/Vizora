import { vi } from 'vitest';

// Sample organizations
export const mockOrganizations = [
  {
    id: '1',
    name: 'Acme Corporation',
    timezone: 'America/New_York',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
    settings: {
      maxDisplays: 50,
      maxUsers: 25,
      maxStorage: 50, // GB
      features: {
        scheduleContent: true,
        analytics: true,
        multipleLocations: true,
        customBranding: true
      }
    },
    locations: [
      {
        id: '1',
        name: 'Headquarters',
        address: '123 Main St, New York, NY',
        timezone: 'America/New_York'
      },
      {
        id: '2',
        name: 'West Office',
        address: '456 Oak St, San Francisco, CA',
        timezone: 'America/Los_Angeles'
      }
    ],
    users: [
      {
        id: '1',
        email: 'admin@acme.com',
        role: 'admin',
        displayIds: ['1', '2']
      },
      {
        id: '2',
        email: 'user@acme.com',
        role: 'user',
        displayIds: ['1']
      }
    ]
  },
  {
    id: '2',
    name: 'XYZ Inc',
    timezone: 'Europe/London',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-15T00:00:00Z',
    settings: {
      maxDisplays: 25,
      maxUsers: 10,
      maxStorage: 20, // GB
      features: {
        scheduleContent: true,
        analytics: false,
        multipleLocations: false,
        customBranding: false
      }
    },
    locations: [
      {
        id: '3',
        name: 'Main Office',
        address: '1 London Bridge, London, UK',
        timezone: 'Europe/London'
      }
    ],
    users: [
      {
        id: '3',
        email: 'admin@xyz.com',
        role: 'admin',
        displayIds: []
      }
    ]
  }
];

// Create a mock organization service
export const organizationServiceMock = {
  getOrganizations: vi.fn().mockResolvedValue(mockOrganizations),
  getOrganizationById: vi.fn().mockImplementation((id: string) => {
    const org = mockOrganizations.find(item => item.id === id);
    if (org) {
      return Promise.resolve(org);
    }
    return Promise.reject(new Error('Organization not found'));
  }),
  createOrganization: vi.fn().mockImplementation((orgData: any) => {
    const newOrg = {
      ...orgData,
      id: String(mockOrganizations.length + 1),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      users: [],
      locations: []
    };
    return Promise.resolve(newOrg);
  }),
  updateOrganization: vi.fn().mockImplementation((id: string, data: any) => {
    const index = mockOrganizations.findIndex(item => item.id === id);
    if (index !== -1) {
      const updatedOrg = {
        ...mockOrganizations[index],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      return Promise.resolve(updatedOrg);
    }
    return Promise.reject(new Error('Organization not found'));
  }),
  deleteOrganization: vi.fn().mockImplementation((id: string) => {
    const index = mockOrganizations.findIndex(item => item.id === id);
    if (index !== -1) {
      return Promise.resolve(true);
    }
    return Promise.reject(new Error('Organization not found'));
  }),
  addUserToOrganization: vi.fn().mockResolvedValue({ success: true, message: 'User added to organization' }),
  removeUserFromOrganization: vi.fn().mockResolvedValue({ success: true, message: 'User removed from organization' }),
  addLocationToOrganization: vi.fn().mockImplementation((orgId: string, locationData: any) => {
    const org = mockOrganizations.find(item => item.id === orgId);
    if (!org) {
      return Promise.reject(new Error('Organization not found'));
    }
    
    const newLocation = {
      ...locationData,
      id: String(org.locations.length + 1)
    };
    
    return Promise.resolve(newLocation);
  }),
  removeLocationFromOrganization: vi.fn().mockResolvedValue({ success: true, message: 'Location removed from organization' }),
  getOrganizationUsage: vi.fn().mockImplementation((id: string) => {
    const org = mockOrganizations.find(item => item.id === id);
    if (!org) {
      return Promise.reject(new Error('Organization not found'));
    }
    
    return Promise.resolve({
      displayCount: org.users.reduce((acc, user) => acc + user.displayIds.length, 0),
      userCount: org.users.length,
      storageUsed: Math.floor(Math.random() * org.settings.maxStorage),
      storageLimit: org.settings.maxStorage
    });
  }),
  getCurrentUserOrganization: vi.fn().mockResolvedValue(mockOrganizations[0])
};

// Function to reset all mocks in the service
export function resetOrganizationServiceMocks() {
  Object.values(organizationServiceMock).forEach(mock => {
    if (typeof mock === 'function' && mock.mockReset) {
      mock.mockReset();
    }
  });
  
  // Reset default implementations
  organizationServiceMock.getOrganizations.mockResolvedValue(mockOrganizations);
  organizationServiceMock.getOrganizationById.mockImplementation((id: string) => {
    const org = mockOrganizations.find(item => item.id === id);
    if (org) {
      return Promise.resolve(org);
    }
    return Promise.reject(new Error('Organization not found'));
  });
  organizationServiceMock.getCurrentUserOrganization.mockResolvedValue(mockOrganizations[0]);
  // Reset other implementations as needed
} 