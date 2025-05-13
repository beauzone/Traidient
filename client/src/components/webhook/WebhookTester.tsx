import { useState, useEffect } from "react";
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
import { CheckCircle2, AlertCircle, Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import crypto from 'crypto';

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
  const [signatureSecret, setSignatureSecret] = useState<string>("");
  const [testResponse, setTestResponse] = useState<WebhookTestResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [webhookDetails, setWebhookDetails] = useState<any>(null);
  const [useSignature, setUseSignature] = useState<boolean>(false);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [bypassIpCheck, setBypassIpCheck] = useState<boolean>(true);
  
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

  // When selected webhook changes, update webhook details
  useEffect(() => {
    if (selectedWebhook) {
      const webhook = webhooks.find(w => w.id.toString() === selectedWebhook);
      if (webhook) {
        setWebhookDetails(webhook);
        // Check if webhook uses signature
        const usesSignature = webhook.configuration?.securitySettings?.useSignature || false;
        setUseSignature(usesSignature);
        
        // If webhook has a signature secret, set it as default
        if (usesSignature && webhook.configuration?.securitySettings?.signatureSecret) {
          setSignatureSecret(webhook.configuration.securitySettings.signatureSecret);
        } else {
          setSignatureSecret("");
        }
      }
    } else {
      setWebhookDetails(null);
      setUseSignature(false);
      setSignatureSecret("");
    }
  }, [selectedWebhook, webhooks]);

  // Function to mimic the server's signature generation
  // The server uses: crypto.createHmac('sha256', secret).update(payload).digest('hex')
  const generateSignature = async (payload: any, secret: string): Promise<string> => {
    try {
      // Convert the payload to stringified JSON (exactly as the server does)
      const stringifiedPayload = JSON.stringify(payload);
      console.log("Payload being signed:", stringifiedPayload);
      
      // WebCrypto API implementation of HMAC SHA-256
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const messageData = encoder.encode(stringifiedPayload);
      
      // Import the secret as a crypto key
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      // Generate the signature
      const signature = await window.crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        messageData
      );
      
      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(signature));
      const hexSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      console.log("Generated WebCrypto signature:", hexSignature);
      return hexSignature;
    } catch (error) {
      console.error('Error generating signature:', error);
      return '';
    }
  };

  const resetForm = () => {
    setTestResponse(null);
    setTicker("");
    setPrice("");
    setQuantity("100");
    setAction("BUY");
    // Don't reset signature secret or useSignature since they depend on webhook config
  };

  // Debug test to diagnose signature issues
  const handleDebugTest = async () => {
    if (!selectedWebhook) {
      toast({
        title: "Please select a webhook",
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

      // First, fetch the latest webhook details to see its logs
      const webhookDetailsResponse = await axios.get(
        `/api/webhooks/${webhook.id}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      // Get webhook configuration
      const webhookConfig = webhookDetailsResponse.data;
      console.log("Current webhook config:", webhookConfig);

      setTestResponse({
        success: true,
        message: "Debug information retrieved",
        result: {
          webhook: webhookConfig,
          signatureConfig: webhookConfig.configuration?.securitySettings || "No security settings found",
          logs: webhookConfig.logs || []
        }
      });

      toast({
        title: "Debug Information Retrieved",
        description: "Check the logs below for more details about this webhook's configuration",
      });

    } catch (error: any) {
      console.error("Debug test error:", error);
      setTestResponse({
        success: false,
        message: "Debug test failed",
        error: error.response?.data?.error || error.response?.data?.message || error.message
      });

      toast({
        title: "Debug Test Failed",
        description: error.response?.data?.error || error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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

    if (useSignature && !signatureSecret) {
      toast({
        title: "Signature secret required",
        description: "This webhook requires a signature. Please enter the signature secret.",
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

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Add signature if needed
      if (useSignature && signatureSecret) {
        // Generate the signature
        const signature = await generateSignature(payload, signatureSecret);
        
        // Try multiple header formats since we're not sure which one the server expects
        headers['x-signature'] = signature;
        headers['X-Signature'] = signature;
        headers['signature'] = signature;
        
        // Also log what we're sending
        console.log("Sending webhook with payload:", payload);
        console.log("Signature:", signature);
        console.log("Headers:", headers);
      }
      
      // Add IP whitelist bypass header for testing
      if (bypassIpCheck) {
        headers['x-bypass-ip-check'] = 'true';
        headers['X-Bypass-IP-Check'] = 'true';
        console.log("Adding IP whitelist bypass header");
      }

      // Make direct API call to the webhook endpoint
      const response = await axios.post(
        `/api/webhook-triggers/${webhook.token}`,
        payload,
        { headers }
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

        {webhookDetails && (
          <div className="space-y-4 pt-2 border-t">
            <h3 className="text-sm font-medium flex items-center mt-4">
              <Lock className="h-4 w-4 mr-2" />
              Security Settings
            </h3>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="use-signature">Signature Verification</Label>
                <p className="text-xs text-muted-foreground">
                  {useSignature ? "This webhook requires a signature" : "Signature verification is disabled"}
                </p>
              </div>
              <Switch
                id="use-signature"
                checked={useSignature}
                onCheckedChange={setUseSignature}
                disabled={webhookDetails?.configuration?.securitySettings?.useSignature}
              />

            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t">
              <div className="space-y-0.5">
                <Label htmlFor="debug-mode">Debug Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Show detailed configuration and logs
                </p>
              </div>
              <Switch
                id="debug-mode"
                checked={debugMode}
                onCheckedChange={setDebugMode}
              />
            </div>
            
            <div className="flex items-center justify-between mt-2 pt-2 border-t">
              <div className="space-y-0.5">
                <Label htmlFor="bypass-ip-check">Bypass IP Whitelist</Label>
                <p className="text-xs text-muted-foreground">
                  Testing only: Allow requests from any IP address
                </p>
              </div>
              <Switch
                id="bypass-ip-check"
                checked={bypassIpCheck}
                onCheckedChange={setBypassIpCheck}
              />
            </div>
            
            {useSignature && (
              <div className="space-y-2">
                <Label htmlFor="signature-secret">Signature Secret</Label>
                <Input
                  id="signature-secret"
                  type="password"
                  placeholder="Enter webhook signature secret"
                  value={signatureSecret}
                  onChange={(e) => setSignatureSecret(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This secret is used to generate a valid HMAC signature that matches the webhook configuration
                </p>
              </div>
            )}
          </div>
        )}

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
        <div className="flex gap-2">
          {debugMode && (
            <Button 
              variant="secondary" 
              onClick={handleDebugTest} 
              disabled={isLoading || !selectedWebhook}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>Debug Config</>
              )}
            </Button>
          )}
          <Button 
            onClick={handleTest} 
            disabled={isLoading || !selectedWebhook || (!debugMode && !ticker)}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>Test Webhook</>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}