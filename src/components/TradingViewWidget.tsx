import { useEffect, useRef } from 'react';

interface Props {
  symbol: string;
}

declare global {
  interface Window {
    TradingView: any;
  }
}

export function TradingViewWidget({ symbol }: Props) {
  const containerId = useRef(`tv_chart_${Math.random().toString(36).substring(2, 11)}`);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    let disposed = false;
    const initWidget = () => {
      if (disposed) return;
      const el = document.getElementById(containerId.current);
      if (window.TradingView && el) {
        el.innerHTML = '';
        widgetRef.current = new window.TradingView.widget({
          autosize: true,
          symbol: symbol.includes('USDT') || symbol.includes('BTC') ? 'BINANCE:' + symbol : 'AMEX:' + symbol,
          interval: '15',
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          container_id: containerId.current,
          calendar: false,
          support_host: 'https://www.tradingview.com',
        });
      }
    };

    const timeoutId = setTimeout(initWidget, 250);
    return () => {
      disposed = true;
      clearTimeout(timeoutId);
      const el = document.getElementById(containerId.current);
      if (el) el.innerHTML = '';
    };
  }, [symbol]);

  return (
    <div
      id={containerId.current}
      className="tradingview-widget-container h-full w-full border border-white/5"
    />
  );
}
