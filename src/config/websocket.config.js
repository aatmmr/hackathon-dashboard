/**
 * WebSocket Configuration
 * 
 * Configure WebSocket connection settings for shared sessions.
 * Set VITE_WEBSOCKET_URL environment variable to connect to your server.
 */

export const WEBSOCKET_CONFIG = {
  // WebSocket server URL (set via environment variable)
  url: import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:8080',
  
  // Auto-reconnect settings
  reconnectInterval: 3000, // ms between reconnection attempts
  maxReconnectAttempts: 10, // max attempts before giving up
  reconnectDecay: 1.5, // exponential backoff multiplier
  
  // Heartbeat settings
  heartbeatInterval: 30000, // ms between ping messages
  heartbeatTimeout: 5000, // ms to wait for pong response
  
  // Feature flags
  enabled: import.meta.env.VITE_ENABLE_WEBSOCKET !== 'false', // default enabled
  enableLogging: import.meta.env.DEV, // log in development only
  
  // Default session ID for development/testing
  defaultSessionId: import.meta.env.VITE_DEFAULT_SESSION_ID || null,
};

export default WEBSOCKET_CONFIG;
