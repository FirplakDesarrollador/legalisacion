'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Sidebar, TabType } from '@/components/Sidebar';
import { DashboardView } from '@/components/DashboardView';
import { LegalizacionesList } from '@/components/LegalizacionesList';
import { LegalizacionDetailModal } from '@/components/LegalizacionDetailModal';
import { NuevaLegalizacionModal } from '@/components/NuevaLegalizacionModal';
import { TarjetasCreditoList } from '@/components/TarjetasCreditoList';
import { TarjetaCreditoDetailModal } from '@/components/TarjetaCreditoDetailModal';
import { NuevaTarjetaCreditoModal } from '@/components/NuevaTarjetaCreditoModal';
import { GastosList } from '@/components/GastosList';
import { GastoDetailModal } from '@/components/GastoDetailModal';
import { NuevaGastoModal } from '@/components/NuevaGastoModal';
import { ProveedoresTable } from '@/components/ProveedoresTable';
import { CuentasTable } from '@/components/CuentasTable';
import { ReportesView } from '@/components/ReportesView';
import { LoginView } from '@/components/LoginView';
import { matchesItemSearch } from '@/lib/searchUtils';
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
  updateTarjetaCreditoGestionContable,
  fetchLegalizacionesTarjetasCreditoFromSupabase,
  fetchLegalizacionesGastosFromSupabase,
  getLocalLegalizacionesGastos,
  saveLocalLegalizacionGasto,
  updateLegalizacionGastoStatus,
  updateLegalizacionGastoGestionContable,
  updateLegalizacionGastoPagoCruce,
  updateLegalizacionGestionContable,
  getLocalCajasMenores,
  saveLocalCajaMenor,
  agregarMovimientoCaja,
  HealthCheckResult,
  supabase,
  normalizeDigitador,
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
  const [gastos, setGastos] = useState<Legalizacion[]>([]);
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loadingSupabase, setLoadingSupabase] = useState(true);

  // Modals state
  const [isNuevaModalOpen, setIsNuevaModalOpen] = useState(false);
  const [selectedLegalizacion, setSelectedLegalizacion] = useState<Legalizacion | null>(null);
  
  const [isNuevaTarjetaModalOpen, setIsNuevaTarjetaModalOpen] = useState(false);
  const [selectedTarjetaCredito, setSelectedTarjetaCredito] = useState<TarjetaCredito | null>(null);

  const [isNuevaGastoModalOpen, setIsNuevaGastoModalOpen] = useState(false);
  const [selectedGasto, setSelectedGasto] = useState<Legalizacion | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Helper: Identificar el digitador activo a partir del usuario autenticado
  const getDigitadorFromCurrentUser = (): string => {
    if (!currentUser) return 'Mateo';
    const norm = normalizeDigitador(currentUser.name || currentUser.email);
    if (norm) return norm;
    return currentUser.name || currentUser.email?.split('@')[0] || 'Mateo';
  };

  // Check active Supabase session on mount
  useEffect(() => {
    async function checkAuthSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          const u = data.session.user;
          const userObj = {
            email: u.email || 'usuario@firplak.com',
            name: u.user_metadata?.nombre || u.email?.split('@')[0] || 'Usuario Autenticado',
            role: 'Administrador Tesorería',
          };
          setCurrentUser(userObj);
        } else {
          const savedLocalUser = localStorage.getItem('legalisa_active_user');
          if (savedLocalUser) {
            const parsed = JSON.parse(savedLocalUser);
            setCurrentUser(parsed);
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

  // Setup deep linking for Tarjetas de Crédito and Gastos
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tcId = params.get('tc_id');
      if (tcId && tarjetasCredito.length > 0) {
        const found = tarjetasCredito.find(tc => tc.id === tcId || tc.codigo === tcId);
        if (found && !selectedTarjetaCredito) {
          setActiveTab('cajas_menores');
          setSelectedTarjetaCredito(found);
        }
      }

      const gastoId = params.get('gasto_id');
      if (gastoId && gastos.length > 0) {
        const foundGasto = gastos.find(g => g.id === gastoId || g.codigo === gastoId);
        if (foundGasto && !selectedGasto) {
          setActiveTab('gastos');
          setSelectedGasto(foundGasto);
        }
      }
    }
  }, [tarjetasCredito, selectedTarjetaCredito, gastos, selectedGasto]);

  // Logout handler
  const handleLogout = () => {
    supabase.auth.signOut().catch(() => {});
    localStorage.removeItem('legalisa_active_user');
    setCurrentUser(null);
  };

  const loadSupabaseData = useCallback(async () => {
    setLoadingSupabase(true);
    try {
      const [hResult, cData, pData, tcData, legData, gastosData] = await Promise.all([
        checkSupabaseHealth(),
        fetchCuentasFromSupabase(),
        fetchProveedoresFromSupabase(),
        fetchLegalizacionesTarjetasCreditoFromSupabase(),
        fetchLegalizacionesFromSupabase(),
        fetchLegalizacionesGastosFromSupabase(),
      ]);

      setHealth(hResult);
      setCuentas(cData);
      setProveedores(pData);
      if (tcData && tcData.length > 0) {
        setTarjetasCredito(tcData);
        if (typeof window !== 'undefined') {
          localStorage.setItem('app_tarjetas_credito_data_v1', JSON.stringify(tcData));
        }
      }
      if (legData && legData.length > 0) {
        setLegalizaciones(legData);
        if (typeof window !== 'undefined') {
          localStorage.setItem('app_legalizaciones_data_v1', JSON.stringify(legData));
        }
      }
      if (gastosData && gastosData.length > 0) {
        setGastos(gastosData);
        if (typeof window !== 'undefined') {
          localStorage.setItem('app_legalizaciones_gastos_data_v1', JSON.stringify(gastosData));
        }
      }
    } catch (err) {
      console.error('Error cargando datos Supabase:', err);
    } finally {
      setLoadingSupabase(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      const localLegs = getLocalLegalizaciones();
      if (localLegs && localLegs.length > 0) {
        setLegalizaciones(localLegs);
      }
      setTarjetasCredito(getLocalTarjetasCredito());
      setGastos(getLocalLegalizacionesGastos());
      loadSupabaseData();
    }
  }, [currentUser, loadSupabaseData]);

  // Escuchar cuando el sincronizador automático procesa registros para refrescar las listas
  useEffect(() => {
    const handleSapSynced = () => {
      loadSupabaseData();
    };
    window.addEventListener('sap-records-synced', handleSapSynced);
    return () => window.removeEventListener('sap-records-synced', handleSapSynced);
  }, [loadSupabaseData]);

  const handleSaveNueva = (nueva: Legalizacion) => {
    setLegalizaciones((prev) => [nueva, ...prev.filter((l) => l.id !== nueva.id)]);
    saveLocalLegalizacion(nueva);
    setActiveTab('legalizaciones');
  };

  const handleUpdateStatus = (id: string, nuevoEstado: Legalizacion['estado'], observaciones?: string) => {
    updateLegalizacionStatus(id, nuevoEstado, observaciones);
    setLegalizaciones((prev) => {
      const next = prev.map((l) =>
        l.id === id
          ? {
              ...l,
              estado: nuevoEstado,
              observacionesAprobacion: observaciones || l.observacionesAprobacion,
              fechaAprobacion: nuevoEstado === 'aprobado' ? new Date().toISOString() : l.fechaAprobacion,
              updated_at: new Date().toISOString(),
            }
          : l
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_legalizaciones_data_v1', JSON.stringify(next));
      }
      return next;
    });
    if (selectedLegalizacion && selectedLegalizacion.id === id) {
      setSelectedLegalizacion((prev) => (prev ? { ...prev, estado: nuevoEstado, observacionesAprobacion: observaciones } : null));
    }
  };

  const handleSaveNuevaTarjeta = (nueva: TarjetaCredito) => {
    saveLocalTarjetaCredito(nueva);
    setTarjetasCredito((prev) => [nueva, ...prev.filter((t) => t.id !== nueva.id)]);
    setActiveTab('cajas_menores');
  };

  const handleUpdateStatusTarjeta = (id: string, nuevoEstado: TarjetaCredito['estado'], observaciones?: string) => {
    updateTarjetaCreditoStatus(id, nuevoEstado, observaciones);
    setTarjetasCredito((prev) => {
      const next = prev.map((t) =>
        t.id === id
          ? {
              ...t,
              estado: nuevoEstado,
              observacionesAprobacion: observaciones || t.observacionesAprobacion,
              fechaAprobacion: nuevoEstado === 'aprobado' ? new Date().toISOString() : t.fechaAprobacion,
              updated_at: new Date().toISOString(),
            }
          : t
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_tarjetas_credito_data_v1', JSON.stringify(next));
      }
      return next;
    });
    if (selectedTarjetaCredito && selectedTarjetaCredito.id === id) {
      setSelectedTarjetaCredito((prev) => (prev ? { ...prev, estado: nuevoEstado, observacionesAprobacion: observaciones } : null));
    }
  };

  const handleSaveNuevaGasto = (nueva: Legalizacion) => {
    setGastos((prev) => [nueva, ...prev.filter((g) => g.id !== nueva.id)]);
    saveLocalLegalizacionGasto(nueva);
    setActiveTab('gastos');
  };

  const handleUpdateGastoStatus = (id: string, nuevoEstado: Legalizacion['estado'], observaciones?: string) => {
    updateLegalizacionGastoStatus(id, nuevoEstado, observaciones);
    setGastos((prev) => {
      const next = prev.map((g) =>
        g.id === id
          ? {
              ...g,
              estado: nuevoEstado,
              observacionesAprobacion: observaciones || g.observacionesAprobacion,
              fechaAprobacion: nuevoEstado === 'aprobado' ? new Date().toISOString() : g.fechaAprobacion,
              updated_at: new Date().toISOString(),
            }
          : g
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_legalizaciones_gastos_data_v1', JSON.stringify(next));
      }
      return next;
    });
    if (selectedGasto && selectedGasto.id === id) {
      setSelectedGasto((prev) => (prev ? { ...prev, estado: nuevoEstado, observacionesAprobacion: observaciones } : null));
    }
  };

  const handleUpdateGastoGestionContable = (id: string, gestion: 'Por procesar' | 'Procesado', customDigitador?: string) => {
    const nowIso = gestion === 'Procesado' ? new Date().toISOString() : null;
    const digitador = gestion === 'Procesado' ? (customDigitador || getDigitadorFromCurrentUser()) : undefined;
    updateLegalizacionGastoGestionContable(id, gestion, nowIso, digitador);
    setGastos((prev) => {
      const next = prev.map((g) =>
        g.id === id
          ? {
              ...g,
              gestionContable: gestion,
              fechaProcesado: nowIso || undefined,
              procesadoPor: digitador,
              updated_at: new Date().toISOString(),
            }
          : g
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_legalizaciones_gastos_data_v1', JSON.stringify(next));
      }
      return next;
    });
    if (selectedGasto && selectedGasto.id === id) {
      setSelectedGasto((prev) => (prev ? { ...prev, gestionContable: gestion, fechaProcesado: nowIso || undefined, procesadoPor: digitador } : null));
    }
  };

  const handleUpdateGastoPagoCruce = (id: string, gestionado: boolean) => {
    updateLegalizacionGastoPagoCruce(id, gestionado);
    setGastos((prev) => {
      const next = prev.map((g) =>
        g.id === id
          ? {
              ...g,
              pagoCruceGestionado: gestionado,
              fechaPagoCruce: gestionado ? new Date().toISOString() : undefined,
              updated_at: new Date().toISOString(),
            }
          : g
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_legalizaciones_gastos_data_v1', JSON.stringify(next));
      }
      return next;
    });
    if (selectedGasto && selectedGasto.id === id) {
      setSelectedGasto((prev) => (prev ? { ...prev, pagoCruceGestionado: gestionado, fechaPagoCruce: gestionado ? new Date().toISOString() : undefined } : null));
    }
  };

  const handleUpdateTarjetaGestionContable = (id: string, gestion: 'Por procesar' | 'Procesado', customDigitador?: string) => {
    const nowIso = gestion === 'Procesado' ? new Date().toISOString() : null;
    const digitador = gestion === 'Procesado' ? (customDigitador || getDigitadorFromCurrentUser()) : undefined;
    updateTarjetaCreditoGestionContable(id, gestion, nowIso, digitador);
    setTarjetasCredito((prev) => {
      const next = prev.map((tc) =>
        tc.id === id
          ? {
              ...tc,
              gestionContable: gestion,
              fechaProcesado: nowIso || undefined,
              procesadoPor: digitador,
              updated_at: new Date().toISOString(),
            }
          : tc
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_tarjetas_credito_data_v1', JSON.stringify(next));
      }
      return next;
    });
    if (selectedTarjetaCredito && selectedTarjetaCredito.id === id) {
      setSelectedTarjetaCredito((prev) => (prev ? { ...prev, gestionContable: gestion, fechaProcesado: nowIso || undefined, procesadoPor: digitador } : null));
    }
  };

  const handleUpdateLegalizacionGestionContable = (id: string, gestion: 'Por procesar' | 'Procesado', customDigitador?: string) => {
    const nowIso = gestion === 'Procesado' ? new Date().toISOString() : null;
    const digitador = gestion === 'Procesado' ? (customDigitador || getDigitadorFromCurrentUser()) : undefined;
    updateLegalizacionGestionContable(id, gestion, nowIso, digitador);
    setLegalizaciones((prev) => {
      const next = prev.map((l) =>
        l.id === id
          ? {
              ...l,
              gestionContable: gestion,
              fechaProcesado: nowIso || undefined,
              procesadoPor: digitador,
              updated_at: new Date().toISOString(),
            }
          : l
      );
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_legalizaciones_data_v1', JSON.stringify(next));
      }
      return next;
    });
    if (selectedLegalizacion && selectedLegalizacion.id === id) {
      setSelectedLegalizacion((prev) => (prev ? { ...prev, gestionContable: gestion, fechaProcesado: nowIso || undefined, procesadoPor: digitador } : null));
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

  // Count matching items for sidebar badges when searchTerm is active
  const matchingLegsCount = useMemo(() => {
    if (!searchTerm.trim()) return legalizaciones.length;
    return legalizaciones.filter((l) => matchesItemSearch(l, searchTerm)).length;
  }, [legalizaciones, searchTerm]);

  const matchingTCCount = useMemo(() => {
    if (!searchTerm.trim()) return tarjetasCredito.length;
    return tarjetasCredito.filter((t) => matchesItemSearch(t, searchTerm)).length;
  }, [tarjetasCredito, searchTerm]);

  const matchingGastosCount = useMemo(() => {
    if (!searchTerm.trim()) return gastos.length;
    return gastos.filter((g) => matchesItemSearch(g, searchTerm)).length;
  }, [gastos, searchTerm]);

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
          onOpenNuevaModal={() => {
            if (activeTab === 'gastos') setIsNuevaGastoModalOpen(true);
            else if (activeTab === 'cajas_menores') setIsNuevaTarjetaModalOpen(true);
            else setIsNuevaModalOpen(true);
          }}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((prev) => !prev)}
          counts={{
            legalizaciones: matchingLegsCount,
            cajasMenores: matchingTCCount,
            gastos: matchingGastosCount,
            cuentas: cuentas.length,
            proveedores: proveedores.length,
          }}
        />

        {/* Dynamic Main Workspace */}
        <main className="flex-1 p-6 overflow-y-auto w-full min-w-0">
          {searchTerm.trim() !== '' && activeTab === 'dashboard' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-2xl shadow-sm text-xs text-blue-900 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-sm text-blue-950 flex items-center gap-2">
                    <Search className="w-4 h-4 text-blue-600" />
                    Búsqueda global: "{searchTerm}"
                  </p>
                  <p className="text-slate-600 text-xs mt-0.5">
                    Coincidencias en cabeceras y cada línea de gasto (facturas, NITs, proveedores, conceptos):
                  </p>
                </div>
                <button
                  onClick={() => setSearchTerm('')}
                  className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-white border border-rose-200 rounded-xl hover:bg-rose-50 transition-colors self-start sm:self-auto cursor-pointer"
                >
                  Limpiar búsqueda
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => setActiveTab('legalizaciones')}
                  className="px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-blue-800 font-semibold hover:bg-blue-100 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Cajas Menores:</span>
                  <span className="font-bold px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px]">
                    {matchingLegsCount}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('cajas_menores')}
                  className="px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-blue-800 font-semibold hover:bg-blue-100 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Tarjetas de Crédito:</span>
                  <span className="font-bold px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px]">
                    {matchingTCCount}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('gastos')}
                  className="px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-blue-800 font-semibold hover:bg-blue-100 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Legalizaciones de Gastos:</span>
                  <span className="font-bold px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px]">
                    {matchingGastosCount}
                  </span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              legalizaciones={legalizaciones}
              tarjetasCredito={tarjetasCredito}
              gastos={gastos}
              onSelectTab={setActiveTab}
            />
          )}

          {activeTab === 'legalizaciones' && (
            <LegalizacionesList
              legalizaciones={legalizaciones}
              globalSearch={searchTerm}
              onClearGlobalSearch={() => setSearchTerm('')}
              onSelectLegalizacion={setSelectedLegalizacion}
              onOpenNuevaModal={() => setIsNuevaModalOpen(true)}
              onUpdateStatus={(id, st) => handleUpdateStatus(id, st)}
              onUpdateGestionContable={handleUpdateLegalizacionGestionContable}
            />
          )}

          {activeTab === 'cajas_menores' && (
            <TarjetasCreditoList
              tarjetasCredito={tarjetasCredito}
              globalSearch={searchTerm}
              onClearGlobalSearch={() => setSearchTerm('')}
              onSelectTarjetaCredito={setSelectedTarjetaCredito}
              onOpenNuevaModal={() => window.open('/formulario-tarjetas-credito', '_blank')}
              onUpdateStatus={(id, st) => handleUpdateStatusTarjeta(id, st)}
              onUpdateGestionContable={handleUpdateTarjetaGestionContable}
            />
          )}

          {activeTab === 'gastos' && (
            <GastosList
              gastos={gastos}
              globalSearch={searchTerm}
              onClearGlobalSearch={() => setSearchTerm('')}
              onSelectGasto={setSelectedGasto}
              onOpenNuevaModal={() => setIsNuevaGastoModalOpen(true)}
              onUpdateStatus={(id, st) => handleUpdateGastoStatus(id, st)}
              onUpdateGestionContable={(id, g) => handleUpdateGastoGestionContable(id, g)}
              onUpdatePagoCruce={handleUpdateGastoPagoCruce}
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
          onUpdateGestionContable={handleUpdateLegalizacionGestionContable}
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
          onUpdateGestionContable={handleUpdateTarjetaGestionContable}
        />
      )}

      {isNuevaGastoModalOpen && (
        <NuevaGastoModal
          isOpen={isNuevaGastoModalOpen}
          onClose={() => setIsNuevaGastoModalOpen(false)}
          cuentas={cuentas}
          proveedores={proveedores}
          onSave={handleSaveNuevaGasto}
        />
      )}

      {selectedGasto && (
        <GastoDetailModal
          gasto={selectedGasto}
          onClose={() => setSelectedGasto(null)}
          onUpdateStatus={handleUpdateGastoStatus}
          onUpdatePagoCruce={handleUpdateGastoPagoCruce}
          onUpdateGestionContable={handleUpdateGastoGestionContable}
        />
      )}
    </div>
  );
}
