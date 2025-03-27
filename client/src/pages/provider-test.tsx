import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle } from "lucide-react";

export default function ProviderTest() {
  const [symbol, setSymbol] = useState('AAPL');
  const [provider, setProvider] = useState('alphavantage');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    // Fetch available integrations when component mounts
    const fetchIntegrations = async () => {
      try {
        const response = await apiRequest('GET', '/api/integrations');
        setIntegrations(response || []);
      } catch (err) {
        console.error('Failed to fetch integrations:', err);
      } finally {
        setIntegrationsLoading(false);
      }
    };
    
    fetchIntegrations();
  }, []);

  const testProvider = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Make sure the provider name is exactly as it appears in the database
      const providerParam = provider === 'polygon' ? 'Polygon.io ' : 
                            provider === 'alphavantage' ? 'AlphaVantage' : 
                            provider === 'tiingo' ? 'Tiingo' : provider;
      
      const response = await apiRequest(
        'GET', 
        `/api/market-data/quote/${symbol}?provider=${providerParam}`
      );

      setResult(response);
      toast({
        title: 'Success',
        description: `Got quote from ${providerParam}`,
        variant: 'default',
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch quote',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if a provider is configured
  const isProviderConfigured = (providerName: string) => {
    // Normalize the provider name to match how it's stored in the database
    let dbProviderName = '';
    
    if (providerName === 'alphavantage') dbProviderName = 'AlphaVantage';
    else if (providerName === 'polygon') dbProviderName = 'Polygon.io '; // Note the trailing space
    else if (providerName === 'tiingo') dbProviderName = 'Tiingo';
    else if (providerName === 'alpaca') dbProviderName = 'Alpaca';
    else if (providerName === 'yahoo') return true; // Yahoo always works without API key
    
    return integrations.some(integration => 
      integration.provider.toLowerCase() === dbProviderName.toLowerCase());
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Market Data Provider Test</h1>
      
      {!integrationsLoading && (
        <Card className="w-full max-w-2xl mx-auto mb-6">
          <CardHeader>
            <CardTitle>Provider Status</CardTitle>
            <CardDescription>
              Shows which providers you have configured with API keys
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2 rounded border">
                <div>
                  {isProviderConfigured('alphavantage') ? 
                    <CheckCircle2 className="h-5 w-5 text-green-500" /> : 
                    <XCircle className="h-5 w-5 text-red-500" />
                  }
                </div>
                <div>AlphaVantage</div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded border">
                <div>
                  {isProviderConfigured('polygon') ? 
                    <CheckCircle2 className="h-5 w-5 text-green-500" /> : 
                    <XCircle className="h-5 w-5 text-red-500" />
                  }
                </div>
                <div>Polygon.io</div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded border">
                <div>
                  {isProviderConfigured('tiingo') ? 
                    <CheckCircle2 className="h-5 w-5 text-green-500" /> : 
                    <XCircle className="h-5 w-5 text-red-500" />
                  }
                </div>
                <div>Tiingo</div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded border">
                <div>
                  {isProviderConfigured('alpaca') ? 
                    <CheckCircle2 className="h-5 w-5 text-green-500" /> : 
                    <XCircle className="h-5 w-5 text-red-500" />
                  }
                </div>
                <div>Alpaca</div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded border">
                <div>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>Yahoo Finance (No API key needed)</div>
              </div>
            </div>
            
            <div className="mt-4">
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/integrations'}
              >
                Manage API Integrations
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Test Market Data Providers</CardTitle>
          <CardDescription>
            Select a provider and symbol to test the quote endpoint
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alphavantage">AlphaVantage</SelectItem>
                <SelectItem value="polygon">Polygon.io</SelectItem>
                <SelectItem value="tiingo">Tiingo</SelectItem>
                <SelectItem value="yahoo">Yahoo Finance</SelectItem>
                <SelectItem value="alpaca">Alpaca</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="symbol">Symbol</Label>
            <Input
              id="symbol"
              placeholder="Enter stock symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button onClick={testProvider} disabled={loading}>
            {loading ? 'Loading...' : 'Test Provider'}
          </Button>
        </CardFooter>
      </Card>

      {error && (
        <Card className="w-full max-w-2xl mx-auto mt-6 border-red-500">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-red-50 p-4 rounded overflow-auto">{error}</pre>
            
            {error.includes("Invalid or unconfigured data provider") && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                <h3 className="text-sm font-medium text-yellow-800">Missing API credentials</h3>
                <p className="mt-2 text-sm text-yellow-700">
                  You need to configure API credentials for this provider in the Integrations page.
                </p>
                <Button 
                  className="mt-3" 
                  variant="outline"
                  onClick={() => window.location.href = '/integrations'}
                >
                  Go to Integrations
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="w-full max-w-2xl mx-auto mt-6">
          <CardHeader>
            <CardTitle>Result from {provider}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 dark:bg-gray-900 text-black dark:text-white p-4 rounded overflow-auto max-h-80 border border-gray-200 dark:border-gray-700">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}