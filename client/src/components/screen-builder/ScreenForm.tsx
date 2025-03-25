import { useState } from "react";
import { useNavigate } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Save } from "lucide-react";
import { postData } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { MultiSelect } from "@/components/ui/multi-select";
import ScreenCodeEditor from "./ScreenCodeEditor";

interface ScreenFormProps {
  initialScreen?: {
    screen: string;
    explanation: string;
    configuration: any;
  };
}

const formSchema = z.object({
  name: z.string().min(3, {
    message: "Name must be at least 3 characters.",
  }),
  description: z.string().min(5, {
    message: "Description must be at least 5 characters.",
  }),
  type: z.string().default("custom"),
  universe: z.array(z.string()).min(1, {
    message: "Select at least one asset to include in the screen.",
  }),
  code: z.string().min(10, {
    message: "Code must be at least 10 characters.",
  }),
  language: z.enum(["python", "javascript"]).default("python"),
});

type FormValues = z.infer<typeof formSchema>;

const defaultStocks = [
  "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "NVDA", 
  "JPM", "BAC", "WMT", "PG", "JNJ", "UNH", "HD", "V", "MA",
  "DIS", "NFLX", "INTC", "AMD", "CSCO", "ADBE", "CRM", "PYPL"
];

const ScreenForm = ({ initialScreen }: ScreenFormProps) => {
  const [code, setCode] = useState(initialScreen?.screen || "");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Parse potential stocks from configuration
  const configuredStocks = initialScreen?.configuration?.universe || 
                          initialScreen?.configuration?.assets || 
                          defaultStocks;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialScreen?.configuration?.name || "My Custom Screen",
      description: initialScreen?.explanation || "",
      type: "custom",
      universe: configuredStocks,
      code: initialScreen?.screen || "",
      language: "python",
    },
  });

  const saveScreener = useMutation({
    mutationFn: (data: FormValues) => {
      // Prepare data structure that matches our API
      const screenerData = {
        name: data.name,
        description: data.description,
        type: data.type,
        configuration: {
          universe: data.universe,
          parameters: {},
        },
        source: {
          type: "code",
          content: data.code,
          language: data.language
        }
      };
      
      return postData('/api/screeners', screenerData);
    },
    onSuccess: () => {
      toast({
        title: "Screen saved",
        description: "Your screen has been successfully saved",
      });
      // Navigate to the screens page after saving
      navigate("/screens");
    },
    onError: (error: any) => {
      console.error("Error saving screen:", error);
      toast({
        title: "Save failed",
        description: error?.response?.data?.message || "Failed to save screen",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (values: FormValues) => {
    // Update the code field with the latest code from the editor
    values.code = code;
    saveScreener.mutate(values);
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    form.setValue("code", newCode);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Save Your Stock Screen</CardTitle>
        <CardDescription>
          Review and customize your screen before saving it
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Screen Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter a name for your screen" {...field} />
                    </FormControl>
                    <FormDescription>
                      A descriptive name to identify your screen
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Screen Type</FormLabel>
                    <FormControl>
                      <Input value="custom" disabled {...field} />
                    </FormControl>
                    <FormDescription>
                      The type of screen (custom is default)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe what this screen is looking for..." 
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    A detailed description of what the screen does and how it works
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="universe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Universe of Assets</FormLabel>
                  <FormControl>
                    <MultiSelect
                      selected={field.value}
                      setSelected={(values) => field.onChange(values)}
                      options={defaultStocks.map(stock => ({
                        value: stock,
                        label: stock
                      }))}
                      placeholder="Select stocks to include in your screen"
                      creatable
                    />
                  </FormControl>
                  <FormDescription>
                    The stocks that will be considered by this screen
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Language</FormLabel>
                  <FormControl>
                    <Input value="python" disabled {...field} />
                  </FormControl>
                  <FormDescription>
                    The programming language used for this screen
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="code"
              render={() => (
                <FormItem>
                  <FormLabel>Screen Code</FormLabel>
                  <FormControl>
                    <div className="min-h-[400px] border rounded-md">
                      <ScreenCodeEditor 
                        initialCode={code} 
                        onChange={handleCodeChange} 
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    The Python code that implements your screen
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <CardFooter className="px-0 pt-4">
              <Button 
                type="submit" 
                className="ml-auto"
                disabled={saveScreener.isPending}
              >
                {saveScreener.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Save Screen
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default ScreenForm;