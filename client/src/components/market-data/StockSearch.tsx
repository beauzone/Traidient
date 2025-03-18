import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Loader2 } from "lucide-react";
import { postData } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

interface StockSearchProps {
  onSymbolSelect: (symbol: string) => void;
  watchlist: WatchlistItem[];
}

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

const StockSearch = ({ onSymbolSelect, watchlist }: StockSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  // Add to watchlist mutation
  const addToWatchlist = useMutation({
    mutationFn: (data: { symbol: string; name: string; exchange: string; type: string }) => 
      postData('/api/watchlist', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlist'] });
      toast({
        title: "Added to watchlist",
        description: "Symbol has been added to your watchlist",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to add symbol",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      // Using a mock search for now since we don't have a real API
      // In a real app, this would be: const results = await fetchData<SearchResult[]>(`/api/market-data/search?query=${searchQuery}`);
      setTimeout(() => {
        const mockResults: SearchResult[] = [
          { symbol: searchQuery.toUpperCase(), name: `${searchQuery.toUpperCase()} Inc.`, exchange: "NASDAQ", type: "stock" },
          { symbol: `${searchQuery.toUpperCase()}A`, name: `${searchQuery.toUpperCase()} Corp A`, exchange: "NYSE", type: "stock" },
          { symbol: `${searchQuery.toUpperCase()}-USD`, name: `${searchQuery.toUpperCase()} USD`, exchange: "COINBASE", type: "crypto" },
        ];
        setSearchResults(mockResults);
        setIsSearching(false);
      }, 500);
    } catch (error) {
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "Failed to search for symbols",
        variant: "destructive",
      });
      setIsSearching(false);
    }
  };

  // Check if a symbol is already in the watchlist
  const isInWatchlist = (symbol: string) => {
    return watchlist.some(item => item.symbol === symbol);
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <div className="relative flex-grow">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for symbols..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {searchResults.length > 0 && (
        <div className="border rounded-md divide-y divide-border">
          {searchResults.map((result) => (
            <div 
              key={result.symbol} 
              className="p-3 hover:bg-muted/50 flex justify-between items-center cursor-pointer"
              onClick={() => onSymbolSelect(result.symbol)}
            >
              <div>
                <div className="font-medium">{result.symbol}</div>
                <div className="text-xs text-muted-foreground">
                  {result.name} • {result.exchange}
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="ml-2"
                disabled={isInWatchlist(result.symbol) || addToWatchlist.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isInWatchlist(result.symbol)) {
                    addToWatchlist.mutate(result);
                  }
                }}
                title={isInWatchlist(result.symbol) ? "Already in watchlist" : "Add to watchlist"}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-sm font-medium mb-2">Your Watchlist</h3>
        {watchlist.length === 0 ? (
          <p className="text-sm text-muted-foreground">Your watchlist is empty</p>
        ) : (
          <div className="space-y-1">
            {watchlist.map((item) => (
              <div 
                key={item.id} 
                className="p-2 hover:bg-muted/50 rounded-md cursor-pointer flex justify-between"
                onClick={() => onSymbolSelect(item.symbol)}
              >
                <div className="font-medium">{item.symbol}</div>
                <div className="text-xs text-muted-foreground">{item.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockSearch;
