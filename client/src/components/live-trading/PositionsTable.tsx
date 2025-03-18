import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchData } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Search, TrendingUp, TrendingDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

const PositionsTable = () => {
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

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

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Open Positions</CardTitle>
            <CardDescription>
              Currently active market positions
            </CardDescription>
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
            <p className="text-muted-foreground">No positions found</p>
            <p className="text-sm text-muted-foreground mt-1">Deploy a strategy to start trading</p>
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
                      <div className="font-medium">{position.symbol}</div>
                      <div className="text-xs text-muted-foreground">{position.assetName}</div>
                    </TableCell>
                    <TableCell>{position.quantity}</TableCell>
                    <TableCell>{formatCurrency(position.averageEntryPrice)}</TableCell>
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
                    <TableCell className="text-right">{formatCurrency(position.marketValue)}</TableCell>
                    <TableCell className="text-right">
                      <div className={position.unrealizedPnL >= 0 ? "text-green-500" : "text-red-500"}>
                        {formatCurrency(position.unrealizedPnL)} ({formatPercentage(position.unrealizedPnLPercent)})
                      </div>
                    </TableCell>
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
                                  <p className="text-sm text-muted-foreground">Current Price</p>
                                  <p className="font-medium">{formatCurrency(position.currentPrice)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Market Value</p>
                                  <p className="font-medium">{formatCurrency(position.marketValue)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Cost Basis</p>
                                  <p className="font-medium">{formatCurrency(position.costBasis)}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Unrealized P&L</p>
                                  <p className={`font-medium ${position.unrealizedPnL >= 0 ? "text-green-500" : "text-red-500"}`}>
                                    {formatCurrency(position.unrealizedPnL)} ({formatPercentage(position.unrealizedPnLPercent)})
                                  </p>
                                </div>
                              </div>
                              <div className="flex justify-end space-x-2">
                                <Button variant="outline">Close Position</Button>
                                <Button variant="outline">Modify Position</Button>
                              </div>
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
    </Card>
  );
};

export default PositionsTable;
