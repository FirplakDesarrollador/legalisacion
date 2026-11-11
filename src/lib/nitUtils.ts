import { Proveedor } from '@/types/legalizaciones';

/**
 * Calcula el dígito de verificación (DV) oficial de la DIAN (Módulo 11)
 * para un NIT o documento base numérico en Colombia.
 */
export function calcularDigitoVerificacionDIAN(nitBase: string): number | null {
  const clean = String(nitBase || '').replace(/\D/g, '');
  if (!clean || clean.length < 6 || clean.length > 15) return null;

  const primos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let suma = 0;
  const len = clean.length;

  for (let i = 0; i < len; i++) {
    const digito = parseInt(clean[len - 1 - i], 10);
    if (isNaN(digito)) return null;
    suma += digito * primos[i];
  }

  const residuo = suma % 11;
  return residuo > 1 ? 11 - residuo : residuo;
}

/**
 * Normaliza un NIT o Cédula ingresado por el usuario y busca coincidencia en el catálogo de proveedores:
 * 1. Si trae guion (ej. "890900608-9" o "890.900.608-9"), descarta todo desde el guion.
 * 2. Si tiene 10 dígitos:
 *    - Si coincide exactamente con un proveedor de 10 dígitos en el catálogo (ej. cédula de 10 dígitos),
 *      conserva los 10 dígitos intactos.
 *    - Si los primeros 9 dígitos coinciden con un proveedor de 9 dígitos en el catálogo (o el proveedor está
 *      registrado como "XXXXXXXXX-D"), recorta el 10° dígito (dígito de verificación).
 *    - Si empieza por 8 o 9 (NIT de persona jurídica en Colombia, que siempre son de 9 dígitos + DV),
 *      recorta el 10° dígito para evitar que pase con dígito de verificación a SAP.
 */
export function normalizarNitProveedor(
  rawValue: string,
  proveedores: Proveedor[] = []
): { nit: string; proveedor: Proveedor | undefined } {
  const str = String(rawValue || '').trim();
  if (!str) return { nit: '', proveedor: undefined };

  // 1. Si incluye guion explícito (ej. 890900608-9), tomar únicamente la parte antes del guion
  const beforeHyphen = str.includes('-') ? str.split('-')[0] : str;
  let digits = beforeHyphen.replace(/\D/g, '').slice(0, 10);

  if (!digits) return { nit: '', proveedor: undefined };

  // Función auxiliar para extraer el ID base limpio de un proveedor del catálogo
  const getCatalogBaseId = (p: Proveedor): string => {
    const rawId = String(p.numero_identificacion || '').trim();
    const sinGuion = rawId.includes('-') ? rawId.split('-')[0] : rawId.replace(/-\d$/, '');
    return sinGuion.replace(/\D/g, '').slice(0, 10);
  };

  // 2. Si tiene 10 dígitos (sin guion), verificar si es un NIT de 9 dígitos con DV pegado al final
  if (digits.length === 10) {
    const nit9 = digits.slice(0, 9);
    const dvIngresado = parseInt(digits[9], 10);
    const dvCalculado = calcularDigitoVerificacionDIAN(nit9);

    // 2a. ¿Existe en el catálogo un proveedor cuyo documento base sea exactamente estos 10 dígitos?
    const exact10Match = proveedores.find((p) => getCatalogBaseId(p) === digits);
    if (exact10Match) {
      return { nit: digits, proveedor: exact10Match };
    }

    // 2b. ¿Existe en el catálogo un proveedor cuyo documento base sean los primeros 9 dígitos?
    const match9 = proveedores.find((p) => {
      const baseId = getCatalogBaseId(p);
      const rawId = String(p.numero_identificacion || '').replace(/\./g, '').trim();
      if (rawId === `${nit9}-${dvIngresado}`) return true;
      if (baseId === nit9 && (dvCalculado === dvIngresado || /^[89]/.test(digits))) return true;
      return false;
    });

    if (match9) {
      return { nit: nit9, proveedor: match9 };
    }

    // 2c. En Colombia, los NIT de personas jurídicas empiezan por 8 o 9 y tienen 9 dígitos base + 1 DV.
    // Las cédulas de 10 dígitos empiezan por 1 (nunca por 8 ni 9).
    if (/^[89]\d{9}$/.test(digits)) {
      digits = nit9;
    }
  }

  // 3. Buscar proveedor con el NIT ya normalizado
  const matchProv = proveedores.find((p) => {
    const baseId = getCatalogBaseId(p);
    return baseId === digits;
  });

  return { nit: digits, proveedor: matchProv };
}

/**
 * Manejador de onKeyDown para campos de NIT/Cédula:
 * Si el usuario presiona '-' (guion), bloquea el guion y marca temporalmente el input
 * para ignorar el dígito de verificación que teclee inmediatamente después del guion.
 */
export function handleNitKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  const input = e.currentTarget;

  if (e.key === '-' || e.key === 'Subtract') {
    e.preventDefault();
    input.dataset.ignoreNextDv = String(Date.now());
    return;
  }

  if (
    !e.ctrlKey &&
    !e.metaKey &&
    !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)
  ) {
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
      return;
    }

    // Si acaba de presionar '-' hace menos de 2.5 segundos, ignorar el dígito de verificación
    const ignoreTs = Number(input.dataset.ignoreNextDv || 0);
    if (ignoreTs && Date.now() - ignoreTs < 2500) {
      delete input.dataset.ignoreNextDv;
      e.preventDefault();
      return;
    }
  } else if (['Backspace', 'Delete'].includes(e.key)) {
    delete input.dataset.ignoreNextDv;
  }
}

