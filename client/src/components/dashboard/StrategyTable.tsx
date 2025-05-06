import { Card, CardContent } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Edit, Pause, Play, MoreVertical, ArrowUpRight, Bot, Rocket, BarChart2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface Strategy {
  id: number;
  name: string;
  createdAt: string;
  type: 'AI-Generated' | 'Template' | 'Custom';
  assets: string[];
  profitLoss: {
    value: string;
    percentage: string;
    isPositive: boolean;
  };
  winRate: number;
  status: 'Running' | 'Paused' | 'Inactive' | 'Error';
}

interface StrategyTableProps {
  strategies: Strategy[];
  onPause: (id: number) => void;
  onPlay: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

const StrategyTable = ({ 
  strategies, 
  onPause, 
  onPlay, 
  onEdit, 
  onDelete 
}: StrategyTableProps) => {
  // Helper to get the right icon based on strategy type
  const getStrategyIcon = (type: string) => {
    switch (type) {
      case 'AI-Generated':
        return <Bot className="text-primary" />;
      case 'Custom':
        return <Rocket className="text-accent" />;
      case 'Template':
        return <BarChart2 className="text-secondary" />;
      default:
        return <Bot className="text-primary" />;
    }
  };

  // Helper to get the right badge based on status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Running':
        return <Badge variant="outline" className="bg-secondary bg-opacity-20 text-secondary border-none">Running</Badge>;
      case 'Paused':
        return <Badge variant="outline" className="bg-yellow-500 bg-opacity-20 text-yellow-500 border-none">Paused</Badge>;
      case 'Inactive':
        return <Badge variant="outline" className="bg-muted bg-opacity-20 border-none">Inactive</Badge>;
      case 'Error':
        return <Badge variant="outline" className="bg-destructive bg-opacity-20 text-destructive border-none">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="mt-8">
      <CardContent className="p-0">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Strategy Performance</h3>
            <select className="bg-background border border-border rounded-md text-foreground p-2 text-sm focus:ring-primary focus:border-primary">
              <option>All Strategies</option>
              <option>Active Strategies</option>
              <option>Paused Strategies</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategy</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Assets</TableHead>
                <TableHead>Profit/Loss</TableHead>
                <TableHead>Win Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {strategies.map((strategy) => (
                <TableRow key={strategy.id}>
                  <TableCell>
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-primary bg-opacity-20">
                        {getStrategyIcon(strategy.type)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium">{strategy.name}</div>
                        <div className="text-xs">
                          Created {new Date(strategy.createdAt).toLocaleDateString(undefined, { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{strategy.type}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex -space-x-1 overflow-hidden">
                      {Array.isArray(strategy.assets) && strategy.assets.slice(0, 3).map((asset, idx) => (
                        <span key={idx} className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-background border border-border text-xs font-medium">
                          {asset}
                        </span>
                      ))}
                      {Array.isArray(strategy.assets) && strategy.assets.length > 3 && (
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-background border border-border text-xs font-medium">
                          +{strategy.assets.length - 3}
                        </span>
                      )}
                      {!Array.isArray(strategy.assets) && (
                        <span className="text-xs">No assets</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {strategy.profitLoss && typeof strategy.profitLoss === 'object' && 
                     'isPositive' in strategy.profitLoss && 
                     'value' in strategy.profitLoss && 
                     'percentage' in strategy.profitLoss ? (
                      <div className={`text-sm font-medium ${strategy.profitLoss.isPositive ? 'text-secondary' : 'text-negative'}`}>
                        {strategy.profitLoss.value} ({strategy.profitLoss.percentage})
                      </div>
                    ) : (
                      <div className="text-xs">Not available</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {typeof strategy.winRate === 'number' ? (
                      <>
                        <div className="text-sm">{strategy.winRate}%</div>
                        <div className="mt-1 w-20 h-1.5 bg-background rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              strategy.winRate >= 60 ? 'bg-secondary' : 
                              strategy.winRate >= 40 ? 'bg-accent' : 'bg-[#FF3B5C]'
                            }`} 
                            style={{ width: `${strategy.winRate}%` }}
                          ></div>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs">Not available</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {strategy.status ? getStatusBadge(strategy.status) : (
                      <Badge variant="outline" className="bg-muted bg-opacity-20 border-none">Unknown</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(strategy.id)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      {strategy.status && strategy.status === 'Running' ? (
                        <Button variant="ghost" size="icon" onClick={() => onPause(strategy.id)}>
                          <Pause className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" onClick={() => onPlay(strategy.id)}>
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(strategy.id)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            Clone
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            Backtest
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(strategy.id)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="bg-muted px-5 py-3 border-t border-border text-sm">
          <Link href="/strategies" className="font-medium text-primary hover:text-primary/80">
            View all strategies <ArrowUpRight className="inline ml-1 h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default StrategyTable;
