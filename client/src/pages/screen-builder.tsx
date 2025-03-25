import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ScreenNaturalLanguageInput } from '@/components/screen-builder/ScreenNaturalLanguageInput';
import { ScreenForm } from '@/components/screen-builder/ScreenForm';
import { ScreenCodeEditor } from '@/components/screen-builder/ScreenCodeEditor';
import { apiRequest } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';

interface GeneratedScreen {
  screen: string;
  explanation: string;
  configuration: any;
}

const ScreenBuilder: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("natural-language");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedScreen, setGeneratedScreen] = useState<GeneratedScreen | null>(null);
  const [naturalLanguageInput, setNaturalLanguageInput] = useState("");

  const handleInputChange = (value: string) => {
    setNaturalLanguageInput(value);
  };

  const generateScreen = async () => {
    if (!naturalLanguageInput.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter a description of the screen you want to create.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await apiRequest('/api/screen-builder/generate', {
        method: 'POST',
        data: { prompt: naturalLanguageInput }
      });
      
      setGeneratedScreen(result);
      setActiveTab("review");
      toast({
        title: "Screen Generated",
        description: "Your screen has been successfully created!",
      });
    } catch (error) {
      console.error("Failed to generate screen:", error);
      toast({
        title: "Generation Failed",
        description: "There was an error generating your screen. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Screen Builder</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="natural-language">Natural Language</TabsTrigger>
          <TabsTrigger value="review" disabled={!generatedScreen}>Review & Save</TabsTrigger>
        </TabsList>

        <TabsContent value="natural-language" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Create a Screen with AI</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ScreenNaturalLanguageInput
                value={naturalLanguageInput}
                onChange={handleInputChange}
              />
              <Button 
                onClick={generateScreen} 
                className="w-full"
                disabled={isGenerating || !naturalLanguageInput.trim()}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Screen...
                  </>
                ) : (
                  "Generate Screen"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="pt-4">
          {generatedScreen && (
            <ScreenForm
              screenCode={generatedScreen.screen}
              explanation={generatedScreen.explanation}
              configuration={generatedScreen.configuration}
              defaultName=""
              defaultDescription=""
              isNew={true}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScreenBuilder;