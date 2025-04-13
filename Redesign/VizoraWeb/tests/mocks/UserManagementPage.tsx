import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

// Mock users
const mockUsers = [
  {
    _id: 'user-001',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    organization: 'Example Corp',
    permissions: ['manage_users', 'manage_content', 'manage_displays'],
  },
  {
    _id: 'user-002',
    email: 'editor@example.com',
    name: 'Editor User',
    role: 'editor',
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    organization: 'Example Corp',
    permissions: ['manage_content', 'manage_displays'],
  },
  {
    _id: 'user-003',
    email: 'viewer@example.com',
    name: 'Viewer User',
    role: 'viewer',
    status: 'inactive',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    organization: 'Example Corp',
    permissions: ['view_content', 'view_displays'],
  },
];

// Available roles
const availableRoles = ['admin', 'editor', 'viewer'];

// Available permissions
const availablePermissions = [
  { id: 'manage_users', name: 'Manage Users' },
  { id: 'manage_content', name: 'Manage Content' },
  { id: 'manage_displays', name: 'Manage Displays' },
  { id: 'view_content', name: 'View Content' },
  { id: 'view_displays', name: 'View Displays' },
];

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'viewer',
    organization: 'Example Corp',
    permissions: [] as string[],
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, roleFilter, searchQuery]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        setUsers(mockUsers);
        setLoading(false);
      }, 300);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];
    
    // Apply role filter
    if (roleFilter) {
      filtered = filtered.filter(item => item.role === roleFilter);
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) || 
        item.email.toLowerCase().includes(query) ||
        item.role.toLowerCase().includes(query)
      );
    }
    
    setFilteredUsers(filtered);
  };

  const handleRoleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRoleFilter(e.target.value);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleAddUserClick = () => {
    setFormData({
      email: '',
      name: '',
      role: 'viewer',
      organization: 'Example Corp',
      permissions: [],
    });
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Simulate API call
      const newUser = {
        _id: `user-${Date.now()}`,
        ...formData,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastLogin: '',
      };
      
      setUsers([...users, newUser]);
      toast.success('User created successfully');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
    }
  };

  const handlePermissionChange = (permissionId: string) => {
    const updatedPermissions = [...formData.permissions];
    if (updatedPermissions.includes(permissionId)) {
      setFormData({
        ...formData,
        permissions: updatedPermissions.filter(p => p !== permissionId),
      });
    } else {
      setFormData({
        ...formData,
        permissions: [...updatedPermissions, permissionId],
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleEditClick = (user: any) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      role: user.role,
      organization: user.organization,
      permissions: [...user.permissions],
    });
    setShowEditModal(true);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) return;
    
    try {
      // Update the user
      const updatedUser = {
        ...selectedUser,
        name: formData.name,
        role: formData.role,
        organization: formData.organization,
        permissions: [...formData.permissions],
      };
      
      setUsers(users.map(item => 
        item._id === selectedUser._id ? updatedUser : item
      ));
      
      toast.success('User updated successfully');
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const handleDeleteClick = (user: any) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    
    try {
      setUsers(users.filter(item => item._id !== selectedUser._id));
      toast.success('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    } finally {
      setShowDeleteModal(false);
      setSelectedUser(null);
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      
      setUsers(users.map(user => 
        user._id === userId ? { ...user, status: newStatus } : user
      ));
      
      toast.success('User status updated successfully');
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Failed to update user status');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="user-management-page">
      <h1>User Management</h1>
      
      <div className="user-filters">
        <div className="filter-group">
          <label htmlFor="roleFilter">Role:</label>
          <select 
            id="roleFilter" 
            value={roleFilter} 
            onChange={handleRoleFilterChange}
          >
            <option value="">All Roles</option>
            {availableRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
        
        <input 
          type="text" 
          placeholder="Search users..." 
          value={searchQuery}
          onChange={handleSearchChange}
        />
        
        <button onClick={handleAddUserClick}>Add User</button>
      </div>
      
      <div className="user-list">
        {filteredUsers.map(user => (
          <div key={user._id} className="user-card">
            <h3>{user.name}</h3>
            <p>{user.email}</p>
            <p>{user.role}</p>
            <p>Status: 
              <span className={`status-${user.status}`}>
                {user.status}
              </span>
              <button 
                role="switch"
                aria-checked={user.status === 'active'}
                onClick={() => handleStatusToggle(user._id, user.status)}
                className="status-toggle"
              >
                Toggle
              </button>
            </p>
            <div className="user-actions">
              <button onClick={() => handleEditClick(user)}>Edit</button>
              <button onClick={() => handleDeleteClick(user)}>Delete</button>
            </div>
          </div>
        ))}
        
        {filteredUsers.length === 0 && (
          <div className="no-users">
            <p>No users found.</p>
          </div>
        )}
      </div>
      
      {/* Create User Modal */}
      {showCreateModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Create New User</h2>
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email:</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="name">Name:</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="role">Role:</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                >
                  {availableRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="organization">Organization:</label>
                <input
                  id="organization"
                  name="organization"
                  type="text"
                  value={formData.organization}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Permissions:</label>
                <div className="checkbox-group">
                  {availablePermissions.map(permission => (
                    <div key={permission.id} className="checkbox-item">
                      <input
                        id={`permission-${permission.id}`}
                        type="checkbox"
                        checked={formData.permissions.includes(permission.id)}
                        onChange={() => handlePermissionChange(permission.id)}
                      />
                      <label htmlFor={`permission-${permission.id}`}>{permission.name}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit">Create</button>
                <button type="button" onClick={() => setShowCreateModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="modal">
          <div className="modal-content">
            <h2>Edit User</h2>
            <form onSubmit={handleUpdateSubmit}>
              <div className="form-group">
                <label htmlFor="edit-email">Email:</label>
                <input
                  id="edit-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  readOnly
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-name">Name:</label>
                <input
                  id="edit-name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-role">Role:</label>
                <select
                  id="edit-role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                >
                  {availableRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Permissions:</label>
                <div className="checkbox-group">
                  {availablePermissions.map(permission => (
                    <div key={permission.id} className="checkbox-item">
                      <input
                        id={`edit-permission-${permission.id}`}
                        type="checkbox"
                        checked={formData.permissions.includes(permission.id)}
                        onChange={() => handlePermissionChange(permission.id)}
                      />
                      <label htmlFor={`edit-permission-${permission.id}`}>{permission.name}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit">Update</button>
                <button type="button" onClick={() => setShowEditModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="modal">
          <div className="modal-content">
            <h2>Confirm Deletion</h2>
            <p>Are you sure you want to delete the user "{selectedUser.name}"?</p>
            <div className="modal-actions">
              <button onClick={handleConfirmDelete}>Confirm</button>
              <button onClick={() => setShowDeleteModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage; 