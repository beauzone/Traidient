import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMarketData } from "@/hooks/useMarketData";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  InfoIcon, 
  RefreshCwIcon 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MarketDataConnectionStatus } from "@/components/market-data/ConnectionStatus";

export default function MarketTest() {
  const { isAuthenticated } = useAuth();
  const { 
    quotes, 
    marketStatus, 
    subscribeToSymbols, 
    fetchQuote,
    dataFreshness,
    usingRealtime,
    usingFallback,
    statusMessage,
    connectionType
  } = useMarketData();
  
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [selectedTab, setSelectedTab] = useState("quotes");
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});

  // Test symbols - expanded to show more variety
  const testSymbols = ["AAPL", "MSFT", "TSLA", "AMZN", "GOOG", "SPY", "QQQ", "META"];

  useEffect(() => {
    if (isAuthenticated) {
      // Subscribe to test symbols
      subscribeToSymbols(testSymbols);
      setIsDataLoaded(true);
    }
  }, [isAuthenticated, subscribeToSymbols]);

  // Manually refresh a quote
  const handleRefreshQuote = async (symbol: string) => {
    // Set refreshing state
    setRefreshing(prev => ({ ...prev, [symbol]: true }));
    
    // Fetch the quote
    await fetchQuote(symbol);
    
    // Clear refreshing state after 500ms for UX
    setTimeout(() => {
      setRefreshing(prev => ({ ...prev, [symbol]: false }));
    }, 500);
  };

  return (
    <MainLayout title="Market Data Test">
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Market Data Test</h1>
          <MarketDataConnectionStatus size="lg" />
        </div>
        
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Market Status</span>
                <div className="flex items-center gap-2">
                  <Badge variant={marketStatus.isMarketOpen ? "success" : "destructive"}>
                    {marketStatus.isMarketOpen ? "OPEN" : "CLOSED"}
                  </Badge>
                  <MarketDataConnectionStatus showLabel={false} size="sm" />
                </div>
              </CardTitle>
              <CardDescription>
                {statusMessage}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Connection Type:</span>
                    <Badge variant="outline" className="capitalize">
                      {connectionType}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Data Source:</span>
                    <Badge variant="outline">
                      {marketStatus.dataSource || "Unknown"}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Last Updated:</span>
                    <Badge variant="outline">{dataFreshness.lastUpdated}</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Avg. Data Delay:</span>
                    <Badge variant={dataFreshness.averageDelay < 10 ? "outline" : "secondary"}>
                      {dataFreshness.averageDelay} seconds
                    </Badge>
                  </div>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <InfoIcon className="h-4 w-4" />
                <span>
                  {isDataLoaded 
                    ? `Subscribed to ${testSymbols.length} symbols` 
                    : "Initializing market data connection..."}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mb-6">
          <TabsList className="mb-4">
            <TabsTrigger value="quotes">Market Quotes</TabsTrigger>
            <TabsTrigger value="connection">Connection Details</TabsTrigger>
          </TabsList>
          
          <TabsContent value="quotes">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {testSymbols.map(symbol => {
                const quote = quotes[symbol];
                const isRefreshing = refreshing[symbol];
                
                return (
                  <Card key={symbol} className="overflow-hidden">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-1.5">
                          {symbol}
                          {quote?.dataSource === 'http-fallback' && (
                            <span className="text-xs text-muted-foreground">(delayed)</span>
                          )}
                        </CardTitle>
                        {quote && (
                          <CardDescription>
                            {quote.isSimulated 
                              ? "Simulated data" 
                              : quote.dataSource 
                                ? `From ${quote.dataSource}` 
                                : "Market data"}
                          </CardDescription>
                        )}
                      </div>
                      
                      {quote && (
                        <Badge className={quote.change >= 0 ? "bg-green-500/90 hover:bg-green-600" : "bg-red-500/90 hover:bg-red-600"}>
                          {quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)} ({quote.changePercent.toFixed(2)}%)
                        </Badge>
                      )}
                    </CardHeader>
                    
                    <CardContent>
                      {quote ? (
                        <div>
                          <div className="text-3xl font-bold mb-2">${quote.price.toFixed(2)}</div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                              Updated: {new Date(quote.timestamp).toLocaleTimeString()}
                            </p>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 w-7 p-0" 
                              onClick={() => handleRefreshQuote(symbol)}
                              disabled={isRefreshing}
                            >
                              <RefreshCwIcon className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                              <span className="sr-only">Refresh</span>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="h-20 flex items-center justify-center">
                          <p className="text-muted-foreground">Waiting for data...</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
          
          <TabsContent value="connection">
            <Card>
              <CardHeader>
                <CardTitle>Connection Details</CardTitle>
                <CardDescription>
                  Detailed information about the market data connection and status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Connection Information</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-sm font-medium">Connection Type:</div>
                        <div className="text-sm">{connectionType}</div>
                        
                        <div className="text-sm font-medium">Using WebSockets:</div>
                        <div className="text-sm">{usingRealtime ? 'Yes' : 'No'}</div>
                        
                        <div className="text-sm font-medium">Using HTTP Fallback:</div>
                        <div className="text-sm">{usingFallback ? 'Yes' : 'No'}</div>
                        
                        <div className="text-sm font-medium">Status Message:</div>
                        <div className="text-sm">{statusMessage}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">Data Freshness</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-sm font-medium">Last Updated:</div>
                        <div className="text-sm">{dataFreshness.lastUpdated}</div>
                        
                        <div className="text-sm font-medium">Average Delay:</div>
                        <div className="text-sm">{dataFreshness.averageDelay} seconds</div>
                        
                        <div className="text-sm font-medium">Data Age:</div>
                        <div className="text-sm">{dataFreshness.staleness}</div>
                        
                        <div className="text-sm font-medium">Is Data Stale:</div>
                        <div className="text-sm">{dataFreshness.isStale ? 'Yes' : 'No'}</div>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Market Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="text-sm font-medium">Market Open:</div>
                      <div className="text-sm">{marketStatus.isMarketOpen ? 'Yes' : 'No'}</div>
                      <div></div>
                      
                      <div className="text-sm font-medium">Data Source:</div>
                      <div className="text-sm">{marketStatus.dataSource || 'Unknown'}</div>
                      <div></div>
                      
                      <div className="text-sm font-medium">Subscribed Symbols:</div>
                      <div className="text-sm">{testSymbols.join(', ')}</div>
                      <div></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}