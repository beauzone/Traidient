import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMarketData } from '@/hooks/useMarketData';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

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
  const [, navigate] = useLocation();

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
          <Badge 
            className={connected ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-[#FF3B5C] hover:bg-[#FF3B5C]/90 text-white'} 
            variant="outline"
          >
            {connected ? 'Connected' : 'Disconnected'}
          </Badge>
        </CardTitle>
        <CardDescription></CardDescription>
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
            <div className="text-center p-4">
              No symbols added yet
            </div>
          ) : (
            subscribedSymbols.map((symbol) => {
              const data = marketData[symbol];
              const hasData = !!data;
              
              return (
                <div
                  key={symbol}
                  className="flex justify-between items-center p-3 bg-card border rounded-md hover:bg-accent/50 cursor-pointer"
                  onClick={() => {
                    if (onSymbolSelect) {
                      onSymbolSelect(symbol);
                    } else {
                      // Navigate to the Quote page if no custom handler is provided
                      navigate(`/quote?symbol=${symbol}`);
                    }
                  }}
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
                          {/* Removed individual source labels as they're redundant with the header */}
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