'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700/80 rounded-2xl p-6 text-center shadow-2xl">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <AlertCircle className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Algo salió mal</h2>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Se presentó un error inesperado al renderizar la aplicación. Hemos registrado el incidente para solucionarlo.
        </p>

        {error?.message && (
          <div className="text-left bg-slate-950/60 border border-slate-800 rounded-xl p-3 mb-5 max-h-32 overflow-y-auto">
            <span className="text-[10px] font-mono text-rose-300 break-words">
              {error.message}
            </span>
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reintentar</span>
          </button>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/';
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Recargar página</span>
          </button>
        </div>
      </div>
    </div>
  );
}
