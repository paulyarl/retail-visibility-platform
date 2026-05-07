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

// Simple default theme
const defaultTheme = createTheme({
  defaultRadius: 'md',
  primaryColor: 'blue',
});

export function PlatformThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<PlatformTheme | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    
    const loadTheme = async () => {
      try {
        const settings = await platformSettingsService.getPlatformSettings();
        if (!cancelled && settings) {
          setTheme({
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
          });
        }
      } catch (error) {
        console.error('Failed to load platform theme:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadTheme();
    
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshTheme = async () => {
    setIsLoading(true);
    try {
      const settings = await platformSettingsService.getPlatformSettings();
      if (settings) {
        setTheme({
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
        });
      }
    } catch (error) {
      console.error('Failed to refresh theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Use default theme while loading or if no theme set
  const mantineTheme = theme ? defaultTheme : defaultTheme;

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
