import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, X, Move, Maximize2, Minimize2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WidgetConfig {
  id: string;
  title: string;
  type: string;
  size: 'small' | 'medium' | 'large';
  position: { x: number; y: number };
  enabled: boolean;
  settings?: Record<string, any>;
}

interface WidgetContainerProps {
  widget: WidgetConfig;
  children: React.ReactNode;
  onRemove?: (id: string) => void;
  onResize?: (id: string, size: 'small' | 'medium' | 'large') => void;
  onMove?: (id: string, position: { x: number; y: number }) => void;
  onSettings?: (id: string) => void;
  editMode?: boolean;
  className?: string;
}

export default function WidgetContainer({
  widget,
  children,
  onRemove,
  onResize,
  onMove,
  onSettings,
  editMode = false,
  className
}: WidgetContainerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const getSizeClass = (size: string) => {
    switch (size) {
      case 'small': return 'col-span-1 row-span-1';
      case 'medium': return 'col-span-2 row-span-1';
      case 'large': return 'col-span-3 row-span-2';
      default: return 'col-span-2 row-span-1';
    }
  };

  const cycleSize = () => {
    const sizes: ('small' | 'medium' | 'large')[] = ['small', 'medium', 'large'];
    const currentIndex = sizes.indexOf(widget.size);
    const nextSize = sizes[(currentIndex + 1) % sizes.length];
    onResize?.(widget.id, nextSize);
  };

  return (
    <Card 
      className={cn(
        "relative group transition-all duration-200",
        getSizeClass(widget.size),
        isDragging && "shadow-lg z-10",
        editMode && "border-dashed border-2 border-primary/50",
        className
      )}
      style={{
        gridColumn: `span ${widget.size === 'small' ? 1 : widget.size === 'medium' ? 2 : 3}`,
        gridRow: `span ${widget.size === 'large' ? 2 : 1}`
      }}
    >
      {editMode && (
        <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm"
            onClick={() => onSettings?.(widget.id)}
          >
            <Settings className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm"
            onClick={cycleSize}
          >
            {widget.size === 'small' ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm cursor-move"
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
          >
            <Move className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm text-destructive"
            onClick={() => onRemove?.(widget.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
          <div className="flex items-center gap-2">
            {editMode && (
              <Badge variant="outline" className="text-xs">
                {widget.size}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {!isMinimized && (
        <CardContent className={cn(
          widget.size === 'large' ? 'h-64' : widget.size === 'medium' ? 'h-32' : 'h-24'
        )}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}