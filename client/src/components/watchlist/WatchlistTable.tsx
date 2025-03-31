import React, { useState, useEffect } from 'react';
import { useWatchlist } from '@/contexts/WatchlistContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Trash, ChevronUp, ChevronDown, Plus, ExternalLink } from 'lucide-react';
import type { WatchlistItem } from '@shared/schema';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Link } from 'wouter';

interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  volume: number;
}

export const WatchlistTable = () => {
  const { currentWatchlist, removeFromWatchlist, addToWatchlist } = useWatchlist();
  const [marketData, setMarketData] = useState<Record<string, StockQuote>>({});
  const [symbols, setSymbols] = useState<Set<string>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [symbolType, setSymbolType] = useState('stock');
  const [exchange, setExchange] = useState('NASDAQ');
  
  const socket = useWebSocket('/ws');
  
  // Subscribe to symbols in the watchlist
  useEffect(() => {
    if (!currentWatchlist || !socket) return;
    
    // Get unique symbols from watchlist
    const symbolSet = new Set(currentWatchlist.items.map(item => item.symbol));
    setSymbols(symbolSet);
    
    // Subscribe to symbols
    if (symbolSet.size > 0 && socket.readyState === WebSocket.OPEN) {
      const message = {
        type: 'subscribe',
        symbols: Array.from(symbolSet)
      };
      socket.send(JSON.stringify(message));
    }
    
    return () => {
      // Unsubscribe on cleanup if the socket is open
      if (symbolSet.size > 0 && socket.readyState === WebSocket.OPEN) {
        const message = {
          type: 'unsubscribe',
          symbols: Array.from(symbolSet)
        };
        socket.send(JSON.stringify(message));
      }
    };
  }, [currentWatchlist, socket]);
  
  // Handle incoming market data
  useEffect(() => {
    if (!socket) return;
    
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'marketData') {
          setMarketData(prevData => ({
            ...prevData,
            [data.symbol]: {
              symbol: data.symbol,
              price: data.price,
              change: data.change,
              percentChange: data.percentChange,
              volume: data.volume
            }
          }));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socket.addEventListener('message', handleMessage);
    
    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket]);
  
  // Handle removing an item from the watchlist
  const handleRemoveItem = async (itemId: number) => {
    if (!currentWatchlist) return;
    
    try {
      await removeFromWatchlist(currentWatchlist.id, itemId);
    } catch (error) {
      console.error('Failed to remove item from watchlist:', error);
    }
  };
  
  // Handle adding a new symbol to the watchlist
  const handleAddSymbol = async () => {
    if (!currentWatchlist || !newSymbol.trim()) return;
    
    try {
      await addToWatchlist(currentWatchlist.id, {
        symbol: newSymbol.trim().toUpperCase(),
        name: newSymbol.trim().toUpperCase(), // We can update this with company name later
        type: symbolType,
        exchange: exchange
      });
      
      setNewSymbol('');
      setAddDialogOpen(false);
    } catch (error) {
      console.error('Failed to add symbol to watchlist:', error);
    }
  };
  
  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-500';
    if (change < 0) return 'text-red-500';
    return 'text-gray-500';
  };
  
  // Sort items by displayOrder (if available)
  const sortedItems = currentWatchlist?.items.slice().sort((a, b) => a.displayOrder - b.displayOrder) || [];
  
  return (
    <div className="rounded-md border">
      {currentWatchlist ? (
        <>
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-medium">{currentWatchlist.name}</h3>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Symbol
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Last Price</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>% Change</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No symbols in this watchlist. Click "Add Symbol" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                sortedItems.map((item: WatchlistItem) => {
                  const quote = marketData[item.symbol];
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <Link to={`/symbol/${item.symbol}`} className="flex items-center hover:underline">
                          {item.symbol}
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </Link>
                        <div className="text-xs text-muted-foreground">{item.name}</div>
                      </TableCell>
                      <TableCell>
                        {quote ? `$${quote.price.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell className={quote ? getChangeColor(quote.change) : ''}>
                        {quote ? (quote.change >= 0 ? '+' : '') + quote.change.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className={quote ? getChangeColor(quote.percentChange) : ''}>
                        {quote ? (quote.percentChange >= 0 ? '+' : '') + quote.percentChange.toFixed(2) + '%' : '—'}
                      </TableCell>
                      <TableCell>
                        {quote ? new Intl.NumberFormat().format(quote.volume) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          
          {/* Add Symbol Dialog */}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add symbol to watchlist</DialogTitle>
                <DialogDescription>
                  Enter the symbol you want to add to your watchlist.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="symbol" className="text-right">
                    Symbol
                  </Label>
                  <Input
                    id="symbol"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g. AAPL, MSFT, GOOGL"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddSymbol();
                      }
                    }}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">
                    Type
                  </Label>
                  <Select
                    value={symbolType}
                    onValueChange={setSymbolType}
                  >
                    <SelectTrigger id="type" className="col-span-3">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stock">Stock</SelectItem>
                      <SelectItem value="etf">ETF</SelectItem>
                      <SelectItem value="index">Index</SelectItem>
                      <SelectItem value="crypto">Cryptocurrency</SelectItem>
                      <SelectItem value="forex">Forex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="exchange" className="text-right">
                    Exchange
                  </Label>
                  <Select
                    value={exchange}
                    onValueChange={setExchange}
                  >
                    <SelectTrigger id="exchange" className="col-span-3">
                      <SelectValue placeholder="Select exchange" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NASDAQ">NASDAQ</SelectItem>
                      <SelectItem value="NYSE">NYSE</SelectItem>
                      <SelectItem value="AMEX">AMEX</SelectItem>
                      <SelectItem value="LSE">LSE</SelectItem>
                      <SelectItem value="TSX">TSX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddSymbol}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <h3 className="mb-2 text-lg font-medium">No watchlist selected</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Select a watchlist from the dropdown above or create a new one.
          </p>
        </div>
      )}
    </div>
  );
};