'use client';

import { useState, useEffect } from 'react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Button } from '@/components/ui';
import { Badge } from '@/components/ui';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, Activity, Database, Cloud } from 'lucide-react';

export default function GBPSyncPage() {
  const [syncStatus, setSyncStatus] = useState({
    lastSync: '2024-01-19T14:30:00Z',
    totalCategories: 245,
    syncedCategories: 238,
    failedCategories: 7,
    successRate: 97.1,
    isCurrentlySyncing: false,
    nextScheduledSync: '2024-01-20T02:00:00Z'
  });

  const [syncHistory, setSyncHistory] = useState([
    {
      id: '1',
      startTime: '2024-01-19T14:30:00Z',
      endTime: '2024-01-19T14:32:45Z',
      status: 'success',
      totalCategories: 245,
      syncedCategories: 238,
      failedCategories: 7,
      duration: '2m 45s',
      trigger: 'scheduled'
    },
    {
      id: '2',
      startTime: '2024-01-18T02:00:00Z',
      endTime: '2024-01-18T02:01:12Z',
      status: 'success',
      totalCategories: 243,
      syncedCategories: 243,
      failedCategories: 0,
      duration: '1m 12s',
      trigger: 'scheduled'
    },
    {
      id: '3',
      startTime: '2024-01-17T14:15:00Z',
      endTime: '2024-01-17T14:18:30Z',
      status: 'partial',
      totalCategories: 241,
      syncedCategories: 220,
      failedCategories: 21,
      duration: '3m 30s',
      trigger: 'manual'
    }
  ]);

  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    // Simulate manual sync
    setTimeout(() => {
      setSyncStatus({
        ...syncStatus,
        lastSync: new Date().toISOString(),
        isCurrentlySyncing: false
      });
      setIsManualSyncing(false);
    }, 3000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="success">Success</Badge>;
      case 'partial':
        return <Badge variant="warning">Partial</Badge>;
      case 'failed':
        return <Badge variant="error">Failed</Badge>;
      case 'running':
        return <Badge variant="info">Running</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="GBP Category Sync"
        description="Monitor Google Business Profile category synchronization"
        icon={Icons.Admin}
      />

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sync Status
          </CardTitle>
          <CardDescription>Current synchronization status and metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">{syncStatus.successRate}%</div>
              <p className="text-sm text-gray-600">Success Rate</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{syncStatus.syncedCategories}</div>
              <p className="text-sm text-gray-600">Synced Categories</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{syncStatus.failedCategories}</div>
              <p className="text-sm text-gray-600">Failed Categories</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{syncStatus.totalCategories}</div>
              <p className="text-sm text-gray-600">Total Categories</p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t pt-6">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Last Sync:</span> {new Date(syncStatus.lastSync).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Next Scheduled:</span> {new Date(syncStatus.nextScheduledSync).toLocaleString()}
              </p>
            </div>
            <Button
              onClick={handleManualSync}
              disabled={isManualSyncing || syncStatus.isCurrentlySyncing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isManualSyncing ? 'animate-spin' : ''}`} />
              {isManualSyncing ? 'Syncing...' : 'Manual Sync'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Sync Configuration
            </CardTitle>
            <CardDescription>Configure synchronization settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sync Frequency
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="hourly">Every Hour</option>
                <option value="6hours">Every 6 Hours</option>
                <option value="daily" selected>Daily (2:00 AM)</option>
                <option value="weekly">Weekly</option>
                <option value="manual">Manual Only</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Retry Attempts
              </label>
              <input
                type="number"
                defaultValue="3"
                min="1"
                max="10"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timeout (seconds)
              </label>
              <input
                type="number"
                defaultValue="30"
                min="5"
                max="300"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Enable Auto-Retry</span>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6"></span>
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              API Configuration
            </CardTitle>
            <CardDescription>Google Business Profile API settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Endpoint
              </label>
              <input
                type="url"
                defaultValue="https://mybusiness.googleapis.com/v4/categories"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rate Limit (requests/minute)
              </label>
              <input
                type="number"
                defaultValue="100"
                min="1"
                max="1000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key Status
              </label>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600">Connected</span>
              </div>
            </div>

            <Button variant="outline" className="w-full">
              Test API Connection
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Sync History
          </CardTitle>
          <CardDescription>Recent synchronization attempts and results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {syncHistory.map((sync) => (
              <div
                key={sync.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {getStatusBadge(sync.status)}
                    <span className="text-sm font-medium text-gray-900">
                      {sync.trigger === 'manual' ? 'Manual' : 'Scheduled'} Sync
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(sync.startTime).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Duration:</span>
                    <span className="ml-2 font-medium">{sync.duration}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total:</span>
                    <span className="ml-2 font-medium">{sync.totalCategories}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Synced:</span>
                    <span className="ml-2 font-medium text-green-600">{sync.syncedCategories}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Failed:</span>
                    <span className="ml-2 font-medium text-red-600">{sync.failedCategories}</span>
                  </div>
                </div>

                {sync.status === 'partial' && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm text-yellow-800">
                        Partial sync completed - some categories failed to sync
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
