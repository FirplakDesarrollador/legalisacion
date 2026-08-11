'use client';

import React from 'react';
import { DollarSign, Clock, CheckCircle2, ArrowUpRight, ArrowDownRight, Database, Users } from 'lucide-react';
import { Legalizacion } from '@/types/legalizaciones';
import { HealthCheckResult } from '@/lib/supabase';

interface KpiStatsProps {
  legalizaciones: Legalizacion[];
  cuentasCount: number;
  proveedoresCount: number;
  health: HealthCheckResult | null;
}

export const KpiStats: React.FC<KpiStatsProps> = ({
  legalizaciones,
  cuentasCount,
  proveedoresCount,
  health,
}) => {
  const formatCOP = (num: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const totalGastos = legalizaciones.reduce((acc, l) => acc + l.totalGastos, 0);
  const pendientes = legalizaciones.filter((l) => l.estado === 'pendiente');
  const pendientesMonto = pendientes.reduce((acc, l) => acc + l.totalGastos, 0);

  const saldoFavorEmpleado = legalizaciones
    .filter((l) => l.saldoDiferencia > 0)
    .reduce((acc, l) => acc + l.saldoDiferencia, 0);
  const saldoFavorEmpresa = legalizaciones
    .filter((l) => l.saldoDiferencia < 0)
    .reduce((acc, l) => acc + Math.abs(l.saldoDiferencia), 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Card 1: Total Legalizado */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
        <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
          <DollarSign className="w-5 h-5 stroke-[2.5]" />
        </div>
        <p className="text-xs font-semibold text-slate-500">Total Gastos Legalizados</p>
        <h3 className="text-xl font-bold text-slate-900 mt-2 font-mono">{formatCOP(totalGastos)}</h3>
        <div className="mt-3 flex items-center gap-1 text-[11px] text-blue-600 font-semibold">
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>{legalizaciones.length} legalizaciones procesadas</span>
        </div>
      </div>

      {/* Card 2: Pendientes por Aprobar */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
        <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
          <Clock className="w-5 h-5 stroke-[2.5]" />
        </div>
        <p className="text-xs font-semibold text-slate-500">Por Revisar / Aprobar</p>
        <h3 className="text-xl font-bold text-amber-600 mt-2 font-mono">{formatCOP(pendientesMonto)}</h3>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
            {pendientes.length} pendientes
          </span>
          <span>esperando dictamen</span>
        </div>
      </div>

      {/* Card 3: Saldos y Reembolsos */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
        <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
          <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
        </div>
        <p className="text-xs font-semibold text-slate-500">Saldos Netos por Liquidar</p>
        <div className="mt-2 space-y-1 font-mono">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-sans flex items-center gap-1 text-[11px]">
              <ArrowUpRight className="w-3 h-3 text-emerald-600" /> A pagar empleado:
            </span>
            <span className="text-emerald-700 font-bold">{formatCOP(saldoFavorEmpleado)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-sans flex items-center gap-1 text-[11px]">
              <ArrowDownRight className="w-3 h-3 text-blue-600" /> A devolver empresa:
            </span>
            <span className="text-blue-700 font-bold">{formatCOP(saldoFavorEmpresa)}</span>
          </div>
        </div>
      </div>

      {/* Card 4: Supabase Data Health */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
        <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
          <Database className="w-5 h-5 stroke-[2.5]" />
        </div>
        <p className="text-xs font-semibold text-slate-500">Catálogos Supabase</p>
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">Cuentas Contables:</span>
            <span className="text-indigo-700 font-bold font-mono">{cuentasCount} en BD</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px] flex items-center gap-1">
              <Users className="w-3 h-3 text-slate-400" /> Proveedores / NIT:
            </span>
            <span className="text-indigo-700 font-bold font-mono">{proveedoresCount} en BD</span>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
          <span>Tablas activas en REST / Postgres</span>
        </div>
      </div>
    </div>
  );
};
