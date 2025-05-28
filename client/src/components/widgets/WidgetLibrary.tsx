import { TrendingUp, TrendingDown, Target, Activity, DollarSign, BarChart3, AlertTriangle, Trophy, Shield, PieChart } from "lucide-react";
import { LineChart, Line, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, PieChart as RechartsPieChart, Pie, Cell } from "recharts";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

// Widget component definitions
export const PortfolioValueWidget = ({ data }: { data: any }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="flex flex-col justify-center h-full">
      <div className="text-2xl font-bold">
        {formatCurrency(data?.totalValue || 0)}
      </div>
      <div className={`text-sm flex items-center gap-1 ${
        (data?.totalReturn || 0) >= 0 ? 'text-green-600' : 'text-red-600'
      }`}>
        {(data?.totalReturn || 0) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {formatPercent(data?.totalReturn || 0)} all time
      </div>
    </div>
  );
};

export const DailyPnLWidget = ({ data }: { data: any }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="flex flex-col justify-center h-full">
      <div className={`text-2xl font-bold ${
        (data?.dailyPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'
      }`}>
        {formatCurrency(data?.dailyPnL || 0)}
      </div>
      <div className="text-sm text-muted-foreground">
        Today's performance
      </div>
    </div>
  );
};

export const WinRateWidget = ({ data }: { data: any }) => {
  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="flex flex-col justify-center h-full">
      <div className="text-2xl font-bold">
        {formatPercent(data?.winRate || 0)}
      </div>
      <div className="text-sm text-muted-foreground">
        {data?.totalTrades || 0} total trades
      </div>
    </div>
  );
};

export const SharpeRatioWidget = ({ data }: { data: any }) => {
  return (
    <div className="flex flex-col justify-center h-full">
      <div className="text-2xl font-bold">
        {(data?.sharpeRatio || 0).toFixed(2)}
      </div>
      <div className="text-sm text-muted-foreground">
        Risk-adjusted returns
      </div>
    </div>
  );
};

export const PortfolioChartWidget = ({ data }: { data: any }) => {
  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data?.portfolioHistory || []}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" hide />
          <YAxis hide />
          <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Value']} />
          <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const TopPerformersWidget = ({ data }: { data: any }) => {
  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="h-full">
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="h-4 w-4 text-yellow-500" />
        <span className="text-xs text-muted-foreground">Top Performers</span>
      </div>
      <div className="space-y-2 overflow-y-auto max-h-32">
        {data?.tradeAnalytics?.slice(0, 3).map((trade: any, index: number) => (
          <div key={trade.symbol} className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                {index + 1}
              </div>
              <span className="font-medium">{trade.symbol}</span>
            </div>
            <span className={`font-medium ${
              trade.returnPct >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatPercent(trade.returnPct)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const RiskMetricsWidget = ({ data }: { data: any }) => {
  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="h-full">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="h-4 w-4 text-red-500" />
        <span className="text-xs text-muted-foreground">Risk Metrics</span>
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>Max Drawdown</span>
            <span className="text-red-600">
              {formatPercent(data?.maxDrawdown || 0)}
            </span>
          </div>
          <Progress value={Math.abs(data?.maxDrawdown || 0)} className="h-1" />
        </div>
        <div className="flex justify-between text-xs">
          <span>Avg Trade Return</span>
          <span className={`${
            (data?.avgTradeReturn || 0) >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatPercent(data?.avgTradeReturn || 0)}
          </span>
        </div>
      </div>
    </div>
  );
};

export const StrategiesWidget = ({ data }: { data: any }) => {
  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="h-full">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-4 w-4 text-indigo-500" />
        <span className="text-xs text-muted-foreground">Active Strategies</span>
      </div>
      <div className="space-y-2 overflow-hidden max-w-full">
        {data?.strategies?.slice(0, 3).map((strategy: any) => (
          <div key={strategy.id} className="text-xs w-full">
            <div className="flex justify-between items-center w-full min-w-0">
              <span className="font-medium truncate pr-2 flex-1 min-w-0">{strategy.name}</span>
              <span className={`font-medium flex-shrink-0 ${
                strategy.return >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatPercent(strategy.return)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1 w-full">
              <Badge variant="outline" className="text-xs px-1 py-0 flex-shrink-0">
                {strategy.status}
              </Badge>
              <span className="text-muted-foreground text-xs truncate ml-2">{strategy.trades} trades</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Dashboard Widgets for Trading Platform
export const MainPortfolioValueWidget = ({ data }: { data: any }) => {
  const portfolioData = data?.portfolio;
  const formatCurrency = data?.formatCurrency || ((value: number) => `$${value.toLocaleString()}`);
  
  return (
    <div className="flex flex-col justify-center h-full">
      <div className="text-2xl font-bold">
        {formatCurrency(portfolioData?.totalValue || 0)}
      </div>
      <div className={`text-sm flex items-center gap-1 ${
        portfolioData?.dailyPnL?.isPositive ? 'text-green-600' : 'text-red-600'
      }`}>
        {portfolioData?.dailyPnL?.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {portfolioData?.dailyPnL?.percentage || '0.00%'} today
      </div>
    </div>
  );
};

export const MainPortfolioChartWidget = ({ data }: { data: any }) => {
  const portfolioData = data?.portfolio;
  const chartData = portfolioData?.chartData || [];
  
  return (
    <div className="h-full">
      <div className="mb-2 flex justify-between items-center">
        <span className="text-sm text-muted-foreground">Portfolio Performance</span>
        <div className="flex gap-1">
          {['1D', '1W', '1M', '1Y'].map((range) => (
            <button
              key={range}
              onClick={() => portfolioData?.onTimeRangeChange?.(range)}
              className={`px-2 py-1 text-xs rounded ${
                portfolioData?.timeRange === range ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" hide />
          <YAxis hide />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const MainAssetAllocationWidget = ({ data }: { data: any }) => {
  const allocationData = data?.portfolio?.assetAllocation || [];
  
  return (
    <div className="h-full">
      <div className="mb-2">
        <span className="text-sm text-muted-foreground">Asset Allocation</span>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <RechartsPieChart>
          <Pie
            data={allocationData}
            cx="50%"
            cy="50%"
            outerRadius={40}
            fill="#8884d8"
            dataKey="value"
            label={({name, value}) => `${name}: ${value}%`}
          >
            {allocationData.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
};

export const MainPositionsWidget = ({ data }: { data: any }) => {
  const positions = data?.trading?.positions || [];
  const isLoading = data?.trading?.isLoadingPositions;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <div className="h-full overflow-hidden">
      <div className="mb-2">
        <span className="text-sm text-muted-foreground">Current Positions</span>
      </div>
      <div className="space-y-2 overflow-y-auto h-full">
        {positions.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">No positions</div>
        ) : (
          positions.slice(0, 5).map((position: any, index: number) => (
            <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded">
              <div>
                <div className="font-medium text-sm">{position.symbol}</div>
                <div className="text-xs text-muted-foreground">{position.qty} shares</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">${position.marketValue?.toLocaleString()}</div>
                <div className={`text-xs ${position.unrealizedPl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {position.unrealizedPl >= 0 ? '+' : ''}${position.unrealizedPl?.toFixed(2)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const MainStrategiesWidget = ({ data }: { data: any }) => {
  const strategies = data?.strategies?.list || [];
  
  return (
    <div className="h-full overflow-hidden">
      <div className="mb-2">
        <span className="text-sm text-muted-foreground">Active Strategies</span>
      </div>
      <div className="space-y-2 overflow-y-auto h-full">
        {strategies.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">No strategies</div>
        ) : (
          strategies.slice(0, 4).map((strategy: any) => (
            <div key={strategy.id} className="flex justify-between items-center p-2 bg-muted/50 rounded">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{strategy.name}</div>
                <div className="text-xs text-muted-foreground">
                  {strategy.trades} trades • {strategy.winRate?.toFixed(1)}% win rate
                </div>
              </div>
              <div className="text-right ml-2">
                <div className={`text-sm font-medium ${strategy.return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {strategy.return >= 0 ? '+' : ''}{strategy.return?.toFixed(2)}%
                </div>
                <Badge variant={strategy.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                  {strategy.status}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Widget definitions for the library
export const WIDGET_DEFINITIONS = {
  'portfolio-value': {
    title: 'Portfolio Value',
    component: PortfolioValueWidget,
    defaultSize: 'medium' as const,
    category: 'portfolio'
  },
  'daily-pnl': {
    title: 'Daily P&L',
    component: DailyPnLWidget,
    defaultSize: 'medium' as const,
    category: 'portfolio'
  },
  'win-rate': {
    title: 'Win Rate',
    component: WinRateWidget,
    defaultSize: 'small' as const,
    category: 'performance'
  },
  'sharpe-ratio': {
    title: 'Sharpe Ratio',
    component: SharpeRatioWidget,
    defaultSize: 'small' as const,
    category: 'performance'
  },
  'portfolio-chart': {
    title: 'Portfolio Chart',
    component: PortfolioChartWidget,
    defaultSize: 'large' as const,
    category: 'charts'
  },
  'top-performers': {
    title: 'Top Performers',
    component: TopPerformersWidget,
    defaultSize: 'medium' as const,
    category: 'analytics'
  },
  'risk-metrics': {
    title: 'Risk Metrics',
    component: RiskMetricsWidget,
    defaultSize: 'medium' as const,
    category: 'risk'
  },
  'strategies': {
    title: 'Active Strategies',
    component: StrategiesWidget,
    defaultSize: 'medium' as const,
    category: 'strategies'
  },
  // Main Dashboard Widgets
  'main-portfolio-value': {
    title: 'Portfolio Value',
    component: MainPortfolioValueWidget,
    defaultSize: 'medium' as const,
    category: 'portfolio'
  },
  'main-portfolio-chart': {
    title: 'Portfolio Chart',
    component: MainPortfolioChartWidget,
    defaultSize: 'large' as const,
    category: 'charts'
  },
  'main-asset-allocation': {
    title: 'Asset Allocation',
    component: MainAssetAllocationWidget,
    defaultSize: 'medium' as const,
    category: 'portfolio'
  },
  'main-positions': {
    title: 'Current Positions',
    component: MainPositionsWidget,
    defaultSize: 'medium' as const,
    category: 'trading'
  },
  'main-strategies': {
    title: 'Active Strategies',
    component: MainStrategiesWidget,
    defaultSize: 'medium' as const,
    category: 'strategies'
  }
};