"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { MantineProvider, createTheme, Button, TextInput, Card, Badge } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
// import { SpotlightProvider } from "@mantine/spotlight"; // Spotlight not available

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

// Custom Mantine theme matching platform design
const theme = createTheme({
  // Color palette matching platform
  colors: {
    blue: [
      '#e7f3ff', // 0 - lightest blue
      '#d1e7ff', // 1
      '#a3d1ff', // 2
      '#5ba6ff', // 3
      '#1c7eff', // 4
      '#0066ff', // 5 - primary blue
      '#0052cc', // 6
      '#004299', // 7
      '#003366', // 8
      '#002233', // 9 - darkest blue
    ],
    green: [
      '#e8f9f0',
      '#d1f2e0',
      '#a3e6b8',
      '#6fd58a',
      '#3bc65c',
      '#0caf50',
      '#0a8f42',
      '#077134',
      '#055626',
      '#033914',
    ],
    red: [
      '#ffe8e7',
      '#ffd1d0',
      '#ffa3a1',
      '#ff6f6c',
      '#ff3b37',
      '#ff0703',
      '#cc0501',
      '#990401',
      '#660301',
      '#330201',
    ],
    yellow: [
      '#fffce7',
      '#fff9d1',
      '#fff2a3',
      '#ffeb6f',
      '#ffe43b',
      '#ffdd07',
      '#ccae05',
      '#998204',
      '#665703',
      '#332b02',
    ],
  },

  // Primary and semantic colors
  primaryColor: 'blue',
  primaryShade: 5,

  // Typography
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontFamilyMonospace: 'JetBrains Mono, "Fira Code", monospace',

  // Border radius
  defaultRadius: 'md', // 6px

  // Spacing scale
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },

  // Component-specific overrides
  components: {
    Button: Button.extend({
      defaultProps: {
        radius: 'md',
        // Remove size constraint to allow natural width
      },
      styles: {
        root: {
          fontWeight: 500,
          transition: 'all 0.2s ease',
          // Allow natural width by not setting min-width or width constraints
        },
      },
    }),

    TextInput: TextInput.extend({
      defaultProps: {
        size: 'md',
        radius: 'md',
      },
    }),

    Card: Card.extend({
      defaultProps: {
        radius: 'md',
        withBorder: true,
      },
      styles: {
        root: {
          transition: 'box-shadow 0.2s ease',
        },
      },
    }),

    Badge: Badge.extend({
      defaultProps: {
        size: 'md',
        radius: 'md',
      },
    }),
  },
});

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <MantineProvider theme={theme}>
        <ModalsProvider>
          <Notifications position="top-right" />
          {children}
        </ModalsProvider>
      </MantineProvider>
    </NextThemesProvider>
  );
}
