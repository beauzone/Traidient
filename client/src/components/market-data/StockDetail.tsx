import { useQuery } from "@tanstack/react-query";
import { fetchData, postData } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar
} from "recharts";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Loader2, TrendingUp, TrendingDown, Plus, LineChart as LineChartIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link } from "wouter";

interface StockDetailProps {
  symbol: string;
}

interface QuoteData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  marketCap: number;
  peRatio: number;
  dividend: number;
  eps: number;
  exchange: string;
  isSimulated?: boolean;
  dataSource?: string;
}

interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const StockDetail = ({ symbol }: StockDetailProps) => {
  const { toast } = useToast();

  // Fetch stock quote data
  const { data: quote, isLoading: isLoadingQuote } = useQuery({
    queryKey: [`/api/market-data/quote/${symbol}`],
    queryFn: () => fetchData<QuoteData>(`/api/market-data/quote/${symbol}`).catch(() => {
      // Fallback data in case API isn't implemented yet
      return {
        symbol,
        name: `${symbol} Inc.`,
        price: 182.63,
        change: 2.14,
        changePercent: 1.18,
        open: 180.50,
        high: 183.25,
        low: 180.25,
        volume: 56200000,
        marketCap: 2840000000000,
        peRatio: 30.5,
        dividend: 0.96,
        eps: 5.98,
        exchange: "NASDAQ",
        isSimulated: true,
        dataSource: "reference-data-fallback"
      };
    }),
  });

  // Fetch historical price data
  const { data: historicalData, isLoading: isLoadingHistorical } = useQuery({
    queryKey: [`/api/market-data/historical/${symbol}`],
    queryFn: () => fetchData<HistoricalDataPoint[]>(`/api/market-data/historical/${symbol}`).catch(() => {
      // Fallback data in case API isn't implemented yet
      const mockData = [];
      const basePrice = 180;
      const today = new Date();
      
      for (let i = 100; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        
        // Add some random fluctuation to create realistic-looking data
        const randomFactor = 1 + (Math.random() * 0.1 - 0.05);
        const close = basePrice * randomFactor * (1 + i * 0.001);
        const open = close * (1 + (Math.random() * 0.02 - 0.01));
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        const volume = Math.floor(Math.random() * 10000000) + 30000000;
        
        mockData.push({
          date: date.toISOString().split('T')[0],
          open,
          high,
          low,
          close,
          volume
        });
      }
      
      return mockData;
    }),
  });

  // Create strategy mutation
  const createStrategy = useMutation({
    mutationFn: (prompt: string) => postData('/api/bot-builder/generate', { prompt }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/strategies'] });
      toast({
        title: "Strategy generated",
        description: "Navigate to Bot Builder to customize and save your strategy",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to generate strategy",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
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

  // Format large numbers
  const formatLargeNumber = (value: number) => {
    if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toString();
  };

  // Generate a strategy prompt for this symbol
  const generateStrategyPrompt = () => {
    return `Create a momentum trading strategy for ${symbol} that buys when the price breaks above the 50-day moving average and sells when the price drops below the 20-day moving average. Include stop loss of 5% and take profit of 15%.`;
  };

  return (
    <div className="space-y-6">
      {/* Quote Card */}
      <Card>
        <CardContent className="p-6">
          {isLoadingQuote ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : quote ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-baseline">
                  <h2 className="text-2xl font-bold">{quote.symbol}</h2>
                  <span className="ml-2 text-muted-foreground">{quote.exchange}</span>
                </div>
                <p className="text-muted-foreground">{quote.name}</p>
                <div className="mt-4 flex items-baseline">
                  <span className="text-3xl font-bold">{formatCurrency(quote.price)}</span>
                  <span className={`ml-3 flex items-center ${quote.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {quote.change >= 0 ? (
                      <TrendingUp className="mr-1 h-5 w-5" />
                    ) : (
                      <TrendingDown className="mr-1 h-5 w-5" />
                    )}
                    {formatCurrency(quote.change)} ({formatPercentage(quote.changePercent)})
                  </span>
                </div>

                {quote.dataSource && (
                  <div className="mt-2">
                    <span className="text-xs text-muted-foreground flex items-center">
                      <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                        quote.dataSource === 'alpaca' ? 'bg-green-500' : 
                        quote.dataSource === 'yahoo' ? 'bg-yellow-500' : 
                        quote.dataSource === 'alpaca-simulation' ? 'bg-blue-500' :
                        'bg-gray-500'
                      }`}></span>
                      Source: {quote.dataSource === 'yahoo' ? 'Yahoo Finance' : 
                               quote.dataSource === 'alpaca' ? 'Alpaca API' : 
                               quote.dataSource === 'alpaca-simulation' ? 'Market Simulation' :
                               quote.dataSource === 'reference-data-fallback' ? 'Reference Data' :
                               quote.dataSource}
                      {quote.isSimulated && ' (Simulated)'}
                    </span>
                  </div>
                )}
                
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Open</p>
                    <p className="font-medium">{formatCurrency(quote.open)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Volume</p>
                    <p className="font-medium">{formatLargeNumber(quote.volume)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">High</p>
                    <p className="font-medium">{formatCurrency(quote.high)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Low</p>
                    <p className="font-medium">{formatCurrency(quote.low)}</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Market Cap</p>
                    <p className="font-medium">{formatLargeNumber(quote.marketCap)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">P/E Ratio</p>
                    <p className="font-medium">{quote.peRatio.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">EPS</p>
                    <p className="font-medium">{formatCurrency(quote.eps)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dividend</p>
                    <p className="font-medium">{formatCurrency(quote.dividend)}</p>
                  </div>
                </div>

                <div className="mt-6 space-x-2">
                  <Button>Trade {quote.symbol}</Button>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Plus className="mr-2 h-4 w-4" /> Create Strategy
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Strategy for {quote.symbol}</DialogTitle>
                        <DialogDescription>
                          Generate an AI-powered trading strategy for this asset
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <p className="text-sm text-muted-foreground mb-4">
                          We'll create a momentum-based strategy for {quote.symbol} that you can customize and backtest.
                        </p>
                        <div className="flex items-center space-x-2">
                          <LineChartIcon className="h-12 w-12 text-primary" />
                          <div>
                            <h4 className="font-medium">Momentum Strategy</h4>
                            <p className="text-sm text-muted-foreground">
                              Buy on breakouts, sell on pullbacks
                            </p>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" asChild>
                          <Link href="/bot-builder">Advanced Builder</Link>
                        </Button>
                        <Button 
                          onClick={() => createStrategy.mutate(generateStrategyPrompt())}
                          disabled={createStrategy.isPending}
                        >
                          {createStrategy.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                            </>
                          ) : (
                            "Generate Strategy"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No data available for {symbol}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Price Chart */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-medium mb-4">Price History</h3>
          {isLoadingHistorical ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : historicalData && historicalData.length > 0 ? (
            <div>
              <Tabs defaultValue="1M">
                <TabsList className="mb-4">
                  <TabsTrigger value="1D">1D</TabsTrigger>
                  <TabsTrigger value="1W">1W</TabsTrigger>
                  <TabsTrigger value="1M">1M</TabsTrigger>
                  <TabsTrigger value="3M">3M</TabsTrigger>
                  <TabsTrigger value="1Y">1Y</TabsTrigger>
                  <TabsTrigger value="ALL">ALL</TabsTrigger>
                </TabsList>
                
                <TabsContent value="1D" className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={historicalData.slice(-1)}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                      />
                      <YAxis 
                        domain={['dataMin', 'dataMax']}
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <Tooltip 
                        formatter={(value) => [formatCurrency(Number(value)), 'Price']}
                        contentStyle={{ 
                          backgroundColor: '#1E293B', 
                          borderColor: '#334155',
                          color: '#E2E8F0'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="close" 
                        stroke="#3B82F6" 
                        dot={false}
                        strokeWidth={2}
                      />
                      <ReferenceLine 
                        y={quote?.price || 0} 
                        stroke="#64748B" 
                        strokeDasharray="3 3" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </TabsContent>
                
                <TabsContent value="1W" className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={historicalData.slice(-7)}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                      />
                      <YAxis 
                        domain={['dataMin', 'dataMax']}
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <Tooltip 
                        formatter={(value) => [formatCurrency(Number(value)), 'Price']}
                        contentStyle={{ 
                          backgroundColor: '#1E293B', 
                          borderColor: '#334155',
                          color: '#E2E8F0'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="close" 
                        stroke="#3B82F6" 
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </TabsContent>
                
                <TabsContent value="1M" className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={historicalData.slice(-30)}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                      />
                      <YAxis 
                        domain={['dataMin', 'dataMax']}
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <Tooltip 
                        formatter={(value) => [formatCurrency(Number(value)), 'Price']}
                        contentStyle={{ 
                          backgroundColor: '#1E293B', 
                          borderColor: '#334155',
                          color: '#E2E8F0'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="close" 
                        stroke="#3B82F6" 
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </TabsContent>
                
                <TabsContent value="3M" className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={historicalData.slice(-90)}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                      />
                      <YAxis 
                        domain={['dataMin', 'dataMax']}
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <Tooltip 
                        formatter={(value) => [formatCurrency(Number(value)), 'Price']}
                        contentStyle={{ 
                          backgroundColor: '#1E293B', 
                          borderColor: '#334155',
                          color: '#E2E8F0'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="close" 
                        stroke="#3B82F6" 
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </TabsContent>
                
                <TabsContent value="1Y" className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={historicalData}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                      />
                      <YAxis 
                        domain={['dataMin', 'dataMax']}
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <Tooltip 
                        formatter={(value) => [formatCurrency(Number(value)), 'Price']}
                        contentStyle={{ 
                          backgroundColor: '#1E293B', 
                          borderColor: '#334155',
                          color: '#E2E8F0'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="close" 
                        stroke="#3B82F6" 
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </TabsContent>
                
                <TabsContent value="ALL" className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={historicalData}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                      />
                      <YAxis 
                        domain={['dataMin', 'dataMax']}
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <Tooltip 
                        formatter={(value) => [formatCurrency(Number(value)), 'Price']}
                        contentStyle={{ 
                          backgroundColor: '#1E293B', 
                          borderColor: '#334155',
                          color: '#E2E8F0'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="close" 
                        stroke="#3B82F6" 
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </TabsContent>
              </Tabs>

              <div className="mt-4 pt-4 border-t border-border">
                <h4 className="text-sm font-medium mb-2">Volume</h4>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={historicalData.slice(-30)}
                      margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickFormatter={(value) => formatLargeNumber(value)}
                      />
                      <Tooltip 
                        formatter={(value) => [formatLargeNumber(Number(value)), 'Volume']}
                        contentStyle={{ 
                          backgroundColor: '#1E293B', 
                          borderColor: '#334155',
                          color: '#E2E8F0'
                        }}
                      />
                      <Bar dataKey="volume" fill="#3B82F6" opacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No historical data available for {symbol}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StockDetail;
