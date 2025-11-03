import * as React from 'react';
import { 
  WifiHigh, 
  WifiSlash, 
  WifiMedium,
  Copy,
  CheckCircle,
  Users
} from '@phosphor-icons/react';
import WEBSOCKET_CONFIG from '../config/websocket.config';

/**
 * Connection Status Component
 * 
 * Displays WebSocket connection status and session information.
 * Shows active users count and provides session sharing functionality.
 * 
 * @param {Object} props
 * @param {boolean} props.isConnected - Connection status
 * @param {string} props.connectionStatus - Detailed status
 * @param {number} props.activeClients - Number of active clients
 * @param {string} props.sessionId - Current session ID
 */
export function ConnectionStatus({ 
  isConnected, 
  connectionStatus, 
  activeClients = 1,
  sessionId 
}) {
  const [copied, setCopied] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Don't show if WebSocket is disabled
  if (!WEBSOCKET_CONFIG.enabled) {
    return null;
  }

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
      case 'synced':
        return <WifiHigh size={20} className="text-mint-11" />;
      case 'connecting':
      case 'reconnecting':
        return <WifiMedium size={20} className="text-yellow-11" />;
      case 'disconnected':
      default:
        return <WifiSlash size={20} className="text-red-11" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
      case 'synced':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'disconnected':
      default:
        return 'Offline';
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
      case 'synced':
        return 'text-mint-11';
      case 'connecting':
      case 'reconnecting':
        return 'text-yellow-11';
      case 'disconnected':
      default:
        return 'text-red-11';
    }
  };

  const handleCopySessionUrl = async () => {
    if (!sessionId) return;
    
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('session', sessionId);
    
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const truncateSessionId = (id) => {
    if (!id) return '';
    if (id.length <= 12) return id;
    return `${id.slice(0, 8)}...${id.slice(-4)}`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isExpanded ? (
        <div className="card bg-neutral-2 border-neutral-6 p-4 min-w-[300px]">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className={`font-mono text-sm ${getStatusColor()}`}>
                  {getStatusText()}
                </span>
              </div>
              <button
                className="btn btn-plain text-neutral-11"
                onClick={() => setIsExpanded(false)}
                aria-label="Minimize"
              >
                ✕
              </button>
            </div>

            {/* Active Users */}
            {isConnected && (
              <div className="flex items-center gap-2 text-neutral-11">
                <Users size={16} />
                <span className="font-mono text-sm">
                  {activeClients} {activeClients === 1 ? 'user' : 'users'} online
                </span>
              </div>
            )}

            {/* Session Info */}
            {sessionId && (
              <div className="border-t border-neutral-6 pt-3">
                <p className="text-xs text-neutral-11 font-mono mb-2">
                  Session ID
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-neutral-1 px-2 py-1 rounded border border-neutral-6 flex-1">
                    {truncateSessionId(sessionId)}
                  </code>
                  <button
                    className="btn btn-plain text-neutral-11 hover:text-neutral-12"
                    onClick={handleCopySessionUrl}
                    title="Copy session URL"
                  >
                    {copied ? (
                      <CheckCircle size={20} className="text-mint-11" />
                    ) : (
                      <Copy size={20} />
                    )}
                  </button>
                </div>
                {copied && (
                  <p className="text-xs text-mint-11 font-mono mt-2">
                    Session URL copied!
                  </p>
                )}
              </div>
            )}

            {/* Connection Details */}
            <div className="text-xs text-neutral-11 font-mono border-t border-neutral-6 pt-3">
              <p>Share the URL to collaborate in real-time</p>
            </div>
          </div>
        </div>
      ) : (
        <button
          className="btn bg-neutral-2 border-neutral-6 shadow-lg"
          onClick={() => setIsExpanded(true)}
          aria-label="Show connection status"
        >
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            {isConnected && activeClients > 1 && (
              <span className="font-mono text-sm">
                {activeClients}
              </span>
            )}
          </div>
        </button>
      )}
    </div>
  );
}

export default ConnectionStatus;
