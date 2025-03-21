import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Bell, User, Database, BookOpenCheck, Server, LucideIcon, MonitorSmartphone, Sun, Moon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { updateData } from "@/lib/api";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

const profileSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface TabDefinition {
  id: string;
  name: string;
  icon: LucideIcon;
}

const SettingsPage = () => {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");

  const tabs: TabDefinition[] = [
    { id: "general", name: "General", icon: User },
    { id: "notifications", name: "Notifications", icon: Bell },
    { id: "dataProviders", name: "Data Providers", icon: Database },
    { id: "tradeData", name: "Trade Data", icon: BookOpenCheck },
    { id: "accountData", name: "Account Data", icon: Server },
  ];

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
    },
  });

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: (data: ProfileFormValues) => updateData('/api/users/profile', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      updateUser(data);
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update profile",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (values: ProfileFormValues) => {
    updateProfile.mutate(values);
  };

  return (
    <MainLayout title="Settings">
      <div className="max-w-5xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Settings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="px-6 pb-3">
                <TabsList className="w-full grid grid-cols-5 h-auto">
                  {tabs.map((tab) => (
                    <TabsTrigger 
                      key={tab.id} 
                      value={tab.id}
                      className="py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                    >
                      <tab.icon className="h-4 w-4 mr-2" />
                      {tab.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="p-6 border-t">
                {/* General Settings Tab */}
                <TabsContent value="general" className="mt-0 space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Display</h3>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h4 className="font-medium">Theme</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="border rounded-md p-4 flex items-center justify-center space-x-2 cursor-pointer hover:bg-primary/5 data-[state=active]:bg-primary/10 data-[state=active]:border-primary">
                            <Sun className="h-5 w-5 mr-2" />
                            <span>Light</span>
                          </div>
                          <div className="border rounded-md p-4 flex items-center justify-center space-x-2 cursor-pointer hover:bg-primary/5 bg-primary/10 border-primary">
                            <Moon className="h-5 w-5 mr-2" />
                            <span>Dark</span>
                          </div>
                        </div>
                      </div>
                    
                      <div className="space-y-2">
                        <h4 className="font-medium">Default Currency</h4>
                        <Select defaultValue="usd">
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="usd">US Dollar ($)</SelectItem>
                            <SelectItem value="eur">Euro (€)</SelectItem>
                            <SelectItem value="gbp">British Pound (£)</SelectItem>
                            <SelectItem value="jpy">Japanese Yen (¥)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Profile Information</h3>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Your name" {...field} />
                              </FormControl>
                              <FormDescription>
                                This is your public display name
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="Your email" {...field} />
                              </FormControl>
                              <FormDescription>
                                Your email address for notifications and updates
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" disabled={updateProfile.isPending}>
                          {updateProfile.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
                            </>
                          ) : (
                            "Save Profile"
                          )}
                        </Button>
                      </form>
                    </Form>
                  </div>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications" className="mt-0 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Notification Preferences</h3>
                    <p className="text-sm text-muted-foreground">
                      Control which notifications you receive and how they are delivered.
                      Configure per-alert type settings including channel selection (in-app, email, SMS).
                    </p>
                    
                    <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <div className="text-base font-medium">
                          Enable All Notifications
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Quickly toggle all notifications on or off
                        </div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    
                    <Link href="/notification-settings">
                      <Button className="mt-2">
                        <Bell className="mr-2 h-4 w-4" />
                        Manage Detailed Notification Settings
                      </Button>
                    </Link>
                  </div>
                </TabsContent>

                {/* Data Providers Tab */}
                <TabsContent value="dataProviders" className="mt-0 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Market Data Providers</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure your preferred market data sources for quotes, historical data, and backtesting.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">Default Backtest Data Provider</h4>
                        <Select defaultValue="yahoo">
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="alpaca">Alpaca</SelectItem>
                            <SelectItem value="yahoo">Yahoo Finance</SelectItem>
                            <SelectItem value="polygon">Polygon.io</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-medium">Real-time Market Data</h4>
                        <Select defaultValue="alpaca">
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="alpaca">Alpaca</SelectItem>
                            <SelectItem value="polygon">Polygon.io</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <Button className="mt-2">
                      <Database className="mr-2 h-4 w-4" />
                      Manage API Integrations
                    </Button>
                  </div>
                </TabsContent>

                {/* Trade Data Tab */}
                <TabsContent value="tradeData" className="mt-0 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Trade Data Settings</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure settings related to your trading data, including order handling and reporting.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <div className="text-base font-medium">
                            Order Confirmations
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Show confirmation dialogs before placing orders
                          </div>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      
                      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <div className="text-base font-medium">
                            Export Trade History
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Enable automatic export of trade history for tax reporting
                          </div>
                        </div>
                        <Switch />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Account Data Tab */}
                <TabsContent value="accountData" className="mt-0 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Account Data Settings</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure settings for your trading accounts and brokerage connections.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">Default Trading Account</h4>
                        <Select defaultValue="alpaca-paper">
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="alpaca-paper">Alpaca Paper Trading</SelectItem>
                            <SelectItem value="alpaca-live">Alpaca Live Trading</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <div className="text-base font-medium">
                            Auto-refresh Account Data
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Automatically refresh account balances and positions
                          </div>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    </div>
                    
                    <Button className="mt-2">
                      <Server className="mr-2 h-4 w-4" />
                      Manage Broker Connections
                    </Button>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default SettingsPage;
