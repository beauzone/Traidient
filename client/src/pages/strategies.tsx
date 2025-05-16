import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { fetchData, deleteData, updateData, postData } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import MainLayout from "@/components/layout/MainLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Plus,
  Trash2,
  Edit,
  Copy,
  PlayCircle,
  PauseCircle,
  StopCircle,
  MoreHorizontal,
  TestTube2,
  RefreshCw,
  Bot,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface Strategy {
  id: number;
  name: string;
  description: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  configuration: {
    assets: string[];
  };
  performance?: {
    liveStats?: {
      trades: number;
      winRate: number;
      profitLoss: number;
    };
  };
}

const StrategiesPage = () => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [deleteStrategyId, setDeleteStrategyId] = useState<number | null>(null);

  // Fetch strategies
  const { data: strategies = [], isLoading } = useQuery({
    queryKey: ['/api/strategies'],
    queryFn: () => fetchData<Strategy[]>('/api/strategies'),
  });

  // Delete strategy mutation
  const deleteStrategy = useMutation({
    mutationFn: (id: number) => deleteData(`/api/strategies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/strategies'] });
      toast({
        title: "Strategy deleted",
        description: "The strategy has been deleted successfully.",
      });
      setDeleteStrategyId(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to delete strategy",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      });
    }
  });

  // Update strategy status mutation
  const updateStrategyStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => 
      updateData(`/api/strategies/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/strategies'] });
      toast({
        title: "Status updated",
        description: "Strategy status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update status",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      });
    }
  });
  
  // Clone strategy mutation
  const cloneStrategy = useMutation({
    mutationFn: async (id: number) => {
      try {
        // First fetch the original strategy
        const originalStrategy = await fetchData(`/api/strategies/${id}`);
        
        // Extract only the required fields for creating a new strategy
        // using the schema defined in shared/schema.ts (insertStrategySchema)
        const cloneData = {
          name: `${originalStrategy.name} (Clone)`,
          description: originalStrategy.description,
          type: originalStrategy.type,
          source: originalStrategy.source,
          configuration: originalStrategy.configuration,
        };
        
        // Create a new strategy using the data from the original
        return await apiRequest('/api/strategies', { method: 'POST' }, cloneData);
      } catch (error) {
        console.error("Error during clone operation:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/strategies'] });
      toast({
        title: "Strategy cloned",
        description: "The strategy has been cloned successfully.",
      });
    },
    onError: (error) => {
      console.error("Clone error details:", error);
      toast({
        title: "Failed to clone strategy",
        description: error instanceof Error ? error.message : "An error occurred during cloning.",
        variant: "destructive",
      });
    }
  });

  // Filter strategies based on search query and status filter
  const filteredStrategies = strategies.filter((strategy) => {
    const matchesSearch = searchQuery
      ? strategy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        strategy.description.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    
    const matchesStatus = statusFilter 
      ? strategy.status.toLowerCase() === statusFilter.toLowerCase() 
      : true;
    
    return matchesSearch && matchesStatus;
  });

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <Badge variant="outline" className="bg-green-500 bg-opacity-20 text-green-500 border-none">Active</Badge>;
      case 'inactive':
        return <Badge variant="outline" className="bg-yellow-500 bg-opacity-20 text-yellow-500 border-none">Inactive</Badge>;
      case 'draft':
        return <Badge variant="outline" className="bg-muted bg-opacity-20 text-muted-foreground border-none">Draft</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-destructive bg-opacity-20 text-destructive border-none">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <MainLayout title="Strategies">
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Strategies</h1>
            <p className="text-muted-foreground">
              Create and manage trading strategies for your portfolio
            </p>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2 w-full max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search strategies..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 py-2"
              value={statusFilter || ""}
              onChange={(e) => setStatusFilter(e.target.value || null)}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
              <option value="error">Error</option>
            </select>
          </div>
          
          <Button onClick={() => navigate("/strategies/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Strategy
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : filteredStrategies.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No strategies found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {searchQuery || statusFilter
                ? "Try adjusting your search or filters"
                : "Get started by creating your first trading strategy"}
            </p>
            <Button className="mt-6" onClick={() => navigate("/strategies/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Strategy
            </Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Assets</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStrategies.map((strategy) => (
                  <TableRow key={strategy.id}>
                    <TableCell>
                      <div className="font-medium">{strategy.name}</div>
                      <div className="text-sm text-muted-foreground truncate max-w-xs">
                        {strategy.description.substring(0, 60)}
                        {strategy.description.length > 60 ? "..." : ""}
                      </div>
                    </TableCell>
                    <TableCell>{strategy.type}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {strategy.configuration.assets.slice(0, 3).map((asset, idx) => (
                          <Badge key={idx} variant="outline">{asset}</Badge>
                        ))}
                        {strategy.configuration.assets.length > 3 && (
                          <Badge variant="outline">+{strategy.configuration.assets.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(strategy.status)}</TableCell>
                    <TableCell>{formatDate(strategy.createdAt)}</TableCell>
                    <TableCell>
                      {strategy.performance?.liveStats ? (
                        <div>
                          <div className={`font-medium ${strategy.performance.liveStats.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {strategy.performance.liveStats.profitLoss >= 0 ? '+' : ''}
                            {strategy.performance.liveStats.profitLoss.toFixed(2)}%
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {strategy.performance.liveStats.trades} trades, {strategy.performance.liveStats.winRate}% win rate
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No data</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/strategies/${strategy.id}`)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => cloneStrategy.mutate(strategy.id)}>
                            <Copy className="mr-2 h-4 w-4" /> Clone
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/backtest?strategyId=${strategy.id}`)}>
                            <TestTube2 className="mr-2 h-4 w-4" /> Backtest
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          {strategy.status === 'active' ? (
                            <DropdownMenuItem onClick={() => updateStrategyStatus.mutate({ id: strategy.id, status: 'inactive' })}>
                              <PauseCircle className="mr-2 h-4 w-4" /> Pause
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => updateStrategyStatus.mutate({ id: strategy.id, status: 'active' })}>
                              <PlayCircle className="mr-2 h-4 w-4" /> Activate
                            </DropdownMenuItem>
                          )}
                          
                          {strategy.status === 'error' && (
                            <DropdownMenuItem onClick={() => updateStrategyStatus.mutate({ id: strategy.id, status: 'inactive' })}>
                              <RefreshCw className="mr-2 h-4 w-4" /> Reset Error
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive" 
                            onClick={() => setDeleteStrategyId(strategy.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteStrategyId !== null} onOpenChange={() => setDeleteStrategyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              strategy and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteStrategyId && deleteStrategy.mutate(deleteStrategyId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

// Import the Bot icon at the top of the imports section instead of using a custom icon

export default StrategiesPage;
