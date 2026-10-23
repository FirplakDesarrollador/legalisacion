import { Legalizacion, LineaGasto } from '@/types/legalizaciones';

/**
 * Searches a Legalizacion / TarjetaCredito item across both header fields
 * and every detail inside each line of expense (factura, nit, proveedor, concepto, etc.)
 */
export function matchesItemSearch(item: Legalizacion, term: string): boolean {
  if (!term) return true;
  const q = term.toLowerCase().trim();
  if (!q) return true;

  // 1. Cabecera (Header fields)
  if ((item.codigo || '').toLowerCase().includes(q)) return true;
  if ((item.usuarioNombre || '').toLowerCase().includes(q)) return true;
  if ((item.usuarioEmail || '').toLowerCase().includes(q)) return true;
  if ((item.usuarioNit || '').toLowerCase().includes(q)) return true;
  if ((item.motivo || '').toLowerCase().includes(q)) return true;
  if ((item.centroCosto || '').toLowerCase().includes(q)) return true;
  if (String(item.sapDocEntry || '').toLowerCase().includes(q)) return true;
  if (((item as any).tarjeta_codigo || '').toLowerCase().includes(q)) return true;
  if ((item.tc_en_sap || '').toLowerCase().includes(q)) return true;
  if ((item.aprobadorNombre || '').toLowerCase().includes(q)) return true;
  if ((item.aprobadorEmail || '').toLowerCase().includes(q)) return true;
  if ((item.observacionesAprobacion || '').toLowerCase().includes(q)) return true;
  if ((item.estado || '').toLowerCase().includes(q)) return true;
  if ((item.gestionContable || '').toLowerCase().includes(q)) return true;
  if (String(item.totalGastos || '').includes(q)) return true;
  if (String(item.anticipoRecibido || '').includes(q)) return true;
  if (String(item.saldoDiferencia || '').includes(q)) return true;
  if ((item.fecha || '').toLowerCase().includes(q)) return true;
  if ((item.created_at || '').toLowerCase().includes(q)) return true;

  // 2. Líneas de gasto (Expense lines)
  let lineas: LineaGasto[] = [];
  if (Array.isArray(item.lineas)) {
    lineas = item.lineas;
  } else if (typeof (item as any).lineas === 'string') {
    try {
      lineas = JSON.parse((item as any).lineas);
    } catch {
      lineas = [];
    }
  }

  if (Array.isArray(lineas)) {
    for (const linea of lineas) {
      if (!linea) continue;
      // Concepto / Descripción
      if ((linea.concepto || '').toLowerCase().includes(q)) return true;
      // Factura / No. documento
      if ((linea.facturaNumero || '').toLowerCase().includes(q)) return true;
      // Proveedor NIT y Razón Social
      if ((linea.proveedorNit || '').toLowerCase().includes(q)) return true;
      if ((linea.proveedorNombre || '').toLowerCase().includes(q)) return true;
      // Cuenta contable
      if ((linea.cuentaTitulo || '').toLowerCase().includes(q)) return true;
      if (String(linea.cuentaId || '').toLowerCase().includes(q)) return true;
      // Tipo documento
      if ((linea.tipoDocumento || '').toLowerCase().includes(q)) return true;
      // Valores monetarios
      if (String(linea.valorTotal || '').includes(q)) return true;
      if (String(linea.valorSubtotal || '').includes(q)) return true;
      if (String(linea.valorIva || '').includes(q)) return true;
      // Fecha
      if ((linea.fecha || '').toLowerCase().includes(q)) return true;
      // Transporte / Rutas
      if ((linea.origen || '').toLowerCase().includes(q)) return true;
      if ((linea.destino || '').toLowerCase().includes(q)) return true;
      if ((linea.medioTransporte || '').toLowerCase().includes(q)) return true;
    }
  }

  return false;
}
