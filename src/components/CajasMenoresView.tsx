'use client';

import React, { useState } from 'react';
import {
  Wallet,
  PlusCircle,
  TrendingDown,
  RefreshCw,
  Eye,
  Plus,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  DollarSign,
  User,
  Building
} from 'lucide-react';
import { CajaMenor, MovimientoCaja, CuentaContable, Proveedor } from '@/types/legalizaciones';

interface CajasMenoresViewProps {
  cajas: CajaMenor[];
  cuentas: CuentaContable[];
  proveedores: Proveedor[];
  onSaveCaja: (caja: CajaMenor) => void;
  onAgregarMovimiento: (cajaId: string, mov: MovimientoCaja) => void;
}

export const CajasMenoresView: React.FC<CajasMenoresViewProps> = ({
  cajas,
  cuentas,
  proveedores,
  onSaveCaja,
  onAgregarMovimiento,
}) => {
  // Modal states
  const [selectedCajaDetail, setSelectedCajaDetail] = useState<CajaMenor | null>(null);
  const [isNuevaCajaOpen, setIsNuevaCajaOpen] = useState(false);
  const [isNuevoEgresoOpen, setIsNuevoEgresoOpen] = useState<CajaMenor | null>(null);

  // Form state for new Caja
  const [nombre, setNombre] = useState('');
  const [custodioNombre, setCustodioNombre] = useState('Mariana Gómez');
  const [custodioEmail, setCustodioEmail] = useState('mariana.gomez@firplak.com');
  const [centroCosto, setCentroCosto] = useState('3010 - Dirección de Producción');
  const [montoAsignado, setMontoAsignado] = useState(2000000);

  // Form state for new Egreso/Vale
  const [conceptoEgreso, setConceptoEgreso] = useState('');
  const [montoEgreso, setMontoEgreso] = useState<number>(50000);
  const [cuentaIdEgreso, setCuentaIdEgreso] = useState<number>(cuentas[0]?.id || 1);
  const [proveedorEgreso, setProveedorEgreso] = useState(proveedores[0]?.razon_social || '');
  const [facturaEgreso, setFacturaEgreso] = useState('');

  const formatCOP = (num: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const totalAsignado = cajas.reduce((acc, c) => acc + c.montoAsignado, 0);
  const totalDisponible = cajas.reduce((acc, c) => acc + c.montoDisponible, 0);
  const totalEjecutado = cajas.reduce((acc, c) => acc + c.montoGastoTotal, 0);
  const cajasAlerta = cajas.filter((c) => c.estado === 'reposicion_pendiente').length;

  const handleCreateCaja = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      alert('Por favor ingrese el nombre de la caja menor.');
      return;
    }

    const randomNum = Math.floor(100 + Math.random() * 900);
    const nueva: CajaMenor = {
      id: `cm-${Date.now()}`,
      codigo: `CM-2026-${randomNum}`,
      nombre,
      custodioNombre,
      custodioEmail,
      centroCosto,
      montoAsignado,
      montoDisponible: montoAsignado,
      montoGastoTotal: 0,
      estado: 'activa',
      movimientos: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSaveCaja(nueva);
    setIsNuevaCajaOpen(false);
    setNombre('');
  };

  const handleCreateEgreso = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNuevoEgresoOpen || !conceptoEgreso.trim() || montoEgreso <= 0) {
      alert('Por favor ingrese concepto y monto válido.');
      return;
    }

    const selectedCuenta = cuentas.find((c) => c.id === Number(cuentaIdEgreso));
    const nuevoMov: MovimientoCaja = {
      id: `mov-${Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      concepto: conceptoEgreso,
      cuentaId: cuentaIdEgreso,
      cuentaTitulo: selectedCuenta ? selectedCuenta.Título : 'Gasto General',
      proveedorNombre: proveedorEgreso || 'Proveedor Varios',
      facturaNumero: facturaEgreso || `VALE-${Math.floor(1000 + Math.random() * 9000)}`,
      tipo: 'egreso',
      monto: montoEgreso,
    };

    onAgregarMovimiento(isNuevoEgresoOpen.id, nuevoMov);
    setIsNuevoEgresoOpen(null);
    setConceptoEgreso('');
    setMontoEgreso(50000);
  };

  const [copiedForm, setCopiedForm] = useState(false);

  const handleCopyFormLink = () => {
    const url = `${window.location.origin}/formulario-publico`;
    navigator.clipboard.writeText(url);
    setCopiedForm(true);
    setTimeout(() => setCopiedForm(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-600" /> Control & Arqueo de Cajas Menores
          </h2>
          <p className="text-xs text-slate-500">Administración descentralizada de fondos fijos de caja menor en efectivo</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyFormLink}
            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all"
            title="Copiar enlace del formulario público accesible sin contraseña o inicio de sesión"
          >
            {copiedForm ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                ✓ Enlace Copiado (Sin Login)
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                📋 Copiar Formulario (Público)
              </span>
            )}
          </button>

          <button
            onClick={() => setIsNuevaCajaOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" /> Crear Nueva Caja Menor
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold">Total Fondos Asignados</p>
          <h3 className="text-xl font-bold font-mono text-slate-900 mt-1">{formatCOP(totalAsignado)}</h3>
          <p className="text-[10px] text-slate-400 mt-1">{cajas.length} cajas menores activas</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold">Saldo Disponible en Efectivo</p>
          <h3 className="text-xl font-bold font-mono text-emerald-700 mt-1">{formatCOP(totalDisponible)}</h3>
          <p className="text-[10px] text-emerald-600 mt-1 font-medium">Fondo líquido disponible</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold">Total Egresos por Reponer</p>
          <h3 className="text-xl font-bold font-mono text-blue-900 mt-1">{formatCOP(totalEjecutado)}</h3>
          <p className="text-[10px] text-blue-600 mt-1 font-medium">Soportes y vales pendientes</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold">Cajas en Alerta de Reposición</p>
          <h3 className="text-xl font-bold font-mono text-amber-600 mt-1">{cajasAlerta}</h3>
          <p className="text-[10px] text-amber-600 mt-1 font-medium">Disponible menor al 30%</p>
        </div>
      </div>

      {/* Cajas Menores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cajas.map((caja) => {
          const porcentajeEjecutado = caja.montoAsignado > 0 ? Math.round((caja.montoGastoTotal / caja.montoAsignado) * 100) : 0;
          return (
            <div key={caja.id} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {caja.codigo}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">{caja.nombre}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <User className="w-3.5 h-3.5 text-blue-600" /> Custodio: <strong className="text-slate-800">{caja.custodioNombre}</strong>
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize border ${
                    caja.estado === 'activa'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {caja.estado.replace('_', ' ')}
                </span>
              </div>

              {/* Progress Usage Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-500">Ejecución del Fondo:</span>
                  <span className="font-mono text-blue-700">{porcentajeEjecutado}% consumido</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      porcentajeEjecutado >= 70 ? 'bg-amber-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(porcentajeEjecutado, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Amount Breakdown */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-center">
                <div>
                  <span className="text-[10px] text-slate-400 font-sans block">Monto Fondo</span>
                  <span className="font-bold text-slate-800">{formatCOP(caja.montoAsignado)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-sans block">Ejecutado</span>
                  <span className="font-bold text-blue-900">{formatCOP(caja.montoGastoTotal)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-sans block">Disponible</span>
                  <span className="font-bold text-emerald-700">{formatCOP(caja.montoDisponible)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setIsNuevoEgresoOpen(caja)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Registrar Vale / Egreso
                </button>
                <button
                  onClick={() => setSelectedCajaDetail(caja)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" /> Ver Arqueo ({caja.movimientos.length})
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Crear Nueva Caja Menor */}
      {isNuevaCajaOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Wallet className="w-4 h-4" /> Crear Nueva Caja Menor
              </h3>
              <button onClick={() => setIsNuevaCajaOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCaja} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre de la Caja Menor</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Caja Menor Sede Norte - Ventas"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Custodio Responsable</label>
                <input
                  type="text"
                  required
                  value={custodioNombre}
                  onChange={(e) => setCustodioNombre(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Centro de Costo</label>
                <select
                  value={centroCosto}
                  onChange={(e) => setCentroCosto(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="1020 - Operaciones Comercial">1020 - Operaciones Comercial</option>
                  <option value="2040 - Gestión Legal y Revisoría">2040 - Gestión Legal y Revisoría</option>
                  <option value="3010 - Dirección de Producción">3010 - Dirección de Producción</option>
                  <option value="4050 - Gestión Humana & Viáticos">4050 - Gestión Humana & Viáticos</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fondo Asignado ($ COP)</label>
                <input
                  type="number"
                  required
                  min={100000}
                  step={50000}
                  value={montoAsignado}
                  onChange={(e) => setMontoAsignado(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-blue-700 font-bold focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNuevaCajaOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20"
                >
                  Guardar Caja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Egreso/Vale en Caja Menor */}
      {isNuevoEgresoOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" /> Registrar Vale en Caja Menor
                </h3>
                <p className="text-[11px] text-blue-100">{isNuevoEgresoOpen.nombre}</p>
              </div>
              <button onClick={() => setIsNuevoEgresoOpen(null)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEgreso} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Concepto del Gasto / Vale</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Taxis reunión cliente notaría"
                  value={conceptoEgreso}
                  onChange={(e) => setConceptoEgreso(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cuenta Contable (Supabase)</label>
                <select
                  value={cuentaIdEgreso}
                  onChange={(e) => setCuentaIdEgreso(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-blue-900 font-mono font-semibold focus:outline-none focus:border-blue-600"
                >
                  {cuentas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.Título}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Proveedor / Beneficiario</label>
                <input
                  type="text"
                  placeholder="Ej. TAXIS BOGOTA / IMPRESOS EXPRESS"
                  value={proveedorEgreso}
                  onChange={(e) => setProveedorEgreso(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">N° Vale / Factura</label>
                  <input
                    type="text"
                    placeholder="VALE-1001"
                    value={facturaEgreso}
                    onChange={(e) => setFacturaEgreso(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Monto ($ COP)</label>
                  <input
                    type="number"
                    required
                    min={1000}
                    max={isNuevoEgresoOpen.montoDisponible}
                    value={montoEgreso}
                    onChange={(e) => setMontoEgreso(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-blue-700 font-bold focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex justify-between text-xs">
                <span className="text-slate-600 font-medium">Disponible en Caja:</span>
                <span className="font-mono font-bold text-emerald-700">{formatCOP(isNuevoEgresoOpen.montoDisponible)}</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNuevoEgresoOpen(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20"
                >
                  Guardar Vale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ver Arqueo de Caja Menor */}
      {selectedCajaDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-mono">{selectedCajaDetail.codigo} - {selectedCajaDetail.nombre}</h3>
                <p className="text-xs text-slate-500">Custodio: {selectedCajaDetail.custodioNombre} &bull; {selectedCajaDetail.centroCosto}</p>
              </div>
              <button onClick={() => setSelectedCajaDetail(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-200 font-mono text-center">
                <div>
                  <span className="text-[10px] text-slate-500 font-sans block">Fondo Asignado</span>
                  <span className="font-bold text-slate-900 text-sm">{formatCOP(selectedCajaDetail.montoAsignado)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans block">Total Egresados</span>
                  <span className="font-bold text-blue-900 text-sm">{formatCOP(selectedCajaDetail.montoGastoTotal)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans block">Saldo Efectivo</span>
                  <span className="font-bold text-emerald-700 text-sm">{formatCOP(selectedCajaDetail.montoDisponible)}</span>
                </div>
              </div>

              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] pt-2">
                Historial de Movimientos & Vales ({selectedCajaDetail.movimientos.length})
              </h4>

              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Concepto</th>
                      <th className="py-2.5 px-3">Cuenta Contable</th>
                      <th className="py-2.5 px-3">Vale / Factura</th>
                      <th className="py-2.5 px-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedCajaDetail.movimientos.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          No hay egresos registrados aún en esta caja menor.
                        </td>
                      </tr>
                    ) : (
                      selectedCajaDetail.movimientos.map((mov) => (
                        <tr key={mov.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-slate-500 font-mono">{mov.fecha}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{mov.concepto}</td>
                          <td className="py-2.5 px-3 text-blue-900 font-mono text-[11px]">{mov.cuentaTitulo || 'General'}</td>
                          <td className="py-2.5 px-3 text-slate-500">{mov.facturaNumero || 'N/A'}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatCOP(mov.monto)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedCajaDetail(null)}
                className="px-4 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
