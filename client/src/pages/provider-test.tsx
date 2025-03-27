import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function ProviderTest() {
  const [symbol, setSymbol] = useState('AAPL');
  const [provider, setProvider] = useState('alphavantage');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

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

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Market Data Provider Test</h1>
      
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
            <pre className="bg-red-50 p-4 rounded">{error}</pre>
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