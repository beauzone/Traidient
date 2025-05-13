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
import { createChart, ColorType, LineStyle, UTCTimestamp, CandlestickData, Time } from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface StockDetailProps {
  symbol: string;
}

// Define the "standard" quote format (used by Yahoo and most providers)
interface StandardQuote {
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
  previousClose?: number;
  dayRange?: string;
  weekRange52?: string;
  beta?: number;
  averageVolume?: number;
  forwardPE?: number;
  dividendYield?: number;
  earningsDate?: string;
  exDividendDate?: string;
}

// Define Alpaca's raw quote format
interface AlpacaRawQuote {
  ap?: number;  // ask price
  as?: number;  // ask size
  ax?: string;  // ask exchange
  bp?: number;  // bid price
  bs?: number;  // bid size
  bx?: string;  // bid exchange
  c?: string[]; // conditions
  t?: string;   // timestamp
  z?: string;   // tape
}

// Combined QuoteData type that can be one of the formats
type QuoteData = {
  symbol: string;
  name?: string;
  isSimulated?: boolean;
  dataSource?: string;
} & (StandardQuote | AlpacaRawQuote);

interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// TradingView Chart Component
interface TradingViewChartProps {
  data: HistoricalDataPoint[];
  theme?: 'light' | 'dark';
  timeRange: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';
  currentPrice?: number;
}

const TradingViewChart = ({ data, theme = 'dark', timeRange, currentPrice }: TradingViewChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    // Filter data based on timeRange
    let filteredData = [...data];
    if (timeRange === '1D') filteredData = data.slice(-1);
    else if (timeRange === '1W') filteredData = data.slice(-7);
    else if (timeRange === '1M') filteredData = data.slice(-30);
    else if (timeRange === '3M') filteredData = data.slice(-90);
    else if (timeRange === '1Y') filteredData = data.slice(-365);

    // If the chart already exists, dispose it
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Create the chart with dark theme optimal for trading
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: theme === 'dark' ? '#1E293B' : '#FFFFFF' },
        textColor: theme === 'dark' ? '#94A3B8' : '#334155',
      },
      grid: {
        vertLines: { color: theme === 'dark' ? '#334155' : '#E2E8F0', style: LineStyle.Dotted },
        horzLines: { color: theme === 'dark' ? '#334155' : '#E2E8F0', style: LineStyle.Dotted },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        borderColor: theme === 'dark' ? '#334155' : '#E2E8F0',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: theme === 'dark' ? '#334155' : '#E2E8F0',
      },
    });

    // Format data for TradingView chart
    const chartData = filteredData.map(item => ({
      time: new Date(item.date).getTime() / 1000 as UTCTimestamp,
      value: item.close
    }));

    // Add a simple line series with correct parameters
    const lineSeries = chart.addSeries({
      type: 'Line'
    });
    
    // Apply the preferred styling after creation
    lineSeries.applyOptions({
      color: '#3B82F6',
      lineWidth: 2,
    });
    
    lineSeries.setData(chartData);

    // Add current price line if provided
    if (currentPrice) {
      chart.priceScale('right').applyOptions({
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      });
      
      // Add a horizontal price line (with TypeScript safe properties)
      lineSeries.createPriceLine({
        price: currentPrice,
        color: '#64748B',
        lineStyle: LineStyle.Dashed,
        title: 'Current Price',
      });
    }

    // Fit content to show all data
    chart.timeScale().fitContent();

    // Store the chart instance
    chartRef.current = chart;

    // Create resize observer for responsive behavior
    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.applyOptions({ width, height });
      chartRef.current.timeScale().fitContent();
    });

    resizeObserver.observe(chartContainerRef.current);
    resizeObserverRef.current = resizeObserver;

    // Cleanup
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [data, theme, timeRange, currentPrice]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
};

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

  // Fetch stock quote data from Yahoo Finance explicitly for more consistent data
  const { data: quoteData, isLoading: isLoadingQuote } = useQuery({
    queryKey: [`/api/market-data/quote/${symbol}?provider=yahoo`],
    queryFn: async () => {
      try {
        // Always use Yahoo Finance for better formatted data
        console.log(`Fetching quote data for ${symbol} from Yahoo Finance`);
        const data = await fetchData<QuoteData>(`/api/market-data/quote/${symbol}?provider=yahoo`);
        console.log(`Received Yahoo data for ${symbol}:`, data);
        return data;
      } catch (error) {
        console.error(`Yahoo data fetch failed for ${symbol}:`, error);
        
        // Try the default provider (Alpaca) as fallback
        try {
          console.log(`Falling back to default provider for ${symbol}`);
          const alpacaData = await fetchData<QuoteData>(`/api/market-data/quote/${symbol}`);
          console.log(`Received fallback data for ${symbol}:`, alpacaData);
          return alpacaData;
        } catch (fallbackError) {
          console.error(`All providers failed for ${symbol}:`, fallbackError);
          throw new Error(`Failed to fetch quote data for ${symbol}`);
        }
      }
    }
  });

  // Fetch historical price data
  const { data: historicalData, isLoading: isLoadingHistorical } = useQuery({
    queryKey: [`/api/market-data/historical/${symbol}?provider=yahoo`],
    queryFn: () => fetchData<HistoricalDataPoint[]>(`/api/market-data/historical/${symbol}?provider=yahoo`)
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
  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number | undefined | null) => {
    if (value === undefined || value === null) return 'N/A';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Format large numbers
  const formatLargeNumber = (value: number | undefined | null) => {
    if (value === undefined || value === null) return 'N/A';
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

  // Helper functions to extract data from different quote formats
  const isStandardQuote = (data: QuoteData): data is StandardQuote & { symbol: string } => {
    return 'price' in data && typeof data.price === 'number';
  };

  const isAlpacaQuote = (data: QuoteData): data is AlpacaRawQuote & { symbol: string } => {
    return ('ap' in data || 'bp' in data) && !('price' in data);
  };

  // Get price from either quote format
  const getPrice = () => {
    if (!quoteData) return null;
    
    if (isStandardQuote(quoteData)) {
      return quoteData.price;
    } else if (isAlpacaQuote(quoteData)) {
      // For Alpaca quotes, use ask price (ap) or bid price (bp) as the current price
      return quoteData.ap || quoteData.bp || null;
    }
    
    return null;
  };

  // Get change from either quote format
  const getChange = () => {
    if (!quoteData) return null;
    
    if (isStandardQuote(quoteData)) {
      return quoteData.change;
    }
    
    return null; // Alpaca raw quotes don't include change/percent
  };

  // Get change percent from either quote format
  const getChangePercent = () => {
    if (!quoteData) return null;
    
    if (isStandardQuote(quoteData)) {
      return quoteData.changePercent;
    }
    
    return null; // Alpaca raw quotes don't include change/percent
  };

  // Get name from either quote format
  const getName = () => {
    if (!quoteData) return symbol;
    
    if (isStandardQuote(quoteData)) {
      return quoteData.name;
    }
    
    return quoteData.name || `${symbol} Inc.`;
  };

  // Get exchange from either quote format
  const getExchange = () => {
    if (!quoteData) return 'N/A';
    
    if (isStandardQuote(quoteData)) {
      return quoteData.exchange;
    }
    
    return 'N/A'; // Alpaca raw quotes don't include exchange info
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
      ) : quoteData ? (
        <>
          {/* Stock Header */}
          <div>
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold">{symbol}</h1>
                  <Badge variant="outline" className="text-xs font-normal">
                    {getExchange()}
                  </Badge>
                </div>
                <p className="text-lg">{getName()}</p>
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
              <span className="text-4xl font-bold">{formatCurrency(getPrice())}</span>
              {getChange() !== null && (
                <span className={`flex items-center text-lg ${(getChange() || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(getChange() || 0) >= 0 ? (
                    <TrendingUp className="mr-1 h-5 w-5" />
                  ) : (
                    <TrendingDown className="mr-1 h-5 w-5" />
                  )}
                  {formatCurrency(getChange())} ({formatPercentage(getChangePercent())})
                </span>
              )}
            </div>
            
            <p className="text-sm">
              As of {new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: 'numeric' })} EDT. Market {(getChange() || 0) >= 0 ? 'Open' : 'Closed'}.
              {quoteData.dataSource && (
                <span className="ml-2 flex items-center inline-block">
                  <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                    quoteData.dataSource === 'alpaca' ? 'bg-green-500' : 
                    quoteData.dataSource === 'yahoo' ? 'bg-purple-500' : 
                    quoteData.dataSource === 'alpaca-simulation' ? 'bg-blue-500' :
                    'bg-gray-500'
                  }`}></span>
                  Data: {quoteData.dataSource === 'yahoo' ? 'Yahoo Finance' : 
                         quoteData.dataSource === 'alpaca' ? 'Alpaca API' : 
                         quoteData.dataSource === 'alpaca-simulation' ? 'Market Simulation' :
                         quoteData.dataSource === 'reference-data-fallback' ? 'Reference Data' :
                         quoteData.dataSource}
                  {quoteData.isSimulated && ' (Simulated)'}
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
                  <DialogTitle>Create Strategy for {symbol}</DialogTitle>

                </DialogHeader>
                <div className="py-4">

                  <div className="flex items-center space-x-2">
                    <LineChartIcon className="h-12 w-12 text-primary" />
                    <div>
                      <h4 className="font-medium">Momentum Strategy</h4>
                      <p className="text-sm">
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
          <p className="">No data available for {symbol}</p>
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
                  <TradingViewChart 
                    data={historicalData} 
                    timeRange="1D"
                    currentPrice={getPrice() || undefined} 
                  />
                </TabsContent>
                
                <TabsContent value="1W" className="h-96">
                  <TradingViewChart 
                    data={historicalData} 
                    timeRange="1W"
                    currentPrice={getPrice() || undefined} 
                  />
                </TabsContent>
                
                <TabsContent value="1M" className="h-96">
                  <TradingViewChart 
                    data={historicalData} 
                    timeRange="1M"
                    currentPrice={getPrice() || undefined} 
                  />
                </TabsContent>
                
                <TabsContent value="3M" className="h-96">
                  <TradingViewChart 
                    data={historicalData} 
                    timeRange="3M"
                    currentPrice={getPrice() || undefined} 
                  />
                </TabsContent>
                
                <TabsContent value="1Y" className="h-96">
                  <TradingViewChart 
                    data={historicalData} 
                    timeRange="1Y"
                    currentPrice={getPrice() || undefined} 
                  />
                </TabsContent>
                
                <TabsContent value="ALL" className="h-96">
                  <TradingViewChart 
                    data={historicalData} 
                    timeRange="ALL"
                    currentPrice={getPrice() || undefined} 
                  />
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="">No historical data available for {symbol}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Statistics */}
      {quoteData && isStandardQuote(quoteData) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Key Statistics</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 pt-0">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm">Previous Close</p>
                    <p className="font-medium">
                      {quoteData.previousClose !== undefined && quoteData.previousClose !== null 
                        ? formatCurrency(quoteData.previousClose) 
                        : quoteData.open !== undefined && quoteData.open !== null 
                          ? formatCurrency(quoteData.open)
                          : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm">Day Range</p>
                    <p className="font-medium">
                      {quoteData.dayRange || (
                        (quoteData.low !== undefined && quoteData.low !== null && 
                         quoteData.high !== undefined && quoteData.high !== null)
                          ? `${formatCurrency(quoteData.low)} - ${formatCurrency(quoteData.high)}`
                          : 'N/A'
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm">52 Week Range</p>
                    <p className="font-medium">{quoteData.weekRange52 || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm">Market Cap</p>
                    <p className="font-medium">{formatLargeNumber(quoteData.marketCap)}</p>
                  </div>
                  <div>
                    <p className="text-sm">Volume</p>
                    <p className="font-medium">{formatLargeNumber(quoteData.volume)}</p>
                  </div>
                  <div>
                    <p className="text-sm">Average Volume</p>
                    <p className="font-medium">
                      {quoteData.averageVolume !== undefined && quoteData.averageVolume !== null
                        ? formatLargeNumber(quoteData.averageVolume)
                        : quoteData.volume !== undefined && quoteData.volume !== null
                          ? formatLargeNumber(quoteData.volume)
                          : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm">P/E Ratio</p>
                    <p className="font-medium">
                      {quoteData.peRatio !== undefined && quoteData.peRatio !== null
                        ? Number(quoteData.peRatio).toFixed(2)
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm">Forward P/E</p>
                    <p className="font-medium">
                      {quoteData.forwardPE !== undefined && quoteData.forwardPE !== null
                        ? Number(quoteData.forwardPE).toFixed(2)
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm">EPS (TTM)</p>
                    <p className="font-medium">
                      {quoteData.eps !== undefined && quoteData.eps !== null
                        ? formatCurrency(quoteData.eps)
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm">Dividend & Yield</p>
                    <p className="font-medium">
                      {quoteData.dividend !== undefined && quoteData.dividend !== null 
                        ? `${formatCurrency(quoteData.dividend)}${
                            quoteData.dividendYield !== undefined && quoteData.dividendYield !== null
                              ? ` (${Number(quoteData.dividendYield).toFixed(2)}%)`
                              : ''
                          }`
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm">Beta</p>
                    <p className="font-medium">
                      {quoteData.beta !== undefined && quoteData.beta !== null
                        ? Number(quoteData.beta).toFixed(2)
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm">Exchange</p>
                    <p className="font-medium">{quoteData.exchange || 'N/A'}</p>
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
                        <span className="text-xs font-medium">{news.source}</span>
                        <span className="text-xs">•</span>
                        <span className="text-xs">{news.publishedAt}</span>
                      </div>
                      <p className="text-sm line-clamp-2">{news.summary}</p>
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