export interface CuentaContable {
  id: number;
  Título: string;
  categoria: string;
  Creado?: string;
  Modificado?: string;
  'Creado por'?: string;
  'Modificado por'?: string;
}

export interface CentroCosto {
  id: number;
  codigo: string;
  Título: string;
  categoria?: string;
}

export interface Proveedor {
  id: string;
  razon_social: string | null;
  numero_identificacion: string | null;
  email: string | null;
  tipo_contraparte: string | null;
  ciudad: string | null;
  pais: string | null;
  estado: string | null;
  created_at?: string;
}

export interface ResponsableCaja {
  id: number;
  nombre: string;
  email: string;
  centro_costo?: string;
  cargo?: string;
  montoAprobado?: number;
  montoAprobadoStr?: string;
  aprobadorNombre?: string;
  aprobadorEmail?: string;
  created_at?: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  departamento: string;
}

export interface SoporteAdjunto {
  name: string;
  url: string;
}

export interface LineaGasto {
  id: string;
  fecha: string;
  concepto: string;
  cuentaId: number | null;
  cuentaTitulo: string;
  proveedorId?: string | null;
  proveedorNit?: string | null;
  proveedorNombre?: string | null;
  tipoDocumento?: 'Factura' | 'Documento Soporte';
  facturaNumero: string;
  valorSubtotal: number;
  valorIva: number;
  valorTotal: number;
  soporteUrl?: string;
  soporteUrls?: string[];
  soportes?: SoporteAdjunto[];
  soporteFile?: File;
  soporteFiles?: File[];
}

export interface ResponsableTarjetaCredito {
  id: number;
  tarjeta_codigo: string;
  tarjeta_nombre: string;
  responsable_nombre: string;
  responsable_email: string;
  tc_en_sap?: string;
  "TC en SAP"?: string;
}

export interface Legalizacion {
  id: string;
  codigo: string;
  fecha: string;
  usuarioNombre: string;
  usuarioEmail: string;
  usuarioNit?: string;
  tc_en_sap?: string;
  centroCosto: string;
  motivo: string;
  estado: 'borrador' | 'pendiente' | 'aprobado' | 'rechazado' | 'pagado';
  anticipoRecibido: number;
  totalGastos: number;
  saldoDiferencia: number; // totalGastos - anticipoRecibido
  lineas: LineaGasto[];
  created_at: string;
  updated_at: string;
  fechaAprobacion?: string;
  gestionContable?: 'Por procesar' | 'Procesado';
  fechaProcesado?: string;
  aprobadorNombre?: string;
  aprobadorEmail?: string;
  sapDocEntry?: number;
  observacionesAprobacion?: string;
}

export interface TarjetaCredito extends Legalizacion {
  tarjeta_codigo?: string;
}

export interface MovimientoCaja {
  id: string;
  fecha: string;
  concepto: string;
  cuentaId?: number | null;
  cuentaTitulo?: string;
  proveedorNombre?: string;
  facturaNumero?: string;
  tipo: 'egreso' | 'reposicion';
  monto: number;
}

export interface CajaMenor {
  id: string;
  codigo: string;
  nombre: string;
  custodioNombre: string;
  custodioEmail: string;
  centroCosto: string;
  montoAsignado: number;
  montoDisponible: number;
  montoGastoTotal: number;
  estado: 'activa' | 'en_arqueo' | 'reposicion_pendiente' | 'cerrada';
  movimientos: MovimientoCaja[];
  created_at: string;
  updated_at: string;
}
