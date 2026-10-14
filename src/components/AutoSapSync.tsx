'use client';

import { useEffect, useRef } from 'react';

/**
 * Componente silencioso que monitorea y reconcilia automáticamente
 * cualquier legalización aprobada que esté pendiente de crearse en SAP.
 * 
 * Si detecta registros pendientes, los sincroniza con SAP y notifica
 * a la aplicación para que refresque las listas automáticamente sin recargar.
 */
export function AutoSapSync({ onSynced }: { onSynced?: () => void }) {
  const isSyncingRef = useRef(false);
  const lastSyncTimeRef = useRef(0);

  const ejecutarSincronizacion = async () => {
    // Evitar ejecuciones simultáneas o muy seguidas (< 30 segundos)
    const now = Date.now();
    if (isSyncingRef.current || now - lastSyncTimeRef.current < 30000) {
      return;
    }

    isSyncingRef.current = true;
    lastSyncTimeRef.current = now;

    try {
      const res = await fetch('/api/sap/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.syncedCount > 0) {
          console.log(`[AutoSapSync] 🚀 Se sincronizaron automáticamente ${data.syncedCount} registro(s) con SAP.`);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sap-records-synced', { detail: data }));
          }
          if (onSynced) {
            onSynced();
          }
        }
      }
    } catch (err) {
      console.warn('[AutoSapSync] Comprobación periódica no completada:', err);
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    // 1. Ejecutar una comprobación inicial a los 3 segundos de abrir la app
    const initialTimer = setTimeout(() => {
      ejecutarSincronizacion();
    }, 3000);

    // 2. Ejecutar periódicamente cada 60 segundos en segundo plano
    const interval = setInterval(() => {
      ejecutarSincronizacion();
    }, 60000);

    // 3. Ejecutar cuando el usuario vuelve a enfocar la pestaña del navegador
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        ejecutarSincronizacion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}
