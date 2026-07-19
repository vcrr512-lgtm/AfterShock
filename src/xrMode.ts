/**
 * Detects whether the app is running as an installed PWA / WebSpatial app
 * (standalone mode) versus a regular desktop browser tab.
 *
 * When running in standalone mode, we:
 *   - Add the `is-spatial` class to <html> so WebSpatial CSS applies
 *   - Open a secondary spatial scene for detail content
 *
 * When running in a regular browser, we render a desktop dashboard layout.
 */
export const isXRMode = window.matchMedia("(display-mode: standalone)").matches;
