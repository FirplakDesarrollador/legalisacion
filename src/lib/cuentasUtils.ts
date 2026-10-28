/**
 * Utilidades para reglas de negocio entre Centros de Costos y Cuentas Contables.
 *
 * REGLAS OBLIGATORIAS:
 * - Centro de Costos GA* ➔ Cuenta Contable 51*
 * - Centro de Costos GV* ➔ Cuenta Contable 52*
 * - Centro de Costos IP* ➔ Cuenta Contable 73*
 * - Centro de Costos MO* ➔ Cuenta Contable 72*
 */

export function getRequiredAccountPrefix(centroCosto?: string | null): string | null {
  if (!centroCosto) return null;
  const cc = centroCosto.trim().toUpperCase();
  if (cc.startsWith('GA')) return '51';
  if (cc.startsWith('GV')) return '52';
  if (cc.startsWith('IP')) return '73';
  if (cc.startsWith('MO')) return '72';
  return null;
}

export function isAccountAllowedForCentro(cuentaTitulo?: string | null, centroCosto?: string | null): boolean {
  if (!centroCosto || !cuentaTitulo) return false;
  const prefix = getRequiredAccountPrefix(centroCosto);
  if (!prefix) return true;
  return cuentaTitulo.trim().startsWith(prefix);
}

export function filterCuentasForCentro<T extends { Título: string }>(
  cuentas: T[],
  centroCosto?: string | null
): T[] {
  if (!centroCosto || !centroCosto.trim()) return [];
  const prefix = getRequiredAccountPrefix(centroCosto);
  if (!prefix) return cuentas;
  return cuentas.filter((c) => c.Título.trim().startsWith(prefix));
}

export function validateLineasCuentas(
  lineas: Array<{
    concepto?: string | null;
    cuentaId?: any;
    cuentaTitulo?: string | null;
  }>
): { valid: boolean; error?: string } {
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const idx = i + 1;

    if (!l.concepto || !l.concepto.trim()) {
      return {
        valid: false,
        error: `Comprobante #${idx}: Debe seleccionar obligatoriamente el Centro de Costos primero.`,
      };
    }

    if (!l.cuentaTitulo || !l.cuentaTitulo.trim()) {
      return {
        valid: false,
        error: `Comprobante #${idx}: Debe seleccionar una Cuenta Contable obligatoriamente.`,
      };
    }

    const prefix = getRequiredAccountPrefix(l.concepto);
    if (prefix && !l.cuentaTitulo.trim().startsWith(prefix)) {
      const ccCode = l.concepto.split(' - ')[0].trim();
      return {
        valid: false,
        error: `Comprobante #${idx}: La cuenta contable "${l.cuentaTitulo}" no es válida para el centro de costos "${l.concepto}". Regla: ${ccCode} requiere que la cuenta comience por ${prefix}.`,
      };
    }
  }

  return { valid: true };
}
