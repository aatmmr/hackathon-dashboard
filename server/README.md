# Hackathon Dashboard WebSocket Server

This is the WebSocket server that enables real-time shared sessions for the Hackathon Dashboard.

## Features

- Session-based room management
- Real-time state synchronization
- Automatic client tracking
- Graceful connection handling
- Heartbeat/ping-pong support
- **Session persistence with Azure Table Storage**
- **Configurable session expiration**
- **Automatic cleanup of expired sessions**

## Installation

```bash
npm install
```

## Running

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## Environment Variables

### Required
- `PORT`: Port to run the server on (default: 8080)

### Session Persistence (Optional)
- `ENABLE_PERSISTENCE`: Enable session persistence (default: true)
- `STORAGE_TYPE`: Storage backend - `memory` or `azure-table` (default: memory)
- `AZURE_STORAGE_CONNECTION_STRING`: Azure Storage connection string (required for azure-table)
- `SESSION_MAX_DURATION_HOURS`: Max session duration in hours (default: 24)

### Example Configuration

**Memory-only (no persistence):**
```bash
PORT=8080
ENABLE_PERSISTENCE=false
```

**Azure Table Storage:**
```bash
PORT=8080
ENABLE_PERSISTENCE=true
STORAGE_TYPE=azure-table
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=..."
SESSION_MAX_DURATION_HOURS=24
```

## Session Persistence

### How It Works

1. **Session Creation**: When a client joins a session, the server loads persisted data if available
2. **State Updates**: All state changes are automatically persisted to the configured storage backend
3. **Expiration**: Sessions automatically expire after the configured duration (default 24 hours)
4. **Cleanup**: Expired sessions are automatically cleaned up every hour

### Storage Backends

**Azure Table Storage (Recommended for Production)**
- Durable: Survives server restarts
- Scalable: Handles many concurrent sessions
- Managed: No maintenance required
- Cost-effective: Pay only for storage used

**Memory Storage (Development/Testing)**
- Fast: No network latency
- Simple: No setup required
- Ephemeral: Lost on server restart

### Session Lifecycle

```
Client joins → Load persisted state → Client receives state
                     ↓
State changes → Persist to storage → Broadcast to clients
                     ↓
Session expires → Automatic cleanup
```

## Deployment

### Azure (Recommended)

See [AZURE_DEPLOYMENT.md](../AZURE_DEPLOYMENT.md) for complete guide.

Quick setup:
```bash
# Deploy to Azure App Service
az webapp create --name hackathon-ws-server --runtime "NODE:18-lts"
az webapp config set --web-sockets-enabled true
az webapp config appsettings set --settings \
  ENABLE_PERSISTENCE=true \
  STORAGE_TYPE=azure-table \
  AZURE_STORAGE_CONNECTION_STRING="..."
```

### Railway

1. Push code to GitHub
2. Create new project on Railway
3. Connect to GitHub repository
4. Set root directory to `server/`
5. Deploy

### Render

1. Create new Web Service
2. Connect to GitHub repository
3. Set Build Command: `cd server && npm install`
4. Set Start Command: `cd server && npm start`
5. Deploy

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t hackathon-ws-server .
docker run -p 8080:8080 hackathon-ws-server
```

## Message Protocol

### Client → Server

**Join Session:**
```json
{
  "type": "join",
  "sessionId": "abc123"
}
```

**Update State:**
```json
{
  "type": "update",
  "sessionId": "abc123",
  "key": "hackathon-teams",
  "value": { /* state data */ },
  "timestamp": 1234567890
}
```

**Request Sync:**
```json
{
  "type": "request-sync",
  "sessionId": "abc123"
}
```

**Heartbeat:**
```json
{
  "type": "ping"
}
```

### Server → Client

**Connection Confirmed:**
```json
{
  "type": "connected",
  "clientId": "xyz789",
  "timestamp": 1234567890
}
```

**Session Joined:**
```json
{
  "type": "joined",
  "sessionId": "abc123",
  "clientId": "xyz789",
  "activeClients": 3,
  "timestamp": 1234567890
}
```

**State Sync:**
```json
{
  "type": "sync",
  "key": "hackathon-teams",
  "value": { /* state data */ },
  "timestamp": 1234567890,
  "clientId": "sender-id"
}
```

**Client Joined:**
```json
{
  "type": "client-joined",
  "clientId": "new-client-id",
  "activeClients": 4,
  "timestamp": 1234567890
}
```

**Client Left:**
```json
{
  "type": "client-left",
  "clientId": "left-client-id",
  "activeClients": 2,
  "timestamp": 1234567890
}
```

**Error:**
```json
{
  "type": "error",
  "message": "Error description"
}
```

**Pong:**
```json
{
  "type": "pong",
  "timestamp": 1234567890
}
```

## Architecture

### Session Management

- Sessions are identified by unique IDs
- Clients join sessions by sending a "join" message
- Multiple clients can be in the same session
- Sessions are automatically cleaned up when empty

### State Synchronization

- Clients send "update" messages with state changes
- Server broadcasts changes to all other clients in the session
- No server-side state persistence (clients maintain their own state)
- Timestamp-based conflict resolution on client side

### Connection Health

- Automatic cleanup of stale connections every 60 seconds
- Ping/pong for connection health checks
- Graceful shutdown on SIGTERM/SIGINT

## Monitoring

### Logs

The server logs:
- Client connections/disconnections
- Session joins/leaves
- Errors and warnings

### Metrics (Future Enhancement)

Consider adding:
- Prometheus metrics
- Connection count gauge
- Message rate counter
- Error rate counter

## Security

### Current Implementation

- No authentication
- No rate limiting
- No input validation beyond JSON parsing

### Recommended Enhancements

1. **Add Authentication:**
   - Token-based auth
   - JWT validation

2. **Rate Limiting:**
   - Messages per second per client
   - Connection attempts per IP

3. **Input Validation:**
   - Schema validation (e.g., Joi, Zod)
   - Sanitize all inputs

4. **SSL/TLS:**
   - Use WSS (WebSocket Secure)
   - Enforce HTTPS

## Testing

### Manual Testing

```bash
# Install wscat for testing
npm install -g wscat

# Connect to server
wscat -c ws://localhost:8080

# Join session
> {"type":"join","sessionId":"test123"}

# Send update
> {"type":"update","sessionId":"test123","key":"test","value":{"data":"hello"},"timestamp":1234567890}
```

### Automated Testing (Future)

Consider adding:
- Unit tests with Jest
- Integration tests with ws client
- Load testing with autocannon

## Troubleshooting

### Server won't start

- Check if port is already in use: `lsof -i :8080`
- Verify Node.js version: `node --version` (requires 18+)
- Check for syntax errors in code

### Clients can't connect

- Verify server is running
- Check firewall settings
- Ensure correct WebSocket URL (ws:// or wss://)
- Check CORS if behind proxy

### Messages not broadcasting

- Verify clients are in same session
- Check client readyState (should be 1 for OPEN)
- Review server logs for errors

## Performance

### Current Limitations

- In-memory session storage (lost on restart)
- No horizontal scaling
- Single-process server

### Optimization Strategies

1. **Add Redis:**
   - Share session state across server instances
   - Enable horizontal scaling

2. **Connection Pooling:**
   - Limit max connections per IP
   - Implement backpressure

3. **Message Batching:**
   - Batch rapid updates
   - Reduce network overhead

4. **Compression:**
   - Enable per-message deflate
   - Compress large payloads

## License

MIT
