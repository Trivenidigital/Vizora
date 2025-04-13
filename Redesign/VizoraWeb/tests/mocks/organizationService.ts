import { vi } from 'vitest';

export interface Organization {
  id: string;
  name: string;
  logoUrl?: string;
  description?: string;
  industry?: string;
  size?: 'small' | 'medium' | 'large' | 'enterprise';
  primaryColor?: string;
  secondaryColor?: string;
  createdAt: string;
  updatedAt: string;
  settings: {
    defaultTimezone: string;
    allowContentSharing: boolean;
    requireContentApproval: boolean;
    maxFileSize: number; // in MB
    allowedFileTypes: string[];
    storageLimit: number; // in GB
    userRoles: {
      name: string;
      permissions: string[];
    }[];
  };
  billingInfo?: {
    plan: 'free' | 'basic' | 'pro' | 'enterprise';
    billingCycle: 'monthly' | 'annual';
    nextBillingDate: string;
    paymentMethod: {
      type: 'credit_card' | 'bank_transfer' | 'paypal';
      lastFour?: string;
      expiryDate?: string;
    };
  };
  locations?: {
    id: string;
    name: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  }[];
}

export const mockOrganization: Organization = {
  id: 'org-1',
  name: 'Acme Corporation',
  logoUrl: 'https://example.com/logos/acme.png',
  description: 'Leading provider of digital signage solutions',
  industry: 'Technology',
  size: 'medium',
  primaryColor: '#3366CC',
  secondaryColor: '#FF9900',
  createdAt: '2022-05-10T00:00:00Z',
  updatedAt: '2023-06-15T14:30:00Z',
  settings: {
    defaultTimezone: 'America/New_York',
    allowContentSharing: true,
    requireContentApproval: true,
    maxFileSize: 500,
    allowedFileTypes: ['.jpg', '.png', '.mp4', '.pdf', '.pptx'],
    storageLimit: 1000,
    userRoles: [
      {
        name: 'Admin',
        permissions: ['manage_users', 'manage_content', 'manage_displays', 'manage_settings', 'view_analytics']
      },
      {
        name: 'Content Manager',
        permissions: ['manage_content', 'view_analytics']
      },
      {
        name: 'Viewer',
        permissions: ['view_content', 'view_displays']
      }
    ]
  },
  billingInfo: {
    plan: 'pro',
    billingCycle: 'annual',
    nextBillingDate: '2024-05-10T00:00:00Z',
    paymentMethod: {
      type: 'credit_card',
      lastFour: '4242',
      expiryDate: '05/25'
    }
  },
  locations: [
    {
      id: 'loc-1',
      name: 'Headquarters',
      address: '123 Main Street',
      city: 'New York',
      state: 'NY',
      country: 'USA',
      zipCode: '10001'
    },
    {
      id: 'loc-2',
      name: 'West Coast Office',
      address: '456 Tech Blvd',
      city: 'San Francisco',
      state: 'CA',
      country: 'USA',
      zipCode: '94105'
    },
    {
      id: 'loc-3',
      name: 'European Branch',
      address: '789 Innovation Street',
      city: 'London',
      country: 'UK',
      zipCode: 'EC1A 1BB'
    }
  ]
};

export const organizationService = {
  getOrganization: vi.fn().mockResolvedValue(mockOrganization),
  
  updateOrganization: vi.fn().mockImplementation((data: Partial<Organization>) => {
    const updatedOrg = { ...mockOrganization, ...data, updatedAt: new Date().toISOString() };
    return Promise.resolve(updatedOrg);
  }),
  
  updateOrganizationSettings: vi.fn().mockImplementation((settings: Partial<Organization['settings']>) => {
    const updatedSettings = { ...mockOrganization.settings, ...settings };
    mockOrganization.settings = updatedSettings;
    mockOrganization.updatedAt = new Date().toISOString();
    return Promise.resolve(mockOrganization);
  }),
  
  updateBillingInfo: vi.fn().mockImplementation((billingInfo: Partial<Organization['billingInfo']>) => {
    if (mockOrganization.billingInfo) {
      mockOrganization.billingInfo = { ...mockOrganization.billingInfo, ...billingInfo };
    } else {
      mockOrganization.billingInfo = billingInfo as Organization['billingInfo'];
    }
    mockOrganization.updatedAt = new Date().toISOString();
    return Promise.resolve(mockOrganization);
  }),
  
  addLocation: vi.fn().mockImplementation((location: Omit<Organization['locations'][0], 'id'>) => {
    const newLocation = {
      id: `loc-${mockOrganization.locations?.length ? mockOrganization.locations.length + 1 : 1}`,
      ...location
    };
    
    if (mockOrganization.locations) {
      mockOrganization.locations.push(newLocation);
    } else {
      mockOrganization.locations = [newLocation];
    }
    
    mockOrganization.updatedAt = new Date().toISOString();
    return Promise.resolve(newLocation);
  }),
  
  updateLocation: vi.fn().mockImplementation((locationId: string, data: Partial<Organization['locations'][0]>) => {
    if (mockOrganization.locations) {
      const locationIndex = mockOrganization.locations.findIndex(loc => loc.id === locationId);
      
      if (locationIndex !== -1) {
        mockOrganization.locations[locationIndex] = {
          ...mockOrganization.locations[locationIndex],
          ...data
        };
        
        mockOrganization.updatedAt = new Date().toISOString();
        return Promise.resolve(mockOrganization.locations[locationIndex]);
      }
    }
    
    return Promise.reject(new Error('Location not found'));
  }),
  
  deleteLocation: vi.fn().mockImplementation((locationId: string) => {
    if (mockOrganization.locations) {
      const locationIndex = mockOrganization.locations.findIndex(loc => loc.id === locationId);
      
      if (locationIndex !== -1) {
        mockOrganization.locations.splice(locationIndex, 1);
        mockOrganization.updatedAt = new Date().toISOString();
        return Promise.resolve(true);
      }
    }
    
    return Promise.reject(new Error('Location not found'));
  }),
  
  addUserRole: vi.fn().mockImplementation((role: { name: string, permissions: string[] }) => {
    mockOrganization.settings.userRoles.push(role);
    mockOrganization.updatedAt = new Date().toISOString();
    return Promise.resolve(mockOrganization);
  }),
  
  updateUserRole: vi.fn().mockImplementation((roleName: string, permissions: string[]) => {
    const roleIndex = mockOrganization.settings.userRoles.findIndex(role => role.name === roleName);
    
    if (roleIndex !== -1) {
      mockOrganization.settings.userRoles[roleIndex].permissions = permissions;
      mockOrganization.updatedAt = new Date().toISOString();
      return Promise.resolve(mockOrganization);
    }
    
    return Promise.reject(new Error('Role not found'));
  }),
  
  deleteUserRole: vi.fn().mockImplementation((roleName: string) => {
    const roleIndex = mockOrganization.settings.userRoles.findIndex(role => role.name === roleName);
    
    if (roleIndex !== -1) {
      mockOrganization.settings.userRoles.splice(roleIndex, 1);
      mockOrganization.updatedAt = new Date().toISOString();
      return Promise.resolve(true);
    }
    
    return Promise.reject(new Error('Role not found'));
  }),
  
  getStorageUsage: vi.fn().mockResolvedValue({
    used: 450, // GB
    total: mockOrganization.settings.storageLimit,
    percentUsed: 45
  }),
  
  getSubscriptionDetails: vi.fn().mockResolvedValue({
    plan: mockOrganization.billingInfo?.plan,
    billingCycle: mockOrganization.billingInfo?.billingCycle,
    startDate: '2023-05-10T00:00:00Z',
    nextBillingDate: mockOrganization.billingInfo?.nextBillingDate,
    amount: 2999, // in cents
    currency: 'USD',
    status: 'active',
    features: [
      'Unlimited displays',
      'Advanced analytics',
      'Priority support',
      '1TB storage',
      'Custom branding'
    ]
  })
}; 