'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Eye, CheckCircle2, XCircle, Clock, PlusCircle, Search, Send, Database, Loader2, UserPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { TarjetaCredito } from '@/types/tarjetasCredito';
import { supabase, updateTarjetaCreditoGestionContable, fetchTarjetasCreditoResponsablesFromSupabase } from '@/lib/supabase';

interface TarjetasCreditoListProps {
  tarjetasCredito: TarjetaCredito[];
  onSelectTarjetaCredito: (leg: TarjetaCredito) => void;
  onOpenNuevaModal: () => void;
  onUpdateStatus: (id: string, estado: TarjetaCredito['estado']) => void;
}

export const TarjetasCreditoList: React.FC<TarjetasCreditoListProps> = ({
  tarjetasCredito,
  onSelectTarjetaCredito,
  onOpenNuevaModal,
  onUpdateStatus,
}) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'todas' | 'pendiente' | 'aprobado' | 'rechazado' | 'pagado'>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ [id: string]: { success: boolean; message: string; docEntry?: number } }>({});
  const [localGestion, setLocalGestion] = useState<{ [id: string]: 'Por procesar' | 'Procesado' }>({});
  const [localFechaProcesado, setLocalFechaProcesado] = useState<{ [id: string]: string | null }>({});
  const [responsables, setResponsables] = useState<any[]>([]);

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
      const data = await res.json();
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

  const filtered = tarjetasCredito.filter((l) => {
    const matchesTab = activeTab === 'todas' ? true : l.estado === activeTab;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      l.codigo.toLowerCase().includes(term) ||
      l.usuarioNombre.toLowerCase().includes(term) ||
      l.motivo.toLowerCase().includes(term) ||
      l.centroCosto.toLowerCase().includes(term);
    return matchesTab && matchesSearch;
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
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'todas', label: 'Todas', count: tarjetasCredito.length },
            { id: 'pendiente', label: 'Pendientes', count: tarjetasCredito.filter((l) => l.estado === 'pendiente').length },
            { id: 'aprobado', label: 'Aprobadas', count: tarjetasCredito.filter((l) => l.estado === 'aprobado').length },
            { id: 'rechazado', label: 'Rechazadas', count: tarjetasCredito.filter((l) => l.estado === 'rechazado').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
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
              placeholder="Buscar por código o solicitante..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
            />
          </div>
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

      {/* Main Table */}
      <div 
        ref={tableContainerRef}
        className="rounded-2xl border border-slate-200 bg-white overflow-auto max-h-[calc(100vh-230px)] min-h-[380px] custom-scrollbar shadow-sm relative"
      >
        <table className="w-full min-w-[1250px] text-left text-xs text-slate-700 whitespace-nowrap">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-xs backdrop-blur-xs">
            <tr>
              <th className="py-3.5 px-4 text-center">Acciones</th>
              <th className="py-3.5 px-4">Solicitante</th>
              <th className="py-3.5 px-4">Tarjeta de Crédito</th>
              <th className="py-3.5 px-4 text-right">Total Gastos</th>
              <th className="py-3.5 px-4">Estado</th>
              <th className="py-3.5 px-4">Gestión Contable</th>
              <th className="py-3.5 px-4">Aprobador</th>
              <th className="py-3.5 px-4">Fecha de Aprobación</th>
              <th className="py-3.5 px-4">Fecha de Procesado</th>
              <th className="py-3.5 px-4">Borrador / Fecha Creación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-400">
                  No hay tarjetas de crédito para mostrar en este estado.
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
                    <select
                      value={localGestion[leg.id] ?? leg.gestionContable ?? 'Por procesar'}
                      onChange={(e) => handleGestionChange(leg.id, e.target.value as 'Por procesar' | 'Procesado')}
                      className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border transition-all cursor-pointer focus:outline-none focus:ring-2 shadow-xs ${
                        (localGestion[leg.id] ?? leg.gestionContable ?? 'Por procesar') === 'Procesado'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-500 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-800 border-amber-300 focus:ring-amber-500 hover:bg-amber-100'
                      }`}
                    >
                      <option value="Por procesar">⏳ Por procesar</option>
                      <option value="Procesado">✅ Procesado</option>
                    </select>
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
                    {((localGestion[leg.id] ?? leg.gestionContable) === 'Procesado') ? (
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
