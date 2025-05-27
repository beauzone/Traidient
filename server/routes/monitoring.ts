import express from 'express';

const router = express.Router();

// Auth middleware (matching the one in routes.ts)
const authenticateToken = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.substring(7);
    const jwt = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
    
    const decoded = jwt.default.verify(token, JWT_SECRET) as { userId: number };
    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

// System health endpoint
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Calculate uptime in seconds
    const uptime = process.uptime();
    
    // Get memory usage in MB
    const memUsage = process.memoryUsage();
    const memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    // Response time calculation
    const responseTime = Date.now() - startTime;
    
    // Simple CPU usage estimation (this is a basic approximation)
    const cpuUsage = Math.random() * 20 + 5; // Simulated 5-25% for demo
    
    const health = {
      status: 'healthy' as const,
      uptime: Math.floor(uptime),
      activeConnections: 1, // Could be enhanced with actual WebSocket connection count
      responseTime,
      memoryUsage,
      cpuUsage: Math.round(cpuUsage * 100) / 100
    };

    res.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      uptime: 0,
      activeConnections: 0,
      responseTime: 0,
      memoryUsage: 0,
      cpuUsage: 0
    });
  }
});

// Trading metrics endpoint
router.get('/metrics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    // Get actual trading data from existing endpoints
    // We'll aggregate real data from your trading system
    
    // Mock data for now - in a real system, this would query your actual trading data
    const metrics = {
      totalPortfolioValue: 198595.2, // This would come from your actual portfolio
      dailyPnL: -1404.8, // This would be calculated from today's trades
      activePositions: 10, // Count from your positions API
      activeStrategies: 3, // Count from your strategies
      activeBots: 2, // Count from your bot instances
      totalTrades: 5, // Count from today's trades
      errorRate: 0.2 // Calculated from error logs
    };

    res.json(metrics);
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({
      totalPortfolioValue: 0,
      dailyPnL: 0,
      activePositions: 0,
      activeStrategies: 0,
      activeBots: 0,
      totalTrades: 0,
      errorRate: 0
    });
  }
});

// Data provider status endpoint
router.get('/data-status', authenticateToken, async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test connectivity to data providers
    // This would normally ping each service
    
    const dataStatus = {
      alpaca: 'connected' as const,
      yahoo: 'connected' as const,
      polygon: 'connected' as const,
      latency: {
        alpaca: Math.random() * 50 + 10, // 10-60ms
        yahoo: Math.random() * 100 + 50, // 50-150ms
        polygon: Math.random() * 75 + 25  // 25-100ms
      }
    };

    res.json(dataStatus);
  } catch (error) {
    console.error('Data status error:', error);
    res.status(500).json({
      alpaca: 'disconnected',
      yahoo: 'disconnected',
      polygon: 'disconnected',
      latency: { alpaca: 0, yahoo: 0, polygon: 0 }
    });
  }
});

// Alert rules endpoint
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    // This would query your alert_rules table
    // For now, returning some example alerts
    const alerts = [
      {
        id: 1,
        name: "Portfolio Loss Alert",
        description: "Alert when daily P&L drops below -$1000",
        isActive: true,
        conditions: {
          type: "portfolio",
          metric: "dailyPnL",
          operator: "less_than",
          threshold: -1000
        },
        lastTriggered: new Date().toISOString(),
        triggerCount: 2
      },
      {
        id: 2,
        name: "High Memory Usage",
        description: "Alert when system memory usage exceeds 500MB",
        isActive: true,
        conditions: {
          type: "system",
          metric: "memoryUsage",
          operator: "greater_than",
          threshold: 500
        },
        lastTriggered: null,
        triggerCount: 0
      }
    ];

    res.json(alerts);
  } catch (error) {
    console.error('Alerts error:', error);
    res.status(500).json([]);
  }
});

export default router;