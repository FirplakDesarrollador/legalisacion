'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, CheckCircle2, Calculator, Plus, Trash2, Database, Send, UserCheck, Paperclip, ExternalLink, Receipt, ChevronDown, User, Mail } from 'lucide-react';
import {
  fetchCuentasFromSupabase,
  fetchProveedoresFromSupabase,
  fetchCentrosCostoFromSupabase,
  fetchOrganizationUsers,
  OrganizationUser,
  saveLocalLegalizacionGasto,
  supabase
} from '@/lib/supabase';
import { CuentaContable, Proveedor, LineaGasto, Legalizacion, CentroCosto } from '@/types/legalizaciones';

export default function FormularioGastosPublicoPage() {
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [centros, setCentros] = useState<CentroCosto[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrganizationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [lastCodigo, setLastCodigo] = useState('');

  // Form states
  const [usuarioNombre, setUsuarioNombre] = useState('');
  const [usuarioEmail, setUsuarioEmail] = useState('');
  const [centroCosto, setCentroCosto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [recibioAnticipo, setRecibioAnticipo] = useState<'no' | 'si'>('no');
  const [anticipoRecibido, setAnticipoRecibido] = useState<number>(0);

  // Dropdowns search
  const [showSolicitanteDropdown, setShowSolicitanteDropdown] = useState(false);
  const [solicitanteSearch, setSolicitanteSearch] = useState('');
  const solicitanteRef = useRef<HTMLDivElement>(null);

  const [showAprobadorDropdown, setShowAprobadorDropdown] = useState(false);
  const [aprobadorSearch, setAprobadorSearch] = useState('');
  const aprobadorRef = useRef<HTMLDivElement>(null);

  const [lineas, setLineas] = useState<LineaGasto[]>([
    {
      id: 'lin-gst-1',
      fecha: new Date().toISOString().split('T')[0],
      concepto: '',
      cuentaId: null,
      cuentaTitulo: '',
      proveedorNombre: '',
      tipoDocumento: 'Factura',
      facturaNumero: '',
      valorSubtotal: 0,
      valorIva: 0,
      valorTotal: 0,
    },
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        const [cData, pData, centrosData, usersData] = await Promise.all([
          fetchCuentasFromSupabase(),
          fetchProveedoresFromSupabase(),
          fetchCentrosCostoFromSupabase(),
          fetchOrganizationUsers(),
        ]);
        setCuentas(cData);
        setProveedores(pData);
        setCentros(centrosData);
        setOrgUsers(usersData);
      } catch (err) {
        console.error('Error cargando catálogos de Supabase:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (solicitanteRef.current && !solicitanteRef.current.contains(e.target as Node)) {
        setShowSolicitanteDropdown(false);
      }
      if (aprobadorRef.current && !aprobadorRef.current.contains(e.target as Node)) {
        setShowAprobadorDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatCOP = (num: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const handleAddLinea = () => {
    const newLine: LineaGasto = {
      id: `lin-gst-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      fecha: new Date().toISOString().split('T')[0],
      concepto: '',
      cuentaId: null,
      cuentaTitulo: '',
      proveedorId: null,
      proveedorNit: '',
      proveedorNombre: '',
      tipoDocumento: 'Factura',
      facturaNumero: '',
      valorSubtotal: 0,
      valorIva: 0,
      valorTotal: 0,
    };
    setLineas([...lineas, newLine]);
  };

  const handleUpdateLinea = (id: string, field: keyof LineaGasto, value: any) => {
    setLineas((prev) =>
      prev.map((lin) => {
        if (lin.id !== id) return lin;
        const updated = { ...lin, [field]: value };

        if (field === 'proveedorNit') {
          updated.proveedorNit = value;
          const matchProv = proveedores.find(
            (p) => (p.numero_identificacion || '').trim().toLowerCase() === (value || '').trim().toLowerCase()
          );
          if (matchProv) {
            updated.proveedorNombre = matchProv.razon_social || '';
            updated.proveedorId = matchProv.id;
          }
        }

        if (field === 'tipoDocumento' && value === 'Documento Soporte') {
          updated.facturaNumero = '';
        }

        if (field === 'cuentaId') {
          const selectedCuenta = cuentas.find((c) => c.id === Number(value));
          if (selectedCuenta) {
            updated.cuentaTitulo = selectedCuenta.Título;
          }
        }

        if (field === 'valorSubtotal') {
          const val = Number(value) || 0;
          updated.valorSubtotal = val;
          updated.valorIva = 0;
          updated.valorTotal = val;
        }

        return updated;
      })
    );
  };

  const handleRemoveLinea = (id: string) => {
    if (lineas.length <= 1) return;
    setLineas((prev) => prev.filter((l) => l.id !== id));
  };

  const totalGastos = lineas.reduce((acc, l) => acc + (l.valorTotal || 0), 0);
  const saldoDiferencia = totalGastos - anticipoRecibido;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioNombre.trim()) {
      alert('Por favor ingrese su nombre.');
      return;
    }
    if (!usuarioEmail.trim()) {
      alert('Por favor ingrese su correo electrónico.');
      return;
    }
    if (!motivo.trim()) {
      alert('Por favor ingrese el motivo del gasto.');
      return;
    }

    const cleanLineas = lineas.map(({ soporteFile, ...rest }) => rest);
    const randomNum = Math.floor(100 + Math.random() * 900);
    const codigo = `LEG-GST-${randomNum}`;

    const nuevaLeg: Legalizacion = {
      id: `leg-gst-${Date.now()}`,
      codigo,
      fecha,
      usuarioNombre,
      usuarioEmail,
      centroCosto: centroCosto || 'General',
      motivo,
      estado: 'pendiente',
      anticipoRecibido,
      totalGastos,
      saldoDiferencia,
      lineas: cleanLineas,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to Supabase and local storage
    saveLocalLegalizacionGasto(nuevaLeg);

    // Trigger Power Automate Flow for approval notification
    try {
      const link = `${window.location.origin}/formulario-gastos/${nuevaLeg.id}`;
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: usuarioEmail,
          titulo: `Aprobación de Legalización de Gastos - ${codigo}`,
          contenido: `Tienes esta legalización de gastos pendiente por aprobar de ${usuarioNombre} por valor de ${formatCOP(totalGastos)}.`,
          link: link,
        }),
      });
    } catch (flowErr) {
      console.error('Error enviando notificación al proxy:', flowErr);
    }

    setLastCodigo(codigo);
    setSubmitted(true);
  };

  const handleResetForm = () => {
    setSubmitted(false);
    setMotivo('');
    setLineas([
      {
        id: `lin-gst-${Date.now()}`,
        fecha: new Date().toISOString().split('T')[0],
        concepto: '',
        cuentaId: null,
        cuentaTitulo: '',
        proveedorNombre: '',
        tipoDocumento: 'Factura',
        facturaNumero: '',
        valorSubtotal: 0,
        valorIva: 0,
        valorTotal: 0,
      },
    ]);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-slate-100 space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">¡Legalización Radicada!</h2>
            <p className="text-xs text-slate-500 mt-1">
              Tu solicitud de legalización de gastos ha sido enviada exitosamente para revisión.
            </p>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Código de Radicado</span>
            <span className="text-xl font-black text-blue-900 font-mono">{lastCodigo}</span>
          </div>
          <button
            onClick={handleResetForm}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs shadow-md transition-all"
          >
            Radicar otra legalización
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 border border-blue-400/30 rounded-2xl">
              <Receipt className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Radicación de Legalización de Gastos
              </h1>
              <p className="text-xs text-slate-400">
                Sistema Corporativo Firplak S.A.S &bull; Gastos y Representación
              </p>
            </div>
          </div>
        </div>

        {/* Main Card Form */}
        <div className="bg-white text-slate-800 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              Cargando catálogos del sistema...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 text-xs">
              {/* General Information */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-600" /> Datos del Solicitante y Gasto
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Searchable Solicitante Field */}
                  <div className="relative" ref={solicitanteRef}>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Nombre Completo (Microsoft M365) *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={usuarioNombre}
                        onFocus={() => {
                          setShowSolicitanteDropdown(true);
                          setSolicitanteSearch(usuarioNombre);
                        }}
                        onChange={(e) => {
                          setUsuarioNombre(e.target.value);
                          setSolicitanteSearch(e.target.value);
                          setShowSolicitanteDropdown(true);
                        }}
                        placeholder="Escriba o seleccione solicitante..."
                        className="w-full p-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                      />
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {showSolicitanteDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {orgUsers
                          .filter((u) => {
                            const term = (solicitanteSearch || usuarioNombre).toLowerCase();
                            return u.nombre.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
                          })
                          .map((user) => (
                            <div
                              key={user.email}
                              onClick={() => {
                                setUsuarioNombre(user.nombre);
                                if (!usuarioEmail) setUsuarioEmail(user.email);
                                if (user.area && user.area !== 'General') setCentroCosto(user.area);
                                setShowSolicitanteDropdown(false);
                              }}
                              className="p-2.5 hover:bg-blue-50 cursor-pointer transition-colors flex items-center gap-2.5 text-left"
                            >
                              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                                {user.nombre.charAt(0)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-900 truncate text-xs">{user.nombre}</p>
                                <p className="text-[10px] text-slate-500 truncate">{user.email} {user.area ? `• ${user.area}` : ''}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Searchable Aprobador / Correo Field */}
                  <div className="relative" ref={aprobadorRef}>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Correo Electrónico (Aprobador/Solicitante) *
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={usuarioEmail}
                        onFocus={() => {
                          setShowAprobadorDropdown(true);
                          setAprobadorSearch(usuarioEmail);
                        }}
                        onChange={(e) => {
                          setUsuarioEmail(e.target.value);
                          setAprobadorSearch(e.target.value);
                          setShowAprobadorDropdown(true);
                        }}
                        placeholder="ejemplo@firplak.com"
                        className="w-full p-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                      />
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {showAprobadorDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {orgUsers
                          .filter((u) => {
                            const term = (aprobadorSearch || usuarioEmail).toLowerCase();
                            return u.nombre.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
                          })
                          .map((user) => (
                            <div
                              key={user.email}
                              onClick={() => {
                                setUsuarioEmail(user.email);
                                setShowAprobadorDropdown(false);
                              }}
                              className="p-2.5 hover:bg-blue-50 cursor-pointer transition-colors flex items-center gap-2.5 text-left"
                            >
                              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                                {user.nombre.charAt(0)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-900 truncate text-xs">{user.email}</p>
                                <p className="text-[10px] text-slate-500 truncate">{user.nombre} {user.area ? `• ${user.area}` : ''}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Fecha de Radicación</label>
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      ¿Recibió Anticipo? *
                    </label>
                    <select
                      value={recibioAnticipo}
                      onChange={(e) => {
                        const val = e.target.value as 'no' | 'si';
                        setRecibioAnticipo(val);
                        if (val === 'no') {
                          setAnticipoRecibido(0);
                        }
                      }}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
                    >
                      <option value="no">No</option>
                      <option value="si">Sí</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Anticipo Recibido ($ COP)</label>
                    <input
                      type="number"
                      min={0}
                      disabled={recibioAnticipo === 'no'}
                      value={recibioAnticipo === 'no' ? '' : (anticipoRecibido || '')}
                      onChange={(e) => setAnticipoRecibido(Number(e.target.value) || 0)}
                      placeholder={recibioAnticipo === 'no' ? 'Inhabilitado ($ 0)' : '0'}
                      className={`w-full p-2.5 border rounded-xl font-mono font-bold focus:outline-none ${
                        recibioAnticipo === 'no'
                          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed italic text-[11px]'
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-600'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Motivo del Gasto / Viaje *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Visita comercial clientes zona norte"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-blue-600" /> Líneas de Gasto Soportado
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddLinea}
                    className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Añadir Comprobante
                  </button>
                </div>

                <div className="space-y-4">
                  {lineas.map((linea, index) => (
                    <div
                      key={linea.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                        <span>Comprobante #{index + 1}</span>
                        {lineas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLinea(linea.id)}
                            className="text-rose-600 hover:text-rose-700 p-1"
                            title="Eliminar comprobante"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Fecha Gasto</label>
                          <input
                            type="date"
                            value={linea.fecha}
                            onChange={(e) => handleUpdateLinea(linea.id, 'fecha', e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Tipo Doc.</label>
                          <select
                            value={linea.tipoDocumento || 'Factura'}
                            onChange={(e) => handleUpdateLinea(linea.id, 'tipoDocumento', e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
                          >
                            <option value="Factura">Factura</option>
                            <option value="Documento Soporte">Documento Soporte</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">N° Factura</label>
                          {linea.tipoDocumento === 'Documento Soporte' ? (
                            <input
                              type="text"
                              disabled
                              value="Inhabilitado (Doc. Soporte)"
                              className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-400 font-mono italic cursor-not-allowed text-[11px]"
                            />
                          ) : (
                            <input
                              type="text"
                              placeholder="Ej. FE-1092"
                              value={linea.facturaNumero}
                              onChange={(e) => handleUpdateLinea(linea.id, 'facturaNumero', e.target.value)}
                              className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900"
                            />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">NIT del Proveedor *</label>
                          <input
                            type="text"
                            required
                            list={`prov-nit-public-${linea.id}`}
                            placeholder="Ej. 900123456"
                            value={linea.proveedorNit || ''}
                            onChange={(e) => handleUpdateLinea(linea.id, 'proveedorNit', e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono font-semibold focus:outline-none focus:border-blue-600 text-xs"
                          />
                          <datalist id={`prov-nit-public-${linea.id}`}>
                            {proveedores.map((p) => (
                              <option key={p.id} value={p.numero_identificacion || ''}>
                                {p.razon_social || ''}
                              </option>
                            ))}
                          </datalist>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Centro de Costos *</label>
                          <select
                            required
                            value={linea.concepto || ''}
                            onChange={(e) => {
                              handleUpdateLinea(linea.id, 'concepto', e.target.value);
                              handleUpdateLinea(linea.id, 'cuentaId', null);
                            }}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:border-blue-600 text-xs"
                          >
                            <option value="" disabled>-- Seleccione Centro de Costo --</option>
                            {centros.map((c) => (
                              <option key={c.id} value={`${c.codigo} - ${c.Título}`}>
                                {c.codigo} - {c.Título}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Cuenta Contable (Supabase) *</label>
                          <select
                            value={linea.cuentaId || ''}
                            onChange={(e) => handleUpdateLinea(linea.id, 'cuentaId', e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-blue-900 font-mono font-semibold text-xs"
                            required
                          >
                            <option value="" disabled>-- Seleccione Cuenta Contable --</option>
                            {cuentas.filter((c) => {
                              if (!linea.concepto) return true;
                              const cc = linea.concepto.toUpperCase();
                              if (cc.startsWith('GA')) return c.Título.startsWith('51');
                              if (cc.startsWith('GV')) return c.Título.startsWith('52');
                              if (cc.startsWith('IP')) return c.Título.startsWith('73');
                              if (cc.startsWith('MO')) return c.Título.startsWith('72');
                              return true;
                            }).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.Título} ({c.categoria})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Valor del Gasto ($ COP) *</label>
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={linea.valorSubtotal || ''}
                            onChange={(e) => handleUpdateLinea(linea.id, 'valorSubtotal', e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono font-bold"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Total Comprobante</label>
                          <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-blue-900 font-mono font-bold">
                            {formatCOP(linea.valorTotal)}
                          </div>
                        </div>
                      </div>

                      {/* File Upload Row */}
                      <div className="mt-2 border-t border-slate-200/70 pt-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                            Adjuntar Soporte ({linea.tipoDocumento || 'Factura'})
                          </label>
                          {linea.soporteUrl && linea.soporteUrl !== 'uploading' && (
                            <a
                              href={linea.soporteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                            >
                              <ExternalLink className="w-3 h-3" /> Ver Adjunto
                            </a>
                          )}
                        </div>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleUpdateLinea(linea.id, 'soporteFile', file);
                              handleUpdateLinea(linea.id, 'soporteUrl', 'uploading');
                              
                              const fileExt = file.name.split('.').pop();
                              const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
                              const filePath = `comprobantes/${fileName}`;
                              
                              try {
                                const { data: uploadData, error: uploadError } = await supabase.storage
                                  .from('soportes')
                                  .upload(filePath, file);
                                  
                                if (!uploadError) {
                                  const { data: urlData } = supabase.storage
                                    .from('soportes')
                                    .getPublicUrl(filePath);
                                  handleUpdateLinea(linea.id, 'soporteUrl', urlData.publicUrl);
                                } else {
                                  console.error('Error uploading file:', uploadError);
                                  handleUpdateLinea(linea.id, 'soporteUrl', '');
                                  alert('Error al subir el archivo: ' + uploadError.message);
                                }
                              } catch (err: any) {
                                console.error('Error de red al subir:', err);
                                handleUpdateLinea(linea.id, 'soporteUrl', '');
                              }
                            }
                          }}
                          className="block w-full text-xs text-slate-500
                            file:mr-4 file:py-1 file:px-3
                            file:rounded-lg file:border-0
                            file:text-xs file:font-bold
                            file:bg-blue-50 file:text-blue-700
                            hover:file:bg-blue-100
                            cursor-pointer transition-colors"
                        />
                        {linea.soporteUrl === 'uploading' && (
                          <div className="mt-1 flex items-center gap-1.5 text-blue-700 font-bold text-[10px]">
                            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <span>Subiendo documento a Supabase Storage...</span>
                          </div>
                        )}
                        {linea.soporteUrl && linea.soporteUrl !== 'uploading' && (
                          <div className="mt-1 flex items-center gap-1.5 text-emerald-700 font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>✓ Documento guardado correctamente</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Card */}
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-blue-700 font-semibold text-[11px]">Resumen de Liquidación</span>
                  <p className="text-xs text-slate-700">
                    Anticipo: <span className="font-mono font-semibold">{formatCOP(anticipoRecibido)}</span> | Total Gastos: <span className="font-mono font-semibold text-blue-900">{formatCOP(totalGastos)}</span>
                  </p>
                </div>
                <div className="text-right font-mono">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">
                    {saldoDiferencia >= 0 ? 'Saldo a Reembolsar al Empleado' : 'Saldo a Devolver a la Empresa'}
                  </span>
                  <span className={`text-base font-black ${saldoDiferencia >= 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                    {formatCOP(saldoDiferencia)}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-600/25 transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar Legalización de Gastos</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500">
          Firplak S.A.S &bull; Departamento de Contabilidad y Finanzas
        </div>
      </div>
    </div>
  );
}
