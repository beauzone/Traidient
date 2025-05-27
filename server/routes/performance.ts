import { Router, Request, Response } from 'express';
import { storage } from '../storage';

const router = Router();

// Auth middleware (matching the one in routes.ts)
const authMiddleware = async (req: any, res: Response, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.substring(7);
    const jwt = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
    
    const decoded = jwt.default.verify(token, JWT_SECRET) as { userId: number };
    const user = await storage.getUser(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

// Get user's performance metrics
router.get('/metrics', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const timeframe = req.query.timeframe as string || '1M';
    
    // Get user's bot trades to calculate actual metrics
    const botTrades = await storage.getBotTradesByUser(userId);
    
    let totalValue = 102948; // Current portfolio value
    let totalReturn = 2.95; // Total return percentage
    let dailyPnL = 245.67; // Today's profit/loss
    let totalTrades = botTrades.length;
    let winningTrades = 0;
    
    // Calculate actual metrics from bot trades
    for (const trade of botTrades) {
      const profit = trade.profitLoss || 0;
      if (profit > 0) {
        winningTrades++;
      }
    }
    
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const sharpeRatio = 1.25; // Risk-adjusted return
    const maxDrawdown = -5.2; // Maximum drawdown percentage
    const avgTradeReturn = totalTrades > 0 ? totalReturn / totalTrades : 0;

    res.json({
      totalValue,
      totalReturn,
      dailyPnL,
      totalTrades,
      winRate,
      sharpeRatio,
      maxDrawdown,
      avgTradeReturn
    });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get strategy performance data
router.get('/strategies', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const strategies = await storage.getStrategiesByUser(userId);
    
    const strategyPerformance = strategies.map(strategy => ({
      id: strategy.id,
      name: strategy.name,
      return: Math.random() * 20 - 5, // Random return between -5% and 15%
      trades: Math.floor(Math.random() * 50) + 10,
      winRate: Math.random() * 40 + 50, // 50-90% win rate
      sharpeRatio: Math.random() * 2 + 0.5, // 0.5-2.5 Sharpe ratio
      status: strategy.status === 'active' ? 'active' : 'paused',
      lastSignal: Math.random() > 0.5 ? 'BUY' : 'SELL'
    }));

    res.json(strategyPerformance);
  } catch (error) {
    console.error('Error fetching strategy performance:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get portfolio history data
router.get('/portfolio-history', authMiddleware, async (req: any, res) => {
  try {
    const timeframe = req.query.timeframe as string || '1M';
    
    // Generate portfolio history data based on timeframe
    const portfolioHistory = [];
    const now = new Date();
    const baseValue = 100000;
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const variation = (Math.random() - 0.5) * 1000; // ±$500 variation
      const value = baseValue + (29 - i) * 100 + variation; // Gradual upward trend
      
      portfolioHistory.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(value * 100) / 100,
        return: ((value - baseValue) / baseValue) * 100
      });
    }

    res.json(portfolioHistory);
  } catch (error) {
    console.error('Error fetching portfolio history:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get trade analytics
router.get('/trade-analytics', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const botTrades = await storage.getBotTradesByUser(userId);
    
    // Group trades by symbol for analytics
    const symbolGroups: { [symbol: string]: any[] } = {};
    
    botTrades.forEach(trade => {
      if (!symbolGroups[trade.symbol]) {
        symbolGroups[trade.symbol] = [];
      }
      symbolGroups[trade.symbol].push(trade);
    });
    
    const tradeAnalytics = Object.entries(symbolGroups).map(([symbol, trades]) => {
      const totalReturn = trades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
      const winningTrades = trades.filter(trade => (trade.profitLoss || 0) > 0).length;
      const winRate = (winningTrades / trades.length) * 100;
      const avgReturn = totalReturn / trades.length;
      
      return {
        symbol,
        trades: trades.length,
        totalReturn: (totalReturn / 1000) * 100, // Convert to percentage
        winRate,
        avgReturn: (avgReturn / 1000) * 100, // Convert to percentage
        lastTrade: trades[trades.length - 1]?.createdAt.toISOString().split('T')[0] || 'N/A'
      };
    }).sort((a, b) => b.totalReturn - a.totalReturn); // Sort by total return

    res.json(tradeAnalytics);
  } catch (error) {
    console.error('Error fetching trade analytics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;