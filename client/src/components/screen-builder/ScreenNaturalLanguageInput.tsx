import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ScreenNaturalLanguageInputProps {
  onScreenGenerated: (data: {
    screenCode: string;
    explanation: string;
    defaultName: string;
    defaultDescription: string;
    configuration: any;
  }) => void;
}

export const ScreenNaturalLanguageInput: React.FC<ScreenNaturalLanguageInputProps> = ({
  onScreenGenerated
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    if (error) setError(null);
  };

  const handleGenerateScreen = async () => {
    if (!prompt.trim()) {
      setError('Please enter a description of the screen you want to create.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await apiRequest('/api/screen-builder/generate', {
        method: 'POST',
        data: { prompt }
      });
      
      if (result && result.screenCode) {
        toast({
          title: "Screen Generated",
          description: "Your screen has been generated successfully. Review and save it.",
        });
        
        onScreenGenerated({
          screenCode: result.screenCode,
          explanation: result.explanation || '',
          defaultName: result.name || 'My Generated Screen',
          defaultDescription: result.description || '',
          configuration: result.configuration || {}
        });
      } else {
        throw new Error("Invalid response from the server");
      }
    } catch (err) {
      console.error("Error generating screen:", err);
      setError("Failed to generate screen. Please try a different description or try again later.");
      toast({
        title: "Generation Failed",
        description: "There was an error generating your screen. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const examplePrompts = [
    "Create a screen to find stocks with strong momentum and increasing volume",
    "Find stocks that are breaking out of a consolidation pattern with high relative strength",
    "Screen for stocks that are oversold based on RSI with bullish MACD crossovers",
    "Identify potential reversal candidates using Bollinger Bands and Keltner Channels",
    "Find value stocks with low P/E ratios and high dividend yields"
  ];

  const handleUseExample = (example: string) => {
    setPrompt(example);
    if (error) setError(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate a Stock Screen</CardTitle>
          <CardDescription>
            Describe the stock screen you want to create in natural language, and our AI will generate the Python code for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Screen Description</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={handlePromptChange}
              placeholder="Describe the stock screen you want to create. For example: Find stocks with strong momentum and increasing volume."
              rows={6}
              className="resize-none"
            />
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          
          <div>
            <p className="text-sm font-medium mb-2">Example prompts:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {examplePrompts.map((example, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs justify-start h-auto py-2 text-left"
                  onClick={() => handleUseExample(example)}
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button
              onClick={handleGenerateScreen}
              disabled={loading || !prompt.trim()}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Screen
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-lg mb-2">1. Describe</h3>
                <p className="text-sm text-muted-foreground">
                  Tell us what kind of stocks you're looking for in plain English.
                </p>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-lg mb-2">2. Generate</h3>
                <p className="text-sm text-muted-foreground">
                  Our AI creates a Python-based screen tailored to your requirements.
                </p>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-lg mb-2">3. Customize</h3>
                <p className="text-sm text-muted-foreground">
                  Review the generated code, make changes if needed, and save your screen.
                </p>
              </div>
            </div>
            
            <Alert>
              <AlertTitle>Tips for better results</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Be specific about technical indicators you want to use (RSI, MACD, Bollinger Bands, etc.)</li>
                  <li>Mention timeframes if they're important (daily, weekly, intraday)</li>
                  <li>Include threshold values when relevant (e.g., "RSI below 30" rather than just "low RSI")</li>
                  <li>Specify whether you're looking for bullish or bearish setups</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};