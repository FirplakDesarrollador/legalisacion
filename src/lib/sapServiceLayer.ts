import { Legalizacion } from '@/types/legalizaciones';

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

    // 1.8 Buscar CardCode del Solicitante (Empleado o Proveedor)
    let headerCardCode = 'EM1007813694-01'; // Fallback a Renata
    try {
      if (legalizacion.usuarioNombre) {
        // Separamos nombre y apellido para una búsqueda más flexible (ej: "Marcela Gomez" -> "MARCELA" y "GOMEZ")
        const parts = legalizacion.usuarioNombre.toUpperCase().split(' ').filter(p => p.length > 2);
        let nameFilter = parts.map(p => `contains(CardName, '${p}')`).join(' and ');
        if (!nameFilter) nameFilter = `contains(CardName, '${legalizacion.usuarioNombre.toUpperCase()}')`;
        
        const filterStr = `(${nameFilter}) and (startswith(CardCode, 'EM') or startswith(CardCode, 'AC'))`;
        const resBP = await fetch(`${baseUrl}/BusinessPartners?$filter=${filterStr}`, {
          headers: { Cookie: session.cookieHeader },
        });
        if (resBP.ok) {
          const dataBP = await resBP.json();
          // Priorizamos los de tipo Empleado (EM) si hay varios
          if (dataBP.value && dataBP.value.length > 0) {
            const emp = dataBP.value.find((b: any) => b.CardCode.startsWith('EM'));
            headerCardCode = emp ? emp.CardCode : dataBP.value[0].CardCode;
          }
        }
      }
    } catch(e) {
      console.error('Error buscando BP del Solicitante:', e);
    }

    // 2. Payload for Heinsohn U_HBT_LEGENC (Encabezado)
    const headerPayload = {
      Code: newEncCode,
      Name: newEncCode,
      U_Currency: '$',
      U_Fecha: new Date().toISOString().split('T')[0],
      U_Estado: 1, // 1 = Borrador
      U_CardCode: (legalizacion as any).usuarioNit || headerCardCode, 
      U_CardName: legalizacion.usuarioNombre,
      U_ProfitCode: realProfitCode, // Dimensión 1 en encabezado, truncado o validado
      U_Comentario: `Borrador Legalización ${legalizacion.codigo} - ${legalizacion.motivo}`,
      U_TipoContabi: 'Comun',
      U_DocRate: 1,
      U_VlrAntesIva: legalizacion.totalGastos,
      U_VlrImpuesto: 0,
      U_VlrRetenciones: 0,
      U_VlrTotal: legalizacion.totalGastos,
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

    for (const linea of legalizacion.lineas) {
      const detCode = currentDetNum.toString().padStart(10, '0');
      
      // 3.1 Buscar Proveedor en SAP por NIT para obtener CardCode real y Nombre (Priorizando AC y EM)
      let realCardCode = linea.proveedorNit || 'Proveedor Varios';
      let realCardName = linea.proveedorNombre || 'Proveedor Varios';
      
      if (linea.proveedorNit) {
        try {
          const filterStr = `(startswith(FederalTaxID, '${linea.proveedorNit}') or FederalTaxID eq '${linea.proveedorNit}') and (startswith(CardCode, 'AC') or startswith(CardCode, 'EM'))`;
          const resBP = await fetch(`${baseUrl}/BusinessPartners?$filter=${filterStr}`, {
            headers: { Cookie: session.cookieHeader },
          });
          if (resBP.ok) {
            const dataBP = await resBP.json();
            if (dataBP.value && dataBP.value.length > 0) {
              realCardCode = dataBP.value[0].CardCode;
              realCardName = dataBP.value[0].CardName;
            }
          }
        } catch (e) {
          console.error('Error buscando BP:', e);
        }
      }

      // En el frontend, el usuario selecciona el Centro de Costos (ProfitCenter) en el dropdown 'concepto' (ej: 'GV-CAOBR - COSTA ATLANTICA OBRAS')
      const lineProfitCode = (linea.concepto || '').split(' - ')[0].trim();
      const acctCode = (linea.cuentaTitulo || '').split(' - ')[0].trim();

      const detPayload = {
        Code: detCode,
        Name: detCode,
        U_CodeLegEnc: newEncCode,
        U_Fecha: new Date().toISOString().split('T')[0],
        U_CardCode: realCardCode,
        U_CardName: realCardName,
        U_ProfitCode: lineProfitCode || realProfitCode, // Centro de Costo de la línea, o fallback al del encabezado
        U_CodeConcepto: acctCode, // El concepto en SAP Addon es igual a la cuenta
        U_IdDocumento: linea.facturaNumero || 'ND',
        U_AcctCode: acctCode,
        U_VlrAntIVA: linea.valorSubtotal,
        U_VlrGasto: linea.valorSubtotal,
        U_VlrTotal: linea.valorTotal || linea.valorSubtotal,
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
    const lineasSoporte = legalizacion.lineas.filter(l => l.tipoDocumento === 'Documento Soporte');
    const draftsResults: any[] = [];
    const draftsErrors: string[] = [];

    if (lineasSoporte.length > 0) {
      // Agrupar líneas por NIT de Proveedor
      const lineasPorProveedor = lineasSoporte.reduce((acc, linea) => {
        const nit = linea.proveedorNit?.trim() || 'PROV-GENERAL';
        if (!acc[nit]) acc[nit] = [];
        acc[nit].push(linea);
        return acc;
      }, {} as Record<string, typeof lineasSoporte>);

      // Crear un Draft por cada Proveedor
      for (const [nit, lineasProv] of Object.entries(lineasPorProveedor)) {
        const payloadDrafts = {
          DocObjectCode: 'oPurchaseInvoices',
          DocType: 'dDocument_Service',
          CardCode: nit, // Using the NIT entered in the form
          DocDate: legalizacion.fecha,
          Comments: `Borrador Legalización ${legalizacion.codigo} - UDO DocEntry: ${udoData.DocEntry}`,
          DocumentLines: lineasProv.map((l, idx) => {
            const rawCode = (l.cuentaTitulo || '').split(' - ')[0].trim();
            return {
              LineNum: idx,
              ItemDescription: l.concepto || l.cuentaTitulo,
              AccountCode: rawCode || undefined,
              UnitPrice: l.valorSubtotal,
              TaxCode: l.valorIva > 0 ? 'IVA_19' : 'EXE',
            };
          }),
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
          draftsErrors.push(`Fallo al crear Factura Preliminar para NIT ${nit}: ${draftsData?.error?.message?.value || resDrafts.status}`);
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
