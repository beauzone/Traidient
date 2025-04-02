import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Watchlist, WatchlistItem } from '@shared/schema';
import { toast } from '@/hooks/use-toast';

// Types
type WatchlistWithItems = Watchlist & { items: WatchlistItem[] };

interface WatchlistContextType {
  watchlists: WatchlistWithItems[];
  currentWatchlist: WatchlistWithItems | null;
  isLoading: boolean;
  error: Error | null;
  setCurrentWatchlist: (watchlist: WatchlistWithItems | null) => void;
  createWatchlist: (name: string) => Promise<Watchlist>;
  updateWatchlist: (id: number, data: Partial<Watchlist>) => Promise<Watchlist>;
  deleteWatchlist: (id: number) => Promise<void>;
  addToWatchlist: (watchlistId: number, item: {
    symbol: string;
    name: string;
    exchange: string;
    type: string;
    displayOrder?: number;
  }) => Promise<WatchlistItem>;
  removeFromWatchlist: (watchlistId: number, itemId: number) => Promise<void>;
  reorderWatchlists: (orderedLists: { id: number, displayOrder: number }[]) => Promise<Watchlist[]>;
  reorderWatchlistItems: (watchlistId: number, orderedItems: { id: number, displayOrder: number }[]) => Promise<WatchlistItem[]>;
  createDefaultWatchlist: () => Promise<WatchlistWithItems>;
}

// Create context
const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

// Provider component
export const WatchlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [currentWatchlist, setCurrentWatchlist] = useState<WatchlistWithItems | null>(null);
  
  // Fetch watchlists
  const { 
    data: watchlists = [], 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['/api/watchlists'],
    select: (data: WatchlistWithItems[]) => {
      console.log('Received watchlists data:', data);
      // Sort by display order
      return [...data].sort((a, b) => a.displayOrder - b.displayOrder);
    }
  });

  // Log errors from watchlist query
  useEffect(() => {
    if (error) {
      console.error('Error fetching watchlists:', error);
      toast({
        title: "Couldn't load watchlists",
        description: error instanceof Error ? error.message : "There was a problem loading your watchlists",
        variant: "destructive"
      });
    }
  }, [error]);

  // Query for default watchlist (create it if it doesn't exist)
  const { 
    data: defaultWatchlist,
    error: defaultWatchlistError
  } = useQuery({
    queryKey: ['/api/watchlists/default'],
    enabled: watchlists.length === 0 // Only run this query if no watchlists were found initially
  });
  
  // Log default watchlist data and errors
  useEffect(() => {
    if (defaultWatchlist) {
      console.log('Received default watchlist data:', defaultWatchlist);
    }
    if (defaultWatchlistError) {
      console.error('Error fetching default watchlist:', defaultWatchlistError);
    }
  }, [defaultWatchlist, defaultWatchlistError]);

  // Set current watchlist to default one if not already set
  useEffect(() => {
    // First check regular watchlists
    if (watchlists.length > 0 && !currentWatchlist) {
      const defaultWatchlist = watchlists.find(w => w.isDefault) || watchlists[0];
      setCurrentWatchlist(defaultWatchlist);
    }
    // If no regular watchlists but we have a default one
    else if (watchlists.length === 0 && defaultWatchlist && !currentWatchlist) {
      setCurrentWatchlist(defaultWatchlist);
      // Invalidate watchlists query to include the new default
      queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
    }
  }, [watchlists, currentWatchlist, defaultWatchlist, queryClient]);
  
  // Create watchlist mutation
  const createWatchlistMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest('/api/watchlists', {
        method: 'POST',
        data: { name }
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      toast({
        title: "Watchlist created",
        description: "Your new watchlist has been created successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating watchlist",
        description: error.message || "Failed to create watchlist",
        variant: "destructive"
      });
    }
  });

  // Update watchlist mutation
  const updateWatchlistMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<Watchlist> }) => {
      const response = await apiRequest(`/api/watchlists/${id}`, {
        method: 'PUT',
        data
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      toast({
        title: "Watchlist updated",
        description: "Your watchlist has been updated successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating watchlist",
        description: error.message || "Failed to update watchlist",
        variant: "destructive"
      });
    }
  });

  // Delete watchlist mutation
  const deleteWatchlistMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/watchlists/${id}`, {
        method: 'DELETE'
      });
      return response;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      
      // If current watchlist was deleted, select a new one
      if (currentWatchlist && currentWatchlist.id === id) {
        setCurrentWatchlist(null);
      }
      
      toast({
        title: "Watchlist deleted",
        description: "Your watchlist has been deleted successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting watchlist",
        description: error.message || "Failed to delete watchlist",
        variant: "destructive"
      });
    }
  });

  // Add item to watchlist mutation
  const addToWatchlistMutation = useMutation({
    mutationFn: async ({ 
      watchlistId, 
      item 
    }: { 
      watchlistId: number, 
      item: { 
        symbol: string;
        name: string;
        exchange: string;
        type: string;
        displayOrder?: number;
      } 
    }) => {
      const response = await apiRequest(`/api/watchlists/${watchlistId}/items`, {
        method: 'POST',
        data: item
      });
      return response;
    },
    onSuccess: (_, { watchlistId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      toast({
        title: "Symbol added",
        description: "Symbol has been added to your watchlist"
      });
    },
    onError: (error: any, { item }) => {
      // If it's a conflict error (item already exists), don't show error toast
      if (error.status === 409) {
        toast({
          title: "Symbol already in watchlist",
          description: `${item.symbol} is already in this watchlist`
        });
        return;
      }
      
      toast({
        title: "Error adding symbol",
        description: error.message || "Failed to add symbol to watchlist",
        variant: "destructive"
      });
    }
  });

  // Remove item from watchlist mutation
  const removeFromWatchlistMutation = useMutation({
    mutationFn: async ({ watchlistId, itemId }: { watchlistId: number, itemId: number }) => {
      const response = await apiRequest(`/api/watchlists/${watchlistId}/items/${itemId}`, {
        method: 'DELETE'
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      toast({
        title: "Symbol removed",
        description: "Symbol has been removed from your watchlist"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error removing symbol",
        description: error.message || "Failed to remove symbol from watchlist",
        variant: "destructive"
      });
    }
  });

  // Reorder watchlists mutation
  const reorderWatchlistsMutation = useMutation({
    mutationFn: async (orderedLists: { id: number, displayOrder: number }[]) => {
      const response = await apiRequest('/api/watchlists/reorder', {
        method: 'POST',
        data: { lists: orderedLists }
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error reordering watchlists",
        description: error.message || "Failed to reorder watchlists",
        variant: "destructive"
      });
    }
  });

  // Reorder watchlist items mutation
  const reorderWatchlistItemsMutation = useMutation({
    mutationFn: async ({ 
      watchlistId, 
      orderedItems 
    }: { 
      watchlistId: number, 
      orderedItems: { id: number, displayOrder: number }[] 
    }) => {
      const response = await apiRequest(`/api/watchlists/${watchlistId}/reorder`, {
        method: 'POST',
        data: { items: orderedItems }
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error reordering watchlist items",
        description: error.message || "Failed to reorder watchlist items",
        variant: "destructive"
      });
    }
  });

  // Create a watchlist
  const createWatchlist = async (name: string) => {
    return createWatchlistMutation.mutateAsync(name);
  };

  // Update a watchlist
  const updateWatchlist = async (id: number, data: Partial<Watchlist>) => {
    return updateWatchlistMutation.mutateAsync({ id, data });
  };

  // Delete a watchlist
  const deleteWatchlist = async (id: number) => {
    return deleteWatchlistMutation.mutateAsync(id);
  };

  // Add item to watchlist
  const addToWatchlist = async (
    watchlistId: number, 
    item: {
      symbol: string;
      name: string;
      exchange: string;
      type: string;
      displayOrder?: number;
    }
  ) => {
    return addToWatchlistMutation.mutateAsync({ watchlistId, item });
  };

  // Remove item from watchlist
  const removeFromWatchlist = async (watchlistId: number, itemId: number) => {
    return removeFromWatchlistMutation.mutateAsync({ watchlistId, itemId });
  };

  // Reorder watchlists
  const reorderWatchlists = async (orderedLists: { id: number, displayOrder: number }[]) => {
    return reorderWatchlistsMutation.mutateAsync(orderedLists);
  };

  // Reorder watchlist items
  const reorderWatchlistItems = async (
    watchlistId: number, 
    orderedItems: { id: number, displayOrder: number }[]
  ) => {
    return reorderWatchlistItemsMutation.mutateAsync({ watchlistId, orderedItems });
  };

  // Default watchlist mutation
  const createDefaultWatchlistMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/watchlists/default', {
        method: 'GET'
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      setCurrentWatchlist(data);
    },
    onError: (error: any) => {
      toast({
        title: "Error creating default watchlist",
        description: error.message || "Failed to create default watchlist",
        variant: "destructive"
      });
    }
  });

  // Create default watchlist
  const createDefaultWatchlist = async () => {
    return createDefaultWatchlistMutation.mutateAsync();
  };

  const value = {
    watchlists,
    currentWatchlist,
    isLoading,
    error,
    setCurrentWatchlist,
    createWatchlist,
    updateWatchlist,
    deleteWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    reorderWatchlists,
    reorderWatchlistItems,
    createDefaultWatchlist,
  };

  return (
    <WatchlistContext.Provider value={value}>
      {children}
    </WatchlistContext.Provider>
  );
};

// Custom hook to use the watchlist context
export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (context === undefined) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return context;
};