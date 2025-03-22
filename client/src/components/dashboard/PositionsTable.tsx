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
  CardDescription,
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
import { TrendingUp, TrendingDown, Search, Loader2, ArrowUpRight } from "lucide-react";
import { useAccountContext } from "@/context/AccountContext";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link } from "wouter";

// Generic position interface that can represent both open and closed positions
interface Position {
  symbol: string;
  assetName: string;
  quantity: number;
  averageEntryPrice: number;
  costBasis: number;
  positionStatus?: 'open' | 'closed';
  
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

const PositionsTable = () => {
  const { selectedAccount } = useAccountContext();
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [positionStatus, setPositionStatus] = useState<"open" | "closed" | "all">("open");

  // Fetch positions data
  const { data: positions = [], isLoading } = useQuery({
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

  // Filter positions based on search and position status
  const filteredPositions = positions.filter((position) => {
    // First apply the search filter
    const matchesSearch = position.symbol.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          position.assetName.toLowerCase().includes(searchFilter.toLowerCase());
    
    // Then filter by position status (for now we only have open positions from the API)
    // When the API supports closed positions, this will filter them properly
    if (positionStatus === "open") {
      return matchesSearch; // For open positions, return all that match search
    } else if (positionStatus === "closed") {
      // The API doesn't currently return closed positions
      // This space is reserved for when the API supports closed positions
      return false; // For now, there are no closed positions to show
    } else {
      // "all" status - show both open and closed
      return matchesSearch; // Currently identical to "open" since we don't have closed positions
    }
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
              <CardDescription>
                Current holdings in your portfolio
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
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
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : positions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No positions found</p>
              <p className="text-sm text-muted-foreground mt-1">Create a strategy and deploy it to start trading</p>
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
                        <div className="font-medium">{position.symbol}</div>
                        <div className="text-xs text-muted-foreground">{position.assetName}</div>
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
                                <TrendingDown className="ml-1 h-4 w-4 text-red-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{position.marketValue !== undefined ? formatCurrency(position.marketValue) : '-'}</TableCell>
                          <TableCell className="text-right">
                            {position.unrealizedPnL !== undefined && position.unrealizedPnLPercent !== undefined && (
                              <div className={position.unrealizedPnL >= 0 ? "text-green-500" : "text-red-500"}>
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
                              <div className={position.realizedPnL >= 0 ? "text-green-500" : "text-red-500"}>
                                {formatCurrency(position.realizedPnL)} ({formatPercentage(position.realizedPnLPercent)})
                              </div>
                            )}
                          </TableCell>
                        </>
                      )}
                      
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedPosition(position)}
                            >
                              Details
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
                                    <p className="text-sm text-muted-foreground">Asset Name</p>
                                    <p className="font-medium">{position.assetName}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Quantity</p>
                                    <p className="font-medium">{position.quantity}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Entry Price</p>
                                    <p className="font-medium">{formatCurrency(position.averageEntryPrice)}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Cost Basis</p>
                                    <p className="font-medium">{formatCurrency(position.costBasis)}</p>
                                  </div>
                                  
                                  {/* Show additional fields based on position status */}
                                  {position.positionStatus === 'closed' ? (
                                    // Closed position details
                                    <>
                                      {position.exitPrice !== undefined && (
                                        <div>
                                          <p className="text-sm text-muted-foreground">Exit Price</p>
                                          <p className="font-medium">{formatCurrency(position.exitPrice)}</p>
                                        </div>
                                      )}
                                      {position.exitDate && (
                                        <div>
                                          <p className="text-sm text-muted-foreground">Exit Date</p>
                                          <p className="font-medium">{new Date(position.exitDate).toLocaleDateString()}</p>
                                        </div>
                                      )}
                                      {position.entryDate && (
                                        <div>
                                          <p className="text-sm text-muted-foreground">Entry Date</p>
                                          <p className="font-medium">{new Date(position.entryDate).toLocaleDateString()}</p>
                                        </div>
                                      )}
                                      {position.realizedPnL !== undefined && position.realizedPnLPercent !== undefined && (
                                        <div>
                                          <p className="text-sm text-muted-foreground">Realized P&L</p>
                                          <p className={`font-medium ${position.realizedPnL >= 0 ? "text-green-500" : "text-red-500"}`}>
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
                                          <p className="text-sm text-muted-foreground">Current Price</p>
                                          <p className="font-medium">{formatCurrency(position.currentPrice)}</p>
                                        </div>
                                      )}
                                      {position.marketValue !== undefined && (
                                        <div>
                                          <p className="text-sm text-muted-foreground">Market Value</p>
                                          <p className="font-medium">{formatCurrency(position.marketValue)}</p>
                                        </div>
                                      )}
                                      {position.unrealizedPnL !== undefined && position.unrealizedPnLPercent !== undefined && (
                                        <div>
                                          <p className="text-sm text-muted-foreground">Unrealized P&L</p>
                                          <p className={`font-medium ${position.unrealizedPnL >= 0 ? "text-green-500" : "text-red-500"}`}>
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