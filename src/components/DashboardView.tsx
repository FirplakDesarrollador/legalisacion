'use client';

import React, { useState, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  SlidersHorizontal,
  Wallet,
  Receipt,
  FileText,
  AlertCircle,
  Calendar,
  ChevronDown,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Legalizacion, TarjetaCredito } from '@/types/legalizaciones';
import { TabType } from '@/components/Sidebar';

interface DashboardViewProps {
  legalizaciones?: Legalizacion[];
  tarjetasCredito?: TarjetaCredito[];
  gastos?: Legalizacion[];
  onSelectTab?: (tab: TabType) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  legalizaciones = [],
  tarjetasCredito = [],
  gastos = [],
  onSelectTab,
}) => {
  // Date filter state for historical table
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1); // 1-12

  // Helper: Determine if item is "Por Procesar"
  const isItemPorProcesar = (item: Legalizacion | TarjetaCredito) => {
    const isAprobado = item.estado === 'aprobado' || item.estado === 'pagado';
    if (!isAprobado) return false;
    const gestion = String(item.gestionContable ?? '').toLowerCase().trim();
    return gestion !== 'procesado';
  };

  // Helper: Determine if item is older than 2 days (> 48h)
  const isOlderThan2Days = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr).getTime();
    if (isNaN(d)) return false;
    const now = Date.now();
    return (now - d) >= 2 * 24 * 60 * 60 * 1000;
  };

  // Compute stats per module
  const stats = useMemo(() => {
    // 1. Cajas Menores
    const cmPorAprobar = legalizaciones.filter((l) => l.estado === 'pendiente');
    const cmPorProcesar = legalizaciones.filter(isItemPorProcesar);
    const cmPorAprobarVencidas = cmPorAprobar.filter((l) => isOlderThan2Days(l.created_at || l.fecha));
    const cmPorProcesarVencidas = cmPorProcesar.filter((l) =>
      isOlderThan2Days(l.fechaAprobacion || l.updated_at || l.created_at || l.fecha)
    );
    const cmProcesadas = legalizaciones.filter(
      (l) => String(l.gestionContable ?? '').toLowerCase().trim() === 'procesado'
    );

    // 2. Tarjetas de Crédito
    const tcPorAprobar = tarjetasCredito.filter((t) => t.estado === 'pendiente');
    const tcPorProcesar = tarjetasCredito.filter(isItemPorProcesar);
    const tcPorAprobarVencidas = tcPorAprobar.filter((t) => isOlderThan2Days(t.created_at || t.fecha));
    const tcPorProcesarVencidas = tcPorProcesar.filter((t) =>
      isOlderThan2Days(t.fechaAprobacion || t.updated_at || t.created_at || t.fecha)
    );
    const tcProcesadas = tarjetasCredito.filter(
      (t) => String(t.gestionContable ?? '').toLowerCase().trim() === 'procesado'
    );

    // 3. Legalización de Gastos
    const gPorAprobar = gastos.filter((g) => g.estado === 'pendiente');
    const gPorProcesar = gastos.filter(isItemPorProcesar);
    const gPorAprobarVencidas = gPorAprobar.filter((g) => isOlderThan2Days(g.created_at || g.fecha));
    const gPorProcesarVencidas = gPorProcesar.filter((g) =>
      isOlderThan2Days(g.fechaAprobacion || g.updated_at || g.created_at || g.fecha)
    );
    const gProcesadas = gastos.filter(
      (g) => String(g.gestionContable ?? '').toLowerCase().trim() === 'procesado'
    );

    // Totals
    const totalPorAprobar = cmPorAprobar.length + tcPorAprobar.length + gPorAprobar.length;
    const totalPorProcesar = cmPorProcesar.length + tcPorProcesar.length + gPorProcesar.length;
    const totalPorProcesarVencidas =
      cmPorProcesarVencidas.length + tcPorProcesarVencidas.length + gPorProcesarVencidas.length;
    const totalVencidas = cmPorAprobarVencidas.length + tcPorAprobarVencidas.length + gPorAprobarVencidas.length;
    const totalProcesadas = cmProcesadas.length + tcProcesadas.length + gProcesadas.length;

    // All pending items across modules
    const allPending = [...cmPorAprobar, ...tcPorAprobar, ...gPorAprobar];

    return {
      cajasMenores: {
        total: legalizaciones.length,
        porAprobar: cmPorAprobar.length,
        porProcesar: cmPorProcesar.length,
        porProcesarVencidas: cmPorProcesarVencidas.length,
        vencidas: cmPorAprobarVencidas.length,
        procesadas: cmProcesadas.length,
      },
      tarjetasCredito: {
        total: tarjetasCredito.length,
        porAprobar: tcPorAprobar.length,
        porProcesar: tcPorProcesar.length,
        porProcesarVencidas: tcPorProcesarVencidas.length,
        vencidas: tcPorAprobarVencidas.length,
        procesadas: tcProcesadas.length,
      },
      gastos: {
        total: gastos.length,
        porAprobar: gPorAprobar.length,
        porProcesar: gPorProcesar.length,
        porProcesarVencidas: gPorProcesarVencidas.length,
        vencidas: gPorAprobarVencidas.length,
        procesadas: gProcesadas.length,
      },
      totalPorAprobar,
      totalPorProcesar,
      totalPorProcesarVencidas,
      totalVencidas,
      totalProcesadas,
      allPending,
    };
  }, [legalizaciones, tarjetasCredito, gastos]);

  // Modules list configuration
  const moduleCards = [
    {
      id: 'legalizaciones' as TabType,
      title: 'Cajas Menores',
      icon: SlidersHorizontal,
      porAprobar: stats.cajasMenores.porAprobar,
      porProcesar: stats.cajasMenores.porProcesar,
      porProcesarVencidas: stats.cajasMenores.porProcesarVencidas,
      vencidas: stats.cajasMenores.vencidas,
    },
    {
      id: 'cajas_menores' as TabType,
      title: 'Tarjetas de crédito',
      icon: Wallet,
      porAprobar: stats.tarjetasCredito.porAprobar,
      porProcesar: stats.tarjetasCredito.porProcesar,
      porProcesarVencidas: stats.tarjetasCredito.porProcesarVencidas,
      vencidas: stats.tarjetasCredito.vencidas,
    },
    {
      id: 'gastos' as TabType,
      title: 'Legalizaciones de gastos',
      icon: Receipt,
      porAprobar: stats.gastos.porAprobar,
      porProcesar: stats.gastos.porProcesar,
      porProcesarVencidas: stats.gastos.porProcesarVencidas,
      vencidas: stats.gastos.vencidas,
    },
  ];

  // Group pending documents by Person (aprobadorNombre / usuarioNombre)
  const personsRanking = useMemo(() => {
    const map: { [key: string]: number } = {};
    stats.allPending.forEach((item) => {
      let raw = (item.aprobadorNombre || item.usuarioNombre || 'Sin Asignar').trim();
      // Clean name: take first name or short name
      const parts = raw.split(/\s+/);
      const name = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase() : 'Sin Asignar';
      map[name] = (map[name] || 0) + 1;
    });

    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [stats.allPending]);

  // Compute maximums for scaling charts
  const maxTaskVal = useMemo(() => {
    const vals = moduleCards.flatMap((m) => [m.porAprobar, m.porProcesar]);
    const m = Math.max(...vals, 10);
    return Math.ceil(m / 10) * 10;
  }, [moduleCards]);

  const maxPersonVal = useMemo(() => {
    const vals = personsRanking.map((p) => p.count);
    const m = Math.max(...vals, 5);
    return Math.ceil(m / 5) * 5;
  }, [personsRanking]);

  // Historical Daily Table Data
  const dailyHistory = useMemo(() => {
    const allItems = [
      ...legalizaciones.map((l) => ({ ...l, tipo: 'CM' })),
      ...tarjetasCredito.map((t) => ({ ...t, tipo: 'TC' })),
      ...gastos.map((g) => ({ ...g, tipo: 'Gasto' })),
    ];

    // Group items by date string (YYYY-MM-DD)
    const byDate: {
      [dateKey: string]: {
        nuevas: number;
        porAprobar: number;
        porProcesar: number;
        vencidas: number;
        procesadas: number;
      };
    } = {};

    allItems.forEach((item) => {
      const dStr = item.created_at || item.fecha;
      if (!dStr) return;
      try {
        const d = new Date(dStr);
        if (isNaN(d.getTime())) return;
        const year = d.getFullYear();
        const month = d.getMonth() + 1;

        if (year === selectedYear && month === selectedMonth) {
          const key = d.toISOString().split('T')[0];
          if (!byDate[key]) {
            byDate[key] = {
              nuevas: 0,
              porAprobar: 0,
              porProcesar: 0,
              vencidas: 0,
              procesadas: 0,
            };
          }
          byDate[key].nuevas += 1;
          if (item.estado === 'pendiente') {
            byDate[key].porAprobar += 1;
            if (isOlderThan2Days(item.created_at || item.fecha)) {
              byDate[key].vencidas += 1;
            }
          }
          if (isItemPorProcesar(item)) {
            byDate[key].porProcesar += 1;
          }
          if (String(item.gestionContable ?? '').toLowerCase().trim() === 'procesado') {
            byDate[key].procesadas += 1;
          }
        }
      } catch {
        // ignore parse error
      }
    });

    const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

    let accumulatedNuevas = 0;
    let accumulatedProcesadas = 0;

    // Sort ascending temporarily to calculate accumulated, then reverse
    const ascendingDates = [...dates].reverse();
    const rows = ascendingDates.map((dateKey) => {
      const row = byDate[dateKey];
      accumulatedNuevas += row.nuevas;
      accumulatedProcesadas += row.procesadas;
      return {
        fecha: dateKey,
        nuevasHoy: row.nuevas,
        acumuladasMes: accumulatedNuevas,
        gestionadasHoy: row.procesadas,
        totalGestionadasMes: accumulatedProcesadas,
        totalPorAprobar: row.porAprobar,
        alertasVencidas: row.vencidas,
        totalPorProcesar: row.porProcesar,
        totalDigitadas: row.procesadas,
      };
    });

    return rows.reverse();
  }, [legalizaciones, tarjetasCredito, gastos, selectedYear, selectedMonth]);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top 3 Main Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: TOTAL POR APROBAR */}
        <div className="bg-gradient-to-br from-amber-50/50 via-white to-white border border-amber-200/80 rounded-2xl p-6 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">
              Total Por Aprobar
            </span>
            <div className="text-4xl md:text-5xl font-extrabold text-amber-600 tracking-tight">
              {stats.totalPorAprobar}
            </div>
            <p className="text-xs text-amber-700/80 font-medium pt-1">
              Documentos esperando revisión del doliente
            </p>
          </div>
          <div className="w-14 h-14 rounded-full border-2 border-amber-200 bg-amber-50/50 flex items-center justify-center text-amber-500 shadow-xs shrink-0">
            <Clock className="w-7 h-7 stroke-[2]" />
          </div>
        </div>

        {/* Card 2: TOTAL POR PROCESAR */}
        <div className="bg-gradient-to-br from-blue-50/50 via-white to-white border border-blue-200/80 rounded-2xl p-6 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
              Total Por Procesar
            </span>
            <div className="text-4xl md:text-5xl font-extrabold text-blue-600 tracking-tight">
              {stats.totalPorProcesar}
            </div>
            <p className="text-xs text-blue-700/80 font-medium pt-1">
              Documentos listos para contabilidad o SAP
            </p>
          </div>
          <div className="w-14 h-14 rounded-full border-2 border-blue-200 bg-blue-50/50 flex items-center justify-center text-blue-500 shadow-xs shrink-0">
            <CheckCircle2 className="w-7 h-7 stroke-[2]" />
          </div>
        </div>

        {/* Card 3: POR PROCESAR (+2 DÍAS) */}
        <div className="bg-gradient-to-br from-rose-50/50 via-white to-white border border-rose-200/80 rounded-2xl p-6 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block">
              Por Procesar (+2 Días)
            </span>
            <div className="text-4xl md:text-5xl font-extrabold text-rose-600 tracking-tight">
              {stats.totalPorProcesarVencidas}
            </div>
            <p className="text-xs text-rose-700/80 font-medium pt-1">
              Aprobados esperando gestión hace más de 48h
            </p>
          </div>
          <div className="w-14 h-14 rounded-full border-2 border-rose-200 bg-rose-50/50 flex items-center justify-center text-rose-500 shadow-xs shrink-0">
            <AlertCircle className="w-7 h-7 stroke-[2]" />
          </div>
        </div>
      </div>

      {/* Section: Carga Operativa por Módulo */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Carga Operativa por Módulo
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {moduleCards.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.id}
                onClick={() => onSelectTab && onSelectTab(m.id)}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between"
                title={`Ir a ${m.title}`}
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-slate-100/80 border border-slate-200/80 flex items-center justify-center text-slate-600 shadow-2xs group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide mt-3.5 mb-4">
                    {m.title}
                  </h4>
                </div>

                <div className="space-y-2">
                  {/* Por Aprobar */}
                  <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-medium text-amber-900">
                      Por Aprobar
                    </span>
                    <span className="font-bold text-amber-600 text-sm">
                      {m.porAprobar}
                    </span>
                  </div>

                  {/* Por Procesar */}
                  <div className="bg-blue-50/70 border border-blue-200/60 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-medium text-blue-900">
                      Por Procesar
                    </span>
                    <span className="font-bold text-blue-600 text-sm">
                      {m.porProcesar}
                    </span>
                  </div>

                  {/* +2 Días (Por Procesar) */}
                  <div className="bg-rose-50/70 border border-rose-200/60 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-medium text-rose-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-rose-500" />
                      +2 Días (Por Procesar)
                    </span>
                    <span className="font-bold text-rose-600 text-sm">
                      {m.porProcesarVencidas}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Middle Visual Charts Grid (2 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 1: Distribución de Tareas */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between min-h-[360px]">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-6">
              Distribución de Tareas
            </h3>

            {/* Bars Area */}
            <div className="relative h-52 flex items-end justify-around pt-6 pb-2 px-2 border-b border-slate-200">
              {/* Background Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-4">
                {[maxTaskVal, Math.round(maxTaskVal * 0.75), Math.round(maxTaskVal * 0.5), Math.round(maxTaskVal * 0.25), 0].map((val, idx) => (
                  <div key={idx} className="w-full border-b border-dashed border-slate-200/70 flex items-center justify-between">
                    <span className="text-[9px] font-mono text-slate-400 pl-1">{val}</span>
                  </div>
                ))}
              </div>

              {/* Module Bars */}
              {moduleCards.map((m) => {
                const pctAprobar = maxTaskVal > 0 ? Math.min(100, Math.round((m.porAprobar / maxTaskVal) * 100)) : 0;
                const pctProcesar = maxTaskVal > 0 ? Math.min(100, Math.round((m.porProcesar / maxTaskVal) * 100)) : 0;

                return (
                  <div key={m.id} className="relative z-10 flex flex-col items-center">
                    <div className="flex items-end gap-2 h-44">
                      {/* Bar Por Aprobar */}
                      <div className="flex flex-col items-center justify-end h-full group relative">
                        <span className="text-[10px] font-bold text-amber-600 mb-1">
                          {m.porAprobar}
                        </span>
                        <div
                          style={{ height: `${Math.max(pctAprobar, m.porAprobar > 0 ? 6 : 0)}%` }}
                          className="w-7 sm:w-9 bg-amber-500 rounded-t-md hover:bg-amber-600 transition-all shadow-xs cursor-pointer"
                          title={`${m.title} - Por Aprobar: ${m.porAprobar}`}
                        />
                      </div>

                      {/* Bar Por Procesar */}
                      <div className="flex flex-col items-center justify-end h-full group relative">
                        <span className="text-[10px] font-bold text-blue-600 mb-1">
                          {m.porProcesar}
                        </span>
                        <div
                          style={{ height: `${Math.max(pctProcesar, m.porProcesar > 0 ? 6 : 0)}%` }}
                          className="w-7 sm:w-9 bg-blue-600 rounded-t-md hover:bg-blue-700 transition-all shadow-xs cursor-pointer"
                          title={`${m.title} - Por Procesar: ${m.porProcesar}`}
                        />
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700 text-center mt-2.5">
                      {m.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 pt-4 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-amber-500" />
              <span>Por Aprobar</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-blue-600" />
              <span>Por Procesar</span>
            </div>
          </div>
        </div>

        {/* Chart 2: Por Aprobar por Persona */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between min-h-[360px]">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Por Aprobar por Persona
              </h3>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 uppercase tracking-wider">
                Total General: {stats.totalPorAprobar}
              </span>
            </div>

            {/* Bars Area */}
            {personsRanking.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 stroke-[1.5]" />
                <p className="font-semibold text-slate-600">¡No hay documentos pendientes por aprobar!</p>
                <p className="text-[11px] text-slate-400">Todas las legalizaciones se encuentran al día.</p>
              </div>
            ) : (
              <div className="relative h-56 flex items-end justify-around pt-6 pb-12 px-2 border-b border-slate-200">
                {/* Background Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-12">
                  {[maxPersonVal, Math.round(maxPersonVal * 0.75), Math.round(maxPersonVal * 0.5), Math.round(maxPersonVal * 0.25), 0].map((val, idx) => (
                    <div key={idx} className="w-full border-b border-dashed border-slate-200/70 flex items-center justify-between">
                      <span className="text-[9px] font-mono text-slate-400 pl-0.5">{val}</span>
                    </div>
                  ))}
                </div>

                {/* Person Bars */}
                {personsRanking.map((person, idx) => {
                  const pct = maxPersonVal > 0 ? Math.min(100, Math.round((person.count / maxPersonVal) * 100)) : 0;
                  return (
                    <div key={idx} className="relative z-10 flex flex-col items-center h-full justify-end group">
                      <span className="text-[10px] font-bold text-amber-600 mb-1">
                        {person.count}
                      </span>
                      <div
                        style={{ height: `${Math.max(pct, 6)}%` }}
                        className="w-5 sm:w-6 bg-amber-500 rounded-t-sm hover:bg-amber-600 transition-all shadow-xs cursor-pointer"
                        title={`${person.name}: ${person.count} pendientes`}
                      />
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-slate-600 whitespace-nowrap transform -rotate-45 origin-top-left">
                          {person.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-2 pt-6 text-xs font-semibold text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Documentos Por Aprobar ({stats.totalPorAprobar})</span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Registro Diario (Historial) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Registro Diario (Historial)
          </h3>

          <div className="flex items-center gap-2">
            {/* Year Selector */}
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="appearance-none bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 pl-3 pr-7 py-1.5 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
              >
                {[2024, 2025, 2026, 2027].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Month Selector */}
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="appearance-none bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 pl-3 pr-7 py-1.5 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
              >
                {monthNames.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            <button
              onClick={() => {
                const now = new Date();
                setSelectedYear(now.getFullYear());
                setSelectedMonth(now.getMonth() + 1);
              }}
              title="Restablecer a fecha actual"
              className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-slate-50 transition-colors"
            >
              <Clock className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl custom-scrollbar">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-3 py-3 text-center">Nuevas (Hoy)</th>
                <th className="px-3 py-3 text-center">Acumuladas (Mes)</th>
                <th className="px-3 py-3 text-center">Gestionadas (Hoy)</th>
                <th className="px-3 py-3 text-center">Total Gestionadas (Mes)</th>
                <th className="px-3 py-3 text-center">Total Por Aprobar</th>
                <th className="px-3 py-3 text-center">Alertas (+2 Días)</th>
                <th className="px-3 py-3 text-center">Total Por Procesar</th>
                <th className="px-3 py-3 text-center">Total Digitadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {dailyHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-xs">
                    No hay registros de movimientos para {monthNames[selectedMonth - 1]} de {selectedYear}.
                  </td>
                </tr>
              ) : (
                dailyHistory.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-slate-900">
                      {row.fecha}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        +{row.nuevasHoy}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        {row.acumuladasMes}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        ✓ {row.gestionadasHoy}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100/70 text-amber-800 border border-amber-300">
                        Σ {row.totalGestionadasMes}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        {row.totalPorAprobar}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {row.alertasVencidas > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          🚫 {row.alertasVencidas}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {row.totalPorProcesar}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {row.totalDigitadas}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
