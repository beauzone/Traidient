import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Plus, RotateCcw, Save, Grid2x2, X, ChevronDown, ChevronUp } from "lucide-react";
import WidgetContainer, { WidgetConfig } from "./WidgetContainer";
import { WIDGET_DEFINITIONS } from "./WidgetLibrary";
import { useToast } from "@/hooks/use-toast";

interface CustomizableDashboardProps {
  dashboardType: 'main' | 'performance';
  data: any;
  className?: string;
}

// Default layouts for different dashboard types
const DEFAULT_LAYOUTS = {
  main: [
    { id: 'portfolio-value', title: 'Portfolio Value', type: 'portfolio-value', size: 'medium' as const, position: { x: 0, y: 0 }, enabled: true },
    { id: 'daily-pnl', title: 'Daily P&L', type: 'daily-pnl', size: 'medium' as const, position: { x: 2, y: 0 }, enabled: true },
    { id: 'portfolio-chart', title: 'Portfolio Chart', type: 'portfolio-chart', size: 'large' as const, position: { x: 0, y: 1 }, enabled: true },
    { id: 'top-performers', title: 'Top Performers', type: 'top-performers', size: 'medium' as const, position: { x: 3, y: 1 }, enabled: true },
    { id: 'strategies', title: 'Active Strategies', type: 'strategies', size: 'medium' as const, position: { x: 0, y: 3 }, enabled: true }
  ],
  performance: [
    { id: 'portfolio-value', title: 'Portfolio Value', type: 'portfolio-value', size: 'medium' as const, position: { x: 0, y: 0 }, enabled: true },
    { id: 'daily-pnl', title: 'Daily P&L', type: 'daily-pnl', size: 'medium' as const, position: { x: 2, y: 0 }, enabled: true },
    { id: 'win-rate', title: 'Win Rate', type: 'win-rate', size: 'small' as const, position: { x: 4, y: 0 }, enabled: true },
    { id: 'sharpe-ratio', title: 'Sharpe Ratio', type: 'sharpe-ratio', size: 'small' as const, position: { x: 5, y: 0 }, enabled: true },
    { id: 'portfolio-chart', title: 'Portfolio Chart', type: 'portfolio-chart', size: 'large' as const, position: { x: 0, y: 1 }, enabled: true },
    { id: 'risk-metrics', title: 'Risk Metrics', type: 'risk-metrics', size: 'medium' as const, position: { x: 3, y: 1 }, enabled: true },
    { id: 'top-performers', title: 'Top Performers', type: 'top-performers', size: 'medium' as const, position: { x: 0, y: 3 }, enabled: true },
    { id: 'strategies', title: 'Active Strategies', type: 'strategies', size: 'medium' as const, position: { x: 2, y: 3 }, enabled: true }
  ]
};

// Preset layouts
const PRESET_LAYOUTS = {
  beginner: {
    name: "Beginner Trader",
    description: "Focus on essential metrics for new traders",
    widgets: ['portfolio-value', 'daily-pnl', 'portfolio-chart', 'top-performers']
  },
  advanced: {
    name: "Advanced Analytics",
    description: "Comprehensive metrics for experienced traders",
    widgets: ['portfolio-value', 'daily-pnl', 'win-rate', 'sharpe-ratio', 'portfolio-chart', 'risk-metrics', 'strategies']
  },
  risk: {
    name: "Risk Focused",
    description: "Emphasize risk management and analysis",
    widgets: ['portfolio-value', 'risk-metrics', 'sharpe-ratio', 'portfolio-chart']
  },
  strategy: {
    name: "Strategy Performance",
    description: "Monitor strategy performance and analytics",
    widgets: ['strategies', 'win-rate', 'top-performers', 'portfolio-chart']
  }
};

export default function CustomizableDashboard({ dashboardType, data, className }: CustomizableDashboardProps) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [tempWidgetOrder, setTempWidgetOrder] = useState<WidgetConfig[]>([]);
  const { toast } = useToast();

  // Load widgets from localStorage or use defaults
  useEffect(() => {
    const savedWidgets = localStorage.getItem(`dashboard-widgets-${dashboardType}`);
    if (savedWidgets) {
      try {
        setWidgets(JSON.parse(savedWidgets));
      } catch (error) {
        setWidgets(DEFAULT_LAYOUTS[dashboardType]);
      }
    } else {
      setWidgets(DEFAULT_LAYOUTS[dashboardType]);
    }
  }, [dashboardType]);

  // Save widgets to localStorage
  const saveLayout = () => {
    localStorage.setItem(`dashboard-widgets-${dashboardType}`, JSON.stringify(widgets));
    toast({
      title: "Layout Saved",
      description: "Your custom dashboard layout has been saved.",
    });
    setEditMode(false);
  };

  // Reset to default layout
  const resetLayout = () => {
    setWidgets(DEFAULT_LAYOUTS[dashboardType]);
    toast({
      title: "Layout Reset",
      description: "Dashboard layout has been reset to default.",
    });
  };

  // Apply preset layout
  const applyPreset = (presetKey: string) => {
    const preset = PRESET_LAYOUTS[presetKey as keyof typeof PRESET_LAYOUTS];
    const newWidgets = preset.widgets.map((widgetType, index) => {
      const definition = WIDGET_DEFINITIONS[widgetType as keyof typeof WIDGET_DEFINITIONS];
      return {
        id: widgetType,
        title: definition.title,
        type: widgetType,
        size: definition.defaultSize,
        position: { x: index % 3, y: Math.floor(index / 3) },
        enabled: true
      };
    });
    setWidgets(newWidgets);
    toast({
      title: "Preset Applied",
      description: `Applied ${preset.name} layout preset.`,
    });
  };

  // Add widget
  const addWidget = (widgetType: string) => {
    const definition = WIDGET_DEFINITIONS[widgetType as keyof typeof WIDGET_DEFINITIONS];
    const newWidget: WidgetConfig = {
      id: `${widgetType}-${Date.now()}`,
      title: definition.title,
      type: widgetType,
      size: definition.defaultSize,
      position: { x: 0, y: widgets.length },
      enabled: true
    };
    setWidgets([...widgets, newWidget]);
    toast({
      title: "Widget Added",
      description: `${definition.title} widget has been added to your dashboard.`,
    });
  };

  // Remove widget
  const removeWidget = (widgetId: string) => {
    setWidgets(widgets.filter(w => w.id !== widgetId));
    toast({
      title: "Widget Removed",
      description: "Widget has been removed from your dashboard.",
    });
  };

  // Resize widget
  const resizeWidget = (widgetId: string, size: 'small' | 'medium' | 'large') => {
    setWidgets(widgets.map(w => w.id === widgetId ? { ...w, size } : w));
  };

  // Calculate target position during drag (with stricter thresholds)
  const calculateDragTarget = (widgetId: string, dragOffset: { x: number; y: number }) => {
    const currentIndex = widgets.findIndex(w => w.id === widgetId);
    if (currentIndex === -1) return currentIndex;

    // Grid-based calculation (assuming 6 columns max)
    const columnsPerRow = 6;
    const currentRow = Math.floor(currentIndex / columnsPerRow);
    const currentCol = currentIndex % columnsPerRow;
    
    // Much stricter thresholds - require dragging almost completely past widget
    const cellWidth = 320; // More accurate widget width including gaps
    const cellHeight = 220; // More accurate widget height including gaps
    const threshold = 1.5; // Must drag 150% past center (almost complete overlap) before repositioning
    
    const colOffset = Math.floor(dragOffset.x / (cellWidth * threshold));
    const rowOffset = Math.floor(dragOffset.y / (cellHeight * threshold));
    
    const newCol = Math.max(0, Math.min(columnsPerRow - 1, currentCol + colOffset));
    const newRow = Math.max(0, currentRow + rowOffset);
    const newIndex = Math.min(widgets.length - 1, newRow * columnsPerRow + newCol);
    
    return newIndex;
  };

  // Real-time widget repositioning during drag
  const handleDragUpdate = (widgetId: string, dragOffset: { x: number; y: number }) => {
    if (!draggedWidgetId) {
      setDraggedWidgetId(widgetId);
      setTempWidgetOrder([...widgets]);
    }
    
    const targetIndex = calculateDragTarget(widgetId, dragOffset);
    const currentIndex = widgets.findIndex(w => w.id === widgetId);
    
    if (targetIndex !== currentIndex) {
      const newOrder = [...widgets];
      const [draggedWidget] = newOrder.splice(currentIndex, 1);
      newOrder.splice(targetIndex, 0, draggedWidget);
      setTempWidgetOrder(newOrder);
    }
  };

  // Finalize widget position on drag end
  const moveWidget = (widgetId: string, delta: { x: number; y: number }) => {
    const targetIndex = calculateDragTarget(widgetId, delta);
    const currentIndex = widgets.findIndex(w => w.id === widgetId);
    
    if (targetIndex !== currentIndex && Math.abs(delta.x) > 20 || Math.abs(delta.y) > 20) {
      const newWidgets = [...widgets];
      const [movedWidget] = newWidgets.splice(currentIndex, 1);
      newWidgets.splice(targetIndex, 0, movedWidget);
      setWidgets(newWidgets);
      
      // Save to localStorage
      localStorage.setItem(`dashboard-widgets-${dashboardType}`, JSON.stringify(newWidgets));
    }
    
    // Reset drag state
    setDraggedWidgetId(null);
    setTempWidgetOrder([]);
  };

  // Render widget content
  const renderWidget = (widget: WidgetConfig) => {
    const definition = WIDGET_DEFINITIONS[widget.type as keyof typeof WIDGET_DEFINITIONS];
    if (!definition) return <div>Unknown widget type</div>;
    
    const WidgetComponent = definition.component;
    return <WidgetComponent data={data} />;
  };

  return (
    <div className={className}>
      {/* Dashboard Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {editMode && (
            <Badge variant="outline" className="bg-primary/10">
              Edit Mode
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!editMode ? (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setEditMode(true)}
              className="flex items-center gap-2"
            >
              <Grid2x2 className="w-4 h-4" />
            </Button>
          ) : (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setEditMode(false);
                  setSelectedPreset('');
                }}
              >
                Cancel
              </Button>
              <Button 
                size="sm"
                onClick={saveLayout}
              >
                Save
              </Button>
            </>
          )}
          
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <div style={{ display: 'none' }} />
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Customize Dashboard</DialogTitle>
                <DialogDescription>
                  Add, remove, and arrange widgets to personalize your dashboard experience.
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="widgets" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="widgets">Add Widgets</TabsTrigger>
                  <TabsTrigger value="layouts">Custom Layouts</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>
                
                <TabsContent value="layouts" className="space-y-6">
                  <div className="space-y-4">
                    {/* Preset Selector */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Choose a Layout Preset</label>
                      <select 
                        className="w-full p-2 border rounded-md bg-background"
                        value={selectedPreset}
                        onChange={(e) => setSelectedPreset(e.target.value)}
                      >
                        <option value="">Select a preset layout...</option>
                        {Object.entries(PRESET_LAYOUTS).map(([key, preset]) => (
                          <option key={key} value={key}>{preset.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Preset Details */}
                    {selectedPreset && (
                      <div className="p-4 border rounded-lg bg-muted/20">
                        <h4 className="font-medium mb-2">{PRESET_LAYOUTS[selectedPreset as keyof typeof PRESET_LAYOUTS].name}</h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          {PRESET_LAYOUTS[selectedPreset as keyof typeof PRESET_LAYOUTS].description}
                        </p>
                        
                        <div className="mb-4">
                          <h5 className="text-sm font-medium mb-2">Included Widgets:</h5>
                          <div className="grid grid-cols-2 gap-2">
                            {PRESET_LAYOUTS[selectedPreset as keyof typeof PRESET_LAYOUTS].widgets.map((widgetType) => {
                              const definition = WIDGET_DEFINITIONS[widgetType as keyof typeof WIDGET_DEFINITIONS];
                              return (
                                <div key={widgetType} className="flex items-center gap-2 text-sm">
                                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                                  <span>{definition.title}</span>
                                  <Badge variant="outline" className="text-xs">{definition.defaultSize}</Badge>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button 
                        variant="outline" 
                        onClick={() => setSelectedPreset('')}
                        disabled={!selectedPreset}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => selectedPreset && applyPreset(selectedPreset)}
                        disabled={!selectedPreset}
                      >
                        Apply Preset
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="widgets" className="space-y-4">
                  <ScrollArea className="h-64">
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(WIDGET_DEFINITIONS).map(([key, definition]) => (
                        <div key={key} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <div className="font-medium text-sm">{definition.title}</div>
                            <div className="text-xs text-muted-foreground">{definition.category}</div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => addWidget(key)}
                            disabled={widgets.some(w => w.type === key)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="settings" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Edit Mode</h4>
                      <p className="text-sm text-muted-foreground">
                        Enable edit mode to resize, move, and remove widgets
                      </p>
                    </div>
                    <Button 
                      variant={editMode ? "default" : "outline"}
                      onClick={() => setEditMode(!editMode)}
                    >
                      {editMode ? 'Exit Edit' : 'Edit Layout'}
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={resetLayout}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset to Default
                    </Button>
                    <Button onClick={saveLayout}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Layout
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
          
          {editMode && (
            <Button onClick={saveLayout} size="sm">
              <Save className="h-4 w-4 mr-2" />
              Save Layout
            </Button>
          )}
        </div>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-6 auto-rows-min gap-4">
        {(tempWidgetOrder.length > 0 ? tempWidgetOrder : widgets)
          .filter(w => w.enabled).map((widget, index) => (
          <WidgetContainer
            key={widget.id}
            widget={widget}
            editMode={editMode}
            onRemove={removeWidget}
            onResize={resizeWidget}
            onMove={moveWidget}
            onDragUpdate={handleDragUpdate}
            isDraggedWidget={draggedWidgetId === widget.id}
            style={draggedWidgetId && draggedWidgetId !== widget.id ? { 
              transition: 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)', // Even slower, more elegant easing
              transform: 'translateZ(0)' // Force hardware acceleration for smooth animation
            } : undefined}
          >
            {renderWidget(widget)}
          </WidgetContainer>
        ))}
      </div>

      {widgets.filter(w => w.enabled).length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">No widgets configured</p>
          <Button onClick={() => setShowSettings(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Widgets
          </Button>
        </div>
      )}
    </div>
  );
}