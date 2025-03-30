import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ExternalLink, Check, AlertCircle } from "lucide-react";
import { useSnapTrade } from "@/hooks/useSnapTrade";
import { useQueryClient } from "@tanstack/react-query";

/**
 * SnapTradeConnector component for connecting to SnapTrade
 * Allows users to connect to multiple brokerages through SnapTrade
 */
export function SnaptradeConnector() {
  const queryClient = useQueryClient();
  const [logoError, setLogoError] = useState(false);
  const [partnersError, setPartnersError] = useState(false);
  
  const {
    // Status
    isConfigured,
    isStatusLoading,
    
    // Brokerages
    brokerages,
    isBrokeragesLoading,
    
    // Connections
    connections,
    hasConnections,
    isConnectionsLoading,
    refetchConnections,
    
    // Mutations
    connect,
    isConnecting,
    disconnect,
    isDisconnecting,
    handleCallback
  } = useSnapTrade();

  // Handle URL parameters if this component is rendered in the callback page
  useEffect(() => {
    const url = new URL(window.location.href);
    
    // Check if this is a callback from SnapTrade
    if (url.pathname === '/settings/connections/callback') {
      const code = url.searchParams.get('code');
      const brokerage = url.searchParams.get('brokerage');
      
      if (code) {
        // Send the code to our backend to complete the connection
        handleCallback({ code, brokerage: brokerage || undefined });
        
        // Remove the parameters from the URL
        window.history.replaceState({}, document.title, '/settings');
      }
    }
  }, [handleCallback]);

  // If SnapTrade is not configured, show a message
  if (!isStatusLoading && !isConfigured) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <img 
              src={logoError ? "/images/snaptrade/fallback-logo.svg" : "/images/snaptrade/logo.svg"} 
              alt="SnapTrade" 
              className="h-6 mr-2" 
              onError={() => setLogoError(true)}
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
            src={logoError ? "/images/snaptrade/fallback-logo.svg" : "/images/snaptrade/logo.svg"} 
            alt="SnapTrade" 
            className="h-6 mr-2" 
            onError={() => setLogoError(true)}
          />
          SnapTrade
          {hasConnections && (
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
        ) : hasConnections ? (
          <div className="space-y-4">
            <div className="text-sm">
              Connected brokerages:
            </div>
            {Array.isArray(connections) && connections.map((connection: any) => (
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
                  onClick={() => disconnect(connection.id)}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? 
                    <Loader2 className="h-4 w-4 animate-spin mr-1" /> : 
                    'Disconnect'
                  }
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center">
            {!isBrokeragesLoading && Array.isArray(brokerages) && brokerages.length > 0 ? (
              <div>
                <p className="mb-4 text-muted-foreground">
                  No brokerages connected. Connect to any of the {brokerages.length} supported brokerages.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                  {Array.isArray(brokerages) && brokerages.slice(0, 6).map((brokerage: any, index: number) => (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className="py-1 px-2 bg-muted/20"
                    >
                      {brokerage.name}
                    </Badge>
                  ))}
                  {Array.isArray(brokerages) && brokerages.length > 6 && (
                    <Badge variant="outline" className="py-1 px-2 bg-muted/20">
                      +{brokerages.length - 6} more
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <p className="mb-4 text-muted-foreground">
                No brokerages connected. Connect to brokerages like Interactive Brokers, 
                Questrade, TD Ameritrade and more through SnapTrade.
              </p>
            )}
            
            <div className="flex justify-center">
              <img 
                src={partnersError ? "/images/snaptrade/fallback-partners.svg" : "/images/snaptrade/partner-logos.png"} 
                alt="Supported brokerages" 
                className="max-w-full h-auto opacity-60 max-h-16" 
                onError={() => setPartnersError(true)}
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
          onClick={() => connect()}
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
              {hasConnections
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