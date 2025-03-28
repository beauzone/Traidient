
import { useEffect, useRef } from 'react';

interface TradingViewChartProps {
  symbol: string;
  interval?: string;
  theme?: 'light' | 'dark';
  autosize?: boolean;
  height?: number;
  startDate?: string;
  endDate?: string;
  containerClass?: string;
}

export default function TradingViewChart({
  symbol,
  interval = 'D',
  theme = 'dark',
  autosize = true,
  height = 500,
  startDate,
  endDate,
  containerClass
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    if (!symbol || !containerRef.current) return;

    // Clean up any previous instance
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    // Create container ID
    const containerId = `tradingview_${symbol.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`;
    containerRef.current.id = containerId;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;

    // Format the widget configuration
    const widgetConfig = {
      autosize: autosize,
      height: height,
      symbol: `${symbol}`,
      interval: interval,
      timezone: "America/New_York",
      theme: theme,
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      support_host: "https://www.tradingview.com"
    };

    script.innerHTML = JSON.stringify(widgetConfig);
    
    // Create a container
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    
    // Create a copyright div 
    const copyrightDiv = document.createElement('div');
    copyrightDiv.className = 'tradingview-widget-copyright';
    copyrightDiv.style.width = '100%';
    copyrightDiv.style.fontSize = '10px';
    copyrightDiv.style.textAlign = 'right';
    copyrightDiv.style.position = 'absolute';
    copyrightDiv.style.bottom = '5px';
    copyrightDiv.style.right = '10px';
    copyrightDiv.style.color = 'rgba(255, 255, 255, 0.3)';
    
    // Assemble the widget
    widgetContainer.appendChild(widgetDiv);
    widgetContainer.appendChild(copyrightDiv);
    
    // Insert the widget
    containerRef.current.appendChild(widgetContainer);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      if (widgetRef.current) {
        widgetRef.current = null;
      }
    };
  }, [symbol, interval, theme, autosize, height]);

  return (
    <div 
      ref={containerRef}
      className={containerClass || "w-full h-full"}
      style={{ position: 'relative' }}
    />
  );
}
