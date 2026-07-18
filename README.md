# WebSpatial Damage Dashboard

A WebSpatial app scaffold for damage visualization and reasoning, built with React + Vite + [@webspatial/react-sdk](https://github.com/webspatial/webspatial-sdk).

---

## Video



https://github.com/user-attachments/assets/c1faa1cc-c084-42c8-b12f-543c52b22a83



---

## What it does

| Mode | Behavior |
|---|---|
| **PICO emulator / PICO OS 6** | Two floating transparent panels: dashboard plus detail panel |
| **Desktop browser** | Single-page dashboard with inline detail panel |

- **Damage dashboard scaffold** — category toggles and dot grid ready for later data
- **WebSpatial panel support** — retains PICO/spatial scene setup

---

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- For XR: the [PICO emulator](https://developer.picovr.com/docs/en/emulator) (Android-based) + ADB

---

## 1. Get your ElevenLabs API key

1. Sign up or log in at [elevenlabs.io](https://elevenlabs.io)
2. Click your profile icon (bottom-left) → **Profile**
3. Scroll to **API Keys** → **Create API key**
4. Copy the key — it starts with `sk_`

---

## 2. Install & configure

```bash
git clone git@github.com:nigelhartman/webspatial_voice_sample.git
cd webspatial_voice_sample

npm install

# Copy the example env file and add your key
cp .env.example .env
```

Open `.env` and replace the placeholder:

```
VITE_ELEVENLABS_API_KEY=sk_your_actual_key_here
```

---

## 3. Run in the desktop browser

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. You'll see the mic panel and transcript history side-by-side on a dark background.

---

## 4. Run in the PICO emulator

### 4a. Start the dev server (expose on all IPs)

The Vite config already sets `server.host: true`, so just run:

```bash
npm run dev
```

Note the port Vite reports — usually `5173`.

### 4b. Set up ADB port forwarding

Run this **every time** you (re)start the emulator, replacing `5173` with the actual port:

```bash
adb reverse tcp:5173 tcp:5173
```

This tunnels the emulator's requests back to your machine's dev server. Without it the emulator can't reach localhost.

### 4c. Open in PICO Browser

1. Launch the PICO emulator
2. Open the **PICO Browser**
3. Navigate to:
   ```
   http://10.0.2.2:5173/
   ```
   (`10.0.2.2` is the host machine's loopback address inside the Android emulator)
4. Tap **"Run as a standalone app"** in the address bar

The app now runs as a WebSpatial standalone app with two transparent floating panels.

### PWA requirements (if the "Run as standalone app" button is missing)

The button only appears when the page passes PWA installability checks. Verify:

- `public/manifest.json` exists and declares at least a 192×192 icon
- Icon PNG files are actually present in `public/`
- `index.html` contains `<link rel="manifest" href="/manifest.json" />`
- ADB port forwarding is active (step 4b)

---

## 5. Build for production

```bash
npm run build
```

Output goes to `dist/`. Serve it with any static host.
