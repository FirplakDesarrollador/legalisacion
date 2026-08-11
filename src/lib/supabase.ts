import { createClient } from '@supabase/supabase-js';
import { CuentaContable, Proveedor, Legalizacion, CajaMenor, MovimientoCaja, ResponsableCaja, CentroCosto } from '@/types/legalizaciones';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zohdtksgxhbheaftgmsi.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvaGR0a3NneGhiaGVhZnRnbXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjI5NjExNTEsImV4cCI6MjAzODUzNzE1MX0.Euu6FTh11mbh4lUmhKFMTFYZ9hWgZ-RzECcUYKGRYQE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface HealthCheckResult {
  connected: boolean;
  url: string;
  cuentasCount: number;
  proveedoresCount: number;
  error?: string;
}

export async function checkSupabaseHealth(): Promise<HealthCheckResult> {
  try {
    const [cuentasRes, proveedoresRes] = await Promise.all([
      supabase.from('cuentas').select('id', { count: 'exact', head: true }),
      supabase.from('proveedores').select('id', { count: 'exact', head: true })
    ]);

    const cuentasCount = cuentasRes.count ?? 0;
    const proveedoresCount = proveedoresRes.count ?? 0;

    return {
      connected: !cuentasRes.error && !proveedoresRes.error,
      url: supabaseUrl,
      cuentasCount,
      proveedoresCount,
      error: cuentasRes.error?.message || proveedoresRes.error?.message
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error de conexión a Supabase';
    return {
      connected: false,
      url: supabaseUrl,
      cuentasCount: 0,
      proveedoresCount: 0,
      error: msg
    };
  }
}

// User Authentication Service connected to Supabase Auth & DB
export interface AuthUserResult {
  email: string;
  name: string;
  role: string;
  id?: string;
  supabaseAuth: boolean;
}

export async function authenticateWithSupabase(
  email: string,
  pass: string,
  nombreIngresado?: string,
  isRegister = false
): Promise<{ success: boolean; user?: AuthUserResult; error?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();

    if (isRegister) {
      const signUpPromise = supabase.auth.signUp({
        email: cleanEmail,
        password: pass,
        options: {
          data: { nombre: nombreIngresado || cleanEmail.split('@')[0] }
        }
      });

      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('TIMEOUT') }), 3500)
      );

      const res = await Promise.race([signUpPromise, timeoutPromise]);

      if (res.error && res.error.message !== 'TIMEOUT') {
        if (!res.error.message.includes('already registered')) {
          return { success: false, error: res.error.message };
        }
      }

      const signInRes = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass
      });

      const activeUser = signInRes.data?.user || res.data?.user;

      const authUser: AuthUserResult = {
        email: cleanEmail,
        name: nombreIngresado || activeUser?.user_metadata?.nombre || cleanEmail.split('@')[0].toUpperCase(),
        role: 'Administrador Tesorería',
        id: activeUser?.id,
        supabaseAuth: true
      };

      supabase.from('usuarios').insert([{ correo: cleanEmail, nombre: authUser.name, rol: 'admin' }]).then(() => {});

      return { success: true, user: authUser };
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass
      });

      if (error) {
        return { success: false, error: 'Credenciales inválidas o el usuario no existe en Supabase Auth.' };
      }

      if (data?.user) {
        const authUser: AuthUserResult = {
          email: data.user.email || cleanEmail,
          name: data.user.user_metadata?.nombre || cleanEmail.split('@')[0].toUpperCase(),
          role: 'Administrador Tesorería',
          id: data.user.id,
          supabaseAuth: true
        };
        return { success: true, user: authUser };
      }

      return { success: false, error: 'Error desconocido al iniciar sesión en Supabase Auth.' };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Ocurrió un error al conectar con Supabase Auth.'
    };
  }
}

// Interface matching public."Cajas_menores" in Supabase
export interface SupabaseCajaMenorRow {
  Responsable: string;
  'Monto aprobado': string;
  Aprobador: string;
  Area: string;
}

// Fetchers for tables
export async function fetchResponsablesFromSupabase(): Promise<ResponsableCaja[]> {
  try {
    // Primary query to Supabase public."Cajas_menores"
    const { data, error } = await supabase
      .from('Cajas_menores')
      .select('*');
      
    console.log("DEBUG CAJAS MENORES FETCH:", { data, error });

    if (!error && data && data.length > 0) {
      return data.map((row: SupabaseCajaMenorRow, idx: number) => {
        let aprobadorNombre = row.Aprobador;
        let aprobadorEmail = 'tesoreria@firplak.com';
        if (row.Aprobador && row.Aprobador.includes('#')) {
          const parts = row.Aprobador.split('#');
          aprobadorNombre = parts[0].replace(/,$/, '').trim();
          aprobadorEmail = parts[1].trim();
        }

        return {
          id: idx + 1,
          nombre: row.Responsable,
          email: aprobadorEmail,
          centro_costo: row.Area,
          cargo: `Aprobador: ${aprobadorNombre} ($${row['Monto aprobado']})`
        };
      });
    }

    // Secondary query to public.responsables_caja
    const { data: data2 } = await supabase.from('responsables_caja').select('*');
    if (data2 && data2.length > 0) return data2 as ResponsableCaja[];

    return getFallbackResponsables();
  } catch {
    return getFallbackResponsables();
  }
}

export async function fetchCajasMenoresFromSupabase(): Promise<CajaMenor[]> {
  try {
    const { data, error } = await supabase.from('Cajas_menores').select('*');
    if (!error && data && data.length > 0) {
      return data.map((row: SupabaseCajaMenorRow, idx: number) => {
        let aprobadorNombre = row.Aprobador || 'No Asignado';
        let aprobadorEmail = 'tesoreria@firplak.com';
        if (row.Aprobador && row.Aprobador.includes('#')) {
          const parts = row.Aprobador.split('#');
          aprobadorNombre = parts[0].replace(/,$/, '').trim();
          aprobadorEmail = parts[1].trim();
        }

        const rawMonto = row['Monto aprobado'] || '';
        const cleanMonto = Number(rawMonto.replace(/\./g, '').replace(/,/g, '')) || 500000;

        return {
          id: `cm-sp-${idx + 1}`,
          codigo: `CM-2026-00${idx + 1}`,
          nombre: `Caja ${row.Responsable || 'Desconocido'} - ${row.Area || 'Generica'}`,
          custodioNombre: row.Responsable || 'Desconocido',
          custodioEmail: aprobadorEmail,
          centroCosto: row.Area,
          montoAsignado: cleanMonto,
          montoDisponible: cleanMonto,
          montoGastoTotal: 0,
          estado: 'activa' as const,
          movimientos: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });
    }
    return getFallbackCajas();
  } catch {
    return getFallbackCajas();
  }
}

export async function fetchCuentasFromSupabase(): Promise<CuentaContable[]> {
  try {
    const { data, error } = await supabase
      .from('cuentas')
      .select('*')
      .order('id', { ascending: true });

    if (error || !data) {
      console.warn('Error al cargar cuentas de Supabase:', error);
      return getFallbackCuentas();
    }
    return data as CuentaContable[];
  } catch {
    return getFallbackCuentas();
  }
}

export async function fetchCentrosCostoFromSupabase(): Promise<CentroCosto[]> {
  try {
    const { data, error } = await supabase
      .from('Centro_costos')
      .select('*')
      .order('codigo', { ascending: true });
      
    if (error || !data) {
      console.warn('Error al cargar Centro_costos de Supabase:', error);
      return [];
    }
    return data as CentroCosto[];
  } catch {
    return [];
  }
}

export async function fetchProveedoresFromSupabase(): Promise<Proveedor[]> {
  try {
    const { data, error } = await supabase
      .from('proveedores')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('Error al cargar proveedores de Supabase:', error);
      return [];
    }
    return data as Proveedor[];
  } catch {
    return [];
  }
}

function getFallbackResponsables(): ResponsableCaja[] {
  return [
    { id: 1, nombre: 'Carlos Mier', email: 'edgar.aguilar@firplak.com', centro_costo: 'Logistica', cargo: 'Aprobador: Edgar Javier Aguilar Rosero ($800.000)' },
    { id: 2, nombre: 'Renata Lainez', email: 'camila.jimenez@firplak.com', centro_costo: 'Talento', cargo: 'Aprobador: Maria Camila Jiménez Ochoa ($600.000)' },
    { id: 3, nombre: 'Paula Guevara', email: 'isabel.jaramillo@firplak.com', centro_costo: 'Servicio al Cliente', cargo: 'Aprobador: Isabel Cristina Jaramillo Castro ($400.000)' },
    { id: 4, nombre: 'Marcela Gomez', email: 'juan.marin@firplak.com', centro_costo: 'Emergencias SST', cargo: 'Aprobador: Juan Esteban Marín Gañan ($300.000)' },
    { id: 5, nombre: 'Laura Duque', email: 'direccionfinanciera@firplak.com', centro_costo: 'Tesoreria', cargo: 'Aprobador: Claudia Lorena Duque Alzate ($100.000)' },
    { id: 6, nombre: 'Maria Elena Perez Ospina', email: 'hector.chinchilla@firplak.com', centro_costo: 'Mantenimiento', cargo: 'Aprobador: Héctor Jose Chinchilla Trigos ($500.000)' },
    { id: 7, nombre: 'Natalia Gomez Usme', email: 'alejandro.sandoval@firplak.com', centro_costo: 'Behome Medellin', cargo: 'Aprobador: Ider Alejandro Sandoval Hernandez ($300.000)' },
    { id: 8, nombre: 'HERNANDO TOVAR MENDOZA', email: 'alejandro.sandoval@firplak.com', centro_costo: 'Behome Cali', cargo: 'Aprobador: Ider Alejandro Sandoval Hernandez ($400.000)' },
    { id: 9, nombre: 'VICTOR JULIO HERNANDEZ GONZALEZ', email: 'alejandro.sandoval@firplak.com', centro_costo: 'Firplak Home Bogota', cargo: 'Aprobador: Ider Alejandro Sandoval Hernandez ($1.000.000)' },
  ];
}

function getFallbackCuentas(): CuentaContable[] {
  return [
    { id: 1, Título: '51100505 - JUNTA DIRECTIVA', categoria: '5110 - HONORARIOS' },
    { id: 2, Título: '51101005 - REVISORIA FISCAL', categoria: '5110 - HONORARIOS' },
    { id: 3, Título: '51102505 - ASESORIA JURIDICA', categoria: '5110 - HONORARIOS' },
    { id: 4, Título: '51103005 - ASESORIA FINANCIERA', categoria: '5110 - HONORARIOS' },
    { id: 5, Título: '51103505 - ASESORIA TECNICA', categoria: '5110 - HONORARIOS' },
    { id: 6, Título: '51350505 - SERVICIOS DE TRANSPORTE Y FLETES', categoria: '5135 - SERVICIOS' },
    { id: 7, Título: '51550505 - ALOJAMIENTO Y HOSPEDAJE', categoria: '5155 - VIAJES Y VIATICOS' },
    { id: 8, Título: '51551005 - ALIMENTACION Y MANUTENCION', categoria: '5155 - VIAJES Y VIATICOS' },
    { id: 9, Título: '51950505 - TAXIS Y COMBUSTIBLE LOCAL', categoria: '5195 - DIVERSOS' }
  ];
}

const STORAGE_KEY = 'app_legalisaciones_data_v1';

const MOCK_LEGALIZACIONES_SEED: Legalizacion[] = [
  {
    id: 'leg-1',
    codigo: 'LEG-2026-001',
    fecha: '2026-03-25',
    usuarioNombre: 'Carlos Mier',
    usuarioEmail: 'edgar.aguilar@firplak.com',
    centroCosto: 'Logistica',
    motivo: 'Fletes y mensajería logística urgente',
    estado: 'pendiente',
    anticipoRecibido: 800000,
    totalGastos: 750000,
    saldoDiferencia: -50000,
    lineas: [
      {
        id: 'lin-1',
        fecha: '2026-03-22',
        concepto: 'Transporte y fletes de repuestos',
        cuentaId: 6,
        cuentaTitulo: '51350505 - SERVICIOS DE TRANSPORTE Y FLETES',
        proveedorNombre: 'SERVIENTREGA',
        facturaNumero: 'FE-8849',
        valorSubtotal: 630252,
        valorIva: 119748,
        valorTotal: 750000
      }
    ],
    created_at: '2026-03-25T10:30:00.000Z',
    updated_at: '2026-03-25T10:30:00.000Z'
  }
];

export function getLocalLegalizaciones(): Legalizacion[] {
  if (typeof window === 'undefined') return MOCK_LEGALIZACIONES_SEED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_LEGALIZACIONES_SEED));
      return MOCK_LEGALIZACIONES_SEED;
    }
    return JSON.parse(raw) as Legalizacion[];
  } catch {
    return MOCK_LEGALIZACIONES_SEED;
  }
}

export async function fetchLegalizacionesFromSupabase(): Promise<Legalizacion[]> {
  try {
    const { data, error } = await supabase
      .from('legalizaciones')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error al cargar legalizaciones:', error);
      return [];
    }

    // Return real data (may be empty array if no records yet)
    return (data || []) as Legalizacion[];
  } catch {
    return [];
  }
}

export function saveLocalLegalizacion(leg: Legalizacion): Legalizacion[] {
  const current = getLocalLegalizaciones();
  const existingIdx = current.findIndex(item => item.id === leg.id);
  let updated: Legalizacion[];

  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...leg, updated_at: new Date().toISOString() };
  } else {
    updated = [{ ...leg, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...current];
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  supabase.from('legalizaciones').upsert([leg]).then(({ error }) => {
    if (error) console.log('Info: Supabase table legalizaciones is managed locally.');
  });

  return updated;
}

export function updateLegalizacionStatus(id: string, nuevoEstado: Legalizacion['estado'], observaciones?: string): Legalizacion[] {
  const current = getLocalLegalizaciones();
  const updated = current.map(item => {
    if (item.id === id) {
      return {
        ...item,
        estado: nuevoEstado,
        observacionesAprobacion: observaciones || item.observacionesAprobacion,
        updated_at: new Date().toISOString()
      };
    }
    return item;
  });

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
  return updated;
}

// Cajas Menores Data Storage & Sync
const CAJAS_STORAGE_KEY = 'app_cajas_menores_data_v3';

function getFallbackCajas(): CajaMenor[] {
  return [
    {
      id: 'cm-1',
      codigo: 'CM-2026-001',
      nombre: 'Caja Carlos Mier - Logistica',
      custodioNombre: 'Carlos Mier',
      custodioEmail: 'edgar.aguilar@firplak.com',
      centroCosto: 'Logistica',
      montoAsignado: 800000,
      montoDisponible: 800000,
      montoGastoTotal: 0,
      estado: 'activa',
      movimientos: [],
      created_at: '2026-03-01T08:00:00.000Z',
      updated_at: '2026-03-26T14:30:00.000Z'
    },
    {
      id: 'cm-2',
      codigo: 'CM-2026-002',
      nombre: 'Caja Renata Lainez - Talento',
      custodioNombre: 'Renata Lainez',
      custodioEmail: 'camila.jimenez@firplak.com',
      centroCosto: 'Talento',
      montoAsignado: 600000,
      montoDisponible: 600000,
      montoGastoTotal: 0,
      estado: 'activa',
      movimientos: [],
      created_at: '2026-03-01T08:00:00.000Z',
      updated_at: '2026-03-26T14:30:00.000Z'
    },
    {
      id: 'cm-3',
      codigo: 'CM-2026-003',
      nombre: 'Caja Paula Guevara - Servicio al Cliente',
      custodioNombre: 'Paula Guevara',
      custodioEmail: 'isabel.jaramillo@firplak.com',
      centroCosto: 'Servicio al Cliente',
      montoAsignado: 400000,
      montoDisponible: 400000,
      montoGastoTotal: 0,
      estado: 'activa',
      movimientos: [],
      created_at: '2026-03-01T08:00:00.000Z',
      updated_at: '2026-03-26T14:30:00.000Z'
    },
    {
      id: 'cm-4',
      codigo: 'CM-2026-004',
      nombre: 'Caja Marcela Gomez - Emergencias SST',
      custodioNombre: 'Marcela Gomez',
      custodioEmail: 'juan.marin@firplak.com',
      centroCosto: 'Emergencias SST',
      montoAsignado: 300000,
      montoDisponible: 300000,
      montoGastoTotal: 0,
      estado: 'activa',
      movimientos: [],
      created_at: '2026-03-01T08:00:00.000Z',
      updated_at: '2026-03-26T14:30:00.000Z'
    },
    {
      id: 'cm-5',
      codigo: 'CM-2026-005',
      nombre: 'Caja Laura Duque - Tesoreria',
      custodioNombre: 'Laura Duque',
      custodioEmail: 'direccionfinanciera@firplak.com',
      centroCosto: 'Tesoreria',
      montoAsignado: 100000,
      montoDisponible: 100000,
      montoGastoTotal: 0,
      estado: 'activa',
      movimientos: [],
      created_at: '2026-03-01T08:00:00.000Z',
      updated_at: '2026-03-26T14:30:00.000Z'
    },
    {
      id: 'cm-6',
      codigo: 'CM-2026-006',
      nombre: 'Caja Maria Elena Perez Ospina - Mantenimiento',
      custodioNombre: 'Maria Elena Perez Ospina',
      custodioEmail: 'hector.chinchilla@firplak.com',
      centroCosto: 'Mantenimiento',
      montoAsignado: 500000,
      montoDisponible: 500000,
      montoGastoTotal: 0,
      estado: 'activa',
      movimientos: [],
      created_at: '2026-03-01T08:00:00.000Z',
      updated_at: '2026-03-26T14:30:00.000Z'
    },
    {
      id: 'cm-7',
      codigo: 'CM-2026-007',
      nombre: 'Caja Natalia Gomez Usme - Behome Medellin',
      custodioNombre: 'Natalia Gomez Usme',
      custodioEmail: 'alejandro.sandoval@firplak.com',
      centroCosto: 'Behome Medellin',
      montoAsignado: 300000,
      montoDisponible: 300000,
      montoGastoTotal: 0,
      estado: 'activa',
      movimientos: [],
      created_at: '2026-03-01T08:00:00.000Z',
      updated_at: '2026-03-26T14:30:00.000Z'
    },
    {
      id: 'cm-8',
      codigo: 'CM-2026-008',
      nombre: 'Caja HERNANDO TOVAR MENDOZA - Behome Cali',
      custodioNombre: 'HERNANDO TOVAR MENDOZA',
      custodioEmail: 'alejandro.sandoval@firplak.com',
      centroCosto: 'Behome Cali',
      montoAsignado: 400000,
      montoDisponible: 400000,
      montoGastoTotal: 0,
      estado: 'activa',
      movimientos: [],
      created_at: '2026-03-01T08:00:00.000Z',
      updated_at: '2026-03-26T14:30:00.000Z'
    },
    {
      id: 'cm-9',
      codigo: 'CM-2026-009',
      nombre: 'Caja VICTOR JULIO HERNANDEZ GONZALEZ - Firplak Home Bogota',
      custodioNombre: 'VICTOR JULIO HERNANDEZ GONZALEZ',
      custodioEmail: 'alejandro.sandoval@firplak.com',
      centroCosto: 'Firplak Home Bogota',
      montoAsignado: 1000000,
      montoDisponible: 1000000,
      montoGastoTotal: 0,
      estado: 'activa',
      movimientos: [],
      created_at: '2026-03-01T08:00:00.000Z',
      updated_at: '2026-03-26T14:30:00.000Z'
    }
  ];
}

export function getLocalCajasMenores(): CajaMenor[] {
  if (typeof window === 'undefined') return getFallbackCajas();
  try {
    const raw = localStorage.getItem(CAJAS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CAJAS_STORAGE_KEY, JSON.stringify(getFallbackCajas()));
      return getFallbackCajas();
    }
    return JSON.parse(raw) as CajaMenor[];
  } catch {
    return getFallbackCajas();
  }
}

export function saveLocalCajaMenor(caja: CajaMenor): CajaMenor[] {
  const current = getLocalCajasMenores();
  const idx = current.findIndex(c => c.id === caja.id);
  let updated: CajaMenor[];

  if (idx >= 0) {
    updated = [...current];
    updated[idx] = { ...caja, updated_at: new Date().toISOString() };
  } else {
    updated = [{ ...caja, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...current];
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(CAJAS_STORAGE_KEY, JSON.stringify(updated));
  }

  return updated;
}

export function agregarMovimientoCaja(cajaId: string, mov: MovimientoCaja): CajaMenor[] {
  const current = getLocalCajasMenores();
  const updated = current.map(c => {
    if (c.id === cajaId) {
      const nuevosMovs = [mov, ...c.movimientos];
      const gastoTotal = nuevosMovs.filter(m => m.tipo === 'egreso').reduce((acc, m) => acc + m.monto, 0);
      const reposiciones = nuevosMovs.filter(m => m.tipo === 'reposicion').reduce((acc, m) => acc + m.monto, 0);
      const disponible = c.montoAsignado - gastoTotal + reposiciones;

      let nuevoEstado = c.estado;
      if (disponible <= c.montoAsignado * 0.3) {
        nuevoEstado = 'reposicion_pendiente';
      }

      return {
        ...c,
        montoGastoTotal: gastoTotal,
        montoDisponible: Math.max(0, disponible),
        estado: nuevoEstado,
        movimientos: nuevosMovs,
        updated_at: new Date().toISOString()
      };
    }
    return c;
  });

  if (typeof window !== 'undefined') {
    localStorage.setItem(CAJAS_STORAGE_KEY, JSON.stringify(updated));
  }
  return updated;
}
