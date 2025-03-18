import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMarketData } from '@/hooks/useMarketData';
import { useToast } from '@/hooks/use-toast';

interface RealtimeQuotesProps {
  initialSymbols?: string[];
  onSymbolSelect?: (symbol: string) => void;
}

export function RealtimeQuotes({ initialSymbols = [], onSymbolSelect }: RealtimeQuotesProps) {
  const [inputSymbol, setInputSymbol] = useState('');
  const { 
    connected, 
    marketData, 
    subscribedSymbols,
    marketStatus,
    subscribeToSymbols, 
    unsubscribeFromSymbols 
  } = useMarketData();
  const { toast } = useToast();

  // Subscribe to initial symbols when the component mounts
  useEffect(() => {
    if (connected && initialSymbols.length > 0) {
      subscribeToSymbols(initialSymbols);
    }
  }, [connected, initialSymbols, subscribeToSymbols]);

  const handleAddSymbol = () => {
    if (!inputSymbol.trim()) {
      return;
    }

    const symbol = inputSymbol.trim().toUpperCase();
    
    if (subscribedSymbols.includes(symbol)) {
      toast({
        title: 'Already subscribed',
        description: `You are already watching ${symbol}`,
        variant: 'default',
      });
      setInputSymbol('');
      return;
    }

    subscribeToSymbols([symbol]);
    setInputSymbol('');
  };

  const handleRemoveSymbol = (symbol: string) => {
    unsubscribeFromSymbols([symbol]);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Realtime Market Data</span>
          <Badge variant={connected ? 'default' : 'destructive'}>
            {connected ? 'Connected' : 'Disconnected'}
          </Badge>
        </CardTitle>
        <CardDescription className="space-y-1">
          <div>Watch real-time price updates for your favorite symbols</div>
          {connected && (
            <div className="flex items-center text-xs space-x-2">
              <Badge variant={marketStatus.isMarketOpen ? "default" : "secondary"} className="px-1 py-0">
                {marketStatus.isMarketOpen ? "Market Open" : "Market Closed"}
              </Badge>
              <span>Data Source: {
                marketStatus.dataSource === 'yahoo' ? 'Yahoo Finance' : 
                marketStatus.dataSource === 'alpaca' ? 'Alpaca API' : 
                marketStatus.dataSource === 'alpaca-simulation' ? 'Market Simulation' :
                marketStatus.dataSource === 'reference-data-fallback' ? 'Reference Data' :
                marketStatus.dataSource
              }</span>
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-2 mb-4">
          <Input
            placeholder="Add symbol (e.g., AAPL)"
            value={inputSymbol}
            onChange={(e) => setInputSymbol(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddSymbol();
              }
            }}
            disabled={!connected}
          />
          <Button onClick={handleAddSymbol} disabled={!connected}>
            Add
          </Button>
        </div>

        <div className="grid gap-2">
          {subscribedSymbols.length === 0 ? (
            <div className="text-center text-muted-foreground p-4">
              No symbols added yet. Add a symbol to see real-time updates.
            </div>
          ) : (
            subscribedSymbols.map((symbol) => {
              const data = marketData[symbol];
              const hasData = !!data;
              
              return (
                <div
                  key={symbol}
                  className="flex justify-between items-center p-3 bg-card border rounded-md hover:bg-accent/50 cursor-pointer"
                  onClick={() => onSymbolSelect && onSymbolSelect(symbol)}
                >
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline" className="font-mono">
                      {symbol}
                    </Badge>
                    <div>
                      {hasData ? (
                        <div className="text-lg font-medium">
                          ${data.price.toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-lg font-medium animate-pulse">
                          Loading...
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {hasData && (
                      <>
                        <div className="flex flex-col items-end">
                          <div
                            className={`text-sm ${
                              data.change >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}
                          >
                            {data.change >= 0 ? '+' : ''}
                            {data.change.toFixed(2)} ({data.changePercent.toFixed(2)}%)
                          </div>
                          {data.isSimulated !== undefined && (
                            <div className="text-xs text-muted-foreground">
                              Source: {data.dataSource === 'yahoo' ? 'Yahoo Finance' : 
                                data.dataSource === 'alpaca' ? 'Alpaca API' : 
                                data.dataSource === 'alpaca-simulation' ? 'Market Simulation' :
                                data.dataSource === 'reference-data-fallback' ? 'Reference Data' :
                                data.dataSource || 'Unknown'}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSymbol(symbol);
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}