import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Wand2 } from "lucide-react";
import { postData } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface NaturalLanguageInputProps {
  onStrategyGenerated: (strategy: {
    strategy: string;
    explanation: string;
    configuration: any;
  }) => void;
}

interface Examples {
  title: string;
  description: string;
  prompt: string;
}

const NaturalLanguageInput = ({ onStrategyGenerated }: NaturalLanguageInputProps) => {
  const [prompt, setPrompt] = useState("");
  const { toast } = useToast();

  const examplePrompts: Examples[] = [
    {
      title: "Moving Average Crossover",
      description: "A trend-following strategy based on moving average crossovers",
      prompt: "Create a strategy that buys when the 10-day moving average crosses above the 30-day moving average and sells when it crosses below."
    },
    {
      title: "RSI Oscillator",
      description: "A mean-reversion strategy using the RSI indicator",
      prompt: "Build a strategy that buys when RSI goes below 30 (oversold) and sells when it goes above 70 (overbought). Use a 14-day period for RSI calculation."
    },
    {
      title: "MACD Momentum",
      description: "A momentum strategy based on MACD signals",
      prompt: "Develop a strategy that buys when the MACD line crosses above the signal line and sells when it crosses below. Use standard parameters (12, 26, 9)."
    }
  ];

  const generateStrategy = useMutation({
    mutationFn: (promptText: string) => 
      postData('/api/bot-builder/generate', { prompt: promptText }),
    onSuccess: (data) => {
      toast({
        title: "Strategy generated",
        description: "Your trading strategy has been successfully created",
      });
      onStrategyGenerated(data);
    },
    onError: (error: any) => {
      console.error("Strategy generation error:", error);
      const errorMessage = error?.response?.data?.message || 
                          (error instanceof Error ? error.message : "Failed to generate strategy");
      
      // Check if it's an API key issue
      const isApiKeyIssue = errorMessage.toLowerCase().includes("api key") || 
                            errorMessage.toLowerCase().includes("authentication");
      
      toast({
        title: "Generation failed",
        description: isApiKeyIssue 
          ? "OpenAI API key is invalid or missing. Please contact an administrator."
          : errorMessage,
        variant: "destructive",
      });
    }
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast({
        title: "Empty prompt",
        description: "Please describe your trading strategy",
        variant: "destructive",
      });
      return;
    }
    
    generateStrategy.mutate(prompt);
  };

  const selectExample = (examplePrompt: string) => {
    setPrompt(examplePrompt);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">AI Strategy Generator</CardTitle>
        <CardDescription>
          Describe your trading strategy in plain English and our AI will convert it into code
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Textarea
            placeholder="For example: Create a strategy that buys when the price breaks above the 50-day high and sells after a 20% profit or 10% loss..."
            className="min-h-32 resize-none"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          
          <div>
            <h4 className="text-sm font-medium mb-2">Example prompts:</h4>
            <div className="grid gap-2 md:grid-cols-3">
              {examplePrompts.map((example, index) => (
                <Card 
                  key={index} 
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => selectExample(example.prompt)}
                >
                  <CardContent className="p-4">
                    <h5 className="font-medium">{example.title}</h5>
                    <p className="text-xs text-muted-foreground">{example.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="secondary" 
          onClick={() => setPrompt("")}
          disabled={!prompt || generateStrategy.isPending}
        >
          Clear
        </Button>
        <Button 
          onClick={handleGenerate}
          disabled={!prompt || generateStrategy.isPending}
        >
          {generateStrategy.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" /> Generate Strategy
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default NaturalLanguageInput;
