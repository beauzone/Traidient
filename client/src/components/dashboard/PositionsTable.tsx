import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Search, Loader2, ArrowUpRight, PenLine, XCircle } from "lucide-react";
import { useAccountContext } from "@/context/AccountContext";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link } from "wouter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

// Generic position interface that can represent both open and closed positions
interface Position {
  symbol: string;
  assetName: string;
  quantity: number;
  averageEntryPrice: number;
  costBasis: number;
  positionStatus?: 'open' | 'closed';
  
  // Asset classification
  assetType?: 'US Equity' | 'Crypto' | 'Options' | string;
  side?: 'Long' | 'Short';
  
  // Fields for open positions
  currentPrice?: number;
  marketValue?: number;
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
  
  // Fields for closed positions
  exitPrice?: number;
  realizedPnL?: number;
  realizedPnLPercent?: number;
  entryDate?: string;
  exitDate?: string;
}

interface PositionsTableProps {
  passedPositions?: Position[];
  isLoading?: boolean;
}

const PositionsTable = ({ passedPositions, isLoading: passedIsLoading }: PositionsTableProps = {}) => {
  const { selectedAccount } = useAccountContext();
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [positionStatus, setPositionStatus] = useState<"open" | "closed" | "all">("open");
  const [assetClassFilter, setAssetClassFilter] = useState<string>("all");
  const [sideFilter, setSideFilter] = useState<string>("all");
  const { toast } = useToast();
  
  // Use passed loading state or query loading state
  let positions: Position[] = [];
  let isLoading = passedIsLoading;
  
  // If positions are passed directly, use them instead of querying
  if (passedPositions) {
    positions = passedPositions;
  } else {
    // Fetch positions data if not passed directly
    const { data: fetchedPositions = [], isLoading: queryIsLoading } = useQuery({
      queryKey: ['/api/trading/positions', selectedAccount, positionStatus],
      queryFn: () => {
        // Build the endpoint with appropriate query parameters
        let endpoint = '/api/trading/positions';
        const params = new URLSearchParams();
        
        // Add accountId parameter if specified
        if (selectedAccount && selectedAccount !== "all") {
          params.append('accountId', selectedAccount);
        }
        
        // Add status parameter based on filter
        params.append('status', positionStatus);
        
        // Add query parameters to endpoint
        if (params.toString()) {
          endpoint += `?${params.toString()}`;
        }
        
        return fetchData<Position[]>(endpoint);
      },
      refetchInterval: 15000, // Refresh every 15 seconds
    });
    
    positions = fetchedPositions;
    isLoading = isLoading !== undefined ? isLoading : queryIsLoading;
  }

  // Filter positions based on search, position status, asset class, and side
  const filteredPositions = positions.filter((position) => {
    // First apply the search filter
    const matchesSearch = position.symbol.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          position.assetName.toLowerCase().includes(searchFilter.toLowerCase());
    
    // Filter by position status
    let matchesStatus = true;
    if (positionStatus === "open") {
      matchesStatus = position.positionStatus !== 'closed';
    } else if (positionStatus === "closed") {
      matchesStatus = position.positionStatus === 'closed';
    }
    
    // Filter by asset class
    let matchesAssetClass = true;
    if (assetClassFilter !== "all") {
      // Default to "US Equity" if assetType isn't specified
      const positionAssetType = position.assetType || "US Equity";
      matchesAssetClass = positionAssetType === assetClassFilter;
    }
    
    // Filter by side (long/short)
    let matchesSide = true;
    if (sideFilter !== "all") {
      // Default to "Long" if side isn't specified
      const positionSide = position.side || "Long";
      matchesSide = positionSide === sideFilter;
    }
    
    // Return true only if all filters match
    return matchesSearch && matchesStatus && matchesAssetClass && matchesSide;
  });

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

  return (
    <div className="mt-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Positions</CardTitle>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4" />
                <Input
                  placeholder="Search positions..."
                  className="pl-8"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
              <Select
                value={positionStatus}
                onValueChange={(value) => setPositionStatus(value as "open" | "closed" | "all")}
              >
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* New Filter Options */}
          <div className="flex items-center mt-4 space-x-3">
            <div className="flex items-center bg-muted rounded-md p-2">
              <span className="text-sm mr-3 pl-1">Asset Class</span>
              <Select value={assetClassFilter} onValueChange={setAssetClassFilter}>
                <SelectTrigger className="border-0 bg-transparent h-8 w-28 p-0 pl-2 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Crypto">Crypto</SelectItem>
                  <SelectItem value="US Equity">US Equity</SelectItem>
                  <SelectItem value="Options">Options</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center bg-muted rounded-md p-2">
              <span className="text-sm mr-3 pl-1">Side</span>
              <Select value={sideFilter} onValueChange={setSideFilter}>
                <SelectTrigger className="border-0 bg-transparent h-8 w-28 p-0 pl-2 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Long">Long</SelectItem>
                  <SelectItem value="Short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="ml-auto">
              <Button variant="link" onClick={() => window.location.href = "/dashboard"}>
                View All
              </Button>
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
                    {positionStatus !== 'closed' && (
                      <>
                        <TableHead>Current Price</TableHead>
                        <TableHead className="text-right">Market Value</TableHead>
                        <TableHead className="text-right">Unrealized P&L</TableHead>
                      </>
                    )}
                    {positionStatus === 'closed' && (
                      <>
                        <TableHead>Exit Price</TableHead>
                        <TableHead>Exit Date</TableHead>
                        <TableHead className="text-right">Realized P&L</TableHead>
                      </>
                    )}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPositions.map((position) => (
                    <TableRow key={`${position.symbol}-${position.entryDate || ''}`}>
                      <TableCell>
                        <div 
                          className="font-medium cursor-pointer hover:text-primary transition-colors"
                          onClick={() => {
                            // Navigate to the symbol on the quote page
                            window.location.href = `/quote?symbol=${position.symbol}`;
                          }}
                        >
                          {position.symbol}
                        </div>
                        <div className="text-xs">{position.assetName}</div>
                      </TableCell>
                      <TableCell>{position.quantity}</TableCell>
                      <TableCell>{formatCurrency(position.averageEntryPrice)}</TableCell>
                      
                      {/* Open position specific columns */}
                      {position.positionStatus !== 'closed' && position.currentPrice !== undefined && (
                        <>
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
                          <TableCell className="text-right">{position.marketValue !== undefined ? formatCurrency(position.marketValue) : '-'}</TableCell>
                          <TableCell className="text-right">
                            {position.unrealizedPnL !== undefined && position.unrealizedPnLPercent !== undefined && (
                              <div className={position.unrealizedPnL >= 0 ? "text-green-500" : "text-negative"}>
                                {formatCurrency(position.unrealizedPnL)} ({formatPercentage(position.unrealizedPnLPercent)})
                              </div>
                            )}
                          </TableCell>
                        </>
                      )}
                      
                      {/* Closed position specific columns */}
                      {position.positionStatus === 'closed' && position.exitPrice !== undefined && (
                        <>
                          <TableCell>{formatCurrency(position.exitPrice)}</TableCell>
                          <TableCell>{position.exitDate ? new Date(position.exitDate).toLocaleDateString() : '-'}</TableCell>
                          <TableCell className="text-right">
                            {position.realizedPnL !== undefined && position.realizedPnLPercent !== undefined && (
                              <div className={position.realizedPnL >= 0 ? "text-green-500" : "text-negative"}>
                                {formatCurrency(position.realizedPnL)} ({formatPercentage(position.realizedPnLPercent)})
                              </div>
                            )}
                          </TableCell>
                        </>
                      )}
                      
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {/* Modify Position Button */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:text-primary"
                                  onClick={() => {
                                    setSelectedPosition(position);
                                    toast({
                                      title: "Redirecting to Live Trading",
                                      description: `Preparing to modify position for ${position.symbol}`,
                                    });
                                    window.location.href = `/live-trading?symbol=${position.symbol}&action=modify`;
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
                          
                          {/* Exit Position Button */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:text-red-500"
                                  onClick={() => {
                                    setSelectedPosition(position);
                                    toast({
                                      title: "Redirecting to Live Trading",
                                      description: `Preparing to exit position for ${position.symbol}`,
                                      variant: "destructive"
                                    });
                                    window.location.href = `/live-trading?symbol=${position.symbol}&action=exit`;
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
                          
                          {/* Position Details Dialog */}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8 hover:text-primary"
                                onClick={() => setSelectedPosition(position)}
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Position Details: {position.symbol}</DialogTitle>
                              </DialogHeader>
                              {selectedPosition && selectedPosition.symbol === position.symbol && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm">Asset Name</p>
                                      <p className="font-medium">{position.assetName}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm">Quantity</p>
                                      <p className="font-medium">{position.quantity}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm">Entry Price</p>
                                      <p className="font-medium">{formatCurrency(position.averageEntryPrice)}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm">Cost Basis</p>
                                      <p className="font-medium">{formatCurrency(position.costBasis)}</p>
                                    </div>
                                    
                                    {/* Show additional fields based on position status */}
                                    {position.positionStatus === 'closed' ? (
                                      // Closed position details
                                      <>
                                        {position.exitPrice !== undefined && (
                                          <div>
                                            <p className="text-sm">Exit Price</p>
                                            <p className="font-medium">{formatCurrency(position.exitPrice)}</p>
                                          </div>
                                        )}
                                        {position.exitDate && (
                                          <div>
                                            <p className="text-sm">Exit Date</p>
                                            <p className="font-medium">{new Date(position.exitDate).toLocaleDateString()}</p>
                                          </div>
                                        )}
                                        {position.entryDate && (
                                          <div>
                                            <p className="text-sm">Entry Date</p>
                                            <p className="font-medium">{new Date(position.entryDate).toLocaleDateString()}</p>
                                          </div>
                                        )}
                                        {position.realizedPnL !== undefined && position.realizedPnLPercent !== undefined && (
                                          <div>
                                            <p className="text-sm">Realized P&L</p>
                                            <p className={`font-medium ${position.realizedPnL >= 0 ? "text-green-500" : "text-negative"}`}>
                                              {formatCurrency(position.realizedPnL)} ({formatPercentage(position.realizedPnLPercent)})
                                            </p>
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      // Open position details
                                      <>
                                        {position.currentPrice !== undefined && (
                                          <div>
                                            <p className="text-sm">Current Price</p>
                                            <p className="font-medium">{formatCurrency(position.currentPrice)}</p>
                                          </div>
                                        )}
                                        {position.marketValue !== undefined && (
                                          <div>
                                            <p className="text-sm">Market Value</p>
                                            <p className="font-medium">{formatCurrency(position.marketValue)}</p>
                                          </div>
                                        )}
                                        {position.unrealizedPnL !== undefined && position.unrealizedPnLPercent !== undefined && (
                                          <div>
                                            <p className="text-sm">Unrealized P&L</p>
                                            <p className={`font-medium ${position.unrealizedPnL >= 0 ? "text-green-500" : "text-negative"}`}>
                                              {formatCurrency(position.unrealizedPnL)} ({formatPercentage(position.unrealizedPnLPercent)})
                                            </p>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                  
                                  {/* Only show action buttons for open positions */}
                                  {position.positionStatus !== 'closed' && (
                                    <div className="flex justify-end space-x-2">
                                      <Button variant="outline">Close Position</Button>
                                      <Button variant="outline">Modify Position</Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        <div className="bg-muted px-5 py-3">
          <div className="text-sm">
            <Link href="/live-trading" className="font-medium text-primary hover:text-primary/80 flex items-center">
              <span>View all positions</span> <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PositionsTable;