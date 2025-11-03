import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { 
  saveSession, 
  loadSession, 
  updateSession, 
  startCleanupScheduler,
  getStorageStats 
} from './sessionPersistence.js';

const PORT = process.env.PORT || 8080;
const ENABLE_PERSISTENCE = process.env.ENABLE_PERSISTENCE !== 'false'; // Default enabled

// Store active sessions and their clients (in-memory for active connections)
const sessions = new Map();

// Store client metadata
const clients = new Map();

// Store session state data (for persistence)
const sessionStateData = new Map();

// Create WebSocket server
const wss = new WebSocketServer({ 
  port: PORT,
  perMessageDeflate: false // Disable compression for simplicity
});

console.log(`WebSocket server started on port ${PORT}`);
console.log(`Session persistence: ${ENABLE_PERSISTENCE ? 'enabled' : 'disabled'}`);

// Start session cleanup scheduler if persistence is enabled
let cleanupScheduler = null;
if (ENABLE_PERSISTENCE) {
  cleanupScheduler = startCleanupScheduler();
  
  // Log storage stats
  getStorageStats().then(stats => {
    console.log('Storage configuration:', stats);
  });
}

// Helper function to broadcast message to all clients in a session
function broadcastToSession(sessionId, message, excludeClientId = null) {
  const sessionClients = sessions.get(sessionId);
  if (!sessionClients) return;

  const messageStr = JSON.stringify(message);
  
  sessionClients.forEach((client) => {
    const clientData = clients.get(client);
    if (clientData && clientData.id !== excludeClientId && client.readyState === 1) {
      try {
        client.send(messageStr);
      } catch (error) {
        console.error('Error broadcasting to client:', error);
      }
    }
  });
}

// Helper function to get active client count in session
function getSessionClientCount(sessionId) {
  const sessionClients = sessions.get(sessionId);
  return sessionClients ? sessionClients.size : 0;
}

// Handle new WebSocket connections
wss.on('connection', (ws) => {
  const clientId = randomUUID();
  let currentSessionId = null;

  // Store client metadata
  clients.set(ws, {
    id: clientId,
    sessionId: null,
    connectedAt: Date.now()
  });

  console.log(`Client ${clientId} connected`);

  // Send initial connection confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    clientId: clientId,
    timestamp: Date.now()
  }));

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      const clientData = clients.get(ws);

      if (!clientData) {
        console.error('Client data not found');
        return;
      }

      switch (message.type) {
        case 'join': {
          // Join a session
          const { sessionId } = message;
          
          if (!sessionId) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Session ID is required'
            }));
            return;
          }

          // Leave previous session if any
          if (currentSessionId) {
            const prevSession = sessions.get(currentSessionId);
            if (prevSession) {
              prevSession.delete(ws);
              if (prevSession.size === 0) {
                sessions.delete(currentSessionId);
              }
            }
          }

          // Join new session
          if (!sessions.has(sessionId)) {
            sessions.set(sessionId, new Set());
          }
          
          sessions.get(sessionId).add(ws);
          currentSessionId = sessionId;
          clientData.sessionId = sessionId;

          console.log(`Client ${clientId} joined session ${sessionId}`);

          // Load persisted session data if available
          if (ENABLE_PERSISTENCE) {
            loadSession(sessionId).then(persistedData => {
              if (persistedData) {
                console.log(`Loaded persisted data for session ${sessionId}`);
                sessionStateData.set(sessionId, persistedData);
                
                // Send persisted state to newly joined client
                ws.send(JSON.stringify({
                  type: 'session-state',
                  state: persistedData,
                  timestamp: Date.now()
                }));
              }
            }).catch(error => {
              console.error('Failed to load session data:', error);
            });
          }

          // Confirm join
          ws.send(JSON.stringify({
            type: 'joined',
            sessionId: sessionId,
            clientId: clientId,
            activeClients: getSessionClientCount(sessionId),
            timestamp: Date.now()
          }));

          // Notify other clients in session
          broadcastToSession(sessionId, {
            type: 'client-joined',
            clientId: clientId,
            activeClients: getSessionClientCount(sessionId),
            timestamp: Date.now()
          }, clientId);

          break;
        }

        case 'update': {
          // Broadcast state update to other clients in session
          const { sessionId, key, value, timestamp } = message;
          
          if (!sessionId || sessionId !== currentSessionId) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid session ID'
            }));
            return;
          }

          // Update session state data
          if (!sessionStateData.has(sessionId)) {
            sessionStateData.set(sessionId, {});
          }
          const stateData = sessionStateData.get(sessionId);
          stateData[key] = value;
          
          // Persist state if enabled
          if (ENABLE_PERSISTENCE) {
            updateSession(sessionId, stateData).catch(error => {
              console.error('Failed to persist session data:', error);
            });
          }

          // Broadcast to all other clients in the session
          broadcastToSession(sessionId, {
            type: 'sync',
            key: key,
            value: value,
            timestamp: timestamp || Date.now(),
            clientId: clientId
          }, clientId);

          break;
        }

        case 'request-sync': {
          // Client requesting current state (for new joiners)
          // In this simple implementation, clients maintain their own state
          // This could be enhanced to store state on server
          const { sessionId } = message;
          
          if (!sessionId || sessionId !== currentSessionId) {
            return;
          }

          // Notify other clients that this client needs sync
          broadcastToSession(sessionId, {
            type: 'sync-request',
            clientId: clientId,
            timestamp: Date.now()
          }, clientId);

          break;
        }

        case 'ping': {
          // Heartbeat response
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
          break;
        }

        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  });

  // Handle connection close
  ws.on('close', () => {
    console.log(`Client ${clientId} disconnected`);

    // Remove from session
    if (currentSessionId) {
      const sessionClients = sessions.get(currentSessionId);
      if (sessionClients) {
        sessionClients.delete(ws);
        
        // Notify other clients
        broadcastToSession(currentSessionId, {
          type: 'client-left',
          clientId: clientId,
          activeClients: getSessionClientCount(currentSessionId),
          timestamp: Date.now()
        });

        // Clean up empty sessions
        if (sessionClients.size === 0) {
          sessions.delete(currentSessionId);
          console.log(`Session ${currentSessionId} closed (no clients)`);
        }
      }
    }

    // Remove client metadata
    clients.delete(ws);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });
});

// Periodic cleanup of stale connections
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === 3) { // CLOSED
      const clientData = clients.get(ws);
      if (clientData) {
        console.log(`Cleaning up stale client ${clientData.id}`);
        clients.delete(ws);
      }
    }
  });
}, 60000); // Every minute

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  if (cleanupScheduler) {
    cleanupScheduler();
  }
  wss.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  if (cleanupScheduler) {
    cleanupScheduler();
  }
  wss.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});
