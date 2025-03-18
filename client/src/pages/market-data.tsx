import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/layout/MainLayout";
import MarketOverview from "@/components/market-data/MarketOverview";
import StockSearch from "@/components/market-data/StockSearch";
import StockDetail from "@/components/market-data/StockDetail";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchData } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WatchlistItem } from "@/types";

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

  return (
    <MainLayout title="Market Data">
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
            <CardHeader>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="overview">Market Overview</TabsTrigger>
                  <TabsTrigger value="detail" disabled={!selectedSymbol}>Asset Details</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default MarketDataPage;
