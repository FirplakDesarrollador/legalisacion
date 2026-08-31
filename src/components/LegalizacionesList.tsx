'use client';

import React, { useState } from 'react';
import { Eye, CheckCircle2, XCircle, Clock, PlusCircle, Search, Send, Database, Loader2, UserPlus } from 'lucide-react';
import { Legalizacion } from '@/types/legalizaciones';
import { supabase, updateLegalizacionGestionContable } from '@/lib/supabase';

interface LegalizacionesListProps {
  legalizaciones: Legalizacion[];
  onSelectLegalizacion: (leg: Legalizacion) => void;
  onOpenNuevaModal: () => void;
  onUpdateStatus: (id: string, estado: Legalizacion['estado']) => void;
}

export const LegalizacionesList: React.FC<LegalizacionesListProps> = ({
  legalizaciones,
  onSelectLegalizacion,
  onOpenNuevaModal,
  onUpdateStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'todas' | 'pendiente' | 'aprobado' | 'rechazado' | 'pagado'>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ [id: string]: { success: boolean; message: string; docEntry?: number } }>({});
  const [localGestion, setLocalGestion] = useState<{ [id: string]: 'Por procesar' | 'Procesado' }>({});
  const [localFechaProcesado, setLocalFechaProcesado] = useState<{ [id: string]: string | null }>({});

  const handleGestionChange = async (id: string, nuevoValor: 'Por procesar' | 'Procesado') => {
    const nowIso = nuevoValor === 'Procesado' ? new Date().toISOString() : null;
    setLocalGestion((prev) => ({ ...prev, [id]: nuevoValor }));
    setLocalFechaProcesado((prev) => ({ ...prev, [id]: nowIso }));
    updateLegalizacionGestionContable(id, nuevoValor, nowIso);

    try {
      await supabase
        .from('legalizaciones cajas menores')
        .update({
          gestion_contable: nuevoValor,
          gestionContable: nuevoValor,
          fecha_procesado: nowIso,
          fechaProcesado: nowIso,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    } catch (e) {
      console.warn('Nota: Supabase gestion_contable guardado en almacenamiento local.');
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

  const filtered = legalizaciones.filter((l) => {
    const matchesTab = activeTab === 'todas' ? true : l.estado === activeTab;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      l.codigo.toLowerCase().includes(term) ||
      l.usuarioNombre.toLowerCase().includes(term) ||
      l.motivo.toLowerCase().includes(term) ||
      l.centroCosto.toLowerCase().includes(term);
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
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          {[
            { id: 'todas', label: 'Todas', count: legalizaciones.length },
            { id: 'pendiente', label: 'Pendientes', count: legalizaciones.filter((l) => l.estado === 'pendiente').length },
            { id: 'aprobado', label: 'Aprobadas', count: legalizaciones.filter((l) => l.estado === 'aprobado').length },
            { id: 'rechazado', label: 'Rechazadas', count: legalizaciones.filter((l) => l.estado === 'rechazado').length },
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
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
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
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 shrink-0 transition-all"
            title="Crear Proveedor de Contado"
          >
            <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" /> Crear proveedor de contado
          </a>
          <button
            onClick={onOpenNuevaModal}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 shrink-0 transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" /> Nueva
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto custom-scrollbar shadow-sm">
        <table className="w-full min-w-[1250px] text-left text-xs text-slate-700 whitespace-nowrap">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-4 text-center">Acciones</th>
              <th className="py-3.5 px-4">Código / Fecha</th>
              <th className="py-3.5 px-4">Solicitante</th>
              <th className="py-3.5 px-4">Motivo / Centro Costo</th>
              <th className="py-3.5 px-4 text-right">Fondo Caja</th>
              <th className="py-3.5 px-4 text-right">Total Gastos</th>
              <th className="py-3.5 px-4 text-right">Saldo en Caja</th>
              <th className="py-3.5 px-4">Estado</th>
              <th className="py-3.5 px-4">Gestión Contable</th>
              <th className="py-3.5 px-4">Fecha de Procesado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-400">
                  No hay cajas menores para mostrar en este estado.
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
                    <p className="font-bold text-blue-900 font-mono">{leg.codigo}</p>
                    <p className="text-[10px] text-slate-400">{leg.fecha}</p>
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
                  <td className="py-3.5 px-4">{getStatusPill(leg.estado)}</td>
                  <td className="py-3.5 px-4">
                    <select
                      value={localGestion[leg.id] ?? leg.gestionContable ?? 'Por procesar'}
                      onChange={(e) => handleGestionChange(leg.id, e.target.value as any)}
                      className={`text-xs font-semibold rounded-lg px-2.5 py-1 border transition-all cursor-pointer shadow-xs ${
                        (localGestion[leg.id] ?? leg.gestionContable) === 'Procesado'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-500 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-800 border-amber-300 focus:ring-amber-500 hover:bg-amber-100'
                      }`}
                    >
                      <option value="Por procesar">⏳ Por procesar</option>
                      <option value="Procesado">✅ Procesado</option>
                    </select>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
