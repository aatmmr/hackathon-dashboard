# WebSocket Shared Sessions - Setup Guide

This guide explains how to set up and deploy shared sessions via WebSocket for the Hackathon Dashboard.

## Overview

The WebSocket implementation consists of two parts:
1. **Frontend**: React app (deployed on GitHub Pages)
2. **Backend**: WebSocket server (deployed separately)

## Prerequisites

- Node.js 18+ installed
- Git installed
- Account on hosting platform (Railway, Render, or Heroku recommended)

## Quick Start

### 1. Set Up WebSocket Server

The WebSocket server needs to be hosted separately from the static frontend.

#### Option A: Deploy to Railway (Recommended)

1. Create account at [railway.app](https://railway.app)
2. Create new project from GitHub repository
3. Add environment variables:
   ```
   PORT=8080
   NODE_ENV=production
   ```
4. Deploy from `server/` directory
5. Copy the WebSocket URL (e.g., `wss://your-app.railway.app`)

#### Option B: Deploy to Render

1. Create account at [render.com](https://render.com)
2. Create new Web Service
3. Select repository and set:
   - Build Command: `cd server && npm install`
   - Start Command: `cd server && npm start`
4. Add environment variable: `PORT=8080`
5. Copy the WebSocket URL

#### Option C: Local Development

For testing and development:

```bash
cd server
npm install
npm start
```

Server will run on `ws://localhost:8080`

### 2. Configure Frontend

#### Development

Create `.env` file in project root:

```bash
VITE_WEBSOCKET_URL=ws://localhost:8080
```

#### Production

Configure GitHub repository secrets or environment variables:

```bash
VITE_WEBSOCKET_URL=wss://your-server.railway.app
```

Update your build/deploy workflow to use this environment variable.

### 3. Build and Deploy

```bash
# Install dependencies
npm install

# Build with WebSocket URL
npm run build

# Deploy to GitHub Pages
# (or your preferred hosting)
```

## Server Setup Details

### Directory Structure

```
server/
├── package.json
├── websocket-server.js
├── sessionManager.js
└── README.md
```

### Server Dependencies

```json
{
  "dependencies": {
    "ws": "^8.18.0"
  }
}
```

Note: Uses Node.js built-in `crypto.randomUUID()` for ID generation.

### Server Implementation

The WebSocket server handles:
- Client connections and disconnections
- Session-based room management
- Broadcasting messages to all clients in a session
- Heartbeat/keepalive for connection health

### Server API

#### WebSocket Messages

**Client → Server:**

```json
{
  "type": "join",
  "sessionId": "abc123"
}
```

```json
{
  "type": "update",
  "sessionId": "abc123",
  "key": "hackathon-teams",
  "value": [...teams data...],
  "timestamp": 1234567890
}
```

**Server → Client:**

```json
{
  "type": "sync",
  "key": "hackathon-teams",
  "value": [...teams data...],
  "timestamp": 1234567890,
  "clientId": "xyz789"
}
```

```json
{
  "type": "connected",
  "clientId": "xyz789",
  "sessionId": "abc123",
  "activeClients": 3
}
```

## Frontend Integration

### WebSocket Hook

The `useWebSocket` hook provides:
- Automatic connection management
- Auto-reconnection with exponential backoff
- Message queuing during disconnection
- Connection status callbacks

### Shared State Hook

The `useSharedState` hook extends `useKV` to:
- Sync state changes via WebSocket
- Apply remote changes from other clients
- Fallback to localStorage when offline
- Handle conflict resolution

### Connection Status Component

Shows:
- Current connection status (online/offline/reconnecting)
- Number of active users in session
- Session ID for sharing
- Controls to join/create sessions

## Session Management

### Creating a Session

1. Open the app
2. A random session ID is generated automatically
3. Share the URL with others to join the same session

### Joining a Session

1. Open shared URL with session ID parameter
2. Automatically connects to that session
3. Real-time sync with other users in the session

### Session URL Format

```
https://your-dashboard.github.io/?session=abc123def456
```

## Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_WEBSOCKET_URL` | WebSocket server URL | `wss://server.railway.app` |
| `VITE_DEFAULT_SESSION_ID` | Default session for testing | `dev-session` |
| `VITE_ENABLE_WEBSOCKET` | Enable/disable WebSocket | `true` |

### Client Configuration

Edit `src/config/websocket.config.js`:

```javascript
export const WEBSOCKET_CONFIG = {
  url: import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:8080',
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000,
  enableLogging: import.meta.env.DEV
};
```

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to WebSocket server

**Solutions**:
1. Verify `VITE_WEBSOCKET_URL` is set correctly
2. Check server is running and accessible
3. Ensure firewall allows WebSocket connections
4. Try using `wss://` (secure) instead of `ws://`

### Sync Issues

**Problem**: Changes not syncing between clients

**Solutions**:
1. Check all clients are in the same session
2. Verify WebSocket connection status
3. Check browser console for errors
4. Ensure server is broadcasting messages correctly

### Server Issues

**Problem**: Server crashes or disconnects

**Solutions**:
1. Check server logs for errors
2. Verify hosting platform resources
3. Increase server timeout settings
4. Implement better error handling

## Performance Optimization

### Throttling Updates

For high-frequency updates (like timer):

```javascript
const throttledUpdate = useCallback(
  throttle((value) => {
    sendWebSocketMessage({ type: 'update', key, value });
  }, 1000),
  []
);
```

### Message Compression

For large state objects:

```javascript
import pako from 'pako';

// Compress before sending
const compressed = pako.deflate(JSON.stringify(data));

// Decompress on receive
const decompressed = JSON.parse(pako.inflate(compressed, { to: 'string' }));
```

## Security Considerations

### Current Implementation

- No authentication required
- Anyone with session ID can join
- Session IDs are cryptographically random
- No encryption beyond WSS

### Recommended Enhancements

1. **Add Authentication**
   - Require user login
   - Validate tokens on server

2. **Session Permissions**
   - Read-only vs read-write access
   - Admin controls

3. **Rate Limiting**
   - Limit messages per client
   - Prevent spam/abuse

4. **Data Validation**
   - Validate all incoming messages
   - Sanitize user input

## Monitoring

### Server Monitoring

Track:
- Active connections count
- Messages per second
- Error rate
- Memory usage

### Client Monitoring

Track:
- Connection uptime
- Reconnection attempts
- Message latency
- Sync conflicts

## Cost Estimation

### Free Tier Options

| Platform | WebSocket Support | Limitations |
|----------|-------------------|-------------|
| Railway | Yes | 500 hours/month |
| Render | Yes | 750 hours/month |
| Heroku | Limited | Eco dynos sleep |
| Fly.io | Yes | 3 shared VMs |

### Paid Options

- Railway: $5/month (no sleep)
- Render: $7/month (no sleep)
- Heroku: $7/month (no sleep)

## Testing

### Local Testing

1. Start server: `cd server && npm start`
2. Set env: `VITE_WEBSOCKET_URL=ws://localhost:8080`
3. Run app: `npm run dev`
4. Open multiple browser windows
5. Verify synchronization

### Production Testing

1. Deploy server to hosting platform
2. Update `VITE_WEBSOCKET_URL` to production URL
3. Deploy frontend
4. Test with multiple devices
5. Verify across different networks

## Maintenance

### Server Updates

```bash
cd server
npm update
npm audit fix
git commit -am "Update server dependencies"
git push
```

### Monitoring Logs

Check hosting platform dashboard for:
- Connection logs
- Error logs
- Performance metrics

### Backup Strategy

- Session data is ephemeral (not persisted)
- Each client maintains localStorage backup
- No server-side persistence needed

## Future Enhancements

1. **Persistent Sessions**
   - Store session data in database
   - Recover state after server restart

2. **User Authentication**
   - Login system
   - Session ownership

3. **Access Control**
   - Read-only participants
   - Admin permissions

4. **Message History**
   - Replay recent changes for new joiners
   - Undo/redo functionality

5. **Presence Indicators**
   - Show who's online
   - Cursor positions
   - Active editing indicators

## Support

For issues or questions:
1. Check server logs
2. Review browser console
3. Open GitHub issue
4. Contact repository maintainers

## References

- [WebSocket API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [ws - WebSocket library](https://github.com/websockets/ws)
- [Railway Deployment Docs](https://docs.railway.app/)
- [Render Deployment Docs](https://render.com/docs)
