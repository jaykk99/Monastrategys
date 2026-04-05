import React from 'react';

export default function App() {
  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1 style={{ fontSize: '48px', margin: '0 0 20px 0' }}>⚡ Monastrategys</h1>
      <p style={{ fontSize: '18px', color: '#888', margin: '0 0 40px 0' }}>Trading Strategies for Every Asset & Timeframe</p>
      
      <div style={{
        padding: '30px',
        backgroundColor: '#111',
        borderRadius: '8px',
        border: '1px solid #333',
        maxWidth: '500px',
        textAlign: 'center'
      }}>
        <p style={{ fontSize: '16px', marginBottom: '20px' }}>✓ Platform loaded successfully!</p>
        <p style={{ fontSize: '14px', color: '#666' }}>Your trading dashboard is ready...</p>
      </div>
    </div>
  );
}
