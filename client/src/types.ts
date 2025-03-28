export interface Strategy {
  id: number;
  userId: number;
  name: string;
  description: string;
  type: 'ai-generated' | 'template' | 'custom';
  status: 'draft' | 'active' | 'inactive' | 'error';
  source: {
    type: 'natural-language' | 'visual-builder' | 'code';
    content: string;
  };
  configuration: {
    assets: string[];
    parameters: Record<string, any>;
    riskControls: {
      maxPositionSize: number;
      stopLoss: number;
      takeProfit: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface Deployment {
  id: number;
  userId: number;
  strategyId: number;
  status: 'starting' | 'running' | 'paused' | 'stopped' | 'error';
  environment: 'paper' | 'live';
  exchange: string;
  configuration: {
    capital: number;
    startDate: string;
    parameters: Record<string, any>;
  };
  runtime?: {
    lastHeartbeat: string;
    uptime: number;
    errors: {
      timestamp: string;
      message: string;
      stackTrace: string;
    }[];
  };
  performance?: {
    currentValue: number;
    profitLoss: number;
    profitLossPercent: number;
    trades: number;
    winRate: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistItem {
  id: number;
  symbol: string;
  name: string;
  lastPrice: string;
  change?: string;
  changePercent: string;
  isPositive: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}