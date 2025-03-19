import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchData, postData, updateData, deleteData } from "@/lib/api";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import MainLayout from "@/components/layout/MainLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, PlusCircle, Trash2, Edit, RefreshCw } from "lucide-react";

// Define the schema for API integrations
const integrationSchema = z.object({
  provider: z.string().min(1, { message: "Provider is required" }),
  apiKey: z.string().min(1, { message: "API key is required" }),
  apiSecret: z.string().optional(),
  description: z.string().optional(),
});

type IntegrationFormValues = z.infer<typeof integrationSchema>;

interface ApiIntegration {
  id: number;
  userId: number;
  provider: string;
  type: string; // 'exchange', 'data', 'ai', etc.
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

const IntegrationsPage = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<ApiIntegration | null>(null);
  const { toast } = useToast();

  // Fetch integrations
  const { data: allIntegrations, isLoading } = useQuery({
    queryKey: ['/api/integrations'],
    queryFn: () => fetchData<ApiIntegration[]>('/api/integrations'),
  });
  
  // Filter out exchange-type integrations (they are shown in the Broker Accounts page)
  const integrations = allIntegrations?.filter(integration => 
    integration.type !== 'exchange'
  );

  // Form setup
  const form = useForm<IntegrationFormValues>({
    resolver: zodResolver(integrationSchema),
    defaultValues: {
      provider: '',
      apiKey: '',
      apiSecret: '',
      description: '',
    },
  });

  // Reset form when dialog closes
  const resetForm = () => {
    form.reset();
    setEditingIntegration(null);
  };

  // Add integration mutation
  const addIntegrationMutation = useMutation({
    mutationFn: (data: any) => postData('/api/integrations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Integration added",
        description: "Your API integration has been added successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to add integration",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      });
    },
  });

  // Update integration mutation
  const updateIntegrationMutation = useMutation({
    mutationFn: (data: any) => 
      updateData(`/api/integrations/${data.id}`, {
        provider: data.provider,
        type: data.type,
        credentials: data.credentials,
        description: data.description,
        isActive: data.isActive,
        isPrimary: data.isPrimary
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Integration updated",
        description: "Your API integration has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update integration",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      });
    },
  });

  // Delete integration mutation
  const deleteIntegrationMutation = useMutation({
    mutationFn: (id: number) => deleteData(`/api/integrations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
      toast({
        title: "Integration deleted",
        description: "Your API integration has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete integration",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      });
    },
  });

  // Set up form for editing
  const handleEdit = (integration: ApiIntegration) => {
    setEditingIntegration(integration);
    form.setValue('provider', integration.provider);
    form.setValue('description', integration.description || '');
    // Note: For security, API keys and secrets are not returned from the server
    // so we don't pre-fill these fields
    form.setValue('apiKey', '');
    form.setValue('apiSecret', '');
    setIsAddDialogOpen(true);
  };

  // Handle form submission
  const onSubmit = (values: IntegrationFormValues) => {
    // Prepare data for API request
    const integrationData = {
      ...values,
      // Add type field based on provider
      type: getIntegrationType(values.provider),
      // Format credentials object
      credentials: {
        apiKey: values.apiKey,
        ...(values.apiSecret ? { apiSecret: values.apiSecret } : {})
      },
      // Default to active and non-primary unless specified
      isActive: true,
      isPrimary: false
    };
    
    if (editingIntegration) {
      updateIntegrationMutation.mutate({
        ...integrationData,
        id: editingIntegration.id,
      });
    } else {
      addIntegrationMutation.mutate(integrationData);
    }
  };
  
  // Helper to determine integration type based on provider
  const getIntegrationType = (provider: string): string => {
    const providerMap: Record<string, string> = {
      'alpaca': 'exchange',
      'polygon': 'data',
      'finnhub': 'data',
      'binance': 'exchange',
      'openai': 'ai'
    };
    
    return providerMap[provider.toLowerCase()] || 'other';
  };

  return (
    <MainLayout title="API Integrations">
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">API Integrations</h1>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Integration
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingIntegration ? "Update API Integration" : "Add API Integration"}
                </DialogTitle>
                <DialogDescription>
                  {editingIntegration 
                    ? "Update your API credentials for trading platforms."
                    : "Connect your trading accounts by adding API credentials."}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Provider</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Alpaca, Binance" 
                            {...field} 
                            disabled={!!editingIntegration}
                          />
                        </FormControl>
                        <FormDescription>
                          The name of the trading platform or API provider.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter your API key" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          {editingIntegration 
                            ? "Leave blank to keep current API key." 
                            : "The API key provided by your trading platform."}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="apiSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Secret (Optional for some providers)</FormLabel>
                        <FormControl>
                          <Input 
                            type="password"
                            placeholder="Enter your API secret if required" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          {editingIntegration 
                            ? "Leave blank to keep current API secret." 
                            : "The API secret provided by your trading platform. Not required for services like Polygon.io."}
                        </FormDescription>
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
                          <Input 
                            placeholder="e.g., Paper Trading Account" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          A note to help you identify this integration.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="mt-6">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsAddDialogOpen(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={addIntegrationMutation.isPending || updateIntegrationMutation.isPending}
                    >
                      {(addIntegrationMutation.isPending || updateIntegrationMutation.isPending) ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {editingIntegration ? "Updating..." : "Adding..."}
                        </>
                      ) : (
                        editingIntegration ? "Update Integration" : "Add Integration"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your API Connections</CardTitle>
            <CardDescription>
              Manage your API connections to trading platforms.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : integrations && integrations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added On</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrations.map((integration) => (
                    <TableRow key={integration.id}>
                      <TableCell className="font-medium">{integration.provider}</TableCell>
                      <TableCell>{integration.description || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(integration.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleEdit(integration)}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => deleteIntegrationMutation.mutate(integration.id)}
                            disabled={deleteIntegrationMutation.isPending}
                          >
                            {deleteIntegrationMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-10">
                <p className="text-muted-foreground mb-4">
                  You haven't added any API integrations yet.
                </p>
                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  variant="outline"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Your First Integration
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <p className="text-sm text-muted-foreground">
              Your API keys are encrypted and stored securely. Never share your API keys with anyone.
            </p>
          </CardFooter>
        </Card>
      </div>
    </MainLayout>
  );
};

export default IntegrationsPage;