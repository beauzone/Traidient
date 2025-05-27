import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import CustomizableDashboard from "@/components/widgets/CustomizableDashboard";

interface PerformanceMetrics {
  totalValue: number;
  totalReturn: number;
  dailyPnL: number;
  totalTrades: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgTradeReturn: number;
}

interface StrategyPerformance {
  id: number;
  name: string;
  return: number;
  trades: number;
  winRate: number;
  sharpeRatio: number;
  status: 'active' | 'paused' | 'stopped';
  lastSignal?: string;
}

interface PortfolioData {
  date: string;
  value: number;
  return: number;
  benchmark?: number;
}

interface TradeAnalytics {
  symbol: string;
  trades: number;
  totalReturn: number;
  winRate: number;
  avgReturn: number;
  lastTrade: string;
}

export default function PerformanceDashboard() {
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1M');

  // Fetch user's portfolio performance
  const { data: performanceMetrics, isLoading: metricsLoading } = useQuery<PerformanceMetrics>({
    queryKey: ['/api/performance/metrics', timeframe],
    refetchInterval: 30000 // Update every 30 seconds
  });

  // Fetch strategy performance
  const { data: strategies, isLoading: strategiesLoading } = useQuery<StrategyPerformance[]>({
    queryKey: ['/api/performance/strategies'],
    refetchInterval: 60000 // Update every minute
  });

  // Fetch portfolio history
  const { data: portfolioHistory, isLoading: historyLoading } = useQuery<PortfolioData[]>({
    queryKey: ['/api/performance/portfolio-history', timeframe],
    refetchInterval: 300000 // Update every 5 minutes
  });

  // Fetch trade analytics
  const { data: tradeAnalytics, isLoading: analyticsLoading } = useQuery<TradeAnalytics[]>({
    queryKey: ['/api/performance/trade-analytics', timeframe],
    refetchInterval: 300000
  });

  if (metricsLoading || strategiesLoading || historyLoading || analyticsLoading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  // Combine all data for widgets
  const dashboardData = {
    ...performanceMetrics,
    strategies,
    portfolioHistory,
    tradeAnalytics
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Performance</h1>
              <p className="text-muted-foreground">Track your trading performance and strategy analytics</p>
            </div>
            <div className="flex gap-2">
              {(['1D', '1W', '1M', '3M', '1Y'] as const).map((tf) => (
                <Button
                  key={tf}
                  variant={timeframe === tf ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeframe(tf)}
                >
                  {tf}
                </Button>
              ))}
            </div>
          </div>

          {/* Customizable Dashboard */}
          <CustomizableDashboard 
            dashboardType="performance" 
            data={dashboardData}
          />

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Portfolio Value</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(performanceMetrics?.totalValue || 0)}
              </div>
              <div className={`text-xs flex items-center gap-1 ${
                (performanceMetrics?.totalReturn || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(performanceMetrics?.totalReturn || 0) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {formatPercent(performanceMetrics?.totalReturn || 0)} all time
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Daily P&L</CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                (performanceMetrics?.dailyPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(performanceMetrics?.dailyPnL || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                Today's performance
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
              <Target className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPercent(performanceMetrics?.winRate || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                {performanceMetrics?.totalTrades || 0} total trades
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sharpe Ratio</CardTitle>
              <BarChart3 className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(performanceMetrics?.sharpeRatio || 0).toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                Risk-adjusted returns
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="portfolio" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="strategies">Strategies</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="risk">Risk</TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Portfolio Performance Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Portfolio Performance</CardTitle>
                  <CardDescription>Your portfolio value over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={portfolioHistory || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Portfolio Value']} />
                      <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Risk Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Risk Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Max Drawdown</span>
                      <span className="text-red-600">
                        {formatPercent(performanceMetrics?.maxDrawdown || 0)}
                      </span>
                    </div>
                    <Progress 
                      value={Math.abs(performanceMetrics?.maxDrawdown || 0)} 
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Sharpe Ratio</span>
                      <span>{(performanceMetrics?.sharpeRatio || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Avg Trade Return</span>
                      <span className={`${
                        (performanceMetrics?.avgTradeReturn || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatPercent(performanceMetrics?.avgTradeReturn || 0)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="strategies" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {strategies?.map((strategy) => (
                <Card key={strategy.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{strategy.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={
                            strategy.status === 'active' ? 'default' : 
                            strategy.status === 'paused' ? 'secondary' : 'destructive'
                          }>
                            {strategy.status}
                          </Badge>
                          {strategy.lastSignal && (
                            <Badge variant="outline">
                              {strategy.lastSignal}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          strategy.return >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatPercent(strategy.return)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Trades</div>
                        <div className="font-medium">{strategy.trades}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Win Rate</div>
                        <div className="font-medium">{formatPercent(strategy.winRate)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Sharpe</div>
                        <div className="font-medium">{strategy.sharpeRatio.toFixed(2)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Performers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Top Performers
                  </CardTitle>
                  <CardDescription>Best performing symbols by return</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {tradeAnalytics?.slice(0, 5).map((trade, index) => (
                      <div key={trade.symbol} className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{trade.symbol}</div>
                            <div className="text-xs text-muted-foreground">
                              {trade.trades} trades • {formatPercent(trade.winRate)} win rate
                            </div>
                          </div>
                        </div>
                        <div className={`text-right ${
                          trade.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <div className="font-medium">{formatPercent(trade.totalReturn)}</div>
                          <div className="text-xs">{formatPercent(trade.avgReturn)} avg</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Trade Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Trade Distribution</CardTitle>
                  <CardDescription>Breakdown by symbol</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={tradeAnalytics?.slice(0, 5).map((trade, index) => ({
                          name: trade.symbol,
                          value: trade.trades,
                          fill: COLORS[index % COLORS.length]
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {tradeAnalytics?.slice(0, 5).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="risk" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Risk Assessment
                  </CardTitle>
                  <CardDescription>Portfolio risk analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Concentration Risk</span>
                        <span>Medium</span>
                      </div>
                      <Progress value={60} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Volatility Risk</span>
                        <span>Low</span>
                      </div>
                      <Progress value={30} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Drawdown Risk</span>
                        <span>High</span>
                      </div>
                      <Progress value={80} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Risk Recommendations</CardTitle>
                  <CardDescription>Suggestions to improve your risk profile</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Diversify Holdings</div>
                        <div className="text-xs text-muted-foreground">
                          Consider reducing concentration in top 3 positions
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Zap className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Optimize Position Sizing</div>
                        <div className="text-xs text-muted-foreground">
                          Implement risk-based position sizing
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}