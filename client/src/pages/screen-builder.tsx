import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScreenNaturalLanguageInput } from '@/components/screen-builder/ScreenNaturalLanguageInput';
import { ScreenForm } from '@/components/screen-builder/ScreenForm';

const ScreenBuilder: React.FC = () => {
  const [activeTab, setActiveTab] = useState("natural-language");
  const [generatedScreen, setGeneratedScreen] = useState<{
    screenCode: string;
    explanation: string;
    defaultName: string;
    defaultDescription: string;
    configuration: any;
  } | null>(null);

  const handleScreenGenerated = (data: {
    screenCode: string;
    explanation: string;
    defaultName: string;
    defaultDescription: string;
    configuration: any;
  }) => {
    setGeneratedScreen(data);
    setActiveTab("review");
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
          <ScreenNaturalLanguageInput 
            onScreenGenerated={handleScreenGenerated}
          />
        </TabsContent>

        <TabsContent value="review" className="pt-4">
          {generatedScreen && (
            <ScreenForm
              screenCode={generatedScreen.screenCode}
              explanation={generatedScreen.explanation}
              configuration={generatedScreen.configuration}
              defaultName={generatedScreen.defaultName}
              defaultDescription={generatedScreen.defaultDescription}
              isNew={true}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScreenBuilder;