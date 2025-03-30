import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ExternalLink, Check, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * SnapTradeConnector component for connecting to SnapTrade
 * Allows users to connect to multiple brokerages through SnapTrade
 */
export function SnaptradeConnector() {
  const [isConnecting, setIsConnecting] = useState(false);
  const queryClient = useQueryClient();

  // Query to check if SnapTrade is configured
  const { data: configStatus, isLoading: isStatusLoading } = useQuery({
    queryKey: ['/api/snaptrade/status'],
    retry: false,
  });

  // Check if configStatus is a valid object with configured property
  const isConfigured = configStatus && typeof configStatus === 'object' && 'configured' in configStatus ? 
    configStatus.configured : false;

  // Query to get existing connections
  const { 
    data: connectionData, 
    isLoading: isConnectionsLoading,
    refetch: refetchConnections
  } = useQuery({
    queryKey: ['/api/snaptrade/connections'],
    retry: false,
    enabled: !!isConfigured,
  });
    
  // Function to check if connections exist and how many
  const hasConnections = () => {
    return connectionData && 
           typeof connectionData === 'object' && 
           'connections' in connectionData && 
           Array.isArray(connectionData.connections) && 
           connectionData.connections.length > 0;
  };
  
  // Safe getter for connections array
  const getConnections = () => {
    if (hasConnections()) {
      return (connectionData as any).connections;
    }
    return [];
  };

  // Mutation for connecting to SnapTrade
  const connectMutation = useMutation({
    mutationFn: async () => {
      setIsConnecting(true);
      const response = await apiRequest('/api/snaptrade/connect', 
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
      return response;
    },
    onSuccess: (data) => {
      // Redirect to the SnapTrade portal URL
      if (data?.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        toast({
          title: "Connection Error",
          description: "Failed to get connection URL from SnapTrade",
          variant: "destructive",
        });
        setIsConnecting(false);
      }
    },
    onError: (error) => {
      console.error("Error connecting to SnapTrade:", error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to SnapTrade. Please try again.",
        variant: "destructive",
      });
      setIsConnecting(false);
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

  // Handle URL parameters if this component is rendered in the callback page
  useEffect(() => {
    const url = new URL(window.location.href);
    
    // Check if this is a callback from SnapTrade
    if (url.pathname === '/settings/connections/callback') {
      const code = url.searchParams.get('code');
      const brokerage = url.searchParams.get('brokerage');
      
      if (code) {
        // Send the code to our backend to complete the connection
        const completeConnection = async () => {
          try {
            await apiRequest('/api/snaptrade/callback', 
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                }
              },
              {
                code,
                brokerage,
              }
            );
            
            toast({
              title: "Success",
              description: "Connected to SnapTrade successfully",
            });
            
            // Remove the parameters from the URL
            window.history.replaceState({}, document.title, '/settings');
            
            // Refresh the connections list
            refetchConnections();
            queryClient.invalidateQueries({ queryKey: ['/api/snaptrade/connections'] });
          } catch (error) {
            console.error("Error completing SnapTrade connection:", error);
            toast({
              title: "Connection Error",
              description: "Failed to complete SnapTrade connection. Please try again.",
              variant: "destructive",
            });
          }
        };
        
        completeConnection();
      }
    }
  }, [queryClient, refetchConnections]);

  // Connect to SnapTrade
  const handleConnect = () => {
    connectMutation.mutate();
  };

  // Disconnect from SnapTrade
  const handleDisconnect = (connectionId: string) => {
    disconnectMutation.mutate(connectionId);
  };

  // If SnapTrade is not configured, show a message
  if (!isStatusLoading && !isConfigured) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <img 
              src="https://snaptrade.com/wp-content/uploads/2022/05/Logo-ST-Partial.svg" 
              alt="SnapTrade" 
              className="h-6 mr-2" 
            />
            SnapTrade
            <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800">
              Not Configured
            </Badge>
          </CardTitle>
          <CardDescription>Connect to multiple brokerages via SnapTrade</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center p-4 mb-4 text-yellow-800 border border-yellow-300 rounded-lg bg-yellow-50">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>
              SnapTrade API is not configured. Please contact the administrator to set up SnapTrade integration.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <img 
            src="https://snaptrade.com/wp-content/uploads/2022/05/Logo-ST-Partial.svg" 
            alt="SnapTrade" 
            className="h-6 mr-2" 
          />
          SnapTrade
          {hasConnections() && (
            <Badge variant="outline" className="ml-2 bg-green-100 text-green-800">
              Connected
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Connect to multiple brokerages through a single integration</CardDescription>
      </CardHeader>
      <CardContent>
        {isConnectionsLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : hasConnections() ? (
          <div className="space-y-4">
            <div className="text-sm">
              Connected brokerages:
            </div>
            {getConnections().map((connection: any) => (
              <div 
                key={connection.id} 
                className="flex items-center justify-between p-3 border rounded-md bg-muted/20"
              >
                <div className="flex items-center">
                  <Check className="h-5 w-5 mr-2 text-green-500" />
                  <div>
                    <div className="font-medium">{connection.brokerage?.name || "Brokerage"}</div>
                    <div className="text-xs text-muted-foreground">
                      Connected {new Date(connection.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleDisconnect(connection.id)}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? 
                    <Loader2 className="h-4 w-4 animate-spin mr-1" /> : 
                    'Disconnect'
                  }
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="mb-4 text-muted-foreground">
              No brokerages connected. Connect to brokerages like Interactive Brokers, 
              Questrade, TD Ameritrade and more through SnapTrade.
            </p>
            <div className="flex justify-center">
              <img 
                src="https://snaptrade.com/wp-content/uploads/2022/07/Partners-logos.png" 
                alt="Supported brokerages" 
                className="max-w-full h-auto opacity-60 max-h-16" 
              />
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline"
          onClick={() => refetchConnections()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button 
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Connecting...
            </>
          ) : (
            <>
              <ExternalLink className="h-4 w-4 mr-2" />
              {hasConnections()
                ? "Connect Another Brokerage" 
                : "Connect to SnapTrade"
              }
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}