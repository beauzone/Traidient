
import { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { fetchData } from "@/lib/api";
import { WatchlistItem } from "../../types";

interface SearchResult {
  symbol: string;
  name: string;
  price: number;
}

interface StockSearchProps {
  onSymbolSelect?: (symbol: string) => void;
  watchlist?: WatchlistItem[];
}

const StockSearch = ({ onSymbolSelect, watchlist = [] }: StockSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const debouncedSearch = useDebounce(searchQuery, 300);

  const handleSelectSymbol = (symbol: string) => {
    if (onSymbolSelect) {
      onSymbolSelect(symbol);
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  useEffect(() => {
    if (debouncedSearch) {
      fetchData<SearchResult[]>(`/api/market-data/search?q=${debouncedSearch}`)
        .then(setSearchResults)
        .catch(console.error);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearch]);

  return (
    <div className="relative w-full">
      <Input
        placeholder="Search stocks..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full"
      />

      {searchResults.length > 0 && (
        <Card className="absolute w-full mt-1 max-h-96 overflow-y-auto z-50 p-0">
          {searchResults.map((result) => (
            <div
              key={result.symbol}
              className="flex justify-between items-start p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
              onClick={() => handleSelectSymbol(result.symbol)}
            >
              <div className="flex flex-col">
                <span className="font-bold text-base">{result.symbol}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                  {result.name}
                </span>
              </div>
              <span className="text-sm font-medium">
                ${result.price.toFixed(2)}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

export default StockSearch;
