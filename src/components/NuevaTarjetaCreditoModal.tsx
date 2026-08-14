'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, CheckCircle2, FileText, Calculator, Paperclip, ExternalLink } from 'lucide-react';
import { TarjetaCredito, LineaGasto, CuentaContable, Proveedor } from '@/types/tarjetasCredito';
import { supabase } from '@/lib/supabase';

interface NuevaTarjetaCreditoModalProps {
  isOpen: boolean;
  onClose: () => void;
  cuentas: CuentaContable[];
  proveedores: Proveedor[];
  onSave: (nueva: TarjetaCredito) => void;
}

export const NuevaTarjetaCreditoModal: React.FC<NuevaTarjetaCreditoModalProps> = ({
  isOpen,
  onClose,
  cuentas,
  proveedores,
  onSave,
}) => {
  if (!isOpen) return null;

  const [usuarioNombre, setUsuarioNombre] = useState('Carlos Eduardo Mendoza');
  const [usuarioEmail, setUsuarioEmail] = useState('carlos.mendoza@firplak.com');
  const [centroCosto, setCentroCosto] = useState('1020 - Operaciones Comercial');
  const [motivo, setMotivo] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [anticipoRecibido, setAnticipoRecibido] = useState<number>(500000);

  const [lineas, setLineas] = useState<LineaGasto[]>([
    {
      id: 'lin-init-1',
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

  const formatCOP = (num: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const handleAddLinea = () => {
    const newLine: LineaGasto = {
      id: `lin-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
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
    };
    setLineas([...lineas, newLine]);
  };

  const handleUpdateLinea = (id: string, field: keyof LineaGasto, value: any) => {
    setLineas((prev) =>
      prev.map((lin) => {
        if (lin.id !== id) return lin;
        const updated = { ...lin, [field]: value };

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) {
      alert('Por favor ingrese el motivo de la legalización.');
      return;
    }

    const randomNum = Math.floor(100 + Math.random() * 900);
    const nuevaLeg: TarjetaCredito = {
      id: `leg-${Date.now()}`,
      codigo: `LEG-2026-${randomNum}`,
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

    onSave(nuevaLeg);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
              <FileText className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold">Registrar Nueva Tarjeta de Crédito</h2>
              <p className="text-xs text-blue-100">Registre los gastos de su tarjeta corporativa y adjunte comprobantes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Header Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Empleado Solicitante</label>
              <input
                type="text"
                value={usuarioNombre}
                onChange={(e) => setUsuarioNombre(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Correo Electrónico</label>
              <input
                type="email"
                value={usuarioEmail}
                onChange={(e) => setUsuarioEmail(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Centro de Costo</label>
              <select
                value={centroCosto}
                onChange={(e) => setCentroCosto(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="1020 - Operaciones Comercial">1020 - Operaciones Comercial</option>
                <option value="2040 - Gestión Legal y Revisoría">2040 - Gestión Legal y Revisoría</option>
                <option value="3010 - Dirección de Producción">3010 - Dirección de Producción</option>
                <option value="4050 - Gestión Humana & Viáticos">4050 - Gestión Humana & Viáticos</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-700 font-semibold mb-1">Motivo / Concepto del Viaje o Gasto</label>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. Legalización de viáticos viaje Medellín - Clientes Corporativos"
                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Anticipo Recibido ($ COP)</label>
              <input
                type="number"
                value={anticipoRecibido}
                onChange={(e) => setAnticipoRecibido(Number(e.target.value))}
                className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono text-blue-700 font-bold focus:outline-none focus:border-blue-600"
                min={0}
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-600" /> Líneas de Gasto Soportado
              </h3>
              <button
                type="button"
                onClick={handleAddLinea}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Añadir Línea
              </button>
            </div>

            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {lineas.map((linea) => (
                <div
                  key={linea.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Fecha Gasto</label>
                      <input
                        type="date"
                        value={linea.fecha}
                        onChange={(e) => handleUpdateLinea(linea.id, 'fecha', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Tipo Doc.</label>
                      <select
                        value={linea.tipoDocumento || 'Factura'}
                        onChange={(e) => handleUpdateLinea(linea.id, 'tipoDocumento', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
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
                          className="w-full p-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-400 font-mono italic cursor-not-allowed text-[11px]"
                        />
                      ) : (
                        <input
                          type="text"
                          placeholder="Ej. FE-1092"
                          value={linea.facturaNumero}
                          onChange={(e) => handleUpdateLinea(linea.id, 'facturaNumero', e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-900"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Cuenta Contable (Supabase)</label>
                      <select
                        value={linea.cuentaId || ''}
                        onChange={(e) => handleUpdateLinea(linea.id, 'cuentaId', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-blue-900 font-mono font-semibold"
                        required
                      >
                        <option value="" disabled>-- Seleccione Cuenta Contable --</option>
                        {cuentas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.Título} ({c.categoria})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Valor del Gasto ($ COP)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={linea.valorSubtotal || ''}
                        onChange={(e) => handleUpdateLinea(linea.id, 'valorSubtotal', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono font-bold text-xs"
                        min={0}
                        required
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Total Línea ($ COP)</label>
                        <div className="p-1.5 bg-slate-100 border border-slate-200 rounded-lg text-blue-900 font-mono font-bold text-xs">
                          {formatCOP(linea.valorTotal)}
                        </div>
                      </div>
                      {lineas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLinea(linea.id)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Eliminar línea"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* File Upload Row */}
                  <div className="mt-2 border-t border-slate-200/70 pt-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                        Adjuntar Documento / Soporte ({linea.tipoDocumento || 'Factura'})
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

          {/* Real-time Summary Card */}
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-blue-700 font-semibold text-[11px]">Resumen de Liquidación</span>
              <p className="text-xs text-slate-700">
                Anticipo: <span className="font-mono font-semibold">{formatCOP(anticipoRecibido)}</span> | Total Soportado: <span className="font-mono font-semibold text-blue-900">{formatCOP(totalGastos)}</span>
              </p>
            </div>
            <div className="text-right font-mono">
              <span className="text-[10px] text-slate-500 block uppercase font-sans font-semibold">
                {saldoDiferencia >= 0 ? 'Saldo a Reembolsar a Empleado' : 'Saldo a Devolver a la Empresa'}
              </span>
              <span className={`text-lg font-bold ${saldoDiferencia >= 0 ? 'text-emerald-700' : 'text-blue-700'}`}>
                {formatCOP(Math.abs(saldoDiferencia))}
              </span>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> Guardar Legalización
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
