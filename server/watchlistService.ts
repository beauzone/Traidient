import { WebSocket } from 'ws';
import { db } from './db';
import { watchlists, watchlist } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Store active watchlist subscription connections by user ID
 */
const watchlistConnections = new Map<number, Set<WebSocket>>();

/**
 * Add a WebSocket connection to the watchlist subscriptions for a user
 * @param userId User ID to subscribe
 * @param ws WebSocket connection
 */
export function subscribeToWatchlistUpdates(userId: number, ws: WebSocket): void {
  if (!watchlistConnections.has(userId)) {
    watchlistConnections.set(userId, new Set());
  }
  watchlistConnections.get(userId)?.add(ws);
  console.log(`User ${userId} subscribed to watchlist updates`);
}

/**
 * Remove a WebSocket connection from watchlist subscriptions
 * @param userId User ID to unsubscribe
 * @param ws WebSocket connection to remove
 */
export function unsubscribeFromWatchlistUpdates(userId: number, ws: WebSocket): void {
  if (watchlistConnections.has(userId)) {
    watchlistConnections.get(userId)?.delete(ws);
    
    // If no more connections for this user, remove the user entry
    if (watchlistConnections.get(userId)?.size === 0) {
      watchlistConnections.delete(userId);
    }
    console.log(`User ${userId} unsubscribed from watchlist updates`);
  }
}

/**
 * Broadcast a watchlist update to all connected clients for a specific user
 * @param userId User ID to send updates to
 * @param updateType Type of update (created, updated, deleted)
 * @param watchlistId Watchlist ID that was modified
 */
export async function broadcastWatchlistUpdate(
  userId: number, 
  updateType: 'created' | 'updated' | 'deleted',
  watchlistId: number
): Promise<void> {
  // Skip if no connections for this user
  if (!watchlistConnections.has(userId)) {
    return;
  }
  
  try {
    let payload: any = {
      type: 'watchlist_update',
      updateType,
      watchlistId
    };
    
    // For created/updated events, include the full watchlist data
    if (updateType === 'created' || updateType === 'updated') {
      // Get the watchlist
      const [watchlistData] = await db
        .select()
        .from(watchlists)
        .where(and(
          eq(watchlists.id, watchlistId),
          eq(watchlists.userId, userId)
        ));
        
      if (watchlistData) {
        // Get watchlist items
        const items = await db
          .select()
          .from(watchlist)
          .where(and(
            eq(watchlist.watchlistId, watchlistId),
            eq(watchlist.userId, userId)
          ))
          .orderBy(watchlist.displayOrder);
          
        payload.watchlist = {
          ...watchlistData,
          items
        };
      }
    }
    
    // Send update to all connections for this user
    const connections = watchlistConnections.get(userId);
    if (connections) {
      const message = JSON.stringify(payload);
      
      for (const ws of connections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      }
    }
  } catch (error) {
    console.error('Error broadcasting watchlist update:', error);
  }
}

/**
 * Broadcast a watchlist item update to all connected clients for a specific user
 * @param userId User ID to send updates to
 * @param updateType Type of update (added, removed)
 * @param watchlistId Watchlist ID that was modified
 * @param itemId Item ID that was added/removed (if applicable)
 */
export async function broadcastWatchlistItemUpdate(
  userId: number,
  updateType: 'added' | 'removed' | 'reordered',
  watchlistId: number,
  itemId?: number
): Promise<void> {
  // Skip if no connections for this user
  if (!watchlistConnections.has(userId)) {
    return;
  }
  
  try {
    let payload: any = {
      type: 'watchlist_item_update',
      updateType,
      watchlistId
    };
    
    // For added items, include the item data
    if (updateType === 'added' && itemId) {
      const [itemData] = await db
        .select()
        .from(watchlist)
        .where(and(
          eq(watchlist.id, itemId),
          eq(watchlist.userId, userId),
          eq(watchlist.watchlistId, watchlistId)
        ));
        
      if (itemData) {
        payload.item = itemData;
      }
    } else if (updateType === 'removed' && itemId) {
      payload.itemId = itemId;
    } else if (updateType === 'reordered') {
      // Get all items with updated order
      const items = await db
        .select()
        .from(watchlist)
        .where(and(
          eq(watchlist.watchlistId, watchlistId),
          eq(watchlist.userId, userId)
        ))
        .orderBy(watchlist.displayOrder);
        
      payload.items = items;
    }
    
    // Send update to all connections for this user
    const connections = watchlistConnections.get(userId);
    if (connections) {
      const message = JSON.stringify(payload);
      
      for (const ws of connections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      }
    }
  } catch (error) {
    console.error('Error broadcasting watchlist item update:', error);
  }
}