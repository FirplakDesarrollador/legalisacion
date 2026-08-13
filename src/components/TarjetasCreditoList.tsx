'use client';

import React, { useState } from 'react';
import { Eye, CheckCircle2, XCircle, Clock, PlusCircle, Search } from 'lucide-react';
import { TarjetaCredito } from '@/types/tarjetasCredito';

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
  const [activeTab, setActiveTab] = useState<'todas' | 'pendiente' | 'aprobado' | 'rechazado' | 'pagado'>('todas');
  const [searchTerm, setSearchTerm] = useState('');

  const formatCOP = (num: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(num);
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
          <button
            onClick={onOpenNuevaModal}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 shrink-0 transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5 stroke-[2.5]" /> Nueva
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-4">Código / Fecha</th>
              <th className="py-3.5 px-4">Solicitante</th>
              <th className="py-3.5 px-4">Motivo / Centro Costo</th>
              <th className="py-3.5 px-4 text-right">Anticipo</th>
              <th className="py-3.5 px-4 text-right">Total Gastos</th>
              <th className="py-3.5 px-4 text-right">Saldo Neto</th>
              <th className="py-3.5 px-4">Estado</th>
              <th className="py-3.5 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  No hay tarjetas de crédito para mostrar en este estado.
                </td>
              </tr>
            ) : (
              filtered.map((leg) => (
                <tr key={leg.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-blue-900 font-mono">{leg.codigo}</p>
                    <p className="text-[10px] text-slate-400">{leg.fecha}</p>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    {leg.usuarioNombre}
                    <p className="text-[10px] text-slate-500 font-normal">{leg.usuarioEmail}</p>
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
                    <span className={leg.saldoDiferencia >= 0 ? 'text-emerald-600' : 'text-blue-600'}>
                      {formatCOP(leg.saldoDiferencia)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">{getStatusPill(leg.estado)}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onSelectTarjetaCredito(leg)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                        title="Ver Detalle"
                      >
                        <Eye className="w-3.5 h-3.5" />
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
