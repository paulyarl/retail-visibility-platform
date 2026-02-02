"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from "@/components/ProtectedRoute";
import PageHeader, { Icons } from '@/components/PageHeader';
import { Card, Button, ColorInput, Select, Slider, TextInput, Badge, Switch, Group, Text, Divider, Tabs, TabsList, TabsTab, TabsPanel } from '@mantine/core';
import { useMantineTheme } from '@mantine/core';
import { CheckCircle, Palette, Type, Layout, Eye, Save, RefreshCw } from 'lucide-react';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

// Theme presets
const THEME_PRESETS = {
  default: {
    name: 'Platform Default',
    colors: {
      primary: '#0066ff',
      secondary: '#6fd58a',
      accent: '#ffdd07',
      neutral: '#64748b'
    },
    description: 'Professional blue theme with green accents'
  },
  professional: {
    name: 'Professional Gray',
    colors: {
      primary: '#374151',
      secondary: '#6b7280',
      accent: '#9ca3af',
      neutral: '#f3f4f6'
    },
    description: 'Clean gray theme for corporate environments'
  },
  vibrant: {
    name: 'Vibrant',
    colors: {
      primary: '#7c3aed',
      secondary: '#ec4899',
      accent: '#f59e0b',
      neutral: '#64748b'
    },
    description: 'Colorful theme with purple and pink accents'
  },
  minimal: {
    name: 'Minimal',
    colors: {
      primary: '#000000',
      secondary: '#ffffff',
      accent: '#f3f4f6',
      neutral: '#64748b'
    },
    description: 'Black and white minimal theme'
  }
};

// Font options
const FONT_OPTIONS = [
  { value: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', label: 'Inter (Default)' },
  { value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', label: 'System' },
  { value: '"Roboto", sans-serif', label: 'Roboto' },
  { value: '"Open Sans", sans-serif', label: 'Open Sans' },
  { value: '"Lato", sans-serif', label: 'Lato' },
  { value: '"Poppins", sans-serif', label: 'Poppins' },
  { value: '"Nunito", sans-serif', label: 'Nunito' }
];

// Border radius options
const RADIUS_OPTIONS = [
  { value: 'xs', label: 'Sharp (2px)' },
  { value: 'sm', label: 'Subtle (4px)' },
  { value: 'md', label: 'Rounded (6px)' },
  { value: 'lg', label: 'Smooth (8px)' },
  { value: 'xl', label: 'Pill (12px)' }
];

export default function ThemeSettingsPage() {
  const router = useRouter();
  const currentTheme = useMantineTheme();

  // Theme state
  const [selectedPreset, setSelectedPreset] = useState('default');
  const [customColors, setCustomColors] = useState({
    primary: '#0066ff',
    secondary: '#6fd58a',
    accent: '#ffdd07',
    neutral: '#64748b'
  });
  const [fontFamily, setFontFamily] = useState('Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
  const [borderRadius, setBorderRadius] = useState('md');
  const [buttonSize, setButtonSize] = useState('sm');
  const [spacing, setSpacing] = useState(16);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load current theme settings
  useEffect(() => {
    loadCurrentTheme();
  }, []);

  const loadCurrentTheme = () => {
    // In a real implementation, this would load from the database
    // For now, we'll use default values
    setCustomColors({
      primary: '#0066ff',
      secondary: '#6fd58a',
      accent: '#ffdd07',
      neutral: '#64748b'
    });
    setFontFamily('Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
    setBorderRadius('md');
    setButtonSize('sm');
    setSpacing(16);
  };

  const handlePresetSelect = (preset: string) => {
    setSelectedPreset(preset);
    if (preset !== 'custom') {
      setCustomColors(THEME_PRESETS[preset as keyof typeof THEME_PRESETS].colors);
    }
    setHasUnsavedChanges(true);
  };

  const handleColorChange = (colorType: string, value: string) => {
    setCustomColors(prev => ({
      ...prev,
      [colorType]: value
    }));
    setSelectedPreset('custom');
    setHasUnsavedChanges(true);
  };

  const handleSaveTheme = async () => {
    setIsLoading(true);
    try {
      // In a real implementation, this would save to the database
      const themeConfig = {
        colors: customColors,
        fontFamily,
        borderRadius,
        buttonSize,
        spacing,
        updatedAt: new Date().toISOString(),
        updatedBy: 'admin' // In real app, get from auth context
      };

      console.log('Saving theme configuration:', themeConfig);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      setHasUnsavedChanges(false);
      // Show success message (would use Mantine notifications in real app)
      alert('Theme settings saved successfully!');

    } catch (error) {
      console.error('Failed to save theme:', error);
      alert('Failed to save theme settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset theme to platform defaults?')) {
      loadCurrentTheme();
      setSelectedPreset('default');
      setHasUnsavedChanges(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        <PageHeader
          title="Theme Settings"
          description="Customize the visual appearance and branding of your platform"
          icon={Icons.Appearance}
          backLink={{
            href: '/settings',
            label: 'Back to Settings'
          }}
        />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTab value="basic" leftSection={<Palette className="w-4 h-4" />}>
                Basic Settings
              </TabsTab>
              <TabsTab value="advanced" leftSection={<Eye className="w-4 h-4" />}>
                Component Previews
              </TabsTab>
            </TabsList>

            {/* Basic Settings Tab */}
            <TabsPanel value="basic" className="space-y-8 mt-6">
              {/* Theme Presets */}
              <Card withBorder padding="lg" radius="md">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Palette className="w-5 h-5" />
                        Theme Presets
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Choose from pre-designed themes or create your own custom theme</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(THEME_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => handlePresetSelect(key)}
                        className={`relative p-4 border-2 rounded-lg transition-all ${
                          selectedPreset === key
                            ? 'border-primary-600 bg-primary-50'
                            : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-full h-16 rounded-md flex items-center justify-center gap-1" style={{ backgroundColor: preset.colors.primary }}>
                            <div
                              className="w-4 h-4 rounded-full border-2 border-white/30"
                              style={{ backgroundColor: preset.colors.primary }}
                            />
                            <div
                              className="w-4 h-4 rounded-full border-2 border-white/30"
                              style={{ backgroundColor: preset.colors.secondary }}
                            />
                            <div
                              className="w-4 h-4 rounded-full border-2 border-white/30"
                              style={{ backgroundColor: preset.colors.accent }}
                            />
                          </div>
                          <div className="text-center">
                            <p className="font-medium text-neutral-900 dark:text-white">{preset.name}</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">{preset.description}</p>
                          </div>
                          {selectedPreset === key && (
                            <div className="absolute top-2 right-2">
                              <CheckCircle className="w-5 h-5 text-primary-600" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Custom Colors */}
              <Card withBorder padding="lg" radius="md">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Palette className="w-5 h-5" />
                        Custom Colors
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Customize individual colors for your theme</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Primary Color
                        </label>
                        <ColorInput
                          value={customColors.primary}
                          onChange={(value) => handleColorChange('primary', value)}
                          placeholder="Pick primary color"
                          size="sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Secondary Color
                        </label>
                        <ColorInput
                          value={customColors.secondary}
                          onChange={(value) => handleColorChange('secondary', value)}
                          placeholder="Pick secondary color"
                          size="sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Accent Color
                        </label>
                        <ColorInput
                          value={customColors.accent}
                          onChange={(value) => handleColorChange('accent', value)}
                          placeholder="Pick accent color"
                          size="sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Neutral Color
                        </label>
                        <ColorInput
                          value={customColors.neutral}
                          onChange={(value) => handleColorChange('neutral', value)}
                          placeholder="Pick neutral color"
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Typography & Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Typography */}
                <Card withBorder padding="lg" radius="md">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <Type className="w-5 h-5" />
                          Typography
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Choose fonts and text styling</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Font Family
                        </label>
                        <Select
                          data={FONT_OPTIONS}
                          value={fontFamily}
                          onChange={(value) => {
                            setFontFamily(value || fontFamily);
                            setHasUnsavedChanges(true);
                          }}
                          placeholder="Select font family"
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Layout & Components */}
                <Card withBorder padding="lg" radius="md">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-3 w-3 rounded-full bg-orange-500"></div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <Layout className="w-5 h-5" />
                          Layout & Components
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Customize component appearance</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Border Radius
                        </label>
                        <Select
                          data={RADIUS_OPTIONS}
                          value={borderRadius}
                          onChange={(value) => {
                            setBorderRadius(value || borderRadius);
                            setHasUnsavedChanges(true);
                          }}
                          placeholder="Select border radius"
                          size="sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Default Button Size
                        </label>
                        <Select
                          data={[
                            { value: 'xs', label: 'Extra Small' },
                            { value: 'sm', label: 'Small' },
                            { value: 'md', label: 'Medium' },
                            { value: 'lg', label: 'Large' },
                            { value: 'xl', label: 'Extra Large' }
                          ]}
                          value={buttonSize}
                          onChange={(value) => {
                            setButtonSize(value || buttonSize);
                            setHasUnsavedChanges(true);
                          }}
                          placeholder="Select button size"
                          size="sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Base Spacing (px)
                        </label>
                        <Slider
                          value={spacing}
                          onChange={(value) => {
                            setSpacing(value);
                            setHasUnsavedChanges(true);
                          }}
                          min={8}
                          max={32}
                          step={4}
                          marks={[
                            { value: 8, label: '8px' },
                            { value: 16, label: '16px' },
                            { value: 24, label: '24px' },
                            { value: 32, label: '32px' }
                          ]}
                          className="mt-2"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Live Preview */}
              <Card withBorder padding="lg" radius="md">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-3 w-3 rounded-full bg-cyan-500"></div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Eye className="w-5 h-5" />
                        Live Preview
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">See how your theme changes will look</p>
                    </div>
                  </div>
                  <div className="p-6 bg-white dark:bg-neutral-800 rounded-lg border">
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <Button
                          size={buttonSize as any}
                          style={{
                            backgroundColor: customColors.primary,
                            borderRadius: borderRadius === 'xs' ? '2px' : borderRadius === 'sm' ? '4px' : borderRadius === 'md' ? '6px' : borderRadius === 'lg' ? '8px' : '12px',
                            color: 'white'
                          }}
                        >
                          Primary Button
                        </Button>
                        <Button
                          variant="light"
                          size={buttonSize as any}
                          style={{
                            color: customColors.secondary,
                            borderRadius: borderRadius === 'xs' ? '2px' : borderRadius === 'sm' ? '4px' : borderRadius === 'md' ? '6px' : borderRadius === 'lg' ? '8px' : '12px'
                          }}
                        >
                          Secondary Button
                        </Button>
                        <Button
                          variant="outline"
                          size={buttonSize as any}
                          style={{
                            borderColor: customColors.accent,
                            color: customColors.accent,
                            borderRadius: borderRadius === 'xs' ? '2px' : borderRadius === 'sm' ? '4px' : borderRadius === 'md' ? '6px' : borderRadius === 'lg' ? '8px' : '12px'
                          }}
                        >
                          Outline Button
                        </Button>
                      </div>

                      <div className="flex gap-2">
                        <Badge
                          style={{
                            backgroundColor: customColors.primary,
                            borderRadius: borderRadius === 'xs' ? '2px' : borderRadius === 'sm' ? '4px' : borderRadius === 'md' ? '6px' : borderRadius === 'lg' ? '8px' : '12px',
                            color: 'white'
                          }}
                        >
                          Primary Badge
                        </Badge>
                        <Badge
                          variant="light"
                          style={{
                            color: customColors.secondary,
                            borderRadius: borderRadius === 'xs' ? '2px' : borderRadius === 'sm' ? '4px' : borderRadius === 'md' ? '6px' : borderRadius === 'lg' ? '8px' : '12px'
                          }}
                        >
                          Secondary Badge
                        </Badge>
                      </div>

                      <TextInput
                        placeholder="Sample input field"
                        size={buttonSize as any}
                        style={{
                          borderRadius: borderRadius === 'xs' ? '2px' : borderRadius === 'sm' ? '4px' : borderRadius === 'md' ? '6px' : borderRadius === 'lg' ? '8px' : '12px'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </TabsPanel>

            {/* Advanced Component Previews Tab */}
            <TabsPanel value="advanced" className="space-y-8 mt-6">
              <Card withBorder padding="lg" radius="md">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-3 w-3 rounded-full bg-pink-500"></div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Eye className="w-5 h-5" />
                        Migrated Component Previews
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Preview of components migrated from shadcn/ui to Mantine</p>
                    </div>
                  </div>
                  <div className="space-y-8">
                  {/* Buttons */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">Buttons</h4>
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-4">
                        <Button variant="filled" size="sm">Filled Small</Button>
                        <Button variant="filled" size="md">Filled Medium</Button>
                        <Button variant="filled" size="lg">Filled Large</Button>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <Button variant="light" size="sm">Light Small</Button>
                        <Button variant="light" size="md">Light Medium</Button>
                        <Button variant="light" size="lg">Light Large</Button>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <Button variant="outline" size="sm">Outline Small</Button>
                        <Button variant="outline" size="md">Outline Medium</Button>
                        <Button variant="outline" size="lg">Outline Large</Button>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <Button variant="subtle" size="sm">Subtle Small</Button>
                        <Button variant="subtle" size="md">Subtle Medium</Button>
                        <Button variant="subtle" size="lg">Subtle Large</Button>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <Button variant="ghost" size="sm">Ghost Small</Button>
                        <Button variant="ghost" size="md">Ghost Medium</Button>
                        <Button variant="ghost" size="lg">Ghost Large</Button>
                      </div>
                    </div>
                  </div>

                  <Divider />

                  {/* Cards */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">Cards</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card withBorder className="bg-white">
                        <div className="p-4">
                          <h5 className="font-semibold text-neutral-900 mb-2">Standard Card</h5>
                          <p className="text-sm text-neutral-600">This is a standard Mantine card with basic border styling.</p>
                          <Text size="sm" className="mt-2">Card content goes here. This demonstrates the Card component that has been migrated from shadcn/ui.</Text>
                        </div>
                      </Card>

                      <Card 
                        withBorder 
                        radius="lg" 
                        className="shadow-lg bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200"
                      >
                        <div className="p-6">
                          <h5 className="font-bold text-blue-900 mb-2">Styled Card</h5>
                          <p className="text-sm text-blue-700">Card with enhanced styling, larger radius, gradient background, and stronger shadow.</p>
                          <Text size="sm" className="mt-2 text-blue-800">This card demonstrates additional styling options available in the migrated Card component with visual enhancements.</Text>
                          <Badge color="blue" className="mt-2">Enhanced Style</Badge>
                        </div>
                      </Card>
                    </div>
                  </div>

                  <Divider />

                  {/* Badges */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">Badges</h4>
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge>Default Badge</Badge>
                        <Badge variant="light">Light Badge</Badge>
                        <Badge variant="filled">Filled Badge</Badge>
                        <Badge variant="dot">Dot Badge</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge size="xs">Extra Small</Badge>
                        <Badge size="sm">Small Badge</Badge>
                        <Badge size="md">Medium Badge</Badge>
                        <Badge size="lg">Large Badge</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge color="blue">Blue Badge</Badge>
                        <Badge color="green">Green Badge</Badge>
                        <Badge color="red">Red Badge</Badge>
                        <Badge color="yellow">Yellow Badge</Badge>
                      </div>
                    </div>
                  </div>

                  <Divider />

                  {/* Form Inputs */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4">Form Inputs</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <TextInput label="Email" placeholder="your@email.com" size="sm" />
                        <TextInput label="Name" placeholder="John Doe" size="md" />
                        <TextInput label="Address" placeholder="123 Main St" size="lg" />
                      </div>
                      <div className="space-y-4">
                        <Select
                          label="Size"
                          placeholder="Pick one"
                          data={['Extra Small', 'Small', 'Medium', 'Large', 'Extra Large']}
                          size="sm"
                        />
                        <ColorInput label="Favorite Color" placeholder="Pick color" size="md" />
                      </div>
                    </div>
                  </div>

                  <Divider />

                  {/* Migration Status */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Migration Status</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">101</div>
                        <div className="text-blue-700 dark:text-blue-300">Button files migrated</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">3</div>
                        <div className="text-blue-700 dark:text-blue-300">Card files migrated</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">171</div>
                        <div className="text-blue-700 dark:text-blue-300">Card files remaining</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">1</div>
                        <div className="text-blue-700 dark:text-blue-300">Theme settings page</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsPanel>
        </Tabs>   {/* Action Buttons */}
        <div className="flex justify-between items-center pt-6 border-t">
          <div className="flex items-center gap-4">
            {hasUnsavedChanges && (
              <Badge variant="outline" color="orange">
                Unsaved Changes
              </Badge>
            )}
              <Button
                variant="light"
                leftSection={<RefreshCw className="w-4 h-4" />}
                onClick={handleReset}
                disabled={isLoading}
              >
                Reset to Defaults
              </Button>
            </div>

            <Button
              leftSection={<Save className="w-4 h-4" />}
              onClick={handleSaveTheme}
              loading={isLoading}
              disabled={!hasUnsavedChanges}
            >
              Save Theme Settings
            </Button>
          </div>

          {/* Info Section */}
          <Card withBorder padding="lg" radius="md">
            <div className="flex items-start gap-3">
              <div className="h-3 w-3 rounded-full bg-blue-500 mt-2"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Platform-Wide Theme Settings
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                  Changes made here will apply to all users across the entire platform. Theme updates may take a few minutes to propagate to all users.
                  In a production environment, these settings would be stored in your database and loaded dynamically.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}
