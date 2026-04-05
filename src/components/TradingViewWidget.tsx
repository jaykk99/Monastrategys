import React, { useEffect, useRef, memo } from 'react';

const TradingViewWidget = () => {
  const containerId = useRef(`tv_chart_${Math.random().toString(36).substring(2, 11)}`);

  useEffect(() => {
    const initWidget = () => {
      if ((window as any).TradingView && document.getElementById(containerId.current)) {
        new (window as any).TradingView.widget({
          "autosize": true,
          "symbol": "BINANCE:BTCUSDT",
          "interval": "D",
          "timezone": "Etc/UTC",
          "theme": "dark",
          "style": "1",
          "locale": "en",
          "enable_publishing": false,
          "backgroundColor": "#050505",
          "gridColor": "#1a1a1a",
          "hide_top_toolbar": false,
          "hide_legend": false,
          "save_image": false,
          "container_id": containerId.current,
          "support_host": "https://www.tradingview.com"
        });
      }
    };

    const timeoutId = setTimeout(initWidget, 200);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div id={containerId.current} className="tradingview-widget-container h-full w-full"></div>
  );
};

export default memo(TradingViewWidget);
