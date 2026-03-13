'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { DeletionRequestsManager } from '@/components/admin/DeletionRequestsManager';
import { Shield, Users, AlertTriangle } from 'lucide-react';


export default function DeletionRequestsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold tracking-tight">Account Deletion Requests</h1>
        </div>
        <p className="text-muted-foreground">
          Manage user account deletion requests and review deletion policies.
        </p>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Deletion Requests Management
          </CardTitle>
          <CardDescription>
            Review and manage pending account deletion requests. Users have a 30-day grace period 
            to cancel their deletion requests before permanent removal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeletionRequestsManager />
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Pending Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Review deletion requests that are awaiting admin action.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              User Rights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Users have the right to request deletion of their personal data.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600" />
              Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Follow GDPR and data protection regulations for account deletion.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
