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
    
    // Get user's accounts and calculate metrics
    const accounts = await storage.getAccountsByUser(userId);
    const botTrades = await storage.getBotTradesByUser(userId);
    
    let totalValue = 0;
    let totalEquity = 0;
    let totalReturn = 0;
    let dailyPnL = 0;
    
    // Calculate portfolio metrics from accounts
    for (const account of accounts) {
      totalValue += account.portfolioValue || 0;
      totalEquity += account.equity || 0;
      
      // Calculate return based on initial value (simplified)
      const initialValue = account.balance || 100000; // Default if no balance
      totalReturn += ((account.portfolioValue || 0) - initialValue) / initialValue * 100;
    }
    
    // Calculate trading metrics from bot trades
    const totalTrades = botTrades.length;
    const winningTrades = botTrades.filter(trade => (trade.pnl || 0) > 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    // Calculate daily P&L (trades from today)
    const today = new Date().toISOString().split('T')[0];
    const todayTrades = botTrades.filter(trade => 
      trade.enteredAt && trade.enteredAt.toString().startsWith(today)
    );
    dailyPnL = todayTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    
    // Calculate average trade return
    const avgTradeReturn = totalTrades > 0 
      ? botTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0) / totalTrades 
      : 0;
    
    // Calculate Sharpe ratio (simplified)
    const returns = botTrades.map(trade => trade.pnl || 0);
    const avgReturn = returns.length > 0 ? returns.reduce((sum, ret) => sum + ret, 0) / returns.length : 0;
    const stdDev = returns.length > 1 
      ? Math.sqrt(returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / (returns.length - 1))
      : 0;
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    
    // Calculate max drawdown (simplified)
    let maxDrawdown = 0;
    let peak = totalValue;
    if (totalValue < peak) {
      const drawdown = ((peak - totalValue) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    const metrics = {
      totalValue,
      totalReturn: totalReturn / Math.max(accounts.length, 1), // Average return across accounts
      dailyPnL,
      totalTrades,
      winRate,
      sharpeRatio,
      maxDrawdown,
      avgTradeReturn: (avgTradeReturn / Math.max(totalValue, 1)) * 100 // As percentage
    };
    
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

// Get user's strategy performance
router.get('/strategies', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    
    // Get user's strategies
    const strategies = await storage.getStrategiesByUser(userId);
    const botInstances = await storage.getBotInstancesByUser(userId);
    
    const strategyPerformance = await Promise.all(
      strategies.map(async (strategy) => {
        // Get bot instances for this strategy
        const strategyBots = botInstances.filter(bot => bot.strategyId === strategy.id);
        
        // Get trades for all bots using this strategy
        const allTrades = [];
        for (const bot of strategyBots) {
          const trades = await storage.getBotTradesByInstance(bot.id);
          allTrades.push(...trades);
        }
        
        // Calculate strategy metrics
        const totalTrades = allTrades.length;
        const winningTrades = allTrades.filter(trade => (trade.pnl || 0) > 0).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        
        const totalReturn = allTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
        const returns = allTrades.map(trade => trade.pnl || 0);
        const avgReturn = returns.length > 0 ? returns.reduce((sum, ret) => sum + ret, 0) / returns.length : 0;
        const stdDev = returns.length > 1 
          ? Math.sqrt(returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / (returns.length - 1))
          : 0;
        const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
        
        // Determine status based on bot instances
        let status: 'active' | 'paused' | 'stopped' = 'stopped';
        if (strategyBots.some(bot => bot.isActive)) {
          status = 'active';
        } else if (strategyBots.length > 0) {
          status = 'paused';
        }
        
        // Get last signal (simplified)
        const lastSignal = allTrades.length > 0 ? allTrades[allTrades.length - 1].type : undefined;
        
        return {
          id: strategy.id,
          name: strategy.name,
          return: (totalReturn / Math.max(100000, 1)) * 100, // As percentage of initial capital
          trades: totalTrades,
          winRate,
          sharpeRatio,
          status,
          lastSignal
        };
      })
    );
    
    res.json(strategyPerformance);
  } catch (error) {
    console.error('Error fetching strategy performance:', error);
    res.status(500).json({ error: 'Failed to fetch strategy performance' });
  }
});

// Get portfolio history
router.get('/portfolio-history', authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const timeframe = req.query.timeframe as string || '1M';
    
    // Get user's accounts for current value
    const accounts = await storage.getAccountsByUser(userId);
    const currentValue = accounts.reduce((sum, acc) => sum + (acc.portfolioValue || 0), 0);
    
    // Generate historical data (in a real app, this would come from stored historical data)
    const days = timeframe === '1D' ? 1 : timeframe === '1W' ? 7 : timeframe === '1M' ? 30 : timeframe === '3M' ? 90 : 365;
    const history = [];
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Simulate portfolio growth with some volatility
      const baseValue = currentValue;
      const volatility = Math.random() * 0.02 - 0.01; // ±1% daily volatility
      const trend = (days - i) / days * 0.1; // 10% growth over period
      const value = baseValue * (1 + trend + volatility);
      
      history.push({
        date: date.toISOString().split('T')[0],
        value: Math.max(value, baseValue * 0.8), // Don't go below 80% of current
        return: ((value - baseValue) / baseValue) * 100,
        benchmark: i * 0.03 // Simple benchmark
      });
    }
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching portfolio history:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio history' });
  }
});

// Get trade analytics
router.get('/trade-analytics', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const timeframe = req.query.timeframe as string || '1M';
    
    // Get user's trades
    const trades = await storage.getBotTradesByUser(userId);
    
    // Group trades by symbol
    const symbolMap = new Map<string, {
      trades: number;
      totalReturn: number;
      winningTrades: number;
      lastTrade: Date;
    }>();
    
    trades.forEach(trade => {
      const symbol = trade.symbol;
      const existing = symbolMap.get(symbol) || {
        trades: 0,
        totalReturn: 0,
        winningTrades: 0,
        lastTrade: new Date(0)
      };
      
      existing.trades += 1;
      existing.totalReturn += trade.pnl || 0;
      if ((trade.pnl || 0) > 0) existing.winningTrades += 1;
      if (trade.enteredAt && new Date(trade.enteredAt) > existing.lastTrade) {
        existing.lastTrade = new Date(trade.enteredAt);
      }
      
      symbolMap.set(symbol, existing);
    });
    
    // Convert to array and calculate metrics
    const analytics = Array.from(symbolMap.entries()).map(([symbol, data]) => ({
      symbol,
      trades: data.trades,
      totalReturn: (data.totalReturn / Math.max(100000, 1)) * 100, // As percentage
      winRate: data.trades > 0 ? (data.winningTrades / data.trades) * 100 : 0,
      avgReturn: data.trades > 0 ? (data.totalReturn / data.trades / Math.max(100000, 1)) * 100 : 0,
      lastTrade: data.lastTrade.toISOString()
    }));
    
    // Sort by total return descending
    analytics.sort((a, b) => b.totalReturn - a.totalReturn);
    
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching trade analytics:', error);
    res.status(500).json({ error: 'Failed to fetch trade analytics' });
  }
});

export default router;