import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import NaturalLanguageInput from "@/components/bot-builder/NaturalLanguageInput";
import StrategyForm from "@/components/bot-builder/StrategyForm";
import CodeEditorImproved from "@/components/bot-builder/CodeEditorImproved";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wand2, Blocks, Code } from "lucide-react";

interface GeneratedStrategy {
  strategy: string;
  explanation: string;
  configuration: any;
}

const BotBuilder = () => {
  const [activeTab, setActiveTab] = useState("natural-language");
  const [generatedStrategy, setGeneratedStrategy] = useState<GeneratedStrategy | null>(null);

  const handleStrategyGenerated = (strategy: GeneratedStrategy) => {
    setGeneratedStrategy(strategy);
    // Move to the form tab once we have a generated strategy
    setActiveTab("form");
  };

  return (
    <MainLayout title="Bot Builder">
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="natural-language" className="flex items-center">
              <Wand2 className="mr-2 h-4 w-4" />
              <span>AI Assistant</span>
            </TabsTrigger>
            <TabsTrigger value="visual-builder" className="flex items-center">
              <Blocks className="mr-2 h-4 w-4" />
              <span>Visual Builder</span>
            </TabsTrigger>
            <TabsTrigger value="code" className="flex items-center">
              <Code className="mr-2 h-4 w-4" />
              <span>Code Editor</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="natural-language" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <Card className="col-span-full xl:col-span-3">
                <CardContent className="pt-6">
                  <NaturalLanguageInput onStrategyGenerated={handleStrategyGenerated} />
                </CardContent>
              </Card>

              <Card className="xl:row-span-2">
                <CardHeader>
                  <CardTitle>About AI Strategy Generator</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-medium">How it works</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Our AI analyzes your strategy description and generates executable trading code. You can then customize and backtest this strategy.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium">Tips for better results</h3>
                    <ul className="text-sm text-muted-foreground mt-1 list-disc pl-4 space-y-1">
                      <li>Be specific about entry and exit conditions</li>
                      <li>Mention indicators and parameters you want to use</li>
                      <li>Specify assets and timeframes</li>
                      <li>Include risk management rules</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-medium">Example inputs</h3>
                    <ul className="text-sm text-muted-foreground mt-1 list-disc pl-4 space-y-1">
                      <li>"Buy when RSI is below 30 and sell when above 70"</li>
                      <li>"Create a strategy using MACD and EMA crossovers"</li>
                      <li>"Build a mean reversion strategy for crypto"</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="visual-builder">
            <Card>
              <CardHeader>
                <CardTitle>Visual Strategy Builder</CardTitle>
                <CardDescription>
                  Create strategies by dragging and connecting components
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[600px] flex items-center justify-center border-2 border-dashed rounded-lg">
                <div className="text-center">
                  <Blocks className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium">Visual Builder Coming Soon</h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md">
                    We're working on a drag-and-drop interface for building strategies visually. 
                    In the meantime, try our AI Assistant to generate strategies from descriptions.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="code">
            <CodeEditorImproved />
          </TabsContent>
          
          <TabsContent value="form" className="space-y-4">
            <StrategyForm initialStrategy={generatedStrategy || undefined} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default BotBuilder;
