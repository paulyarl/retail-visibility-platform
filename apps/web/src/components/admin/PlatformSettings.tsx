'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Settings } from 'lucide-react';

interface PlatformSettingsData {
  rateLimitingEnabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

export default function PlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

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
      const response = await fetch('/api/admin/platform-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
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

  const handleRateLimitingToggle = (enabled: boolean) => {
    saveSettings({ rateLimitingEnabled: enabled });
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
                onCheckedChange={handleRateLimitingToggle}
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
            <CardTitle>Additional Settings</CardTitle>
            <CardDescription>
              More platform configuration options coming soon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This section will include additional platform-wide settings in future updates.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
