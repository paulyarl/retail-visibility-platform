'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

type ShowcaseMode = 'slider' | 'hybrid' | 'tabs' | 'grid' | 'video-hero' | 'random';

interface ShowcaseConfig {
  mode: ShowcaseMode;
  rotationEnabled: boolean;
  rotationInterval: number; // in hours
  enabledModes: ShowcaseMode[];
}

const SHOWCASE_MODES = [
  {
    id: 'hybrid' as ShowcaseMode,
    name: 'Hybrid (Recommended)',
    description: 'Hero feature + top 3 features + slider for secondary features',
    icon: '🎯',
    pros: ['Best engagement', 'Clear hierarchy', 'Shows breadth'],
    recommended: true,
  },
  {
    id: 'slider' as ShowcaseMode,
    name: 'Infinite Slider',
    description: 'Continuous horizontal scroll of all features',
    icon: '🎠',
    pros: ['Eye-catching', 'Smooth animation', 'All features visible'],
  },
  {
    id: 'tabs' as ShowcaseMode,
    name: 'Tabbed Interface',
    description: 'Click-through tabs for each feature',
    icon: '📑',
    pros: ['User-controlled', 'Detailed view', 'Mobile-friendly'],
  },
  {
    id: 'grid' as ShowcaseMode,
    name: 'Grid Layout',
    description: 'Static grid showing all features at once',
    icon: '⊞',
    pros: ['Quick overview', 'No animation', 'Accessibility'],
  },
  {
    id: 'video-hero' as ShowcaseMode,
    name: 'Video Hero',
    description: 'Large video demo with feature highlights',
    icon: '🎬',
    pros: ['High engagement', 'Shows product', 'Memorable'],
  },
  {
    id: 'random' as ShowcaseMode,
    name: 'Random Rotation',
    description: 'Randomly select from enabled modes on each page load',
    icon: '🎲',
    pros: ['A/B testing', 'Variety', 'Data-driven'],
  },
];

export default function FeaturesShowcaseAdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<ShowcaseConfig>({
    mode: 'hybrid',
    rotationEnabled: false,
    rotationInterval: 24,
    enabledModes: ['hybrid', 'slider', 'tabs', 'grid'],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<ShowcaseMode>('hybrid');

  // Check admin access
  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      router.push('/');
    }
  }, [user, router]);

  // Load current configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await api.get('/api/admin/features-showcase-config');
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
          setPreviewMode(data.mode);
        }
      } catch (error) {
        console.error('Failed to load showcase config:', error);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await api.post('/api/admin/features-showcase-config', config);
      if (response.ok) {
        alert('✅ Showcase configuration saved successfully!');
      } else {
        alert('❌ Failed to save configuration');
      }
    } catch (error) {
      console.error('Failed to save showcase config:', error);
      alert('❌ Error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  const toggleMode = (mode: ShowcaseMode) => {
    if (mode === 'random') return; // Can't toggle random
    
    setConfig(prev => ({
      ...prev,
      enabledModes: prev.enabledModes.includes(mode)
        ? prev.enabledModes.filter(m => m !== mode)
        : [...prev.enabledModes, mode],
    }));
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 rounded w-64 mb-4"></div>
          <div className="h-4 bg-neutral-200 rounded w-96 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-neutral-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">
          Features Showcase Configuration
        </h1>
        <p className="text-neutral-600">
          Control how features are displayed to visitors on the platform dashboard and features page
        </p>
      </div>

      {/* Current Mode */}
      <Card className="mb-8 border-2 border-primary-200 bg-primary-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🎯</span>
            Current Active Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-neutral-900 mb-1">
                {SHOWCASE_MODES.find(m => m.id === config.mode)?.name}
              </p>
              <p className="text-neutral-600">
                {SHOWCASE_MODES.find(m => m.id === config.mode)?.description}
              </p>
            </div>
            <div className="text-6xl">
              {SHOWCASE_MODES.find(m => m.id === config.mode)?.icon}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mode Selection */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-neutral-900 mb-4">Select Display Mode</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SHOWCASE_MODES.map(mode => (
            <div
              key={mode.id}
              className="cursor-pointer"
              onClick={() => setConfig(prev => ({ ...prev, mode: mode.id }))}
            >
              <Card
                className={`transition-all h-full ${
                  config.mode === mode.id
                    ? 'border-2 border-primary-600 shadow-lg'
                    : 'border border-neutral-200 hover:border-primary-300 hover:shadow-md'
                }`}
              >
                <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">{mode.icon}</div>
                  {mode.recommended && (
                    <Badge className="bg-green-500 text-white">Recommended</Badge>
                  )}
                  {config.mode === mode.id && (
                    <Badge className="bg-primary-600 text-white">Active</Badge>
                  )}
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">{mode.name}</h3>
                <p className="text-sm text-neutral-600 mb-3">{mode.description}</p>
                <div className="space-y-1">
                  {mode.pros.map((pro, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-neutral-700">
                      <span className="text-green-600">✓</span>
                      <span>{pro}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Rotation Settings */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>🎲 Random Rotation Settings</CardTitle>
          <CardDescription>
            Automatically rotate between different showcase modes for A/B testing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Enable Rotation */}
            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
              <div>
                <p className="font-semibold text-neutral-900">Enable Random Rotation</p>
                <p className="text-sm text-neutral-600">
                  Randomly select from enabled modes on each visitor session
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.mode === 'random'}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    mode: e.target.checked ? 'random' : 'hybrid',
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            {/* Enabled Modes for Rotation */}
            {config.mode === 'random' && (
              <div>
                <p className="font-semibold text-neutral-900 mb-3">
                  Select modes to include in rotation:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {SHOWCASE_MODES.filter(m => m.id !== 'random').map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => toggleMode(mode.id)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        config.enabledModes.includes(mode.id)
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">{mode.icon}</div>
                      <p className="text-xs font-semibold text-neutral-900">{mode.name}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  {config.enabledModes.length} mode(s) selected for rotation
                </p>
              </div>
            )}

            {/* Rotation Interval */}
            {config.mode === 'random' && (
              <div>
                <label className="block font-semibold text-neutral-900 mb-2">
                  Rotation Interval (hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={config.rotationInterval}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    rotationInterval: parseInt(e.target.value) || 24,
                  }))}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  How often to rotate modes (1-168 hours). Set to 0 for every page load.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>👁️ Preview Mode</CardTitle>
          <CardDescription>
            Test different showcase modes before saving
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            {SHOWCASE_MODES.filter(m => m.id !== 'random').map(mode => (
              <Button
                key={mode.id}
                variant={previewMode === mode.id ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setPreviewMode(mode.id)}
              >
                {mode.icon} {mode.name}
              </Button>
            ))}
          </div>
          <div className="bg-neutral-100 p-4 rounded-lg">
            <p className="text-sm text-neutral-600 mb-2">
              Preview for: <strong>{SHOWCASE_MODES.find(m => m.id === previewMode)?.name}</strong>
            </p>
            <a
              href={`/?preview_showcase=${previewMode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline text-sm"
            >
              Open preview in new tab →
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Info */}
      <Card className="mb-8 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>📊</span>
            Analytics & Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-700 mb-3">
            When random rotation is enabled, we automatically track:
          </p>
          <ul className="space-y-2 text-sm text-neutral-700">
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Which mode was shown to each visitor</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Time spent on page per mode</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Click-through rates to features page</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Signup conversion rates per mode</span>
            </li>
          </ul>
          <Button variant="secondary" size="sm" className="mt-4">
            View Analytics Dashboard →
          </Button>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-between bg-white border-t border-neutral-200 p-6 -mx-4 sticky bottom-0">
        <div className="text-sm text-neutral-600">
          Changes will apply immediately to all visitors
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => router.push('/settings/admin')}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : '💾 Save Configuration'}
          </Button>
        </div>
      </div>
    </div>
  );
}
