/**
 * TRM (Tasa Representativa del Mercado) Utility
 * Consulta oficial histórica y en tiempo real desde la API de Datos Abiertos de Colombia (Superfinanciera)
 */

export async function getTRMByDate(fecha?: string): Promise<number> {
  const cleanFecha = fecha ? fecha.split('T')[0] : new Date().toISOString().split('T')[0];

  try {
    const whereClause = encodeURIComponent(`vigenciadesde <= '${cleanFecha}T00:00:00.000' and vigenciahasta >= '${cleanFecha}T00:00:00.000'`);
    const url = `https://www.datos.gov.co/resource/32sa-8pi3.json?$where=${whereClause}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].valor) {
        const val = parseFloat(data[0].valor);
        if (!isNaN(val) && val > 0) {
          return val;
        }
      }
    }
  } catch (err) {
    console.warn(`Error al consultar TRM para fecha ${cleanFecha}:`, err);
  }

  // Fallback 1: Última TRM publicada en Datos Abiertos
  try {
    const urlLatest = `https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20desc&$limit=1`;
    const res = await fetch(urlLatest, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].valor) {
        const val = parseFloat(data[0].valor);
        if (!isNaN(val) && val > 0) {
          return val;
        }
      }
    }
  } catch (err) {
    console.warn('Error al consultar última TRM disponible:', err);
  }

  // Fallback 2: Valor por defecto de seguridad
  return 4200.0;
}

/**
 * Convierte un valor en USD a COP usando la TRM de la fecha indicada
 */
export async function convertUSDToCOP(valorUSD: number, fecha?: string): Promise<{ valorCOP: number; trm: number }> {
  const trm = await getTRMByDate(fecha);
  const valorCOP = Math.round(valorUSD * trm);
  return { valorCOP, trm };
}
