import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash, Copy, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/api";

// TradingView server IPs for whitelist
const TRADINGVIEW_IPS = ["52.89.214.238", "34.212.75.30", "54.218.53.128", "52.32.178.7"];
import { Heading } from "@/components/ui/heading";
import { useToast } from "@/hooks/use-toast";

// Schema for webhook form
const webhookFormSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters" }),
  description: z.string().optional(),
  action: z.enum(["trade", "cancel", "status"]),
  isActive: z.boolean().default(true),
  strategyId: z.number().optional(),
  configuration: z.object({
    integrationId: z.number().optional(),
    allowShortSelling: z.boolean().default(false),
    securitySettings: z.object({
      useSignature: z.boolean().default(false),
      signatureSecret: z.string().optional(),
      ipWhitelist: z.array(z.string()).optional()
    }),
    positionSizing: z.object({
      type: z.enum(["fixed", "percentage", "risk-based"]).default("fixed"),
      value: z.number().default(100)
    })
  })
});

type WebhookFormValues = z.infer<typeof webhookFormSchema>;

export function WebhookManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentWebhook, setCurrentWebhook] = useState<any>(null);
  const [tab, setTab] = useState("overview");
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [newIpAddress, setNewIpAddress] = useState("");
  
  // State to track whether TradingView IPs are added
  const [useTradingViewIps, setUseTradingViewIps] = useState(false);

  // Get webhooks
  const { data: webhooks = [], isLoading: isLoadingWebhooks } = useQuery<any[]>({
    queryKey: ["/api/webhooks"],
    staleTime: 60000
  });

  // Get strategies for linking
  const { data: strategies = [] } = useQuery<any[]>({
    queryKey: ["/api/strategies"],
    staleTime: 60000
  });

  // Get integrations for broker selection
  const { data: integrations = [] } = useQuery<any[]>({
    queryKey: ["/api/integrations"],
    staleTime: 60000
  });

  // Get webhook logs if a webhook is selected
  const { data: webhookLogs = [], isLoading: isLoadingLogs } = useQuery<any[]>({
    queryKey: ["/api/webhooks", currentWebhook?.id, "logs"],
    enabled: !!currentWebhook?.id,
    staleTime: 10000
  });

  // Create a new webhook
  const createWebhookMutation = useMutation({
    mutationFn: (webhook: WebhookFormValues) => apiRequest("/api/webhooks", { method: "POST" }, webhook),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({
        title: "Webhook created",
        description: "Your webhook has been created successfully.",
      });
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create webhook. Please try again.",
        variant: "destructive"
      });
      console.error("Error creating webhook:", error);
    }
  });

  // Update webhook
  const updateWebhookMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest(`/api/webhooks/${id}`, { method: "PUT" }, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({
        title: "Webhook updated",
        description: "Your webhook has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update webhook. Please try again.",
        variant: "destructive"
      });
      console.error("Error updating webhook:", error);
    }
  });

  // Delete webhook
  const deleteWebhookMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/webhooks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      setCurrentWebhook(null);
      toast({
        title: "Webhook deleted",
        description: "Your webhook has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete webhook. Please try again.",
        variant: "destructive"
      });
      console.error("Error deleting webhook:", error);
    }
  });

  // Form hook
  const form = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookFormSchema),
    defaultValues: {
      name: "",
      description: "",
      action: "trade",
      isActive: true,
      configuration: {
        allowShortSelling: false,
        securitySettings: {
          useSignature: false,
          signatureSecret: "",
          ipWhitelist: []
        },
        positionSizing: {
          type: "fixed",
          value: 100
        }
      }
    }
  });

  // Handle form submit
  const onSubmit = (values: WebhookFormValues) => {
    // If HMAC signature is enabled but no secret key is provided, generate one
    if (values.configuration.securitySettings.useSignature && 
        (!values.configuration.securitySettings.signatureSecret || 
         values.configuration.securitySettings.signatureSecret.trim() === '')) {
      
      // Generate a random secret key
      const randomKey = Array.from(
        crypto.getRandomValues(new Uint8Array(32))
      ).map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Update the values with the generated key
      values = {
        ...values,
        configuration: {
          ...values.configuration,
          securitySettings: {
            ...values.configuration.securitySettings,
            signatureSecret: randomKey
          }
        }
      };
      
      // Also update the form so it's reflected in the UI
      form.setValue("configuration.securitySettings.signatureSecret", randomKey);
      
      toast({
        title: "Secret key generated",
        description: "A secret key has been automatically generated for HMAC verification.",
      });
    }
    
    if (currentWebhook?.id) {
      updateWebhookMutation.mutate({ id: currentWebhook.id, data: values });
    } else {
      createWebhookMutation.mutate(values);
    }
  };

  // Edit webhook handler
  const handleEditWebhook = (webhook: any) => {
    setCurrentWebhook(webhook);
    form.reset({
      name: webhook.name,
      description: webhook.description || "",
      action: webhook.action,
      isActive: webhook.isActive,
      strategyId: webhook.strategyId,
      configuration: {
        integrationId: webhook.configuration?.integrationId,
        allowShortSelling: webhook.configuration?.allowShortSelling || false,
        securitySettings: {
          useSignature: webhook.configuration?.securitySettings?.useSignature || false,
          signatureSecret: webhook.configuration?.securitySettings?.signatureSecret || "",
          ipWhitelist: webhook.configuration?.securitySettings?.ipWhitelist || []
        },
        positionSizing: webhook.configuration?.positionSizing || {
          type: "fixed",
          value: 100
        }
      }
    });
    setTab("edit");
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setCurrentWebhook(null);
    form.reset();
    setTab("overview");
  };

  // New webhook button
  const handleNewWebhook = () => {
    setCurrentWebhook(null);
    form.reset();
    setTab("create");
  };

  // Toggle TradingView IPs
  const handleToggleTradingViewIps = (enabled: boolean) => {
    setUseTradingViewIps(enabled);
    
    const currentIps = form.getValues("configuration.securitySettings.ipWhitelist") || [];
    
    if (enabled) {
      // Add TradingView IPs if they're not already in the whitelist
      const newIps = [...currentIps];
      let changed = false;
      
      for (const ip of TRADINGVIEW_IPS) {
        if (!newIps.includes(ip)) {
          newIps.push(ip);
          changed = true;
        }
      }
      
      if (changed) {
        form.setValue("configuration.securitySettings.ipWhitelist", newIps);
        toast({
          title: "TradingView IPs Added",
          description: "TradingView IP addresses have been added to the whitelist.",
        });
      }
    } else {
      // Remove TradingView IPs from the whitelist
      const filteredIps = currentIps.filter(ip => !TRADINGVIEW_IPS.includes(ip));
      
      if (filteredIps.length !== currentIps.length) {
        form.setValue("configuration.securitySettings.ipWhitelist", filteredIps);
        toast({
          title: "TradingView IPs Removed",
          description: "TradingView IP addresses have been removed from the whitelist.",
        });
      }
    }
  };

  // Add IP to whitelist
  const handleAddIpToWhitelist = () => {
    if (!newIpAddress || !newIpAddress.trim()) return;
    
    const currentIps = form.getValues("configuration.securitySettings.ipWhitelist") || [];
    if (currentIps.includes(newIpAddress)) {
      toast({
        title: "Duplicate IP",
        description: "This IP address is already in the whitelist.",
        variant: "destructive"
      });
      return;
    }
    
    form.setValue("configuration.securitySettings.ipWhitelist", [...currentIps, newIpAddress]);
    setNewIpAddress("");
  };

  // Remove IP from whitelist
  const handleRemoveIpFromWhitelist = (ip: string) => {
    const currentIps = form.getValues("configuration.securitySettings.ipWhitelist") || [];
    form.setValue(
      "configuration.securitySettings.ipWhitelist",
      currentIps.filter(i => i !== ip)
    );
  };

  // Copy webhook URL
  const handleCopyWebhookUrl = (token: string) => {
    const baseUrl = window.location.origin;
    const webhookUrl = `${baseUrl}/api/webhook-triggers/${token}`;
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copied!",
      description: "Webhook URL copied to clipboard.",
    });
  };

  // Generate example curl command for webhook
  const getExampleCurlCommand = (webhook: any) => {
    const baseUrl = window.location.origin;
    const webhookUrl = `${baseUrl}/api/webhook-triggers/${webhook.token}`;
    let headers = "";
    
    if (webhook.configuration?.securitySettings?.useSignature) {
      headers += ' \\\n  -H "X-Signature: YOUR_HMAC_SHA256_SIGNATURE"';
    }
    
    let command = `curl -X POST ${webhookUrl}${headers} \\\n  -H "Content-Type: application/json" \\\n  -d '`;
    
    if (webhook.action === "trade") {
      command += JSON.stringify({
        action: "BUY",
        ticker: "AAPL",
        quantity: 100,
        stop_loss: 150.0,
        take_profit: 170.0
      }, null, 2);
    } else if (webhook.action === "cancel") {
      command += JSON.stringify({
        cancel_order: "order-123456"
      }, null, 2);
    } else if (webhook.action === "status") {
      command += JSON.stringify({
        order_id: "order-123456"
      }, null, 2);
    }
    
    command += "'";
    return command;
  };

  function getRelativeTime(dateString: string) {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds} seconds ago`;
    
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    
    const days = Math.round(hours / 24);
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
    
    const months = Math.round(days / 30);
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
    
    const years = Math.round(months / 12);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
        <Button onClick={handleNewWebhook}>New Webhook</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="edit" disabled={!currentWebhook}>Edit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoadingWebhooks ? (
              <div className="col-span-full flex justify-center">
                <p>Loading webhooks...</p>
              </div>
            ) : webhooks && webhooks.length > 0 ? (
              webhooks.map((webhook: any) => (
                <Card key={webhook.id} className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-lg font-medium truncate">
                        {webhook.name}
                      </CardTitle>
                      <CardDescription>
                        {webhook.action === "trade" && "Trading signals"}
                        {webhook.action === "cancel" && "Cancel orders"}
                        {webhook.action === "status" && "Order status checks"}
                      </CardDescription>
                    </div>
                    <Badge variant={webhook.isActive ? "default" : "outline"}>
                      {webhook.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="font-semibold">Token:</span>{" "}
                        <code className="bg-muted px-1 py-0.5 rounded text-xs">
                          {webhook.token.substring(0, 10)}...
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-1"
                          onClick={() => handleCopyWebhookUrl(webhook.token)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {webhook.strategyId && (
                        <div className="text-sm">
                          <span className="font-semibold">Strategy:</span>{" "}
                          {strategies?.find((s: any) => s.id === webhook.strategyId)?.name || "Unknown"}
                        </div>
                      )}
                      <div className="text-sm">
                        <span className="font-semibold">Calls:</span>{" "}
                        {webhook.callCount || 0}
                      </div>
                      {webhook.lastCalledAt && (
                        <div className="text-sm">
                          <span className="font-semibold">Last called:</span>{" "}
                          {getRelativeTime(webhook.lastCalledAt)}
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between pt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEditWebhook(webhook)}
                    >
                      View Details
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <div className="col-span-full">
                <Card>
                  <CardHeader>
                    <CardTitle>No webhooks found</CardTitle>
                    <CardDescription>
                      You haven't created any webhooks yet. Create one to get started.
                    </CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button onClick={() => setTab("create")}>Create Webhook</Button>
                  </CardFooter>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="create">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="My TradingView Strategy" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Details about this webhook and how it will be used" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="action"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Webhook Action</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select action type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="trade">Trade Execution</SelectItem>
                                <SelectItem value="cancel">Cancel Orders</SelectItem>
                                <SelectItem value="status">Order Status</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>
                            The type of action this webhook will trigger
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Active</FormLabel>
                            <FormDescription>
                              Enable or disable this webhook
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="strategyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link to Strategy (Optional)</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value?.toString()}
                              onValueChange={val => field.onChange(val ? parseInt(val) : undefined)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a strategy" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {strategies?.map((strategy: any) => (
                                  <SelectItem key={strategy.id} value={strategy.id.toString()}>
                                    {strategy.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>
                            Linking to a strategy will help with tracking
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Trading Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="configuration.integrationId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brokerage Account</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value?.toString()}
                              onValueChange={val => field.onChange(val ? parseInt(val) : undefined)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a brokerage account" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="default">Use Default</SelectItem>
                                {integrations?.filter((i: any) => i.type === 'exchange').map((integration: any) => (
                                  <SelectItem key={integration.id} value={integration.id.toString()}>
                                    {integration.description || integration.provider}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>
                            Choose a specific brokerage account or use the default
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="configuration.allowShortSelling"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Allow Short Selling</FormLabel>
                            <FormDescription>
                              Allow this webhook to execute short orders
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="configuration.positionSizing.type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Position Sizing</FormLabel>
                          <FormControl>
                            <ToggleGroup 
                              type="single" 
                              value={field.value}
                              onValueChange={(value) => {
                                if (value) field.onChange(value);
                              }}
                              className="justify-start"
                            >
                              <ToggleGroupItem value="fixed">Fixed</ToggleGroupItem>
                              <ToggleGroupItem value="percentage">Percentage</ToggleGroupItem>
                              <ToggleGroupItem value="risk-based">Risk-Based</ToggleGroupItem>
                            </ToggleGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="configuration.positionSizing.value"
                      render={({ field }) => {
                        const sizingType = form.watch("configuration.positionSizing.type");
                        return (
                          <FormItem>
                            <FormLabel>
                              {sizingType === "fixed" && "Number of Shares"}
                              {sizingType === "percentage" && "Percentage of Portfolio"}
                              {sizingType === "risk-based" && "Risk Percentage"}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                step={sizingType === "fixed" ? 1 : 0.1}
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              {sizingType === "fixed" && "Fixed number of shares to trade"}
                              {sizingType === "percentage" && "Percentage of portfolio to allocate (1-100)"}
                              {sizingType === "risk-based" && "Percentage of account to risk per trade (0.1-5)"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </CardContent>
                </Card>
                
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Security Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="configuration.securitySettings.useSignature"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Require HMAC Signature</FormLabel>
                            <FormDescription>
                              Require a valid HMAC-SHA256 signature with each webhook call
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                
                                // If user is enabling the signature verification and there's no key yet,
                                // generate a random secret key
                                if (checked && !form.getValues("configuration.securitySettings.signatureSecret")) {
                                  const randomKey = Array.from(
                                    crypto.getRandomValues(new Uint8Array(32))
                                  ).map(b => b.toString(16).padStart(2, '0')).join('');
                                  
                                  form.setValue("configuration.securitySettings.signatureSecret", randomKey);
                                  toast({
                                    title: "Secret key generated",
                                    description: "A secret key has been automatically generated for HMAC verification.",
                                  });
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {form.watch("configuration.securitySettings.useSignature") && (
                      <FormField
                        control={form.control}
                        name="configuration.securitySettings.signatureSecret"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Signature Secret Key</FormLabel>
                            <FormControl>
                              <div className="flex">
                                <Input
                                  type={showSecretKey ? "text" : "password"}
                                  placeholder="Secret key for HMAC signatures"
                                  {...field}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="ml-2"
                                  onClick={() => setShowSecretKey(!showSecretKey)}
                                >
                                  {showSecretKey ? "Hide" : "Show"}
                                </Button>
                              </div>
                            </FormControl>
                            <FormDescription>
                              This secret key will be used to verify the HMAC signature
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    
                    <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mb-4">
                      <div className="space-y-0.5">
                        <Label>Use TradingView IPs</Label>
                        <p className="text-sm text-muted-foreground">
                          Add TradingView's server IP addresses to the whitelist
                        </p>
                      </div>
                      <Switch
                        checked={useTradingViewIps}
                        onCheckedChange={handleToggleTradingViewIps}
                      />
                    </div>
                    
                    <div>
                      <Label>IP Whitelist (Optional)</Label>
                      <div className="mt-2 flex">
                        <Input
                          value={newIpAddress}
                          onChange={(e) => setNewIpAddress(e.target.value)}
                          placeholder="192.168.1.1"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="ml-2"
                          onClick={handleAddIpToWhitelist}
                        >
                          Add IP
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Only allow webhook calls from these IP addresses. Leave empty to allow all.
                      </p>
                      
                      <div className="mt-3 flex flex-wrap gap-2">
                        {form.watch("configuration.securitySettings.ipWhitelist")?.map((ip: string) => (
                          <Badge key={ip} variant="secondary" className="flex items-center gap-1">
                            {ip}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 p-0"
                              onClick={() => handleRemoveIpFromWhitelist(ip)}
                            >
                              <Trash className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {currentWebhook ? "Update Webhook" : "Create Webhook"}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>
        
        <TabsContent value="edit">
          {currentWebhook && (
            <Tabs defaultValue="details" className="mt-6">
              <TabsList className="mb-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="logs">Activity Logs</TabsTrigger>
                <TabsTrigger value="examples">Example Usage</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="My TradingView Strategy" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description (Optional)</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Details about this webhook and how it will be used" 
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="action"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Webhook Action</FormLabel>
                                <FormControl>
                                  <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select action type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="trade">Trade Execution</SelectItem>
                                      <SelectItem value="cancel">Cancel Orders</SelectItem>
                                      <SelectItem value="status">Order Status</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormDescription>
                                  The type of action this webhook will trigger
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                  <FormLabel>Active</FormLabel>
                                  <FormDescription>
                                    Enable or disable this webhook
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="strategyId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Link to Strategy (Optional)</FormLabel>
                                <FormControl>
                                  <Select
                                    value={field.value?.toString()}
                                    onValueChange={val => field.onChange(val ? parseInt(val) : undefined)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a strategy" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">None</SelectItem>
                                      {strategies?.map((strategy: any) => (
                                        <SelectItem key={strategy.id} value={strategy.id.toString()}>
                                          {strategy.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormDescription>
                                  Linking to a strategy will help with tracking
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="pt-2">
                            <Label>Webhook URL</Label>
                            <div className="mt-1 flex">
                              <Input
                                readOnly
                                value={`${window.location.origin}/api/webhook-triggers/${currentWebhook.token}`}
                                className="flex-1 font-mono text-xs"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="ml-2"
                                onClick={() => handleCopyWebhookUrl(currentWebhook.token)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Use this URL in your external platform's webhook settings
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <div className="space-y-6">
                        <Card>
                          <CardHeader>
                            <CardTitle>Trading Configuration</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="configuration.integrationId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Brokerage Account</FormLabel>
                                  <FormControl>
                                    <Select
                                      value={field.value?.toString()}
                                      onValueChange={val => field.onChange(val ? parseInt(val) : undefined)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select a brokerage account" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="default">Use Default</SelectItem>
                                        {integrations?.filter((i: any) => i.type === 'exchange').map((integration: any) => (
                                          <SelectItem key={integration.id} value={integration.id.toString()}>
                                            {integration.description || integration.provider}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormControl>
                                  <FormDescription>
                                    Choose a specific brokerage account or use the default
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="configuration.allowShortSelling"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                  <div className="space-y-0.5">
                                    <FormLabel>Allow Short Selling</FormLabel>
                                    <FormDescription>
                                      Allow this webhook to execute short orders
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="configuration.positionSizing.type"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Position Sizing</FormLabel>
                                  <FormControl>
                                    <ToggleGroup 
                                      type="single" 
                                      value={field.value}
                                      onValueChange={(value) => {
                                        if (value) field.onChange(value);
                                      }}
                                      className="justify-start"
                                    >
                                      <ToggleGroupItem value="fixed">Fixed</ToggleGroupItem>
                                      <ToggleGroupItem value="percentage">Percentage</ToggleGroupItem>
                                      <ToggleGroupItem value="risk-based">Risk-Based</ToggleGroupItem>
                                    </ToggleGroup>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="configuration.positionSizing.value"
                              render={({ field }) => {
                                const sizingType = form.watch("configuration.positionSizing.type");
                                return (
                                  <FormItem>
                                    <FormLabel>
                                      {sizingType === "fixed" && "Number of Shares"}
                                      {sizingType === "percentage" && "Percentage of Portfolio"}
                                      {sizingType === "risk-based" && "Risk Percentage"}
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min={0}
                                        step={sizingType === "fixed" ? 1 : 0.1}
                                        {...field}
                                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      {sizingType === "fixed" && "Fixed number of shares to trade"}
                                      {sizingType === "percentage" && "Percentage of portfolio to allocate (1-100)"}
                                      {sizingType === "risk-based" && "Percentage of account to risk per trade (0.1-5)"}
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                );
                              }}
                            />
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader>
                            <CardTitle>Security Settings</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="configuration.securitySettings.useSignature"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                  <div className="space-y-0.5">
                                    <FormLabel>Require HMAC Signature</FormLabel>
                                    <FormDescription>
                                      Require a valid HMAC-SHA256 signature with each webhook call
                                    </FormDescription>
                                  </div>
                                  <FormControl>
                                    <Switch
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            {form.watch("configuration.securitySettings.useSignature") && (
                              <FormField
                                control={form.control}
                                name="configuration.securitySettings.signatureSecret"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Signature Secret Key</FormLabel>
                                    <FormControl>
                                      <div className="flex">
                                        <Input
                                          type={showSecretKey ? "text" : "password"}
                                          placeholder="Secret key for HMAC signatures"
                                          {...field}
                                          className="flex-1"
                                        />
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="ml-2"
                                          onClick={() => setShowSecretKey(!showSecretKey)}
                                        >
                                          {showSecretKey ? "Hide" : "Show"}
                                        </Button>
                                      </div>
                                    </FormControl>
                                    <FormDescription>
                                      This secret key will be used to verify the HMAC signature
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}
                            
                            <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mb-4">
                              <div className="space-y-0.5">
                                <Label>Use Platform IPs</Label>
                                <p className="text-sm text-muted-foreground">
                                  Add your external platform's server IP addresses to the whitelist
                                </p>
                              </div>
                              <Switch
                                checked={useTradingViewIps}
                                onCheckedChange={handleToggleTradingViewIps}
                              />
                            </div>
                            
                            <div>
                              <Label>IP Whitelist (Optional)</Label>
                              <div className="mt-2 flex">
                                <Input
                                  value={newIpAddress}
                                  onChange={(e) => setNewIpAddress(e.target.value)}
                                  placeholder="192.168.1.1"
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="ml-2"
                                  onClick={handleAddIpToWhitelist}
                                >
                                  Add IP
                                </Button>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                Only allow webhook calls from these IP addresses. Leave empty to allow all.
                              </p>
                              
                              <div className="mt-3 flex flex-wrap gap-2">
                                {form.watch("configuration.securitySettings.ipWhitelist")?.map((ip: string) => (
                                  <Badge key={ip} variant="secondary" className="flex items-center gap-1">
                                    {ip}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-4 p-0"
                                      onClick={() => handleRemoveIpFromWhitelist(ip)}
                                    >
                                      <Trash className="h-3 w-3" />
                                    </Button>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">
                        Update Webhook
                      </Button>
                    </div>
                  </form>
                </Form>
              </TabsContent>
              
              <TabsContent value="logs">
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle>Activity Logs</CardTitle>
                    </div>
                    <Button variant="outline" size="sm" className="h-8">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {isLoadingLogs ? (
                      <div className="flex justify-center py-4">
                        <p>Loading logs...</p>
                      </div>
                    ) : webhookLogs && webhookLogs.length > 0 ? (
                      <div className="space-y-4">
                        {webhookLogs.map((log: any, index: number) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center">
                                {log.status === 'success' ? (
                                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                                ) : (
                                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                                )}
                                <div>
                                  <p className="font-medium">{log.action}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {new Date(log.timestamp).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                                {log.status}
                              </Badge>
                            </div>
                            
                            {log.message && (
                              <p className="text-sm mb-2">{log.message}</p>
                            )}
                            
                            {log.payload && (
                              <div className="mt-2">
                                <p className="text-sm font-medium mb-1">Payload:</p>
                                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 px-4">
                        <p className="text-muted-foreground">No activity logs yet</p>
                        <p className="text-sm mt-1">
                          Logs will appear here when the webhook is triggered
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="examples">
                <Card>
                  <CardHeader>
                    <CardTitle>Example Usage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-medium mb-2">Webhook Setup Guide</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Configure webhooks from external platforms with the following settings:
                        </p>
                        
                        <div className="space-y-4">
                          <div>
                            <Label>1. Create a webhook in your external platform</Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              Configure based on your platform's specific settings
                            </p>
                          </div>
                          
                          <div>
                            <Label>2. Enter the webhook URL in your platform's settings</Label>
                            <Input 
                              readOnly 
                              value={`${window.location.origin}/api/webhook-triggers/${currentWebhook.token}`}
                              className="mt-1 font-mono text-xs"
                            />
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mt-2"
                              onClick={() => handleCopyWebhookUrl(currentWebhook.token)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Webhook URL
                            </Button>
                          </div>
                          
                          <div>
                            <Label>3. Set the "Message" field with your trading signal</Label>
                            <Textarea 
                              readOnly
                              value={
                                currentWebhook.action === "trade"
                                  ? JSON.stringify({
                                      action: "BUY",
                                      ticker: "{{ticker}}",
                                      quantity: 100,
                                      // Optional parameters
                                      entry_price: "{{close}}",
                                      stop_loss: "{{low}}",
                                      take_profit: "{{high}}" 
                                    }, null, 2)
                                  : currentWebhook.action === "cancel"
                                  ? JSON.stringify({
                                      cancel_order: "order-123456"
                                    }, null, 2)
                                  : JSON.stringify({
                                      order_id: "order-123456" 
                                    }, null, 2)
                              }
                              className="mt-1 font-mono text-xs h-44"
                            />
                            <p className="text-sm text-muted-foreground mt-1">
                              Replace placeholders with appropriate variables from your platform
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h3 className="text-lg font-medium mb-2">Testing with cURL</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          You can test your webhook with the following cURL command:
                        </p>
                        
                        <div className="bg-muted p-4 rounded">
                          <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                            {getExampleCurlCommand(currentWebhook)}
                          </pre>
                          <p className="text-sm text-muted-foreground mt-2">
                            Run this command in your terminal to test the webhook
                          </p>
                        </div>
                      </div>
                      
                      {currentWebhook.configuration?.securitySettings?.useSignature && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Signature Required</AlertTitle>
                          <AlertDescription>
                            This webhook requires a valid HMAC-SHA256 signature. You'll need to generate the signature by creating an HMAC-SHA256 hash of the request body using your secret key, and include it in the X-Signature header.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}