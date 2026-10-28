'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Eye, CheckCircle2, XCircle, Clock, PlusCircle, Search, Send, Database, Loader2, UserPlus, ChevronLeft, ChevronRight, Copy, Check, Filter, X } from 'lucide-react';
import { Legalizacion } from '@/types/legalizaciones';
import { supabase, updateLegalizacionGestionContable } from '@/lib/supabase';
import { matchesItemSearch } from '@/lib/searchUtils';

interface LegalizacionesListProps {
  legalizaciones: Legalizacion[];
  onSelectLegalizacion: (leg: Legalizacion) => void;
  onOpenNuevaModal: () => void;
  onUpdateStatus: (id: string, estado: Legalizacion['estado']) => void;
  onUpdateGestionContable?: (id: string, nuevoValor: 'Por procesar' | 'Procesado') => void;
  defaultTab?: 'por_aprobar' | 'por_procesar' | 'historico';
  globalSearch?: string;
  onClearGlobalSearch?: () => void;
}

export const LegalizacionesList: React.FC<LegalizacionesListProps> = ({
  legalizaciones,
  onSelectLegalizacion,
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Column Filters State
  const [showColumnFilters, setShowColumnFilters] = useState(true);
  const [colFilters, setColFilters] = useState({
    sapFecha: '',
    solicitante: '',
    motivo: '',
    fondo: '',
    total: '',
    saldo: '',
    estado: '',
    gestion: '',
    fechaAprobacion: '',
    fechaProcesado: '',
  });

  const activeFilterCount = Object.values(colFilters).filter((v) => v.trim() !== '').length;

  const handleClearColumnFilters = () => {
    setColFilters({
      sapFecha: '',
      solicitante: '',
      motivo: '',
      fondo: '',
      total: '',
      saldo: '',
      estado: '',
      gestion: '',
      fechaAprobacion: '',
      fechaProcesado: '',
    });
  };

  const handleCopyLink = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/formulario-publico/${id}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
    }
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const isItemPorProcesar = (l: Legalizacion) => {
    if (!l) return false;
    const isAprobado = l.estado === 'aprobado' || l.estado === 'pagado';
    if (!isAprobado) return false;
    const gestion = String(localGestion[l.id] ?? l.gestionContable ?? '').toLowerCase().trim();
    return gestion !== 'procesado';
  };

  const prevPendingCountRef = useRef<number>((legalizaciones || []).filter((l) => l && l.estado === 'pendiente').length);

  useEffect(() => {
    const currentPending = (legalizaciones || []).filter((l) => l && l.estado === 'pendiente').length;
    if (activeTab === 'por_aprobar' && prevPendingCountRef.current > 0 && currentPending === 0) {
      setActiveTab('historico');
    }
    prevPendingCountRef.current = currentPending;
  }, [legalizaciones, activeTab]);

  useEffect(() => {
    if (globalSearch && globalSearch.trim()) {
      const activeMatches = (legalizaciones || []).filter((l) => {
        if (!l) return false;
        let mTab = true;
        if (activeTab === 'por_aprobar') mTab = l.estado === 'pendiente';
        else if (activeTab === 'por_procesar') mTab = isItemPorProcesar(l);
        return mTab && matchesItemSearch(l, globalSearch);
      });
      if (activeMatches.length === 0) {
        const hasHistoricoMatches = (legalizaciones || []).some((l) => l && matchesItemSearch(l, globalSearch));
        if (hasHistoricoMatches) {
          setActiveTab('historico');
        }
      }
    }
  }, [globalSearch, legalizaciones, activeTab]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (tableContainerRef.current) {
      const amount = direction === 'left' ? -350 : 350;
      tableContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const handleGestionChange = async (id: string, nuevoValor: 'Por procesar' | 'Procesado') => {
    const nowIso = nuevoValor === 'Procesado' ? new Date().toISOString() : null;
    const dbValue = nuevoValor === 'Procesado' ? 'procesado' : 'por_procesar';
    setLocalGestion((prev) => ({ ...prev, [id]: nuevoValor }));
    setLocalFechaProcesado((prev) => ({ ...prev, [id]: nowIso }));

    const targetLeg = legalizaciones.find((l) => l.id === id);
    if (targetLeg) {
      targetLeg.gestionContable = nuevoValor;
      targetLeg.fechaProcesado = nowIso || undefined;
    }

    updateLegalizacionGestionContable(id, nuevoValor, nowIso);
    onUpdateGestionContable?.(id, nuevoValor);

    try {
      const { error } = await supabase
        .from('legalizaciones cajas menores')
        .update({
          gestion_contable: dbValue,
          fecha_procesado: nowIso,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('Error actualizando gestion_contable en Supabase:', error);
      }
    } catch (e) {
      console.error('Excepción al actualizar gestion_contable:', e);
    }
  };

  const handleStatusChange = async (leg: Legalizacion, nuevoEstado: Legalizacion['estado']) => {
    if (nuevoEstado === leg.estado) return;
    onUpdateStatus?.(leg.id, nuevoEstado);

    try {
      const link = typeof window !== 'undefined' ? `${window.location.origin}/formulario-publico/${leg.id}` : '';
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: leg.usuarioEmail,
          titulo: `Legalización ${leg.codigo} - ${nuevoEstado === 'aprobado' ? 'Aprobada' : nuevoEstado === 'rechazado' ? 'Rechazada' : 'Actualizada'}`,
          contenido: `El estado de tu legalización de caja menor ${leg.codigo} ha sido actualizado a ${nuevoEstado}.`,
          link: link,
        }),
      }).catch((e) => console.error('Error enviando notificación de estado:', e));
    } catch (e) {
      console.error(e);
    }
  };

  const handleEnviarSAP = async (leg: Legalizacion) => {
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
          leg.sapDocEntry = data.docEntry;
          try {
            await supabase
              .from('legalizaciones cajas menores')
              .update({
                sap_doc_entry: data.docEntry,
                sapDocEntry: data.docEntry,
                updated_at: new Date().toISOString(),
              })
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
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const formatHora = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };


  const filtered = (legalizaciones || []).filter((l) => {
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
    if (colFilters.sapFecha.trim()) {
      const q = colFilters.sapFecha.toLowerCase();
      const sapStr = String(l.sapDocEntry || '');
      const fStr = formatFecha(l.fecha || l.created_at).toLowerCase();
      const cod = (l.codigo || '').toLowerCase();
      if (!sapStr.includes(q) && !fStr.includes(q) && !cod.includes(q)) return false;
    }
    if (colFilters.solicitante.trim()) {
      const q = colFilters.solicitante.toLowerCase();
      const match = (l.usuarioNombre || '').toLowerCase().includes(q) || (l.usuarioEmail || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (colFilters.motivo.trim()) {
      const q = colFilters.motivo.toLowerCase();
      const match = (l.motivo || '').toLowerCase().includes(q) || (l.centroCosto || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (colFilters.fondo.trim()) {
      const q = colFilters.fondo.replace(/[^0-9]/g, '');
      const valStr = String(l.anticipoRecibido || '');
      if (q && !valStr.includes(q)) return false;
    }
    if (colFilters.total.trim()) {
      const q = colFilters.total.replace(/[^0-9]/g, '');
      const valStr = String(l.totalGastos || '');
      if (q && !valStr.includes(q)) return false;
    }
    if (colFilters.saldo.trim()) {
      const q = colFilters.saldo.replace(/[^0-9-]/g, '');
      const valStr = String(l.saldoDiferencia || '');
      if (q && !valStr.includes(q)) return false;
    }
    if (colFilters.estado.trim()) {
      if ((l.estado || '').toLowerCase() !== colFilters.estado.toLowerCase()) return false;
    }
    if (colFilters.gestion.trim()) {
      const currentGestion = String(localGestion[l.id] ?? l.gestionContable ?? '').toLowerCase().trim() === 'procesado' ? 'Procesado' : 'Por procesar';
      if (currentGestion.toLowerCase() !== colFilters.gestion.toLowerCase()) return false;
    }
    if (colFilters.fechaAprobacion.trim()) {
      const q = colFilters.fechaAprobacion.toLowerCase();
      const fp = l.fechaAprobacion || (l as any).fecha_aprobacion;
      const fStr = formatFecha(fp).toLowerCase();
      if (!fStr.includes(q) && !String(fp ?? '').toLowerCase().includes(q)) return false;
    }
    if (colFilters.fechaProcesado.trim()) {
      const q = colFilters.fechaProcesado.toLowerCase();
      const fp = localFechaProcesado[l.id] ?? l.fechaProcesado ?? (l as any).fecha_procesado;
      const fStr = formatFecha(fp).toLowerCase();
      if (!fStr.includes(q) && !String(fp ?? '').toLowerCase().includes(q)) return false;
    }

    return true;
  });

  const getStatusPill = (estado: Legalizacion['estado']) => {
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
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3 text-blue-600" /> Liquidada
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3 text-amber-600 animate-pulse" /> Pendiente
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto shrink-0">
          {[
            { id: 'por_aprobar', label: 'Por aprobar', count: (legalizaciones || []).filter((l) => l && l.estado === 'pendiente' && (!globalSearch || matchesItemSearch(l, globalSearch))).length },
            { id: 'por_procesar', label: 'Por procesar', count: (legalizaciones || []).filter((l) => l && isItemPorProcesar(l) && (!globalSearch || matchesItemSearch(l, globalSearch))).length },
            { id: 'historico', label: 'Histórico', count: (legalizaciones || []).filter((l) => l && (!globalSearch || matchesItemSearch(l, globalSearch))).length },
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
              <span className="font-semibold text-blue-800">{filtered.length} coincidencias</span> en Cajas Menores (revisando empleado, motivo, facturas, NITs y cada línea de gasto)
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
              <th className="py-3 px-3">N° SAP / Fecha</th>
              <th className="py-3 px-3">Solicitante</th>
              <th className="py-3 px-3">Motivo / Centro Costo</th>
              <th className="py-3 px-3 text-right">Fondo Caja</th>
              <th className="py-3 px-3 text-right">Total Gastos</th>
              <th className="py-3 px-3 text-right">Saldo en Caja</th>
              <th className="py-3 px-3">Estado</th>
              <th className="py-3 px-3">Gestión Contable</th>
              <th className="py-3 px-3">Fecha de Aprobación</th>
              <th className="py-3 px-3">Fecha de Procesado</th>
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
                    value={colFilters.sapFecha}
                    onChange={(e) => setColFilters((prev) => ({ ...prev, sapFecha: e.target.value }))}
                    placeholder="SAP / Fecha..."
                    className="w-full px-2 py-0.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 font-normal"
                  />
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
                    value={colFilters.motivo}
                    onChange={(e) => setColFilters((prev) => ({ ...prev, motivo: e.target.value }))}
                    placeholder="Motivo / Centro..."
                    className="w-full px-2 py-0.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 font-normal"
                  />
                </th>
                <th className="py-1 px-2">
                  <input
                    type="text"
                    value={colFilters.fondo}
                    onChange={(e) => setColFilters((prev) => ({ ...prev, fondo: e.target.value }))}
                    placeholder="Fondo..."
                    className="w-full px-2 py-0.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 font-normal text-right"
                  />
                </th>
                <th className="py-1 px-2">
                  <input
                    type="text"
                    value={colFilters.total}
                    onChange={(e) => setColFilters((prev) => ({ ...prev, total: e.target.value }))}
                    placeholder="Gastos..."
                    className="w-full px-2 py-0.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 font-normal text-right"
                  />
                </th>
                <th className="py-1 px-2">
                  <input
                    type="text"
                    value={colFilters.saldo}
                    onChange={(e) => setColFilters((prev) => ({ ...prev, saldo: e.target.value }))}
                    placeholder="Saldo..."
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
                    <option value="pagado">Liquidada</option>
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
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center space-y-3 max-w-md mx-auto text-slate-500">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-xs">
                        {activeTab === 'por_aprobar'
                          ? '¡No hay cajas menores por aprobar!'
                          : activeTab === 'por_procesar'
                          ? '¡No hay cajas menores por procesar!'
                          : 'No se encontraron cajas menores'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {activeTab === 'por_aprobar'
                          ? 'Todas las cajas menores han sido revisadas.'
                          : activeTab === 'por_procesar'
                          ? 'No hay cajas menores aprobadas pendientes de gestión contable.'
                          : 'No se encontraron registros que coincidan con este filtro o búsqueda.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {activeTab !== 'historico' && (
                        <button
                          onClick={() => setActiveTab('historico')}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
                        >
                          Ver Histórico ({legalizaciones.length})
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
                        onClick={() => onSelectLegalizacion(leg)}
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
                  <td className="py-3.5 px-4">
                    {(() => {
                      const docEntry = syncStatus[leg.id]?.docEntry || leg.sapDocEntry;
                      return (
                        <div>
                          {docEntry ? (
                            <p className="font-mono font-bold text-indigo-900 text-xs">
                              SAP #{docEntry}
                            </p>
                          ) : (
                            <p className="font-semibold text-slate-400 text-xs italic">
                              Pendiente SAP
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-0.5">{leg.fecha}</p>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-slate-900">{leg.usuarioNombre}</p>
                    <p className="text-[10px] text-slate-400">{leg.usuarioEmail}</p>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs">
                    <p className="truncate font-medium text-slate-800">{leg.motivo}</p>
                    <p className="text-[10px] text-blue-600 truncate font-semibold">{leg.centroCosto}</p>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                    {formatCOP(leg.anticipoRecibido)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    {formatCOP(leg.totalGastos)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold">
                    <span className={(leg.anticipoRecibido - leg.totalGastos) >= 0 ? 'text-blue-600' : 'text-rose-600'}>
                      {formatCOP(leg.anticipoRecibido - leg.totalGastos)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      value={leg.estado}
                      onChange={(e) => handleStatusChange(leg, e.target.value as Legalizacion['estado'])}
                      className={`text-[11px] font-bold rounded-lg px-2 py-1 border transition-all cursor-pointer shadow-xs focus:outline-none focus:ring-2 ${
                        leg.estado === 'aprobado'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-500 hover:bg-emerald-100'
                          : leg.estado === 'rechazado'
                          ? 'bg-rose-50 text-rose-800 border-rose-300 focus:ring-rose-500 hover:bg-rose-100'
                          : leg.estado === 'pagado'
                          ? 'bg-blue-50 text-blue-800 border-blue-300 focus:ring-blue-500 hover:bg-blue-100'
                          : 'bg-amber-50 text-amber-800 border-amber-300 focus:ring-amber-500 hover:bg-amber-100'
                      }`}
                      title="Cambiar estado manualmente"
                    >
                      <option value="pendiente">⏳ Pendiente</option>
                      <option value="aprobado">✅ Aprobada</option>
                      <option value="rechazado">❌ Rechazada</option>
                      <option value="pagado">💳 Liquidada</option>
                    </select>
                  </td>
                  <td className="py-3.5 px-4">
                    {(() => {
                      const currentGestion = String(localGestion[leg.id] ?? leg.gestionContable ?? '').toLowerCase().trim() === 'procesado' ? 'Procesado' : 'Por procesar';
                      return (
                        <select
                          value={currentGestion}
                          onChange={(e) => handleGestionChange(leg.id, e.target.value as any)}
                          className={`text-xs font-semibold rounded-lg px-2.5 py-1 border transition-all cursor-pointer shadow-xs ${
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
                  <td className="py-3.5 px-4 text-slate-700">
                    {leg.fechaAprobacion ? (
                      <div>
                        <p className="font-semibold text-slate-900">
                          {formatFecha(leg.fechaAprobacion)}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatHora(leg.fechaAprobacion)}
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
