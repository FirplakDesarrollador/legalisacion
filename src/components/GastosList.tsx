'use client';

import React, { useState } from 'react';
import { Eye, CheckCircle2, XCircle, Clock, PlusCircle, Search, Send, Loader2, UserPlus, Receipt } from 'lucide-react';
import { Legalizacion } from '@/types/legalizaciones';

interface GastosListProps {
  gastos: Legalizacion[];
  onSelectGasto: (gasto: Legalizacion) => void;
  onOpenNuevaModal: () => void;
  onUpdateStatus: (id: string, estado: Legalizacion['estado']) => void;
}

export const GastosList: React.FC<GastosListProps> = ({
  gastos,
  onSelectGasto,
  onOpenNuevaModal,
  onUpdateStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'todas' | 'pendiente' | 'aprobado' | 'rechazado' | 'pagado'>('todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ [id: string]: { success: boolean; message: string; docEntry?: number } }>({});

  const handleEnviarSAP = async (gasto: Legalizacion) => {
    setSyncingId(gasto.id);
    try {
      const res = await fetch('/api/sap/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gasto),
      });
      const data = await res.json();
      setSyncStatus((prev) => ({
        ...prev,
        [gasto.id]: {
          success: data.success,
          message: data.message || (data.success ? 'Borrador creado en SAP' : 'Error en SAP'),
          docEntry: data.docEntry,
        },
      }));
      if (data.success) {
        alert(`✅ Borrador creado exitosamente en SAP para ${gasto.codigo} (DocEntry: ${data.docEntry || 'OK'})`);
      } else {
        alert(`❌ Error al enviar a SAP: ${data.message}`);
      }
    } catch (err: any) {
      setSyncStatus((prev) => ({
        ...prev,
        [gasto.id]: {
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

  const counts = {
    todas: gastos.length,
    pendiente: gastos.filter((l) => l.estado === 'pendiente').length,
    aprobado: gastos.filter((l) => l.estado === 'aprobado').length,
    rechazado: gastos.filter((l) => l.estado === 'rechazado').length,
  };

  return (
    <div className="space-y-4">
      {/* Top Header Filters & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {(['todas', 'pendiente', 'aprobado', 'rechazado'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <span>{tab === 'todas' ? 'Todas' : tab === 'pendiente' ? 'Pendientes' : tab === 'aprobado' ? 'Aprobadas' : 'Rechazadas'}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === tab ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {counts[tab]}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2.5 flex-1 max-w-md justify-end">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por código o solicitante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
            />
          </div>

          <a
            href="https://ingreso-provedores.vercel.app/registro?tipo=contado"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all shrink-0"
            title="Crear proveedor de contado"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Crear proveedor de contado</span>
          </a>

          <button
            onClick={onOpenNuevaModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Nueva</span>
          </button>
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs min-w-[1100px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className="py-3.5 px-4 text-center">Acciones</th>
                <th className="py-3.5 px-4">Código / Fecha</th>
                <th className="py-3.5 px-4">Solicitante</th>
                <th className="py-3.5 px-4">Motivo / Centro Costo</th>
                <th className="py-3.5 px-4 text-right">Anticipo</th>
                <th className="py-3.5 px-4 text-right">Total Gastos</th>
                <th className="py-3.5 px-4 text-right">Saldo Neto</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4 text-center">Borrador / Fecha Creación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No hay legalizaciones de gastos para mostrar en este estado.
                  </td>
                </tr>
              ) : (
                filtered.map((leg) => {
                  const hasSap = leg.sapDocEntry || syncStatus[leg.id]?.docEntry;
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

                          {leg.estado === 'pendiente' && (
                            <>
                              <button
                                onClick={() => onUpdateStatus(leg.id, 'aprobado')}
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                                title="Aprobar Rápido"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onUpdateStatus(leg.id, 'rechazado')}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                                title="Rechazar Rápido"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-blue-900 font-mono">{leg.codigo}</p>
                        <p className="text-[10px] text-slate-400">{leg.fecha}</p>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {leg.usuarioNombre}
                        <p className="text-[10px] text-slate-500 font-normal">{leg.usuarioEmail}</p>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="truncate font-medium text-slate-800">{leg.motivo || 'Legalización de Gastos'}</p>
                        <p className="text-[10px] text-blue-600 truncate font-semibold">{leg.centroCosto}</p>
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

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center justify-center">
                          {hasSap ? (
                            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[11px] mb-0.5">
                              Doc: #{leg.sapDocEntry || syncStatus[leg.id]?.docEntry}
                            </span>
                          ) : null}
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
    </div>
  );
};
