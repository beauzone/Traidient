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
  onDragUpdate?: (id: string, offset: { x: number; y: number }) => void;
  onSettings?: (id: string) => void;
  editMode?: boolean;
  isDraggedWidget?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function WidgetContainer({
  widget,
  children,
  onRemove,
  onResize,
  onMove,
  onDragUpdate,
  onSettings,
  editMode = false,
  isDraggedWidget = false,
  className,
  style
}: WidgetContainerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const getSizeClass = (size: string) => {
    switch (size) {
      case 'small': return 'col-span-1 row-span-1';
      case 'medium': return 'col-span-2 row-span-1';
      case 'large': return 'col-span-3 row-span-2';
      default: return 'col-span-2 row-span-1';
    }
  };

  // Define appropriate sizes for each widget type
  const getAppropriateSizes = (widgetType: string): ('small' | 'medium' | 'large')[] => {
    switch (widgetType) {
      case 'portfolio-overview':
      case 'performance-chart':
      case 'top-performers':
        return ['medium', 'large']; // These need space for charts/lists
      case 'active-strategies':
      case 'risk-metrics':
        return ['small', 'medium']; // These work well in smaller sizes
      case 'recent-trades':
        return ['medium', 'large']; // Needs space for trade list
      case 'market-overview':
        return ['small', 'medium']; // Simple metrics work in smaller sizes
      default:
        return ['small', 'medium', 'large']; // Default to all sizes
    }
  };

  const cycleSize = () => {
    const appropriateSizes = getAppropriateSizes(widget.type);
    const currentIndex = appropriateSizes.indexOf(widget.size);
    const nextSize = appropriateSizes[(currentIndex + 1) % appropriateSizes.length];
    onResize?.(widget.id, nextSize);
  };

  // Fidelity-style drag functionality with real-time repositioning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!editMode || !onMove) return;
    // Don't start drag if clicking on buttons
    if ((e.target as HTMLElement).closest('button')) return;
    
    e.preventDefault();
    const startPos = { x: e.clientX, y: e.clientY };
    setDragStart(startPos);
    
    let hasMoved = false;
    
    // Add global listeners for better drag handling
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;
      
      // Start visual dragging after 5px movement
      if (!hasMoved && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
        setIsDragging(true);
        hasMoved = true;
      }
      
      // Update visual position during drag
      if (hasMoved) {
        setDragOffset({ x: deltaX, y: deltaY });
        
        // Trigger real-time widget repositioning
        if (onDragUpdate && Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
          onDragUpdate(widget.id, { x: deltaX, y: deltaY });
        }
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;
      
      // Only commit the move on mouse release if we actually dragged
      if (hasMoved && (Math.abs(deltaX) > 20 || Math.abs(deltaY) > 20)) {
        onMove(widget.id, { x: deltaX, y: deltaY });
      }
      
      setIsDragging(false);
      setDragStart(null);
      setDragOffset({ x: 0, y: 0 });
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  };

  return (
    <Card 
      className={cn(
        "relative group transition-all duration-200",
        getSizeClass(widget.size),
        isDragging && "shadow-lg z-10",
        editMode && "cursor-move", // Clean design like Fidelity - no dashed borders
        isMinimized && "!row-span-1", // Force minimized widgets to single row height
        className
      )}
      style={{
        gridColumn: `span ${widget.size === 'small' ? 1 : widget.size === 'medium' ? 2 : 3}`,
        gridRow: isMinimized ? 'span 1' : `span ${widget.size === 'large' ? 2 : 1}`,
        height: isMinimized ? 'auto' : undefined,
        maxHeight: isMinimized ? '60px' : undefined, // Limit height when minimized like Fidelity
        transform: isDragging ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : undefined,
        transition: isDragging ? 'none' : undefined,
        ...style // Apply external styles for smooth repositioning
      }}
      onMouseDown={handleMouseDown}
    >
      {editMode && (
        <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm text-white hover:text-white"
            onClick={cycleSize}
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm text-white hover:text-white"
            onClick={() => onRemove?.(widget.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
          {!editMode && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          )}
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