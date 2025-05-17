import React, { useState } from 'react';
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Save, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { ScreenCodeEditor } from './ScreenCodeEditor';

interface ScreenFormProps {
  screenCode: string;
  explanation: string;
  configuration: any;
  defaultName: string;
  defaultDescription: string;
  isNew: boolean;
  id?: number;
}

// All stock lists/universes have been removed - universe is defined in the code itself

export const ScreenForm: React.FC<ScreenFormProps> = ({
  screenCode,
  explanation,
  configuration,
  defaultName,
  defaultDescription,
  isNew,
  id
}) => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);
  const [code, setCode] = useState(screenCode);
  const [activeTab, setActiveTab] = useState('code');
  const [saving, setSaving] = useState(false);
  const [currentExplanation, setCurrentExplanation] = useState<string>(explanation || '');
  
  // Assets selection has been removed - universe is defined in the code itself

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Name Required",
        description: "Please provide a name for your screen.",
        variant: "destructive",
      });
      return;
    }

    if (!code.trim()) {
      toast({
        title: "Code Required",
        description: "Screen code cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    
    try {
      const screenData = {
        name,
        description,
        type: 'python',
        source: {
          type: 'code',
          content: code,
          language: 'python'
        }
        // assets field removed - universe should be defined in the code itself
      };
      
      let response;
      if (isNew) {
        response = await apiRequest(
          '/api/screeners', 
          { method: 'POST' },
          screenData
        );
      } else {
        response = await apiRequest(
          `/api/screeners/${id}`, 
          { method: 'PUT' },
          screenData
        );
      }
      
      toast({
        title: "Success",
        description: isNew ? "Screen created successfully." : "Screen updated successfully.",
      });
      
      navigate("/screens");
    } catch (error) {
      console.error("Failed to save screen:", error);
      toast({
        title: "Error",
        description: "Failed to save the screen. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExplainScreen = async () => {
    if (!code.trim()) {
      toast({
        title: "Code Required",
        description: "There's no code to explain.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Fix: Pass code as the third parameter
      const result = await apiRequest('/api/screen-builder/explain', 
        { method: 'POST' },
        { code }
      );
      
      if (result && result.explanation) {
        // Update the explanation state with the generated explanation
        setCurrentExplanation(result.explanation);
        // Switch to the explanation tab
        setActiveTab('explanation');
        
        toast({
          title: "Explanation Generated",
          description: "The explanation for your screen code has been generated successfully.",
        });
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Failed to explain screen:", error);
      toast({
        title: "Explanation Failed",
        description: "There was an error explaining the screen code. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Screen Details</CardTitle>
              <CardDescription>
                Provide basic information about your stock screening strategy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Stock Screener"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A brief description of what this screen does and when to use it."
                  rows={3}
                />
              </div>
              
              {/* Assets selection removed - universe should be defined in the code itself */}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Explanation</CardTitle>
              <CardDescription>
                Understanding how your screen works
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentExplanation ? (
                <div className="prose prose-sm max-w-none">
                  <p>{currentExplanation}</p>
                </div>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>No Explanation Available</AlertTitle>
                  <AlertDescription>
                    For AI-generated screens, an explanation is automatically provided. 
                    For custom screens, you can request an explanation by clicking the button below.
                  </AlertDescription>
                </Alert>
              )}
              
              {!currentExplanation && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={handleExplainScreen}
                >
                  Generate Explanation
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div>
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Screen Implementation</CardTitle>
              <CardDescription>
                Python code for your stock screen
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <TabsList>
                  <TabsTrigger value="code">Python Code</TabsTrigger>
                  <TabsTrigger value="explanation">Explanation</TabsTrigger>
                </TabsList>
                
                <TabsContent value="code" className="flex-grow">
                  <ScreenCodeEditor 
                    code={code}
                    onChange={setCode}
                  />
                </TabsContent>
                
                <TabsContent value="explanation">
                  <div className="prose prose-sm max-w-none p-4 bg-secondary/50 rounded-md">
                    <p>{currentExplanation || "No explanation available. Click 'Generate Explanation' to analyze this screen."}</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <div className="flex justify-end">
        <Button type="button" onClick={() => navigate("/screens")} variant="outline" className="mr-2">
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Screen
            </>
          )}
        </Button>
      </div>
    </div>
  );
};