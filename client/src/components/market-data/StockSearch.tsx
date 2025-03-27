import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useDebounce } from "@/hooks/use-debounce";
import { fetchData } from "@/lib/api";

interface SearchResult {
  symbol: string;
  name: string;
  price: number;
}

const StockSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const debouncedSearch = useDebounce(searchQuery, 300);

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
    <div className="relative">
      <Input
        placeholder="Search stocks..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full"
      />

      {searchResults.length > 0 && (
        <Card className="absolute w-full mt-1 max-h-96 overflow-y-auto z-50">
          <div className="p-2 space-y-1">
            {searchResults.map((result) => (
              <div
                key={result.symbol}
                className="flex justify-between items-start p-2 hover:bg-muted/50 rounded-md cursor-pointer"
              >
                <div className="flex flex-col">
                  <span className="font-bold text-base">{result.symbol}</span>
                  <span className="text-xs text-muted-foreground">{result.name}</span>
                </div>
                <span className="text-sm">${result.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default StockSearch;