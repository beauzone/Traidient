
import { useEffect, useRef } from 'react';

interface TradingViewChartProps {
  symbol: string;
  interval?: string;
  theme?: 'light' | 'dark';
  autosize?: boolean;
  height?: number;
}

export default function TradingViewChart({
  symbol,
  interval = '1D',
  theme = 'dark',
  autosize = true,
  height = 500
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!symbol || !containerRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (typeof TradingView !== 'undefined') {
        new TradingView.widget({
          symbol: symbol,
          interval: interval,
          container_id: containerRef.current?.id,
          datafeed: new (window as any).Datafeeds.UDFCompatibleDatafeed('/api/market-data'),
          library_path: 'https://s3.tradingview.com/charting_library/',
          locale: 'en',
          disabled_features: ['use_localstorage_for_settings'],
          enabled_features: ['study_templates'],
          charts_storage_url: 'https://saveload.tradingview.com',
          client_id: 'tradingview.com',
          user_id: 'public_user',
          autosize: autosize,
          height: height,
          theme: theme,
          toolbar_bg: theme === 'dark' ? '#1a1b1e' : '#ffffff',
          loading_screen: { backgroundColor: theme === 'dark' ? '#1a1b1e' : '#ffffff' },
          overrides: {
            "mainSeriesProperties.style": 1,
            "symbolWatermarkProperties.color": "rgba(0, 0, 0, 0)",
          }
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [symbol, interval, theme]);

  return <div id={`tradingview_${symbol}`} ref={containerRef} className="w-full h-full" />;
}
