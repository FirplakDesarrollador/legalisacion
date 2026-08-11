'use client';

import React from 'react';
import { BarChart3, PieChart, ShieldCheck, Download } from 'lucide-react';
import { Legalizacion, CuentaContable } from '@/types/legalizaciones';

interface ReportesViewProps {
  legalizaciones: Legalizacion[];
  cuentas: CuentaContable[];
}

export const ReportesView: React.FC<ReportesViewProps> = ({
  legalizaciones,
  cuentas,
}) => {
  const formatCOP = (num: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const totalGastado = legalizaciones.reduce((acc, l) => acc + l.totalGastos, 0);

  const breakdownByCuenta: { [key: string]: number } = {};
  legalizaciones.forEach((leg) => {
    leg.lineas.forEach((lin) => {
      const title = lin.cuentaTitulo || 'Otras Cuentas';
      breakdownByCuenta[title] = (breakdownByCuenta[title] || 0) + lin.valorTotal;
    });
  });

  const sortedBreakdown = Object.entries(breakdownByCuenta).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" /> Reporte de Ejecución Presupuestal & Viáticos
          </h2>
          <p className="text-xs text-slate-500">Análisis detallado de distribución por cuentas contables de Supabase</p>
        </div>

        <button
          onClick={() => alert('Exportación en Excel/PDF iniciada')}
          className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm"
        >
          <Download className="w-4 h-4 text-blue-600" /> Exportar Reporte
        </button>
      </div>

      {/* Grid Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Breakdown by Account */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-600" /> Gastos por Cuenta Contable
            </h3>
            <span className="text-xs font-mono font-bold text-blue-700">{formatCOP(totalGastado)}</span>
          </div>

          <div className="space-y-3">
            {sortedBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No hay datos de gastos registrados.</p>
            ) : (
              sortedBreakdown.map(([cuenta, monto]) => {
                const percentage = totalGastado > 0 ? Math.round((monto / totalGastado) * 100) : 0;
                return (
                  <div key={cuenta} className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span className="truncate max-w-md">{cuenta}</span>
                      <span className="font-mono text-blue-700 font-bold">{formatCOP(monto)} ({percentage}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Audit Status */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" /> Estado de Auditoría
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="text-slate-600 font-sans font-medium">Total Legalizaciones</span>
              <span className="text-slate-900 font-bold">{legalizaciones.length}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <span className="text-emerald-700 font-sans font-medium">Aprobadas</span>
              <span className="text-emerald-700 font-bold">
                {legalizaciones.filter((l) => l.estado === 'aprobado').length}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
              <span className="text-amber-700 font-sans font-medium">Pendientes</span>
              <span className="text-amber-700 font-bold">
                {legalizaciones.filter((l) => l.estado === 'pendiente').length}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
              <span className="text-rose-700 font-sans font-medium">Rechazadas</span>
              <span className="text-rose-700 font-bold">
                {legalizaciones.filter((l) => l.estado === 'rechazado').length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
