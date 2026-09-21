'use client';

import { useEffect } from 'react';

export default function ScheduleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Schedule page error:', error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      fontFamily: 'Inter, sans-serif',
      background: '#eef1f7',
      padding: 40,
    }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#dc2626' }}>
        Schedule Page Error
      </h2>
      <pre style={{
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 8,
        padding: 16,
        fontSize: 13,
        color: '#991b1b',
        maxWidth: 600,
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {error.message}
        {'\n\n'}
        {error.stack}
      </pre>
      <button
        onClick={reset}
        style={{
          padding: '10px 24px',
          borderRadius: 8,
          border: 'none',
          background: '#6366f1',
          color: '#fff',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Try Again
      </button>
    </div>
  );
}
