import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layout/MainLayout";
import { Link } from "wouter";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { 
  Binoculars, 
  Filter, 
  PlusCircle, 
  Code,
  ArrowRight,
  MoreVertical,
  Play,
  Pencil,
  Copy,
  Trash,
  Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface Screener {
  id: number;
  name: string;
  description: string;
  type: 'python' | 'javascript';
  status: 'active' | 'inactive' | 'error';
  userId: number;
  source: {
    type: 'code' | 'natural-language';
    content: string;
  };
  configuration: {
    assets: string[];
    parameters: Record<string, any>;
  };
  results?: {
    matches: string[];
    lastRun: string;
    executionTime: number;
  };
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

const ScreenerCard = ({ 
  screener, 
  onEdit, 
  onRun, 
  onDelete 
}: { 
  screener: Screener; 
  onEdit: (id: number) => void;
  onRun: (id: number) => void;
  onDelete: (id: number) => void;
}) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">{screener.name}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(screener.id)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRun(screener.id)}>
                <Play className="mr-2 h-4 w-4" /> Run Screen
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="mr-2 h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive" 
                onClick={() => onDelete(screener.id)}
              >
                <Trash className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardDescription>
          {screener.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Type:</span>
            <span className="flex items-center">
              {screener.type === 'python' ? (
                <>Python <Code className="ml-1 h-3 w-3" /></>
              ) : (
                <>JavaScript <Code className="ml-1 h-3 w-3" /></>
              )}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Assets:</span>
            <span>{screener.configuration.assets.length} symbols</span>
          </div>
          {screener.results?.matches && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Matches:</span>
              <span>{screener.results.matches.length} stocks</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Created:</span>
            <span>{format(new Date(screener.createdAt), 'MMM d, yyyy')}</span>
          </div>
          {screener.lastRunAt && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last run:</span>
              <span>{format(new Date(screener.lastRunAt), 'MMM d, yyyy')}</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end pt-0">
        <Button 
          variant="outline" 
          size="sm" 
          className="text-xs"
          onClick={() => onRun(screener.id)}
        >
          Run Screen <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </CardFooter>
    </Card>
  );
};

const EmptyStateCard = ({ onClick }: { onClick: () => void }) => (
  <Card className="bg-card">
    <CardHeader className="pb-3">
      <CardTitle className="text-lg font-medium">Create Your First Screen</CardTitle>
      <CardDescription>
        Build custom filters to find trading opportunities
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex flex-col items-center justify-center space-y-4 py-8">
        <Binoculars className="h-12 w-12 text-muted-foreground" />
        <p className="text-center text-sm text-muted-foreground">
          Screens help you scan the market for stocks that match specific criteria
        </p>
        <Button onClick={onClick}>
          <PlusCircle className="mr-2 h-4 w-4" /> Get Started
        </Button>
      </div>
    </CardContent>
  </Card>
);

const SkeletonCard = () => (
  <Card>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-3 w-3/4 mt-2" />
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
    </CardContent>
    <CardFooter className="flex justify-end pt-2">
      <Skeleton className="h-8 w-24" />
    </CardFooter>
  </Card>
);

const DeleteConfirmDialog = ({ 
  isOpen, 
  screenerId,
  screenerName,
  onClose, 
  onConfirm,
  isDeleting
}: { 
  isOpen: boolean;
  screenerId: number | null;
  screenerName: string;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete Screen</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete the screen "{screenerName}"? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button 
          variant="destructive" 
          onClick={onConfirm} 
          disabled={isDeleting}
        >
          {isDeleting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deleting...
            </>
          ) : (
            'Delete Screen'
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const Screeners = () => {
  const { toast } = useToast();
  const [screenToDelete, setScreenToDelete] = useState<{id: number, name: string} | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Fetch screeners
  const { 
    data: screeners, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['/api/screeners'],
    refetchOnWindowFocus: false,
  });

  // Delete mutation
  const { 
    mutate: deleteScreener, 
    isPending: isDeleting 
  } = useMutation({
    mutationFn: async (id: number) => {
      return fetch(`/api/screeners/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/screeners'] });
      toast({
        title: "Screen deleted",
        description: "The screen has been successfully deleted.",
      });
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete the screen. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting screen:", error);
    }
  });

  // Run screener mutation
  const { 
    mutate: runScreener, 
    isPending: isRunning 
  } = useMutation({
    mutationFn: async (id: number) => {
      return fetch(`/api/screeners/${id}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(res => {
        if (!res.ok) throw new Error('Failed to run screener');
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/screeners'] });
      toast({
        title: "Screen executed",
        description: "The screen has been executed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to run the screen. Please try again.",
        variant: "destructive",
      });
      console.error("Error running screen:", error);
    }
  });

  const handleCreateScreen = () => {
    // Will be implemented later - redirect to create screen page
    toast({
      title: "Coming Soon",
      description: "The screen creation feature is coming soon.",
    });
  };

  const handleEditScreen = (id: number) => {
    // Will be implemented later - redirect to edit screen page
    toast({
      title: "Coming Soon",
      description: "The screen editing feature is coming soon.",
    });
  };

  const handleRunScreen = (id: number) => {
    runScreener(id);
  };

  const handleDeleteClick = (id: number) => {
    const screener = screeners?.find((s: Screener) => s.id === id);
    if (screener) {
      setScreenToDelete({id, name: screener.name});
      setIsDeleteDialogOpen(true);
    }
  };

  const confirmDelete = () => {
    if (screenToDelete) {
      deleteScreener(screenToDelete.id);
    }
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setScreenToDelete(null);
  };

  if (error) {
    return (
      <MainLayout title="Screens">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Screens</h1>
            <p className="text-muted-foreground">
              Create and manage screens to identify trading opportunities
            </p>
          </div>
          <Button onClick={handleCreateScreen}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create Screen
          </Button>
        </div>
        
        <Card className="bg-card border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Screens</CardTitle>
          </CardHeader>
          <CardContent>
            <p>There was a problem loading your screens. Please try refreshing the page.</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Screens">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Screens</h1>
          <p className="text-muted-foreground">
            Create and manage screens to identify trading opportunities
          </p>
        </div>
        <Button onClick={handleCreateScreen}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Screen
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          // Show skeleton cards while loading
          Array(3).fill(0).map((_, index) => (
            <SkeletonCard key={index} />
          ))
        ) : screeners?.length === 0 ? (
          // Show empty state if no screeners exist
          <>
            <EmptyStateCard onClick={handleCreateScreen} />
            
            {/* Example template cards */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium">Momentum Screen</CardTitle>
                  <Filter className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardDescription>
                  Finds stocks with strong price momentum (Template)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price Change:</span>
                    <span>+5% over 5 days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Volume:</span>
                    <span>Above 1M shares</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">RSI:</span>
                    <span>Above 65</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end pt-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                  onClick={handleCreateScreen}
                >
                  Use Template <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium">Value Finder</CardTitle>
                  <Filter className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardDescription>
                  Identifies undervalued stocks based on fundamentals (Template)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">P/E Ratio:</span>
                    <span>Below 15</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Dividend Yield:</span>
                    <span>Above 2%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Debt/Equity:</span>
                    <span>Below 0.5</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end pt-0">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs"
                  onClick={handleCreateScreen}
                >
                  Use Template <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </CardFooter>
            </Card>
          </>
        ) : (
          // Show actual screeners
          <>
            {screeners.map((screener: Screener) => (
              <ScreenerCard 
                key={screener.id} 
                screener={screener} 
                onEdit={handleEditScreen}
                onRun={handleRunScreen}
                onDelete={handleDeleteClick}
              />
            ))}
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog 
        isOpen={isDeleteDialogOpen}
        screenerId={screenToDelete?.id || null}
        screenerName={screenToDelete?.name || ''}
        onClose={closeDeleteDialog}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
      />
    </MainLayout>
  );
};

export default Screeners;