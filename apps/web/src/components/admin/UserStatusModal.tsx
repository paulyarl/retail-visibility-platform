'use client';

import { useState } from 'react';
import { X, Shield, Mail, Power, UserCheck, Loader2, AlertTriangle, CheckCircle, Clock, AlertCircle, Edit3, Save } from 'lucide-react';
import { Button } from '@/components/ui';

interface UserStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    email: string;
    name?: string;
    role: string;
    is_active: boolean;
    email_verified: boolean;
    created_at: string;
    last_login_at?: string;
  };
  onSuccess?: () => void;
}

interface StatusAction {
  type: 'activate' | 'deactivate' | 'send_verification' | 'resend_verification' | 'mark_verified' | 'mark_unverified';
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  requiresConfirmation: boolean;
  confirmationMessage?: string;
}

export default function UserStatusModal({ isOpen, onClose, user, onSuccess }: UserStatusModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [tempEmail, setTempEmail] = useState(user.email);
  const [editingName, setEditingName] = useState(false);
  const [tempFirstName, setTempFirstName] = useState(user.name?.split(' ')[0] || '');
  const [tempLastName, setTempLastName] = useState(user.name?.split(' ').slice(1).join(' ') || '');

  // Debug: Log what we receive
  console.log('DEBUG: UserStatusModal received user:', {
    id: user.id,
    email: user.email,
    is_active: user.is_active,
    email_verified: user.email_verified,
    status: (user as any).status,
    combined_status: user.is_active && user.email_verified ? 'active' : 
                   user.is_active && !user.email_verified ? 'active_unverified' :
                   !user.is_active && user.email_verified ? 'inactive' : 'pending'
  });

  const getCurrentStatus = () => {
    if (user.is_active && user.email_verified) return 'active';
    if (user.is_active && !user.email_verified) return 'active_unverified';
    if (!user.is_active && user.email_verified) return 'inactive';
    return 'pending';
  };

  const getTenantRoleOptions = () => [
    { value: 'OWNER', label: 'Owner', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400' },
    { value: 'ADMIN', label: 'Admin', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' },
    { value: 'SUPPORT', label: 'Support', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' },
    { value: 'MEMBER', label: 'Member', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' },
    { value: 'VIEWER', label: 'Viewer', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  ];

  const handleSaveEmail = async () => {
    if (tempEmail === user.email) {
      setEditingEmail(false);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`${apiUrl}/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: tempEmail,
          firstName: user.name?.split(' ')[0] || '',
          lastName: user.name?.split(' ').slice(1).join(' ') || '',
          role: user.role,
          isActive: user.is_active,
          emailVerified: user.email_verified,
        }),
      });

      if (response.ok) {
        setSuccess('✅ Email updated successfully!');
        setEditingEmail(false);
        setTimeout(() => {
          onClose();
          onSuccess?.();
        }, 1500);
      } else {
        const data = await response.json();
        setError(`Failed to update email: ${data.message || data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update email:', error);
      setError('Failed to update email');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setTempEmail(user.email);
    setEditingEmail(false);
  };

  const handleSaveName = async () => {
    const newFirstName = tempFirstName.trim();
    const newLastName = tempLastName.trim();
    const currentFirstName = user.name?.split(' ')[0] || '';
    const currentLastName = user.name?.split(' ').slice(1).join(' ') || '';

    if (newFirstName === currentFirstName && newLastName === currentLastName) {
      setEditingName(false);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`${apiUrl}/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: newFirstName,
          lastName: newLastName,
          email: user.email,
          role: user.role,
          isActive: user.is_active,
          emailVerified: user.email_verified,
        }),
      });

      if (response.ok) {
        setSuccess('✅ Name updated successfully!');
        setEditingName(false);
        setTimeout(() => {
          onClose();
          onSuccess?.();
        }, 1500);
      } else {
        const data = await response.json();
        setError(`Failed to update name: ${data.message || data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update name:', error);
      setError('Failed to update name');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEditName = () => {
    setTempFirstName(user.name?.split(' ')[0] || '');
    setTempLastName(user.name?.split(' ').slice(1).join(' ') || '');
    setEditingName(false);
  };

  const getStatusColor = () => {
    const status = getCurrentStatus();
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'active_unverified':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'inactive':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'pending':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = () => {
    const status = getCurrentStatus();
    switch (status) {
      case 'active':
        return 'Active';
      case 'active_unverified':
        return 'Active (Unverified)';
      case 'inactive':
        return 'Inactive';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  };

  const getStatusDescription = () => {
    const status = getCurrentStatus();
    switch (status) {
      case 'active':
        return 'User can log in and access all features';
      case 'active_unverified':
        return 'User can log in but email is not verified';
      case 'inactive':
        return 'User cannot log in but email is verified';
      case 'pending':
        return 'User cannot log in and email is not verified';
      default:
        return 'Unknown status';
    }
  };

  const getAvailableActions = (): StatusAction[] => {
    const actions: StatusAction[] = [];
    const status = getCurrentStatus();

    // Always available actions
    actions.push({
      type: 'send_verification',
      label: 'Send Verification Email',
      description: 'Send a new verification email to the user',
      icon: <Mail className="w-4 h-4" />,
      color: 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300',
      requiresConfirmation: false,
    });

    // Status-specific actions
    if (status === 'pending') {
      actions.push({
        type: 'activate',
        label: 'Activate User',
        description: 'Activate user account and mark email as verified',
        icon: <CheckCircle className="w-4 h-4" />,
        color: 'text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300',
        requiresConfirmation: true,
        confirmationMessage: `Activate user ${user.email}? This will allow them to log in and access the platform.`,
      });
    } else if (status === 'active_unverified') {
      actions.push({
        type: 'mark_verified',
        label: 'Mark Email as Verified',
        description: 'Mark the user\'s email as verified without requiring them to click the link',
        icon: <CheckCircle className="w-4 h-4" />,
        color: 'text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300',
        requiresConfirmation: true,
        confirmationMessage: `Mark ${user.email}'s email as verified? This will remove the unverified status.`,
      });
      actions.push({
        type: 'deactivate',
        label: 'Deactivate User',
        description: 'Deactivate user account (email remains verified)',
        icon: <Power className="w-4 h-4" />,
        color: 'text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300',
        requiresConfirmation: true,
        confirmationMessage: `Deactivate user ${user.email}? They will no longer be able to log in.`,
      });
    } else if (status === 'inactive') {
      actions.push({
        type: 'activate',
        label: 'Reactivate User',
        description: 'Reactivate user account (email already verified)',
        icon: <Power className="w-4 h-4" />,
        color: 'text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300',
        requiresConfirmation: true,
        confirmationMessage: `Reactivate user ${user.email}? They will be able to log in again.`,
      });
      actions.push({
        type: 'mark_unverified',
        label: 'Mark as Unverified',
        description: 'Mark email as unverified (user remains inactive)',
        icon: <AlertCircle className="w-4 h-4" />,
        color: 'text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300',
        requiresConfirmation: true,
        confirmationMessage: `Mark ${user.email}'s email as unverified? They will need to verify their email to reactivate.`,
      });
    } else if (status === 'active') {
      actions.push({
        type: 'deactivate',
        label: 'Deactivate User',
        description: 'Deactivate user account (email remains verified)',
        icon: <Power className="w-4 h-4" />,
        color: 'text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300',
        requiresConfirmation: true,
        confirmationMessage: `Deactivate user ${user.email}? They will no longer be able to log in.`,
      });
      actions.push({
        type: 'mark_unverified',
        label: 'Mark as Unverified',
        description: 'Mark email as unverified (user will be deactivated)',
        icon: <AlertCircle className="w-4 h-4" />,
        color: 'text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300',
        requiresConfirmation: true,
        confirmationMessage: `Mark ${user.email}'s email as unverified? This will deactivate their account.`,
      });
    }

    return actions;
  };

  const handleAction = async (action: StatusAction) => {
    if (action.requiresConfirmation) {
      const confirmed = window.confirm(action.confirmationMessage || `Are you sure you want to ${action.label.toLowerCase()} for ${user.email}?`);
      if (!confirmed) return;
    }

    setActionLoading(action.type);
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      
      let endpoint = '';
      let method = 'POST';
      let body: any = {};

      switch (action.type) {
        case 'send_verification':
        case 'resend_verification':
          endpoint = `/api/admin/users/${user.id}/send-verification-email`;
          body = { email: user.email };
          break;
        case 'activate':
          endpoint = `/api/admin/users/${user.id}`;
          method = 'PUT';
          body = { 
            firstName: user.name?.split(' ')[0] || '',
            lastName: user.name?.split(' ').slice(1).join(' ') || '',
            email: user.email,
            role: user.role,
            isActive: true, 
            emailVerified: true 
          };
          break;
        case 'deactivate':
          endpoint = `/api/admin/users/${user.id}`;
          method = 'PUT';
          body = { 
            firstName: user.name?.split(' ')[0] || '',
            lastName: user.name?.split(' ').slice(1).join(' ') || '',
            email: user.email,
            role: user.role,
            isActive: false, 
            emailVerified: user.email_verified 
          };
          break;
        case 'mark_verified':
          endpoint = `/api/admin/users/${user.id}`;
          method = 'PUT';
          body = { 
            firstName: user.name?.split(' ')[0] || '',
            lastName: user.name?.split(' ').slice(1).join(' ') || '',
            email: user.email,
            role: user.role,
            isActive: user.is_active, 
            emailVerified: true 
          };
          break;
        case 'mark_unverified':
          endpoint = `/api/admin/users/${user.id}`;
          method = 'PUT';
          body = { 
            firstName: user.name?.split(' ')[0] || '',
            lastName: user.name?.split(' ').slice(1).join(' ') || '',
            email: user.email,
            role: user.role,
            isActive: false, 
            emailVerified: false 
          };
          break;
      }

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Failed to update user status');
      }

      const result = await response.json();
      
      // Success message based on action
      let successMessage = '';
      switch (action.type) {
        case 'send_verification':
          successMessage = `✅ Verification email sent to ${user.email}`;
          break;
        case 'resend_verification':
          successMessage = `✅ Verification email resent to ${user.email}`;
          break;
        case 'activate':
          successMessage = `✅ User ${user.email} activated successfully`;
          break;
        case 'deactivate':
          successMessage = `✅ User ${user.email} deactivated successfully`;
          break;
        case 'mark_verified':
          successMessage = `✅ Email marked as verified for ${user.email}`;
          break;
        case 'mark_unverified':
          successMessage = `✅ Email marked as unverified for ${user.email}`;
          break;
      }

      setSuccess(successMessage);
      
      // Refresh user data and close modal after successful action
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action.label.toLowerCase()}`);
    } finally {
      setLoading(false);
      setActionLoading(null);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      setSuccess('');
      setActionLoading(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  const status = getCurrentStatus();
  const availableActions = getAvailableActions();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${getStatusColor()}`}>
              {status === 'active' && <CheckCircle className="w-5 h-5" />}
              {status === 'active_unverified' && <Mail className="w-5 h-5" />}
              {status === 'inactive' && <Power className="w-5 h-5" />}
              {status === 'pending' && <Clock className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Manage User Status
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Current Status Display */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-full ${getStatusColor()}`}>
                {status === 'active' && <CheckCircle className="w-5 h-5" />}
                {status === 'active_unverified' && <Mail className="w-5 h-5" />}
                {status === 'inactive' && <Power className="w-5 h-5" />}
                {status === 'pending' && <Clock className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {getStatusLabel()}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {getStatusDescription()}
                </p>
              </div>
            </div>
            
            {/* User Details */}
            <div className="grid grid-cols-1 gap-4 text-sm">
              {/* Name with Edit */}
              <div>
                <span className="text-gray-500 dark:text-gray-400">Name:</span>
                <div className="flex items-center gap-2 mt-1">
                  {editingName ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={tempFirstName}
                        onChange={(e) => setTempFirstName(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="First name"
                      />
                      <input
                        type="text"
                        value={tempLastName}
                        onChange={(e) => setTempLastName(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Last name"
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={loading}
                        className="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                        title="Save name"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancelEditName}
                        disabled={loading}
                        className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 dark:text-white">
                        {user.name || 'No name set'}
                      </span>
                      <button
                        onClick={() => {
                          setEditingName(true);
                        }}
                        disabled={loading}
                        className="inline-flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50"
                        title="Edit name"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Email with Edit */}
              <div>
                <span className="text-gray-500 dark:text-gray-400">Email:</span>
                <div className="flex items-center gap-2 mt-1">
                  {editingEmail ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="email"
                        value={tempEmail}
                        onChange={(e) => setTempEmail(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="user@example.com"
                      />
                      <button
                        onClick={handleSaveEmail}
                        disabled={loading}
                        className="p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                        title="Save email"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={loading}
                        className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 dark:text-white">
                        {user.email}
                      </span>
                      <button
                        onClick={() => {
                          setEditingEmail(true);
                        }}
                        disabled={loading}
                        className="inline-flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50"
                        title="Edit email"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Other Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Created:</span>
                  <span className="text-gray-900 dark:text-white ml-2">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Last Login:</span>
                  <span className="text-gray-900 dark:text-white ml-2">
                    {user.last_login_at 
                      ? new Date(user.last_login_at).toLocaleDateString()
                      : 'Never'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 dark:text-red-200">{error}</div>
            </div>
          )}

          {success ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-green-800 dark:text-green-200 font-medium">{success}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Available Actions
                </h3>
                <div className="space-y-2">
                  {availableActions.map((action) => (
                    <Button
                      key={action.type}
                      onClick={() => handleAction(action)}
                      disabled={loading || actionLoading === action.type}
                      className={`w-full flex items-center justify-start gap-3 px-4 py-3 text-left ${
                        action.color
                      }`}
                    >
                      <span className="flex-shrink-0">{action.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{action.label}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{action.description}</div>
                      </div>
                      {actionLoading === action.type && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Status Information */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Status Information
                </h4>
                <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  <p>• <strong>Active:</strong> User can log in and access all platform features</p>
                  <p>• <strong>Active (Unverified):</strong> User can log in but should verify email</p>
                  <p>• <strong>Inactive:</strong> User cannot log in but email is verified</p>
                  <p>• <strong>Pending:</strong> User cannot log in and email is not verified</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
