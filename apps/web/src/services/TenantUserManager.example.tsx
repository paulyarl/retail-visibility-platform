import React, { useState, useEffect } from 'react';
import { tenantUserService } from '../services';
import { clientLogger } from '@/lib/client-logger';

/**
 * Example component demonstrating the new service architecture
 * This shows how to replace PlatformHomeSingletonService calls with the new services
 */
export function TenantUserManager({ tenantId }: { tenantId: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load users when component mounts or tenantId changes
  useEffect(() => {
    const loadUsers = async () => {
      if (!tenantId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const userList = await tenantUserService.getTenantUsers(tenantId);
        setUsers(userList || []);
        console.log('Users loaded successfully:', userList?.length || 0);
      } catch (err) {
        clientLogger.error('Failed to load users:', { detail: err });
        setError('Failed to load users. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadUsers();
  }, [tenantId]);

  // Add new user
  const handleAddUser = async (userData: {
    email: string;
    role: string;
    name?: string;
  }) => {
    if (!tenantId) return;
    
    try {
      const newUser = await tenantUserService.addTenantUser(tenantId, userData);
      setUsers(prev => [...prev, newUser]);
      console.log('User added successfully:', newUser);
      return newUser;
    } catch (err) {
      clientLogger.error('Failed to add user:', { detail: err });
      setError('Failed to add user. Please check the details and try again.');
      throw err;
    }
  };

  // Update user role
  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    if (!tenantId) return;
    
    try {
      const updatedUser = await tenantUserService.updateTenantUserRole(tenantId, userId, newRole);
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, ...updatedUser } : user
      ));
      console.log('User role updated successfully:', updatedUser);
      return updatedUser;
    } catch (err) {
      clientLogger.error('Failed to update user role:', { detail: err });
      setError('Failed to update user role. Please try again.');
      throw err;
    }
  };

  // Remove user
  const handleRemoveUser = async (userId: string) => {
    if (!tenantId) return;
    
    try {
      await tenantUserService.removeTenantUser(tenantId, userId);
      setUsers(prev => prev.filter(user => user.id !== userId));
      console.log('User removed successfully:', userId);
    } catch (err) {
      clientLogger.error('Failed to remove user:', { detail: err });
      setError('Failed to remove user. Please try again.');
      throw err;
    }
  };

  return (
    <div className="tenant-user-manager">
      <h2>Tenant User Management</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {loading ? (
        <div>Loading users...</div>
      ) : (
        <div className="user-list">
          <h3>Users ({users.length})</h3>
          {users.map(user => (
            <div key={user.id} className="user-item">
              <div className="user-info">
                <h4>{user.name || user.email}</h4>
                <p>Email: {user.email}</p>
                <p>Role: {user.role}</p>
                <p>Status: {user.isActive ? 'Active' : 'Inactive'}</p>
              </div>
              <div className="user-actions">
                <button 
                  onClick={() => handleUpdateUserRole(user.id, 'admin')}
                  disabled={loading}
                >
                  Make Admin
                </button>
                <button 
                  onClick={() => handleRemoveUser(user.id)}
                  disabled={loading}
                  className="danger"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="add-user-form">
        <h3>Add New User</h3>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const userData = {
            email: formData.get('email') as string,
            role: formData.get('role') as string,
            name: formData.get('name') as string,
          };
          
          try {
            await handleAddUser(userData);
            e.currentTarget.reset();
          } catch (err) {
            // Error already handled in handleAddUser
          }
        }}>
          <div>
            <label htmlFor="email">Email:</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              required 
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="name">Name:</label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="role">Role:</label>
            <select id="role" name="role" required disabled={loading}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Adding...' : 'Add User'}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Usage example in a parent component:
 * 
 * function App() {
 *   return (
 *     <div>
 *       <h1>Tenant Management</h1>
 *       <TenantUserManager tenantId="tenant-123" />
 *     </div>
 *   );
 * }
 */
