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
import { normalizeDigitador } from '@/lib/supabase';

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

  // Helper: Determine if item is older than 2 business days (excluding Saturdays and Sundays)
  const isOlderThan2BusinessDays = (dateStr?: string) => {
    if (!dateStr) return false;
    const start = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    if (isNaN(start.getTime())) return false;
    const now = new Date();
    if (start >= now) return false;

    // Fast-path: if more than 10 calendar days have passed, it's definitely > 2 business days
    const totalMs = now.getTime() - start.getTime();
    if (totalMs >= 10 * 24 * 60 * 60 * 1000) {
      return true;
    }

    // Count business hours excluding weekends (Saturday = 6, Sunday = 0)
    let businessHours = 0;
    const cur = new Date(start);

    while (cur < now) {
      const day = cur.getDay(); // 0 = Sunday, 6 = Saturday
      if (day !== 0 && day !== 6) {
        businessHours++;
      }
      cur.setTime(cur.getTime() + 60 * 60 * 1000);
    }

    // 2 business days = 48 business hours
    return businessHours >= 48;
  };

  const isOlderThan2Days = isOlderThan2BusinessDays;

  // Helper: Get approval date strictly from approval timestamp (never creation date)
  const getFechaAprobacion = (item: Legalizacion | TarjetaCredito): string | undefined => {
    return item.fechaAprobacion || (item as any).fecha_aprobacion || item.updated_at;
  };

  // Helper: Format date string as YYYY-MM-DD in Colombia timezone (America/Bogota, UTC-5)
  const toColombiaDateString = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    const trimmed = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  };

  // Compute stats per module
  const stats = useMemo(() => {
    // 1. Cajas Menores
    const cmPorAprobar = legalizaciones.filter((l) => l.estado === 'pendiente');
    const cmPorProcesar = legalizaciones.filter(isItemPorProcesar);
    const cmPorAprobarVencidas = cmPorAprobar.filter((l) => isOlderThan2Days(l.created_at || l.fecha));
    const cmPorProcesarVencidas = cmPorProcesar.filter((l) => {
      const fApr = getFechaAprobacion(l);
      return fApr ? isOlderThan2Days(fApr) : false;
    });
    const cmProcesadas = legalizaciones.filter(
      (l) => String(l.gestionContable ?? '').toLowerCase().trim() === 'procesado'
    );

    // 2. Tarjetas de Crédito
    const tcPorAprobar = tarjetasCredito.filter((t) => t.estado === 'pendiente');
    const tcPorProcesar = tarjetasCredito.filter(isItemPorProcesar);
    const tcPorAprobarVencidas = tcPorAprobar.filter((t) => isOlderThan2Days(t.created_at || t.fecha));
    const tcPorProcesarVencidas = tcPorProcesar.filter((t) => {
      const fApr = getFechaAprobacion(t);
      return fApr ? isOlderThan2Days(fApr) : false;
    });
    const tcProcesadas = tarjetasCredito.filter(
      (t) => String(t.gestionContable ?? '').toLowerCase().trim() === 'procesado'
    );

    // 3. Legalización de Gastos
    const gPorAprobar = gastos.filter((g) => g.estado === 'pendiente');
    const gPorProcesar = gastos.filter(isItemPorProcesar);
    const gPorAprobarVencidas = gPorAprobar.filter((g) => isOlderThan2Days(g.created_at || g.fecha));
    const gPorProcesarVencidas = gPorProcesar.filter((g) => {
      const fApr = getFechaAprobacion(g);
      return fApr ? isOlderThan2Days(fApr) : false;
    });
    const gProcesadas = gastos.filter(
      (g) => String(g.gestionContable ?? '').toLowerCase().trim() === 'procesado'
    );

    // Totals
    const totalPorAprobar = cmPorAprobar.length + tcPorAprobar.length + gPorAprobar.length;
    const totalPorAprobarVencidas =
      cmPorAprobarVencidas.length + tcPorAprobarVencidas.length + gPorAprobarVencidas.length;
    const totalPorProcesar = cmPorProcesar.length + tcPorProcesar.length + gPorProcesar.length;
    const totalPorProcesarVencidas =
      cmPorProcesarVencidas.length + tcPorProcesarVencidas.length + gPorProcesarVencidas.length;
    const totalVencidas = totalPorAprobarVencidas;
    const totalProcesadas = cmProcesadas.length + tcProcesadas.length + gProcesadas.length;

    // All pending items across modules
    const allPending = [...cmPorAprobar, ...tcPorAprobar, ...gPorAprobar];

    return {
      cajasMenores: {
        total: legalizaciones.length,
        porAprobar: cmPorAprobar.length,
        porAprobarVencidas: cmPorAprobarVencidas.length,
        porProcesar: cmPorProcesar.length,
        porProcesarVencidas: cmPorProcesarVencidas.length,
        vencidas: cmPorAprobarVencidas.length,
        procesadas: cmProcesadas.length,
      },
      tarjetasCredito: {
        total: tarjetasCredito.length,
        porAprobar: tcPorAprobar.length,
        porAprobarVencidas: tcPorAprobarVencidas.length,
        porProcesar: tcPorProcesar.length,
        porProcesarVencidas: tcPorProcesarVencidas.length,
        vencidas: tcPorAprobarVencidas.length,
        procesadas: tcProcesadas.length,
      },
      gastos: {
        total: gastos.length,
        porAprobar: gPorAprobar.length,
        porAprobarVencidas: gPorAprobarVencidas.length,
        porProcesar: gPorProcesar.length,
        porProcesarVencidas: gPorProcesarVencidas.length,
        vencidas: gPorAprobarVencidas.length,
        procesadas: gProcesadas.length,
      },
      totalPorAprobar,
      totalPorAprobarVencidas,
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
      porAprobarVencidas: stats.cajasMenores.porAprobarVencidas,
      porProcesar: stats.cajasMenores.porProcesar,
      porProcesarVencidas: stats.cajasMenores.porProcesarVencidas,
      vencidas: stats.cajasMenores.vencidas,
    },
    {
      id: 'cajas_menores' as TabType,
      title: 'Tarjetas de crédito',
      icon: Wallet,
      porAprobar: stats.tarjetasCredito.porAprobar,
      porAprobarVencidas: stats.tarjetasCredito.porAprobarVencidas,
      porProcesar: stats.tarjetasCredito.porProcesar,
      porProcesarVencidas: stats.tarjetasCredito.porProcesarVencidas,
      vencidas: stats.tarjetasCredito.vencidas,
    },
    {
      id: 'gastos' as TabType,
      title: 'Legalizaciones de gastos',
      icon: Receipt,
      porAprobar: stats.gastos.porAprobar,
      porAprobarVencidas: stats.gastos.porAprobarVencidas,
      porProcesar: stats.gastos.porProcesar,
      porProcesarVencidas: stats.gastos.porProcesarVencidas,
      vencidas: stats.gastos.vencidas,
    },
  ];

  // Group pending documents strictly by Approver (Responsable por Aprobar, NEVER Solicitante)
  const personsRanking = useMemo(() => {
    // Known Cajas Menores mappings by custodian or cost center
    const CAJAS_MAP: { [key: string]: string } = {
      'carlos mier': 'Edgar Javier Aguilar Rosero',
      'logistica': 'Edgar Javier Aguilar Rosero',
      'renata lainez': 'Maria Camila Jiménez Ochoa',
      'talento': 'Maria Camila Jiménez Ochoa',
      'paula guevara': 'Isabel Cristina Jaramillo Castro',
      'servicio al cliente': 'Isabel Cristina Jaramillo Castro',
      'marcela gomez': 'Juan Esteban Marín Gañan',
      'emergencias sst': 'Juan Esteban Marín Gañan',
      'laura duque': 'Claudia Lorena Duque Alzate',
      'tesoreria': 'Claudia Lorena Duque Alzate',
      'maria elena perez ospina': 'Héctor Jose Chinchilla Trigos',
      'mantenimiento': 'Héctor Jose Chinchilla Trigos',
      'natalia gomez usme': 'Daniela Castro Correa',
      'behome medellin': 'Daniela Castro Correa',
      'hernando tovar mendoza': 'Daniela Castro Correa',
      'behome cali': 'Daniela Castro Correa',
      'victor julio hernandez gonzalez': 'Daniela Castro Correa',
      'firplak home bogota': 'Daniela Castro Correa',
      'analista desarrollo test': 'Analista Desarrollo',
      'mateo benavides test': 'Mateo Benavides',
    };

    // Known Tarjetas mappings by card code
    const TC_MAP: { [code: string]: string } = {
      '1735': 'Luis Escobar Borjas',
      '1738': 'Alejandro Isaza',
      '1597': 'Ismael Correa Restrepo',
      '9472': 'Isabel Cristina Jaramillo Castro',
      '9876': 'Mateo Benavides Rios',
      '4962': 'Mateo Benavides Rios',
      '3680': 'Luis Escobar Borjas',
      '4769': 'Luis Escobar Borjas',
      '9837': 'Luis Escobar Borjas',
      '2354': 'Alejandro Isaza',
      '9463': 'Isabel Isaza',
      '2108': 'Isabel Isaza',
      '9314': 'Ismael Correa Restrepo',
      '8443': 'Gabriel Molina Isaza',
      '8180': 'Edgar Javier Aguilar Rosero',
      '6284': 'Juan Esteban Marín Gañan',
      '0732': 'Omar Cepero',
      '3870': 'Héctor Jose Chinchilla Trigos',
      '5336': 'Maria Camila Jiménez Ochoa',
      '1404': 'Pablo Carrizosa',
      '6171': 'Laura Isabel Duque Lopez',
    };

    const getItemAprobador = (item: Legalizacion | TarjetaCredito): string => {
      // 1. Direct approver if already set on item
      if (item.aprobadorNombre && item.aprobadorNombre.trim() !== '' && item.aprobadorNombre.trim().toLowerCase() !== 'sin asignar') {
        return item.aprobadorNombre.trim();
      }

      // 2. Lookup in Cajas Menores mapping
      const uName = (item.usuarioNombre || '').trim().toLowerCase();
      const cCosto = (item.centroCosto || '').trim().toLowerCase();
      if (CAJAS_MAP[uName]) return CAJAS_MAP[uName];
      if (CAJAS_MAP[cCosto]) return CAJAS_MAP[cCosto];

      // 3. Lookup in Tarjetas mapping
      const tcItem = item as TarjetaCredito;
      const tcCode = tcItem.tarjeta_codigo || (item.motivo?.match(/\[TC:\s*([^\]]+)\]/)?.[1] || '');
      if (tcCode && TC_MAP[tcCode]) return TC_MAP[tcCode];

      // NEVER return item.usuarioNombre (which is the applicant)
      return 'Sin Asignar';
    };

    const formatFriendlyName = (fullName: string): string => {
      const trimmed = fullName.trim();
      if (!trimmed || trimmed.toLowerCase() === 'sin asignar') return 'Sin Asignar';

      // Distinguish clearly between Alejandro Sandoval and Alejandro Isaza
      if (trimmed.toLowerCase().includes('sandoval') || trimmed.toLowerCase().startsWith('ider')) {
        return 'Alejandro S.';
      }
      if (trimmed.toLowerCase().includes('isaza')) {
        return 'Alejandro';
      }

      const parts = trimmed.split(/\s+/);
      return parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase() : 'Sin Asignar';
    };

    const map: { [key: string]: { count: number; fullName: string } } = {};

    stats.allPending.forEach((item) => {
      const full = getItemAprobador(item);
      const friendly = formatFriendlyName(full);
      if (!map[friendly]) {
        map[friendly] = { count: 0, fullName: full };
      }
      map[friendly].count += 1;
    });

    return Object.entries(map)
      .map(([name, data]) => ({ name, count: data.count, fullName: data.fullName }))
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
    const allItems: Array<any> = [
      ...legalizaciones.map((l) => ({ ...l, tipo: 'CM' })),
      ...tarjetasCredito.map((t) => ({ ...t, tipo: 'TC' })),
      ...gastos.map((g) => ({ ...g, tipo: 'Gasto' })),
    ];

    const targetMonthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    const dateSet = new Set<string>();

    // Start tracking strictly from today onwards (2026-10-21)
    const START_DATE = '2026-10-21';

    // Always include today's date if viewing the current month/year
    const todayColombia = toColombiaDateString(new Date().toISOString());
    if (todayColombia.startsWith(targetMonthPrefix) && todayColombia >= START_DATE) {
      dateSet.add(todayColombia);
    }

    allItems.forEach((item) => {
      // 1. Creation date in Colombia time
      const cDate = toColombiaDateString(item.created_at || item.fecha);
      if (cDate && cDate.startsWith(targetMonthPrefix) && cDate >= START_DATE) {
        dateSet.add(cDate);
      }

      // 2. Processed date in Colombia time
      const isProc = String(item.gestionContable ?? item.gestion_contable ?? '').toLowerCase().trim() === 'procesado';
      if (isProc) {
        const pRaw = item.fechaProcesado || item.fecha_procesado || item.updated_at;
        const pDate = toColombiaDateString(pRaw);
        if (pDate && pDate.startsWith(targetMonthPrefix) && pDate >= START_DATE) {
          dateSet.add(pDate);
        }
      }
    });

    const sortedDatesAsc = Array.from(dateSet).sort((a, b) => a.localeCompare(b));

    let accumulatedNuevas = 0;
    let accumulatedGestionadas = 0;

    const rows = sortedDatesAsc.map((dateStr) => {
      // 1. Nuevas hoy: created on this day in Colombia time
      const nuevasHoyItems = allItems.filter(
        (item) => toColombiaDateString(item.created_at || item.fecha) === dateStr
      );
      const nuevasHoy = nuevasHoyItems.length;
      accumulatedNuevas += nuevasHoy;

      // 2. Gestionadas hoy: marked as 'Procesado' on this day in Colombia time
      const gestionadasHoyItems = allItems.filter((item) => {
        const isProc = String(item.gestionContable ?? item.gestion_contable ?? '').toLowerCase().trim() === 'procesado';
        if (!isProc) return false;
        const pRaw = item.fechaProcesado || item.fecha_procesado || item.updated_at;
        return toColombiaDateString(pRaw) === dateStr;
      });
      const gestionadasHoy = gestionadasHoyItems.length;
      accumulatedGestionadas += gestionadasHoy;

      // 3. Total por aprobar created on this date
      const porAprobarItems = nuevasHoyItems.filter((item) => item.estado === 'pendiente');
      const porAprobar = porAprobarItems.length;

      // 4. Alertas +2 días: por aprobar pending > 2 business days
      const alertasVencidas = porAprobarItems.filter((item) =>
        isOlderThan2Days(item.created_at || item.fecha)
      ).length;

      // 5. Total por procesar created on this date
      const porProcesarItems = nuevasHoyItems.filter(isItemPorProcesar);
      const porProcesar = porProcesarItems.length;

      // 6. Por procesar + 2 días: pending processing > 2 business days from approval date
      const porProcesarVencidas = porProcesarItems.filter((item) => {
        const fApr = getFechaAprobacion(item);
        return fApr ? isOlderThan2Days(fApr) : false;
      }).length;

      // 7. Total digitadas: processed on that day
      const totalDigitadas = gestionadasHoy;

      // 8. Digitadas por persona
      const digitadoJulian = gestionadasHoyItems.filter(
        (item) => normalizeDigitador((item as any).procesadoPor || (item as any).procesado_por || (item as any).digitado_por || (item as any).observacionesAprobacion || (item as any).observaciones_aprobacion) === 'Julian'
      ).length;

      const digitadoMateo = gestionadasHoyItems.filter(
        (item) => normalizeDigitador((item as any).procesadoPor || (item as any).procesado_por || (item as any).digitado_por || (item as any).observacionesAprobacion || (item as any).observaciones_aprobacion) === 'Mateo'
      ).length;

      const digitadoJesus = gestionadasHoyItems.filter(
        (item) => normalizeDigitador((item as any).procesadoPor || (item as any).procesado_por || (item as any).digitado_por || (item as any).observacionesAprobacion || (item as any).observaciones_aprobacion) === 'Jesus'
      ).length;

      return {
        fecha: dateStr,
        nuevasHoy,
        acumuladasMes: accumulatedNuevas,
        gestionadasHoy,
        totalGestionadasMes: accumulatedGestionadas,
        totalPorAprobar: porAprobar,
        alertasVencidas,
        totalPorProcesar: porProcesar,
        porProcesarVencidas,
        totalDigitadas,
        digitadoJulian,
        digitadoMateo,
        digitadoJesus,
      };
    });

    // Return reversed so newest dates appear first at top of table
    return rows.reverse();
  }, [legalizaciones, tarjetasCredito, gastos, selectedYear, selectedMonth]);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top 4 Main Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL POR APROBAR */}
        <div className="bg-gradient-to-br from-amber-50/50 via-white to-white border border-amber-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">
              Total Por Aprobar
            </span>
            <div className="text-3xl md:text-4xl font-extrabold text-amber-600 tracking-tight">
              {stats.totalPorAprobar}
            </div>
            <p className="text-[11px] text-amber-700/80 font-medium pt-0.5 truncate">
              Esperando revisión del doliente
            </p>
          </div>
          <div className="w-12 h-12 rounded-full border-2 border-amber-200 bg-amber-50/50 flex items-center justify-center text-amber-500 shadow-xs shrink-0">
            <Clock className="w-6 h-6 stroke-[2]" />
          </div>
        </div>

        {/* Card 2: POR APROBAR (+2 DÍAS) */}
        <div className="bg-gradient-to-br from-orange-50/50 via-white to-white border border-orange-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600 block">
              Por Aprobar (+2 Días)
            </span>
            <div className="text-3xl md:text-4xl font-extrabold text-orange-600 tracking-tight">
              {stats.totalPorAprobarVencidas}
            </div>
            <p className="text-[11px] text-orange-700/80 font-medium pt-0.5 truncate">
              Pendientes hace +48h hábiles
            </p>
          </div>
          <div className="w-12 h-12 rounded-full border-2 border-orange-200 bg-orange-50/50 flex items-center justify-center text-orange-500 shadow-xs shrink-0">
            <Clock className="w-6 h-6 stroke-[2]" />
          </div>
        </div>

        {/* Card 3: TOTAL POR PROCESAR */}
        <div className="bg-gradient-to-br from-blue-50/50 via-white to-white border border-blue-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
              Total Por Procesar
            </span>
            <div className="text-3xl md:text-4xl font-extrabold text-blue-600 tracking-tight">
              {stats.totalPorProcesar}
            </div>
            <p className="text-[11px] text-blue-700/80 font-medium pt-0.5 truncate">
              Listos para contabilidad o SAP
            </p>
          </div>
          <div className="w-12 h-12 rounded-full border-2 border-blue-200 bg-blue-50/50 flex items-center justify-center text-blue-500 shadow-xs shrink-0">
            <CheckCircle2 className="w-6 h-6 stroke-[2]" />
          </div>
        </div>

        {/* Card 4: POR PROCESAR (+2 DÍAS) */}
        <div className="bg-gradient-to-br from-rose-50/50 via-white to-white border border-rose-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block">
              Por Procesar (+2 Días)
            </span>
            <div className="text-3xl md:text-4xl font-extrabold text-rose-600 tracking-tight">
              {stats.totalPorProcesarVencidas}
            </div>
            <p className="text-[11px] text-rose-700/80 font-medium pt-0.5 truncate">
              Aprobados hace +48h hábiles
            </p>
          </div>
          <div className="w-12 h-12 rounded-full border-2 border-rose-200 bg-rose-50/50 flex items-center justify-center text-rose-500 shadow-xs shrink-0">
            <AlertCircle className="w-6 h-6 stroke-[2]" />
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

                  {/* +2 Días (Por Aprobar) */}
                  <div className="bg-orange-50/70 border border-orange-200/60 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-medium text-orange-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-orange-500" />
                      +2 Días (Por Aprobar)
                    </span>
                    <span className="font-bold text-orange-600 text-sm">
                      {m.porAprobarVencidas}
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
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
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
                        title={`${person.fullName || person.name}: ${person.count} pendientes`}
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
          <div className="flex items-center gap-2.5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Registro Diario (Historial)
            </h3>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
              <Clock className="w-3 h-3 text-emerald-600" />
              Inicia: 21 Oct 2026 • Corte diario: 11:55 PM (Colombia)
            </span>
          </div>

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
                <th className="px-3 py-3 text-center">Por Procesar (+2 Días)</th>
                <th className="px-3 py-3 text-center">Total Digitadas</th>
                <th className="px-3 py-3 text-center text-teal-700">Digitado por Julian</th>
                <th className="px-3 py-3 text-center text-blue-700">Digitado por Mateo</th>
                <th className="px-3 py-3 text-center text-indigo-700">Digitado por Jesus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {dailyHistory.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-slate-400 text-xs">
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
                      {row.porProcesarVencidas > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          ⚠️ {row.porProcesarVencidas}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {row.totalDigitadas}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {row.digitadoJulian > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                          {row.digitadoJulian}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {row.digitadoMateo > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {row.digitadoMateo}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {row.digitadoJesus > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {row.digitadoJesus}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">0</span>
                      )}
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
