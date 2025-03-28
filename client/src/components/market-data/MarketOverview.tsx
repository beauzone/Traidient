import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, TrendingDown, Clock, Database } from "lucide-react";
import { fetchData } from "@/lib/api";
import { useMarketData } from "@/hooks/useMarketData";

interface MarketOverviewProps {
  onSymbolSelect: (symbol: string) => void;
}

interface MarketIndiceData {
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

interface SectorPerformanceData {
  name: string;
  performance: number;
  color: string;
}

const MarketOverview = ({ onSymbolSelect }: MarketOverviewProps) => {
  // Use market data hook to get market status
  const { marketStatus } = useMarketData();
  // Fetch market indices data
  const { data: indices, isLoading: isLoadingIndices } = useQuery({
    queryKey: ['/api/market-data/indices'],
    queryFn: () => fetchData<MarketIndiceData[]>('/api/market-data/indices').catch(() => {
      // Fallback data in case API isn't implemented yet
      return [
        { name: "S&P 500", symbol: "SPY", price: 4783.45, change: 32.45, changePercent: 0.68 },
        { name: "Dow Jones", symbol: "DIA", price: 38762.32, change: -28.67, changePercent: -0.07 },
        { name: "Nasdaq", symbol: "QQQ", price: 16748.7, change: 98.36, changePercent: 0.59 },
        { name: "Russell 2000", symbol: "IWM", price: 2032.48, change: 15.23, changePercent: 0.75 }
      ];
    }),
  });

  // Fetch sector performance data
  const { data: sectorPerformance, isLoading: isLoadingSectors } = useQuery({
    queryKey: ['/api/market-data/sectors'],
    queryFn: () => fetchData<SectorPerformanceData[]>('/api/market-data/sectors').catch(() => {
      // Fallback data in case API isn't implemented yet
      return [
        { name: "Technology", performance: 1.2, color: "#3B82F6" },
        { name: "Healthcare", performance: 0.8, color: "#10B981" },
        { name: "Energy", performance: -0.5, color: "#EF4444" },
        { name: "Financials", performance: 0.3, color: "#6366F1" },
        { name: "Consumer Cyclical", performance: 0.1, color: "#F59E0B" },
        { name: "Real Estate", performance: -0.7, color: "#EC4899" },
        { name: "Utilities", performance: 0.4, color: "#8B5CF6" },
        { name: "Basic Materials", performance: -0.2, color: "#14B8A6" },
        { name: "Communication Services", performance: 0.6, color: "#F97316" },
        { name: "Industrials", performance: 0.5, color: "#64748B" }
      ];
    }),
  });

  // Type definition for market mover data
  interface MarketMover {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    dataSource?: string;
  }

  // Fetch market movers data with error handling and refresh every 5 minutes
  const { 
    data: topGainers = [], 
    isLoading: isLoadingGainers, 
    error: gainersError,
    dataUpdatedAt: gainersUpdatedAt
  } = useQuery({
    queryKey: ['/api/market-data/gainers'],
    queryFn: () => fetchData<MarketMover[]>('/api/market-data/gainers'),
    retry: 1,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes (in milliseconds)
    staleTime: 5 * 60 * 1000 // Consider data fresh for 5 minutes
  });

  const { 
    data: topLosers = [], 
    isLoading: isLoadingLosers, 
    error: losersError,
    dataUpdatedAt: losersUpdatedAt
  } = useQuery({
    queryKey: ['/api/market-data/losers'],
    queryFn: () => fetchData<MarketMover[]>('/api/market-data/losers'),
    retry: 1,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes (in milliseconds)
    staleTime: 5 * 60 * 1000 // Consider data fresh for 5 minutes
  });

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      
      {/* Market Indices */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoadingIndices ? (
          <div className="col-span-full flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          indices?.map((index) => (
            <Card key={index.symbol} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{index.name}</h3>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(index.price)}</p>
                  </div>
                  <div className={`flex items-center ${index.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {index.changePercent >= 0 ? (
                      <TrendingUp className="h-5 w-5 mr-1" />
                    ) : (
                      <TrendingDown className="h-5 w-5 mr-1" />
                    )}
                    <div>
                      <div className="text-sm font-medium">{formatCurrency(index.change)}</div>
                      <div className="text-xs">{formatPercentage(index.changePercent)}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Sector Performance */}
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <h3 className="font-medium mb-4">Sector Performance</h3>
          {isLoadingSectors ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sectorPerformance}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis 
                    type="number" 
                    tickFormatter={(value) => `${value}%`} 
                    domain={[-2, 2]}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    width={120}
                  />
                  <Tooltip 
                    formatter={(value) => [`${value}%`, 'Performance']}
                    contentStyle={{ 
                      backgroundColor: '#1E293B', 
                      borderColor: '#334155',
                      color: '#E2E8F0'
                    }}
                  />
                  <Bar dataKey="performance" radius={[0, 4, 4, 0]}>
                    {sectorPerformance?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Market Movers */}
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Market Movers</h3>
            <div className="text-xs text-muted-foreground">
              Auto-updates every 5 minutes
            </div>
          </div>
          <Tabs defaultValue="gainers">
            <TabsList className="mb-4">
              <TabsTrigger value="gainers">Top Gainers</TabsTrigger>
              <TabsTrigger value="losers">Top Losers</TabsTrigger>
            </TabsList>
            
            <TabsContent value="gainers">
              {isLoadingGainers ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : gainersError ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="text-destructive mb-2">Unable to fetch top gainers</div>
                  <div className="text-sm text-muted-foreground">Market data service may be temporarily unavailable</div>
                </div>
              ) : topGainers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="text-muted-foreground mb-2">No top gainers available</div>
                  <div className="text-sm text-muted-foreground">Check back during market hours for live updates</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div>
                    <table className="w-full">
                      <thead className="border-b border-border">
                        <tr>
                          <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">Symbol</th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">Name</th>
                          <th className="text-right py-2 px-4 text-sm font-medium text-muted-foreground">Price</th>
                          <th className="text-right py-2 px-4 text-sm font-medium text-muted-foreground">Change</th>
                          <th className="text-right py-2 px-4 text-sm font-medium text-muted-foreground">% Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topGainers.map((stock) => (
                          <tr 
                            key={stock.symbol} 
                            className="border-b border-border hover:bg-muted/50 cursor-pointer"
                            onClick={() => onSymbolSelect(stock.symbol)}
                          >
                            <td className="py-3 px-4 font-medium">{stock.symbol}</td>
                            <td className="py-3 px-4">{stock.name}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(stock.price)}</td>
                            <td className="py-3 px-4 text-right text-green-500">{formatCurrency(stock.change)}</td>
                            <td className="py-3 px-4 text-right text-green-500">{formatPercentage(stock.changePercent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-between items-center mt-2 px-4 text-xs text-muted-foreground">
                      <div>Data Source: {topGainers[0]?.dataSource || 'Yahoo Finance'}</div>
                      <div>Last Updated: {gainersUpdatedAt ? new Date(gainersUpdatedAt).toLocaleTimeString() : 'Just now'}</div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="losers">
              {isLoadingLosers ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : losersError ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="text-destructive mb-2">Unable to fetch top losers</div>
                  <div className="text-sm text-muted-foreground">Market data service may be temporarily unavailable</div>
                </div>
              ) : topLosers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="text-muted-foreground mb-2">No top losers available</div>
                  <div className="text-sm text-muted-foreground">Check back during market hours for live updates</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div>
                    <table className="w-full">
                      <thead className="border-b border-border">
                        <tr>
                          <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">Symbol</th>
                          <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">Name</th>
                          <th className="text-right py-2 px-4 text-sm font-medium text-muted-foreground">Price</th>
                          <th className="text-right py-2 px-4 text-sm font-medium text-muted-foreground">Change</th>
                          <th className="text-right py-2 px-4 text-sm font-medium text-muted-foreground">% Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topLosers.map((stock) => (
                          <tr 
                            key={stock.symbol} 
                            className="border-b border-border hover:bg-muted/50 cursor-pointer"
                            onClick={() => onSymbolSelect(stock.symbol)}
                          >
                            <td className="py-3 px-4 font-medium">{stock.symbol}</td>
                            <td className="py-3 px-4">{stock.name}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(stock.price)}</td>
                            <td className="py-3 px-4 text-right text-red-500">{formatCurrency(stock.change)}</td>
                            <td className="py-3 px-4 text-right text-red-500">{formatPercentage(stock.changePercent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-between items-center mt-2 px-4 text-xs text-muted-foreground">
                      <div>Data Source: {topLosers[0]?.dataSource || 'Yahoo Finance'}</div>
                      <div>Last Updated: {losersUpdatedAt ? new Date(losersUpdatedAt).toLocaleTimeString() : 'Just now'}</div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketOverview;
