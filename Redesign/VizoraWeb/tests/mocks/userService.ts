import { vi } from 'vitest';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user' | 'manager' | 'viewer';
  organization: {
    id: string;
    name: string;
  };
  createdAt: string;
  lastLogin?: string;
  status: 'active' | 'inactive' | 'pending';
  permissions?: string[];
  profileImageUrl?: string;
  settings?: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    language: string;
  };
}

// Mock data
export const mockUsers: User[] = [
  {
    id: 'u1',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    organization: {
      id: 'org1',
      name: 'Example Organization'
    },
    createdAt: '2022-01-01T00:00:00Z',
    lastLogin: '2023-01-01T12:00:00Z',
    status: 'active',
    permissions: ['read:all', 'write:all', 'delete:all', 'manage:users'],
    profileImageUrl: 'https://example.com/profiles/admin.jpg',
    settings: {
      theme: 'system',
      notifications: true,
      language: 'en'
    }
  },
  {
    id: 'u2',
    email: 'user@example.com',
    firstName: 'Regular',
    lastName: 'User',
    role: 'user',
    organization: {
      id: 'org1',
      name: 'Example Organization'
    },
    createdAt: '2022-02-01T00:00:00Z',
    lastLogin: '2023-01-02T10:00:00Z',
    status: 'active',
    permissions: ['read:displays', 'write:content'],
    settings: {
      theme: 'light',
      notifications: true,
      language: 'en'
    }
  },
  {
    id: 'u3',
    email: 'pending@example.com',
    firstName: 'Pending',
    lastName: 'User',
    role: 'viewer',
    organization: {
      id: 'org1',
      name: 'Example Organization'
    },
    createdAt: '2022-12-01T00:00:00Z',
    status: 'pending',
    permissions: ['read:displays']
  }
];

// Mock functions
export const userService = {
  getUsers: vi.fn().mockResolvedValue({ users: mockUsers, total: mockUsers.length }),
  getUserById: vi.fn().mockImplementation((id: string) => {
    const user = mockUsers.find(u => u.id === id);
    if (user) {
      return Promise.resolve(user);
    }
    return Promise.reject(new Error('User not found'));
  }),
  createUser: vi.fn().mockImplementation((userData: Partial<User>) => {
    const newUser = {
      id: `u${mockUsers.length + 1}`,
      email: userData.email || 'new@example.com',
      firstName: userData.firstName || 'New',
      lastName: userData.lastName || 'User',
      role: userData.role || 'user',
      organization: userData.organization || { id: 'org1', name: 'Example Organization' },
      createdAt: new Date().toISOString(),
      status: 'pending',
      permissions: []
    };
    return Promise.resolve(newUser);
  }),
  updateUser: vi.fn().mockImplementation((id: string, userData: Partial<User>) => {
    const user = mockUsers.find(u => u.id === id);
    if (!user) {
      return Promise.reject(new Error('User not found'));
    }
    return Promise.resolve({
      ...user,
      ...userData
    });
  }),
  deleteUser: vi.fn().mockResolvedValue(true),
  activateUser: vi.fn().mockImplementation((id: string) => {
    const user = mockUsers.find(u => u.id === id);
    if (!user) {
      return Promise.reject(new Error('User not found'));
    }
    return Promise.resolve({
      ...user,
      status: 'active'
    });
  }),
  deactivateUser: vi.fn().mockImplementation((id: string) => {
    const user = mockUsers.find(u => u.id === id);
    if (!user) {
      return Promise.reject(new Error('User not found'));
    }
    return Promise.resolve({
      ...user,
      status: 'inactive'
    });
  }),
  resetUserPassword: vi.fn().mockResolvedValue(true),
  updateUserPermissions: vi.fn().mockImplementation((id: string, permissions: string[]) => {
    const user = mockUsers.find(u => u.id === id);
    if (!user) {
      return Promise.reject(new Error('User not found'));
    }
    return Promise.resolve({
      ...user,
      permissions
    });
  }),
  getUserActivity: vi.fn().mockResolvedValue([
    { action: 'login', timestamp: '2023-01-01T10:00:00Z' },
    { action: 'content.create', resource: 'content-123', timestamp: '2023-01-01T11:00:00Z' },
    { action: 'display.update', resource: 'display-456', timestamp: '2023-01-01T12:00:00Z' }
  ]),
  inviteUser: vi.fn().mockResolvedValue(true)
}; 