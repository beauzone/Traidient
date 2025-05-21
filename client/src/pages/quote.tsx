import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/api";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TradingViewChart from "@/components/market-data/TradingViewChart";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, Clock, TrendingUp, ExternalLink, Share2, Bookmark, ChevronRight } from "lucide-react";
import PositionsTable from "@/components/live-trading/PositionsTable";
import OrdersTable from "@/components/live-trading/OrdersTable";
import { formatDistanceToNow } from "date-fns";

// Time period options for chart display
const timePeriods = [
  { label: "1D", value: "1D" },
  { label: "5D", value: "5D" },
  { label: "1M", value: "1M" },
  { label: "6M", value: "6M" },
  { label: "YTD", value: "YTD" },
  { label: "1Y", value: "1Y" },
  { label: "5Y", value: "5Y" },
  { label: "All", value: "All" },
];

function Quote() {
  const [symbol, setSymbol] = useState("");
  const [timeRange, setTimeRange] = useState("1D");
  const [timeInterval, setTimeInterval] = useState("1min");

  // Parse URL parameters on component mount
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const symbolParam = searchParams.get('symbol');
    
    // Set the selected stock if symbol is provided in URL
    if (symbolParam) {
      setSymbol(symbolParam);
    }
  }, []);

  // Get quote data
  const { data: quoteData, isLoading: isLoadingQuote } = useQuery({
    queryKey: ['/api/market-data/quote', symbol],
    queryFn: () => fetchData(`/api/market-data/quote/${symbol}`),
    enabled: !!symbol,
  });

  // Get positions related to this symbol
  const { data: positions = [], isLoading: isLoadingPositions } = useQuery({
    queryKey: ['/api/trading/positions'],
    queryFn: () => fetchData('/api/trading/positions'),
  });

  // Get orders related to this symbol
  const { data: allOrders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ['/api/trading/orders'],
    queryFn: () => fetchData('/api/trading/orders'),
  });

  // Get news for this symbol
  const { data: news = [], isLoading: isLoadingNews } = useQuery({
    queryKey: ['/api/market-data/news', symbol],
    queryFn: () => fetchData(`/api/market-data/news?symbol=${symbol}&limit=5`),
    enabled: !!symbol,
  });

  // Filter positions and orders for this specific symbol
  const symbolPositions = positions.filter((position: any) => position.symbol === symbol);
  const symbolOrders = allOrders.filter((order: any) => order.symbol === symbol);
  
  // Set appropriate time interval based on time range
  useEffect(() => {
    switch (timeRange) {
      case "1D":
        setTimeInterval("1min");
        break;
      case "5D":
        setTimeInterval("5min");
        break;
      case "1M":
        setTimeInterval("15min");
        break;
      case "6M":
      case "YTD":
      case "1Y":
        setTimeInterval("1day");
        break;
      case "5Y":
      case "All":
        setTimeInterval("1week");
        break;
      default:
        setTimeInterval("1min");
    }
  }, [timeRange]);

  if (!symbol) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>No Symbol Selected</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Please select a symbol to view its quote information.</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Quote Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {symbol} 
              <Badge variant="outline" className="text-xs">
                {quoteData?.exchange || "Loading..."}
              </Badge>
            </h1>
            <h2 className="text-lg font-medium text-muted-foreground">
              {quoteData?.name || "Loading..."}
            </h2>
          </div>

          <div className="flex flex-col items-end">
            <div className="text-3xl font-bold">
              ${quoteData?.quote?.ap ? quoteData.quote.ap.toFixed(2) : quoteData?.price?.toFixed(2) || "-.--"}
            </div>
            {quoteData && (
              <div className={`text-sm font-medium flex items-center ${
                (quoteData.change >= 0 || (quoteData.quote && quoteData.quote.ap > quoteData.quote.bp)) ? 'text-green-500' : 'text-red-500'
              }`}>
                {(quoteData.change >= 0 || (quoteData.quote && quoteData.quote.ap > quoteData.quote.bp)) ? 
                  <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
                {quoteData.change !== undefined ? 
                  `${quoteData.change.toFixed(2)} (${quoteData.changePercent.toFixed(2)}%)` : 
                  "Market Price"}
              </div>
            )}
            <div className="text-xs text-muted-foreground flex items-center mt-1">
              <Clock className="w-3 h-3 mr-1" /> Last updated {quoteData ? formatDistanceToNow(new Date(quoteData.timestamp), { addSuffix: true }) : "recently"}
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <Card className="w-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex space-x-1">
              {timePeriods.map((period) => (
                <Button 
                  key={period.value}
                  onClick={() => setTimeRange(period.value)}
                  variant={timeRange === period.value ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-3"
                >
                  {period.label}
                </Button>
              ))}
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                className="h-8 px-3 flex items-center gap-1"
              >
                <TrendingUp className="h-4 w-4" />
                <span>Key Events</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[400px] w-full">
              {symbol ? (
                <TradingViewChart 
                  symbol={symbol} 
                  timeRange={timeRange}
                  timeInterval={timeInterval}
                  height={400}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p>Please select a symbol to view chart</p>
                </div>  
              )}
            </div>
          </CardContent>
        </Card>

        {/* Market Data Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Previous Close</CardTitle>
            </CardHeader>
            <CardContent className="py-1">
              <p className="text-lg font-bold">${quoteData?.previousClose?.toFixed(2) || "-.-"}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Open</CardTitle>
            </CardHeader>
            <CardContent className="py-1">
              <p className="text-lg font-bold">${quoteData?.open?.toFixed(2) || "-.-"}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Day's Range</CardTitle>
            </CardHeader>
            <CardContent className="py-1">
              <p className="text-lg font-bold">
                ${quoteData?.dayLow?.toFixed(2) || "-.-"} - ${quoteData?.dayHigh?.toFixed(2) || "-.-"}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">52 Week Range</CardTitle>
            </CardHeader>
            <CardContent className="py-1">
              <p className="text-lg font-bold">
                ${quoteData?.yearLow?.toFixed(2) || "-.-"} - ${quoteData?.yearHigh?.toFixed(2) || "-.-"}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Volume</CardTitle>
            </CardHeader>
            <CardContent className="py-1">
              <p className="text-lg font-bold">
                {quoteData?.volume?.toLocaleString() || "-"}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Avg. Volume</CardTitle>
            </CardHeader>
            <CardContent className="py-1">
              <p className="text-lg font-bold">
                {quoteData?.avgVolume?.toLocaleString() || "-"}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Market Cap</CardTitle>
            </CardHeader>
            <CardContent className="py-1">
              <p className="text-lg font-bold">
                {quoteData?.marketCap ? `$${(quoteData.marketCap / 1e9).toFixed(2)}B` : "-"}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">P/E Ratio</CardTitle>
            </CardHeader>
            <CardContent className="py-1">
              <p className="text-lg font-bold">
                {quoteData?.pe?.toFixed(2) || "-"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Position & Orders Section */}
        <Tabs defaultValue="positions" className="w-full">
          <TabsList>
            <TabsTrigger value="positions">Positions ({symbolPositions.length})</TabsTrigger>
            <TabsTrigger value="orders">Order History ({symbolOrders.length})</TabsTrigger>
            <TabsTrigger value="news">News</TabsTrigger>
          </TabsList>
          
          <TabsContent value="positions">
            {symbolPositions.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  {/* Using the dashboard version that accepts passedPositions */}
                  <div className="table-container">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="text-left p-2">Symbol</th>
                          <th className="text-right p-2">Quantity</th>
                          <th className="text-right p-2">Avg Price</th>
                          <th className="text-right p-2">Current Price</th>
                          <th className="text-right p-2">Market Value</th>
                          <th className="text-right p-2">P/L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {symbolPositions.map((position: any, index: number) => (
                          <tr key={index} className="border-t border-border">
                            <td className="p-2 font-medium">{position.symbol}</td>
                            <td className="text-right p-2">{position.quantity}</td>
                            <td className="text-right p-2">${position.averageEntryPrice.toFixed(2)}</td>
                            <td className="text-right p-2">${position.currentPrice.toFixed(2)}</td>
                            <td className="text-right p-2">${position.marketValue.toFixed(2)}</td>
                            <td className={`text-right p-2 ${position.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              ${position.unrealizedPnL.toFixed(2)} ({position.unrealizedPnLPercent.toFixed(2)}%)
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">No positions for {symbol}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="orders">
            {symbolOrders.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <div className="table-container">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="text-left p-2">Time</th>
                          <th className="text-left p-2">Symbol</th>
                          <th className="text-right p-2">Side</th>
                          <th className="text-right p-2">Type</th>
                          <th className="text-right p-2">Quantity</th>
                          <th className="text-right p-2">Price</th>
                          <th className="text-right p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {symbolOrders.map((order: any, index: number) => (
                          <tr key={index} className="border-t border-border">
                            <td className="p-2 text-xs">
                              {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString()}
                            </td>
                            <td className="p-2 font-medium">{order.symbol}</td>
                            <td className={`text-right p-2 ${order.side === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                              {order.side.toUpperCase()}
                            </td>
                            <td className="text-right p-2">{order.type}</td>
                            <td className="text-right p-2">{order.quantity}</td>
                            <td className="text-right p-2">
                              {order.price ? `$${order.price.toFixed(2)}` : 'Market'}
                            </td>
                            <td className="text-right p-2 capitalize">{order.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">No order history for {symbol}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="news">
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {isLoadingNews ? (
                  <div className="py-8">
                    <p className="text-center text-muted-foreground">Loading news...</p>
                  </div>
                ) : news.length > 0 ? (
                  news.map((item: any, index: number) => (
                    <div key={index} className="p-4 hover:bg-muted/50">
                      <div className="flex items-start gap-4">
                        {item.imageUrl && (
                          <div className="hidden sm:block flex-shrink-0 w-24 h-24 bg-muted rounded overflow-hidden">
                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-medium mb-1">
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                              {item.title}
                              <ExternalLink className="w-3 h-3 inline-block" />
                            </a>
                          </h3>
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{item.summary}</p>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <span>{item.source}</span>
                            <span className="mx-2">•</span>
                            <span>{formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8">
                    <p className="text-center text-muted-foreground">No recent news for {symbol}</p>
                  </div>
                )}
                
                {news.length > 0 && (
                  <div className="p-3 text-center">
                    <Button variant="link" className="text-primary">
                      View More News <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

export default Quote;