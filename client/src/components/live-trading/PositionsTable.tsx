import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Search, TrendingUp, TrendingDown, PenLine, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { TradeDialog } from "./TradeDialog";
import { useLocation } from "wouter";

interface Position {
  symbol: string;
  assetName: string;
  quantity: number;
  averageEntryPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  currentPrice: number;
}

export interface PositionsTableProps {
  onSymbolSelect?: (symbol: string) => void;
}

const PositionsTable = ({ onSymbolSelect }: PositionsTableProps) => {
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
  const [tradeAction, setTradeAction] = useState<"modify" | "exit" | null>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Fetch positions data
  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['/api/trading/positions'],
    queryFn: () => fetchData<Position[]>('/api/trading/positions'),
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Filter positions based on search
  const filteredPositions = positions.filter((position) => 
    position.symbol.toLowerCase().includes(searchFilter.toLowerCase()) ||
    position.assetName.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Handle trade confirmation
  const handleTradeConfirm = (action: string, symbol: string, quantity: number, price: number | null, type: string) => {
    // In a real implementation, this would call the API to execute the trade
    toast({
      title: `${action === 'exit' ? 'Position exit' : 'Position modification'} submitted`,
      description: `${symbol}: ${quantity} shares at ${price ? formatCurrency(price) : 'market price'}`,
    });
    
    // For demo purposes, we'll just show a toast notification
    console.log('Trade submitted:', { action, symbol, quantity, price, type });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Open Positions</CardTitle>

          </div>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search positions..."
              className="pl-8"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-8">
            <p>No positions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Entry Price</TableHead>
                  <TableHead>Current Price</TableHead>
                  <TableHead className="text-right">Market Value</TableHead>
                  <TableHead className="text-right">Unrealized P&L</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPositions.map((position) => (
                  <TableRow key={position.symbol}>
                    <TableCell>
                      <div 
                        className="font-medium cursor-pointer hover:text-primary transition-colors"
                        onClick={() => {
                          if (onSymbolSelect) {
                            onSymbolSelect(position.symbol);
                          } else {
                            // Navigate to the new Quote page
                            navigate(`/quote?symbol=${position.symbol}`);
                          }
                        }}
                      >
                        {position.symbol}
                      </div>
                      <div className="text-xs">{position.assetName}</div>
                    </TableCell>
                    <TableCell>{position.quantity}</TableCell>
                    <TableCell>{formatCurrency(position.averageEntryPrice)}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {formatCurrency(position.currentPrice)}
                        {position.currentPrice > position.averageEntryPrice ? (
                          <TrendingUp className="ml-1 h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="ml-1 h-4 w-4 text-negative" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(position.marketValue)}</TableCell>
                    <TableCell className="text-right">
                      <div className={position.unrealizedPnL >= 0 ? "text-green-500" : "text-negative"}>
                        {formatCurrency(position.unrealizedPnL)} ({formatPercentage(position.unrealizedPnLPercent)})
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => {
                                  setSelectedPosition(position);
                                  toast({
                                    title: "Preparing to modify position",
                                    description: `Loading trade form for ${position.symbol}`,
                                  });
                                  setTradeAction("modify");
                                  setTradeDialogOpen(true);
                                }}
                              >
                                <PenLine className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Modify Position</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                onClick={() => {
                                  setSelectedPosition(position);
                                  toast({
                                    title: "Preparing to exit position",
                                    description: `Loading exit form for ${position.symbol}`,
                                    variant: "destructive"
                                  });
                                  setTradeAction("exit");
                                  setTradeDialogOpen(true);
                                }}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Exit Position</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      
      {/* Trade Dialog */}
      <TradeDialog
        open={tradeDialogOpen}
        onOpenChange={setTradeDialogOpen}
        position={selectedPosition}
        action={tradeAction}
        onConfirm={handleTradeConfirm}
      />
    </Card>
  );
};

export default PositionsTable;
