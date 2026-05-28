import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { fetchApi } from '../utils/api';
import { toast } from '../utils/toast';

const TradingViewWidget = ({ initialSymbol, position }: { initialSymbol: string, position: React.CSSProperties }) => {
  const [currentSymbol, setCurrentSymbol] = useState(initialSymbol);
  const [inputVal, setInputVal] = useState(initialSymbol);
  const [timeframe, setTimeframe] = useState('15m');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [priceData, setPriceData] = useState<{ price: number, change: number, changePercent: string } | null>(null);
  
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [showTradePopover, setShowTradePopover] = useState<'BUY'|'SELL'|null>(null);
  const [tradeQuantity, setTradeQuantity] = useState(1);
  const [isTrading, setIsTrading] = useState(false);
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  
  // Use refs for chart and series so we can update them without remounting
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    fetchApi('/api/watchlist').then(setWatchlist).catch(() => {});
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current || isMinimized) return;

    try {
      // Create chart instance
      chartRef.current = createChart(chartContainerRef.current, {
        layout: {
          background: { type: 'solid' as any, color: 'rgba(0, 0, 0, 0.5)' },
          textColor: '#d1d5db',
        },
        grid: {
          vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
          horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
        },
        // Remove fixed width/height so ResizeObserver handles it fully
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });

      seriesRef.current = chartRef.current.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });
    } catch (err) {
      console.error('Error creating chart:', err);
      setError('Chart failed to initialize');
      return;
    }

    const fetchData = async (isInitial: boolean) => {
      try {
        const data = await fetchApi(`/api/chart/${currentSymbol}?timeframe=${timeframe}`);
        if (data.error) {
          setError(data.error);
        } else if (data.candles && data.candles.length > 0) {
          setError('');
          seriesRef.current.setData(data.candles);
          setPriceData({
            price: data.currentPrice,
            change: data.change,
            changePercent: data.changePercent
          });
          if (isInitial) {
            chartRef.current.timeScale().fitContent();
          }
        } else {
          setError('Symbol not found on NSE');
        }
      } catch (err) {
        setError('Symbol not found or blocked');
        console.error(err);
      }
    };

    let isMounted = true;
    fetchData(true);

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      if (isMounted && !isMinimized) {
        fetchData(false);
      }
    }, 60000);

    // Auto-resize chart on container resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (!chartRef.current || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.resize(width, height);
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      isMounted = false;
      clearInterval(interval);
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [currentSymbol, timeframe, isMinimized]);

  const handleSearchClick = () => {
    if (inputVal.trim()) {
      setCurrentSymbol(inputVal.toUpperCase().trim());
      setShowTradePopover(null);
    }
  };

  const handleUpdate = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearchClick();
  };

  const toggleWatchlist = async () => {
    const action = watchlist.includes(currentSymbol) ? 'REMOVE' : 'ADD';
    try {
      const updated = await fetchApi('/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ symbol: currentSymbol, action })
      });
      setWatchlist(updated);
      if (action === 'ADD') toast.success(`Added ${currentSymbol} to Watchlist`);
      else toast.info(`Removed ${currentSymbol} from Watchlist`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const executeTrade = async () => {
    if (!showTradePopover || !priceData) return;
    setIsTrading(true);
    try {
      const res = await fetchApi('/api/trade', {
        method: 'POST',
        body: JSON.stringify({ symbol: currentSymbol, action: showTradePopover, quantity: tradeQuantity })
      });
      toast.success(res.message);
      setShowTradePopover(null);
      setTradeQuantity(1);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsTrading(false);
    }
  };

  const handleSetAlert = async () => {
    if (!priceData) return;
    const target = prompt(`Set alert for ${currentSymbol}\nCurrent Price: ₹${priceData.price}\nEnter target price:`);
    if (!target) return;
    const targetPrice = parseFloat(target);
    if (isNaN(targetPrice) || targetPrice <= 0) return toast.error('Invalid price');

    const condition = targetPrice > priceData.price ? 'ABOVE' : 'BELOW';
    
    try {
      const res = await fetchApi('/api/alerts', {
        method: 'POST',
        body: JSON.stringify({ symbol: currentSymbol, targetPrice, condition })
      });
      if (res.error) toast.error(res.error);
      else toast.success(`Alert set for ${currentSymbol} ${condition.toLowerCase()} ₹${targetPrice}`);
    } catch (e) {
      toast.error('Failed to set alert');
    }
  };

  if (isMinimized) {
    const isPositive = priceData && priceData.change >= 0;
    return (
      <div style={{
        position: 'fixed', zIndex: 9999, ...position,
        background: 'rgba(20, 20, 20, 0.9)', padding: '8px 12px',
        borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '10px',
        border: `1px solid ${isPositive ? '#26a69a' : '#ef5350'}`,
        cursor: 'pointer'
      }} onClick={() => setIsMinimized(false)}>
        <strong style={{ color: '#fff' }}>{currentSymbol}</strong>
        {priceData ? (
          <span style={{ color: isPositive ? '#26a69a' : '#ef5350', fontWeight: 'bold' }}>
            ₹{priceData.price} {isPositive ? '▲' : '▼'} {Math.abs(Number(priceData.changePercent))}%
          </span>
        ) : <span style={{ color: '#888' }}>Loading...</span>}
        <span style={{ color: '#888', fontSize: '0.8rem', marginLeft: '5px' }}>[+]</span>
      </div>
    );
  }

  const isPositive = priceData && priceData.change >= 0;

  return (
    <div style={isFullscreen ? {
      position: 'fixed',
      top: '5%',
      left: '5%',
      width: '90%',
      height: '90%',
      zIndex: 10000,
      display: 'flex', 
      flexDirection: 'column', 
      gap: '12px',
      background: 'rgba(20, 20, 20, 0.95)',
      padding: '20px',
      borderRadius: '12px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.1)'
    } : { 
      position: 'fixed', 
      zIndex: 9999, 
      ...position, 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '8px',
      background: 'rgba(20, 20, 20, 0.9)',
      padding: '12px',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.1)'
    }}>
      {/* Header row: Title + Ticker + Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <strong style={{ color: '#fff', fontSize: '1.1rem' }}>{currentSymbol}</strong>
          {priceData && (
            <span style={{ color: isPositive ? '#26a69a' : '#ef5350', fontWeight: 'bold', fontSize: '0.9rem' }}>
              ₹{priceData.price.toFixed(2)} {isPositive ? '▲' : '▼'} {Math.abs(Number(priceData.changePercent))}%
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <button 
            onClick={toggleWatchlist}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
            title={watchlist.includes(currentSymbol) ? "Remove from Watchlist" : "Add to Watchlist"}
          >
            {watchlist.includes(currentSymbol) ? '⭐' : '☆'}
          </button>
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '0 5px' }}
            title="Toggle Fullscreen"
          >
            [⛶]
          </button>
          <button 
            onClick={() => { setIsFullscreen(false); setIsMinimized(true); }}
            style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '0 5px' }}
            title="Minimize Chart"
          >
            [—]
          </button>
        </div>
      </div>

      {/* Input + Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <input 
          type="text" 
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleUpdate}
          style={{ 
            background: 'rgba(0,0,0,0.5)', border: '1px solid #333', color: '#fff', 
            padding: '4px 8px', borderRadius: '4px 0 0 4px', fontSize: '0.9rem', outline: 'none',
            flexGrow: 1, boxSizing: 'border-box'
          }}
          placeholder="e.g. RELIANCE"
        />
        <button 
          onClick={handleSearchClick}
          style={{
            background: '#2962FF', border: '1px solid #2962FF', color: '#fff',
            padding: '4px 12px', borderRadius: '0 4px 4px 0', cursor: 'pointer',
            fontSize: '0.9rem', fontWeight: 'bold'
          }}
        >
          🔍
        </button>
      </div>
      
      {/* Timeframes */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {['1m', '5m', '15m', '1H', '1D'].map(tf => (
          <button 
            key={tf}
            onClick={() => setTimeframe(tf)}
            style={{
              background: timeframe === tf ? '#2962FF' : 'transparent',
              border: '1px solid #333',
              color: timeframe === tf ? '#fff' : '#888',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '0.75rem',
              cursor: 'pointer'
            }}
          >
            {tf}
          </button>
        ))}
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' }}>{error}</div>}
      
      <div ref={chartContainerRef} style={{ width: isFullscreen ? '100%' : '400px', height: isFullscreen ? '100%' : '300px', position: 'relative', flexGrow: 1 }}>
      </div>

      {/* Trading Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <button 
          onClick={() => setShowTradePopover(showTradePopover === 'BUY' ? null : 'BUY')}
          style={{ flex: 1, background: '#059669', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          BUY
        </button>
        <button 
          className="secondary"
          onClick={() => setShowTradePopover(showTradePopover === 'SELL' ? null : 'SELL')}
          style={{ flex: 1, padding: '8px 16px', background: 'rgba(220, 38, 38, 0.2)', color: '#ef4444', border: '1px solid #dc2626', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          SELL
        </button>
        <button 
          className="secondary"
          onClick={handleSetAlert}
          style={{ padding: '8px 16px', background: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', border: '1px solid #fbbf24', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
          title="Set Price Alert"
        >
          ⏰
        </button>
      </div>

      {/* Trade Popover */}
      {showTradePopover && (
        <div style={{
          background: 'rgba(0,0,0,0.8)', padding: '12px', borderRadius: '8px', border: '1px solid #333',
          display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: '0.9rem' }}>
            <span>{showTradePopover} {currentSymbol}</span>
            <span>Est: ₹{priceData ? (priceData.price * tradeQuantity).toFixed(2) : '---'}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="number" 
              min="1"
              value={tradeQuantity}
              onChange={(e) => setTradeQuantity(parseInt(e.target.value) || 1)}
              style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid #444', borderRadius: '4px', padding: '4px 8px' }}
            />
            <button 
              onClick={executeTrade}
              disabled={isTrading}
              style={{ 
                background: showTradePopover === 'BUY' ? '#059669' : '#dc2626', 
                color: 'white', border: 'none', padding: '4px 16px', borderRadius: '4px', 
                fontWeight: 'bold', cursor: isTrading ? 'not-allowed' : 'pointer', opacity: isTrading ? 0.7 : 1
              }}
            >
              {isTrading ? '...' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingViewWidget;
