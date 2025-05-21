
import { useEffect, useRef } from 'react';

interface TradingViewChartProps {
  symbol: string;
  interval?: string;
  timeRange?: string;
  timeInterval?: string;
  theme?: 'light' | 'dark';
  autosize?: boolean;
  height?: number | string;
  containerClass?: string;
}

export default function TradingViewChart({
  symbol,
  interval = 'D',
  timeRange,
  timeInterval,
  theme = 'dark',
  autosize = true,
  height = 500,
  containerClass
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!symbol || !containerRef.current) return;

    // Clean up any previous instance
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    // Create a script element
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;

    // Use timeInterval if provided, otherwise use interval
    const chartInterval = timeInterval || interval;
    
    // Create the widget configuration
    const widgetConfig = {
      autosize: autosize,
      height: height,
      symbol: symbol,
      interval: chartInterval,
      timezone: "America/New_York",
      theme: theme,
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: true,
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      withdateranges: true,
      details: true,
      hotlist: true,
      studies: ["RSI@tv-basicstudies", "MASimple@tv-basicstudies"],
      hide_legend: false,
      show_popup_button: true,
      popup_width: "1000",
      popup_height: "650",
      support_host: "https://www.tradingview.com",
      // Add time range support if provided
      range: timeRange || undefined
    };

    // Convert the configuration to JSON and assign it to the script's inner HTML
    script.innerHTML = JSON.stringify(widgetConfig);
    
    // Create container elements
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    
    // Assemble the widget
    widgetContainer.appendChild(widgetDiv);
    
    // Clear container and append new elements
    containerRef.current.appendChild(widgetContainer);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, interval, timeInterval, timeRange, theme, autosize, height]);

  return (
    <div 
      ref={containerRef}
      className={containerClass || "w-full h-full"}
      style={{ position: 'relative' }}
    />
  );
}
