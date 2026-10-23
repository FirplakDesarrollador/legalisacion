import { Legalizacion, LineaGasto } from '@/types/legalizaciones';

/**
 * Searches a Legalizacion / TarjetaCredito item across both header fields
 * and every detail inside each line of expense (factura, nit, proveedor, concepto, etc.)
 * Fully bulletproof against null, undefined, numeric or non-string fields.
 */
export function matchesItemSearch(item: any, term: string): boolean {
  if (!term || !term.trim()) return true;
  if (!item) return false;

  try {
    const q = term.toLowerCase().trim();
    if (!q) return true;

    // 1. Cabecera (Header fields)
    if (String(item.codigo ?? '').toLowerCase().includes(q)) return true;
    if (String(item.usuarioNombre ?? '').toLowerCase().includes(q)) return true;
    if (String(item.usuarioEmail ?? '').toLowerCase().includes(q)) return true;
    if (String(item.usuarioNit ?? '').toLowerCase().includes(q)) return true;
    if (String(item.motivo ?? '').toLowerCase().includes(q)) return true;
    if (String(item.centroCosto ?? '').toLowerCase().includes(q)) return true;
    if (String(item.sapDocEntry ?? '').toLowerCase().includes(q)) return true;
    if (String(item.tarjeta_codigo ?? '').toLowerCase().includes(q)) return true;
    if (String(item.tc_en_sap ?? '').toLowerCase().includes(q)) return true;
    if (String(item.aprobadorNombre ?? '').toLowerCase().includes(q)) return true;
    if (String(item.aprobadorEmail ?? '').toLowerCase().includes(q)) return true;
    if (String(item.observacionesAprobacion ?? '').toLowerCase().includes(q)) return true;
    if (String(item.estado ?? '').toLowerCase().includes(q)) return true;
    if (String(item.gestionContable ?? '').toLowerCase().includes(q)) return true;
    if (String(item.totalGastos ?? '').includes(q)) return true;
    if (String(item.anticipoRecibido ?? '').includes(q)) return true;
    if (String(item.saldoDiferencia ?? '').includes(q)) return true;
    if (String(item.fecha ?? '').toLowerCase().includes(q)) return true;
    if (String(item.created_at ?? '').toLowerCase().includes(q)) return true;

    // 2. Líneas de gasto (Expense lines)
    let lineas: any[] = [];
    if (Array.isArray(item.lineas)) {
      lineas = item.lineas;
    } else if (typeof item.lineas === 'string') {
      try {
        const parsed = JSON.parse(item.lineas);
        if (Array.isArray(parsed)) lineas = parsed;
      } catch {
        lineas = [];
      }
    }

    if (Array.isArray(lineas)) {
      for (const linea of lineas) {
        if (!linea || typeof linea !== 'object') continue;
        // Concepto / Descripción
        if (String(linea.concepto ?? '').toLowerCase().includes(q)) return true;
        // Factura / No. documento
        if (String(linea.facturaNumero ?? '').toLowerCase().includes(q)) return true;
        // Proveedor NIT y Razón Social
        if (String(linea.proveedorNit ?? '').toLowerCase().includes(q)) return true;
        if (String(linea.proveedorNombre ?? '').toLowerCase().includes(q)) return true;
        // Cuenta contable
        if (String(linea.cuentaTitulo ?? '').toLowerCase().includes(q)) return true;
        if (String(linea.cuentaId ?? '').toLowerCase().includes(q)) return true;
        // Tipo documento
        if (String(linea.tipoDocumento ?? '').toLowerCase().includes(q)) return true;
        // Valores monetarios
        if (String(linea.valorTotal ?? '').includes(q)) return true;
        if (String(linea.valorSubtotal ?? '').includes(q)) return true;
        if (String(linea.valorIva ?? '').includes(q)) return true;
        // Fecha
        if (String(linea.fecha ?? '').toLowerCase().includes(q)) return true;
        // Transporte / Rutas
        if (String(linea.origen ?? '').toLowerCase().includes(q)) return true;
        if (String(linea.destino ?? '').toLowerCase().includes(q)) return true;
        if (String(linea.medioTransporte ?? '').toLowerCase().includes(q)) return true;
      }
    }

    return false;
  } catch (err) {
    console.error('Error in matchesItemSearch:', err);
    return false;
  }
}
