'use client';

import React, { useState, useRef } from 'react';
import { Eye, CheckCircle2, XCircle, Clock, PlusCircle, Search, UserPlus, Receipt, Loader2, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { Legalizacion } from '@/types/legalizaciones';
import { supabase } from '@/lib/supabase';

interface GastosListProps {
  gastos: Legalizacion[];
  onSelectGasto: (gasto: Legalizacion) => void;
  onOpenNuevaModal: () => void;
  onUpdateStatus: (id: string, estado: Legalizacion['estado']) => void;
  onUpdateGestionContable?: (id: string, gestion: 'Por procesar' | 'Procesado') => void;
}

export const GastosList: React.FC<GastosListProps> = ({
  gastos,
  onSelectGasto,
  onOpenNuevaModal,
  onUpdateStatus,
  onUpdateGestionContable,
}) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'todas' | 'pendiente' | 'aprobado' | 'rechazado' | 'pagado'>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleScroll = (direction: 'left' | 'right') => {
    if (tableContainerRef.current) {
      const amount = direction === 'left' ? -350 : 350;
      tableContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
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
      const data = await res.json();
      if (data.success) {
        if (data.docEntry) {
          supabase
            .from('legalizaciones_gastos')
            .update({ sap_doc_entry: data.docEntry })
            .eq('id', leg.id)
            .then(() => {});
          leg.sapDocEntry = data.docEntry;
        }
        alert(`✅ Borrador de gasto creado exitosamente en SAP para ${leg.codigo} (DocEntry: ${data.docEntry || 'OK'})`);
      } else {
        alert(`❌ Error al enviar a SAP: ${data.message}`);
      }
    } catch (err: any) {
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

  const formatFecha = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const formatHora = (iso?: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  const filtered = gastos.filter((l) => {
    const matchesTab = activeTab === 'todas' ? true : l.estado === activeTab;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (l.codigo || '').toLowerCase().includes(term) ||
      (l.usuarioNombre || '').toLowerCase().includes(term) ||
      (l.motivo || '').toLowerCase().includes(term) ||
      (l.centroCosto || '').toLowerCase().includes(term);
    return matchesTab && matchesSearch;
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
            <Clock className="w-3 h-3 text-amber-600" /> Pendiente
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-600">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Legalizaciones de Gastos
            </h2>
            <p className="text-xs text-slate-500">
              Control de gastos de viaje, viáticos y representación con imputación contable
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://ingreso-provedores.vercel.app/registro?tipo=contado"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Crear proveedor de contado</span>
          </a>
          <button
            onClick={onOpenNuevaModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Nueva</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto overflow-x-auto">
          {(['todas', 'pendiente', 'aprobado', 'rechazado'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'todas' ? 'Todas' : tab === 'pendiente' ? 'Pendientes' : tab === 'aprobado' ? 'Aprobadas' : 'Rechazadas'}{' '}
              <span className={`text-[10px] ml-1 px-1.5 py-0.2 rounded-full ${
                activeTab === tab ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {tab === 'todas' ? gastos.length : gastos.filter((l) => l.estado === tab).length}
              </span>
            </button>
          ))}
        </div>

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
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por código, solicitante, motivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div 
        ref={tableContainerRef}
        className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-auto max-h-[calc(100vh-230px)] min-h-[380px] custom-scrollbar relative"
      >
        <table className="w-full text-left text-xs min-w-[1250px] whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px] sticky top-0 z-10 shadow-xs backdrop-blur-xs">
              <tr>
                <th className="py-3.5 px-4 text-center">Acciones</th>
                <th className="py-3.5 px-4">Solicitante</th>
                <th className="py-3.5 px-4">Observaciones</th>
                <th className="py-3.5 px-4 text-right">Anticipo</th>
                <th className="py-3.5 px-4 text-right">Total Gastos</th>
                <th className="py-3.5 px-4 text-right">Saldo Neto</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4">Gestión Contable</th>
                <th className="py-3.5 px-4">Fecha de Aprobación</th>
                <th className="py-3.5 px-4">Fecha de Procesado</th>
                <th className="py-3.5 px-4 text-center">Borrador / Fecha Creación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    No hay legalizaciones de gastos para mostrar en este estado.
                  </td>
                </tr>
              ) : (
                filtered.map((leg) => {
                  const hasSap = !!leg.sapDocEntry;
                  const dateStr = leg.created_at ? new Date(leg.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' }) : (leg.fecha || '-');
                  const timeStr = leg.created_at ? new Date(leg.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

                  return (
                    <tr key={leg.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onSelectGasto(leg)}
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
                        <p className="truncate font-medium text-slate-800">{leg.motivo || 'Legalización de Gastos'}</p>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                        {formatCOP(leg.anticipoRecibido)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCOP(leg.totalGastos)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold">
                        <span className={leg.saldoDiferencia >= 0 ? 'text-emerald-600' : 'text-blue-600'}>
                          {formatCOP(leg.saldoDiferencia)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">{getStatusPill(leg.estado)}</td>

                      <td className="py-3.5 px-4">
                        <select
                          value={leg.gestionContable ?? 'Por procesar'}
                          onChange={(e) => onUpdateGestionContable?.(leg.id, e.target.value as 'Por procesar' | 'Procesado')}
                          className={`text-[11px] font-bold rounded-lg px-2.5 py-1 border transition-all cursor-pointer focus:outline-none focus:ring-2 shadow-xs ${
                            (leg.gestionContable ?? 'Por procesar') === 'Procesado'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-500 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-800 border-amber-300 focus:ring-amber-500 hover:bg-amber-100'
                          }`}
                        >
                          <option value="Por procesar">⏳ Por procesar</option>
                          <option value="Procesado">✅ Procesado</option>
                        </select>
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
                        {leg.gestionContable === 'Procesado' && leg.fechaProcesado ? (
                          <div>
                            <p className="font-semibold text-blue-900">
                              {formatFecha(leg.fechaProcesado)}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {formatHora(leg.fechaProcesado)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-mono">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center justify-center">
                          {hasSap ? (
                            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[11px] mb-0.5">
                              Doc: #{leg.sapDocEntry}
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px] mb-0.5">
                              {leg.codigo}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-medium">
                            {dateStr} {timeStr && `• ${timeStr}`}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
