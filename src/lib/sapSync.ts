import { supabase } from './supabase';
import { loginSAP, crearBorradorLegalizacionSAP } from './sapServiceLayer';

export interface SyncPendingResult {
  success: boolean;
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
  synced: Array<{ id: string; codigo: string; docEntry: number; modulo: string }>;
  errors: Array<{ id: string; codigo: string; error: string; modulo: string }>;
  message: string;
}

/**
 * Consulta en Supabase todas las legalizaciones aprobadas o pagadas
 * que tengan sap_doc_entry nulo en los 3 módulos, y las crea en SAP.
 */
export async function syncPendingSAPRecords(): Promise<SyncPendingResult> {
  const result: SyncPendingResult = {
    success: true,
    pendingCount: 0,
    syncedCount: 0,
    failedCount: 0,
    synced: [],
    errors: [],
    message: '',
  };

  try {
    // 1. Consultar en paralelo los 3 módulos
    const [tcRes, cmRes, gstRes] = await Promise.all([
      supabase
        .from('legalizaciones_tarjetas_credito')
        .select('*')
        .or('estado.eq.aprobado,estado.eq.pagado')
        .is('sap_doc_entry', null),
      supabase
        .from('legalizaciones cajas menores')
        .select('*')
        .or('estado.eq.aprobado,estado.eq.pagado')
        .is('sap_doc_entry', null),
      supabase
        .from('legalizaciones_gastos')
        .select('*')
        .or('estado.eq.aprobado,estado.eq.pagado')
        .is('sap_doc_entry', null),
    ]);

    const tcPending = (tcRes.data || []).map((r: any) => ({
      ...r,
      table: 'legalizaciones_tarjetas_credito',
      modulo: 'Tarjetas de Crédito',
    }));
    const cmPending = (cmRes.data || []).map((r: any) => ({
      ...r,
      table: 'legalizaciones cajas menores',
      modulo: 'Cajas Menores',
    }));
    const gstPending = (gstRes.data || []).map((r: any) => ({
      ...r,
      table: 'legalizaciones_gastos',
      modulo: 'Gastos',
    }));

    const allPending = [...tcPending, ...cmPending, ...gstPending];
    result.pendingCount = allPending.length;

    // Si todo está al día, salimos inmediatamente sin abrir sesión en SAP
    if (allPending.length === 0) {
      result.message = 'Al día: No hay solicitudes pendientes de SAP';
      return result;
    }

    // 2. Iniciar sesión en SAP una sola vez
    const session = await loginSAP();

    // 3. Procesar secuencialmente cada solicitud pendiente
    for (const item of allPending) {
      const codigo = item.codigo || item.id;
      try {
        const draftRes = await crearBorradorLegalizacionSAP(item, session);
        if (draftRes.success && draftRes.docEntry) {
          result.syncedCount++;
          result.synced.push({
            id: item.id,
            codigo,
            docEntry: typeof draftRes.docEntry === 'number' ? draftRes.docEntry : parseInt(String(draftRes.docEntry), 10) || 0,
            modulo: item.modulo,
          });
        } else {
          result.failedCount++;
          result.errors.push({
            id: item.id,
            codigo,
            error: draftRes.message || 'Error desconocido en SAP',
            modulo: item.modulo,
          });
        }
      } catch (err: any) {
        result.failedCount++;
        result.errors.push({
          id: item.id,
          codigo,
          error: err.message || 'Excepción al procesar SAP',
          modulo: item.modulo,
        });
      }
    }

    result.message = `Sincronizados ${result.syncedCount} de ${result.pendingCount} registros con SAP`;
    return result;
  } catch (globalErr: any) {
    result.success = false;
    result.message = `Error en sincronizador: ${globalErr.message}`;
    return result;
  }
}
