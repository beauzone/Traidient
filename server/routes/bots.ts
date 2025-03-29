import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { 
  insertBotInstanceSchema, 
  type InsertBotInstance,
  type BotInstance,
  type MarketCondition,
  type SymbolInsight,
} from "@shared/schema";

// Custom auth request type
interface AuthRequest extends Request {
  user?: {
    id: number;
    [key: string]: any;
  };
}

const router = Router();

// Helper for validation errors
function handleValidationError(res: Response, error: z.ZodError) {
  return res.status(400).json({
    message: "Validation error",
    errors: error.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message
    }))
  });
}

// Get all bot instances for the current user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const botInstances = await storage.getBotInstancesByUser(req.user.id);
    return res.json(botInstances);
  } catch (error) {
    console.error('Error getting bot instances:', error);
    return res.status(500).json({ message: 'Failed to get bot instances' });
  }
});

// Get a specific bot instance by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const botId = parseInt(req.params.id);
    if (isNaN(botId)) {
      return res.status(400).json({ message: 'Invalid bot ID' });
    }

    const botInstance = await storage.getBotInstance(botId);
    if (!botInstance || botInstance.userId !== req.user.id) {
      return res.status(404).json({ message: 'Bot instance not found' });
    }

    return res.json(botInstance);
  } catch (error) {
    console.error('Error getting bot instance:', error);
    return res.status(500).json({ message: 'Failed to get bot instance' });
  }
});

// Create a new bot instance
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Add userId to the request body
    const botData = {
      ...req.body,
      userId: req.user.id
    };

    // Validate the bot data
    const result = insertBotInstanceSchema.safeParse(botData);
    if (!result.success) {
      return handleValidationError(res, result.error);
    }

    // Validate strategy exists
    const strategy = await storage.getStrategy(botData.strategyId);
    if (!strategy || strategy.userId !== req.user.id) {
      return res.status(400).json({ message: 'Strategy not found' });
    }

    // Validate API integration exists
    const apiIntegration = await storage.getApiIntegration(botData.apiIntegrationId);
    if (!apiIntegration || apiIntegration.userId !== req.user.id) {
      return res.status(400).json({ message: 'API integration not found' });
    }

    // Create the bot instance
    const bot = await storage.createBotInstance(botData as InsertBotInstance);
    return res.status(201).json(bot);
  } catch (error) {
    console.error('Error creating bot instance:', error);
    return res.status(500).json({ message: 'Failed to create bot instance' });
  }
});

// Update a bot instance
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const botId = parseInt(req.params.id);
    if (isNaN(botId)) {
      return res.status(400).json({ message: 'Invalid bot ID' });
    }

    // Check if the bot instance exists and belongs to the user
    const existingBot = await storage.getBotInstance(botId);
    if (!existingBot || existingBot.userId !== req.user.id) {
      return res.status(404).json({ message: 'Bot instance not found' });
    }

    // Validate the update data (partial validation)
    const updateSchema = insertBotInstanceSchema.partial().safeParse(req.body);
    if (!updateSchema.success) {
      return handleValidationError(res, updateSchema.error);
    }

    // If the API integration is being updated, validate it exists
    if (req.body.apiIntegrationId) {
      const apiIntegration = await storage.getApiIntegration(req.body.apiIntegrationId);
      if (!apiIntegration || apiIntegration.userId !== req.user.id) {
        return res.status(400).json({ message: 'API integration not found' });
      }
    }

    // If the strategy is being updated, validate it exists
    if (req.body.strategyId) {
      const strategy = await storage.getStrategy(req.body.strategyId);
      if (!strategy || strategy.userId !== req.user.id) {
        return res.status(400).json({ message: 'Strategy not found' });
      }
    }

    // Update the bot instance
    const updatedBot = await storage.updateBotInstance(botId, req.body);
    return res.json(updatedBot);
  } catch (error) {
    console.error('Error updating bot instance:', error);
    return res.status(500).json({ message: 'Failed to update bot instance' });
  }
});

// Delete a bot instance
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const botId = parseInt(req.params.id);
    if (isNaN(botId)) {
      return res.status(400).json({ message: 'Invalid bot ID' });
    }

    // Check if the bot instance exists and belongs to the user
    const existingBot = await storage.getBotInstance(botId);
    if (!existingBot || existingBot.userId !== req.user.id) {
      return res.status(404).json({ message: 'Bot instance not found' });
    }

    // Delete the bot instance
    await storage.deleteBotInstance(botId);
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting bot instance:', error);
    return res.status(500).json({ message: 'Failed to delete bot instance' });
  }
});

// Start a bot instance
router.post('/:id/start', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const botId = parseInt(req.params.id);
    if (isNaN(botId)) {
      return res.status(400).json({ message: 'Invalid bot ID' });
    }

    // Check if the bot instance exists and belongs to the user
    const bot = await storage.getBotInstance(botId);
    if (!bot || bot.userId !== req.user.id) {
      return res.status(404).json({ message: 'Bot instance not found' });
    }

    // Check if the bot is already running
    if (bot.status === 'running') {
      return res.status(400).json({ message: 'Bot is already running' });
    }

    // Update the bot status to running
    const startTime = new Date().toISOString();
    
    // Get the current runtime and update it
    const runtime = {
      ...bot.runtime,
      startedAt: startTime,
      lastHeartbeat: startTime,
      pausedAt: undefined
    };

    const updatedBot = await storage.updateBotInstance(botId, {
      status: 'running',
      runtime
    });

    // TODO: Add logic to actually start the bot's trading algorithm

    return res.json(updatedBot);
  } catch (error) {
    console.error('Error starting bot instance:', error);
    return res.status(500).json({ message: 'Failed to start bot instance' });
  }
});

// Pause a bot instance
router.post('/:id/pause', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const botId = parseInt(req.params.id);
    if (isNaN(botId)) {
      return res.status(400).json({ message: 'Invalid bot ID' });
    }

    // Check if the bot instance exists and belongs to the user
    const bot = await storage.getBotInstance(botId);
    if (!bot || bot.userId !== req.user.id) {
      return res.status(404).json({ message: 'Bot instance not found' });
    }

    // Check if the bot is running
    if (bot.status !== 'running') {
      return res.status(400).json({ message: 'Bot is not running' });
    }

    // Update the bot status to paused
    const pausedAt = new Date().toISOString();
    const runtime = {
      ...bot.runtime,
      pausedAt
    };

    const updatedBot = await storage.updateBotInstance(botId, {
      status: 'paused',
      runtime
    });

    // TODO: Add logic to pause the bot's trading algorithm

    return res.json(updatedBot);
  } catch (error) {
    console.error('Error pausing bot instance:', error);
    return res.status(500).json({ message: 'Failed to pause bot instance' });
  }
});

// Stop a bot instance
router.post('/:id/stop', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const botId = parseInt(req.params.id);
    if (isNaN(botId)) {
      return res.status(400).json({ message: 'Invalid bot ID' });
    }

    // Check if the bot instance exists and belongs to the user
    const bot = await storage.getBotInstance(botId);
    if (!bot || bot.userId !== req.user.id) {
      return res.status(404).json({ message: 'Bot instance not found' });
    }

    // Check if the bot is running or paused
    if (bot.status !== 'running' && bot.status !== 'paused') {
      return res.status(400).json({ message: 'Bot is not running or paused' });
    }

    // Calculate uptime if startedAt exists
    let uptime = bot.runtime.uptime || 0;
    if (bot.runtime.startedAt) {
      const startedAt = new Date(bot.runtime.startedAt);
      const now = new Date();
      
      // If the bot was paused, use the paused time instead of now
      const endTime = bot.runtime.pausedAt ? new Date(bot.runtime.pausedAt) : now;
      
      // Add the time between start and end to the existing uptime
      uptime += Math.floor((endTime.getTime() - startedAt.getTime()) / 1000);
    }

    const runtime = {
      ...bot.runtime,
      startedAt: undefined,
      pausedAt: undefined,
      uptime
    };

    const updatedBot = await storage.updateBotInstance(botId, {
      status: 'idle',
      runtime
    });

    // TODO: Add logic to stop the bot's trading algorithm

    return res.json(updatedBot);
  } catch (error) {
    console.error('Error stopping bot instance:', error);
    return res.status(500).json({ message: 'Failed to stop bot instance' });
  }
});

// Get bot trades
router.get('/:id/trades', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const botId = parseInt(req.params.id);
    if (isNaN(botId)) {
      return res.status(400).json({ message: 'Invalid bot ID' });
    }

    // Check if the bot instance exists and belongs to the user
    const bot = await storage.getBotInstance(botId);
    if (!bot || bot.userId !== req.user.id) {
      return res.status(404).json({ message: 'Bot instance not found' });
    }

    // Query parameters for filtering
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const symbol = req.query.symbol as string;
    const type = req.query.type as string;
    const tradingMode = req.query.tradingMode as string;
    const fromDate = req.query.fromDate as string;
    const toDate = req.query.toDate as string;

    // Get trades for the bot instance
    const trades = await storage.getBotTradesByInstance(botId);

    // Filter trades based on query parameters
    // Note: In a real implementation, this filtering would be done at the database level
    // This is a simplification for now
    let filteredTrades = trades;
    if (symbol) {
      filteredTrades = filteredTrades.filter(t => t.symbol === symbol);
    }
    if (type) {
      filteredTrades = filteredTrades.filter(t => t.type === type);
    }
    if (tradingMode) {
      filteredTrades = filteredTrades.filter(t => t.tradingMode === tradingMode);
    }
    if (fromDate) {
      const fromTimestamp = new Date(fromDate).getTime();
      filteredTrades = filteredTrades.filter(t => new Date(t.createdAt).getTime() >= fromTimestamp);
    }
    if (toDate) {
      const toTimestamp = new Date(toDate).getTime();
      filteredTrades = filteredTrades.filter(t => new Date(t.createdAt).getTime() <= toTimestamp);
    }

    // Apply pagination
    const paginatedTrades = filteredTrades.slice(offset, offset + limit);

    return res.json(paginatedTrades);
  } catch (error) {
    console.error('Error getting bot trades:', error);
    return res.status(500).json({ message: 'Failed to get bot trades' });
  }
});

// Get trading performance metrics
router.get('/:id/performance', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const botId = parseInt(req.params.id);
    if (isNaN(botId)) {
      return res.status(400).json({ message: 'Invalid bot ID' });
    }

    // Check if the bot instance exists and belongs to the user
    const bot = await storage.getBotInstance(botId);
    if (!bot || bot.userId !== req.user.id) {
      return res.status(404).json({ message: 'Bot instance not found' });
    }

    // Return the performance data from the bot instance
    return res.json(bot.performance || {
      profitLoss: 0,
      winRate: 0,
      totalTrades: 0,
      averageTradeLength: 0,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting bot performance:', error);
    return res.status(500).json({ message: 'Failed to get bot performance' });
  }
});

// Get current market insights for the bot's trading symbols
router.get('/:id/market-insights', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const botId = parseInt(req.params.id);
    if (isNaN(botId)) {
      return res.status(400).json({ message: 'Invalid bot ID' });
    }

    // Check if the bot instance exists and belongs to the user
    const bot = await storage.getBotInstance(botId);
    if (!bot || bot.userId !== req.user.id) {
      return res.status(404).json({ message: 'Bot instance not found' });
    }

    // Get market condition data
    const marketCondition = await storage.getLatestMarketCondition();
    
    // Get symbol-specific insights for each of the bot's symbols
    const symbolInsights = await Promise.all(
      bot.symbols.map(symbol => storage.getLatestSymbolInsight(symbol))
    );

    // Filter out any null results and combine the data
    const validSymbolInsights = symbolInsights.filter(insight => insight !== null && insight !== undefined);

    return res.json({
      marketCondition: marketCondition || {
        overallCondition: 'neutral',
        confidence: 0.5,
        indicators: {},
        insights: {},
        timestamp: new Date().toISOString()
      },
      symbolInsights: validSymbolInsights
    });
  } catch (error) {
    console.error('Error getting market insights:', error);
    return res.status(500).json({ message: 'Failed to get market insights' });
  }
});

export default router;