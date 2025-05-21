import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { X, Plus, ChevronUp, ChevronDown } from "lucide-react";
import { fetchData, postData, deleteData } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

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
  priceHistory?: { price: number; time: string }[];
}

interface AddWatchlistFormData {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

interface WatchlistTableProps {
  onSelectStock?: (symbol: string) => void;
}

const WatchlistTable = ({ onSelectStock }: WatchlistTableProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState<AddWatchlistFormData>({
    symbol: "",
    name: "",
    exchange: "NASDAQ",
    type: "stock"
  });
  const [watchlistWithHistory, setWatchlistWithHistory] = useState<WatchlistItem[]>([]);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Query to fetch watchlist items
  const { data: watchlist = [], isLoading } = useQuery({
    queryKey: ['/api/watchlist'],
    queryFn: () => fetchData<WatchlistItem[]>('/api/watchlist'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch historical data for each symbol in the watchlist
  useEffect(() => {
    const fetchHistoricalData = async () => {
      if (watchlist.length === 0) return;
      
      try {
        const updatedWatchlist = await Promise.all(
          watchlist.map(async (item) => {
            try {
              // Fetch intraday data for the mini chart
              const historicalData = await fetchData<{ bars: { t: string; c: number }[] }>(
                `/api/market-data/historical/${item.symbol}?period=1d&interval=5min`
              );
              
              return {
                ...item,
                priceHistory: historicalData.bars?.map(bar => ({
                  time: bar.t,
                  price: bar.c
                })) || []
              };
            } catch (error) {
              console.error(`Failed to fetch historical data for ${item.symbol}:`, error);
              return item; // Return original item if fetching fails
            }
          })
        );
        
        setWatchlistWithHistory(updatedWatchlist);
      } catch (error) {
        console.error("Failed to fetch historical data:", error);
      }
    };

    fetchHistoricalData();
  }, [watchlist]);

  // Mutation to add item to watchlist
  const addToWatchlist = useMutation({
    mutationFn: (data: AddWatchlistFormData) => postData('/api/watchlist', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlist'] });
      setIsAddDialogOpen(false);
      setFormData({
        symbol: "",
        name: "",
        exchange: "NASDAQ",
        type: "stock"
      });
      toast({
        title: "Symbol added",
        description: `${formData.symbol} has been added to your watchlist.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to add symbol",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      });
    }
  });

  // Mutation to remove item from watchlist
  const removeFromWatchlist = useMutation({
    mutationFn: (id: number) => deleteData(`/api/watchlist/${id}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlist'] });
      toast({
        title: "Symbol removed",
        description: "The symbol has been removed from your watchlist.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove symbol",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      });
    }
  });

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle add symbol form submission
  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    addToWatchlist.mutate(formData);
  };

  // Format percentage for display
  const formatPercentage = (percentString: string) => {
    if (!percentString) return '0.00%';
    
    // Remove plus sign if present and any '%' symbol
    const cleanPercentage = percentString.replace(/\+|%/g, '');
    // Parse as float and format to 2 decimal places
    const numericValue = parseFloat(cleanPercentage);
    
    return numericValue.toFixed(2) + '%';
  };

  const displayData = watchlistWithHistory.length > 0 ? watchlistWithHistory : watchlist;

  return (
    <Card className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-lg font-medium">Watchlists</h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Symbol
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Watchlist</DialogTitle>

            </DialogHeader>
            <form onSubmit={handleAddSymbol}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="symbol" className="text-right">Symbol</label>
                  <Input
                    id="symbol"
                    name="symbol"
                    placeholder="e.g. AAPL"
                    className="col-span-3"
                    value={formData.symbol}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="name" className="text-right">Name</label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g. Apple Inc."
                    className="col-span-3"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="exchange" className="text-right">Exchange</label>
                  <Select
                    value={formData.exchange}
                    onValueChange={(value) => handleSelectChange("exchange", value)}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select exchange" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NASDAQ">NASDAQ</SelectItem>
                      <SelectItem value="NYSE">NYSE</SelectItem>
                      <SelectItem value="AMEX">AMEX</SelectItem>
                      <SelectItem value="BINANCE">Binance</SelectItem>
                      <SelectItem value="COINBASE">Coinbase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="type" className="text-right">Type</label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => handleSelectChange("type", value)}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stock">Stock</SelectItem>
                      <SelectItem value="crypto">Cryptocurrency</SelectItem>
                      <SelectItem value="etf">ETF</SelectItem>
                      <SelectItem value="forex">Forex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={addToWatchlist.isPending}
                >
                  {addToWatchlist.isPending ? "Adding..." : "Add to Watchlist"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <CardContent className="flex-grow overflow-auto p-0">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : displayData.length === 0 ? (
            <div className="text-center py-8">
              <p>Your watchlist is empty.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              <div className="flex items-center px-4 py-2 text-xs text-muted-foreground">
                <div className="w-20">Symbol</div>
                <div className="flex-1">
                  <div className="text-center">Last Price</div>
                </div>
                <div className="w-20 text-right">Change</div>
                <div className="w-8"></div>
              </div>
              
              {displayData.map((item) => (
                <div 
                  key={item.id} 
                  className="px-4 py-3 hover:bg-gray-900 cursor-pointer"
                  onClick={() => {
                    if (onSelectStock) {
                      onSelectStock(item.symbol);
                    } else {
                      // Navigate to the Quote page if no custom handler is provided
                      navigate(`/quote?symbol=${item.symbol}`);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    {/* Symbol and Company Info */}
                    <div className="w-20">
                      <div className="font-medium text-sm">{item.symbol}</div>
                      <div className="text-xs text-muted-foreground">{item.name?.split(' ')[0] || 'Inc.'}</div>
                    </div>
                    
                    {/* Price Chart */}
                    <div className="flex-1 mx-2 h-10">
                      {item.priceHistory && item.priceHistory.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={item.priceHistory} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id={`colorPrice${item.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop 
                                  offset="5%" 
                                  stopColor={item.isPositive ? "#22c55e" : "#ef4444"} 
                                  stopOpacity={0.3}
                                />
                                <stop 
                                  offset="95%" 
                                  stopColor={item.isPositive ? "#22c55e" : "#ef4444"} 
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <Area
                              type="monotone"
                              dataKey="price"
                              stroke={item.isPositive ? "#22c55e" : "#ef4444"}
                              fillOpacity={1}
                              fill={`url(#colorPrice${item.id})`}
                              isAnimationActive={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <div className="w-full h-1 bg-gray-800 rounded-full"></div>
                        </div>
                      )}
                    </div>
                    
                    {/* Price and Change */}
                    <div className="w-20 text-right">
                      <div className="text-sm font-medium">{item.lastPrice}</div>
                      <div className={`text-xs flex items-center justify-end ${item.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {item.isPositive ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {formatPercentage(item.changePercent)}
                      </div>
                    </div>
                    
                    {/* Remove Button */}
                    <div className="w-8 flex justify-end">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100 hover:bg-gray-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromWatchlist.mutate(item.id);
                        }}
                        disabled={removeFromWatchlist.isPending}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WatchlistTable;