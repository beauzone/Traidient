import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Clipboard, Plus, Trash2, RefreshCw, AlertCircle, Check, X, Eye } from 'lucide-react';
import { getData, postData, deleteData } from '@/lib/api';

// Define the webhook schema for form validation
const webhookSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters' }),
  description: z.string().optional(),
  strategyId: z.number().optional(),
  action: z.enum(['entry', 'exit', 'cancel']),
  configuration: z.object({
    positionSizing: z.object({
      type: z.enum(['fixed', 'percentage', 'risk-based']),
      value: z.number().min(1)
    }),
    parameters: z.record(z.any()).optional(),
    requiredFields: z.array(z.string()).optional(),
    securitySettings: z.object({
      useSignatureVerification: z.boolean().optional(),
      signatureSecret: z.string().optional(),
      ipWhitelist: z.array(z.string()).optional()
    }).optional()
  })
});

type WebhookFormValues = z.infer<typeof webhookSchema>;

interface Webhook {
  id: number;
  name: string;
  description?: string;
  token: string;
  userId: number;
  strategyId?: number;
  action: 'entry' | 'exit' | 'cancel';
  configuration: {
    positionSizing: {
      type: 'fixed' | 'percentage' | 'risk-based';
      value: number;
    };
    parameters?: Record<string, any>;
    requiredFields?: string[];
    securitySettings?: {
      useSignatureVerification?: boolean;
      signatureSecret?: string;
      ipWhitelist?: string[];
    };
  };
  lastCalledAt?: string;
  lastStatus?: 'success' | 'error';
  lastError?: string;
  callCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Strategy {
  id: number;
  name: string;
}

export default function WebhookManager() {
  const [activeTab, setActiveTab] = useState('webhooks');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [viewWebhookLogs, setViewWebhookLogs] = useState<number | null>(null);

  const queryClient = useQueryClient();

  // Fetch user's webhooks
  const { data: webhooks = [], isLoading: isLoadingWebhooks } = useQuery({
    queryKey: ['/api/webhooks'],
    queryFn: () => getData('/api/webhooks')
  });

  // Fetch strategies for dropdown
  const { data: strategies = [] } = useQuery({
    queryKey: ['/api/strategies'],
    queryFn: () => getData('/api/strategies')
  });

  // Create webhook mutation
  const createWebhookMutation = useMutation({
    mutationFn: (data: WebhookFormValues) => postData('/api/webhooks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
      toast({
        title: 'Webhook created',
        description: 'Your webhook endpoint has been created successfully.',
      });
      setIsCreating(false);
    },
    onError: (error) => {
      console.error('Error creating webhook:', error);
      toast({
        title: 'Error',
        description: 'Failed to create webhook. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Delete webhook mutation
  const deleteWebhookMutation = useMutation({
    mutationFn: (id: number) => deleteData(`/api/webhooks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
      toast({
        title: 'Webhook deleted',
        description: 'Your webhook endpoint has been deleted.',
      });
    },
    onError: (error) => {
      console.error('Error deleting webhook:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete webhook. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Get webhook logs mutation
  const getWebhookLogsMutation = useMutation({
    mutationFn: (id: number) => getData(`/api/webhooks/${id}/logs`),
    onSuccess: (data) => {
      // Handle webhook logs data
      console.log('Webhook logs:', data);
    },
    onError: (error) => {
      console.error('Error fetching webhook logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch webhook logs. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Form for creating webhooks
  const form = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      name: '',
      description: '',
      action: 'entry',
      configuration: {
        positionSizing: {
          type: 'fixed',
          value: 1
        },
        parameters: {},
        requiredFields: [],
        securitySettings: {
          useSignatureVerification: false,
          ipWhitelist: []
        }
      }
    }
  });

  // Effect to update webhook URL when a webhook is selected
  useEffect(() => {
    if (selectedWebhook) {
      const baseUrl = window.location.origin;
      setWebhookUrl(`${baseUrl}/api/webhook/${selectedWebhook.token}`);
    }
  }, [selectedWebhook]);

  // Handle form submission
  const onSubmit = (values: WebhookFormValues) => {
    createWebhookMutation.mutate(values);
  };

  // Copy webhook URL to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  // Delete a webhook
  const handleDeleteWebhook = (id: number) => {
    if (confirm('Are you sure you want to delete this webhook?')) {
      deleteWebhookMutation.mutate(id);
    }
  };

  // View webhook logs
  const handleViewLogs = (id: number) => {
    setViewWebhookLogs(id);
    getWebhookLogsMutation.mutate(id);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">TradingView Webhooks</h2>
        <Button variant="default" onClick={() => setIsCreating(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Webhook
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="webhooks">My Webhooks</TabsTrigger>
          <TabsTrigger value="documentation">Documentation</TabsTrigger>
        </TabsList>
        
        <TabsContent value="webhooks" className="space-y-4">
          {isLoadingWebhooks ? (
            <div className="flex justify-center py-6">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : webhooks.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No webhooks found</h3>
                <p className="text-muted-foreground mt-2 mb-4">
                  You haven't created any webhook endpoints yet. Create one to start receiving signals from TradingView.
                </p>
                <Button variant="default" onClick={() => setIsCreating(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first webhook
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {webhooks.map((webhook: Webhook) => (
                <Card key={webhook.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{webhook.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {webhook.description || 'No description'}
                        </CardDescription>
                      </div>
                      <Badge variant={webhook.lastStatus === 'error' ? 'destructive' : 'default'}>
                        {webhook.action.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium mb-1">Webhook URL</p>
                          <div className="flex items-center space-x-2">
                            <Input 
                              readOnly 
                              value={`${window.location.origin}/api/webhook/${webhook.token}`} 
                              className="font-mono text-sm"
                            />
                            <Button 
                              variant="outline" 
                              size="icon" 
                              onClick={() => {
                                setSelectedWebhook(webhook);
                                copyToClipboard();
                              }}
                            >
                              {isCopied && selectedWebhook?.id === webhook.id ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Clipboard className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium mb-1">Position Sizing</p>
                            <p className="text-sm">
                              {webhook.configuration.positionSizing.type} ({webhook.configuration.positionSizing.value}{webhook.configuration.positionSizing.type === 'percentage' ? '%' : ''})
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium mb-1">Call Count</p>
                            <p className="text-sm">{webhook.callCount} times</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium mb-1">Created</p>
                          <p className="text-sm">{formatDate(webhook.createdAt)}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Last Called</p>
                          <p className="text-sm">{webhook.lastCalledAt ? formatDate(webhook.lastCalledAt) : 'Never'}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleViewLogs(webhook.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Logs
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleDeleteWebhook(webhook.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="documentation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>How to Use TradingView Webhooks</CardTitle>
              <CardDescription>
                Follow these instructions to connect your TradingView alerts to this trading bot.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Step 1: Create a Webhook Endpoint</h3>
                <p>Create a new webhook using the "Create Webhook" button. Choose the action type (entry, exit, or cancel) and configure position sizing.</p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Step 2: Copy Webhook URL</h3>
                <p>Copy the webhook URL for the endpoint you created. You'll paste this into TradingView.</p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Step 3: Create a TradingView Alert</h3>
                <p>In TradingView, create a new alert for your strategy:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Open your chart and select "Alerts" from the right sidebar</li>
                  <li>Click "Create Alert"</li>
                  <li>Set your alert conditions</li>
                  <li>In the "Notifications" section, enable "Webhook URL"</li>
                  <li>Paste your webhook URL</li>
                  <li>Format the alert message as JSON. See examples below.</li>
                </ol>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Message Format Examples</h3>
                <p className="text-sm font-bold mt-2">Buy Signal JSON:</p>
                <pre className="bg-secondary p-3 rounded text-xs overflow-auto">
{`{
  "action": "BUY",
  "ticker": "{{ticker}}",
  "quantity": 10,
  "entry_price": {{close}},
  "stop_loss": {{close}} * 0.95,
  "take_profit": {{close}} * 1.10
}`}
                </pre>
                
                <p className="text-sm font-bold mt-2">Sell Signal JSON:</p>
                <pre className="bg-secondary p-3 rounded text-xs overflow-auto">
{`{
  "action": "SELL",
  "ticker": "{{ticker}}",
  "quantity": 10
}`}
                </pre>
                
                <p className="text-sm font-bold mt-2">Close Position JSON:</p>
                <pre className="bg-secondary p-3 rounded text-xs overflow-auto">
{`{
  "action": "CLOSE",
  "ticker": "{{ticker}}"
}`}
                </pre>
                
                <p className="text-sm font-bold mt-2">Cancel Order JSON:</p>
                <pre className="bg-secondary p-3 rounded text-xs overflow-auto">
{`{
  "cancel_order": "order_id_here"
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Create Webhook Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Create Webhook Endpoint</DialogTitle>
            <DialogDescription>
              Create a new webhook endpoint to receive signals from TradingView.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Webhook Name</FormLabel>
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
                      <Textarea placeholder="Golden Cross strategy for SPY" {...field} />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an action" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="entry">Entry (Buy)</SelectItem>
                        <SelectItem value="exit">Exit (Sell/Close)</SelectItem>
                        <SelectItem value="cancel">Cancel Order</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      This determines how the webhook will process incoming signals.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="strategyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Strategy (Optional)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a strategy" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {strategies.map((strategy: Strategy) => (
                          <SelectItem key={strategy.id} value={strategy.id.toString()}>
                            {strategy.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Link this webhook to an existing strategy for tracking purposes.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="configuration.positionSizing.type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position Sizing Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select position sizing type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed Quantity</SelectItem>
                        <SelectItem value="percentage">Percentage of Portfolio</SelectItem>
                        <SelectItem value="risk-based">Risk-Based</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How to calculate position sizes for incoming trade signals.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="configuration.positionSizing.value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {form.watch('configuration.positionSizing.type') === 'fixed' ? 'Quantity' : 
                       form.watch('configuration.positionSizing.type') === 'percentage' ? 'Percentage' : 
                       'Risk Percentage'}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder={
                          form.watch('configuration.positionSizing.type') === 'fixed' ? '10' : 
                          form.watch('configuration.positionSizing.type') === 'percentage' ? '5' : '1'
                        } 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      {form.watch('configuration.positionSizing.type') === 'fixed' ? 
                        'Number of shares to buy/sell' : 
                        form.watch('configuration.positionSizing.type') === 'percentage' ? 
                        'Percentage of portfolio value to use (1-100)' : 
                        'Percentage of portfolio to risk per trade (1-10)'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="configuration.securitySettings.useSignatureVerification"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Signature Verification</FormLabel>
                      <FormDescription>
                        Enable HMAC signature verification for enhanced security
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {form.watch('configuration.securitySettings.useSignatureVerification') && (
                <FormField
                  control={form.control}
                  name="configuration.securitySettings.signatureSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Signature Secret</FormLabel>
                      <FormControl>
                        <Input placeholder="Shared secret for HMAC signatures" {...field} />
                      </FormControl>
                      <FormDescription>
                        This secret will be used to verify webhook signatures.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createWebhookMutation.isPending}>
                  {createWebhookMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Webhook'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* View Webhook Logs Dialog */}
      <Dialog open={viewWebhookLogs !== null} onOpenChange={() => setViewWebhookLogs(null)}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Webhook Activity Logs</DialogTitle>
            <DialogDescription>
              Recent activity for this webhook endpoint.
            </DialogDescription>
          </DialogHeader>
          
          {getWebhookLogsMutation.isPending ? (
            <div className="flex justify-center py-6">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : getWebhookLogsMutation.data?.logs?.length > 0 ? (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getWebhookLogsMutation.data?.logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatDate(log.timestamp)}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>
                        {log.status === 'success' ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            Error
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {log.message || 'No message'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-6">
              <p>No activity logs found for this webhook.</p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewWebhookLogs(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}