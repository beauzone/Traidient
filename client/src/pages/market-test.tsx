import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMarketData } from "@/hooks/useMarketData";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MarketTest() {
  const { isAuthenticated } = useAuth();
  const { quotes, marketStatus, subscribeToSymbols } = useMarketData();
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Test symbols
  const testSymbols = ["AAPL", "MSFT", "TSLA", "AMZN", "GOOG"];

  useEffect(() => {
    if (isAuthenticated) {
      // Subscribe to test symbols
      subscribeToSymbols(testSymbols);
      setIsDataLoaded(true);
    }
  }, [isAuthenticated, subscribeToSymbols]);

  return (
    <MainLayout title="Market Data Test">
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-6">Real-Time Market Data Test</h1>
        
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Market Status</span>
                <Badge variant={marketStatus.isMarketOpen ? "success" : "destructive"}>
                  {marketStatus.isMarketOpen ? "OPEN" : "CLOSED"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Data Source: {marketStatus.dataSource || "Not connected"}
              </p>
              <p className="text-muted-foreground">
                {isDataLoaded 
                  ? `Subscribed to ${testSymbols.length} symbols` 
                  : "Initializing market data connection..."}
              </p>
            </CardContent>
          </Card>
        </div>
        
        <h2 className="text-2xl font-bold mb-4">Real-Time Quotes</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testSymbols.map(symbol => {
            const quote = quotes[symbol];
            return (
              <Card key={symbol}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <span>{symbol}</span>
                    {quote && (
                      <Badge variant={quote.change >= 0 ? "success" : "destructive"}>
                        {quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)} ({quote.changePercent.toFixed(2)}%)
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {quote ? (
                    <div>
                      <div className="text-3xl font-bold mb-2">${quote.price.toFixed(2)}</div>
                      <p className="text-muted-foreground">
                        Last update: {new Date(quote.timestamp).toLocaleTimeString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {quote.isSimulated 
                          ? "Data is simulated" 
                          : `Data from ${quote.dataSource || "unknown"}`}
                      </p>
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
      </div>
    </MainLayout>
  );
}