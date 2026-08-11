'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, Calculator, Plus, Trash2, Database, Send, UserCheck } from 'lucide-react';
import {
  fetchCuentasFromSupabase,
  fetchProveedoresFromSupabase,
  fetchResponsablesFromSupabase,
  fetchCentrosCostoFromSupabase,
  saveLocalLegalizacion,
  supabase
} from '@/lib/supabase';
import { CuentaContable, Proveedor, LineaGasto, Legalizacion, ResponsableCaja, CentroCosto } from '@/types/legalizaciones';

export default function FormularioPublicoPage() {
  const [responsables, setResponsables] = useState<ResponsableCaja[]>([]);
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [centros, setCentros] = useState<CentroCosto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [lastCodigo, setLastCodigo] = useState('');

  // Primary question: Responsable de Caja Menor (Supabase dropdown)
  const [selectedResponsableId, setSelectedResponsableId] = useState<number | ''>('');

  // Form states
  const [usuarioNombre, setUsuarioNombre] = useState('');
  const [usuarioEmail, setUsuarioEmail] = useState('');
  const [centroCosto, setCentroCosto] = useState('1020 - Operaciones Comercial');
  const [motivo, setMotivo] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [anticipoRecibido, setAnticipoRecibido] = useState<number>(0);

  const [lineas, setLineas] = useState<LineaGasto[]>([
    {
      id: 'lin-pub-1',
      fecha: new Date().toISOString().split('T')[0],
      concepto: '',
      cuentaId: 1,
      cuentaTitulo: '51100505 - JUNTA DIRECTIVA',
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
        const [rData, cData, pData, centrosData] = await Promise.all([
          fetchResponsablesFromSupabase(),
          fetchCuentasFromSupabase(),
          fetchProveedoresFromSupabase(),
          fetchCentrosCostoFromSupabase(),
        ]);
        setResponsables(rData);
        setCuentas(cData);
        setProveedores(pData);
        setCentros(centrosData);

        if (rData.length > 0) {
          const first = rData[0];
          setSelectedResponsableId(first.id);
          setUsuarioNombre(first.nombre);
          setUsuarioEmail(first.email);
          if (first.centro_costo) setCentroCosto(first.centro_costo);
        }

        if (cData.length > 0) {
          setLineas((prev) =>
            prev.map((l) => ({
              ...l,
              cuentaId: cData[0].id,
              cuentaTitulo: cData[0].Título,
            }))
          );
        }
      } catch (err) {
        console.error('Error cargando catálogos de Supabase:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleResponsableChange = (idVal: number) => {
    setSelectedResponsableId(idVal);
    const resp = responsables.find((r) => r.id === idVal);
    if (resp) {
      setUsuarioNombre(resp.nombre);
      setUsuarioEmail(resp.email);
      if (resp.centro_costo) setCentroCosto(resp.centro_costo);
    }
  };

  const formatCOP = (num: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const handleAddLinea = () => {
    const defaultCuenta = cuentas[0];
    const newLine: LineaGasto = {
      id: `lin-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      fecha: new Date().toISOString().split('T')[0],
      concepto: '',
      cuentaId: defaultCuenta ? defaultCuenta.id : 1,
      cuentaTitulo: defaultCuenta ? defaultCuenta.Título : 'Gasto General',
      proveedorNombre: proveedores[0]?.razon_social || '',
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

        if (field === 'concepto') {
          updated.cuentaId = null;
          updated.cuentaTitulo = '';
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

        if (field === 'valorSubtotal' || field === 'valorIva') {
          const sub = field === 'valorSubtotal' ? Number(value) : lin.valorSubtotal;
          const iva = field === 'valorIva' ? Number(value) : lin.valorIva;
          updated.valorTotal = sub + iva;
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

    if (!selectedResponsableId) {
      alert('Por favor seleccione el Responsable / Custodio de la Caja Menor.');
      return;
    }

    const lineasSinNIT = lineas.some((l) => !l.proveedorNit || l.proveedorNit.trim() === '');
    if (lineasSinNIT) {
      alert('Por favor ingrese el NIT del Proveedor en todas las líneas de gasto.');
      return;
    }

    const lineasInvalidas = lineas.some((l) => !l.concepto);
    if (lineasInvalidas) {
      alert('Por favor seleccione el Centro de Costos en todas las líneas de gasto.');
      return;
    }

    const randomNum = Math.floor(100 + Math.random() * 900);
    const codigo = `LEG-PUB-${randomNum}`;

    const nuevaLeg: Legalizacion = {
      id: `leg-pub-${Date.now()}`,
      codigo,
      fecha,
      usuarioNombre,
      usuarioEmail,
      centroCosto,
      motivo,
      estado: 'pendiente',
      anticipoRecibido,
      totalGastos,
      saldoDiferencia,
      lineas,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to Supabase (primary) and local storage (backup)
    try {
      const { error } = await supabase.from('legalizaciones').insert([{
        id: nuevaLeg.id,
        codigo: nuevaLeg.codigo,
        fecha: nuevaLeg.fecha,
        usuarioNombre: nuevaLeg.usuarioNombre,
        usuarioEmail: nuevaLeg.usuarioEmail,
        centroCosto: nuevaLeg.centroCosto,
        motivo: nuevaLeg.motivo,
        estado: nuevaLeg.estado,
        anticipoRecibido: nuevaLeg.anticipoRecibido,
        totalGastos: nuevaLeg.totalGastos,
        saldoDiferencia: nuevaLeg.saldoDiferencia,
        lineas: nuevaLeg.lineas,
        created_at: nuevaLeg.created_at,
        updated_at: nuevaLeg.updated_at,
      }]);
      if (error) {
        console.error('Error guardando en Supabase:', error);
      }
    } catch (e) {
      console.error('Error de red al guardar:', e);
    }

    saveLocalLegalizacion(nuevaLeg);
    setLastCodigo(codigo);
    setSubmitted(true);
  };

  const handleResetForm = () => {
    setSubmitted(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 py-4 px-6 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
              <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Legalisa <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">Formulario Público Sin Login</span>
              </h1>
              <p className="text-xs text-slate-500">Registro de Viáticos y Legalización de Gastos Corporativos</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500">
            <Database className="w-4 h-4 text-blue-600" />
            <span>Supabase Database Connected</span>
          </div>
        </div>
      </header>

      {/* Form Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6">
        {submitted ? (
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-xl text-center space-y-6 max-w-lg mx-auto mt-10">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">¡Legalización Registrada con Éxito!</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tu solicitud ha sido enviada con el código <strong className="font-mono text-blue-900">{lastCodigo}</strong> a nombre del responsable <strong className="text-slate-900">{usuarioNombre}</strong>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono text-left space-y-1">
              <p className="text-slate-500 font-sans font-semibold">Resumen de Envío:</p>
              <p>Código: <strong className="text-slate-900">{lastCodigo}</strong></p>
              <p>Responsable: <strong className="text-slate-900">{usuarioNombre} ({usuarioEmail})</strong></p>
              <p>Total Gastos: <strong className="text-emerald-700">{formatCOP(totalGastos)}</strong></p>
            </div>

            <button
              onClick={handleResetForm}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition-all"
            >
              Registrar Otra Legalización
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-blue-700 to-indigo-800 text-white">
              <h2 className="text-lg font-bold">Formulario de Registro de Gastos</h2>
              <p className="text-xs text-blue-100">Diligencie la información de los comprobantes para legalización de viáticos</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 text-xs">
              {/* FIRST QUESTION: Responsable de la Caja Menor (Supabase dropdown) */}
              <div className="p-5 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-700" /> 1. ¿Quién es el Responsable / Custodio de la Caja Menor? *
                  </label>
                </div>

                <select
                  required
                  value={selectedResponsableId}
                  onChange={(e) => handleResponsableChange(Number(e.target.value))}
                  className="w-full p-3 bg-white border border-blue-300 rounded-xl text-slate-900 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-sm"
                >
                  <option value="" disabled>
                    -- Seleccione el Responsable de la Caja Menor --
                  </option>
                  {responsables.map((resp) => (
                    <option key={resp.id} value={resp.id}>
                      {resp.nombre} - {resp.centro_costo || 'General'} [{resp.cargo || 'Custodio'}]
                    </option>
                  ))}
                </select>

                <p className="text-[11px] text-blue-800">
                  Seleccione el funcionario a cargo del fondo fijo de caja menor para asignar la legalización.
                </p>
              </div>

              {/* Section removed per user request */}

              {/* Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-blue-600" /> Líneas de Gasto y Comprobantes
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddLinea}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Comprobante
                  </button>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {lineas.map((linea) => (
                    <div
                      key={linea.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Fecha Comprobante</label>
                          <input
                            type="date"
                            value={linea.fecha}
                            onChange={(e) => handleUpdateLinea(linea.id, 'fecha', e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">NIT Proveedor *</label>
                          <input
                            required
                            type="text"
                            placeholder="900123456"
                            value={linea.proveedorNit || ''}
                            onChange={(e) => handleUpdateLinea(linea.id, 'proveedorNit', e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-900"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Centro de Costos *</label>
                          <select
                            required
                            value={linea.concepto}
                            onChange={(e) => handleUpdateLinea(linea.id, 'concepto', e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                          >
                            <option value="" disabled>-- Seleccione Centro de Costo --</option>
                            {centros.map((centro) => (
                              <option key={centro.id} value={`${centro.codigo} - ${centro.Título}`}>
                                {centro.codigo} - {centro.Título}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Tipo Doc.</label>
                          <select
                            value={linea.tipoDocumento || 'Factura'}
                            onChange={(e) => handleUpdateLinea(linea.id, 'tipoDocumento', e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                          >
                            <option value="Factura">Factura</option>
                            <option value="Documento Soporte">Documento Soporte</option>
                          </select>
                        </div>
                        <div>
                          {linea.tipoDocumento !== 'Documento Soporte' && (
                            <>
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">N° Factura</label>
                              <input
                                type="text"
                                placeholder="FE-9901"
                                value={linea.facturaNumero}
                                onChange={(e) => handleUpdateLinea(linea.id, 'facturaNumero', e.target.value)}
                                className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-900"
                              />
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Cuenta Contable (Supabase)</label>
                          <select
                            value={linea.cuentaId || ''}
                            onChange={(e) => handleUpdateLinea(linea.id, 'cuentaId', e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-blue-900 font-mono font-semibold"
                          >
                            <option value="" disabled>-- Seleccione Cuenta --</option>
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
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Subtotal ($ COP)</label>
                          <input
                            type="number"
                            min={0}
                            value={linea.valorSubtotal || ''}
                            onChange={(e) => handleUpdateLinea(linea.id, 'valorSubtotal', e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">IVA ($ COP)</label>
                            <input
                              type="number"
                              min={0}
                              value={linea.valorIva || ''}
                              onChange={(e) => handleUpdateLinea(linea.id, 'valorIva', e.target.value)}
                              className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono"
                            />
                          </div>
                          {lineas.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLinea(linea.id)}
                              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Eliminar comprobante"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* File Upload Row */}
                      <div className="mt-2 border-t border-slate-100 pt-3">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                          Adjuntar {linea.tipoDocumento} (PDF o Imagen)
                        </label>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpdateLinea(linea.id, 'soporteFile', file);
                          }}
                          className="block w-full text-xs text-slate-500
                            file:mr-4 file:py-1.5 file:px-4
                            file:rounded-lg file:border-0
                            file:text-xs file:font-bold
                            file:bg-blue-100 file:text-blue-700
                            hover:file:bg-blue-200
                            cursor-pointer transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation Card */}
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-blue-800 font-bold text-xs">Cálculo de Liquidación</span>
                  <p className="text-xs text-slate-700">
                    Total Gastos Soportados: <strong className="font-mono text-blue-900">{formatCOP(totalGastos)}</strong>
                  </p>
                </div>
                <div className="text-right font-mono">
                  <span className="text-[10px] text-slate-500 block uppercase font-sans font-semibold">
                    {saldoDiferencia >= 0 ? 'Saldo a Reembolsar' : 'Saldo a Devolver'}
                  </span>
                  <span className={`text-lg font-bold ${saldoDiferencia >= 0 ? 'text-emerald-700' : 'text-blue-700'}`}>
                    {formatCOP(Math.abs(saldoDiferencia))}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                <Send className="w-4 h-4" /> Enviar Formulario de Legalización
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
