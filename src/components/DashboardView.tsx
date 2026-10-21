'use client';

import React from 'react';
import { LayoutDashboard, Sparkles, TrendingUp, BarChart3, PieChart } from 'lucide-react';

export const DashboardView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Dashboard
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                En blanco
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Panel principal de indicadores y métricas consolidadas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl font-medium">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <span>Módulo inicializado</span>
        </div>
      </div>

      {/* Blank State Canvas */}
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 p-12 text-center flex flex-col items-center justify-center min-h-[420px]">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 shadow-xs">
          <LayoutDashboard className="w-8 h-8 stroke-[1.75]" />
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-1">
          Dashboard en blanco
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed mb-8">
          Este módulo se encuentra listo para incorporar gráficas, KPIs consolidados, resúmenes presupuestales y análisis en tiempo real.
        </p>

        {/* Placeholder Grid to show future layout */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
          <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-slate-400 text-xs flex flex-col items-center justify-center gap-2 min-h-[90px]">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <span className="text-[11px] font-medium">Espacio para Métricas</span>
          </div>
          <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-slate-400 text-xs flex flex-col items-center justify-center gap-2 min-h-[90px]">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <span className="text-[11px] font-medium">Espacio para Gráficas</span>
          </div>
          <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-slate-400 text-xs flex flex-col items-center justify-center gap-2 min-h-[90px]">
            <PieChart className="w-4 h-4 text-slate-400" />
            <span className="text-[11px] font-medium">Espacio para Resumen</span>
          </div>
        </div>
      </div>
    </div>
  );
};
