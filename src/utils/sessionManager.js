/**
 * Session Manager
 * 
 * Utilities for managing WebSocket session IDs.
 * Handles session creation, URL parsing, and persistence.
 */

/**
 * Generates a cryptographically random session ID
 * @returns {string} Random session ID
 */
export function generateSessionId() {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback: generate random string
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Gets session ID from URL query parameter
 * @returns {string | null} Session ID from URL or null
 */
export function getSessionIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('session');
}

/**
 * Updates URL with session ID without page reload
 * @param {string} sessionId - Session ID to set in URL
 */
export function setSessionIdInUrl(sessionId) {
  const url = new URL(window.location.href);
  url.searchParams.set('session', sessionId);
  window.history.replaceState({}, '', url.toString());
}

/**
 * Removes session ID from URL
 */
export function removeSessionIdFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('session');
  window.history.replaceState({}, '', url.toString());
}

/**
 * Gets or creates a session ID
 * Priority: URL > localStorage > generate new
 * @param {string | null} defaultSessionId - Optional default session ID
 * @returns {string} Session ID
 */
export function getOrCreateSessionId(defaultSessionId = null) {
  // Check URL first
  const urlSessionId = getSessionIdFromUrl();
  if (urlSessionId) {
    // Store in localStorage for persistence
    localStorage.setItem('hackathon-session-id', urlSessionId);
    return urlSessionId;
  }
  
  // Check localStorage
  const storedSessionId = localStorage.getItem('hackathon-session-id');
  if (storedSessionId) {
    // Update URL to match
    setSessionIdInUrl(storedSessionId);
    return storedSessionId;
  }
  
  // Use default if provided
  if (defaultSessionId) {
    localStorage.setItem('hackathon-session-id', defaultSessionId);
    setSessionIdInUrl(defaultSessionId);
    return defaultSessionId;
  }
  
  // Generate new session ID
  const newSessionId = generateSessionId();
  localStorage.setItem('hackathon-session-id', newSessionId);
  setSessionIdInUrl(newSessionId);
  return newSessionId;
}

/**
 * Changes to a different session
 * @param {string} sessionId - New session ID
 */
export function switchSession(sessionId) {
  localStorage.setItem('hackathon-session-id', sessionId);
  setSessionIdInUrl(sessionId);
}

/**
 * Creates a shareable URL for the current session
 * @param {string} sessionId - Session ID to share
 * @returns {string} Shareable URL
 */
export function getShareableUrl(sessionId) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('session', sessionId);
  return url.toString();
}

export default {
  generateSessionId,
  getSessionIdFromUrl,
  setSessionIdInUrl,
  removeSessionIdFromUrl,
  getOrCreateSessionId,
  switchSession,
  getShareableUrl,
};
