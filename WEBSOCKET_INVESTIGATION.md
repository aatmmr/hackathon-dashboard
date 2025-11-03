# WebSocket Shared Sessions Investigation

## Problem Statement
Investigate required additions to allow shared sessions via WebSocket in the Hackathon Dashboard.

## Current State Analysis

### Architecture
- **Frontend**: Vite + React static site
- **Deployment**: GitHub Pages (static hosting)
- **State Management**: localStorage-based persistence
- **Data**: Teams data and countdown timer state

### Limitations
1. GitHub Pages only serves static content - cannot host WebSocket servers
2. All state is currently isolated per browser/device
3. No real-time synchronization between users

## Proposed Solution

### Architecture Overview
To enable shared sessions via WebSocket, we need:

1. **WebSocket Server (External)**
   - Must be hosted separately (not on GitHub Pages)
   - Options: Heroku, Railway, Render, AWS, Azure, or self-hosted
   - Responsible for broadcasting state changes to all connected clients

2. **WebSocket Client (Frontend)**
   - Connect to external WebSocket server
   - Send local state changes to server
   - Receive and apply state changes from other clients
   - Handle connection/disconnection gracefully

3. **Session Management**
   - Generate/join session IDs
   - Allow multiple users to share the same session
   - Persist session ID in URL or localStorage

### Required Components

#### 1. WebSocket Server (`server/`)
**File**: `server/websocket-server.js`
- Node.js WebSocket server using `ws` library
- Session-based room management
- Broadcast messages to all clients in a session
- Handle connection lifecycle

**Dependencies**:
- `ws`: WebSocket library for Node.js
- `express` (optional): For health checks and management endpoints

#### 2. WebSocket Client Hook (`src/hooks/`)
**File**: `src/hooks/useWebSocket.js`
- Custom React hook for WebSocket connection
- Auto-reconnection logic
- Message queuing during disconnection
- Event handlers for connection status

#### 3. Shared State Manager (`src/hooks/`)
**File**: `src/hooks/useSharedState.js`
- Extends existing `useKV` hook
- Syncs state changes via WebSocket
- Conflict resolution (last-write-wins or operational transformation)
- Fallback to localStorage when offline

#### 4. Session Manager (`src/utils/`)
**File**: `src/utils/sessionManager.js`
- Generate unique session IDs
- Parse session ID from URL
- Store session ID in localStorage
- Provide join/create session functionality

#### 5. Connection Status UI (`src/components/`)
**File**: `src/components/ConnectionStatus.jsx`
- Display connection status (connected/disconnected/reconnecting)
- Show active users count
- Allow session ID sharing

### Implementation Details

#### WebSocket Message Protocol
```json
{
  "type": "update" | "sync" | "join" | "leave",
  "sessionId": "unique-session-id",
  "key": "hackathon-teams" | "timer-state",
  "value": { /* data */ },
  "timestamp": 1234567890,
  "clientId": "unique-client-id"
}
```

#### State Synchronization Strategy
1. **Optimistic Updates**: Apply local changes immediately
2. **Broadcast**: Send changes to WebSocket server
3. **Merge**: Receive and merge remote changes
4. **Conflict Resolution**: Last-write-wins based on timestamp

#### Configuration
**File**: `src/config/websocket.config.js`
```javascript
export const WEBSOCKET_CONFIG = {
  url: process.env.VITE_WEBSOCKET_URL || 'ws://localhost:8080',
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000
};
```

### Deployment Considerations

#### Server Deployment Options
1. **Railway** (Recommended for simplicity)
   - Free tier available
   - Easy deployment from GitHub
   - Automatic HTTPS/WSS

2. **Render**
   - Free tier with limitations
   - Good for WebSocket servers

3. **Heroku**
   - Requires paid dyno for WebSocket support

4. **Self-hosted**
   - Full control
   - Requires maintenance

#### Environment Variables
- `VITE_WEBSOCKET_URL`: WebSocket server URL (wss://your-server.com)
- `VITE_DEFAULT_SESSION_ID`: Optional default session for testing

### Security Considerations

1. **Session ID Security**
   - Use cryptographically secure random IDs
   - Avoid exposing sensitive data in session IDs

2. **Message Validation**
   - Validate all incoming messages
   - Sanitize data before applying to state

3. **Rate Limiting**
   - Implement on server to prevent abuse
   - Limit message frequency per client

4. **Authentication** (Future Enhancement)
   - Add user authentication
   - Session ownership and permissions

### Testing Strategy

1. **Unit Tests**
   - WebSocket hook connection/disconnection
   - Message serialization/deserialization
   - State merge logic

2. **Integration Tests**
   - Multi-client synchronization
   - Connection recovery
   - Session joining/leaving

3. **Manual Testing**
   - Open multiple browser windows
   - Verify real-time synchronization
   - Test offline/online transitions

### Migration Path

#### Phase 1: Infrastructure Setup
- Set up WebSocket server
- Deploy to hosting platform
- Test basic connectivity

#### Phase 2: Client Integration
- Implement WebSocket hooks
- Add connection status UI
- Test with localStorage fallback

#### Phase 3: State Synchronization
- Integrate with existing state management
- Implement conflict resolution
- Test multi-client scenarios

#### Phase 4: Session Management
- Add session creation/joining UI
- URL-based session sharing
- Session persistence

### File Structure
```
hackathon-dashboard/
├── server/
│   ├── package.json
│   ├── websocket-server.js
│   ├── sessionManager.js
│   └── README.md
├── src/
│   ├── components/
│   │   └── ConnectionStatus.jsx
│   ├── hooks/
│   │   ├── useWebSocket.js
│   │   └── useSharedState.js
│   ├── utils/
│   │   └── sessionManager.js
│   └── config/
│       └── websocket.config.js
└── WEBSOCKET_SETUP.md
```

### Estimated Changes

#### New Files
- `server/package.json` (WebSocket server dependencies)
- `server/websocket-server.js` (~200 lines)
- `server/sessionManager.js` (~100 lines)
- `src/hooks/useWebSocket.js` (~150 lines)
- `src/hooks/useSharedState.js` (~100 lines)
- `src/utils/sessionManager.js` (~80 lines)
- `src/components/ConnectionStatus.jsx` (~100 lines)
- `src/config/websocket.config.js` (~20 lines)
- `WEBSOCKET_SETUP.md` (deployment documentation)

#### Modified Files
- `src/App.jsx`: Replace `useKV` with `useSharedState`
- `package.json`: Add WebSocket client dependency
- `README.md`: Add WebSocket setup instructions
- `.env.example`: Add WebSocket configuration example

### Dependencies to Add

#### Frontend
```json
{
  "dependencies": {
    "reconnecting-websocket": "^4.4.0" // Auto-reconnecting WebSocket
  }
}
```

#### Server
```json
{
  "dependencies": {
    "ws": "^8.18.0",
    "express": "^4.18.2",
    "uuid": "^9.0.0"
  }
}
```

## Alternatives Considered

### 1. Firebase Realtime Database
- **Pros**: Fully managed, easy integration
- **Cons**: Requires Firebase account, vendor lock-in, potential costs

### 2. Supabase Realtime
- **Pros**: Open source, good free tier
- **Cons**: Additional service dependency, learning curve

### 3. Y.js with WebRTC
- **Pros**: Peer-to-peer, no server needed
- **Cons**: Complex setup, NAT traversal issues

### 4. Socket.io
- **Pros**: Feature-rich, fallback to HTTP polling
- **Cons**: Larger bundle size, more complex than needed

**Recommendation**: Use native WebSocket with `ws` library for simplicity and minimal dependencies.

## Next Steps

1. Review this investigation with stakeholders
2. Decide on WebSocket server hosting strategy
3. Implement core WebSocket infrastructure
4. Add client-side integration
5. Test multi-client synchronization
6. Document setup and deployment process

## Conclusion

Implementing shared sessions via WebSocket is feasible but requires:
- External WebSocket server hosting
- Client-side WebSocket integration
- State synchronization logic
- Session management UI

The solution will enable real-time collaboration while maintaining the static site architecture for the frontend.
