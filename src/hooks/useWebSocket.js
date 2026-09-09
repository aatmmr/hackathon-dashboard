import { useEffect, useRef, useState, useCallback } from 'react';
import WEBSOCKET_CONFIG from '../config/websocket.config';

/**
 * WebSocket Connection Hook
 * 
 * Manages WebSocket connection with auto-reconnect and message handling.
 * 
 * @param {string} sessionId - Session ID to join
 * @param {Object} callbacks - Event callbacks
 * @param {Function} callbacks.onMessage - Called when message received
 * @param {Function} callbacks.onConnected - Called when connected
 * @param {Function} callbacks.onDisconnected - Called when disconnected
 * @param {Function} callbacks.onError - Called on error
 * @returns {Object} WebSocket state and methods
 */
export function useWebSocket(sessionId, callbacks = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected, reconnecting
  const [activeClients, setActiveClients] = useState(1);
  const [error, setError] = useState(null);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef(null);
  const messageQueueRef = useRef([]);
  const clientIdRef = useRef(null);
  
  const log = useCallback((...args) => {
    if (WEBSOCKET_CONFIG.enableLogging) {
      console.log('[WebSocket]', ...args);
    }
  }, []);

  // Send heartbeat ping
  const sendHeartbeat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
      log('Sent heartbeat ping');
    }
  }, [log]);

  // Start heartbeat interval
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    heartbeatIntervalRef.current = setInterval(
      sendHeartbeat,
      WEBSOCKET_CONFIG.heartbeatInterval
    );
    log('Started heartbeat');
  }, [sendHeartbeat, log]);

  // Stop heartbeat interval
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
      log('Stopped heartbeat');
    }
  }, [log]);

  // Send message through WebSocket
  const sendMessage = useCallback((message) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      log('Not connected, queueing message');
      messageQueueRef.current.push(message);
      return false;
    }

    try {
      wsRef.current.send(JSON.stringify(message));
      log('Sent message:', message.type);
      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      messageQueueRef.current.push(message);
      return false;
    }
  }, [log]);

  // Process queued messages
  const processMessageQueue = useCallback(() => {
    if (messageQueueRef.current.length === 0) return;
    
    log(`Processing ${messageQueueRef.current.length} queued messages`);
    const queue = [...messageQueueRef.current];
    messageQueueRef.current = [];
    
    queue.forEach(message => {
      sendMessage(message);
    });
  }, [sendMessage, log]);

  // Connect to WebSocket server
  const connect = useCallback(() => {
    if (!WEBSOCKET_CONFIG.enabled) {
      log('WebSocket disabled');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      log('Already connected');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      log('Already connecting');
      return;
    }

    try {
      log(`Connecting to ${WEBSOCKET_CONFIG.url}...`);
      setConnectionStatus('connecting');
      setError(null);

      const ws = new WebSocket(WEBSOCKET_CONFIG.url);
      wsRef.current = ws;

      ws.onopen = () => {
        log('Connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        
        // Join session
        if (sessionId) {
          log(`Joining session: ${sessionId}`);
          ws.send(JSON.stringify({
            type: 'join',
            sessionId: sessionId
          }));
        }

        // Start heartbeat
        startHeartbeat();

        // Process queued messages
        processMessageQueue();

        // Call callback
        callbacks.onConnected?.();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          log('Received message:', message.type);

          // Handle system messages
          switch (message.type) {
            case 'connected':
              clientIdRef.current = message.clientId;
              log('Assigned client ID:', message.clientId);
              break;
              
            case 'joined':
              setActiveClients(message.activeClients);
              log('Joined session, active clients:', message.activeClients);
              break;
              
            case 'client-joined':
              setActiveClients(message.activeClients);
              log('Client joined, active clients:', message.activeClients);
              break;
              
            case 'client-left':
              setActiveClients(message.activeClients);
              log('Client left, active clients:', message.activeClients);
              break;
              
            case 'error':
              console.error('Server error:', message.message);
              setError(message.message);
              callbacks.onError?.(message.message);
              break;
              
            case 'pong':
              // Heartbeat response
              break;
              
            default:
              // Pass to callback
              callbacks.onMessage?.(message);
          }
        } catch (err) {
          console.error('Error parsing message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('Connection error');
        callbacks.onError?.('Connection error');
      };

      ws.onclose = (event) => {
        log('Disconnected:', event.code, event.reason);
        setIsConnected(false);
        stopHeartbeat();
        
        // Attempt reconnection if not a clean close
        if (event.code !== 1000 && reconnectAttemptsRef.current < WEBSOCKET_CONFIG.maxReconnectAttempts) {
          const delay = WEBSOCKET_CONFIG.reconnectInterval * 
            Math.pow(WEBSOCKET_CONFIG.reconnectDecay, reconnectAttemptsRef.current);
          
          log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${WEBSOCKET_CONFIG.maxReconnectAttempts})`);
          setConnectionStatus('reconnecting');
          reconnectAttemptsRef.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setConnectionStatus('disconnected');
          callbacks.onDisconnected?.();
        }
      };

    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError('Failed to connect');
      setConnectionStatus('disconnected');
      callbacks.onError?.('Failed to connect');
    }
  }, [sessionId, callbacks, startHeartbeat, stopHeartbeat, processMessageQueue, log]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    log('Disconnecting...');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    stopHeartbeat();
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, [stopHeartbeat, log]);

  // Auto-connect on mount and when sessionId changes
  useEffect(() => {
    if (sessionId && WEBSOCKET_CONFIG.enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]); // Only reconnect when sessionId changes, not when connect/disconnect functions change

  return {
    isConnected,
    connectionStatus,
    activeClients,
    error,
    clientId: clientIdRef.current,
    sendMessage,
    connect,
    disconnect,
  };
}

export default useWebSocket;
