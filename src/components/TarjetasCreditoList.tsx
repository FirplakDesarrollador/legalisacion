'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Eye, CheckCircle2, XCircle, Clock, PlusCircle, Search, Send, Database, Loader2, UserPlus, ChevronLeft, ChevronRight, Copy, Check, Filter, X } from 'lucide-react';
import { TarjetaCredito } from '@/types/tarjetasCredito';
import { supabase, updateTarjetaCreditoGestionContable, fetchTarjetasCreditoResponsablesFromSupabase } from '@/lib/supabase';
import { matchesItemSearch } from '@/lib/searchUtils';

interface TarjetasCreditoListProps {
  tarjetasCredito: TarjetaCredito[];
  onSelectTarjetaCredito: (leg: TarjetaCredito) => void;
  onOpenNuevaModal: () => void;
  onUpdateStatus: (id: string, estado: TarjetaCredito['estado']) => void;
  onUpdateGestionContable?: (id: string, nuevoValor: 'Por procesar' | 'Procesado') => void;
  defaultTab?: 'por_aprobar' | 'por_procesar' | 'historico';
  globalSearch?: string;
  onClearGlobalSearch?: () => void;
}

export const TarjetasCreditoList: React.FC<TarjetasCreditoListProps> = ({
  tarjetasCredito,
  onSelectTarjetaCredito,
  onOpenNuevaModal,
  onUpdateStatus,
  onUpdateGestionContable,
  defaultTab = 'por_aprobar',
  globalSearch = '',
  onClearGlobalSearch,
}) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'por_aprobar' | 'por_procesar' | 'historico'>(defaultTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ [id: string]: { success: boolean; message: string; docEntry?: number } }>({});
  const [localGestion, setLocalGestion] = useState<{ [id: string]: 'Por procesar' | 'Procesado' }>({});
  const [localFechaProcesado, setLocalFechaProcesado] = useState<{ [id: string]: string | null }>({});
  const [responsables, setResponsables] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Column Filters State
  const [showColumnFilters, setShowColumnFilters] = useState(true);
  const [colFilters, setColFilters] = useState({
    solicitante: '',
    tarjeta: '',
    total: '',
    estado: '',
    gestion: '',
    aprobador: '',
    fechaAprobacion: '',
    fechaProcesado: '',
    creacion: '',
  });

  const activeFilterCount = Object.values(colFilters).filter((v) => v.trim() !== '').length;

  const handleClearColumnFilters = () => {
    setColFilters({
      solicitante: '',
      tarjeta: '',
      total: '',
      estado: '',
      gestion: '',
      aprobador: '',
      fechaAprobacion: '',
      fechaProcesado: '',
      creacion: '',
    });
  };

  const handleCopyLink = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/formulario-tarjetas-credito/${id}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
    }
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const isItemPorProcesar = (l: TarjetaCredito) => {
    if (!l) return false;
    const isAprobado = l.estado === 'aprobado' || l.estado === 'pagado';
    if (!isAprobado) return false;
    const gestion = String(localGestion[l.id] ?? l.gestionContable ?? '').toLowerCase().trim();
    return gestion !== 'procesado';
  };

  const prevPendingCountRef = useRef<number>((tarjetasCredito || []).filter((l) => l && l.estado === 'pendiente').length);

  useEffect(() => {
    const currentPending = (tarjetasCredito || []).filter((l) => l && l.estado === 'pendiente').length;
    if (activeTab === 'por_aprobar' && prevPendingCountRef.current > 0 && currentPending === 0) {
      setActiveTab('historico');
    }
    prevPendingCountRef.current = currentPending;
  }, [tarjetasCredito, activeTab]);

  useEffect(() => {
    if (globalSearch && globalSearch.trim()) {
      const activeMatches = (tarjetasCredito || []).filter((l) => {
        if (!l) return false;
        let mTab = true;
        if (activeTab === 'por_aprobar') mTab = l.estado === 'pendiente';
        else if (activeTab === 'por_procesar') mTab = isItemPorProcesar(l);
        return mTab && matchesItemSearch(l, globalSearch);
      });
      if (activeMatches.length === 0) {
        const hasHistoricoMatches = (tarjetasCredito || []).some((l) => l && matchesItemSearch(l, globalSearch));
        if (hasHistoricoMatches) {
          setActiveTab('historico');
        }
      }
    }
  }, [globalSearch, tarjetasCredito, activeTab]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (tableContainerRef.current) {
      const amount = direction === 'left' ? -350 : 350;
      tableContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    async function loadResp() {
      const data = await fetchTarjetasCreditoResponsablesFromSupabase();
      setResponsables(data);
    }
    loadResp();
  }, []);

  const getAprobador = (leg: TarjetaCredito) => {
    if (leg.aprobadorNombre) return { nombre: leg.aprobadorNombre, email: leg.aprobadorEmail };
    const match = responsables.find(
      (r) =>
        (leg.tarjeta_codigo && r.tarjeta_codigo === leg.tarjeta_codigo) ||
        (leg.motivo && r.tarjeta_codigo && leg.motivo.includes(r.tarjeta_codigo)) ||
        (leg.tc_en_sap && r.tc_en_sap === leg.tc_en_sap)
    );
    if (match) {
      return { nombre: match.responsable_nombre, email: match.responsable_email };
    }
    return { nombre: '—', email: '' };
  };

  const handleGestionChange = async (id: string, nuevoValor: 'Por procesar' | 'Procesado') => {
    const nowIso = nuevoValor === 'Procesado' ? new Date().toISOString() : null;
    setLocalGestion((prev) => ({ ...prev, [id]: nuevoValor }));
    setLocalFechaProcesado((prev) => ({ ...prev, [id]: nowIso }));
    updateTarjetaCreditoGestionContable(id, nuevoValor, nowIso);
    onUpdateGestionContable?.(id, nuevoValor);

    try {
      await supabase
        .from('legalizaciones_tarjetas_credito')
        .update({
          gestion_contable: nuevoValor,
          fecha_procesado: nowIso,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
    } catch (e) {
      console.warn('Nota: Supabase gestion_contable guardado en almacenamiento local.');
    }
  };

  const handleEnviarSAP = async (leg: TarjetaCredito) => {
    setSyncingId(leg.id);
    try {
      const res = await fetch('/api/sap/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leg),
      });
      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new Error(`La respuesta del servidor no es válida (posible error 500 o timeout). Estado HTTP: ${res.status}`);
      }
      setSyncStatus((prev) => ({
        ...prev,
        [leg.id]: {
          success: data.success,
          message: data.message || (data.success ? 'Borrador creado en SAP' : 'Error en SAP'),
          docEntry: data.docEntry,
        },
      }));
      if (data.success) {
        alert(`✅ Borrador creado exitosamente en SAP para ${leg.codigo} (DocEntry: ${data.docEntry || 'OK'})`);
        if (data.docEntry) {
          try {
            await supabase
              .from('legalizaciones_tarjetas_credito')
              .update({ sap_doc_entry: data.docEntry, updated_at: new Date().toISOString() })
              .eq('id', leg.id);
          } catch (e) {}
        }
      } else {
        alert(`❌ Error al enviar a SAP: ${data.message}`);
      }
    } catch (err: any) {
      setSyncStatus((prev) => ({
        ...prev,
        [leg.id]: {
          success: false,
          message: err.message || 'Error de conexión',
        },
      }));
      alert(`❌ Error de conexión con SAP: ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  const formatCOP = (num: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatFecha = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString.split('T')[0] || isoString;
      return d.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const formatHora = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };


  const filtered = (tarjetasCredito || []).filter((l) => {
    if (!l) return false;
    let matchesTab = true;
    if (activeTab === 'por_aprobar') {
      matchesTab = l.estado === 'pendiente';
    } else if (activeTab === 'por_procesar') {
      matchesTab = isItemPorProcesar(l);
    } else if (activeTab === 'historico') {
      matchesTab = true;
    }

    const matchesLocalSearch = matchesItemSearch(l, searchTerm);
    const matchesGlobal = !globalSearch || matchesItemSearch(l, globalSearch);
    if (!matchesTab || !matchesLocalSearch || !matchesGlobal) return false;

    // Per-column filters
    if (colFilters.solicitante.trim()) {
      const q = colFilters.solicitante.toLowerCase();
      const match = (l.usuarioNombre || '').toLowerCase().includes(q) || (l.usuarioEmail || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (colFilters.tarjeta.trim()) {
      const q = colFilters.tarjeta.toLowerCase();
      const match =
        (l.motivo || '').toLowerCase().includes(q) ||
        (l.tarjeta_codigo || '').toLowerCase().includes(q) ||
        (l.tc_en_sap || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (colFilters.total.trim()) {
      const q = colFilters.total.replace(/[^0-9]/g, '');
      const valStr = String(l.totalGastos || '');
      if (q && !valStr.includes(q)) return false;
    }
    if (colFilters.estado.trim()) {
      if ((l.estado || '').toLowerCase() !== colFilters.estado.toLowerCase()) return false;
    }
    if (colFilters.gestion.trim()) {
      const currentGestion = String(localGestion[l.id] ?? l.gestionContable ?? '').toLowerCase().trim() === 'procesado' ? 'Procesado' : 'Por procesar';
      if (currentGestion.toLowerCase() !== colFilters.gestion.toLowerCase()) return false;
    }
    if (colFilters.aprobador.trim()) {
      const q = colFilters.aprobador.toLowerCase();
      const ap = getAprobador(l);
      const match = (ap.nombre || '').toLowerCase().includes(q) || (ap.email || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (colFilters.fechaAprobacion.trim()) {
      const q = colFilters.fechaAprobacion.toLowerCase();
      const fStr = formatFecha(l.fechaAprobacion).toLowerCase();
      if (!fStr.includes(q) && !String(l.fechaAprobacion ?? '').toLowerCase().includes(q)) return false;
    }
    if (colFilters.fechaProcesado.trim()) {
      const q = colFilters.fechaProcesado.toLowerCase();
      const fp = localFechaProcesado[l.id] ?? l.fechaProcesado;
      const fStr = formatFecha(fp).toLowerCase();
      if (!fStr.includes(q) && !String(fp ?? '').toLowerCase().includes(q)) return false;
    }
    if (colFilters.creacion.trim()) {
      const q = colFilters.creacion.toLowerCase();
      const fStr = formatFecha(l.created_at || l.fecha).toLowerCase();
      const docStr = String(l.sapDocEntry || '');
      if (!fStr.includes(q) && !docStr.includes(q) && !String(l.created_at ?? '').toLowerCase().includes(q) && !String(l.codigo ?? '').toLowerCase().includes(q)) return false;
    }

    return true;
  });

  const getStatusPill = (estado: TarjetaCredito['estado']) => {
    switch (estado) {
      case 'aprobado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Aprobada
          </span>
        );
      case 'rechazado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 w-fit">
            <XCircle className="w-3 h-3 text-rose-600" /> Rechazada
          </span>
        );
      case 'pagado':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3 text-indigo-600" /> Pagada
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3 text-amber-600" /> Pendiente
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto pb-1 sm:pb-0 shrink-0">
          {[
            { id: 'por_aprobar', label: 'Por aprobar', count: (tarjetasCredito || []).filter((l) => l && l.estado === 'pendiente' && (!globalSearch || matchesItemSearch(l, globalSearch))).length },
            { id: 'por_procesar', label: 'Por procesar', count: (tarjetasCredito || []).filter((l) => l && isItemPorProcesar(l) && (!globalSearch || matchesItemSearch(l, globalSearch))).length },
            { id: 'historico', label: 'Histórico', count: (tarjetasCredito || []).filter((l) => l && (!globalSearch || matchesItemSearch(l, globalSearch))).length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === tab.id ? 'bg-white/20 text-white font-bold' : 'bg-slate-200 text-slate-700'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Actions & Search */}
        <div className="flex items-center gap-2">
          {/* Botones de desplazamiento horizontal rápido */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0" title="Desplazar tabla horizontalmente">
            <button
              type="button"
              onClick={() => handleScroll('left')}
              className="p-1 hover:bg-white hover:shadow-xs rounded-lg text-slate-600 hover:text-blue-600 transition-all cursor-pointer"
              title="Desplazar a la izquierda"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-bold text-slate-400 px-0.5 select-none">&bull;</span>
            <button
              type="button"
              onClick={() => handleScroll('right')}
              className="p-1 hover:bg-white hover:shadow-xs rounded-lg text-slate-600 hover:text-blue-600 transition-all cursor-pointer"
              title="Desplazar a la derecha"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, solicitante, nit, factura..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
            />
          </div>
          {/* Botón Filtros por Columna */}
          <button
            type="button"
            onClick={() => setShowColumnFilters(!showColumnFilters)}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
              activeFilterCount > 0
                ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-xs'
                : showColumnFilters
                ? 'bg-slate-100 border-slate-300 text-slate-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Mostrar u ocultar filtros por columna"
          >
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white font-bold text-[10px]">
                {activeFilterCount}
              </span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={handleClearColumnFilters}
              className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-all shrink-0 cursor-pointer flex items-center gap-1"
              title="Limpiar todos los filtros de columna"
            >
              <X className="w-3 h-3" />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          )}
          <a
            href="https://ingreso-provedores.vercel.app/registro?tipo=contado"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 shrink-0 transition-all"
            title="Crear Proveedor de Contado"
          >
            <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" /> Crear proveedor de contado
          </a>
          <button
            onClick={onOpenNuevaModal}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 shrink-0 transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" /> Nueva
          </button>
        </div>
      </div>

      {/* Global Search Active Banner */}
      {globalSearch && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Búsqueda global activa: <strong className="font-bold text-blue-950">"{globalSearch}"</strong> &bull;{' '}
              <span className="font-semibold text-blue-800">{filtered.length} coincidencias</span> en Tarjetas de Crédito (revisando empleado, motivo, facturas, NITs y cada línea de gasto)
            </span>
          </div>
          {onClearGlobalSearch && (
            <button
              onClick={onClearGlobalSearch}
              className="px-2.5 py-1 text-xs font-bold text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded-xl transition-all cursor-pointer flex items-center gap-1 border border-blue-200 bg-white"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar búsqueda</span>
            </button>
          )}
        </div>
      )}

      {/* Main Table */}
      <div 
        ref={tableContainerRef}
        className="rounded-2xl border border-slate-200 bg-white overflow-auto max-h-[calc(100vh-230px)] min-h-[380px] custom-scrollbar shadow-sm relative"
      >
        <table className="w-full min-w-[1250px] text-left text-xs text-slate-700 whitespace-nowrap">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-xs backdrop-blur-xs">
            <tr>
              <th className="py-3 px-3 text-center">Acciones</th>
              <th className="py-3 px-3">Solicitante</th>
              <th className="py-3 px-3">Tarjeta de Crédito</th>
              <th className="py-3 px-3 text-right">Total Gastos</th>
              <th className="py-3 px-3">Estado</th>
              <th className="py-3 px-3">Gestión Contable</th>
              <th className="py-3 px-3">Aprobador</th>
              <th className="py-3 px-3">Fecha de Aprobación</th>
              <th className="py-3 px-3">Fecha de Procesado</th>
              <th className="py-3 px-3">Borrador / Creación</th>
            </tr>
            {showColumnFilters && (
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-normal">
                <th className="py-1 px-2 text-center">
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={handleClearColumnFilters}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 cursor-pointer"
                      title="Limpiar filtros"
                    >
                      Limpiar
                    </button>
                  )}
                </th>
                <th className="py-1 px-2">
                  <input
                    type="text"
                    value={colFilters.solicitante}
                    onChange={(e) => setColFilters((prev) => ({ ...prev, solicitante: e.target.value }))}
                    placeholder="Filtrar solicitante..."
                    className="w-full px-2 py-0.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 font-normal"
                  />
                </th>
                <th className="py-1 px-2">
                  <input
                    type="text"
                    value={colFilters.tarjeta}
                    onChange={(e) => setColFilters((prev) => ({ ...prev, tarjeta: e.target.value }))}
                    placeholder="Filtrar tarjeta..."
                    className="w-full px-2 py-0.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 font-normal"
                  />
                </th>
                <th className="py-1 px-2">
                  <input
                    type="text"
                    value={colFilters.total}
                    onChange={(e) => setColFilters((prev) => ({ ...prev, total: e.target.value }))}
                    placeholder="Monto..."
                    className="w-full px-2 py-0.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 font-normal text-right"
                  />
                </th>
                <th className="py-1 px-2">
                  <select
                    value={colFilters.estado}
                    onChange={(e) => setColFilters((prev) => ({ ...prev, estado: e.target.value }))}
                    className="w-full px-1 py-0.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 font-normal"
                  >
                    <option value="">Todos</option>
                    <option value="aprobado">Aprobada</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="rechazado">Rechazada</option>
                    <option value="pagado">Pagada</option>
                  </select>
                </th>
                <th className="py-1 px-2">
                  <select
                    value={colFilters.gestion}
                    onChange={(e) => setColFilters((prev) => ({ ...prev, gestion: e.target.value }))}
                    className="w-full px-1 py-0.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 font-normal"
                  >
                    <option value="">Todos</option>
                    <option value="Por procesar">Por procesar</option>
                    <option value="Procesado">Procesado</option>
                  </select>
                </th>
                <th className="py-1 px-2">
                  <input
                    type="text"
                    value={colFilters.aprobador}
                    onChange={(e) => setColFilters((prev) => ({ ...prev, aprobador: e.target.value }))}
                    placeholder="Filtrar aprobador..."
                    className="w-full px-2 py-0.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 font-normal"
                  />
                </th>
                <th className="py-1 px-2">
                  <input
                    type="text"
                    value={colFilters.fechaAprobacion}
                    onChange={(e) => setColFilters((prev) => ({ ...prev, fechaAprobacion: e.target.value }))}
                    placeholder="Fecha apr..."
                    className="w-full px-2 py-0.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 font-normal"
                  />
                </th>
                <th className="py-1 px-2">
                  <input
                    type="text"
                    value={colFilters.fechaProcesado}
                    onChange={(e) => setColFilters((prev) => ({ ...prev, fechaProcesado: e.target.value }))}
                    placeholder="Fecha proc..."
                    className="w-full px-2 py-0.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 font-normal"
                  />
                </th>
                <th className="py-1 px-2">
                  <input
                    type="text"
                    value={colFilters.creacion}
                    onChange={(e) => setColFilters((prev) => ({ ...prev, creacion: e.target.value }))}
                    placeholder="Borrador / Fecha..."
                    className="w-full px-2 py-0.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 font-normal"
                  />
                </th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3 max-w-md mx-auto text-slate-500">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-xs">
                        {activeTab === 'por_aprobar'
                          ? '¡No hay tarjetas de crédito por aprobar!'
                          : activeTab === 'por_procesar'
                          ? '¡No hay tarjetas de crédito por procesar!'
                          : 'No se encontraron tarjetas de crédito'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {activeTab === 'por_aprobar'
                          ? 'Todas las tarjetas de crédito han sido revisadas.'
                          : activeTab === 'por_procesar'
                          ? 'No hay tarjetas de crédito aprobadas pendientes de gestión contable.'
                          : 'No se encontraron registros que coincidan con este filtro o búsqueda.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {activeTab !== 'historico' && (
                        <button
                          onClick={() => setActiveTab('historico')}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
                        >
                          Ver Histórico ({tarjetasCredito.length})
                        </button>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((leg) => (
                <tr key={leg.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onSelectTarjetaCredito(leg)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                        title="Ver Detalle"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Botón Copiar link de aprobación */}
                      <button
                        onClick={(e) => handleCopyLink(leg.id, e)}
                        className={`p-1.5 rounded-lg border transition-all ${
                          copiedId === leg.id
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border-slate-200'
                        }`}
                        title={copiedId === leg.id ? '¡Link de aprobación copiado!' : 'Copiar link de aprobación'}
                      >
                        {copiedId === leg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Botón Enviar a SAP */}
                      <button
                        onClick={() => handleEnviarSAP(leg)}
                        disabled={syncingId === leg.id}
                        className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors disabled:opacity-50 flex items-center gap-1"
                        title="Enviar borrador a SAP Service Layer"
                      >
                        {syncingId === leg.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    {leg.usuarioNombre}
                    <p className="text-[10px] text-slate-500 font-normal">{leg.usuarioEmail}</p>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs">
                    <p className="font-semibold text-slate-900 truncate">{leg.motivo || 'Tarjeta de Crédito'}</p>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    {formatCOP(leg.totalGastos)}
                  </td>
                  <td className="py-3.5 px-4">{getStatusPill(leg.estado)}</td>
                  <td className="py-3.5 px-4">
                    {(() => {
                      const currentGestion = String(localGestion[leg.id] ?? leg.gestionContable ?? '').toLowerCase().trim() === 'procesado' ? 'Procesado' : 'Por procesar';
                      return (
                        <select
                          value={currentGestion}
                          onChange={(e) => handleGestionChange(leg.id, e.target.value as 'Por procesar' | 'Procesado')}
                          className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border transition-all cursor-pointer focus:outline-none focus:ring-2 shadow-xs ${
                            currentGestion === 'Procesado'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-500 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-800 border-amber-300 focus:ring-amber-500 hover:bg-amber-100'
                          }`}
                        >
                          <option value="Por procesar">⏳ Por procesar</option>
                          <option value="Procesado">✅ Procesado</option>
                        </select>
                      );
                    })()}
                  </td>
                  <td className="py-3.5 px-4">
                    {(() => {
                      const ap = getAprobador(leg);
                      return (
                        <div>
                          <p className="font-semibold text-slate-900">{ap.nombre}</p>
                          {ap.email && <p className="text-[10px] text-slate-500 font-normal">{ap.email}</p>}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">
                    {leg.estado === 'aprobado' || leg.estado === 'pagado' ? (
                      <div>
                        <p className="font-semibold text-emerald-800">
                          {formatFecha(leg.fechaAprobacion || leg.updated_at)}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatHora(leg.fechaAprobacion || leg.updated_at)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px] font-mono">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">
                    {String(localGestion[leg.id] ?? leg.gestionContable ?? '').toLowerCase().trim() === 'procesado' ? (
                      <div>
                        <p className="font-semibold text-blue-900">
                          {formatFecha(localFechaProcesado[leg.id] ?? leg.fechaProcesado ?? leg.updated_at)}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatHora(localFechaProcesado[leg.id] ?? leg.fechaProcesado ?? leg.updated_at)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px] font-mono">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {(() => {
                      const docEntry = syncStatus[leg.id]?.docEntry || leg.sapDocEntry;
                      return (
                        <div>
                          {docEntry ? (
                            <p className="font-bold text-indigo-900 font-mono">
                              Borrador #{docEntry}
                            </p>
                          ) : null}
                          <p className="text-[10px] text-slate-500">
                            {formatFecha(leg.created_at || leg.fecha)} {formatHora(leg.created_at)}
                          </p>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
