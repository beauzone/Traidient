import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle } from "lucide-react";

type OrderAction = "BUY" | "SELL" | "SHORT" | "COVER";

interface WebhookTestResponse {
  success: boolean;
  message: string;
  result?: any;
  error?: string;
}

export function WebhookTester() {
  const [selectedWebhook, setSelectedWebhook] = useState<string>("");
  const [ticker, setTicker] = useState<string>("");
  const [action, setAction] = useState<OrderAction>("BUY");
  const [quantity, setQuantity] = useState<string>("100");
  const [price, setPrice] = useState<string>("");
  const [testResponse, setTestResponse] = useState<WebhookTestResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Fetch webhooks
  const { data: webhooks = [], isLoading: isLoadingWebhooks } = useQuery<any[]>({
    queryKey: ["/api/webhooks"],
    staleTime: 60000
  });

  // Map between UI action choices and payload actions
  const actionMapping: Record<OrderAction, string> = {
    "BUY": "BUY",
    "SELL": "SELL",
    "SHORT": "SELL", // SHORT is a SELL with no existing position
    "COVER": "BUY"   // COVER is a BUY to close a short position
  };

  const resetForm = () => {
    setTestResponse(null);
    setTicker("");
    setPrice("");
    setQuantity("100");
    setAction("BUY");
  };

  const handleTest = async () => {
    if (!selectedWebhook) {
      toast({
        title: "Please select a webhook",
        variant: "destructive"
      });
      return;
    }

    if (!ticker) {
      toast({
        title: "Please enter a ticker symbol",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setTestResponse(null);

    try {
      // Find the selected webhook to get its token
      const webhook = webhooks.find(w => w.id.toString() === selectedWebhook);
      
      if (!webhook) {
        throw new Error("Selected webhook not found");
      }

      // Prepare the payload based on TradingView format
      const payload = {
        action: actionMapping[action],
        ticker: ticker.toUpperCase(),
        quantity: parseInt(quantity, 10) || 100,
        entry_price: price ? parseFloat(price) : undefined
      };

      // Make direct API call to the webhook endpoint
      const response = await axios.post(
        `/api/webhook-triggers/${webhook.token}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      setTestResponse({
        success: true,
        message: "Webhook test completed successfully",
        result: response.data
      });

      toast({
        title: "Webhook Test Successful",
        description: "The webhook was triggered successfully",
      });

    } catch (error: any) {
      console.error("Webhook test error:", error);
      setTestResponse({
        success: false,
        message: "Webhook test failed",
        error: error.response?.data?.error || error.response?.data?.message || error.message
      });

      toast({
        title: "Webhook Test Failed",
        description: error.response?.data?.error || error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Webhook Tester</CardTitle>
        <CardDescription>
          Test your webhook configurations by simulating trading signals directly within the app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="webhook-select">Select Webhook</Label>
          <Select value={selectedWebhook} onValueChange={setSelectedWebhook}>
            <SelectTrigger id="webhook-select">
              <SelectValue placeholder="Select a webhook" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingWebhooks ? (
                <div className="flex items-center justify-center p-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : webhooks.length > 0 ? (
                webhooks.map((webhook) => (
                  <SelectItem key={webhook.id} value={webhook.id.toString()}>
                    {webhook.name}
                  </SelectItem>
                ))
              ) : (
                <div className="p-2 text-sm text-muted-foreground">
                  No webhooks found
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ticker-input">Ticker Symbol</Label>
          <Input
            id="ticker-input"
            placeholder="e.g., AAPL"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="action-select">Action</Label>
            <Select value={action} onValueChange={(value) => setAction(value as OrderAction)}>
              <SelectTrigger id="action-select">
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BUY">BUY</SelectItem>
                <SelectItem value="SELL">SELL</SelectItem>
                <SelectItem value="SHORT">SHORT</SelectItem>
                <SelectItem value="COVER">COVER</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity-input">Quantity</Label>
            <Input
              id="quantity-input"
              type="number"
              placeholder="100"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="price-input">
            Limit Price (Optional)
          </Label>
          <Input
            id="price-input"
            type="text"
            placeholder="Leave empty for market orders"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Enter a price to create a limit order instead of a market order
          </p>
        </div>

        {testResponse && (
          <Alert variant={testResponse.success ? "default" : "destructive"}>
            {testResponse.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {testResponse.success ? "Success" : "Error"}
            </AlertTitle>
            <AlertDescription>
              {testResponse.message}
              {testResponse.error && (
                <div className="mt-2 text-sm font-mono bg-secondary p-2 rounded">
                  {testResponse.error}
                </div>
              )}
              {testResponse.result && (
                <div className="mt-2">
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">View details</summary>
                    <pre className="mt-2 text-xs font-mono bg-secondary p-2 rounded overflow-auto max-h-[200px]">
                      {JSON.stringify(testResponse.result, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={resetForm} disabled={isLoading}>
          Reset
        </Button>
        <Button onClick={handleTest} disabled={isLoading || !selectedWebhook || !ticker}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>Test Webhook</>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}