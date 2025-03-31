import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { watchlists, watchlist } from '@shared/schema';
import { insertWatchlistSchema, insertWatchlistItemSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Create or get default watchlist
router.get('/default', async (req: any, res) => {
  try {
    const userId = req.user.id;
    
    // Find the default watchlist first
    const defaultWatchlists = await db
      .select()
      .from(watchlists)
      .where(and(
        eq(watchlists.userId, userId),
        eq(watchlists.isDefault, true)
      ));
    
    // If default watchlist exists, return it with its items
    if (defaultWatchlists.length > 0) {
      const items = await db
        .select()
        .from(watchlist)
        .where(and(
          eq(watchlist.userId, userId),
          eq(watchlist.watchlistId, defaultWatchlists[0].id)
        ))
        .orderBy(watchlist.displayOrder);
      
      return res.json({
        ...defaultWatchlists[0],
        items
      });
    }
    
    // Otherwise, create a new default watchlist
    const [newWatchlist] = await db.insert(watchlists).values({
      userId,
      name: 'My Watchlist',
      isDefault: true,
      displayOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    // Return the new watchlist with empty items array
    return res.json({
      ...newWatchlist,
      items: []
    });
  } catch (error) {
    console.error('Error getting or creating default watchlist:', error);
    res.status(500).json({ error: 'Failed to get or create default watchlist' });
  }
});

// Get all watchlists for the user
router.get('/', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const userWatchlists = await db.select().from(watchlists)
      .where(eq(watchlists.userId, userId))
      .orderBy(watchlists.displayOrder);
    
    // For each watchlist, fetch the items
    const result = await Promise.all(userWatchlists.map(async (list) => {
      const items = await db.select().from(watchlist)
        .where(and(
          eq(watchlist.userId, userId),
          eq(watchlist.watchlistId, list.id)
        ))
        .orderBy(watchlist.displayOrder);
      
      return {
        ...list,
        items
      };
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching watchlists:', error);
    res.status(500).json({ error: 'Failed to fetch watchlists' });
  }
});

// Create a new watchlist
router.post('/', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const validation = insertWatchlistSchema.safeParse({
      ...req.body,
      userId
    });

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid watchlist data',
        details: validation.error.format()
      });
    }

    // If this is marked as default, make sure no other watchlist is default
    if (validation.data.isDefault) {
      await db.update(watchlists)
        .set({ isDefault: false })
        .where(eq(watchlists.userId, userId));
    }

    // If it's the first watchlist for this user, make it default regardless
    const existingWatchlists = await db.select().from(watchlists)
      .where(eq(watchlists.userId, userId));
    
    const isFirst = existingWatchlists.length === 0;
    const isDefault = isFirst ? true : validation.data.isDefault;

    // Get highest displayOrder to place new watchlist at the end
    const highestOrder = existingWatchlists.reduce(
      (max, list) => Math.max(max, list.displayOrder || 0),
      -1
    );
    
    const displayOrder = validation.data.displayOrder || highestOrder + 1;

    const [newWatchlist] = await db.insert(watchlists)
      .values({
        ...validation.data,
        isDefault,
        displayOrder
      })
      .returning();

    res.status(201).json(newWatchlist);
  } catch (error) {
    console.error('Error creating watchlist:', error);
    res.status(500).json({ error: 'Failed to create watchlist' });
  }
});

// Update a watchlist
router.put('/:id', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const watchlistId = parseInt(req.params.id);
    
    // Verify watchlist belongs to user
    const existingWatchlist = await db.select().from(watchlists)
      .where(and(
        eq(watchlists.id, watchlistId),
        eq(watchlists.userId, userId)
      ));
    
    if (existingWatchlist.length === 0) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      isDefault: z.boolean().optional(),
      displayOrder: z.number().int().optional(),
    });

    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid watchlist data',
        details: validation.error.format()
      });
    }

    // If making this watchlist default, unset default on all others
    if (validation.data.isDefault) {
      await db.update(watchlists)
        .set({ isDefault: false })
        .where(eq(watchlists.userId, userId));
    }

    const [updatedWatchlist] = await db.update(watchlists)
      .set(validation.data)
      .where(and(
        eq(watchlists.id, watchlistId),
        eq(watchlists.userId, userId)
      ))
      .returning();

    if (!updatedWatchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    res.json(updatedWatchlist);
  } catch (error) {
    console.error('Error updating watchlist:', error);
    res.status(500).json({ error: 'Failed to update watchlist' });
  }
});

// Delete a watchlist
router.delete('/:id', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const watchlistId = parseInt(req.params.id);
    
    // Verify watchlist belongs to user
    const existingWatchlist = await db.select().from(watchlists)
      .where(and(
        eq(watchlists.id, watchlistId),
        eq(watchlists.userId, userId)
      ));
    
    if (existingWatchlist.length === 0) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    // Delete all items in the watchlist first
    await db.delete(watchlist)
      .where(and(
        eq(watchlist.watchlistId, watchlistId),
        eq(watchlist.userId, userId)
      ));

    // Delete the watchlist itself
    const [deletedWatchlist] = await db.delete(watchlists)
      .where(and(
        eq(watchlists.id, watchlistId),
        eq(watchlists.userId, userId)
      ))
      .returning();

    if (!deletedWatchlist) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    // If we deleted the default watchlist and there are other watchlists,
    // make another one the default
    if (deletedWatchlist.isDefault) {
      const remainingWatchlists = await db.select().from(watchlists)
        .where(eq(watchlists.userId, userId))
        .orderBy(watchlists.displayOrder);
      
      if (remainingWatchlists.length > 0) {
        await db.update(watchlists)
          .set({ isDefault: true })
          .where(eq(watchlists.id, remainingWatchlists[0].id));
      }
    }

    res.json({ success: true, id: watchlistId });
  } catch (error) {
    console.error('Error deleting watchlist:', error);
    res.status(500).json({ error: 'Failed to delete watchlist' });
  }
});

// Add item to watchlist
router.post('/:id/items', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const watchlistId = parseInt(req.params.id);
    
    // Verify watchlist belongs to user
    const existingWatchlist = await db.select().from(watchlists)
      .where(and(
        eq(watchlists.id, watchlistId),
        eq(watchlists.userId, userId)
      ));
    
    if (existingWatchlist.length === 0) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    const validation = insertWatchlistItemSchema.safeParse({
      ...req.body,
      userId,
      watchlistId
    });

    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid watchlist item data',
        details: validation.error.format()
      });
    }

    // Check if the item already exists in this watchlist
    const existingItem = await db.select().from(watchlist)
      .where(and(
        eq(watchlist.userId, userId),
        eq(watchlist.watchlistId, watchlistId),
        eq(watchlist.symbol, validation.data.symbol)
      ));
    
    if (existingItem.length > 0) {
      return res.status(409).json({ 
        error: 'Item already exists in this watchlist',
        item: existingItem[0]
      });
    }

    // Get highest displayOrder to place new item at the end
    const existingItems = await db.select().from(watchlist)
      .where(and(
        eq(watchlist.userId, userId),
        eq(watchlist.watchlistId, watchlistId)
      ));
    
    const highestOrder = existingItems.reduce(
      (max, item) => Math.max(max, item.displayOrder || 0),
      -1
    );
    
    const displayOrder = validation.data.displayOrder || highestOrder + 1;

    const [newItem] = await db.insert(watchlist)
      .values({
        ...validation.data,
        displayOrder
      })
      .returning();

    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error adding item to watchlist:', error);
    res.status(500).json({ error: 'Failed to add item to watchlist' });
  }
});

// Update watchlist item
router.put('/:watchlistId/items/:itemId', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const watchlistId = parseInt(req.params.watchlistId);
    const itemId = parseInt(req.params.itemId);
    
    // Verify item belongs to user and watchlist
    const existingItem = await db.select().from(watchlist)
      .where(and(
        eq(watchlist.id, itemId),
        eq(watchlist.userId, userId),
        eq(watchlist.watchlistId, watchlistId)
      ));
    
    if (existingItem.length === 0) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    const updateSchema = z.object({
      displayOrder: z.number().int().optional(),
      // Add other fields that can be updated as needed
    });

    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid watchlist item data',
        details: validation.error.format()
      });
    }

    const [updatedItem] = await db.update(watchlist)
      .set(validation.data)
      .where(and(
        eq(watchlist.id, itemId),
        eq(watchlist.userId, userId),
        eq(watchlist.watchlistId, watchlistId)
      ))
      .returning();

    if (!updatedItem) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating watchlist item:', error);
    res.status(500).json({ error: 'Failed to update watchlist item' });
  }
});

// Delete item from watchlist
router.delete('/:watchlistId/items/:itemId', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const watchlistId = parseInt(req.params.watchlistId);
    const itemId = parseInt(req.params.itemId);
    
    // Verify item belongs to user and watchlist
    const existingItem = await db.select().from(watchlist)
      .where(and(
        eq(watchlist.id, itemId),
        eq(watchlist.userId, userId),
        eq(watchlist.watchlistId, watchlistId)
      ));
    
    if (existingItem.length === 0) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    const [deletedItem] = await db.delete(watchlist)
      .where(and(
        eq(watchlist.id, itemId),
        eq(watchlist.userId, userId),
        eq(watchlist.watchlistId, watchlistId)
      ))
      .returning();

    if (!deletedItem) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    res.json({ success: true, id: itemId });
  } catch (error) {
    console.error('Error deleting watchlist item:', error);
    res.status(500).json({ error: 'Failed to delete watchlist item' });
  }
});

// Reorder watchlist items
router.post('/:id/reorder', async (req: any, res) => {
  try {
    const userId = req.user.id;
    const watchlistId = parseInt(req.params.id);
    
    const reorderSchema = z.object({
      items: z.array(z.object({
        id: z.number().int(),
        displayOrder: z.number().int()
      }))
    });

    const validation = reorderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid reorder data',
        details: validation.error.format()
      });
    }

    // Update each item's display order
    const results = await Promise.all(validation.data.items.map(async (item) => {
      return db.update(watchlist)
        .set({ displayOrder: item.displayOrder })
        .where(and(
          eq(watchlist.id, item.id),
          eq(watchlist.userId, userId),
          eq(watchlist.watchlistId, watchlistId)
        ))
        .returning();
    }));

    // Fetch the updated items
    const updatedItems = await db.select().from(watchlist)
      .where(and(
        eq(watchlist.userId, userId),
        eq(watchlist.watchlistId, watchlistId)
      ))
      .orderBy(watchlist.displayOrder);

    res.json(updatedItems);
  } catch (error) {
    console.error('Error reordering watchlist items:', error);
    res.status(500).json({ error: 'Failed to reorder watchlist items' });
  }
});

// Reorder watchlists
router.post('/reorder', async (req: any, res) => {
  try {
    const userId = req.user.id;
    
    const reorderSchema = z.object({
      lists: z.array(z.object({
        id: z.number().int(),
        displayOrder: z.number().int()
      }))
    });

    const validation = reorderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid reorder data',
        details: validation.error.format()
      });
    }

    // Update each watchlist's display order
    const results = await Promise.all(validation.data.lists.map(async (list) => {
      return db.update(watchlists)
        .set({ displayOrder: list.displayOrder })
        .where(and(
          eq(watchlists.id, list.id),
          eq(watchlists.userId, userId)
        ))
        .returning();
    }));

    // Fetch the updated watchlists
    const updatedWatchlists = await db.select().from(watchlists)
      .where(eq(watchlists.userId, userId))
      .orderBy(watchlists.displayOrder);

    res.json(updatedWatchlists);
  } catch (error) {
    console.error('Error reordering watchlists:', error);
    res.status(500).json({ error: 'Failed to reorder watchlists' });
  }
});

export const watchlistRoutes = router;