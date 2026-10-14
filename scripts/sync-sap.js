/**
 * =========================================================================
 *   SINCRONIZADOR AUTOMÁTICO DE LEGALIZACIONES CON SAP SERVICE LAYER
 *   Firplak S.A.
 * =========================================================================
 * 
 * Este script consulta en Supabase todas las solicitudes que están:
 *   - Aprobadas (estado = 'aprobado' o 'pagado')
 *   - Pendientes de SAP (sap_doc_entry IS NULL)
 * 
 * En los 3 módulos:
 *   1. Tarjetas de Crédito (legalizaciones_tarjetas_credito)
 *   2. Cajas Menores (legalizaciones cajas menores)
 *   3. Legalizaciones de Gastos (legalizaciones_gastos)
 * 
 * Y crea automáticamente los borradores correspondientes en SAP Service Layer,
 * actualizando luego el número DocEntry en Supabase.
 * 
 * Modos de uso:
 *   node scripts/sync-sap.js          (Ejecutar una vez y salir)
 *   node scripts/sync-sap.js --watch  (Quedar activo y sincronizar cada 2 min)
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Ignorar verificación SSL autofirmado de la red interna de SAP
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Cargar variables de entorno desde .env
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = (match[2] || '').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[match[1]]) {
        process.env[match[1]] = val;
      }
    }
  });
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zohdtksgxhbheaftgmsi.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SAP_API_URL = process.env.SAP_API_URL || 'https://200.7.96.194:50000/b1s/v1/Login';
const SAP_COMPANY_DB = process.env.SAP_COMPANY_DB || 'Firplak_SA';
const SAP_USERNAME = process.env.SAP_USERNAME || 'manager';
const SAP_PASSWORD = process.env.SAP_PASSWORD || '2023Fir#.*';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Login a SAP Service Layer con 25s de timeout
async function loginSAP(timeoutMs = 25000) {
  const loginEndpoint = SAP_API_URL.endsWith('/Login')
    ? SAP_API_URL
    : `${SAP_API_URL.replace(/\/+$/, '')}/Login`;

  const controller = new AbortController();
  const tId = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(loginEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        CompanyDB: SAP_COMPANY_DB,
        UserName: SAP_USERNAME,
        Password: SAP_PASSWORD,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError' || String(err.message).toLowerCase().includes('abort')) {
      throw new Error(`Timeout (${timeoutMs / 1000}s) al conectar con SAP Service Layer (${loginEndpoint}).`);
    }
    throw err;
  } finally {
    clearTimeout(tId);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error login SAP (${res.status}): ${errText}`);
  }

  const cookieHeader = res.headers.get('set-cookie') || '';
  const data = await res.json();
  return {
    SessionId: data.SessionId,
    cookieHeader: cookieHeader || `B1SESSION=${data.SessionId}`,
    baseUrl: SAP_API_URL.replace(/\/Login\/?$/, ''),
  };
}

// Consultar TRM oficial para conversión de USD a COP
async function getTRMByDate(fecha) {
  const cleanFecha = fecha ? fecha.split('T')[0] : new Date().toISOString().split('T')[0];
  try {
    const whereClause = encodeURIComponent(`vigenciadesde <= '${cleanFecha}T00:00:00.000' and vigenciahasta >= '${cleanFecha}T00:00:00.000'`);
    const url = `https://www.datos.gov.co/resource/32sa-8pi3.json?$where=${whereClause}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].valor) {
        const val = parseFloat(data[0].valor);
        if (!isNaN(val) && val > 0) return val;
      }
    }
  } catch {}
  return 4200.0;
}

async function convertUSDToCOP(valorUSD, fecha) {
  const trm = await getTRMByDate(fecha);
  return { valorCOP: Math.round(valorUSD * trm), trm };
}

// Crear borrador de legalización en SAP (U_HBT_LEGENC y U_HBT_LEGDET)
async function crearBorradorSAP(legalizacion, session, baseUrl) {
  // 1. Obtener siguiente Code para U_HBT_LEGENC
  const resMaxEnc = await fetch(`${baseUrl}/U_HBT_LEGENC?$top=1&$orderby=Code desc`, {
    headers: { Cookie: session.cookieHeader },
  });
  let newEncCode = '0000000001';
  if (resMaxEnc.ok) {
    const dataMax = await resMaxEnc.json();
    if (dataMax.value && dataMax.value.length > 0) {
      newEncCode = (parseInt(dataMax.value[0].Code, 10) + 1).toString().padStart(10, '0');
    }
  }

  // 1.5 Mapear Centro de Costos
  const knownMappings = {
    'emergencias sst': 'GA-SISTG',
    'talento': 'GA-TALHU',
    'logistica': 'GA-LOGIS',
    'tesoreria': 'GA-FICOG',
    'mantenimiento': 'GA-MANUF',
    'servicio al cliente': 'GA-ADMON',
    'behome medellin': 'GV-ADIS1',
    'behome cali': 'GV-ADIS1',
    'firplak home bogota': 'GV-ADIS1',
  };
  const searchName = (legalizacion.centroCosto || '').toLowerCase().trim();
  let realProfitCode = knownMappings[searchName] || (searchName.length <= 8 && searchName.length > 0 ? legalizacion.centroCosto : 'GA-ADMON');

  // 1.8 Identificar si es Tarjeta de Crédito
  const isTarjetaCredito =
    legalizacion.codigo?.toUpperCase().startsWith('TC-') ||
    Boolean(legalizacion.tarjeta_codigo) ||
    Boolean(legalizacion.tc_en_sap) ||
    legalizacion.motivo?.toLowerCase().includes('tarjeta') ||
    legalizacion.motivo?.includes('[TC:');

  let headerCardCode = '';
  let headerCardName = legalizacion.usuarioNombre || 'Responsable Firplak';

  if (isTarjetaCredito) {
    headerCardCode = (legalizacion.tc_en_sap || '').trim();
    if (!headerCardCode) {
      try {
        const { data: respTC } = await supabase.from('tarjetas_credito_responsables').select('*');
        if (respTC && respTC.length > 0) {
          let match = respTC.find(
            (r) =>
              (legalizacion.tarjeta_codigo && r.tarjeta_codigo === legalizacion.tarjeta_codigo) ||
              (legalizacion.motivo && r.tarjeta_codigo && legalizacion.motivo.includes(r.tarjeta_codigo))
          );
          if (!match) {
            match = respTC.find(
              (r) =>
                (legalizacion.usuarioEmail && r.responsable_email?.toLowerCase() === legalizacion.usuarioEmail.toLowerCase()) ||
                (legalizacion.usuarioNombre && r.responsable_nombre?.toLowerCase() === legalizacion.usuarioNombre.toLowerCase())
            );
          }
          if (match) {
            headerCardCode = (match.tc_en_sap || match['TC en SAP'] || '').trim();
            if (match.tarjeta_nombre) headerCardName = match.tarjeta_nombre;
          }
        }
      } catch {}
    }
    if (!headerCardCode) headerCardCode = 'EM1007813694-01';
  } else {
    headerCardCode = legalizacion.usuarioNit || 'EM1007813694-01';
  }

  // 1.9 Conversión TRM si hay líneas en USD
  const lineas = Array.isArray(legalizacion.lineas) ? legalizacion.lineas : [];
  let totalGastosCOP = 0;
  const lineasConvertidas = await Promise.all(
    lineas.map(async (l) => {
      const isUSD = l.moneda === 'USD';
      let subCOP = Number(l.valorSubtotal) || 0;
      let totCOP = Number(l.valorTotal) || subCOP;
      let trmUsed;

      if (isUSD) {
        const convSub = await convertUSDToCOP(subCOP, l.fecha || legalizacion.fecha);
        const convTot = await convertUSDToCOP(totCOP, l.fecha || legalizacion.fecha);
        subCOP = convSub.valorCOP;
        totCOP = convTot.valorCOP;
        trmUsed = convSub.trm;
      }

      totalGastosCOP += totCOP;
      return { ...l, valorSubtotalCOP: subCOP, valorTotalCOP: totCOP, trmUsed };
    })
  );

  if (totalGastosCOP === 0 && legalizacion.totalGastos) {
    totalGastosCOP = Number(legalizacion.totalGastos) || 0;
  }

  // 2. Crear Encabezado en SAP (U_HBT_LEGENC)
  const headerDate = legalizacion.fecha ? legalizacion.fecha.split('T')[0] : new Date().toISOString().split('T')[0];
  const headerPayload = {
    Code: newEncCode,
    Name: newEncCode,
    U_Currency: '$',
    U_Fecha: headerDate,
    U_Estado: 1, // 1 = Borrador
    U_CardCode: headerCardCode,
    U_CardName: headerCardName,
    U_ProfitCode: undefined,
    U_Comentario: `Borrador Legalización ${legalizacion.codigo || newEncCode} - ${legalizacion.motivo || ''}`,
    U_TipoContabi: 'Comun',
    U_DocRate: 1,
    U_VlrAntesIva: totalGastosCOP,
    U_VlrImpuesto: 0,
    U_VlrRetenciones: 0,
    U_VlrTotal: totalGastosCOP,
    U_AcctCode: isTarjetaCredito ? '21051025' : '23359505',
    U_Origen: 'SAP',
    U_Series: 69,
  };

  const resEnc = await fetch(`${baseUrl}/U_HBT_LEGENC`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
    body: JSON.stringify(headerPayload),
  });

  if (!resEnc.ok) {
    const errEnc = await resEnc.json().catch(() => ({}));
    throw new Error(errEnc.error?.message?.value || `Error al crear Encabezado HTTP ${resEnc.status}`);
  }

  // 3. Crear Detalle (U_HBT_LEGDET) por cada línea
  const resMaxDet = await fetch(`${baseUrl}/U_HBT_LEGDET?$top=1&$orderby=Code desc`, {
    headers: { Cookie: session.cookieHeader },
  });
  let currentDetNum = 1;
  if (resMaxDet.ok) {
    const dataDetMax = await resMaxDet.json();
    if (dataDetMax.value && dataDetMax.value.length > 0) {
      currentDetNum = parseInt(dataDetMax.value[0].Code, 10) + 1;
    }
  }

  for (const linea of lineasConvertidas) {
    const detCode = currentDetNum.toString().padStart(10, '0');
    let realCardCode = (linea.proveedorNit || '').trim() || headerCardCode;
    let realCardName = linea.proveedorNombre || (linea.proveedorNit || '').trim() || headerCardName;

    const lineProfitCode = (linea.concepto || '').split(' - ')[0].trim();
    const acctCode = (linea.cuentaTitulo || '').split(' - ')[0].trim();
    const isSoporte = linea.tipoDocumento === 'Documento Soporte';
    const docIdWithTrm = linea.trmUsed
      ? `${linea.facturaNumero || 'ND'} (USD $${linea.valorSubtotal} @ TRM $${linea.trmUsed.toLocaleString('es-CO')})`
      : (linea.facturaNumero || 'ND');

    const detPayload = {
      Code: detCode,
      Name: detCode,
      U_CodeLegEnc: newEncCode,
      U_Fecha: linea.fecha ? linea.fecha.split('T')[0] : headerDate,
      U_CardCode: realCardCode,
      U_CardName: realCardName,
      U_ProfitCode: isSoporte ? undefined : (lineProfitCode || undefined),
      U_CodeConcepto: isSoporte ? 'importar saldo' : acctCode,
      U_IdDocumento: isSoporte ? undefined : docIdWithTrm,
      U_AcctCode: isSoporte ? undefined : acctCode,
      U_VlrAntIVA: isSoporte ? undefined : linea.valorSubtotalCOP,
      U_VlrGasto: isSoporte ? undefined : linea.valorSubtotalCOP,
      U_VlrTotal: isSoporte ? undefined : (linea.valorTotalCOP || linea.valorSubtotalCOP),
    };

    await fetch(`${baseUrl}/U_HBT_LEGDET`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
      body: JSON.stringify(detPayload),
    });
    currentDetNum++;
  }

  return { success: true, docEntry: parseInt(newEncCode, 10) || newEncCode };
}

// Ejecutar ciclo de sincronización
async function sincronizarTodo() {
  const timestamp = new Date().toLocaleTimeString('es-CO');
  console.log(`\n[${timestamp}] 🔍 Buscando solicitudes pendientes de SAP...`);

  let session;
  try {
    session = await loginSAP();
  } catch (err) {
    console.error(`❌ No se pudo conectar a SAP Service Layer: ${err.message}`);
    return;
  }

  let totalProcesados = 0;

  // 1. Tarjetas de Crédito
  try {
    const { data: tcs } = await supabase
      .from('legalizaciones_tarjetas_credito')
      .select('*')
      .or('estado.eq.aprobado,estado.eq.pagado');

    const tcPendientes = (tcs || []).filter(r => !r.sap_doc_entry);
    for (const row of tcPendientes) {
      console.log(`⏳ [Tarjetas] Procesando ${row.codigo || row.id} - ${row.usuario_nombre} ($${(row.total_gastos || 0).toLocaleString('es-CO')})...`);
      try {
        const legObj = {
          id: row.id,
          codigo: row.codigo,
          fecha: row.fecha,
          usuarioNombre: row.usuario_nombre,
          usuarioEmail: row.usuario_email,
          tarjeta_codigo: row.tarjeta_codigo,
          tc_en_sap: row.tc_en_sap,
          centroCosto: row.centro_costo,
          motivo: row.motivo,
          totalGastos: row.total_gastos,
          lineas: row.lineas || [],
        };
        const result = await crearBorradorSAP(legObj, session, session.baseUrl);
        if (result.success && result.docEntry) {
          const nowIso = new Date().toISOString();
          await supabase
            .from('legalizaciones_tarjetas_credito')
            .update({
              sap_doc_entry: result.docEntry,
              updated_at: nowIso,
            })
            .eq('id', row.id);
          console.log(`  ✅ ÉXITO: Borrador creado en SAP DocEntry #${result.docEntry}`);
          totalProcesados++;
        }
      } catch (e) {
        console.error(`  ❌ Error procesando ${row.codigo}:`, e.message);
      }
    }
  } catch (err) {
    console.error('Error consultando Tarjetas de Crédito:', err.message);
  }

  // 2. Cajas Menores
  try {
    const { data: cms } = await supabase
      .from('legalizaciones cajas menores')
      .select('*')
      .or('estado.eq.aprobado,estado.eq.pagado');

    const cmPendientes = (cms || []).filter(r => !r.sap_doc_entry);
    for (const row of cmPendientes) {
      console.log(`⏳ [Cajas Menores] Procesando ${row.codigo || row.id} - ${row.usuarioNombre} ($${(row.totalGastos || 0).toLocaleString('es-CO')})...`);
      try {
        const result = await crearBorradorSAP(row, session, session.baseUrl);
        if (result.success && result.docEntry) {
          const nowIso = new Date().toISOString();
          await supabase
            .from('legalizaciones cajas menores')
            .update({
              sap_doc_entry: result.docEntry,
              updated_at: nowIso,
            })
            .eq('id', row.id);
          console.log(`  ✅ ÉXITO: Borrador creado en SAP DocEntry #${result.docEntry}`);
          totalProcesados++;
        }
      } catch (e) {
        console.error(`  ❌ Error procesando ${row.codigo}:`, e.message);
      }
    }
  } catch (err) {
    console.error('Error consultando Cajas Menores:', err.message);
  }

  // 3. Gastos
  try {
    const { data: gsts } = await supabase
      .from('legalizaciones_gastos')
      .select('*')
      .or('estado.eq.aprobado,estado.eq.pagado');

    const gstPendientes = (gsts || []).filter(r => !r.sap_doc_entry);
    for (const row of gstPendientes) {
      console.log(`⏳ [Gastos] Procesando ${row.codigo || row.id} - ${row.usuario_nombre || row.usuarioNombre} ($${(row.total_gastos || 0).toLocaleString('es-CO')})...`);
      try {
        const legObj = {
          id: row.id,
          codigo: row.codigo,
          fecha: row.fecha,
          usuarioNombre: row.usuario_nombre || row.usuarioNombre,
          usuarioEmail: row.usuario_email || row.usuarioEmail,
          centroCosto: row.centro_costo || row.centroCosto,
          motivo: row.motivo,
          totalGastos: row.total_gastos ?? row.totalGastos,
          lineas: row.lineas || [],
        };
        const result = await crearBorradorSAP(legObj, session, session.baseUrl);
        if (result.success && result.docEntry) {
          const nowIso = new Date().toISOString();
          await supabase
            .from('legalizaciones_gastos')
            .update({
              sap_doc_entry: result.docEntry,
              updated_at: nowIso,
            })
            .eq('id', row.id);
          console.log(`  ✅ ÉXITO: Borrador creado en SAP DocEntry #${result.docEntry}`);
          totalProcesados++;
        }
      } catch (e) {
        console.error(`  ❌ Error procesando ${row.codigo}:`, e.message);
      }
    }
  } catch (err) {
    console.error('Error consultando Gastos:', err.message);
  }

  if (totalProcesados === 0) {
    console.log(`✨ Todo al día. 0 solicitudes pendientes.`);
  } else {
    console.log(`🎉 Sincronización completada: ${totalProcesados} registro(s) sincronizado(s) con SAP.`);
  }
}

// Control de ejecución
const isWatchMode = process.argv.includes('--watch');

async function main() {
  console.log('='.repeat(70));
  console.log('   SINCRONIZADOR LOCAL SAP SERVICE LAYER - FIRPLAK');
  console.log('='.repeat(70));
  if (isWatchMode) {
    console.log('📡 Modo automático activo: Monitoreando Supabase cada 2 minutos...');
    console.log('   (Presiona Ctrl + C en cualquier momento para detenerlo)');
    await sincronizarTodo();
    setInterval(sincronizarTodo, 120000); // Cada 2 min
  } else {
    await sincronizarTodo();
    console.log('\nListo.');
  }
}

main();
