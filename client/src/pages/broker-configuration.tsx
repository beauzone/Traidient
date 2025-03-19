import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { postData, updateData } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchData } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Define common schema properties
const baseSchema = z.object({
  description: z.string().optional(),
});

// Define schemas for different broker types
const alpacaSchema = baseSchema.extend({
  provider: z.literal("alpaca"),
  apiKey: z.string().min(1, "API Key is required"),
  apiSecret: z.string().min(1, "API Secret is required"),
  endpoint: z.enum(["paper", "live"], {
    required_error: "Please select an endpoint",
  }),
  accountType: z.enum(["paper", "live"], {
    required_error: "Please select an account type",
  }),
});

const interactiveBrokersSchema = baseSchema.extend({
  provider: z.literal("ibkr"),
  endpoint: z.string().min(1, "Endpoint is required"),
  accountId: z.string().min(1, "Account ID is required"),
  port: z.string().min(1, "Port is required"),
  readOnly: z.boolean().default(false),
});

const genericBrokerSchema = baseSchema.extend({
  provider: z.literal("generic"),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  endpoint: z.string().optional(),
  additionalConfig: z.record(z.string()).optional(),
});

// Union type for all broker schemas
const brokerConfigSchema = z.discriminatedUnion("provider", [
  alpacaSchema,
  interactiveBrokersSchema,
  genericBrokerSchema,
]);

type BrokerConfig = z.infer<typeof brokerConfigSchema>;

// Interface for API Integration from backend
interface ApiIntegration {
  id: number;
  userId: number;
  provider: string;
  credentials: Record<string, any>;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function BrokerConfiguration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("alpaca");
  const [selectedIntegration, setSelectedIntegration] = useState<ApiIntegration | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form for Alpaca
  const alpacaForm = useForm<z.infer<typeof alpacaSchema>>({
    resolver: zodResolver(alpacaSchema),
    defaultValues: {
      provider: "alpaca",
      endpoint: "paper",
      accountType: "paper",
      description: "",
      apiKey: "",
      apiSecret: "",
    },
  });

  // Form for Interactive Brokers
  const ibkrForm = useForm<z.infer<typeof interactiveBrokersSchema>>({
    resolver: zodResolver(interactiveBrokersSchema),
    defaultValues: {
      provider: "ibkr",
      endpoint: "localhost",
      port: "4001",
      accountId: "",
      description: "",
      readOnly: true,
    },
  });

  // Form for generic broker
  const genericForm = useForm<z.infer<typeof genericBrokerSchema>>({
    resolver: zodResolver(genericBrokerSchema),
    defaultValues: {
      provider: "generic",
      description: "",
      apiKey: "",
      apiSecret: "",
      endpoint: "",
      additionalConfig: {}
    },
  });

  // Query to fetch existing broker integrations
  const { data: integrations, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => fetchData<ApiIntegration[]>("/api/integrations"),
  });

  // Mutation to add a new broker integration
  const addIntegrationMutation = useMutation({
    mutationFn: (data: BrokerConfig) => {
      // Transform the data to match the API's expected format
      const apiData: any = {
        provider: data.provider === "generic" ? "alpaca" : data.provider, // Default to alpaca for generic type
        description: data.description || "",
        type: "exchange", // Required field from the schema
        isActive: true,
        isPrimary: false,
        credentials: {},
      };

      // Add credentials based on the provider
      if (data.provider === "alpaca") {
        apiData.credentials = {
          apiKey: data.apiKey,
          apiSecret: data.apiSecret,
          additionalFields: {
            endpoint: data.endpoint,
            accountType: data.accountType,
          }
        };
      } else if (data.provider === "ibkr") {
        apiData.credentials = {
          apiKey: "ibkr",
          additionalFields: {
            endpoint: data.endpoint,
            port: data.port,
            accountId: data.accountId,
            readOnly: data.readOnly,
          }
        };
      } else if (data.provider === "generic") {
        // For generic, use the stored original provider if available
        if (data.additionalConfig?.originalProvider) {
          apiData.provider = data.additionalConfig.originalProvider;
        }
        apiData.credentials = {
          apiKey: data.apiKey || "",
          apiSecret: data.apiSecret || "",
          additionalFields: {
            endpoint: data.endpoint || "",
            ...data.additionalConfig || {},
          }
        };
      }

      return postData("/api/integrations", apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast({
        title: "Success",
        description: "Broker integration added successfully",
      });
      resetForms();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add broker integration",
        variant: "destructive",
      });
    },
  });

  // Mutation to update an existing broker integration
  const updateIntegrationMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: BrokerConfig }) => {
      // Transform the data to match the API's expected format
      const apiData: any = {
        provider: data.provider === "generic" ? "alpaca" : data.provider, // Default to alpaca for generic type
        description: data.description || "",
        type: "exchange", // Required field from the schema
        isActive: true,
        isPrimary: false,
        credentials: {},
      };

      // Add credentials based on the provider
      if (data.provider === "alpaca") {
        apiData.credentials = {
          apiKey: data.apiKey,
          apiSecret: data.apiSecret,
          additionalFields: {
            endpoint: data.endpoint,
            accountType: data.accountType,
          }
        };
      } else if (data.provider === "ibkr") {
        apiData.credentials = {
          apiKey: "ibkr",
          additionalFields: {
            endpoint: data.endpoint,
            port: data.port,
            accountId: data.accountId,
            readOnly: data.readOnly,
          }
        };
      } else if (data.provider === "generic") {
        // For generic, use the stored original provider if available
        if (data.additionalConfig?.originalProvider) {
          apiData.provider = data.additionalConfig.originalProvider;
        }
        apiData.credentials = {
          apiKey: data.apiKey || "",
          apiSecret: data.apiSecret || "",
          additionalFields: {
            endpoint: data.endpoint || "",
            ...data.additionalConfig || {},
          }
        };
      }

      return updateData(`/api/integrations/${id}`, apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast({
        title: "Success",
        description: "Broker integration updated successfully",
      });
      setIsEditing(false);
      setSelectedIntegration(null);
      resetForms();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update broker integration",
        variant: "destructive",
      });
    },
  });

  // Mutation to delete a broker integration
  const deleteIntegrationMutation = useMutation({
    mutationFn: (id: number) => {
      return fetch(`/api/integrations/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }).then((res) => {
        if (!res.ok) {
          throw new Error("Failed to delete broker integration");
        }
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast({
        title: "Success",
        description: "Broker integration deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete broker integration",
        variant: "destructive",
      });
    },
  });

  const resetForms = () => {
    alpacaForm.reset({
      provider: "alpaca",
      endpoint: "paper",
      accountType: "paper",
      description: "",
      apiKey: "",
      apiSecret: "",
    });
    ibkrForm.reset({
      provider: "ibkr",
      endpoint: "localhost",
      port: "4001",
      accountId: "",
      description: "",
      readOnly: true,
    });
    genericForm.reset({
      provider: "generic",
      description: "",
      apiKey: "",
      apiSecret: "",
      endpoint: "",
      additionalConfig: {}
    });
  };

  const handleEditIntegration = (integration: ApiIntegration) => {
    setSelectedIntegration(integration);
    setIsEditing(true);

    // Set the active tab based on the provider
    setActiveTab(integration.provider === "ibkr" ? "ibkr" : 
                 integration.provider === "alpaca" ? "alpaca" : 
                 "generic");

    // Reset all forms first
    resetForms();

    // Set form values based on the provider
    if (integration.provider === "alpaca") {
      alpacaForm.reset({
        provider: "alpaca",
        description: integration.description || "",
        apiKey: integration.credentials?.apiKey || "",
        apiSecret: integration.credentials?.apiSecret || "",
        endpoint: integration.credentials?.additionalFields?.endpoint || "paper",
        accountType: integration.credentials?.additionalFields?.accountType || "paper",
      });
    } else if (integration.provider === "ibkr") {
      ibkrForm.reset({
        provider: "ibkr",
        description: integration.description || "",
        endpoint: integration.credentials?.additionalFields?.endpoint || "localhost",
        port: integration.credentials?.additionalFields?.port || "4001",
        accountId: integration.credentials?.additionalFields?.accountId || "",
        readOnly: integration.credentials?.additionalFields?.readOnly || false,
      });
    } else {
      // Generic provider
      genericForm.reset({
        provider: "generic", // Always set to generic for the form
        description: integration.description || "",
        apiKey: integration.credentials?.apiKey || "",
        apiSecret: integration.credentials?.apiSecret || "",
        endpoint: integration.credentials?.additionalFields?.endpoint || "",
        // We store the original provider in credentials for reference
        additionalConfig: {
          originalProvider: integration.provider,
          ...integration.credentials?.additionalFields
        }
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSelectedIntegration(null);
    resetForms();
  };

  // Submit handler for Alpaca form
  const onSubmitAlpaca = (values: z.infer<typeof alpacaSchema>) => {
    if (isEditing && selectedIntegration) {
      updateIntegrationMutation.mutate({
        id: selectedIntegration.id,
        data: values,
      });
    } else {
      addIntegrationMutation.mutate(values);
    }
  };

  // Submit handler for Interactive Brokers form
  const onSubmitIBKR = (values: z.infer<typeof interactiveBrokersSchema>) => {
    if (isEditing && selectedIntegration) {
      updateIntegrationMutation.mutate({
        id: selectedIntegration.id,
        data: values,
      });
    } else {
      addIntegrationMutation.mutate(values);
    }
  };

  // Submit handler for generic broker form
  const onSubmitGeneric = (values: z.infer<typeof genericBrokerSchema>) => {
    if (isEditing && selectedIntegration) {
      updateIntegrationMutation.mutate({
        id: selectedIntegration.id,
        data: values,
      });
    } else {
      addIntegrationMutation.mutate(values);
    }
  };

  return (
    <MainLayout title="Broker Configuration">
      <div className="container mx-auto p-4 max-w-5xl">
        <h1 className="text-3xl font-bold mb-6">Broker Configuration</h1>
        
        <div className="mb-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              Configure your brokerage accounts here. Proper configuration is required for any trading strategy to function correctly.
              Make sure to provide accurate API keys and secrets for your brokerage accounts.
            </AlertDescription>
          </Alert>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left panel: Add/Edit broker integration */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>
                  {isEditing ? "Edit Broker Integration" : "Add New Broker Integration"}
                </CardTitle>
                <CardDescription>
                  Configure your broker API connection details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full mb-6">
                    <TabsTrigger value="alpaca" className="flex-1">Alpaca</TabsTrigger>
                    <TabsTrigger value="ibkr" className="flex-1">Interactive Brokers</TabsTrigger>
                    <TabsTrigger value="generic" className="flex-1">Other</TabsTrigger>
                  </TabsList>

                  {/* Alpaca Form */}
                  <TabsContent value="alpaca">
                    <Form {...alpacaForm}>
                      <form onSubmit={alpacaForm.handleSubmit(onSubmitAlpaca)} className="space-y-4">
                        <FormField
                          control={alpacaForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="My Alpaca Account" {...field} />
                              </FormControl>
                              <FormDescription>
                                A friendly name to identify this account
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={alpacaForm.control}
                          name="apiKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Key</FormLabel>
                              <FormControl>
                                <Input placeholder="AKXXXXXXXXXXXXXXXXXXX" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={alpacaForm.control}
                          name="apiSecret"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Secret</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="Your API Secret" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={alpacaForm.control}
                          name="endpoint"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Endpoint</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select an endpoint" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="paper">Paper Trading</SelectItem>
                                  <SelectItem value="live">Live Trading</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Paper trading is for testing, live trading uses real money
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={alpacaForm.control}
                          name="accountType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select an account type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="paper">Paper Account</SelectItem>
                                  <SelectItem value="live">Live Account</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                This should match the endpoint type
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex items-center justify-end space-x-2 pt-4">
                          {isEditing && (
                            <Button variant="outline" onClick={handleCancelEdit}>
                              Cancel
                            </Button>
                          )}
                          <Button type="submit">
                            {isEditing ? "Update" : "Add"} Integration
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </TabsContent>

                  {/* Interactive Brokers Form */}
                  <TabsContent value="ibkr">
                    <Form {...ibkrForm}>
                      <form onSubmit={ibkrForm.handleSubmit(onSubmitIBKR)} className="space-y-4">
                        <FormField
                          control={ibkrForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="My IBKR Account" {...field} />
                              </FormControl>
                              <FormDescription>
                                A friendly name to identify this account
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={ibkrForm.control}
                          name="endpoint"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>TWS/Gateway Endpoint</FormLabel>
                              <FormControl>
                                <Input placeholder="localhost" {...field} />
                              </FormControl>
                              <FormDescription>
                                Usually localhost or a remote server address
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={ibkrForm.control}
                          name="port"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Port</FormLabel>
                              <FormControl>
                                <Input placeholder="4001" {...field} />
                              </FormControl>
                              <FormDescription>
                                Default is 4001 for live and 4002 for paper account
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={ibkrForm.control}
                          name="accountId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account ID</FormLabel>
                              <FormControl>
                                <Input placeholder="U12345678" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={ibkrForm.control}
                          name="readOnly"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Read-Only Mode</FormLabel>
                                <FormDescription>
                                  Disable trading capabilities and only read data
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

                        <div className="flex items-center justify-end space-x-2 pt-4">
                          {isEditing && (
                            <Button variant="outline" onClick={handleCancelEdit}>
                              Cancel
                            </Button>
                          )}
                          <Button type="submit">
                            {isEditing ? "Update" : "Add"} Integration
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </TabsContent>

                  {/* Generic Broker Form */}
                  <TabsContent value="generic">
                    <Form {...genericForm}>
                      <form onSubmit={genericForm.handleSubmit(onSubmitGeneric)} className="space-y-4">
                        <FormField
                          control={genericForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Other Broker Account" {...field} />
                              </FormControl>
                              <FormDescription>
                                A friendly name to identify this account
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={genericForm.control}
                          name="apiKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Key (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Your API Key" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={genericForm.control}
                          name="apiSecret"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Secret (Optional)</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="Your API Secret" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={genericForm.control}
                          name="endpoint"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Endpoint URL (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="https://api.example.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex items-center justify-end space-x-2 pt-4">
                          {isEditing && (
                            <Button variant="outline" onClick={handleCancelEdit}>
                              Cancel
                            </Button>
                          )}
                          <Button type="submit">
                            {isEditing ? "Update" : "Add"} Integration
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right panel: Existing broker integrations */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Your Broker Integrations</CardTitle>
                <CardDescription>
                  Manage your existing broker connections
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="py-8 text-center">Loading integrations...</div>
                ) : integrations && integrations.length > 0 ? (
                  <div className="space-y-4">
                    {integrations.map((integration) => (
                      <div key={integration.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-medium">
                              {integration.description || integration.provider}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {integration.provider.toUpperCase()}
                              {integration.credentials?.additionalFields?.endpoint === "paper" && " (Paper)"}
                              {integration.credentials?.additionalFields?.endpoint === "live" && " (Live)"}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditIntegration(integration)}
                            >
                              Edit
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this integration?")) {
                                  deleteIntegrationMutation.mutate(integration.id)
                                }
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                        <div className="text-sm">
                          <p>API Key: {integration.credentials?.apiKey.substring(0, 4)}...{integration.credentials?.apiKey.substring(integration.credentials?.apiKey.length - 4)}</p>
                          {integration.credentials?.additionalFields && (
                            <div className="mt-1 text-xs text-gray-500">
                              {Object.entries(integration.credentials.additionalFields)
                                .filter(([key]) => key !== "accountType" && key !== "endpoint")
                                .map(([key, value]) => (
                                  <p key={key}>{key}: {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</p>
                                ))
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-gray-500">No broker integrations found</p>
                    <p className="mt-2 text-sm">Add your first broker integration using the form on the left.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}