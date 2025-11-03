# Hackathon Dashboard

This is a React project scaffolded with Vite, intended for static deployment on GitHub Pages.

## Features

- **Team Management**: Add, edit, and delete hackathon teams
- **Countdown Timer**: Track hackathon time remaining
- **Shared Sessions** (Optional): Real-time collaboration via WebSocket
- **Offline Support**: Works without WebSocket using localStorage

## Getting Started

1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the development server:
   ```sh
   npm run dev
   ```
3. Build for production:
   ```sh
   npm run build
   ```
4. Preview the production build:
   ```sh
   npm run preview
   ```

## WebSocket Shared Sessions (Optional)

This application supports real-time collaboration through WebSocket connections. Multiple users can share the same session and see updates in real-time.

### Setup

1. **Copy environment file:**
   ```sh
   cp .env.example .env
   ```

2. **For local development:**
   - Start the WebSocket server:
     ```sh
     cd server
     npm install
     npm start
     ```
   - The server runs on `ws://localhost:8080` by default

3. **For production:**
   - Deploy the WebSocket server to Railway, Render, or your preferred platform
   - Set `VITE_WEBSOCKET_URL` to your server URL (e.g., `wss://your-server.railway.app`)
   - See [WEBSOCKET_SETUP.md](./WEBSOCKET_SETUP.md) for detailed deployment instructions

### Using Shared Sessions

- Open the app and a session ID will be automatically generated
- Share the URL with others to collaborate in the same session
- Changes are synchronized in real-time across all connected clients
- The connection status indicator shows in the bottom-right corner

### Disabling WebSocket

To use the app without WebSocket (localStorage only):
```sh
# In .env file
VITE_ENABLE_WEBSOCKET=false
```

For more details, see:
- [WEBSOCKET_INVESTIGATION.md](./WEBSOCKET_INVESTIGATION.md) - Technical investigation and architecture
- [WEBSOCKET_SETUP.md](./WEBSOCKET_SETUP.md) - Setup and deployment guide

## Deploying to GitHub Pages

- After building, deploy the contents of the `dist/` folder to your `gh-pages` branch or configure GitHub Pages to serve from `/docs` or `/dist`.
- You may use the `gh-pages` npm package for automated deployment.
- **Note**: GitHub Pages only hosts the frontend. The WebSocket server must be deployed separately if you want shared sessions.

## Project Structure

- `public/` — Static assets
- `src/` — React components and `.jsx` files
  - `components/` — Reusable UI components (including ConnectionStatus)
  - `hooks/` — Custom React hooks (useWebSocket, useSharedState)
  - `utils/` — Utility functions (sessionManager)
  - `config/` — Configuration files (websocket.config.js)
- `server/` — WebSocket server for shared sessions
- `.github/` — Copilot and GitHub configuration

---

For more details, see the Vite and GitHub Pages documentation.
