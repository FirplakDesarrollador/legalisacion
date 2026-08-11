'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar, TabType } from '@/components/Sidebar';
import { KpiStats } from '@/components/KpiStats';
import { LegalizacionesList } from '@/components/LegalizacionesList';
import { LegalizacionDetailModal } from '@/components/LegalizacionDetailModal';
import { NuevaLegalizacionModal } from '@/components/NuevaLegalizacionModal';
import { ProveedoresTable } from '@/components/ProveedoresTable';
import { CuentasTable } from '@/components/CuentasTable';
import { CajasMenoresView } from '@/components/CajasMenoresView';
import { ReportesView } from '@/components/ReportesView';
import { LoginView } from '@/components/LoginView';
import {
  checkSupabaseHealth,
  fetchCuentasFromSupabase,
  fetchProveedoresFromSupabase,
  fetchCajasMenoresFromSupabase,
  fetchLegalizacionesFromSupabase,
  getLocalLegalizaciones,
  saveLocalLegalizacion,
  updateLegalizacionStatus,
  getLocalCajasMenores,
  saveLocalCajaMenor,
  agregarMovimientoCaja,
  HealthCheckResult,
  supabase,
} from '@/lib/supabase';
import { Legalizacion, CuentaContable, Proveedor, CajaMenor, MovimientoCaja } from '@/types/legalizaciones';

export default function Home() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string; role: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Tab & search state
  const [activeTab, setActiveTab] = useState<TabType>('legalizaciones');
  const [searchTerm, setSearchTerm] = useState('');
  const [health, setHealth] = useState<HealthCheckResult | null>(null);

  // Data states
  const [legalizaciones, setLegalizaciones] = useState<Legalizacion[]>([]);
  const [cajasMenores, setCajasMenores] = useState<CajaMenor[]>([]);
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loadingSupabase, setLoadingSupabase] = useState(true);

  // Modals state
  const [isNuevaModalOpen, setIsNuevaModalOpen] = useState(false);
  const [selectedLegalizacion, setSelectedLegalizacion] = useState<Legalizacion | null>(null);

  // Check active Supabase session on mount
  useEffect(() => {
    async function checkAuthSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          const u = data.session.user;
          setCurrentUser({
            email: u.email || 'usuario@firplak.com',
            name: u.user_metadata?.nombre || u.email?.split('@')[0] || 'Usuario Autenticado',
            role: 'Administrador Tesorería',
          });
        } else {
          const savedLocalUser = localStorage.getItem('legalisa_active_user');
          if (savedLocalUser) {
            setCurrentUser(JSON.parse(savedLocalUser));
          }
        }
      } catch (err) {
        console.log('Session check:', err);
      } finally {
        setCheckingAuth(false);
      }
    }
    checkAuthSession();
  }, []);

  const handleLoginSuccess = (userObj: { email: string; name: string; role: string }) => {
    setCurrentUser(userObj);
    localStorage.setItem('legalisa_active_user', JSON.stringify(userObj));
  };

  const handleLogout = () => {
    supabase.auth.signOut().catch(() => {});
    localStorage.removeItem('legalisa_active_user');
    setCurrentUser(null);
  };

  const loadSupabaseData = useCallback(async () => {
    setLoadingSupabase(true);
    try {
      const [hResult, cData, pData, cajasData, legData] = await Promise.all([
        checkSupabaseHealth(),
        fetchCuentasFromSupabase(),
        fetchProveedoresFromSupabase(),
        fetchCajasMenoresFromSupabase(),
        fetchLegalizacionesFromSupabase(),
      ]);

      setHealth(hResult);
      setCuentas(cData);
      setProveedores(pData);
      if (cajasData && cajasData.length > 0) {
        setCajasMenores(cajasData);
      }
      if (legData && legData.length > 0) {
        setLegalizaciones(legData);
      }
    } catch (err) {
      console.error('Error cargando datos Supabase:', err);
    } finally {
      setLoadingSupabase(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      setCajasMenores(getLocalCajasMenores());
      loadSupabaseData();
    }
  }, [currentUser, loadSupabaseData]);

  const handleSaveNueva = (nueva: Legalizacion) => {
    const updated = saveLocalLegalizacion(nueva);
    setLegalizaciones(updated);
    setActiveTab('legalizaciones');
  };

  const handleUpdateStatus = (id: string, nuevoEstado: Legalizacion['estado'], observaciones?: string) => {
    const updated = updateLegalizacionStatus(id, nuevoEstado, observaciones);
    setLegalizaciones(updated);
    if (selectedLegalizacion && selectedLegalizacion.id === id) {
      setSelectedLegalizacion((prev) => (prev ? { ...prev, estado: nuevoEstado, observacionesAprobacion: observaciones } : null));
    }
  };

  const handleSaveCaja = (nueva: CajaMenor) => {
    const updated = saveLocalCajaMenor(nueva);
    setCajasMenores(updated);
  };

  const handleAgregarMovimientoCaja = (cajaId: string, mov: MovimientoCaja) => {
    const updated = agregarMovimientoCaja(cajaId, mov);
    setCajasMenores(updated);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-semibold text-slate-300">Cargando Sistema Legalisa...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        health={health}
        onRefreshHealth={loadSupabaseData}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Layout Area */}
      <div className="flex flex-1">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenNuevaModal={() => setIsNuevaModalOpen(true)}
          counts={{
            legalizaciones: legalizaciones.length,
            cajasMenores: cajasMenores.length,
            cuentas: cuentas.length,
            proveedores: proveedores.length,
          }}
        />

        {/* Dynamic Main Workspace */}
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <KpiStats
                legalizaciones={legalizaciones}
                cuentasCount={cuentas.length}
                proveedoresCount={proveedores.length}
                health={health}
              />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Últimas Legalizaciones Registradas
                  </h2>
                  <button
                    onClick={() => setActiveTab('legalizaciones')}
                    className="text-xs text-blue-600 hover:underline font-semibold"
                  >
                    Ver todas ({legalizaciones.length}) &rarr;
                  </button>
                </div>
                <LegalizacionesList
                  legalizaciones={legalizaciones.slice(0, 5)}
                  onSelectLegalizacion={setSelectedLegalizacion}
                  onOpenNuevaModal={() => setIsNuevaModalOpen(true)}
                  onUpdateStatus={(id, st) => handleUpdateStatus(id, st)}
                />
              </div>
            </div>
          )}

          {activeTab === 'legalizaciones' && (
            <LegalizacionesList
              legalizaciones={legalizaciones}
              onSelectLegalizacion={setSelectedLegalizacion}
              onOpenNuevaModal={() => setIsNuevaModalOpen(true)}
              onUpdateStatus={(id, st) => handleUpdateStatus(id, st)}
            />
          )}

          {activeTab === 'cajas_menores' && (
            <CajasMenoresView
              cajas={cajasMenores}
              cuentas={cuentas}
              proveedores={proveedores}
              onSaveCaja={handleSaveCaja}
              onAgregarMovimiento={handleAgregarMovimientoCaja}
            />
          )}

          {activeTab === 'cuentas' && (
            <CuentasTable
              cuentas={cuentas}
              loading={loadingSupabase}
              onRefresh={loadSupabaseData}
            />
          )}

          {activeTab === 'proveedores' && (
            <ProveedoresTable
              proveedores={proveedores}
              loading={loadingSupabase}
              onRefresh={loadSupabaseData}
            />
          )}

          {activeTab === 'reportes' && (
            <ReportesView
              legalizaciones={legalizaciones}
              cuentas={cuentas}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <NuevaLegalizacionModal
        isOpen={isNuevaModalOpen}
        onClose={() => setIsNuevaModalOpen(false)}
        cuentas={cuentas}
        proveedores={proveedores}
        onSave={handleSaveNueva}
      />

      <LegalizacionDetailModal
        legalizacion={selectedLegalizacion}
        onClose={() => setSelectedLegalizacion(null)}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
}
