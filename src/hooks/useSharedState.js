import { useState, useEffect, useCallback, useRef } from 'react';
import useWebSocket from './useWebSocket';
import WEBSOCKET_CONFIG from '../config/websocket.config';

/**
 * Shared State Hook
 * 
 * Extends localStorage-based state management with WebSocket synchronization.
 * Falls back to localStorage when WebSocket is disabled or disconnected.
 * 
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if not found
 * @param {string} sessionId - WebSocket session ID
 * @returns {[value, setValue, syncStatus]} State tuple with sync status
 */
export function useSharedState(key, defaultValue, sessionId) {
  // Local state with localStorage persistence
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const [syncStatus, setSyncStatus] = useState('local'); // local, syncing, synced, error
  const lastUpdateTimestampRef = useRef(Date.now());
  const isApplyingRemoteUpdateRef = useRef(false);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((message) => {
    if (message.type === 'sync' && message.key === key) {
      // Ignore our own updates
      if (isApplyingRemoteUpdateRef.current) {
        return;
      }

      // Apply remote update if it's newer
      if (message.timestamp > lastUpdateTimestampRef.current) {
        isApplyingRemoteUpdateRef.current = true;
        
        try {
          setValue(message.value);
          window.localStorage.setItem(key, JSON.stringify(message.value));
          lastUpdateTimestampRef.current = message.timestamp;
          setSyncStatus('synced');
        } catch (error) {
          console.error('Error applying remote update:', error);
          setSyncStatus('error');
        } finally {
          isApplyingRemoteUpdateRef.current = false;
        }
      }
    }
  }, [key]);

  // Handle connection status changes
  const handleConnected = useCallback(() => {
    setSyncStatus('synced');
  }, []);

  const handleDisconnected = useCallback(() => {
    setSyncStatus('local');
  }, []);

  const handleError = useCallback((error) => {
    console.error('WebSocket error:', error);
    setSyncStatus('error');
  }, []);

  // Initialize WebSocket connection
  const { sendMessage, isConnected } = useWebSocket(
    WEBSOCKET_CONFIG.enabled ? sessionId : null,
    {
      onMessage: handleMessage,
      onConnected: handleConnected,
      onDisconnected: handleDisconnected,
      onError: handleError,
    }
  );

  // Wrapped setValue that syncs to WebSocket
  const setSharedValue = useCallback((newValue) => {
    // Handle function updates like useState
    const resolvedValue = typeof newValue === 'function' 
      ? newValue(value) 
      : newValue;

    try {
      // Update local state
      setValue(resolvedValue);
      window.localStorage.setItem(key, JSON.stringify(resolvedValue));
      
      const timestamp = Date.now();
      lastUpdateTimestampRef.current = timestamp;

      // Broadcast to WebSocket if connected
      if (WEBSOCKET_CONFIG.enabled && isConnected && sessionId) {
        setSyncStatus('syncing');
        
        const sent = sendMessage({
          type: 'update',
          sessionId: sessionId,
          key: key,
          value: resolvedValue,
          timestamp: timestamp,
        });

        if (sent) {
          setSyncStatus('synced');
        } else {
          setSyncStatus('local');
        }
      } else {
        setSyncStatus('local');
      }
    } catch (error) {
      console.error('Error updating shared state:', error);
      setSyncStatus('error');
    }
  }, [value, key, sessionId, isConnected, sendMessage]);

  // Update sync status based on connection state
  useEffect(() => {
    if (!WEBSOCKET_CONFIG.enabled) {
      setSyncStatus('local');
    } else if (isConnected) {
      setSyncStatus('synced');
    } else {
      setSyncStatus('local');
    }
  }, [isConnected]);

  return [value, setSharedValue, syncStatus];
}

export default useSharedState;
