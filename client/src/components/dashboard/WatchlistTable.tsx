import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { X, Plus } from "lucide-react";
import { fetchData, postData, deleteData } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

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

interface AddWatchlistFormData {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

const WatchlistTable = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState<AddWatchlistFormData>({
    symbol: "",
    name: "",
    exchange: "NASDAQ",
    type: "stock"
  });
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Query to fetch watchlist items
  const { data: watchlist = [], isLoading } = useQuery({
    queryKey: ['/api/watchlist'],
    queryFn: () => fetchData<WatchlistItem[]>('/api/watchlist')
  });

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

  return (
    <Card className="mt-8">
      <CardContent className="p-0">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Watchlist</h3>
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
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : watchlist.length === 0 ? (
            <div className="text-center py-8">
              <p>Your watchlist is empty</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Last Price</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>% Change</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Market Cap</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {watchlist.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div 
                        className="flex items-center cursor-pointer hover:text-primary transition-colors"
                        onClick={() => navigate(`/quote?symbol=${item.symbol}`)}
                      >
                        <div className="text-sm font-medium">{item.symbol}</div>
                        <div className="ml-2 text-xs">{item.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{item.lastPrice}</div>
                    </TableCell>
                    <TableCell>
                      <div className={`text-sm font-medium ${item.isPositive ? 'text-secondary' : 'text-negative'}`}>
                        {item.change}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`text-sm font-medium ${item.isPositive ? 'text-secondary' : 'text-negative'}`}>
                        {item.changePercent}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{item.volume}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{item.marketCap}</div>
                    </TableCell>
                    <TableCell className="space-x-3">
                      <Button variant="link" size="sm">Trade</Button>
                      <Button variant="link" size="sm">Create Strategy</Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeFromWatchlist.mutate(item.id)}
                        disabled={removeFromWatchlist.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WatchlistTable;
