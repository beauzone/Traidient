import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import MarketOverview from "@/components/market-data/MarketOverview";
import StockSearch from "@/components/market-data/StockSearch";
import StockDetail from "@/components/market-data/StockDetail";
import { RealtimeQuotes } from "@/components/market-data/RealtimeQuotes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchData } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WatchlistItem {
  id: number;
  symbol: string;
  name: string;
  lastPrice: string;
  change: string;
  changePercent: string;
  volume: string;
  marketCap: string;
  isPositive: boolean;
}

const MarketDataPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  // Fetch watchlist data
  const { data: watchlist = [] } = useQuery({
    queryKey: ['/api/watchlist'],
    queryFn: () => fetchData<WatchlistItem[]>('/api/watchlist'),
  });

  const handleSymbolSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
    setActiveTab("detail");
  };

  // Extract watchlist symbols for real-time quotes
  // Also include common market index symbols to ensure we get market status updates
  const watchlistSymbols = [...watchlist.map(item => item.symbol), 'SPY'];

  return (
    <MainLayout title="Markets">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Markets</h1>
          <p className="text-muted-foreground">
            Analyze market data and track individual assets
          </p>
        </div>
      </div>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Search</CardTitle>
              <CardDescription>Find assets to analyze</CardDescription>
            </CardHeader>
            <CardContent>
              <StockSearch onSymbolSelect={handleSymbolSelect} watchlist={watchlist} />
            </CardContent>
          </Card>

          <Card className="md:col-span-3">
            <CardContent className="pt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
                <TabsList className="mb-4">
                  <TabsTrigger value="overview">Market Overview</TabsTrigger>
                  <TabsTrigger value="detail" disabled={!selectedSymbol}>Asset Details</TabsTrigger>
                  <TabsTrigger value="realtime">Real-time Quotes</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="mt-0">
                  <MarketOverview onSymbolSelect={handleSymbolSelect} />
                </TabsContent>
                
                <TabsContent value="detail" className="mt-0">
                  {selectedSymbol ? (
                    <StockDetail symbol={selectedSymbol} />
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Select a symbol to view details</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="realtime" className="mt-0">
                  <RealtimeQuotes 
                    initialSymbols={watchlistSymbols} 
                    onSymbolSelect={handleSymbolSelect} 
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default MarketDataPage;
