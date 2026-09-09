/**
 * Session Persistence Module
 * 
 * Handles session data persistence with configurable storage backends.
 * Supports Azure Table Storage, in-memory storage, and easy extension for other backends.
 */

import { randomUUID } from 'crypto';

// Configuration
const SESSION_MAX_DURATION = parseInt(process.env.SESSION_MAX_DURATION_HOURS || '24') * 60 * 60 * 1000; // Default 24 hours
const SESSION_CLEANUP_INTERVAL = 60 * 60 * 1000; // Cleanup every hour
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'memory'; // 'memory', 'azure-table', 'redis'

// In-memory storage (fallback)
const memoryStore = new Map();

/**
 * Azure Table Storage client (lazy loaded)
 */
let azureTableClient = null;

async function getAzureTableClient() {
  if (azureTableClient) return azureTableClient;
  
  try {
    const { TableClient } = await import('@azure/data-tables');
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    
    if (!connectionString) {
      console.warn('AZURE_STORAGE_CONNECTION_STRING not set, falling back to memory storage');
      return null;
    }
    
    azureTableClient = TableClient.fromConnectionString(
      connectionString,
      'HackathonSessions'
    );
    
    // Ensure table exists
    await azureTableClient.createTable().catch(() => {
      // Table might already exist, ignore error
    });
    
    console.log('Connected to Azure Table Storage');
    return azureTableClient;
  } catch (error) {
    console.error('Failed to initialize Azure Table Storage:', error);
    return null;
  }
}

/**
 * Save session data
 */
export async function saveSession(sessionId, data) {
  const timestamp = Date.now();
  const expiresAt = timestamp + SESSION_MAX_DURATION;
  
  const sessionData = {
    sessionId,
    data: JSON.stringify(data),
    createdAt: timestamp,
    updatedAt: timestamp,
    expiresAt
  };
  
  if (STORAGE_TYPE === 'azure-table') {
    const client = await getAzureTableClient();
    if (client) {
      try {
        const entity = {
          partitionKey: 'session',
          rowKey: sessionId,
          data: JSON.stringify(data),
          createdAt: new Date(timestamp).toISOString(),
          updatedAt: new Date(timestamp).toISOString(),
          expiresAt: new Date(expiresAt).toISOString()
        };
        
        await client.upsertEntity(entity, 'Merge');
        return true;
      } catch (error) {
        console.error('Failed to save to Azure Table Storage:', error);
        // Fallback to memory
      }
    }
  }
  
  // Fallback to memory storage
  memoryStore.set(sessionId, sessionData);
  return true;
}

/**
 * Load session data
 */
export async function loadSession(sessionId) {
  if (STORAGE_TYPE === 'azure-table') {
    const client = await getAzureTableClient();
    if (client) {
      try {
        const entity = await client.getEntity('session', sessionId);
        
        // Check if expired
        const expiresAt = new Date(entity.expiresAt).getTime();
        if (Date.now() > expiresAt) {
          await deleteSession(sessionId);
          return null;
        }
        
        return JSON.parse(entity.data);
      } catch (error) {
        if (error.statusCode !== 404) {
          console.error('Failed to load from Azure Table Storage:', error);
        }
        // Fall through to memory check
      }
    }
  }
  
  // Check memory storage
  const sessionData = memoryStore.get(sessionId);
  if (sessionData) {
    // Check if expired
    if (Date.now() > sessionData.expiresAt) {
      memoryStore.delete(sessionId);
      return null;
    }
    
    return JSON.parse(sessionData.data);
  }
  
  return null;
}

/**
 * Update session data
 */
export async function updateSession(sessionId, data) {
  const timestamp = Date.now();
  
  if (STORAGE_TYPE === 'azure-table') {
    const client = await getAzureTableClient();
    if (client) {
      try {
        // Get existing to preserve createdAt and expiresAt
        const existing = await client.getEntity('session', sessionId);
        
        const entity = {
          partitionKey: 'session',
          rowKey: sessionId,
          data: JSON.stringify(data),
          createdAt: existing.createdAt,
          updatedAt: new Date(timestamp).toISOString(),
          expiresAt: existing.expiresAt
        };
        
        await client.upsertEntity(entity, 'Merge');
        return true;
      } catch (error) {
        console.error('Failed to update Azure Table Storage:', error);
        // Fallback to memory
      }
    }
  }
  
  // Update memory storage
  const sessionData = memoryStore.get(sessionId);
  if (sessionData) {
    sessionData.data = JSON.stringify(data);
    sessionData.updatedAt = timestamp;
    memoryStore.set(sessionId, sessionData);
  }
  
  return true;
}

/**
 * Delete session data
 */
export async function deleteSession(sessionId) {
  if (STORAGE_TYPE === 'azure-table') {
    const client = await getAzureTableClient();
    if (client) {
      try {
        await client.deleteEntity('session', sessionId);
      } catch (error) {
        if (error.statusCode !== 404) {
          console.error('Failed to delete from Azure Table Storage:', error);
        }
      }
    }
  }
  
  memoryStore.delete(sessionId);
  return true;
}

/**
 * List all active sessions
 */
export async function listSessions() {
  const sessions = [];
  const now = Date.now();
  
  if (STORAGE_TYPE === 'azure-table') {
    const client = await getAzureTableClient();
    if (client) {
      try {
        const entities = client.listEntities({
          queryOptions: { filter: `PartitionKey eq 'session'` }
        });
        
        for await (const entity of entities) {
          const expiresAt = new Date(entity.expiresAt).getTime();
          if (now <= expiresAt) {
            sessions.push({
              sessionId: entity.rowKey,
              createdAt: new Date(entity.createdAt).getTime(),
              updatedAt: new Date(entity.updatedAt).getTime(),
              expiresAt
            });
          }
        }
        
        return sessions;
      } catch (error) {
        console.error('Failed to list from Azure Table Storage:', error);
        // Fall through to memory
      }
    }
  }
  
  // List from memory storage
  for (const [sessionId, data] of memoryStore.entries()) {
    if (now <= data.expiresAt) {
      sessions.push({
        sessionId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        expiresAt: data.expiresAt
      });
    }
  }
  
  return sessions;
}

/**
 * Cleanup expired sessions
 */
export async function cleanupExpiredSessions() {
  const now = Date.now();
  let cleanedCount = 0;
  
  console.log('Running session cleanup...');
  
  if (STORAGE_TYPE === 'azure-table') {
    const client = await getAzureTableClient();
    if (client) {
      try {
        const entities = client.listEntities({
          queryOptions: { filter: `PartitionKey eq 'session'` }
        });
        
        for await (const entity of entities) {
          const expiresAt = new Date(entity.expiresAt).getTime();
          if (now > expiresAt) {
            await client.deleteEntity('session', entity.rowKey);
            cleanedCount++;
          }
        }
      } catch (error) {
        console.error('Failed to cleanup Azure Table Storage:', error);
      }
    }
  }
  
  // Cleanup memory storage
  for (const [sessionId, data] of memoryStore.entries()) {
    if (now > data.expiresAt) {
      memoryStore.delete(sessionId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired session(s)`);
  }
  
  return cleanedCount;
}

/**
 * Start automatic cleanup
 */
export function startCleanupScheduler() {
  console.log(`Starting session cleanup scheduler (interval: ${SESSION_CLEANUP_INTERVAL / 1000}s, max duration: ${SESSION_MAX_DURATION / 1000}s)`);
  
  // Run initial cleanup
  cleanupExpiredSessions();
  
  // Schedule periodic cleanup
  const interval = setInterval(() => {
    cleanupExpiredSessions();
  }, SESSION_CLEANUP_INTERVAL);
  
  // Return cleanup function
  return () => {
    clearInterval(interval);
  };
}

/**
 * Get storage statistics
 */
export async function getStorageStats() {
  const sessions = await listSessions();
  
  return {
    storageType: STORAGE_TYPE,
    activeSessions: sessions.length,
    maxDuration: SESSION_MAX_DURATION,
    cleanupInterval: SESSION_CLEANUP_INTERVAL
  };
}

export default {
  saveSession,
  loadSession,
  updateSession,
  deleteSession,
  listSessions,
  cleanupExpiredSessions,
  startCleanupScheduler,
  getStorageStats
};
