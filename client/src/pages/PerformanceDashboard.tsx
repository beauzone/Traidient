import { useState } from "react";
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
  totalValue: number;
  totalPnL: number;
  returnPct: number;
  positions: number;
  trades: number;
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
        </div>
      </div>
    </MainLayout>
  );
}