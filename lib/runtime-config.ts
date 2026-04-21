function normalizeBoolean(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function isProductionApp() {
  return process.env.NODE_ENV === "production";
}

export function isLiveFallbackEnabled() {
  if (normalizeBoolean(process.env.ALLOW_LIVE_FALLBACK)) {
    return true;
  }

  return !isProductionApp();
}

export function getDatabaseUnavailableMessage() {
  return "Database connection failed and live fallback is disabled. Set a valid DATABASE_URL for deployment or temporarily enable ALLOW_LIVE_FALLBACK in local development.";
}
