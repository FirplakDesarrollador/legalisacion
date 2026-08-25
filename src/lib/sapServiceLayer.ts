import { Legalizacion } from '@/types/legalizaciones';
import { supabase } from './supabase';
import { convertUSDToCOP } from './trm';

// Ensure TLS certificate verification is bypassed for self-signed SAP SSL in development/internal network
if (typeof process !== 'undefined') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const SAP_API_URL = process.env.SAP_API_URL || 'https://200.7.96.194:50000/b1s/v1/Login';
const SAP_COMPANY_DB = process.env.SAP_COMPANY_DB || 'Firplak_SA';
const SAP_USERNAME = process.env.SAP_USERNAME || 'manager';
const SAP_PASSWORD = process.env.SAP_PASSWORD || '2023Fir#.*';

export interface SAPSessionResponse {
  SessionId: string;
  Version: string;
  SessionTimeout: number;
  cookieHeader: string;
}

export async function loginSAP(): Promise<SAPSessionResponse> {
  const loginEndpoint = SAP_API_URL.endsWith('/Login')
    ? SAP_API_URL
    : `${SAP_API_URL.replace(/\/+$/, '')}/Login`;

  const res = await fetch(loginEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      CompanyDB: SAP_COMPANY_DB,
      UserName: SAP_USERNAME,
      Password: SAP_PASSWORD,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error al iniciar sesión en SAP Service Layer (${res.status}): ${errText}`);
  }

  const cookieHeader = res.headers.get('set-cookie') || '';
  const data = await res.json();

  return {
    SessionId: data.SessionId,
    Version: data.Version,
    SessionTimeout: data.SessionTimeout,
    cookieHeader: cookieHeader || `B1SESSION=${data.SessionId}`,
  };
}

export interface SAPDraftResult {
  success: boolean;
  docEntry?: number;
  docNum?: number;
  message?: string;
  sapResponse?: any;
}

export async function crearBorradorLegalizacionSAP(legalizacion: Legalizacion): Promise<SAPDraftResult> {
  try {
    const session = await loginSAP();
    const baseUrl = SAP_API_URL.replace(/\/Login\/?$/, '');

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

    // 1.5 Obtener y mapear el ProfitCode
    let realProfitCode: string | null = null;
    try {
      const resPC = await fetch(`${baseUrl}/ProfitCenters`, {
        headers: { Cookie: session.cookieHeader },
      });
      if (resPC.ok) {
        const dataPC = await resPC.json();
        const searchName = (legalizacion.centroCosto || '').toLowerCase().trim();
        
        // Mapeo manual de las áreas de Supabase a los CenterCodes reales de SAP Firplak
        const knownMappings: Record<string, string> = {
          'emergencias sst': 'GA-SISTG', // Sist de Gestion
          'talento': 'GA-TALHU', // Talento Humano
          'logistica': 'GA-LOGIS', // Logistica
          'tesoreria': 'GA-FICOG', // Finanzas, Contabilidad
          'mantenimiento': 'GA-MANUF', // Manufactura
          'servicio al cliente': 'GA-ADMON', // Admin por defecto si no hay uno claro
          'behome medellin': 'GV-ADIS1', // Antioquia Distribucion
          'behome cali': 'GV-ADIS1',
          'firplak home bogota': 'GV-ADIS1'
        };

        realProfitCode = knownMappings[searchName] || null;

        if (!realProfitCode) {
          const found = dataPC.value.find((p: any) => 
            p.CenterName && (p.CenterName.toLowerCase().includes(searchName) || searchName.includes(p.CenterName.toLowerCase()))
          );
          if (found) {
            realProfitCode = found.CenterCode;
          } else {
            // Fallback seguro a GA-ADMON si el texto es muy largo para evitar crash
            realProfitCode = searchName.length > 8 ? 'GA-ADMON' : legalizacion.centroCosto;
          }
        }
      }
    } catch(e) {
      console.error('Error buscando ProfitCenters:', e);
      realProfitCode = (legalizacion.centroCosto && legalizacion.centroCosto.length <= 8) ? legalizacion.centroCosto : null;
    }

    // 1.8 Buscar CardCode del Encabezado (Código SN)
    const isTarjetaCredito =
      legalizacion.codigo?.startsWith('TC-') ||
      Boolean((legalizacion as any).tarjeta_codigo) ||
      Boolean((legalizacion as any).tc_en_sap) ||
      legalizacion.motivo?.includes('Tarjeta') ||
      legalizacion.motivo?.includes('[TC:');

    let headerCardCode = '';
    let headerCardName = legalizacion.usuarioNombre;

    if (isTarjetaCredito) {
      // Para Tarjetas de Crédito: El Código SN DEBE SER OBLIGATORIAMENTE el tc_en_sap de la tarjeta
      headerCardCode = ((legalizacion as any).tc_en_sap || '').trim();

      if (!headerCardCode) {
        try {
          const { data: respTC } = await supabase
            .from('tarjetas_credito_responsables')
            .select('*');

          if (respTC && respTC.length > 0) {
            // 1. Buscar por tarjeta_codigo si está en motivo o en el objeto (ej: [TC: 9876])
            let match = respTC.find(
              (r: any) =>
                ((legalizacion as any).tarjeta_codigo && r.tarjeta_codigo === (legalizacion as any).tarjeta_codigo) ||
                (legalizacion.motivo && r.tarjeta_codigo && legalizacion.motivo.includes(r.tarjeta_codigo))
            );

            // 2. Si no, buscar por email o nombre
            if (!match) {
              match = respTC.find(
                (r: any) =>
                  (legalizacion.usuarioEmail && r.responsable_email?.toLowerCase() === legalizacion.usuarioEmail.toLowerCase()) ||
                  (legalizacion.usuarioNombre && r.responsable_nombre?.toLowerCase() === legalizacion.usuarioNombre.toLowerCase())
              );
            }

            if (match) {
              headerCardCode = (match.tc_en_sap || match['TC en SAP'] || '').trim();
              if (match.tarjeta_nombre) {
                headerCardName = match.tarjeta_nombre;
              }
            }
          }
        } catch (err) {
          console.warn('Error consultando tarjetas_credito_responsables para CardCode:', err);
        }
      }

      if (!headerCardCode) {
        return {
          success: false,
          message: `Error: La tarjeta seleccionada para ${legalizacion.codigo} no tiene configurado el código en la columna 'tc_en_sap' de la tabla tarjetas_credito_responsables en Supabase.`,
        };
      }
    } else {
      // Para Cajas Menores: Buscar CardCode del Empleado o Proveedor
      headerCardCode = (legalizacion as any).usuarioNit || '';
      if (!headerCardCode) {
        headerCardCode = 'EM1007813694-01'; // Fallback a Renata
        try {
          if (legalizacion.usuarioNombre) {
            const parts = legalizacion.usuarioNombre.toUpperCase().split(' ').filter((p: string) => p.length > 2);
            let nameFilter = parts.map((p: string) => `contains(CardName, '${p}')`).join(' and ');
            if (!nameFilter) nameFilter = `contains(CardName, '${legalizacion.usuarioNombre.toUpperCase()}')`;
            
            const filterStr = `(${nameFilter}) and (startswith(CardCode, 'EM') or startswith(CardCode, 'AC'))`;
            const resBP = await fetch(`${baseUrl}/BusinessPartners?$filter=${filterStr}`, {
              headers: { Cookie: session.cookieHeader },
            });
            if (resBP.ok) {
              const dataBP = await resBP.json();
              if (dataBP.value && dataBP.value.length > 0) {
                const emp = dataBP.value.find((b: any) => b.CardCode.startsWith('EM'));
                headerCardCode = emp ? emp.CardCode : dataBP.value[0].CardCode;
              }
            }
          }
        } catch (e) {
          console.error('Error buscando BP del Solicitante:', e);
        }
      }
    }

    // 1.9 Pre-calcular totales convertidos a COP con TRM si vienen en USD
    let totalGastosCOP = 0;
    const lineasConvertidas = await Promise.all(
      legalizacion.lineas.map(async (l) => {
        const isUSD = l.moneda === 'USD';
        let subCOP = l.valorSubtotal;
        let totCOP = l.valorTotal || l.valorSubtotal;
        let trmUsed: number | undefined = undefined;

        if (isUSD) {
          const convSub = await convertUSDToCOP(l.valorSubtotal, l.fecha || legalizacion.fecha);
          const convTot = await convertUSDToCOP(l.valorTotal || l.valorSubtotal, l.fecha || legalizacion.fecha);
          subCOP = convSub.valorCOP;
          totCOP = convTot.valorCOP;
          trmUsed = convSub.trm;
        }

        totalGastosCOP += totCOP;
        return {
          ...l,
          valorSubtotalCOP: subCOP,
          valorTotalCOP: totCOP,
          trmUsed,
        };
      })
    );

    // 2. Payload for Heinsohn U_HBT_LEGENC (Encabezado)
    const headerPayload = {
      Code: newEncCode,
      Name: newEncCode,
      U_Currency: '$',
      U_Fecha: new Date().toISOString().split('T')[0],
      U_Estado: 1, // 1 = Borrador
      U_CardCode: headerCardCode, 
      U_CardName: headerCardName,
      U_ProfitCode: undefined, // No asignar Dimensión 1 en el encabezado
      U_Comentario: `Borrador Legalización ${legalizacion.codigo} - ${legalizacion.motivo}`,
      U_TipoContabi: 'Comun',
      U_DocRate: 1,
      U_VlrAntesIva: totalGastosCOP,
      U_VlrImpuesto: 0,
      U_VlrRetenciones: 0,
      U_VlrTotal: totalGastosCOP,
      U_AcctCode: '23359505',
      U_Origen: 'SAP',
      U_Series: 69,
    };

    const resEnc = await fetch(`${baseUrl}/U_HBT_LEGENC`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
      body: JSON.stringify(headerPayload),
    });

    if (!resEnc.ok) {
      const errEnc = await resEnc.json();
      console.error('Error Encabezado:', errEnc);
      return { success: false, message: errEnc.error?.message?.value || 'Error al crear Encabezado' };
    }

    let udoData;
    try { udoData = await resEnc.json(); } catch { udoData = {}; }

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

    const cardCodeMap: Record<string, string> = {};

    for (const linea of lineasConvertidas) {
      const detCode = currentDetNum.toString().padStart(10, '0');
      
      // 3.1 Buscar Proveedor en SAP por NIT para obtener CardCode real y Nombre (Priorizando AC y EM)
      let realCardCode = (linea.proveedorNit || '').trim();
      let realCardName = (linea.proveedorNit || '').trim();
      
      if (linea.proveedorNit) {
        try {
          const nitClean = linea.proveedorNit.trim();
          const filterStr = `FederalTaxID eq '${nitClean}' or startswith(FederalTaxID, '${nitClean}')`;
          const resBP = await fetch(`${baseUrl}/BusinessPartners?$filter=${filterStr}&$select=CardCode,CardName,FederalTaxID`, {
            headers: { Cookie: session.cookieHeader },
          });
          if (resBP.ok) {
            const dataBP = await resBP.json();
            if (dataBP.value && dataBP.value.length > 0) {
              const matched = dataBP.value.find((b: any) => b.CardCode && (b.CardCode.startsWith('AC') || b.CardCode.startsWith('EM'))) || dataBP.value[0];
              realCardCode = matched.CardCode;
              realCardName = matched.CardName;
            }
          }
        } catch (e) {
          console.error('Error buscando BP por NIT en SAP:', e);
        }
      }

      if (linea.proveedorNit) {
        cardCodeMap[linea.proveedorNit] = realCardCode;
      }

      // En el frontend, el usuario selecciona el Centro de Costos (ProfitCenter) en el dropdown 'concepto' (ej: 'GV-CAOBR - COSTA ATLANTICA OBRAS')
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
        U_Fecha: new Date().toISOString().split('T')[0],
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

      const resDet = await fetch(`${baseUrl}/U_HBT_LEGDET`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
        body: JSON.stringify(detPayload),
      });
      
      if (!resDet.ok) {
        const errDet = await resDet.json().catch(() => ({}));
        console.error('Error al crear linea de detalle:', errDet);
      }
      currentDetNum++;
    }

    // Adaptar variables para que el código posterior siga funcionando
    udoData.DocEntry = newEncCode;
    udoData.DocNum = newEncCode;

    // 2. Procesar líneas de "Documento Soporte" y crear Facturas Preliminares (Drafts)
    const lineasSoporte = lineasConvertidas.filter(l => l.tipoDocumento === 'Documento Soporte');
    const draftsResults: any[] = [];
    const draftsErrors: string[] = [];

    if (lineasSoporte.length > 0) {
      // Agrupar líneas por CardCode de Proveedor
      const lineasPorProveedor = lineasSoporte.reduce((acc, linea) => {
        const nit = linea.proveedorNit?.trim() || 'PROV-GENERAL';
        const cardCode = cardCodeMap[nit] || nit;
        if (!acc[cardCode]) acc[cardCode] = [];
        acc[cardCode].push(linea);
        return acc;
      }, {} as Record<string, typeof lineasSoporte>);

      // Crear un Draft por cada Proveedor
      for (const [cardCode, lineasProv] of Object.entries(lineasPorProveedor)) {
        const resolvedDocumentLines = [];
        let lineIdx = 0;

        for (const l of lineasProv) {
          const rawCode = (l.cuentaTitulo || '').split(' - ')[0].trim();
          const codeNum = parseInt(rawCode, 10);
          const lineProfitCode = (l.concepto || '').split(' - ')[0].trim();
          
          let itemCode = 'ZZCC01-0005-000-0000'; // Default / Fallback Item Code
          let taxCode = 'I_LEG_T0'; // Default / Fallback Tax Code
          
          if (!isNaN(codeNum)) {
            try {
              const { data, error } = await supabase
                .from('Articulos')
                .select('ItemCode, TaxCode')
                .eq('AcctCode', codeNum)
                .limit(1);
              if (!error && data && data.length > 0) {
                itemCode = data[0].ItemCode || itemCode;
                taxCode = data[0].TaxCode || taxCode;
              }
            } catch (err) {
              console.error('Error fetching item code from Supabase Articulos:', err);
            }
          }

          resolvedDocumentLines.push({
            LineNum: lineIdx++,
            ItemCode: itemCode,
            Quantity: 1,
            UnitPrice: l.valorSubtotalCOP,
            TaxCode: taxCode,
            CostingCode: lineProfitCode || undefined,
            U_CentroCostos: lineProfitCode || undefined,
          });
        }

        const payloadDrafts = {
          DocObjectCode: 'oPurchaseInvoices',
          DocType: 'dDocument_Items',
          CardCode: cardCode, // Using the resolved CardCode
          DocDate: legalizacion.fecha,
          Comments: `Borrador Legalización ${legalizacion.codigo} - UDO DocEntry: ${udoData.DocEntry}`,
          DocumentLines: resolvedDocumentLines,
        };

        const resDrafts = await fetch(`${baseUrl}/Drafts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: session.cookieHeader,
          },
          body: JSON.stringify(payloadDrafts),
        });

        let draftsData;
        try {
          draftsData = await resDrafts.json();
        } catch {
          draftsData = {};
        }

        if (resDrafts.ok) {
          draftsResults.push(draftsData.DocEntry);
        } else {
          const nitOrig = lineasProv[0]?.proveedorNit || cardCode;
          draftsErrors.push(`Fallo al crear Factura Preliminar para NIT ${nitOrig} (${cardCode}): ${draftsData?.error?.message?.value || resDrafts.status}`);
        }
      }
    }

    return {
      success: true,
      docEntry: udoData.DocEntry,
      docNum: udoData.DocNum,
      message: draftsErrors.length > 0 
        ? `Legalización creada (DocEntry: ${udoData.DocEntry}), pero hubieron errores en Facturas Preliminares: ${draftsErrors.join(' | ')}`
        : lineasSoporte.length > 0
          ? `Legalización (DocEntry: ${udoData.DocEntry}) y Facturas Preliminares (DocEntries: ${draftsResults.join(', ')}) creadas en SAP.`
          : `Borrador de Legalización creado exitosamente en SAP OK1_LEG (DocEntry: ${udoData.DocEntry}). Sin Documentos Soporte.`,
      sapResponse: {
        udo: udoData,
        draftsCreated: draftsResults,
        draftsErrors: draftsErrors,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Error de comunicación con SAP Service Layer',
    };
  }
}
