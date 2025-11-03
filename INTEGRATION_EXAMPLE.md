# WebSocket Integration Example

This document shows how to integrate WebSocket shared sessions into the Hackathon Dashboard.

## Quick Integration

To enable shared sessions in your App.jsx:

### 1. Import Required Hooks and Components

```javascript
import { getOrCreateSessionId } from './utils/sessionManager';
import { useSharedState } from './hooks/useSharedState';
import { useWebSocket } from './hooks/useWebSocket';
import { ConnectionStatus } from './components/ConnectionStatus';
import WEBSOCKET_CONFIG from './config/websocket.config';
```

### 2. Replace `useKV` with `useSharedState`

**Before:**
```javascript
const [teams, setTeams] = useKV("hackathon-teams", []);
```

**After:**
```javascript
// Get or create session ID
const [sessionId] = React.useState(() => 
  getOrCreateSessionId(WEBSOCKET_CONFIG.defaultSessionId)
);

// Use shared state instead of useKV
const [teams, setTeams, syncStatus] = useSharedState("hackathon-teams", [], sessionId);
```

### 3. Add WebSocket Connection

```javascript
// Get WebSocket connection state
const { 
  isConnected, 
  connectionStatus, 
  activeClients 
} = useWebSocket(sessionId, {
  onMessage: (message) => {
    console.log('WebSocket message:', message);
  },
  onConnected: () => {
    console.log('Connected to session:', sessionId);
  },
  onDisconnected: () => {
    console.log('Disconnected from session');
  }
});
```

### 4. Add Connection Status UI

```javascript
return (
  <div className="app">
    {/* Existing content */}
    <div className="container min-h-[80vh]">
      {/* ... */}
    </div>
    
    {/* Add connection status indicator */}
    <ConnectionStatus
      isConnected={isConnected}
      connectionStatus={connectionStatus}
      activeClients={activeClients}
      sessionId={sessionId}
    />
  </div>
);
```

## Complete Example

Here's a minimal working example:

```javascript
import * as React from "react";
import { getOrCreateSessionId } from './utils/sessionManager';
import { useSharedState } from './hooks/useSharedState';
import { useWebSocket } from './hooks/useWebSocket';
import { ConnectionStatus } from './components/ConnectionStatus';
import WEBSOCKET_CONFIG from './config/websocket.config';

function App() {
  // Initialize session ID
  const [sessionId] = React.useState(() => 
    getOrCreateSessionId(WEBSOCKET_CONFIG.defaultSessionId)
  );

  // Use shared state for teams (replaces useKV)
  const [teams, setTeams, syncStatus] = useSharedState("hackathon-teams", [], sessionId);

  // Get WebSocket connection state
  const { isConnected, connectionStatus, activeClients } = useWebSocket(
    WEBSOCKET_CONFIG.enabled ? sessionId : null,
    {
      onConnected: () => console.log('Connected!'),
      onDisconnected: () => console.log('Disconnected'),
    }
  );

  // Rest of your component logic...
  const addTeam = (teamData) => {
    setTeams([...teams, { ...teamData, id: Date.now() }]);
  };

  return (
    <div className="app">
      <div className="container">
        {/* Your existing UI */}
        <h1>Teams: {teams.length}</h1>
        {/* ... */}
      </div>
      
      {/* Connection status */}
      <ConnectionStatus
        isConnected={isConnected}
        connectionStatus={connectionStatus}
        activeClients={activeClients}
        sessionId={sessionId}
      />
    </div>
  );
}

export default App;
```

## Timer Synchronization Example

To synchronize the countdown timer across clients:

```javascript
function CountdownTimer() {
  const [sessionId] = React.useState(() => getOrCreateSessionId());
  
  // Use shared state for timer
  const [totalSeconds, setTotalSeconds, syncStatus] = useSharedState(
    "timer-seconds", 
    3600, 
    sessionId
  );
  
  const [isRunning, setIsRunning, ] = useSharedState(
    "timer-running", 
    false, 
    sessionId
  );

  // Rest of timer logic...
  React.useEffect(() => {
    let interval;
    if (isRunning && totalSeconds > 0) {
      interval = setInterval(() => {
        setTotalSeconds(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, totalSeconds, setTotalSeconds]);

  return (
    <div>
      <div>{formatTime(totalSeconds)}</div>
      <button onClick={() => setIsRunning(!isRunning)}>
        {isRunning ? 'Pause' : 'Start'}
      </button>
    </div>
  );
}
```

## Migration Strategy

### Phase 1: Add Dependencies (No Breaking Changes)
1. Add WebSocket infrastructure files
2. Keep existing `useKV` hook working
3. Set `VITE_ENABLE_WEBSOCKET=false` by default
4. Deploy and test

### Phase 2: Parallel Implementation (Optional)
1. Add `useSharedState` alongside `useKV`
2. Allow users to opt-in via environment variable
3. Test with small group of users
4. Gather feedback

### Phase 3: Full Migration (Optional)
1. Replace `useKV` with `useSharedState` as default
2. Keep fallback to localStorage when offline
3. Update documentation
4. Deploy

## Testing

### Test Shared Sessions Locally

1. Start WebSocket server:
```bash
cd server
npm start
```

2. Start frontend (in new terminal):
```bash
npm run dev
```

3. Open multiple browser windows:
```
http://localhost:5173/?session=test-session
```

4. Make changes in one window and verify they appear in others

### Test Offline Mode

1. Set `VITE_ENABLE_WEBSOCKET=false`
2. Verify app works with localStorage only
3. Re-enable WebSocket
4. Verify migration works

## Troubleshooting

### Changes Not Syncing

**Check:**
- All clients in same session (check URL)
- WebSocket connection status (green icon)
- Browser console for errors
- Server logs for issues

**Solutions:**
- Refresh page
- Clear localStorage
- Restart WebSocket server
- Check firewall settings

### Connection Issues

**Check:**
- `VITE_WEBSOCKET_URL` is set correctly
- Server is running and accessible
- No firewall blocking WebSocket
- Using correct protocol (ws:// vs wss://)

**Solutions:**
- Test server with wscat: `wscat -c ws://localhost:8080`
- Check server logs
- Verify network connectivity
- Try different browser

## Performance Considerations

### High-Frequency Updates

For rapidly changing state (like timer), consider:

1. **Throttling:**
```javascript
import { throttle } from 'lodash';

const throttledUpdate = React.useMemo(
  () => throttle(setSharedValue, 1000),
  [setSharedValue]
);
```

2. **Local-first updates:**
```javascript
// Update locally immediately
setLocalValue(newValue);

// Broadcast to others (throttled)
throttledBroadcast(newValue);
```

### Large State Objects

For large data structures:

1. **Split state:**
```javascript
// Instead of one large object
const [appState, setAppState] = useSharedState('app-state', {...});

// Split into multiple keys
const [teams, setTeams] = useSharedState('teams', []);
const [timer, setTimer] = useSharedState('timer', {});
```

2. **Update granularly:**
```javascript
// Update only changed team
const updateTeam = (id, changes) => {
  setTeams(teams.map(t => 
    t.id === id ? { ...t, ...changes } : t
  ));
};
```

## Security Notes

- Session IDs are visible in URLs (not secure for sensitive data)
- Anyone with session ID can join and modify state
- No authentication or authorization in current implementation
- For production use, consider adding authentication layer

## Next Steps

1. Review [WEBSOCKET_INVESTIGATION.md](./WEBSOCKET_INVESTIGATION.md) for architecture details
2. Read [WEBSOCKET_SETUP.md](./WEBSOCKET_SETUP.md) for deployment guide
3. Check `server/README.md` for server documentation
4. Test locally before deploying to production
