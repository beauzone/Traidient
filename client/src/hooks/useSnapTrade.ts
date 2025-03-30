import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

/**
 * Custom hook for SnapTrade API interactions
 * Provides methods for checking status, fetching brokerages, and more
 */
export function useSnapTrade() {
  const queryClient = useQueryClient();

  // Query to check if SnapTrade is configured
  const { 
    data: configStatus, 
    isLoading: isStatusLoading,
    error: statusError
  } = useQuery({
    queryKey: ['/api/snaptrade/status'],
    retry: false,
  });

  // Check if configStatus is a valid object with configured property
  const isConfigured = configStatus && typeof configStatus === 'object' && 'configured' in configStatus ? 
    configStatus.configured : false;

  // Query to get all available brokerages (non-authenticated)
  const {
    data: brokerage,
    isLoading: isBrokeragesLoading,
    error: brokeragesError,
    refetch: refetchBrokerages
  } = useQuery({
    queryKey: ['/api/snaptrade/brokerages'],
    retry: false,
    enabled: !!isConfigured,
  });

  // Safely get the brokerages array
  const getBrokerages = () => {
    if (brokerage && typeof brokerage === 'object' && 'brokerages' in brokerage) {
      return brokerage.brokerages;
    }
    return [];
  };

  // Query to get existing connections
  const { 
    data: connectionData, 
    isLoading: isConnectionsLoading,
    error: connectionsError,
    refetch: refetchConnections
  } = useQuery({
    queryKey: ['/api/snaptrade/connections'],
    retry: false,
    enabled: !!isConfigured,
  });
    
  // Safely check if connections exist
  const hasConnections = () => {
    return connectionData && 
           typeof connectionData === 'object' && 
           'connections' in connectionData && 
           Array.isArray(connectionData.connections) && 
           connectionData.connections.length > 0;
  };
  
  // Safely get connections array
  const getConnections = () => {
    if (hasConnections()) {
      return (connectionData as any).connections;
    }
    return [];
  };

  // Mutation for connecting to SnapTrade
  const connectMutation = useMutation({
    mutationFn: async () => {
      console.log('Making API request to /api/snaptrade/connect...');
      return await apiRequest('/api/snaptrade/connect', 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        }, 
        {
          redirectUri: `${window.location.origin}/settings/connections/callback`,
        }
      );
    },
    onSuccess: (data) => {
      console.log('Connect mutation succeeded with data:', data);
      // Redirect to the SnapTrade portal URL
      if (data && data.redirectUrl) {
        console.log('Redirecting to:', data.redirectUrl);
        window.location.href = data.redirectUrl;
      } else {
        console.error('Missing redirectUrl in response data:', data);
        toast({
          title: "Connection Error",
          description: "Failed to get connection URL from SnapTrade",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error("Error connecting to SnapTrade:", error);
      let errorDescription = "Failed to connect to SnapTrade.";
      
      // Try to extract more specific error information
      if (error && typeof error === 'object') {
        if (error.message) {
          errorDescription += ` ${error.message}`;
        }
        
        // Check for nested error details
        if (error.response?.data?.error) {
          errorDescription += ` Server says: ${error.response.data.error}`;
        }
      }
      
      toast({
        title: "Connection Error",
        description: errorDescription,
        variant: "destructive",
      });
    }
  });

  // Mutation for disconnecting from SnapTrade
  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return await apiRequest(`/api/snaptrade/connections/${connectionId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Disconnected from SnapTrade successfully",
      });
      // Refresh the connections list
      refetchConnections();
      queryClient.invalidateQueries({ queryKey: ['/api/snaptrade/connections'] });
    },
    onError: (error) => {
      console.error("Error disconnecting from SnapTrade:", error);
      toast({
        title: "Disconnection Error",
        description: "Failed to disconnect from SnapTrade. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Mutation for handling SnapTrade callback
  const handleCallbackMutation = useMutation({
    mutationFn: async ({ code, brokerage }: { code: string; brokerage?: string }) => {
      return await apiRequest('/api/snaptrade/callback', 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        },
        { code, brokerage }
      );
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Connected to SnapTrade successfully",
      });
      
      // Refresh the connections list
      refetchConnections();
      queryClient.invalidateQueries({ queryKey: ['/api/snaptrade/connections'] });
    },
    onError: (error) => {
      console.error("Error completing SnapTrade connection:", error);
      toast({
        title: "Connection Error",
        description: "Failed to complete SnapTrade connection. Please try again.",
        variant: "destructive",
      });
    }
  });

  return {
    // Status
    isConfigured,
    isStatusLoading,
    statusError,
    
    // Brokerages
    brokerages: getBrokerages(),
    isBrokeragesLoading,
    brokeragesError,
    refetchBrokerages,
    
    // Connections
    connections: getConnections(),
    hasConnections: hasConnections(),
    isConnectionsLoading,
    connectionsError,
    refetchConnections,
    
    // Mutations
    connect: connectMutation.mutate,
    isConnecting: connectMutation.isPending,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
    handleCallback: handleCallbackMutation.mutate,
    isHandlingCallback: handleCallbackMutation.isPending,
  };
}