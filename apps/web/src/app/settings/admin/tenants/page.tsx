"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Spinner, Alert } from '@/components/ui';
import { motion } from 'framer-motion';

interface Tenant {
  id: string;
  name: string;
  createdAt?: string;
  userId?: string;
  status: 'active' | 'inactive';
  itemCount?: number;
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTenants = async () => {
      try {
        const res = await fetch('/api/tenants');
        if (!res.ok) throw new Error('Failed to load tenants');
        const data = await res.json();
        setTenants(Array.isArray(data) ? data.map((t: any) => ({
          ...t,
          status: 'active',
          itemCount: 0,
        })) : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load tenants');
      } finally {
        setLoading(false);
      }
    };

    loadTenants();
  }, []);

  const getStatusBadge = (status: string) => {
    return status === 'active' 
      ? <Badge variant="success">Active</Badge>
      : <Badge variant="default">Inactive</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">All Tenants</h1>
              <p className="text-neutral-600 mt-1">System-wide tenant management</p>
            </div>
            <Link 
              href="/settings/admin"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Admin
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {error && (
          <Alert variant="error" title="Error">
            {error}
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-neutral-900">{tenants.length}</p>
                <p className="text-sm text-neutral-600 mt-1">Total Tenants</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">
                  {tenants.filter(t => t.status === 'active').length}
                </p>
                <p className="text-sm text-neutral-600 mt-1">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-neutral-600">
                  {tenants.filter(t => t.status === 'inactive').length}
                </p>
                <p className="text-sm text-neutral-600 mt-1">Inactive</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {tenants.reduce((sum, t) => sum + (t.itemCount || 0), 0)}
                </p>
                <p className="text-sm text-neutral-600 mt-1">Total Items</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tenants List */}
        <Card>
          <CardHeader>
            <CardTitle>All Tenants</CardTitle>
            <CardDescription>System-wide view of all tenant locations</CardDescription>
          </CardHeader>
          <CardContent>
            {tenants.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-neutral-900">No tenants</h3>
                <p className="mt-1 text-sm text-neutral-500">No tenants have been created yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-200">
                {tenants.map((tenant, index) => (
                  <motion.div
                    key={tenant.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="py-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-neutral-900">{tenant.name}</p>
                          {getStatusBadge(tenant.status)}
                        </div>
                        <p className="text-sm text-neutral-600">ID: {tenant.id}</p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {tenant.itemCount || 0} items
                          {tenant.createdAt && ` • Created ${new Date(tenant.createdAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/tenants`}>
                        <Button size="sm" variant="secondary">
                          View Details
                        </Button>
                      </Link>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => {
                          // Store tenant ID and navigate to items
                          localStorage.setItem('tenantId', tenant.id);
                          window.location.href = '/items';
                        }}
                      >
                        View Items
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>About Tenant Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-neutral-600">
              <p>
                This page shows all tenants across the entire system. As an admin, you can view and manage all tenant locations.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">Active Tenants</p>
                    <p className="text-xs text-neutral-500">Tenants currently in use</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">Inventory Items</p>
                    <p className="text-xs text-neutral-500">Total items across all tenants</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
