import { vi } from 'vitest';

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'content' | 'display' | 'schedule' | 'user' | 'analytics' | 'settings' | 'system';
}

export const mockPermissions: Permission[] = [
  // Content permissions
  {
    id: 'perm-1',
    name: 'content.view',
    description: 'View content items',
    category: 'content'
  },
  {
    id: 'perm-2',
    name: 'content.create',
    description: 'Create new content items',
    category: 'content'
  },
  {
    id: 'perm-3',
    name: 'content.edit',
    description: 'Edit existing content items',
    category: 'content'
  },
  {
    id: 'perm-4',
    name: 'content.delete',
    description: 'Delete content items',
    category: 'content'
  },
  {
    id: 'perm-5',
    name: 'content.approve',
    description: 'Approve content for publishing',
    category: 'content'
  },
  
  // Display permissions
  {
    id: 'perm-6',
    name: 'display.view',
    description: 'View displays',
    category: 'display'
  },
  {
    id: 'perm-7',
    name: 'display.create',
    description: 'Add new displays',
    category: 'display'
  },
  {
    id: 'perm-8',
    name: 'display.edit',
    description: 'Edit display settings',
    category: 'display'
  },
  {
    id: 'perm-9',
    name: 'display.delete',
    description: 'Remove displays',
    category: 'display'
  },
  {
    id: 'perm-10',
    name: 'display.remote_control',
    description: 'Remotely control displays',
    category: 'display'
  },
  
  // Schedule permissions
  {
    id: 'perm-11',
    name: 'schedule.view',
    description: 'View content schedules',
    category: 'schedule'
  },
  {
    id: 'perm-12',
    name: 'schedule.create',
    description: 'Create new schedules',
    category: 'schedule'
  },
  {
    id: 'perm-13',
    name: 'schedule.edit',
    description: 'Edit existing schedules',
    category: 'schedule'
  },
  {
    id: 'perm-14',
    name: 'schedule.delete',
    description: 'Delete schedules',
    category: 'schedule'
  },
  {
    id: 'perm-15',
    name: 'schedule.publish',
    description: 'Publish schedules to displays',
    category: 'schedule'
  },
  
  // User permissions
  {
    id: 'perm-16',
    name: 'user.view',
    description: 'View user accounts',
    category: 'user'
  },
  {
    id: 'perm-17',
    name: 'user.create',
    description: 'Create new user accounts',
    category: 'user'
  },
  {
    id: 'perm-18',
    name: 'user.edit',
    description: 'Edit user account details',
    category: 'user'
  },
  {
    id: 'perm-19',
    name: 'user.delete',
    description: 'Delete user accounts',
    category: 'user'
  },
  {
    id: 'perm-20',
    name: 'user.manage_roles',
    description: 'Assign and manage user roles',
    category: 'user'
  },
  
  // Analytics permissions
  {
    id: 'perm-21',
    name: 'analytics.view',
    description: 'View analytics data',
    category: 'analytics'
  },
  {
    id: 'perm-22',
    name: 'analytics.export',
    description: 'Export analytics data',
    category: 'analytics'
  },
  
  // Settings permissions
  {
    id: 'perm-23',
    name: 'settings.view',
    description: 'View organization settings',
    category: 'settings'
  },
  {
    id: 'perm-24',
    name: 'settings.edit',
    description: 'Edit organization settings',
    category: 'settings'
  },
  {
    id: 'perm-25',
    name: 'settings.billing',
    description: 'Manage billing and subscriptions',
    category: 'settings'
  },
  
  // System permissions
  {
    id: 'perm-26',
    name: 'system.admin',
    description: 'Full system administration access',
    category: 'system'
  },
  {
    id: 'perm-27',
    name: 'system.logs',
    description: 'View system logs',
    category: 'system'
  }
];

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[]; // Array of permission IDs
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const mockRoles: Role[] = [
  {
    id: 'role-1',
    name: 'Administrator',
    description: 'Full access to all system features',
    permissions: mockPermissions.map(p => p.id),
    isDefault: false,
    createdAt: '2022-05-10T00:00:00Z',
    updatedAt: '2023-06-15T14:30:00Z'
  },
  {
    id: 'role-2',
    name: 'Content Manager',
    description: 'Manages content and schedules',
    permissions: [
      'perm-1', 'perm-2', 'perm-3', 'perm-4', 'perm-5', // content permissions
      'perm-6', // display view
      'perm-11', 'perm-12', 'perm-13', 'perm-14', 'perm-15', // schedule permissions
      'perm-21' // analytics view
    ],
    isDefault: false,
    createdAt: '2022-05-10T00:00:00Z',
    updatedAt: '2023-01-20T10:15:00Z'
  },
  {
    id: 'role-3',
    name: 'Display Manager',
    description: 'Manages displays and their settings',
    permissions: [
      'perm-1', // content view
      'perm-6', 'perm-7', 'perm-8', 'perm-9', 'perm-10', // display permissions
      'perm-11' // schedule view
    ],
    isDefault: false,
    createdAt: '2022-05-10T00:00:00Z',
    updatedAt: '2022-11-05T09:45:30Z'
  },
  {
    id: 'role-4',
    name: 'Analyst',
    description: 'Views and exports analytics data',
    permissions: [
      'perm-1', // content view
      'perm-6', // display view
      'perm-11', // schedule view
      'perm-21', 'perm-22' // analytics permissions
    ],
    isDefault: false,
    createdAt: '2022-05-10T00:00:00Z',
    updatedAt: '2022-08-12T16:20:00Z'
  },
  {
    id: 'role-5',
    name: 'Viewer',
    description: 'View-only access to content and displays',
    permissions: [
      'perm-1', // content view
      'perm-6', // display view
      'perm-11' // schedule view
    ],
    isDefault: true,
    createdAt: '2022-05-10T00:00:00Z',
    updatedAt: '2022-05-10T00:00:00Z'
  }
];

export const permissionService = {
  getCurrentUserPermissions: vi.fn().mockResolvedValue(mockPermissions.map(p => p.name)), // Admin permissions by default
  
  hasPermission: vi.fn().mockImplementation((permissionName: string) => {
    // Default implementation assumes admin access
    return Promise.resolve(true);
  }),
  
  hasAnyPermission: vi.fn().mockImplementation((permissionNames: string[]) => {
    // Default implementation assumes admin access
    return Promise.resolve(true);
  }),
  
  hasAllPermissions: vi.fn().mockImplementation((permissionNames: string[]) => {
    // Default implementation assumes admin access
    return Promise.resolve(true);
  }),
  
  getAllPermissions: vi.fn().mockResolvedValue(mockPermissions),
  
  getPermissionsByCategory: vi.fn().mockImplementation((category: Permission['category']) => {
    return Promise.resolve(mockPermissions.filter(p => p.category === category));
  }),
  
  // Role management
  getAllRoles: vi.fn().mockResolvedValue(mockRoles),
  
  getRoleById: vi.fn().mockImplementation((roleId: string) => {
    const role = mockRoles.find(r => r.id === roleId);
    if (role) {
      return Promise.resolve(role);
    }
    return Promise.reject(new Error('Role not found'));
  }),
  
  createRole: vi.fn().mockImplementation((roleData: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newRole: Role = {
      id: `role-${mockRoles.length + 1}`,
      ...roleData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockRoles.push(newRole);
    return Promise.resolve(newRole);
  }),
  
  updateRole: vi.fn().mockImplementation((roleId: string, roleData: Partial<Omit<Role, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const roleIndex = mockRoles.findIndex(r => r.id === roleId);
    if (roleIndex !== -1) {
      mockRoles[roleIndex] = {
        ...mockRoles[roleIndex],
        ...roleData,
        updatedAt: new Date().toISOString()
      };
      return Promise.resolve(mockRoles[roleIndex]);
    }
    return Promise.reject(new Error('Role not found'));
  }),
  
  deleteRole: vi.fn().mockImplementation((roleId: string) => {
    const roleIndex = mockRoles.findIndex(r => r.id === roleId);
    if (roleIndex !== -1) {
      mockRoles.splice(roleIndex, 1);
      return Promise.resolve(true);
    }
    return Promise.reject(new Error('Role not found'));
  }),
  
  assignRoleToUser: vi.fn().mockResolvedValue(true),
  
  removeRoleFromUser: vi.fn().mockResolvedValue(true),
  
  getUsersWithRole: vi.fn().mockImplementation((roleId: string) => {
    // This would normally return users with this role
    // For mocking, we just return a count
    return Promise.resolve({
      users: [],
      count: Math.floor(Math.random() * 10)
    });
  }),
  
  // Permission checks for specific resources
  canViewContent: vi.fn().mockResolvedValue(true),
  
  canEditContent: vi.fn().mockResolvedValue(true),
  
  canViewDisplay: vi.fn().mockResolvedValue(true),
  
  canManageDisplay: vi.fn().mockResolvedValue(true),
  
  canViewSchedule: vi.fn().mockResolvedValue(true),
  
  canManageSchedule: vi.fn().mockResolvedValue(true),
  
  canManageUsers: vi.fn().mockResolvedValue(true),
  
  canViewAnalytics: vi.fn().mockResolvedValue(true)
}; 