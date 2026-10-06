/* eslint-disable @typescript-eslint/no-explicit-any */
// Generación y lectura de la plantilla Excel de "Legalización de Gastos".
// No importa nada de la app para poder usarse también desde scripts de Node.

export const MEDIOS_TRANSPORTE = [
  'Aéreo',
  'Taxi',
  'Bus',
  'Vehículo Propio',
  'Transporte Masivo',
  'Alquiler de Vehículo',
  'Otro',
];

export const SHEET_LINEAS = 'Lineas';
export const MAX_FILAS = 500;

export const COLUMNAS = [
  { key: 'fecha', header: 'Fecha *', width: 14, note: 'Fecha del comprobante. Formato dd/mm/aaaa' },
  { key: 'tipoDocumento', header: 'Tipo Documento *', width: 20, note: 'Factura o Documento Soporte' },
  { key: 'facturaNumero', header: 'N° Factura', width: 16, note: 'Solo si es Factura. Déjelo vacío si es Documento Soporte' },
  { key: 'nit', header: 'NIT Proveedor *', width: 18, note: 'Sin dígito de verificación ni puntos. Ej: 900123456' },
  { key: 'centro', header: 'Centro de Costo *', width: 30, note: 'Código del centro de costo. Ej: GA-FICOG' },
  { key: 'cuenta', header: 'Cuenta Contable *', width: 36, note: 'Código de la cuenta. Ej: 51952015' },
  { key: 'moneda', header: 'Moneda *', width: 12, note: 'COP o USD' },
  { key: 'valor', header: 'Valor del Gasto *', width: 18, note: 'Solo números. Ej: 150000' },
  { key: 'incluyeTransporte', header: 'Incluye Transporte (SI/NO)', width: 18, note: 'SI o NO' },
  { key: 'medioTransporte', header: 'Medio de Transporte', width: 22, note: 'Obligatorio si incluye transporte' },
  { key: 'origen', header: 'Origen', width: 20, note: 'Obligatorio si incluye transporte' },
  { key: 'destino', header: 'Destino', width: 20, note: 'Obligatorio si incluye transporte' },
  { key: 'pasajeros', header: '# Pasajeros', width: 12, note: 'Obligatorio si incluye transporte' },
  { key: 'idaVuelta', header: '¿Ida y Vuelta? (SI/NO)', width: 16, note: 'Obligatorio si incluye transporte' },
  { key: 'archivos', header: 'Nombre del Archivo Soporte *', width: 34, note: 'Nombre EXACTO del archivo adjunto (con extensión). Varios archivos separados por ;' },
] as const;

export interface CatalogoItem {
  codigo: string;
  nombre: string;
}

export interface PlantillaCatalogos {
  centros?: CatalogoItem[];
  cuentas?: CatalogoItem[];
}

const AZUL = 'FF1E3A8A';
const AZUL_CLARO = 'FFDBEAFE';

export async function construirPlantilla(ExcelJS: any, catalogos: PlantillaCatalogos = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Legalisa';
  wb.created = new Date();

  const tieneCatalogos = !!(catalogos.centros?.length || catalogos.cuentas?.length);

  // ---------------- Hoja de instrucciones ----------------
  const ins = wb.addWorksheet('Instrucciones', { properties: { tabColor: { argb: 'FFF59E0B' } } });
  ins.columns = [{ width: 4 }, { width: 120 }];
  const textoInstr: [string, boolean][] = [
    ['PLANTILLA DE CARGA MASIVA - LEGALIZACIÓN DE GASTOS', true],
    ['', false],
    ['CÓMO USARLA', true],
    ['1. Vaya a la hoja "Lineas" y diligencie UNA FILA POR CADA COMPROBANTE (factura o documento soporte).', false],
    ['2. Los campos con asterisco (*) son obligatorios. No cambie los títulos de las columnas ni el orden.', false],
    ['3. En la columna "Nombre del Archivo Soporte" escriba el nombre EXACTO del archivo del comprobante (con extensión), ej: factura_001.pdf', false],
    ['4. Guarde este Excel (formato .xlsx).', false],
    ['5. Ingrese a Legalización de Gastos, pulse "Cargar desde Excel", adjunte este Excel y TODOS los archivos de los comprobantes y pulse "Procesar".', false],
    ['6. Revise las líneas cargadas en pantalla, complete los datos generales (solicitante, aprobador, motivo) y radique.', false],
    ['', false],
    ['REGLAS', true],
    ['• Tipo Documento: "Factura" o "Documento Soporte". Si es Documento Soporte deje vacío el N° Factura.', false],
    ['• Centro de Costo y Cuenta Contable: escriba solo el CÓDIGO (ej. GA-FICOG y 51952015). Los centros GA usan cuentas 51*, GV 52*, IP 73* y MO 72*.', false],
    ['• Moneda: COP o USD.  Valor: solo números, sin símbolos (ej. 150000).', false],
    ['• Si "Incluye Transporte" = SI, son obligatorios: Medio de Transporte, Origen, Destino, # Pasajeros y ¿Ida y Vuelta?', false],
    ['• Si un mismo gasto tiene varios archivos, sepárelos con punto y coma: factura1.pdf;recibo1.jpg', false],
    ['• Máximo ' + MAX_FILAS + ' comprobantes por archivo.', false],
    ['', false],
    ['EJEMPLO (no lo copie en la hoja Lineas, es solo ilustrativo)', true],
    ['Fecha: 05/10/2026 | Factura | FE-1092 | 900123456 | GA-FICOG | 51952015 | COP | 150000 | NO | | | | | | factura_001.pdf', false],
    ['Fecha: 06/10/2026 | Factura | FE-2210 | 800555111 | GV-VENTAS | 52952015 | COP | 85000 | SI | Taxi | Medellín | Bogotá | 1 | SI | taxi_001.jpg', false],
  ];
  textoInstr.forEach(([t, bold], i) => {
    const c = ins.getCell(`B${i + 2}`);
    c.value = t;
    c.font = bold ? { bold: true, size: i === 0 ? 14 : 11, color: { argb: AZUL } } : { size: 11 };
    c.alignment = { wrapText: true, vertical: 'top' };
  });

  // ---------------- Hoja de catálogos (opcional) ----------------
  let centrosRange = '';
  let cuentasRange = '';
  if (tieneCatalogos) {
    const cat = wb.addWorksheet('Catalogos', { properties: { tabColor: { argb: 'FF10B981' } } });
    cat.columns = [{ width: 50 }, { width: 70 }];
    cat.getCell('A1').value = 'Centros de Costo';
    cat.getCell('B1').value = 'Cuentas Contables';
    [cat.getCell('A1'), cat.getCell('B1')].forEach((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    });
    (catalogos.centros || []).forEach((c, i) => {
      cat.getCell(`A${i + 2}`).value = `${c.codigo} - ${c.nombre}`;
    });
    (catalogos.cuentas || []).forEach((c, i) => {
      cat.getCell(`B${i + 2}`).value = `${c.codigo} - ${c.nombre}`;
    });
    if (catalogos.centros?.length) centrosRange = `Catalogos!$A$2:$A$${catalogos.centros.length + 1}`;
    if (catalogos.cuentas?.length) cuentasRange = `Catalogos!$B$2:$B$${catalogos.cuentas.length + 1}`;
  }

  // ---------------- Hoja principal ----------------
  const ws = wb.addWorksheet(SHEET_LINEAS, {
    properties: { tabColor: { argb: AZUL } },
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  ws.columns = COLUMNAS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  ws.getRow(1).height = 36;
  ws.getRow(1).eachCell((cell: any, col: number) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF93C5FD' } } };
    cell.note = COLUMNAS[col - 1].note;
  });

  const listaSiNo = '"SI,NO"';
  for (let r = 2; r <= MAX_FILAS + 1; r++) {
    ws.getCell(`A${r}`).numFmt = 'dd/mm/yyyy';
    ws.getCell(`A${r}`).dataValidation = {
      type: 'date', operator: 'greaterThan', formulae: [new Date(2020, 0, 1)], allowBlank: true,
      showErrorMessage: true, errorTitle: 'Fecha inválida', error: 'Use una fecha con formato dd/mm/aaaa',
    };
    ws.getCell(`B${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Factura,Documento Soporte"'] };
    ws.getCell(`D${r}`).numFmt = '@';
    if (centrosRange) {
      ws.getCell(`E${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [centrosRange], showErrorMessage: false };
    }
    if (cuentasRange) {
      ws.getCell(`F${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [cuentasRange], showErrorMessage: false };
    }
    ws.getCell(`G${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"COP,USD"'] };
    ws.getCell(`H${r}`).numFmt = '#,##0.00';
    ws.getCell(`I${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [listaSiNo] };
    ws.getCell(`J${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${MEDIOS_TRANSPORTE.join(',')}"`] };
    ws.getCell(`M${r}`).dataValidation = {
      type: 'whole', operator: 'greaterThanOrEqual', formulae: [1], allowBlank: true,
      showErrorMessage: true, errorTitle: 'Valor inválido', error: 'Ingrese un número entero mayor o igual a 1',
    };
    ws.getCell(`N${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [listaSiNo] };
    if (r % 2 === 1) {
      for (let c = 1; c <= COLUMNAS.length; c++) {
        ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    }
  }
  // Resaltar bloque de transporte
  ['I', 'J', 'K', 'L', 'M', 'N'].forEach((col) => {
    ws.getCell(`${col}1`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  });
  ws.getCell('O1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
  ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + COLUMNAS.length)}1` };
  ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  void AZUL_CLARO;

  // La hoja de líneas debe abrir primero
  wb.views = [{ activeTab: wb.worksheets.indexOf(ws) , x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, visibility: 'visible' }];
  return wb;
}

// ====================== LECTURA ======================

export interface FilaImportada {
  fila: number;
  fecha: string;
  tipoDocumento: 'Factura' | 'Documento Soporte';
  facturaNumero: string;
  proveedorNit: string;
  proveedorNombre: string;
  proveedorId: string | null;
  concepto: string; // "CODIGO - Título"
  cuentaId: number;
  cuentaTitulo: string;
  moneda: string;
  valorSubtotal: number;
  incluyeTransporte: 'SI' | 'NO';
  medioTransporte: string;
  origen: string;
  destino: string;
  numeroPasajeros: number;
  esIdaVuelta: boolean;
  archivos: string[];
}

export interface ResultadoLectura {
  filas: FilaImportada[];
  errores: string[];
}

const norm = (s: any) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

function celdaTexto(cell: any): string {
  const v = cell?.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('result' in v && v.result !== undefined && v.result !== null) return String(v.result).trim();
    if ('text' in v) return String(v.text ?? '').trim();
    if ('richText' in v && Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join('').trim();
  }
  return String(v).trim();
}

function parseFecha(cell: any): string | null {
  const v = cell?.value;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const t = celdaTexto(cell);
  if (!t) return null;
  let m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) {
    const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return null;
  }
  m = t.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[3])).padStart(2, '0')}`;
  return null;
}

function parseNumero(cell: any): number | null {
  const v = cell?.value;
  if (typeof v === 'number') return v;
  let t = celdaTexto(cell).replace(/[$\s]/g, '');
  if (!t) return null;
  // 1.234.567,89 -> 1234567.89  |  1,234,567.89 -> 1234567.89
  if (/,\d{1,2}$/.test(t) && /\./.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{3}(\.|$)/.test(t) && !/,/.test(t)) t = t.replace(/\./g, '');
  else t = t.replace(/,/g, '');
  const n = Number(t);
  return isNaN(n) ? null : n;
}

const siNo = (t: string): 'SI' | 'NO' | null => {
  const n = norm(t);
  if (['si', 's', 'yes', 'true', '1', 'x'].includes(n)) return 'SI';
  if (['no', 'n', 'false', '0', ''].includes(n)) return 'NO';
  return null;
};

const codigoDe = (t: string) => t.split(' - ')[0].trim();

export async function leerPlantilla(
  ExcelJS: any,
  buffer: ArrayBuffer,
  ctx: {
    centros: { codigo: string; Título: string }[];
    cuentas: { id: number; Título: string }[];
    proveedores: { id: string; numero_identificacion: string | null; razon_social: string | null }[];
  }
): Promise<ResultadoLectura> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet(SHEET_LINEAS) || wb.worksheets.find((w: any) => norm(w.name) !== 'instrucciones' && norm(w.name) !== 'catalogos');
  if (!ws) return { filas: [], errores: ['No se encontró la hoja "Lineas" en el Excel.'] };

  const errores: string[] = [];
  const filas: FilaImportada[] = [];

  // Validar encabezados
  const h1 = norm(celdaTexto(ws.getCell('A1')));
  const hLast = norm(celdaTexto(ws.getCell(1, COLUMNAS.length)));
  if (!h1.startsWith('fecha') || !hLast.startsWith('nombre del archivo')) {
    return { filas: [], errores: ['El Excel no corresponde a la plantilla oficial (encabezados modificados). Descargue la plantilla nuevamente.'] };
  }

  const ultima = Math.min(ws.rowCount, MAX_FILAS + 1);
  for (let r = 2; r <= ultima; r++) {
    const vacia = COLUMNAS.every((_, i) => celdaTexto(ws.getCell(r, i + 1)) === '');
    if (vacia) continue;
    const E = (msg: string) => errores.push(`Fila ${r}: ${msg}`);
    const n0 = errores.length;
    const g = (i: number) => ws.getCell(r, i);

    const fecha = parseFecha(g(1));
    if (!fecha) E('Fecha vacía o con formato inválido (use dd/mm/aaaa).');

    const tdRaw = norm(celdaTexto(g(2)));
    let tipoDocumento: 'Factura' | 'Documento Soporte' = 'Factura';
    if (tdRaw === 'factura') tipoDocumento = 'Factura';
    else if (tdRaw === 'documento soporte' || tdRaw === 'documento de soporte') tipoDocumento = 'Documento Soporte';
    else E('Tipo Documento debe ser "Factura" o "Documento Soporte".');

    const facturaNumero = tipoDocumento === 'Documento Soporte' ? '' : celdaTexto(g(3));

    const nit = celdaTexto(g(4)).replace(/[.\s]/g, '').replace(/-\d$/, '');
    if (!nit) E('NIT del proveedor es obligatorio.');
    const prov = ctx.proveedores.find((p) => (p.numero_identificacion || '').trim().toLowerCase() === nit.toLowerCase());

    const codCentro = codigoDe(celdaTexto(g(5)));
    const centro = ctx.centros.find((c) => c.codigo.trim().toUpperCase() === codCentro.toUpperCase());
    if (!codCentro) E('Centro de Costo es obligatorio.');
    else if (!centro) E(`Centro de Costo "${codCentro}" no existe en el catálogo.`);

    const codCuenta = codigoDe(celdaTexto(g(6)));
    const cuenta = ctx.cuentas.find((c) => c.Título.trim().startsWith(codCuenta) && codCuenta !== '');
    if (!codCuenta) E('Cuenta Contable es obligatoria.');
    else if (!cuenta) E(`Cuenta Contable "${codCuenta}" no existe en el catálogo.`);

    if (centro && cuenta) {
      const cc = centro.codigo.toUpperCase();
      const t = cuenta.Título;
      const ok =
        (cc.startsWith('GA') && t.startsWith('51')) ||
        (cc.startsWith('GV') && t.startsWith('52')) ||
        (cc.startsWith('IP') && t.startsWith('73')) ||
        (cc.startsWith('MO') && t.startsWith('72')) ||
        !(cc.startsWith('GA') || cc.startsWith('GV') || cc.startsWith('IP') || cc.startsWith('MO'));
      if (!ok) E(`La cuenta ${codCuenta} no corresponde al centro de costo ${centro.codigo}.`);
    }

    const monedaRaw = celdaTexto(g(7)).toUpperCase();
    if (monedaRaw !== 'COP' && monedaRaw !== 'USD') E('Moneda debe ser COP o USD.');

    const valor = parseNumero(g(8));
    if (valor === null || valor <= 0) E('Valor del gasto vacío o inválido (debe ser mayor a 0).');

    const inc = siNo(celdaTexto(g(9)));
    if (inc === null) E('"Incluye Transporte" debe ser SI o NO.');

    let medio = '', origen = '', destino = '', pasajeros = 1, idaVuelta = false;
    if (inc === 'SI') {
      const medioRaw = celdaTexto(g(10));
      const medioOk = MEDIOS_TRANSPORTE.find((m) => norm(m) === norm(medioRaw));
      if (!medioOk) E(`Medio de transporte inválido. Opciones: ${MEDIOS_TRANSPORTE.join(', ')}.`);
      else medio = medioOk;
      origen = celdaTexto(g(11));
      destino = celdaTexto(g(12));
      if (!origen) E('Origen es obligatorio cuando incluye transporte.');
      if (!destino) E('Destino es obligatorio cuando incluye transporte.');
      const p = parseNumero(g(13));
      if (p === null || p < 1 || !Number.isInteger(p)) E('# Pasajeros debe ser un entero mayor o igual a 1.');
      else pasajeros = p;
      const iv = siNo(celdaTexto(g(14)));
      if (iv === null || celdaTexto(g(14)) === '') E('¿Ida y vuelta? debe ser SI o NO cuando incluye transporte.');
      else idaVuelta = iv === 'SI';
    }

    const archivos = celdaTexto(g(15))
      .split(/[;\n]/)
      .map((a) => a.trim())
      .filter(Boolean);
    if (archivos.length === 0) E('Nombre del archivo soporte es obligatorio.');

    if (errores.length === n0) {
      filas.push({
        fila: r,
        fecha: fecha!,
        tipoDocumento,
        facturaNumero,
        proveedorNit: nit,
        proveedorNombre: prov?.razon_social || '',
        proveedorId: prov?.id || null,
        concepto: `${centro!.codigo} - ${centro!.Título}`,
        cuentaId: cuenta!.id,
        cuentaTitulo: cuenta!.Título,
        moneda: monedaRaw,
        valorSubtotal: valor!,
        incluyeTransporte: inc === 'SI' ? 'SI' : 'NO',
        medioTransporte: medio,
        origen,
        destino,
        numeroPasajeros: pasajeros,
        esIdaVuelta: idaVuelta,
        archivos,
      });
    }
  }

  if (filas.length === 0 && errores.length === 0) errores.push('El Excel no tiene filas diligenciadas en la hoja "Lineas".');
  return { filas, errores };
}
