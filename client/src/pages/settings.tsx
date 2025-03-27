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
import { Loader2, Bell, User, Database, BookOpenCheck, Server, LucideIcon, MonitorSmartphone, Sun, Moon, AlertTriangle, ShoppingCart, BarChart, Info } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { updateData } from "@/lib/api";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";

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
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verificationError, setVerificationError] = useState("");

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
  
  // Check phone verification status on component load
  useEffect(() => {
    const checkPhoneVerification = async () => {
      try {
        const response = await fetch('/api/users/verify-phone/status', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setPhoneVerified(data.verified);
          if (data.phoneNumber) {
            setPhoneNumber(data.phoneNumber);
          }
        }
      } catch (error) {
        console.error('Failed to check phone verification status:', error);
      }
    };
    
    checkPhoneVerification();
  }, []);
  
  // Send verification code
  const handleSendVerification = async () => {
    if (!phoneNumber || phoneNumber.trim() === '') {
      setVerificationError('Please enter a valid phone number');
      return;
    }
    
    // Validate phone number format (E.164 format, starting with + and country code)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      setVerificationError('Please enter a valid phone number in international format (e.g., +12025550123)');
      return;
    }
    
    setVerificationError('');
    setSendingVerification(true);
    
    try {
      console.log('Sending verification to phone number:', phoneNumber);
      
      const response = await fetch('/api/users/verify-phone/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ phoneNumber })
      });
      
      console.log('Verification API response status:', response.status);
      
      const data = await response.json();
      console.log('Verification API response data:', data);
      
      if (response.ok) {
        setVerificationSent(true);
        toast({
          title: "Verification code sent",
          description: "Please check your phone for the verification code",
        });
      } else {
        setVerificationError(data.message || 'Failed to send verification code');
      }
    } catch (error) {
      console.error('Error sending verification code:', error);
      setVerificationError('Network error. Please try again.');
    } finally {
      setSendingVerification(false);
    }
  };
  
  // Verify the code
  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.trim() === '') {
      setVerificationError('Please enter the verification code');
      return;
    }
    
    setVerificationError('');
    setVerifyingCode(true);
    
    try {
      const response = await fetch('/api/users/verify-phone/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ code: verificationCode })
      });
      
      const data = await response.json();
      
      if (response.ok && data.verified) {
        setPhoneVerified(true);
        setVerificationSent(false);
        setVerificationCode('');
        toast({
          title: "Phone verified",
          description: "Your phone number has been verified successfully",
        });
      } else {
        setVerificationError(data.message || 'Invalid verification code');
      }
    } catch (error) {
      setVerificationError('Network error. Please try again.');
      console.error('Error verifying code:', error);
    } finally {
      setVerifyingCode(false);
    }
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
                  <div className="space-y-6">
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
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Mobile Phone</h3>
                      <div className="flex flex-row items-center space-x-4">
                        <input 
                          type="tel" 
                          placeholder="+1 555-123-4567"
                          className="flex h-10 w-64 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                        <Button 
                          variant="outline" 
                          onClick={handleSendVerification}
                          disabled={sendingVerification}
                        >
                          {sendingVerification ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                            </>
                          ) : phoneVerified ? "Verified ✓" : "Verify"}
                        </Button>
                      </div>
                      
                      {verificationSent && !phoneVerified && (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm font-medium">Enter verification code:</p>
                          <div className="flex flex-row items-center space-x-4">
                            <input 
                              type="text" 
                              placeholder="123456"
                              className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={verificationCode}
                              onChange={(e) => setVerificationCode(e.target.value)}
                            />
                            <Button 
                              variant="outline" 
                              onClick={handleVerifyCode}
                              disabled={verifyingCode}
                            >
                              {verifyingCode ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                                </>
                              ) : "Submit"}
                            </Button>
                          </div>
                          <p className="text-xs text-amber-500 bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-800">
                            <Info className="inline h-3 w-3 mr-1" />
                            For testing purposes, you can use "123456" as a verification code while the SMS service is being configured.
                          </p>
                        </div>
                      )}
                      
                      {verificationError && (
                        <p className="text-sm text-red-500">{verificationError}</p>
                      )}
                      
                      <p className="text-sm text-muted-foreground">
                        Add and verify your phone number to receive SMS notifications
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Alert Type Settings</h3>
                      <p className="text-sm text-muted-foreground">
                        Customize notifications for each type of alert
                      </p>
                      
                      <Tabs defaultValue="alerts" className="w-full">
                        <TabsList className="w-full grid grid-cols-3 h-auto">
                          <TabsTrigger 
                            value="alerts" 
                            className="py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                          >
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Price Alerts
                          </TabsTrigger>
                          <TabsTrigger 
                            value="orders" 
                            className="py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Order Notifications
                          </TabsTrigger>
                          <TabsTrigger 
                            value="performance" 
                            className="py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                          >
                            <BarChart className="h-4 w-4 mr-2" />
                            Performance
                          </TabsTrigger>
                        </TabsList>
                      
                        <TabsContent value="alerts" className="mt-4 space-y-4">
                          {/* Price Alert */}
                          <div className="rounded-lg border p-4">
                            <div className="flex flex-row items-center justify-between mb-4">
                              <div>
                                <h4 className="font-medium">Price Alerts</h4>
                                <p className="text-sm text-muted-foreground">Get notified when a stock reaches your target price</p>
                              </div>
                              <Switch defaultChecked />
                            </div>
                            
                            <div className="pl-2 space-y-2">
                              <div className="text-sm font-medium mb-2">Delivery Channels:</div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="price-app" defaultChecked />
                                <label htmlFor="price-app" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  In-App
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="price-email" />
                                <label htmlFor="price-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  Email
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="price-sms" />
                                <label htmlFor="price-sms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  SMS
                                </label>
                              </div>
                            </div>
                          </div>

                          {/* Price Change Alert */}
                          <div className="rounded-lg border p-4">
                            <div className="flex flex-row items-center justify-between mb-4">
                              <div>
                                <h4 className="font-medium">Price Change Alerts</h4>
                                <p className="text-sm text-muted-foreground">Get notified when a stock price changes by a specified percentage</p>
                              </div>
                              <Switch defaultChecked />
                            </div>
                            
                            <div className="pl-2 space-y-2">
                              <div className="text-sm font-medium mb-2">Delivery Channels:</div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="price-change-app" defaultChecked />
                                <label htmlFor="price-change-app" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  In-App
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="price-change-email" />
                                <label htmlFor="price-change-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  Email
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="price-change-sms" />
                                <label htmlFor="price-change-sms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  SMS
                                </label>
                              </div>
                            </div>
                          </div>

                          {/* Volume Alert */}
                          <div className="rounded-lg border p-4">
                            <div className="flex flex-row items-center justify-between mb-4">
                              <div>
                                <h4 className="font-medium">Volume Alerts</h4>
                                <p className="text-sm text-muted-foreground">Get notified when trading volume exceeds your threshold</p>
                              </div>
                              <Switch defaultChecked />
                            </div>
                            
                            <div className="pl-2 space-y-2">
                              <div className="text-sm font-medium mb-2">Delivery Channels:</div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="volume-app" defaultChecked />
                                <label htmlFor="volume-app" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  In-App
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="volume-email" />
                                <label htmlFor="volume-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  Email
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="volume-sms" />
                                <label htmlFor="volume-sms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  SMS
                                </label>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="orders" className="mt-4 space-y-4">
                          {/* Order Placed */}
                          <div className="rounded-lg border p-4">
                            <div className="flex flex-row items-center justify-between mb-4">
                              <div>
                                <h4 className="font-medium">Order Placed</h4>
                                <p className="text-sm text-muted-foreground">Get notified when an order is placed</p>
                              </div>
                              <Switch defaultChecked />
                            </div>
                            
                            <div className="pl-2 space-y-2">
                              <div className="text-sm font-medium mb-2">Delivery Channels:</div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="order-placed-app" defaultChecked />
                                <label htmlFor="order-placed-app" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  In-App
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="order-placed-email" />
                                <label htmlFor="order-placed-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  Email
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="order-placed-sms" />
                                <label htmlFor="order-placed-sms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  SMS
                                </label>
                              </div>
                            </div>
                          </div>

                          {/* Order Filled */}
                          <div className="rounded-lg border p-4">
                            <div className="flex flex-row items-center justify-between mb-4">
                              <div>
                                <h4 className="font-medium">Order Filled</h4>
                                <p className="text-sm text-muted-foreground">Get notified when an order is filled</p>
                              </div>
                              <Switch defaultChecked />
                            </div>
                            
                            <div className="pl-2 space-y-2">
                              <div className="text-sm font-medium mb-2">Delivery Channels:</div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="order-filled-app" defaultChecked />
                                <label htmlFor="order-filled-app" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  In-App
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="order-filled-email" />
                                <label htmlFor="order-filled-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  Email
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="order-filled-sms" />
                                <label htmlFor="order-filled-sms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  SMS
                                </label>
                              </div>
                            </div>
                          </div>

                          {/* Order Rejected */}
                          <div className="rounded-lg border p-4">
                            <div className="flex flex-row items-center justify-between mb-4">
                              <div>
                                <h4 className="font-medium">Order Rejected</h4>
                                <p className="text-sm text-muted-foreground">Get notified when an order is rejected</p>
                              </div>
                              <Switch defaultChecked />
                            </div>
                            
                            <div className="pl-2 space-y-2">
                              <div className="text-sm font-medium mb-2">Delivery Channels:</div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="order-rejected-app" defaultChecked />
                                <label htmlFor="order-rejected-app" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  In-App
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="order-rejected-email" />
                                <label htmlFor="order-rejected-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  Email
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="order-rejected-sms" />
                                <label htmlFor="order-rejected-sms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  SMS
                                </label>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="performance" className="mt-4 space-y-4">
                          {/* Backtest Finished */}
                          <div className="rounded-lg border p-4">
                            <div className="flex flex-row items-center justify-between mb-4">
                              <div>
                                <h4 className="font-medium">Backtest Finished</h4>
                                <p className="text-sm text-muted-foreground">Get notified when a backtest is finished</p>
                              </div>
                              <Switch defaultChecked />
                            </div>
                            
                            <div className="pl-2 space-y-2">
                              <div className="text-sm font-medium mb-2">Delivery Channels:</div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="backtest-app" defaultChecked />
                                <label htmlFor="backtest-app" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  In-App
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="backtest-email" />
                                <label htmlFor="backtest-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  Email
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="backtest-sms" />
                                <label htmlFor="backtest-sms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  SMS
                                </label>
                              </div>
                            </div>
                          </div>

                          {/* Strategy Performance */}
                          <div className="rounded-lg border p-4">
                            <div className="flex flex-row items-center justify-between mb-4">
                              <div>
                                <h4 className="font-medium">Strategy Performance</h4>
                                <p className="text-sm text-muted-foreground">Get notified about your strategy's performance</p>
                              </div>
                              <Switch defaultChecked />
                            </div>
                            
                            <div className="pl-2 space-y-2">
                              <div className="text-sm font-medium mb-2">Delivery Channels:</div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="strategy-app" defaultChecked />
                                <label htmlFor="strategy-app" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  In-App
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="strategy-email" />
                                <label htmlFor="strategy-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  Email
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="strategy-sms" />
                                <label htmlFor="strategy-sms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  SMS
                                </label>
                              </div>
                            </div>
                          </div>

                          {/* Market Events */}
                          <div className="rounded-lg border p-4">
                            <div className="flex flex-row items-center justify-between mb-4">
                              <div>
                                <h4 className="font-medium">Market Events</h4>
                                <p className="text-sm text-muted-foreground">Get notified about important market events (market open/close, earnings, etc.)</p>
                              </div>
                              <Switch defaultChecked />
                            </div>
                            
                            <div className="pl-2 space-y-2">
                              <div className="text-sm font-medium mb-2">Delivery Channels:</div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="market-app" defaultChecked />
                                <label htmlFor="market-app" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  In-App
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="market-email" />
                                <label htmlFor="market-email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  Email
                                </label>
                              </div>
                              <div className="flex flex-row items-center space-x-3 space-y-0">
                                <Checkbox id="market-sms" />
                                <label htmlFor="market-sms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                  SMS
                                </label>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>

                    <div className="flex justify-end">
                      <Button className="mt-2">
                        Save Notification Settings
                      </Button>
                    </div>
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
                            <SelectItem value="alphavantage">AlphaVantage</SelectItem>
                            <SelectItem value="tiingo">Tiingo</SelectItem>
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
                            <SelectItem value="alphavantage">AlphaVantage</SelectItem>
                            <SelectItem value="tiingo">Tiingo</SelectItem>
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
