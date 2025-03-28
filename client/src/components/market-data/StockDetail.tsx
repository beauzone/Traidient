import { useQuery } from "@tanstack/react-query";
import { fetchData, postData } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  LineChart as LineChartIcon,
  CalendarIcon,
  DollarSign,
  PercentIcon,
  BarChart2,
  Target,
  Award,
  Info,
  Bookmark,
  Share2,
  Bell
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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
  dayRange?: string;
  weekRange52?: string;
  beta?: number;
  averageVolume?: number;
  forwardPE?: number;
  dividendYield?: number;
  earningsDate?: string;
  exDividendDate?: string;
  previousClose?: number;
}

interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
  imageUrl?: string;
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

  // Mock news data (will be replaced with real API call)
  const mockNews = [
    {
      title: `Report: ${symbol}'s H2O Chip Faces Supply Crunch in China Amid Soaring Demand`,
      source: "GunFocus.com",
      publishedAt: "8 minutes ago",
      url: "#",
      summary: `Recent reports indicate that ${symbol} is experiencing production constraints for its latest H2O chip in China markets due to unexpected demand. This could potentially impact Q2 earnings projections.`
    },
    {
      title: `Brave Eagle CIO Says ${symbol} Valuation Offers Opportunity After Recent Decline`,
      source: "GunFocus.com",
      publishedAt: "1 hour ago",
      url: "#",
      summary: "Investment firm Brave Eagle believes the recent market correction presents a strategic buying opportunity as fundamentals remain strong."
    },
    {
      title: `Wall Street Analysts Adore Amazon, Microsoft, and ${symbol}. Here's Why That's Problematic.`,
      source: "Barrons.com",
      publishedAt: "1 hour ago",
      url: "#",
      summary: "Concentration of institutional holdings in mega-cap tech companies raises concerns about market vulnerability and broader economic implications."
    },
    {
      title: `${symbol}-Backed CoreWeave Slides In IPO Debut Amid Heightened AI Worries`,
      source: "Investor's Business Daily",
      publishedAt: "27 minutes ago",
      url: "#",
      summary: "The highly anticipated IPO of CoreWeave, backed by multiple tech giants including ${symbol}, saw a lukewarm reception as market sentiment shifts toward AI sustainability concerns."
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header and overview */}
      {isLoadingQuote ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : quote ? (
        <>
          {/* Stock Header */}
          <div>
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold">{symbol}</h1>
                  <Badge variant="outline" className="text-xs font-normal">
                    {quote.exchange}
                  </Badge>
                </div>
                <p className="text-lg text-muted-foreground">{quote.name}</p>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm">
                  <Bell className="h-4 w-4 mr-1" /> Alert
                </Button>
                <Button variant="outline" size="sm">
                  <Bookmark className="h-4 w-4 mr-1" /> Add to List
                </Button>
                <Button variant="outline" size="sm">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-baseline space-x-3 mb-1">
              <span className="text-4xl font-bold">{formatCurrency(quote.price)}</span>
              <span className={`flex items-center text-lg ${quote.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {quote.change >= 0 ? (
                  <TrendingUp className="mr-1 h-5 w-5" />
                ) : (
                  <TrendingDown className="mr-1 h-5 w-5" />
                )}
                {formatCurrency(quote.change)} ({formatPercentage(quote.changePercent)})
              </span>
            </div>
            
            <p className="text-sm text-muted-foreground">
              As of {new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: 'numeric' })} EDT. Market {quote.change >= 0 ? 'Open' : 'Closed'}.
              {quote.dataSource && (
                <span className="ml-2 flex items-center inline-block">
                  <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                    quote.dataSource === 'alpaca' ? 'bg-green-500' : 
                    quote.dataSource === 'yahoo' ? 'bg-purple-500' : 
                    quote.dataSource === 'alpaca-simulation' ? 'bg-blue-500' :
                    'bg-gray-500'
                  }`}></span>
                  Data: {quote.dataSource === 'yahoo' ? 'Yahoo Finance' : 
                         quote.dataSource === 'alpaca' ? 'Alpaca API' : 
                         quote.dataSource === 'alpaca-simulation' ? 'Market Simulation' :
                         quote.dataSource === 'reference-data-fallback' ? 'Reference Data' :
                         quote.dataSource}
                  {quote.isSimulated && ' (Simulated)'}
                </span>
              )}
            </p>
          </div>

          {/* Action Buttons */}  
          <div className="flex gap-3 mt-2">
            <Button>
              <DollarSign className="h-4 w-4 mr-2" /> Trade {symbol}
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" /> Create Strategy
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
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No data available for {symbol}</p>
        </div>
      )}

      {/* Price Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Price History</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
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

      {/* Key Statistics */}
      {quote && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Key Statistics</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-0">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Previous Close</p>
                    <p className="font-medium">{formatCurrency(quote.previousClose || quote.open)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Day Range</p>
                    <p className="font-medium">{quote.dayRange || `${formatCurrency(quote.low)} - ${formatCurrency(quote.high)}`}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">52 Week Range</p>
                    <p className="font-medium">{quote.weekRange52 || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Market Cap</p>
                    <p className="font-medium">{formatLargeNumber(quote.marketCap)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Volume</p>
                    <p className="font-medium">{formatLargeNumber(quote.volume)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Average Volume</p>
                    <p className="font-medium">{formatLargeNumber(quote.averageVolume || quote.volume)}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">P/E Ratio</p>
                    <p className="font-medium">{quote.peRatio.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Forward P/E</p>
                    <p className="font-medium">{quote.forwardPE?.toFixed(2) || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">EPS (TTM)</p>
                    <p className="font-medium">{formatCurrency(quote.eps)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dividend & Yield</p>
                    <p className="font-medium">
                      {formatCurrency(quote.dividend)} ({quote.dividendYield ? `${quote.dividendYield.toFixed(2)}%` : 'N/A'})
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Beta</p>
                    <p className="font-medium">{quote.beta?.toFixed(2) || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Exchange</p>
                    <p className="font-medium">{quote.exchange}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent News */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Recent News</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-0">
              <div className="space-y-4">
                {mockNews.map((news, index) => (
                  <div key={index} className={cn("pb-4", index < mockNews.length - 1 && "border-b border-border")}>
                    <a 
                      href={news.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="group block"
                    >
                      <h4 className="font-medium group-hover:text-primary transition-colors">{news.title}</h4>
                      <div className="flex items-center gap-2 mt-1 mb-2">
                        <span className="text-xs font-medium text-muted-foreground">{news.source}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">{news.publishedAt}</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{news.summary}</p>
                    </a>
                  </div>
                ))}
                <Button variant="outline" className="w-full mt-2">View More News</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default StockDetail;
