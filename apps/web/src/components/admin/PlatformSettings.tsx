'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Button } from '@mantine/core';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/use-toast';
import { platformSettingsService } from '@/services/PlatformSettingsSingletonService';
import { rateLimitSettingsService, type RateLimitConfiguration } from '@/services/RateLimitSettingsSingletonService';
import { Zap, Shield, TrendingUp, Settings, Loader2, BarChart3 } from 'lucide-react';
import RateLimitTrends from './RateLimitTrends';
import SecurityAlerts from './SecurityAlerts';

interface PlatformSettingsData {
  rateLimitingEnabled: boolean;
  updatedAt: string;
  updatedBy: string;
  rateLimitConfigurations?: RateLimitConfiguration[];
}

export default function PlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rateLimitConfigs, setRateLimitConfigs] = useState<PlatformSettingsData['rateLimitConfigurations']>([]); // Use proper type
  const { toast: toastFunction } = useToast();

  // Default rate limit configurations for different route types
  const getDefaultRateLimitConfigs = () => {
    return [
      {
        id: 'default-api',
        route_type: 'api',
        max_requests: 1000,
        window_minutes: 1,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'default-auth',
        route_type: 'auth',
        max_requests: 10,
        window_minutes: 1,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'default-search',
        route_type: 'search',
        max_requests: 100,
        window_minutes: 1,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'default-upload',
        route_type: 'upload',
        max_requests: 20,
        window_minutes: 1,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'default-admin',
        route_type: 'admin',
        max_requests: 50,
        window_minutes: 5,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Update rateLimitConfigs when settings are loaded (but not on every settings change)
  useEffect(() => {
    if (settings?.rateLimitConfigurations) {
      if (rateLimitConfigs?.length === 0) {
        setRateLimitConfigs(settings.rateLimitConfigurations);
      }
    } else if (rateLimitConfigs?.length === 0) {
      // Initialize with defaults if no configurations exist
      setRateLimitConfigs(getDefaultRateLimitConfigs());
    }
  }, [settings?.rateLimitConfigurations, rateLimitConfigs?.length]); // Add rateLimitConfigs.length dependency

  const loadSettings = async () => {
    try {
      // Use rate limit settings service for proper persistence
      const settingsData = await rateLimitSettingsService.getRateLimitSettings();
      
      if (settingsData) {
        // Map the rate limiting settings to the expected format for this component
        const mappedSettings: PlatformSettingsData = {
          rateLimitingEnabled: settingsData.rateLimitingEnabled,
          updatedAt: settingsData.updatedAt,
          updatedBy: settingsData.updatedBy,
          rateLimitConfigurations: settingsData.rateLimitConfigurations?.map((config: any) => ({
            id: config.id || `${config.route_type}-config`,
            route_type: config.route_type,
            max_requests: config.max_requests ?? 1,
            window_minutes: 1, // Fixed to per minute for now
            enabled: config.enabled ?? true,
            created_at: config.created_at,
            updated_at: config.updated_at
          })) || []
        };
        
        setSettings(mappedSettings);
        // Also update rateLimitConfigs to ensure UI reflects saved state
        setRateLimitConfigs(mappedSettings.rateLimitConfigurations);
      } else {
        // Default settings if API fails
        const defaults = getDefaultRateLimitConfigs();
        setSettings({
          rateLimitingEnabled: true,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system',
          rateLimitConfigurations: defaults
        });
        setRateLimitConfigs(defaults);
      }
    } catch (error) {
      console.error('Failed to load rate limiting settings:', error);
      // Default settings on error
      setSettings({
        rateLimitingEnabled: true,
        updatedAt: new Date().toISOString(),
        updatedBy: 'system',
        rateLimitConfigurations: getDefaultRateLimitConfigs()
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (updates?: Partial<{ rateLimitingEnabled: boolean; rateLimitConfigurations: any[] }>) => {
    setSaving(true);
    try {
      // Optimistic update - update local state immediately
      if (updates) {
        setSettings(prev => ({
          ...prev,
          ...updates,
          rateLimitingEnabled: updates.rateLimitingEnabled ?? prev?.rateLimitingEnabled ?? false,
          updatedAt: new Date().toISOString(),
          updatedBy: 'current-user'
        }));
      }

      const payload = {
        rateLimitingEnabled: settings?.rateLimitingEnabled || false,
        rateLimitConfigurations: (rateLimitConfigs || []).map(config => ({
          route_type: config.route_type,
          max_requests: config.max_requests,
          window_minutes: 1,
          enabled: config.enabled
        }))
      };

      // Use singleton service to update settings
      const updatedSettings = await rateLimitSettingsService.updateRateLimitSettings(payload);
      
      if (updatedSettings) {
        toastFunction('Settings saved successfully', { variant: 'success' });
        // Refresh settings to get the latest data
        loadSettings();
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save platform settings:', error);
      toastFunction('Failed to save platform settings. Please try again.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const updateRateLimitConfig = (routeType: string, field: string, value: any) => {
    // Update local state immediately
    setRateLimitConfigs(prev =>
      (prev || []).map(config =>
        config.route_type === routeType
          ? { ...config, [field]: value }
          : config
      )
    );
    
    // Don't auto-save - wait for user to click Save button
  };

  const getRouteTypeDescription = (routeType: string) => {
    const descriptions = {
      auth: 'Authentication routes (/api/auth)',
      admin: 'Admin routes (/api/admin)',
      api: 'API routes (/api/*)',
      search: 'Search endpoints (/api/search)',
      upload: 'File upload routes (/api/upload)',
      strict: 'Sensitive API routes',
      standard: 'Regular API routes',
      exempt: 'Public browsing routes (directory, items, storefront)'
    };
    return descriptions[routeType as keyof typeof descriptions] || `${routeType} routes`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Platform Settings</h1>
          <p className="text-muted-foreground">
            Configure platform-wide settings and security controls
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Rate Limiting
            </CardTitle>
            <CardDescription>
              Control application-level rate limiting to protect against abuse while allowing normal browsing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="rate-limiting" className="text-base font-medium">
                  Enable Rate Limiting
                </Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, protects against abusive API usage while allowing normal user browsing.
                  When disabled, removes all application-level rate limiting (infrastructure-level limits may still apply).
                </p>
              </div>
              <Switch
                id="rate-limiting"
                checked={settings?.rateLimitingEnabled ?? true}
                onCheckedChange={(enabled) => {
                  // Only update local state, don't auto-save
                  setSettings(prev => ({
                    ...prev,
                    rateLimitingEnabled: enabled,
                    updatedAt: new Date().toISOString(),
                    updatedBy: 'current-user'
                  }));
                }}
                disabled={saving}
              />
            </div>

            {settings && (
              <div className="text-sm text-muted-foreground">
                Last updated: {new Date(settings.updatedAt).toLocaleString()} by {settings.updatedBy}
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="space-y-2">
                <h4 className="font-medium">Rate Limiting Behavior:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• <strong>Enabled:</strong> Smart rate limiting that differentiates browsing from abuse</li>
                  <li>• <strong>Disabled:</strong> No application-level rate limiting (infrastructure limits may apply)</li>
                  <li>• <strong>Emergency Override:</strong> Toggle off during high-traffic events or testing</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Rate Limit Thresholds
            </CardTitle>
            <CardDescription>
              Configure request limits for different route types. Warnings are logged when limits are exceeded.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {(rateLimitConfigs || []).map((config) => (
              <div key={config.route_type} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Label className="font-medium capitalize">{config.route_type} Routes</Label>
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(enabled) => updateRateLimitConfig(config.route_type, 'enabled', enabled)}
                      disabled={saving}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {getRouteTypeDescription(config.route_type)}
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`max-${config.route_type}`} className="text-sm">
                        Requests per minute:
                      </Label>
                      <Input
                        id={`max-${config.route_type}`}
                        type="number"
                        value={config.max_requests}
                        onChange={(e) => updateRateLimitConfig(config.route_type, 'max_requests', parseInt(e.target.value) || 1)}
                        className="w-20"
                        min="1"
                        max="10000"
                        disabled={saving || !config.enabled}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

          <div className="flex justify-end">
            <Button
              onClick={() => saveSettings({})}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Rate Limiting Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Rate Limiting Analytics
          </CardTitle>
          <CardDescription>
            Monitor rate limiting trends and identify potential threats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RateLimitTrends />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Alerts
          </CardTitle>
          <CardDescription>
            Monitor recent security alerts with IP addresses and threat details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SecurityAlerts />
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
