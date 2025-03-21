import React, { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Bell, ArrowLeft, AlertTriangle, ShoppingCart, BarChart } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { fetchData, updateData } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

// Define alert types for the form
const alertTypes = [
  {
    id: "price",
    name: "Price Alerts",
    description: "Get notified when a stock reaches your target price"
  },
  {
    id: "price_change_percent",
    name: "Price Change Alerts",
    description: "Get notified when a stock price changes by a specified percentage"
  },
  {
    id: "volume",
    name: "Volume Alerts",
    description: "Get notified when trading volume exceeds your threshold"
  },
  {
    id: "order_placed",
    name: "Order Placed",
    description: "Get notified when an order is placed"
  },
  {
    id: "order_filled",
    name: "Order Filled",
    description: "Get notified when an order is filled"
  },
  {
    id: "order_rejected",
    name: "Order Rejected",
    description: "Get notified when an order is rejected"
  },
  {
    id: "backtest_finished",
    name: "Backtest Finished",
    description: "Get notified when a backtest is finished"
  },
  {
    id: "strategy_performance",
    name: "Strategy Performance",
    description: "Get notified about your strategy's performance"
  },
  {
    id: "market_events",
    name: "Market Events",
    description: "Get notified about important market events (market open/close, earnings, etc.)"
  }
];

// Define delivery channels
const deliveryChannels = [
  {
    id: "app",
    name: "In-App",
    description: "Notifications within the application"
  },
  {
    id: "email",
    name: "Email",
    description: "Notifications sent to your email address"
  },
  {
    id: "sms",
    name: "SMS",
    description: "Text messages sent to your mobile phone"
  }
];

// Create schema for notification settings form
const notificationSettingsSchema = z.object({
  globalEnabled: z.boolean().default(true),
  phoneNumber: z.string().optional(),
  alertSettings: z.record(z.object({
    enabled: z.boolean().default(true),
    channels: z.object({
      app: z.boolean().default(true),
      email: z.boolean().default(false),
      sms: z.boolean().default(false)
    })
  }))
});

type NotificationSettingsFormValues = z.infer<typeof notificationSettingsSchema>;

const NotificationSettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("alerts");

  // Query to fetch current notification settings
  const { data: alertSettings, isLoading } = useQuery({
    queryKey: ['/api/users/notification-settings'],
    queryFn: async () => {
      try {
        return await fetchData<NotificationSettingsFormValues>('/api/users/notification-settings');
      } catch (error) {
        // If the API doesn't exist yet or returns an error, return defaults
        return {
          globalEnabled: true,
          phoneNumber: '',
          alertSettings: alertTypes.reduce((acc: Record<string, {
            enabled: boolean;
            channels: {
              app: boolean;
              email: boolean;
              sms: boolean;
            }
          }>, type) => {
            acc[type.id] = {
              enabled: true,
              channels: {
                app: true,
                email: user?.settings?.notifications?.email || false,
                sms: user?.settings?.notifications?.sms || false
              }
            };
            return acc;
          }, {})
        } as NotificationSettingsFormValues;
      }
    }
  });

  const form = useForm<NotificationSettingsFormValues>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: alertSettings || {
      globalEnabled: true,
      phoneNumber: '',
      alertSettings: alertTypes.reduce((acc: Record<string, {
        enabled: boolean;
        channels: {
          app: boolean;
          email: boolean;
          sms: boolean;
        }
      }>, type) => {
        acc[type.id] = {
          enabled: true,
          channels: {
            app: true,
            email: user?.settings?.notifications?.email || false,
            sms: user?.settings?.notifications?.sms || false
          }
        };
        return acc;
      }, {})
    }
  });

  // Update values when data is loaded
  React.useEffect(() => {
    if (alertSettings) {
      form.reset(alertSettings);
    }
  }, [alertSettings, form]);

  // Update notification settings mutation
  const updateSettings = useMutation({
    mutationFn: (data: NotificationSettingsFormValues) => updateData('/api/users/notification-settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/notification-settings'] });
      toast({
        title: "Settings updated",
        description: "Your notification settings have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update settings",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (values: NotificationSettingsFormValues) => {
    updateSettings.mutate(values);
  };

  // Watch global enabled state to disable/enable all other fields
  const globalEnabled = form.watch("globalEnabled");

  return (
    <MainLayout title="Notification Settings">
      <div className="max-w-5xl mx-auto space-y-6">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center">
              <Link href="/settings">
                <Button variant="ghost" size="icon" className="mr-2">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <CardTitle className="text-2xl">Notification Settings</CardTitle>
                <CardDescription>
                  Configure how and when you want to be notified
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="p-6">
                    <FormField
                      control={form.control}
                      name="globalEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Enable All Notifications
                            </FormLabel>
                            <FormDescription>
                              Quickly toggle all notifications on or off
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

                    <FormField
                      control={form.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem className="mt-4">
                          <FormLabel>Mobile Phone Number</FormLabel>
                          <FormControl>
                            <input 
                              type="tel" 
                              placeholder="+1 555-123-4567"
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!globalEnabled}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            For SMS notifications (include country code)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  <div className="px-6 pt-2">
                    <h3 className="text-lg font-medium">Alert Type Settings</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Customize notifications for each type of alert
                    </p>

                    <TabsList className="w-full grid grid-cols-3 h-auto">
                      <TabsTrigger 
                        value="alerts" 
                        className="py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                        onClick={() => setActiveTab("alerts")}
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Price Alerts
                      </TabsTrigger>
                      <TabsTrigger 
                        value="orders" 
                        className="py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                        onClick={() => setActiveTab("orders")}
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Order Notifications
                      </TabsTrigger>
                      <TabsTrigger 
                        value="performance" 
                        className="py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                        onClick={() => setActiveTab("performance")}
                      >
                        <BarChart className="h-4 w-4 mr-2" />
                        Performance
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="px-6 pb-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsContent value="alerts" className="mt-0 space-y-4">
                        {/* Price related alerts */}
                        {alertTypes.slice(0, 3).map(alertType => (
                          <AlertTypeSettings 
                            key={alertType.id}
                            alertType={alertType}
                            form={form}
                            disabled={!globalEnabled}
                          />
                        ))}
                      </TabsContent>
                      
                      <TabsContent value="orders" className="mt-0 space-y-4">
                        {/* Order related alerts */}
                        {alertTypes.slice(3, 6).map(alertType => (
                          <AlertTypeSettings 
                            key={alertType.id}
                            alertType={alertType}
                            form={form}
                            disabled={!globalEnabled}
                          />
                        ))}
                      </TabsContent>
                      
                      <TabsContent value="performance" className="mt-0 space-y-4">
                        {/* Performance related alerts */}
                        {alertTypes.slice(6).map(alertType => (
                          <AlertTypeSettings 
                            key={alertType.id}
                            alertType={alertType}
                            form={form}
                            disabled={!globalEnabled}
                          />
                        ))}
                      </TabsContent>
                    </Tabs>

                    <div className="mt-6 flex justify-end">
                      <Button type="submit" disabled={updateSettings.isPending}>
                        {updateSettings.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
                          </>
                        ) : (
                          "Save Settings"
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

// Component for each alert type's settings
const AlertTypeSettings = ({ 
  alertType, 
  form, 
  disabled 
}: { 
  alertType: { id: string, name: string, description: string }, 
  form: ReturnType<typeof useForm<NotificationSettingsFormValues>>,
  disabled: boolean
}) => {
  // Watch the enabled state for this alert type
  const alertEnabled = form.watch(`alertSettings.${alertType.id}.enabled`);
  const isDisabled = disabled || !alertEnabled;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-row items-center justify-between mb-4">
        <div>
          <h4 className="font-medium">{alertType.name}</h4>
          <p className="text-sm text-muted-foreground">{alertType.description}</p>
        </div>
        <FormField
          control={form.control}
          name={`alertSettings.${alertType.id}.enabled`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={disabled}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
      
      <div className="pl-2 space-y-2">
        <div className="text-sm font-medium mb-2">Delivery Channels:</div>
        {deliveryChannels.map(channel => (
          <FormField
            key={channel.id}
            control={form.control}
            name={`alertSettings.${alertType.id}.channels.${channel.id}`}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isDisabled}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="cursor-pointer">
                    {channel.name}
                  </FormLabel>
                  <FormDescription>
                    {channel.description}
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        ))}
      </div>
    </div>
  );
};

export default NotificationSettingsPage;