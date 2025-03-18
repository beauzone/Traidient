import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { postData } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const strategySchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters" }),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }),
  type: z.enum(["ai-generated", "template", "custom"]),
  source: z.object({
    type: z.enum(["natural-language", "visual-builder", "code"]),
    content: z.string().min(1, { message: "Strategy content is required" }),
  }),
  configuration: z.object({
    assets: z.array(z.string()).min(1, { message: "At least one asset is required" }),
    parameters: z.record(z.any()),
    riskControls: z.object({
      maxPositionSize: z.number().min(0),
      stopLoss: z.number().min(0),
      takeProfit: z.number().min(0),
    }),
    schedule: z.object({
      isActive: z.boolean(),
      timezone: z.string(),
      activeDays: z.array(z.number()),
      activeHours: z.object({
        start: z.string(),
        end: z.string(),
      }),
    }),
  }),
});

type StrategyFormValues = z.infer<typeof strategySchema>;

interface StrategyFormProps {
  initialStrategy?: {
    strategy: string;
    explanation: string;
    configuration: any;
  };
}

const StrategyForm = ({ initialStrategy }: StrategyFormProps) => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("basic");
  const [assetInput, setAssetInput] = useState("");
  
  // Prepare default values
  const defaultValues: StrategyFormValues = {
    name: "",
    description: initialStrategy?.explanation || "",
    type: "ai-generated",
    source: {
      type: "natural-language",
      content: initialStrategy?.strategy || "",
    },
    configuration: {
      assets: ["AAPL"],
      parameters: initialStrategy?.configuration || {},
      riskControls: {
        maxPositionSize: 10,
        stopLoss: 5,
        takeProfit: 15,
      },
      schedule: {
        isActive: true,
        timezone: "America/New_York",
        activeDays: [1, 2, 3, 4, 5], // Monday to Friday
        activeHours: {
          start: "09:30",
          end: "16:00",
        },
      },
    },
  };

  const form = useForm<StrategyFormValues>({
    resolver: zodResolver(strategySchema),
    defaultValues,
  });

  const createStrategy = useMutation({
    mutationFn: (data: StrategyFormValues) => postData('/api/strategies', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/strategies'] });
      toast({
        title: "Strategy created",
        description: "Your strategy has been saved successfully.",
      });
      navigate("/strategies");
    },
    onError: (error) => {
      toast({
        title: "Failed to create strategy",
        description: error instanceof Error ? error.message : "An error occurred.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (values: StrategyFormValues) => {
    createStrategy.mutate(values);
  };

  const addAsset = () => {
    if (!assetInput) return;
    
    const assets = form.getValues("configuration.assets");
    if (!assets.includes(assetInput.toUpperCase())) {
      form.setValue("configuration.assets", [...assets, assetInput.toUpperCase()]);
    }
    setAssetInput("");
  };

  const removeAsset = (asset: string) => {
    const assets = form.getValues("configuration.assets");
    form.setValue(
      "configuration.assets",
      assets.filter((a) => a !== asset)
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Configure Your Strategy</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 mb-8">
            <TabsTrigger value="basic">Basic Information</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="risk">Risk Management</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>
          
          <Form {...form}>
            <form id="strategy-form" onSubmit={form.handleSubmit(onSubmit)}>
              <TabsContent value="basic" className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Strategy Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter a strategy name" {...field} />
                      </FormControl>
                      <FormDescription>
                        Choose a descriptive name for your strategy
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe what your strategy does" 
                          className="min-h-32"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Explain how your strategy works, when it trades, etc.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="source.content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Strategy Code</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Your strategy code will appear here" 
                          className="min-h-64 font-mono text-sm"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        This code implements your trading strategy
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button type="button" onClick={() => setActiveTab("assets")}>
                    Next: Assets
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="assets" className="space-y-6">
                <FormItem>
                  <FormLabel>Trading Assets</FormLabel>
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Add asset (e.g. AAPL, BTC)"
                      value={assetInput}
                      onChange={(e) => setAssetInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addAsset();
                        }
                      }}
                    />
                    <Button type="button" onClick={addAsset}>
                      Add
                    </Button>
                  </div>
                  <FormDescription>
                    Add the assets you want this strategy to trade
                  </FormDescription>
                  <FormMessage />
                </FormItem>

                <div>
                  <h4 className="text-sm font-medium mb-2">Selected Assets:</h4>
                  <div className="flex flex-wrap gap-2">
                    {form.watch("configuration.assets").map((asset) => (
                      <div
                        key={asset}
                        className="bg-primary bg-opacity-10 text-primary px-3 py-1 rounded-full flex items-center"
                      >
                        <span>{asset}</span>
                        <button
                          type="button"
                          className="ml-2 text-primary hover:text-primary/80"
                          onClick={() => removeAsset(asset)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={() => setActiveTab("basic")}>
                    Back
                  </Button>
                  <Button type="button" onClick={() => setActiveTab("risk")}>
                    Next: Risk Management
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="risk" className="space-y-6">
                <FormField
                  control={form.control}
                  name="configuration.riskControls.maxPositionSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Position Size (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          max="100" 
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Maximum percentage of portfolio to allocate to a single position
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="configuration.riskControls.stopLoss"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stop Loss (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Percentage loss at which to exit a position
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="configuration.riskControls.takeProfit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Take Profit (%)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Percentage gain at which to exit a position
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={() => setActiveTab("assets")}>
                    Back
                  </Button>
                  <Button type="button" onClick={() => setActiveTab("schedule")}>
                    Next: Schedule
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-6">
                <FormField
                  control={form.control}
                  name="configuration.schedule.isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-4 w-4"
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Activate Schedule</FormLabel>
                      <FormDescription>
                        Enable or disable schedule for this strategy
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="configuration.schedule.timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                          <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                          <SelectItem value="UTC">UTC</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Active Days</FormLabel>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { value: 0, label: "Sun" },
                      { value: 1, label: "Mon" },
                      { value: 2, label: "Tue" },
                      { value: 3, label: "Wed" },
                      { value: 4, label: "Thu" },
                      { value: 5, label: "Fri" },
                      { value: 6, label: "Sat" },
                    ].map((day) => {
                      const activeDays = form.watch("configuration.schedule.activeDays");
                      const isActive = activeDays.includes(day.value);
                      
                      return (
                        <Button
                          key={day.value}
                          type="button"
                          variant={isActive ? "default" : "outline"}
                          className="h-9 w-12"
                          onClick={() => {
                            if (isActive) {
                              form.setValue(
                                "configuration.schedule.activeDays",
                                activeDays.filter((d) => d !== day.value)
                              );
                            } else {
                              form.setValue(
                                "configuration.schedule.activeDays",
                                [...activeDays, day.value].sort()
                              );
                            }
                          }}
                        >
                          {day.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="configuration.schedule.activeHours.start"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="configuration.schedule.activeHours.end"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={() => setActiveTab("risk")}>
                    Back
                  </Button>
                  <Button type="submit" disabled={createStrategy.isPending}>
                    {createStrategy.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" /> Save Strategy
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </form>
          </Form>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-4">
        <Button variant="outline" onClick={() => navigate("/strategies")}>
          Cancel
        </Button>
        {activeTab !== "schedule" && (
          <Button type="submit" form="strategy-form" disabled={createStrategy.isPending}>
            {createStrategy.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Strategy
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default StrategyForm;
