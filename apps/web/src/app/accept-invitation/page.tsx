'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { CheckCircle, XCircle, Clock, Mail, Building2, User, Shield } from 'lucide-react';
import AdminInvitationsService from '@/services/AdminInvitationsService';



interface InvitationData {
  id: string;
  email: string;
  role: string;
  tenant?: {
    id: string;
    name: string;
  };
  organization?: {
    id: string;
    name: string;
  };
  inviter?: {
    name: string;
  };
  invitedBy?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  expiresAt: string;
  createdAt: string;
}

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form fields for new users
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [userExists, setUserExists] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link - missing token');
      setLoading(false);
      return;
    }

    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    try {
      setLoading(true);
      
      // MIGRATION: Using AdminInvitationsService instead of direct fetch
      if (!token) {
        setError('Invalid invitation token');
        return;
      }
      
      const invitation = await AdminInvitationsService.getInvitationByToken(token);
      
      if (!invitation) {
        setError('Invalid invitation or invitation not found');
        return;
      }

      // Check invitation status
      if (invitation.status === 'expired') {
        setError('This invitation has expired. Please request a new invitation.');
        return;
      } else if (invitation.status === 'accepted') {
        setError('This invitation has already been accepted.');
        return;
      } else if (invitation.status === 'revoked') {
        setError('This invitation has been revoked.');
        return;
      }

      // Transform invitation data to match the expected interface
      const transformedInvitation: InvitationData = {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role || 'member',
        tenant: invitation.organization ? {
          id: invitation.organization.id,
          name: invitation.organization.name,
        } : undefined,
        organization: invitation.organization,
        inviter: invitation.invitedBy ? {
          name: `${invitation.invitedBy.firstName || ''} ${invitation.invitedBy.lastName || ''}`.trim() || invitation.invitedBy.email
        } : undefined,
        invitedBy: invitation.invitedBy,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      };

      setInvitation(transformedInvitation);
      
      // Check if user already exists by trying to determine from the invitation email
      // This is a simple heuristic - in a real app you might have a separate endpoint
      setUserExists(false); // For now, assume new user
      
    } catch (err) {
      setError('Failed to load invitation details');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invitation || !token) return;

    // Validation for new users
    if (!userExists) {
      if (!password) {
        setError('Password is required');
        return;
      }
      
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
    }

    try {
      setAccepting(true);
      setError('');

      // MIGRATION: Using AdminInvitationsService instead of direct fetch
      const acceptedInvitation = await AdminInvitationsService.acceptInvitation(token, {
        firstName: userExists ? undefined : firstName,
        lastName: userExists ? undefined : lastName,
        password: userExists ? undefined : password,
      });

      if (!acceptedInvitation) {
        setError('Failed to accept invitation. Please try again.');
        return;
      }

      setSuccess('Invitation accepted successfully!');
      
      // Redirect to login or dashboard after a delay
      setTimeout(() => {
        if (acceptedInvitation.status === 'accepted') {
          window.location.href = '/auth/login?message=Invitation accepted. Please log in to access your account.';
        }
      }, 2000);
      
    } catch (err) {
      setError('Failed to accept invitation. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading invitation...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button 
              onClick={() => { window.location.href = '/auth/login'; }} 
              className="w-full mt-4"
              variant="secondary"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-green-600">Invitation Accepted!</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
            <p className="text-sm text-gray-600 text-center mt-4">
              Redirecting you to login...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Mail className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
            Accept your invitation to join {invitation?.tenant?.name}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Invitation Details */}
          <div className="space-y-3 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Organization:</span>
              <span>{invitation?.tenant?.name}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Role:</span>
              <span className="capitalize">{invitation?.role.toLowerCase()}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Invited by:</span>
              <span>{invitation?.inviter?.name}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Expires:</span>
              <span>{invitation ? new Date(invitation.expiresAt).toLocaleDateString() : ''}</span>
            </div>
          </div>

          {/* Acceptance Form */}
          <form onSubmit={handleAccept} className="space-y-4">
            {!userExists && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password">Create Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                  />
                </div>
              </>
            )}

            {error && (
              <Alert>
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={accepting}
            >
              {accepting ? 'Accepting...' : userExists ? 'Accept Invitation' : 'Create Account & Accept'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button 
              variant="ghost" 
              onClick={() => { window.location.href = '/auth/login'; }}
              className="text-sm"
            >
              Already have an account? Sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      </div>
    }>
      <AcceptInvitationContent />
    </Suspense>
  );
}
