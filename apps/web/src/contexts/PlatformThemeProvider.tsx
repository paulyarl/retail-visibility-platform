"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { MantineProvider, createTheme } from '@mantine/core';
import { platformSettingsService } from '@/services/PlatformSettingsSingletonService';

interface PlatformTheme {
  preset: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    neutral: string;
  };
  fontFamily: string;
  borderRadius: string;
  buttonSize: string;
  spacing: number;
}

interface PlatformThemeContextType {
  theme: PlatformTheme | null;
  isLoading: boolean;
  refreshTheme: () => Promise<void>;
}

const PlatformThemeContext = createContext<PlatformThemeContextType | undefined>(undefined);

export function PlatformThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<PlatformTheme | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadTheme = async () => {
    try {
      // Use the singleton service instead of direct fetch to leverage caching
      const settings = await platformSettingsService.getPlatformSettings();
      const platformTheme: PlatformTheme = {
        preset: settings.themePreset || 'default',
        colors: settings.themeColors || {
          primary: '#0066ff',
          secondary: '#6fd58a',
          accent: '#ffdd07',
          neutral: '#64748b'
        },
        fontFamily: settings.themeFontFamily || 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        borderRadius: settings.themeBorderRadius || 'md',
        buttonSize: settings.themeButtonSize || 'sm',
        spacing: settings.themeSpacing || 16,
      };
      setTheme(platformTheme);
    } catch (error) {
      console.error('Failed to load platform theme:', error);
      // Use defaults if API fails
      setTheme({
        preset: 'default',
        colors: {
          primary: '#0066ff',
          secondary: '#6fd58a',
          accent: '#ffdd07',
          neutral: '#64748b'
        },
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        borderRadius: 'md',
        buttonSize: 'sm',
        spacing: 16,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTheme = async () => {
    setIsLoading(true);
    await loadTheme();
  };

  useEffect(() => {
    loadTheme();
  }, []);

  // Create Mantine theme based on platform settings
  const mantineTheme = theme ? createTheme({
    fontFamily: theme.fontFamily,
    defaultRadius: theme.borderRadius as any,
    spacing: {
      xs: `${theme.spacing * 0.25}px`,
      sm: `${theme.spacing * 0.5}px`,
      md: `${theme.spacing}px`,
      lg: `${theme.spacing * 1.5}px`,
      xl: `${theme.spacing * 2}px`,
    },
    colors: {
      primary: [
        theme.colors.primary,
        theme.colors.primary,
        theme.colors.primary,
        theme.colors.primary,
        theme.colors.primary,
        theme.colors.primary,
        theme.colors.primary,
        theme.colors.primary,
        theme.colors.primary,
        theme.colors.primary,
      ],
      secondary: [
        theme.colors.secondary,
        theme.colors.secondary,
        theme.colors.secondary,
        theme.colors.secondary,
        theme.colors.secondary,
        theme.colors.secondary,
        theme.colors.secondary,
        theme.colors.secondary,
        theme.colors.secondary,
        theme.colors.secondary,
      ],
      accent: [
        theme.colors.accent,
        theme.colors.accent,
        theme.colors.accent,
        theme.colors.accent,
        theme.colors.accent,
        theme.colors.accent,
        theme.colors.accent,
        theme.colors.accent,
        theme.colors.accent,
        theme.colors.accent,
      ],
      neutral: [
        theme.colors.neutral,
        theme.colors.neutral,
        theme.colors.neutral,
        theme.colors.neutral,
        theme.colors.neutral,
        theme.colors.neutral,
        theme.colors.neutral,
        theme.colors.neutral,
        theme.colors.neutral,
        theme.colors.neutral,
      ],
    },
    primaryColor: 'primary',
  }) : createTheme({});

  if (isLoading) {
    return <>{children}</>; // Render children without theme while loading
  }

  return (
    <PlatformThemeContext.Provider value={{ theme, isLoading, refreshTheme }}>
      <MantineProvider theme={mantineTheme}>
        {children}
      </MantineProvider>
    </PlatformThemeContext.Provider>
  );
}

export function usePlatformTheme() {
  const context = useContext(PlatformThemeContext);
  if (context === undefined) {
    throw new Error('usePlatformTheme must be used within a PlatformThemeProvider');
  }
  return context;
}
