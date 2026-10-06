// Visitor analytics are disabled for the public service launch.
// Keep the call contract used by the existing product components.
export const trackEvent = (_name: string, _parameters: Record<string, string | number | boolean | undefined> = {}) => {};
