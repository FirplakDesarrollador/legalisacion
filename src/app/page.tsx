'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { Sidebar, TabType } from '@/components/Sidebar';
import { KpiStats } from '@/components/KpiStats';
import { LegalizacionesList } from '@/components/LegalizacionesList';
import { LegalizacionDetailModal } from '@/components/LegalizacionDetailModal';
import { NuevaLegalizacionModal } from '@/components/NuevaLegalizacionModal';
import { TarjetasCreditoList } from '@/components/TarjetasCreditoList';
import { TarjetaCreditoDetailModal } from '@/components/TarjetaCreditoDetailModal';
import { NuevaTarjetaCreditoModal } from '@/components/NuevaTarjetaCreditoModal';
import { ProveedoresTable } from '@/components/ProveedoresTable';
import { CuentasTable } from '@/components/CuentasTable';
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
  getLocalTarjetasCredito,
  saveLocalTarjetaCredito,
  updateTarjetaCreditoStatus,
  fetchLegalizacionesTarjetasCreditoFromSupabase,
  getLocalCajasMenores,
  saveLocalCajaMenor,
  agregarMovimientoCaja,
  HealthCheckResult,
  supabase,
} from '@/lib/supabase';
import { Legalizacion, CuentaContable, Proveedor, CajaMenor, MovimientoCaja, TarjetaCredito } from '@/types/legalizaciones';

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
  const [tarjetasCredito, setTarjetasCredito] = useState<TarjetaCredito[]>([]);
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loadingSupabase, setLoadingSupabase] = useState(true);

  // Modals state
  const [isNuevaModalOpen, setIsNuevaModalOpen] = useState(false);
  const [selectedLegalizacion, setSelectedLegalizacion] = useState<Legalizacion | null>(null);
  
  const [isNuevaTarjetaModalOpen, setIsNuevaTarjetaModalOpen] = useState(false);
  const [selectedTarjetaCredito, setSelectedTarjetaCredito] = useState<TarjetaCredito | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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

  // Setup deep linking for Tarjetas de Crédito
  useEffect(() => {
    if (typeof window !== 'undefined' && tarjetasCredito.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const tcId = params.get('tc_id');
      if (tcId) {
        const found = tarjetasCredito.find(tc => tc.id === tcId || tc.codigo === tcId);
        if (found && !selectedTarjetaCredito) {
          setActiveTab('cajas_menores');
          setSelectedTarjetaCredito(found);
        }
      }
    }
  }, [tarjetasCredito, selectedTarjetaCredito]);

  // Logout handler
  const handleLogout = () => {
    supabase.auth.signOut().catch(() => {});
    localStorage.removeItem('legalisa_active_user');
    setCurrentUser(null);
  };

  const loadSupabaseData = useCallback(async () => {
    setLoadingSupabase(true);
    try {
      const [hResult, cData, pData, tcData, legData] = await Promise.all([
        checkSupabaseHealth(),
        fetchCuentasFromSupabase(),
        fetchProveedoresFromSupabase(),
        fetchLegalizacionesTarjetasCreditoFromSupabase(),
        fetchLegalizacionesFromSupabase(),
      ]);

      setHealth(hResult);
      setCuentas(cData);
      setProveedores(pData);
      if (tcData && tcData.length > 0) {
        setTarjetasCredito(tcData);
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
      setTarjetasCredito(getLocalTarjetasCredito());
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

  const handleSaveNuevaTarjeta = (nueva: TarjetaCredito) => {
    const updated = saveLocalTarjetaCredito(nueva);
    setTarjetasCredito(updated);
    setActiveTab('cajas_menores');
  };

  const handleUpdateStatusTarjeta = (id: string, nuevoEstado: TarjetaCredito['estado'], observaciones?: string) => {
    const updated = updateTarjetaCreditoStatus(id, nuevoEstado, observaciones);
    setTarjetasCredito(updated);
    if (selectedTarjetaCredito && selectedTarjetaCredito.id === id) {
      setSelectedTarjetaCredito((prev) => (prev ? { ...prev, estado: nuevoEstado, observacionesAprobacion: observaciones } : null));
    }
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
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />

      {/* Main Layout Area */}
      <div className="flex flex-1 min-w-0">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenNuevaModal={() => setIsNuevaModalOpen(true)}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
          counts={{
            legalizaciones: legalizaciones.length,
            cajasMenores: tarjetasCredito.length,
            cuentas: cuentas.length,
            proveedores: proveedores.length,
          }}
        />

        {/* Dynamic Main Workspace */}
        <main className="flex-1 p-6 overflow-y-auto w-full min-w-0">
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
                    Últimas Cajas Menores Registradas
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
            <TarjetasCreditoList
              tarjetasCredito={tarjetasCredito}
              onSelectTarjetaCredito={setSelectedTarjetaCredito}
              onOpenNuevaModal={() => window.open('/formulario-tarjetas-credito', '_blank')}
              onUpdateStatus={(id, st) => handleUpdateStatusTarjeta(id, st)}
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
      {isNuevaModalOpen && (
        <NuevaLegalizacionModal
          isOpen={isNuevaModalOpen}
          onClose={() => setIsNuevaModalOpen(false)}
          cuentas={cuentas}
          proveedores={proveedores}
          onSave={handleSaveNueva}
        />
      )}

      {selectedLegalizacion && (
        <LegalizacionDetailModal
          legalizacion={selectedLegalizacion}
          onClose={() => setSelectedLegalizacion(null)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}

      {isNuevaTarjetaModalOpen && (
        <NuevaTarjetaCreditoModal
          isOpen={isNuevaTarjetaModalOpen}
          onClose={() => setIsNuevaTarjetaModalOpen(false)}
          cuentas={cuentas}
          proveedores={proveedores}
          onSave={handleSaveNuevaTarjeta}
        />
      )}

      {selectedTarjetaCredito && (
        <TarjetaCreditoDetailModal
          tarjetaCredito={selectedTarjetaCredito}
          onClose={() => setSelectedTarjetaCredito(null)}
          onUpdateStatus={handleUpdateStatusTarjeta}
        />
      )}
    </div>
  );
}
