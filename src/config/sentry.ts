import * as Sentry from "@sentry/node";

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || "development";

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
    integrations: [Sentry.expressIntegration()],
    sendDefaultPii: true,
  });
}
