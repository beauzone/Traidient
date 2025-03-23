import { useState, useEffect } from 'react';
import { Heading } from '@/components/ui/heading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Clipboard, Info, Settings, Webhook, PlusCircle, Trash2, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface WebhookData {
  id: number;
  userId: number;
  name: string;
  description?: string;
  token: string;
  strategyId: number | null;
  action: string;
  configuration: {
    integrationId?: number;
    securitySettings?: {
      useSignature: boolean;
      signatureSecret?: string;
      ipWhitelist?: string[];
    };
    allowShortSelling?: boolean;
  };
  callCount: number;
  lastCalledAt?: string;
  createdAt: string;
}

interface WebhookLog {
  id: number;
  webhookId: number;
  timestamp: string;
  action: string;
  status: 'success' | 'error';
  message: string;
  payload?: Record<string, any>;
}

export default function Webhooks() {
  const { toast } = useToast();
  const [activeWebhook, setActiveWebhook] = useState<WebhookData | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    description: '',
    action: 'trade',
    configuration: {
      integrationId: undefined,
      securitySettings: {
        useSignature: false,
        signatureSecret: '',
        ipWhitelist: [] as string[]
      },
      allowShortSelling: false
    }
  });
  const [newIpAddress, setNewIpAddress] = useState('');
  const [activeTab, setActiveTab] = useState('details');

  // Fetch webhook list
  const { data: webhooks = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/webhooks'],
    retry: 1
  });

  // Fetch strategies for dropdown
  const { data: strategies = [] } = useQuery({
    queryKey: ['/api/strategies'],
    retry: 1
  });

  // Fetch integrations for dropdown
  const { data: integrations = [] } = useQuery({
    queryKey: ['/api/integrations'],
    retry: 1
  });

  // Fetch webhook logs if a webhook is selected
  const { data: webhookLogs = [] } = useQuery({
    queryKey: ['/api/webhooks', activeWebhook?.id, 'logs'],
    enabled: !!activeWebhook?.id,
    retry: 1
  });

  // Create webhook mutation
  const createWebhookMutation = useMutation({
    mutationFn: (data: any) => {
      return fetch('/api/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      }).then(res => {
        if (!res.ok) throw new Error('Failed to create webhook');
        return res.json();
      });
    },
    onSuccess: () => {
      toast({
        title: 'Webhook Created',
        description: 'Your webhook has been created successfully.'
      });
      setIsCreateDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create webhook: ${error.message}`,
        variant: 'destructive'
      });
    }
  });

  // Update webhook mutation
  const updateWebhookMutation = useMutation({
    mutationFn: (data: { id: number, webhook: Partial<WebhookData> }) => {
      return fetch(`/api/webhooks/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data.webhook)
      }).then(res => {
        if (!res.ok) throw new Error('Failed to update webhook');
        return res.json();
      });
    },
    onSuccess: () => {
      toast({
        title: 'Webhook Updated',
        description: 'Your webhook has been updated successfully.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
      if (activeWebhook) {
        queryClient.invalidateQueries({ queryKey: ['/api/webhooks', activeWebhook.id, 'logs'] });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update webhook: ${error.message}`,
        variant: 'destructive'
      });
    }
  });

  // Delete webhook mutation
  const deleteWebhookMutation = useMutation({
    mutationFn: (id: number) => {
      return fetch(`/api/webhooks/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }).then(res => {
        if (!res.ok) throw new Error('Failed to delete webhook');
        return true;
      });
    },
    onSuccess: () => {
      toast({
        title: 'Webhook Deleted',
        description: 'Your webhook has been deleted successfully.'
      });
      setActiveWebhook(null);
      queryClient.invalidateQueries({ queryKey: ['/api/webhooks'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete webhook: ${error.message}`,
        variant: 'destructive'
      });
    }
  });

  const resetForm = () => {
    setWebhookForm({
      name: '',
      description: '',
      action: 'trade',
      configuration: {
        integrationId: undefined,
        securitySettings: {
          useSignature: false,
          signatureSecret: '',
          ipWhitelist: []
        },
        allowShortSelling: false
      }
    });
  };

  const handleCreateWebhook = () => {
    createWebhookMutation.mutate(webhookForm);
  };

  const handleSelectWebhook = (webhook: WebhookData) => {
    setActiveWebhook(webhook);
    setActiveTab('details');
  };

  const handleUpdateWebhook = (field: string, value: any) => {
    if (!activeWebhook) return;

    let updatedWebhook: Partial<WebhookData> = { ...activeWebhook };

    if (field.startsWith('configuration.')) {
      const configField = field.split('.')[1];
      updatedWebhook = {
        ...updatedWebhook,
        configuration: {
          ...updatedWebhook.configuration,
          [configField]: value
        }
      };
    } else if (field.startsWith('securitySettings.')) {
      const securityField = field.split('.')[1];
      updatedWebhook = {
        ...updatedWebhook,
        configuration: {
          ...updatedWebhook.configuration,
          securitySettings: {
            ...updatedWebhook.configuration.securitySettings,
            [securityField]: value
          }
        }
      };
    } else {
      updatedWebhook = {
        ...updatedWebhook,
        [field]: value
      };
    }

    updateWebhookMutation.mutate({ id: activeWebhook.id, webhook: updatedWebhook });
  };

  const handleDeleteWebhook = () => {
    if (!activeWebhook) return;
    if (confirm('Are you sure you want to delete this webhook?')) {
      deleteWebhookMutation.mutate(activeWebhook.id);
    }
  };

  const handleAddIpToWhitelist = () => {
    if (!activeWebhook || !newIpAddress) return;
    
    const currentWhitelist = activeWebhook.configuration.securitySettings?.ipWhitelist || [];
    const newWhitelist = [...currentWhitelist, newIpAddress];
    
    handleUpdateWebhook('securitySettings.ipWhitelist', newWhitelist);
    setNewIpAddress('');
  };

  const handleRemoveIpFromWhitelist = (ip: string) => {
    if (!activeWebhook) return;
    
    const currentWhitelist = activeWebhook.configuration.securitySettings?.ipWhitelist || [];
    const newWhitelist = currentWhitelist.filter(item => item !== ip);
    
    handleUpdateWebhook('securitySettings.ipWhitelist', newWhitelist);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: 'Copied!',
        description: 'Copied to clipboard'
      });
    });
  };

  const getWebhookUrl = (token: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/external-webhook/${token}`;
  };

  // Format date for display
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="container mx-auto p-6">
      <Heading 
        title="Webhooks" 
        description="Create and manage TradingView webhooks for your strategies" 
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {/* Webhook List */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Your Webhooks</span>
              <Button 
                size="sm" 
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                New
              </Button>
            </CardTitle>
            <CardDescription>
              Configure webhooks for TradingView alerts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">Loading webhooks...</div>
            ) : webhooks.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <Webhook className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No webhooks created yet</p>
                <p className="text-sm mt-2">Create a webhook to receive signals from TradingView</p>
              </div>
            ) : (
              <div className="space-y-2">
                {webhooks.map((webhook: WebhookData) => (
                  <div 
                    key={webhook.id}
                    className={`p-3 rounded-md border cursor-pointer transition-colors hover:bg-muted ${
                      activeWebhook?.id === webhook.id ? 'bg-muted border-primary' : ''
                    }`}
                    onClick={() => handleSelectWebhook(webhook)}
                  >
                    <div className="font-medium">{webhook.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {webhook.action.toUpperCase()} - {webhook.callCount} calls
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Last used: {formatDate(webhook.lastCalledAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webhook Details */}
        <Card className="md:col-span-2">
          {!activeWebhook ? (
            <CardContent className="text-center py-8">
              <Webhook className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">No webhook selected</h3>
              <p className="text-muted-foreground">
                Select a webhook from the list or create a new one to view and edit its details
              </p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle>{activeWebhook.name}</CardTitle>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleDeleteWebhook}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
                <CardDescription>{activeWebhook.description || 'No description'}</CardDescription>
              </CardHeader>
              
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="logs">Logs</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="details" className="space-y-4">
                    <div className="p-4 bg-muted rounded-md">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">Webhook URL</h3>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyToClipboard(getWebhookUrl(activeWebhook.token))}
                        >
                          <Clipboard className="h-4 w-4 mr-2" />
                          Copy
                        </Button>
                      </div>
                      <div className="text-sm bg-background p-2 rounded border overflow-x-auto">
                        {getWebhookUrl(activeWebhook.token)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Use this URL in your TradingView alert webhooks
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="webhook-action">Action</Label>
                        <Input 
                          id="webhook-action"
                          value={activeWebhook.action}
                          disabled
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          The action this webhook will trigger
                        </p>
                      </div>
                      
                      <div>
                        <Label htmlFor="webhook-strategy">Strategy</Label>
                        <Select
                          value={activeWebhook.strategyId?.toString() || ''}
                          onValueChange={(value) => handleUpdateWebhook('strategyId', value ? parseInt(value) : null)}
                        >
                          <SelectTrigger id="webhook-strategy">
                            <SelectValue placeholder="Select a strategy (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {strategies.map((strategy: any) => (
                              <SelectItem key={strategy.id} value={strategy.id.toString()}>
                                {strategy.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Associate this webhook with a strategy (optional)
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="webhook-created">Created</Label>
                        <Input 
                          id="webhook-created"
                          value={formatDate(activeWebhook.createdAt)}
                          disabled
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="webhook-last-called">Last Used</Label>
                        <Input 
                          id="webhook-last-called"
                          value={formatDate(activeWebhook.lastCalledAt)}
                          disabled
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="webhook-call-count">Total Calls</Label>
                      <Input 
                        id="webhook-call-count"
                        value={activeWebhook.callCount}
                        disabled
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="settings" className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-2">Basic Information</h3>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="settings-name">Webhook Name</Label>
                          <Input 
                            id="settings-name"
                            value={activeWebhook.name}
                            onChange={(e) => handleUpdateWebhook('name', e.target.value)}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="settings-description">Description</Label>
                          <Input 
                            id="settings-description"
                            value={activeWebhook.description || ''}
                            onChange={(e) => handleUpdateWebhook('description', e.target.value)}
                            placeholder="Optional description"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h3 className="text-lg font-medium mb-2">Broker Integration</h3>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="settings-integration">Trading Account</Label>
                          <Select
                            value={activeWebhook.configuration.integrationId?.toString() || ''}
                            onValueChange={(value) => handleUpdateWebhook('configuration.integrationId', value ? parseInt(value) : undefined)}
                          >
                            <SelectTrigger id="settings-integration">
                              <SelectValue placeholder="Select a trading account" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Default Account</SelectItem>
                              {integrations
                                .filter((integration: any) => 
                                  integration.provider.toLowerCase().includes('alpaca') || 
                                  integration.type === 'exchange'
                                )
                                .map((integration: any) => (
                                  <SelectItem key={integration.id} value={integration.id.toString()}>
                                    {integration.provider} - {integration.description || 'No description'}
                                  </SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Select which trading account to use for this webhook
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="settings-short-selling"
                            checked={activeWebhook.configuration.allowShortSelling || false}
                            onCheckedChange={(checked) => handleUpdateWebhook('configuration.allowShortSelling', checked)}
                          />
                          <Label htmlFor="settings-short-selling">Allow Short Selling</Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          When enabled, SELL signals for symbols you don't own will create short positions
                        </p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h3 className="text-lg font-medium mb-2">Security</h3>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <Switch
                              id="settings-use-signature"
                              checked={activeWebhook.configuration.securitySettings?.useSignature || false}
                              onCheckedChange={(checked) => handleUpdateWebhook('securitySettings.useSignature', checked)}
                            />
                            <Label htmlFor="settings-use-signature">Require HMAC Signature</Label>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            When enabled, webhook calls must include a valid HMAC signature
                          </p>
                          
                          {activeWebhook.configuration.securitySettings?.useSignature && (
                            <div className="mt-2">
                              <Label htmlFor="settings-signature-secret">Signature Secret</Label>
                              <Input 
                                id="settings-signature-secret"
                                type="password"
                                value={activeWebhook.configuration.securitySettings?.signatureSecret || ''}
                                onChange={(e) => handleUpdateWebhook('securitySettings.signatureSecret', e.target.value)}
                                placeholder="Secret key for HMAC signature"
                              />
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <Label className="mb-2 block">IP Whitelist</Label>
                          <div className="flex space-x-2 mb-2">
                            <Input 
                              placeholder="Enter IP address"
                              value={newIpAddress}
                              onChange={(e) => setNewIpAddress(e.target.value)}
                            />
                            <Button onClick={handleAddIpToWhitelist}>Add</Button>
                          </div>
                          
                          <div className="mt-2">
                            {(activeWebhook.configuration.securitySettings?.ipWhitelist?.length || 0) === 0 ? (
                              <p className="text-sm text-muted-foreground">No IP whitelist (allow all)</p>
                            ) : (
                              <div className="space-y-2">
                                {activeWebhook.configuration.securitySettings?.ipWhitelist?.map((ip, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-muted p-2 rounded">
                                    <span className="text-sm">{ip}</span>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => handleRemoveIpFromWhitelist(ip)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="logs">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium">Webhook Call Logs</h3>
                        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/webhooks', activeWebhook.id, 'logs'] })}>
                          Refresh
                        </Button>
                      </div>
                      
                      {webhookLogs.logs && webhookLogs.logs.length > 0 ? (
                        <ScrollArea className="h-[400px]">
                          <div className="space-y-3">
                            {webhookLogs.logs.map((log: WebhookLog) => (
                              <Accordion type="single" collapsible key={log.id}>
                                <AccordionItem value={`log-${log.id}`}>
                                  <AccordionTrigger className={`p-3 rounded-t-md bg-muted ${
                                    log.status === 'success' ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    <div className="flex items-center">
                                      {log.status === 'success' ? (
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                      ) : (
                                        <XCircle className="h-4 w-4 mr-2" />
                                      )}
                                      <div className="text-left">
                                        <div className="font-medium">{log.action}</div>
                                        <div className="text-xs text-muted-foreground">
                                          {new Date(log.timestamp).toLocaleString()}
                                        </div>
                                      </div>
                                    </div>
                                  </AccordionTrigger>
                                  <AccordionContent className="bg-background border border-t-0 rounded-b-md p-3">
                                    <div className="mb-2">
                                      <span className="font-medium">Message:</span> {log.message}
                                    </div>
                                    {log.payload && (
                                      <div>
                                        <span className="font-medium">Payload:</span>
                                        <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto">
                                          {JSON.stringify(log.payload, null, 2)}
                                        </pre>
                                      </div>
                                    )}
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="text-center py-8 bg-muted rounded-md">
                          <Info className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-muted-foreground">No logs available for this webhook</p>
                          <p className="text-sm mt-2 text-muted-foreground">
                            Logs will appear here when your webhook is called
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {/* Create Webhook Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Webhook</DialogTitle>
            <DialogDescription>
              Create a webhook to receive trading signals from TradingView
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 my-4">
            <div>
              <Label htmlFor="create-name">Webhook Name</Label>
              <Input 
                id="create-name"
                value={webhookForm.name}
                onChange={(e) => setWebhookForm({...webhookForm, name: e.target.value})}
                placeholder="My TradingView Webhook"
              />
            </div>
            
            <div>
              <Label htmlFor="create-description">Description (optional)</Label>
              <Input 
                id="create-description"
                value={webhookForm.description}
                onChange={(e) => setWebhookForm({...webhookForm, description: e.target.value})}
                placeholder="Description of this webhook's purpose"
              />
            </div>
            
            <div>
              <Label htmlFor="create-action">Action</Label>
              <Select
                value={webhookForm.action}
                onValueChange={(value) => setWebhookForm({...webhookForm, action: value})}
              >
                <SelectTrigger id="create-action">
                  <SelectValue placeholder="Select an action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trade">Trading Signals (Buy/Sell)</SelectItem>
                  <SelectItem value="cancel">Cancel Orders</SelectItem>
                  <SelectItem value="status">Check Order Status</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                The primary action this webhook will perform
              </p>
            </div>
            
            <div>
              <Label htmlFor="create-integration">Trading Account</Label>
              <Select
                value={webhookForm.configuration.integrationId?.toString() || ''}
                onValueChange={(value) => setWebhookForm({
                  ...webhookForm, 
                  configuration: {
                    ...webhookForm.configuration,
                    integrationId: value ? parseInt(value) : undefined
                  }
                })}
              >
                <SelectTrigger id="create-integration">
                  <SelectValue placeholder="Select a trading account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Default Account</SelectItem>
                  {integrations
                    .filter((integration: any) => 
                      integration.provider.toLowerCase().includes('alpaca') || 
                      integration.type === 'exchange'
                    )
                    .map((integration: any) => (
                      <SelectItem key={integration.id} value={integration.id.toString()}>
                        {integration.provider} - {integration.description || 'No description'}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Select which trading account to use for this webhook
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="create-allow-short"
                checked={webhookForm.configuration.allowShortSelling || false}
                onCheckedChange={(checked) => setWebhookForm({
                  ...webhookForm,
                  configuration: {
                    ...webhookForm.configuration,
                    allowShortSelling: checked
                  }
                })}
              />
              <Label htmlFor="create-allow-short">Allow Short Selling</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              When enabled, SELL signals for symbols you don't own will create short positions
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateWebhook} disabled={!webhookForm.name}>Create Webhook</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}