'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Users, UserPlus, Trash2, Mail, Pencil, X, Crown,
  Check, Loader2, Building2,
} from 'lucide-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { organizationUsersService, type OrgUser, type OrgInvitation } from '@/services/OrganizationUsersService';
import { useOrgBehaviorAccess } from '@/hooks/tenant-access/useOrgBehaviorAccess';
import { useAuth } from '@/contexts/AuthContext';
import { getOrgRole } from '@/lib/auth/access-control';
import AccessDenied from '@/components/AccessDenied';
import { Spinner } from '@/components/ui';

const ORG_ROLE_LABELS: Record<string, string> = {
  ORG_OWNER: 'Organization Owner',
  ORG_ADMIN: 'Organization Admin',
  ORG_MEMBER: 'Organization Member',
  ORG_VIEWER: 'Organization Viewer',
};

const ORG_ROLE_COLORS: Record<string, string> = {
  ORG_OWNER: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
  ORG_ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  ORG_MEMBER: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
  ORG_VIEWER: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

const ALL_ORG_ROLES = ['ORG_OWNER', 'ORG_ADMIN', 'ORG_MEMBER', 'ORG_VIEWER'];
const NON_OWNER_ORG_ROLES = ['ORG_ADMIN', 'ORG_MEMBER', 'ORG_VIEWER'];

export default function OrgUsersPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const { isOrgAdmin, loading: accessLoading, organizationId, isPlatformAdmin } = useOrgBehaviorAccess(tenantId);
  const { user: authUser } = useAuth();

  const currentUserId = authUser?.id || (authUser as any)?.sub || '';
  const currentUserOrgRole = organizationId && authUser ? getOrgRole(authUser as any, organizationId) : null;
  const isCurrentUserOrgOwner = currentUserOrgRole === 'ORG_OWNER' || isPlatformAdmin;

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('ORG_MEMBER');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [savingRole, setSavingRole] = useState(false);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [usersData, invitesData] = await Promise.all([
        organizationUsersService.getUsers(organizationId),
        organizationUsersService.getPendingInvitations(organizationId),
      ]);
      setUsers(usersData);
      setInvitations(invitesData);
    } catch (err) {
      console.error('Failed to load org users:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!accessLoading && isOrgAdmin && organizationId) {
      loadData();
    }
  }, [loadData, accessLoading, isOrgAdmin, organizationId]);

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError('');
    setSuccess('');

    try {
      await organizationUsersService.inviteUser(organizationId!, {
        email: inviteEmail,
        role: inviteRole,
      });
      setSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('ORG_MEMBER');
      await loadData();
      setTimeout(() => {
        setInviteModalOpen(false);
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      const msg = err?.message || err?.toString() || 'Failed to invite user';
      setError(msg);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Remove ${userEmail} from this organization?`)) return;
    try {
      await organizationUsersService.removeUser(organizationId!, userId);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to remove user');
    }
  };

  const handleChangeRole = async (userId: string) => {
    if (!editRole) return;
    try {
      setSavingRole(true);
      await organizationUsersService.updateUserRole(organizationId!, userId, editRole);
      await loadData();
      setEditingUserId(null);
      setEditRole('');
    } catch (err: any) {
      alert(err?.message || 'Failed to update role');
    } finally {
      setSavingRole(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string, email: string) => {
    if (!confirm(`Cancel invitation for ${email}?`)) return;
    try {
      await organizationUsersService.cancelInvitation(organizationId!, invitationId);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to cancel invitation');
    }
  };

  const getRoleBadgeClass = (role: string) => ORG_ROLE_COLORS[role] || ORG_ROLE_COLORS.ORG_VIEWER;
  const canEditRole = (targetUser: OrgUser) => {
    if (!isCurrentUserOrgOwner) return false;
    if (targetUser.userId === currentUserId && targetUser.role === 'ORG_OWNER') return false;
    return true;
  };
  const canRemoveUser = (targetUser: OrgUser) => {
    if (!isCurrentUserOrgOwner) return false;
    if (targetUser.userId === currentUserId && targetUser.role === 'ORG_OWNER') return false;
    return true;
  };
  const getAvailableRoles = () => (isCurrentUserOrgOwner ? ALL_ORG_ROLES : NON_OWNER_ORG_ROLES);

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isOrgAdmin) {
    return (
      <AccessDenied
        title="Organization Admin Access Required"
        message="You need organization administrator privileges to manage org-wide team members."
        userRole={isPlatformAdmin ? 'Platform Admin' : 'User'}
        backLink={{ href: `/t/${tenantId}/settings`, label: 'Back to Settings' }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Organization Team"
        description="Manage users with org-wide access across all locations"
        icon={Icons.Settings}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-6 h-6 text-amber-500" />
              Organization Members
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {users.length} member{users.length !== 1 ? 's' : ''}
              {invitations.length > 0 && ` \u2022 ${invitations.length} pending invitation${invitations.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => setInviteModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Invite User
          </button>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No organization members yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Invite your first team member to get started
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Org Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Location Memberships
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold">
                              {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                              {[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unnamed User'}
                              {user.role === 'ORG_OWNER' && (
                                <Crown className="w-3.5 h-3.5 text-amber-500" />
                              )}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingUserId === user.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value)}
                              className="text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1"
                              disabled={savingRole}
                            >
                              {getAvailableRoles().map((r) => (
                                <option key={r} value={r}>{ORG_ROLE_LABELS[r] || r}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleChangeRole(user.userId)}
                              disabled={savingRole}
                              className="text-green-600 hover:text-green-800"
                              title="Save"
                            >
                              {savingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => { setEditingUserId(null); setEditRole(''); }}
                              disabled={savingRole}
                              className="text-gray-400 hover:text-gray-600"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role)}`}>
                            {ORG_ROLE_LABELS[user.role] || user.role}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {user.tenants && user.tenants.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.tenants.map((t) => (
                              <span
                                key={t.tenantId}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                title={`${t.role} at ${t.tenantName}`}
                              >
                                {t.tenantName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No location memberships</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {user.lastLogin
                          ? new Date(user.lastLogin).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {canEditRole(user) && editingUserId !== user.id && (
                            <button
                              onClick={() => { setEditingUserId(user.id); setEditRole(user.role); }}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Change role"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canRemoveUser(user) && (
                            <button
                              onClick={() => handleRemoveUser(user.userId, user.email)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              title="Remove from organization"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Pending Invitations
              </h3>
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                {invitations.length}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {inv.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(inv.role)}`}>
                          {ORG_ROLE_LABELS[inv.role] || inv.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleCancelInvitation(inv.id, inv.email)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          title="Cancel invitation"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-2">
            Organization Team
          </h3>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Organization members have access across all locations in your chain. Their org role determines what they can do at the organization level.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-amber-800 dark:text-amber-200">
            <li><strong>Organization Owner</strong> — Full control including role management and user removal</li>
            <li><strong>Organization Admin</strong> — Can invite members and manage org settings</li>
            <li><strong>Organization Member</strong> — Can access org-level resources and dashboards</li>
            <li><strong>Organization Viewer</strong> — Read-only access to org-level dashboards</li>
          </ul>
        </div>
      </div>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Invite to Organization
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Send an invitation email
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="colleague@example.com"
                  disabled={inviting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Organization Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={inviting}
                >
                  {getAvailableRoles().map((r) => (
                    <option key={r} value={r}>{ORG_ROLE_LABELS[r] || r}</option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  disabled={inviting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
