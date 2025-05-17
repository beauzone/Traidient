import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  AlertCircle,
  CheckCircle,
  ArrowDownUp,
  Activity,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Provider {
  name: string;
  isReady: boolean;
}

interface ProviderResponse {
  providers: Provider[];
}

interface LastProviderResponse {
  lastProvider: string;
  availableProviders: string[];
}

/**
 * Data provider selector component for screeners
 * Allows users to view and manage data provider preferences
 */
export function ProviderSelector() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [providerOrder, setProviderOrder] = useState<string[]>([]);

  // Fetch available providers and last used provider
  const { data, isLoading, error } = useQuery<LastProviderResponse>({
    queryKey: ['/api/screeners/last-provider'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch available providers
  const { data: providersData } = useQuery<ProviderResponse>({
    queryKey: ['/api/screeners/providers'],
  });

  // Set provider order mutation
  const setProviderOrderMutation = useMutation({
    mutationFn: async (newOrder: string[]) => {
      return await apiRequest('POST', '/api/screeners/provider-order', {
        providerOrder: newOrder,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Provider order updated',
        description: 'Your preferred data provider order has been saved.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/screeners/last-provider'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to update provider order',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/screeners/clear-cache', {});
    },
    onSuccess: () => {
      toast({
        title: 'Cache cleared',
        description: 'Market data cache has been cleared. Fresh data will be fetched on next request.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to clear cache',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Initialize state when data is loaded
  useEffect(() => {
    if (data) {
      setProviderOrder(data.availableProviders || []);
      
      if (data.lastProvider && data.lastProvider !== 'None') {
        setSelectedProvider(data.lastProvider);
      } else if (data.availableProviders && data.availableProviders.length > 0) {
        setSelectedProvider(data.availableProviders[0]);
      }
    }
  }, [data]);

  // Handle provider preference selection
  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
    
    // Move the selected provider to the front of the order list
    if (value && providerOrder.includes(value)) {
      const newOrder = [
        value,
        ...providerOrder.filter(p => p !== value)
      ];
      setProviderOrder(newOrder);
      setProviderOrderMutation.mutate(newOrder);
    }
  };

  // Handle clearing the cache
  const handleClearCache = () => {
    clearCacheMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Providers</CardTitle>
          <CardDescription>Loading provider information...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Providers</CardTitle>
          <CardDescription>Error loading provider information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load provider information</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const availableProviders = providersData?.providers || [];
  const lastUsedProvider = data?.lastProvider || 'None';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Providers</CardTitle>
        <CardDescription>
          Configure market data providers for stock screeners
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Current Status</p>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <span className="mr-2">Last used provider:</span>
            <Badge variant={lastUsedProvider === 'None' ? 'outline' : 'default'}>
              {lastUsedProvider}
            </Badge>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Available Providers</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {availableProviders.map((provider: Provider) => (
              <div 
                key={provider.name} 
                className="flex items-center gap-2 p-2 border rounded-md"
              >
                {provider.isReady ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                )}
                <span>{provider.name}</span>
                <Badge variant="outline" className="ml-auto">
                  {provider.isReady ? 'Ready' : 'Not Ready'}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Preferred Provider</p>
          <div className="flex items-center gap-2">
            <Select value={selectedProvider} onValueChange={handleProviderChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a preferred data provider" />
              </SelectTrigger>
              <SelectContent>
                {providerOrder.map(provider => (
                  <SelectItem key={provider} value={provider}>
                    {provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            The system will try providers in order, starting with your preferred provider
          </p>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Provider Order</p>
          <div className="flex items-center gap-2">
            <ArrowDownUp className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm">Current order:</span>
            <div className="flex-1 flex flex-wrap gap-2">
              {providerOrder.map((provider, index) => (
                <Badge key={provider} variant="secondary">
                  {index + 1}. {provider}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleClearCache}
          disabled={clearCacheMutation.isPending}
        >
          {clearCacheMutation.isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Clearing...
            </>
          ) : (
            'Clear Data Cache'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default ProviderSelector;