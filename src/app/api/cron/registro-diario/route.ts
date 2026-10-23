import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Helper: Format date string as YYYY-MM-DD in Colombia timezone (America/Bogota, UTC-5)
function toColombiaDateString(dateStr?: string | null): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

// Helper: Determine if item is older than 2 business days (excluding Saturdays and Sundays)
function isOlderThan2BusinessDays(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const start = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
  if (isNaN(start.getTime())) return false;
  const now = new Date();
  if (start >= now) return false;

  const totalMs = now.getTime() - start.getTime();
  if (totalMs >= 10 * 24 * 60 * 60 * 1000) return true;

  let businessHours = 0;
  const cur = new Date(start);
  while (cur < now) {
    const day = cur.getDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) {
      businessHours++;
    }
    cur.setTime(cur.getTime() + 60 * 60 * 1000);
  }

  return businessHours >= 48;
}

function isItemPorProcesar(item: any): boolean {
  const isAprob = item.estado === 'aprobado' || item.estado === 'pagado';
  if (!isAprob) return false;
  const g = String(item.gestion_contable || item.gestionContable || '').toLowerCase().trim();
  return g !== 'procesado';
}

function getFechaAprobacion(item: any): string | null {
  return item.fecha_aprobacion || item.fechaAprobacion || item.updated_at || null;
}

function normalizeDigitador(nameOrEmail?: string | null): 'Julian' | 'Mateo' | 'Jesus' | null {
  if (!nameOrEmail) return null;
  const s = String(nameOrEmail).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (s.includes('julian') || s.includes('auxiliarcontabilidad')) return 'Julian';
  if (s.includes('mateo')) return 'Mateo';
  if (s.includes('jesus') || s.includes('practicontabilidad')) return 'Jesus';
  return null;
}

export async function GET() {
  return handleDailyCapture();
}

export async function POST() {
  return handleDailyCapture();
}

async function handleDailyCapture() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: 'Faltan credenciales de Supabase en variables de entorno' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch records from all 3 tables
    const [cmRes, tcRes, gRes] = await Promise.all([
      supabase.from('legalizaciones cajas menores').select('*'),
      supabase.from('legalizaciones_tarjetas_credito').select('*'),
      supabase.from('legalizaciones_gastos').select('*'),
    ]);

    const allItems: any[] = [
      ...(cmRes.data || []).map((x) => ({ ...x, _tipo: 'CM' })),
      ...(tcRes.data || []).map((x) => ({ ...x, _tipo: 'TC' })),
      ...(gRes.data || []).map((x) => ({ ...x, _tipo: 'Gasto' })),
    ];

    // Start tracking strictly from today onwards (2026-10-21)
    const START_DATE = '2026-10-21';

    // Today in Colombia timezone (America/Bogota)
    const todayColombia = toColombiaDateString(new Date().toISOString());
    const currentMonthPrefix = todayColombia.slice(0, 7); // YYYY-MM

    // 1. Nuevas hoy
    const nuevasHoyItems = allItems.filter(
      (item) => toColombiaDateString(item.created_at || item.fecha) === todayColombia
    );
    const nuevasHoy = nuevasHoyItems.length;

    // 2. Acumuladas mes (todas las creadas en el mes desde START_DATE hasta hoy)
    const acumuladasMesItems = allItems.filter((item) => {
      const d = toColombiaDateString(item.created_at || item.fecha);
      return d && d.startsWith(currentMonthPrefix) && d >= START_DATE && d <= todayColombia;
    });
    const acumuladasMes = acumuladasMesItems.length;

    // 3. Aprobadas hoy (aprobadas hoy en hora Colombia)
    const aprobadasHoyItems = allItems.filter((item) => {
      const isAprob = item.estado === 'aprobado' || item.estado === 'pagado';
      if (!isAprob) return false;
      const aRaw = getFechaAprobacion(item);
      return toColombiaDateString(aRaw) === todayColombia;
    });
    const aprobadasHoy = aprobadasHoyItems.length;

    // 4. Total aprobadas mes (todas las aprobadas en el mes desde START_DATE hasta hoy)
    const totalAprobadasMesItems = allItems.filter((item) => {
      const isAprob = item.estado === 'aprobado' || item.estado === 'pagado';
      if (!isAprob) return false;
      const aRaw = getFechaAprobacion(item);
      const d = toColombiaDateString(aRaw);
      return d && d.startsWith(currentMonthPrefix) && d >= START_DATE && d <= todayColombia;
    });
    const totalAprobadasMes = totalAprobadasMesItems.length;

    // 5. Total por aprobar hoy
    const porAprobarItems = allItems.filter((item) => item.estado === 'pendiente');
    const totalPorAprobar = porAprobarItems.length;

    // 6. Alertas +2 días (por aprobar > 2 días hábiles)
    const alertas2Dias = porAprobarItems.filter((item) =>
      isOlderThan2BusinessDays(item.created_at || item.fecha)
    ).length;

    // 7. Total por procesar hoy
    const porProcesarItems = allItems.filter(isItemPorProcesar);
    const totalPorProcesar = porProcesarItems.length;

    // 8. Por procesar + 2 días (desde fecha de aprobación)
    const porProcesar2Dias = porProcesarItems.filter((item) => {
      const fApr = getFechaAprobacion(item);
      return fApr ? isOlderThan2BusinessDays(fApr) : false;
    }).length;

    // 9. Total digitadas hoy (marcadas como 'Procesado' hoy)
    const procesadasHoyItems = allItems.filter((item) => {
      const isProc = String(item.gestion_contable || item.gestionContable || '').toLowerCase().trim() === 'procesado';
      if (!isProc) return false;
      const pRaw = item.fecha_procesado || item.fechaProcesado || item.updated_at;
      return toColombiaDateString(pRaw) === todayColombia;
    });
    const totalDigitadas = procesadasHoyItems.length;

    // 10. Digitadas por persona hoy
    const digitadoJulian = procesadasHoyItems.filter(
      (item) => normalizeDigitador(item.procesado_por || item.procesadoPor || item.digitado_por || item.observaciones_aprobacion) === 'Julian'
    ).length;

    const digitadoMateo = procesadasHoyItems.filter(
      (item) => normalizeDigitador(item.procesado_por || item.procesadoPor || item.digitado_por || item.observaciones_aprobacion) === 'Mateo'
    ).length;

    const digitadoJesus = procesadasHoyItems.filter(
      (item) => normalizeDigitador(item.procesado_por || item.procesadoPor || item.digitado_por || item.observaciones_aprobacion) === 'Jesus'
    ).length;

    const snapshot = {
      fecha: todayColombia,
      nuevas_hoy: nuevasHoy,
      acumuladas_mes: acumuladasMes,
      aprobadas_hoy: aprobadasHoy,
      total_aprobadas_mes: totalAprobadasMes,
      gestionadas_hoy: aprobadasHoy,
      total_gestionadas_mes: totalAprobadasMes,
      total_por_aprobar: totalPorAprobar,
      alertas_2dias: alertas2Dias,
      total_por_procesar: totalPorProcesar,
      por_procesar_2dias: porProcesar2Dias,
      total_digitadas: totalDigitadas,
      digitado_julian: digitadoJulian,
      digitado_mateo: digitadoMateo,
      digitado_jesus: digitadoJesus,
      captured_at: new Date().toISOString(),
    };

    // Try upserting into 'registro_diario' table in Supabase if table exists
    let savedInTable = false;
    try {
      const { error: insertErr } = await supabase
        .from('registro_diario')
        .upsert(snapshot, { onConflict: 'fecha' });
      if (!insertErr) {
        savedInTable = true;
      }
    } catch {
      // Table doesn't exist yet, graceful fallback
    }

    return NextResponse.json({
      success: true,
      message: 'Captura de registro diario ejecutada exitosamente a las 11:55 PM (Colombia)',
      cutoffTimeColombia: '23:55 (11:55 PM)',
      dateColombia: todayColombia,
      savedInTable,
      snapshot,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Error calculando registro diario' },
      { status: 500 }
    );
  }
}
