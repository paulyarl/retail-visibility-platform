// This file configures the initialization of Sentry on the client.
// It is the single source of truth for client-side Sentry config.
// The legacy sentry.client.config.ts has been removed to avoid duplicate initialization.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Completely disable Sentry in development to avoid noise and quota usage
if (process.env.NODE_ENV !== "development" && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Add optional integrations for additional features
    integrations: [Sentry.replayIntegration()],

    // 10% performance sampling — match server/edge configs
    tracesSampleRate: 0.1,

    // Capture Replay for 10% of all sessions, 100% of sessions with an error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Use custom environment variable to distinguish staging from production
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,

    // Disable sending user PII by default — opt-in via explicit consent
    sendDefaultPii: false,

    // Ignore common noise errors
    ignoreErrors: [
      // Browser extensions
      "top.GLOBALS",
      "originalCreateNotification",
      "canvas.contentDocument",
      "MyApp_RemoveAllHighlights",
      // Network errors
      "NetworkError",
      "Network request failed",
      // ResizeObserver errors (harmless)
      "ResizeObserver loop limit exceeded",
    ],

    beforeSend(event, hint) {
      // Filter out errors from browser extensions
      if (event.exception) {
        const error = hint.originalException;
        if (error && typeof error === "object" && "message" in error) {
          const message = String(error.message);
          if (
            message.includes("chrome-extension://") ||
            message.includes("moz-extension://")
          ) {
            return null;
          }
        }
      }
      return event;
    },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
