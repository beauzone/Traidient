import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScreenNaturalLanguageInput } from '@/components/screen-builder/ScreenNaturalLanguageInput';
import { ScreenForm } from '@/components/screen-builder/ScreenForm';
import MainLayout from "@/components/layout/MainLayout";
import { ScreenerNav } from '@/components/ScreenerNav';
import { PageHeader } from '@/components/PageHeader';

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
    <MainLayout title="Screen Builder">
      <PageHeader
        title="Screen Builder"
        description="Create custom stock screens using AI assistance"
      />
      
      <ScreenerNav />

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
    </MainLayout>
  );
};

export default ScreenBuilder;