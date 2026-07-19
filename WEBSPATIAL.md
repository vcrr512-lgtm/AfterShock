WebSpatial Developer Cheat Sheet

WebSpatial is a set of spatial APIs built on top of the mainstream web ecosystem (HTML/CSS/JS) to bring spatial capabilities to web apps while maintaining cross-platform compatibility. The current WebSpatial SDK provides out-of-the-box support for React projects.

---

## Platform Targets

There are two ways to run a WebSpatial app. They have different setup requirements:

| | **PICO OS 6 / PICO Emulator** | **Apple Vision Pro / visionOS** |
|---|---|---|
| Packaging | None needed — open URL directly | Requires `@webspatial/builder` + Xcode |
| XR_ENV variable | Not needed | Required (`XR_ENV=avp`) |
| Vite plugin | Not needed | `@webspatial/vite-plugin` + `vite-plugin-html` |
| Dev server URL | `http://10.0.2.2:PORT/` | `http://localhost:PORT/webspatial/avp` |

---

## 1. Project Setup & Configuration (PICO Emulator — Simplified)

For PICO OS 6 and the PICO emulator, no packaging step is needed. You open the URL directly in the PICO Browser and click **"Run as a standalone app"** in the address bar.

### Dependencies (minimal — no builder or platform packages needed)

```bash
npm install --save @webspatial/react-sdk @webspatial/core-sdk
npm install --save-dev @webspatial/vite-plugin  # only if also targeting visionOS
```

### TypeScript Config (`tsconfig.app.json`)

The only required change — set the JSX import source to the WebSpatial SDK:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@webspatial/react-sdk"
  }
}
```

No `XR_ENV`, no Vite plugin, no HTML injection needed for PICO.

### Vite Config (`vite.config.ts`)

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Required: expose on all IPs so PICO emulator can reach via 10.0.2.2
    host: true,
  },
});
```

### Development Workflow (PICO emulator)

1. Start the dev server:
   ```bash
   npm run dev
   ```
2. Install the PICO emulator (Android-based).
3. **Set up ADB port forwarding** so the emulator can reach your host machine's dev server:
   ```bash
   adb reverse tcp:5173 tcp:5173
   ```
   Replace `5173` with whatever port Vite is actually using. Run this every time you (re)start the emulator. Without it, the emulator cannot connect to your local dev server.
4. In the PICO emulator, open the PICO Browser and navigate to:
   ```
   http://10.0.2.2:5173/
   ```
   (Use the default IP `10.0.2.2` — this is the host machine's loopback address inside the Android emulator. HTTP is allowed for this address without any extra config.)
5. Click **"Run as a standalone app"** in the browser address bar. The site now runs as a Web App with WebSpatial enabled.

### PWA Requirements — "Run as standalone app" button

The PICO Browser only shows the **"Run as standalone app"** button when the page passes PWA installability checks. If the button is missing, verify all of the following:

1. **Icons with real PNG files** — the manifest must declare at least a 192×192 icon and the files must actually exist and be served. An empty `"icons": []` or missing files will silently block installation.
   ```json
   "icons": [
     { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
     { "src": "/icon-512.png",  "sizes": "512x512",  "type": "image/png", "purpose": "any" },
     { "src": "/icon-1024-maskable.png", "sizes": "1024x1024", "type": "image/png", "purpose": "maskable" }
   ]
   ```

2. **`"scope"` field** — must be present in the manifest (e.g. `"scope": "/"`).

3. **Manifest filename** — use `manifest.json`. While `.webmanifest` is technically valid, `manifest.json` is safer and avoids potential MIME-type issues.

4. **`<link rel="manifest">` in HTML** — must point to the correct file:
   ```html
   <link rel="manifest" href="/manifest.json" />
   ```

5. **ADB port forwarding** — must be set up before opening the URL (see step 3 above).

---

## 2. Project Setup & Configuration (visionOS — Full)

For visionOS you still need the full setup with the builder and two dev servers.

### Dependencies

```bash
npm install --save @webspatial/react-sdk @webspatial/core-sdk @google/model-viewer three
npm install --save-dev @webspatial/builder @webspatial/platform-visionos @webspatial/vite-plugin vite-plugin-html
```

### TypeScript Config (`tsconfig.app.json` / `tsconfig.node.json`)

```json
{
  "compilerOptions": {
    "jsxImportSource": "@webspatial/react-sdk"
  }
}
```

### Vite Config (`vite.config.ts`)

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import webSpatial from "@webspatial/vite-plugin";
import { createHtmlPlugin } from "vite-plugin-html";

export default defineConfig({
  plugins: [
    react(),
    webSpatial(),
    createHtmlPlugin({
      inject: {
        data: {
          XR_ENV: process.env.XR_ENV,
        },
      },
    }),
  ],
});
```

### Development & Packaging Commands

Run the dev server for standard browsers:
```bash
npm run dev
```

Run a second dev server that generates WebSpatial-specific output:
```bash
XR_ENV=avp npm run dev
```

Package and run in the visionOS simulator:
```bash
npx webspatial-builder run --base=http://localhost:5175/webspatial/avp
```

---

## 3. Spatializing HTML Elements

To use spatial APIs on an HTML element, mark it as "spatialized". Three equivalent ways:

```html
<!-- HTML attribute -->
<div enable-xr>

<!-- Class name -->
<div className="__enableXr__">

<!-- Inline style -->
<div style={{ enableXr: true }}>
```

These markers are cross-platform safe — they fall back to standard HTML in regular browsers.

---

## 4. WebSpatial CSS APIs

Once an element is spatialized, WebSpatial-specific CSS properties become available.

### Material Backgrounds

Property: `--xr-background-material`

| Value | Effect |
|---|---|
| `none` | Fallback to default webpage background |
| `transparent` | Fully transparent — elements float (default for spatialized elements) |
| `translucent` | Default translucent material |
| `regular` | Standard material |
| `thick` | Thicker material variation |
| `thin` | Thinner material variation |

To make an entire Window Scene fully transparent (visionOS — use `XR_ENV` conditional in HTML):
```html
<%- XR_ENV === 'avp' ? `<html lang="en" class="is-spatial">` : `<html lang="en">` %>
```

For PICO-only apps you can set `is-spatial` unconditionally in `index.html`:
```html
<html lang="en" class="is-spatial">
```

```css
html.is-spatial {
  background-color: transparent;
  --xr-background-material: transparent;
}
```

### Elevating Elements (Z-Axis)

**Using `--xr-back`:**
The element must use `position: relative`, `absolute`, or `fixed`. The value is a unit-less integer (physical pt along the Z-axis).

```css
.elevated-card {
  position: relative;
  --xr-back: 50;
}
```

**Using CSS Transforms:**
Spatialized elements support real 3D CSS transforms:
- `translateZ()`, `translate3d()` — Z-axis displacement
- `rotateX()`, `rotateY()`, `rotate3d()` — 3D rotation
- `scaleZ()`, `scale3d()` — Z-axis scaling

### Stacking Order

Use `--xr-z-index` (integer) to control overlap between spatialized elements on the same plane when standard `z-index` does not apply.

### Dynamic Layout Monitoring

If a spatialized element's X/Y position changes dynamically (e.g., a sibling unmounts), add `enable-xr-monitor` to a parent container:

```jsx
<div enable-xr-monitor>
  {showCard && <div>First Card</div>}
  <div enable-xr>Second Card</div>
</div>
```

---

## 5. Interaction

- **Hover Effects**: During eye-gaze (selection phase), no JS events fire — the OS handles highlighting natively.
- **Interaction Regions**: To enable the system hover effect, elements must be native interactive elements (`<button>`, `<a>`, `<input>`) or have `cursor: pointer` set in CSS.

---

## 6. Scene Management

A WebSpatial app consists of multiple Scenes managed as standard web window containers.

### The Start Scene

Configured via the Web App Manifest (`manifest.webmanifest`):

```json
{
  "start_url": "/",
  "xr_main_scene": {
    "default_size": {
      "width": 500,
      "height": 1000
    }
  }
}
```

### Opening New Scenes

Use standard DOM APIs (`window.open` or `<a target="_blank">`). Give the scene a specific target name to manage it programmatically.

### Initializing Scene Properties

**From the parent window (before opening):**

```javascript
import { initScene } from "@webspatial/react-sdk";

initScene("secondSceneName", (prevConfig) => ({
  ...prevConfig,
  defaultSize: { width: 900, height: 700 },
}));
window.open("/second-page", "secondSceneName");
```

**From the child window (on load):**

```javascript
window.xrCurrentSceneDefaults = async (defaultConfig) => {
  return {
    ...defaultConfig,
    defaultSize: { width: 800, height: 600 },
  };
};
```
