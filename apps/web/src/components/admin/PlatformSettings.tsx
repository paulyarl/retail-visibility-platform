'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Settings, BarChart3, Zap } from 'lucide-react';
import RateLimitTrends from './RateLimitTrends';

interface PlatformSettingsData {
  rateLimitingEnabled: boolean;
  updatedAt: string;
  updatedBy: string;
  rateLimitConfigurations?: Array<{
    id: string;
    route_type: string;
    max_requests: number;
    window_minutes: number;
    enabled: boolean;
    created_at: string;
    updated_at: string;
  }>;
}

export default function PlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rateLimitConfigs, setRateLimitConfigs] = useState(settings?.rateLimitConfigurations || []);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings?.rateLimitConfigurations) {
      setRateLimitConfigs(settings.rateLimitConfigurations);
    }
  }, [settings]);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/platform-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        // Default settings if API fails
        setSettings({
          rateLimitingEnabled: true,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system'
        });
      }
    } catch (error) {
      console.error('Failed to load platform settings:', error);
      // Default settings on error
      setSettings({
        rateLimitingEnabled: true,
        updatedAt: new Date().toISOString(),
        updatedBy: 'system'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: Partial<PlatformSettingsData>) => {
    setSaving(true);
    try {
      const payload = {
        rateLimitingEnabled: newSettings.rateLimitingEnabled ?? settings?.rateLimitingEnabled ?? true,
        rateLimitConfigurations: rateLimitConfigs
      };

      const response = await fetch('/api/admin/platform-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const updatedSettings = await response.json();
        setSettings(updatedSettings);
        toast({
          title: 'Settings saved',
          description: 'Platform settings have been updated successfully.',
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save platform settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save platform settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateRateLimitConfig = (routeType: string, field: string, value: any) => {
    setRateLimitConfigs(prev =>
      prev.map(config =>
        config.route_type === routeType
          ? { ...config, [field]: value }
          : config
      )
    );
  };

  const getRouteTypeDescription = (routeType: string) => {
    const descriptions = {
      auth: 'Authentication routes (/api/auth)',
      admin: 'Admin routes (/api/admin)',
      strict: 'Sensitive API routes',
      standard: 'Regular API routes',
      exempt: 'Public browsing routes (directory, items, storefront)'
    };
    return descriptions[routeType as keyof typeof descriptions] || routeType;
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
                onCheckedChange={(enabled) => saveSettings({ rateLimitingEnabled: enabled })}
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
            {rateLimitConfigs.map((config) => (
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
                        Max Requests:
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
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`window-${config.route_type}`} className="text-sm">
                        Per Minute:
                      </Label>
                      <Input
                        id={`window-${config.route_type}`}
                        type="number"
                        value={config.window_minutes}
                        onChange={(e) => updateRateLimitConfig(config.route_type, 'window_minutes', parseInt(e.target.value) || 1)}
                        className="w-16"
                        min="1"
                        max="60"
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
      </div>
    </div>
  );
}
