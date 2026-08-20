'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, FileText, User, Building, Calendar, AlertCircle, Send, Database } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Legalizacion } from '@/types/legalizaciones';

export default function PublicApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [legalizacion, setLegalizacion] = useState<Legalizacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sapSyncing, setSapSyncing] = useState(false);
  const [sapResult, setSapResult] = useState<{ success: boolean; message: string; docEntry?: number } | null>(null);

  useEffect(() => {
    async function loadLegalizacion() {
      try {
        const { data, error } = await supabase
          .from('legalizaciones_tarjetas_credito')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) {
          setErrorMsg('No se encontró la legalización solicitada o fue eliminada.');
        } else {
          const mappedData = {
            id: data.id,
            codigo: data.codigo,
            fecha: data.fecha,
            usuarioNombre: data.usuario_nombre,
            usuarioEmail: data.usuario_email,
            centroCosto: data.centro_costo,
            motivo: data.motivo,
            estado: data.estado,
            anticipoRecibido: data.anticipo_recibido,
            totalGastos: data.total_gastos,
            saldoDiferencia: data.saldo_diferencia,
            lineas: data.lineas || [],
            observacionesAprobacion: data.observaciones_aprobacion,
            created_at: data.created_at,
            updated_at: data.updated_at
          };
          setLegalizacion(mappedData as Legalizacion);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Error de comunicación al buscar la legalización.');
      } finally {
        setLoading(false);
      }
    }
    loadLegalizacion();
  }, [id]);

  const formatCOP = (num: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getStatusBadge = (estado: Legalizacion['estado']) => {
    switch (estado) {
      case 'aprobado':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Aprobado</span>;
      case 'rechazado':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5 text-rose-600" /> Rechazado</span>;
      case 'pagado':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> Liquidado</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Pendiente de Revisión</span>;
    }
  };

  const handleAction = async (nuevoEstado: Legalizacion['estado']) => {
    if (!legalizacion) return;
    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const updateFields: any = {
        estado: nuevoEstado,
        observaciones_aprobacion: observaciones,
        updated_at: nowIso,
      };
      if (nuevoEstado === 'aprobado') {
        updateFields.fecha_aprobacion = nowIso;
      }

      const { error } = await supabase
        .from('legalizaciones_tarjetas_credito')
        .update(updateFields)
        .eq('id', id);

      if (error) {
        alert('Error al actualizar el estado: ' + error.message);
      } else {
        const updatedLeg = {
          ...legalizacion,
          estado: nuevoEstado,
          observacionesAprobacion: observaciones,
          fechaAprobacion: nuevoEstado === 'aprobado' ? nowIso : legalizacion.fechaAprobacion,
        };
        setLegalizacion(updatedLeg);

        if (nuevoEstado === 'aprobado') {
          await handleEnviarSAP(updatedLeg);
        }
      }
    } catch (err: any) {
      alert('Error de conexión: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnviarSAP = async (legData: Legalizacion) => {
    if (!legData) return;
    setSapSyncing(true);
    setSapResult(null);
    try {
      const res = await fetch('/api/sap/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(legData),
      });

      const data = await res.json();
      setSapResult({
        success: data.success,
        message: data.message || (data.success ? 'Borrador creado en SAP Service Layer' : 'Error al conectar con SAP'),
        docEntry: data.docEntry,
      });

      if (data.success && data.docEntry) {
        try {
          await supabase
            .from('legalizaciones_tarjetas_credito')
            .update({ sap_doc_entry: data.docEntry, updated_at: new Date().toISOString() })
            .eq('id', legData.id);
        } catch (e) {}
      }
    } catch (err: any) {
      setSapResult({
        success: false,
        message: err.message || 'Error de conexión con la API de SAP Service Layer',
      });
    } finally {
      setSapSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500 font-bold">Cargando detalles de legalización...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !legalizacion) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-slate-200 p-8 rounded-3xl max-w-md text-center shadow-xl space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 border border-rose-200 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Error de Acceso</h3>
          <p className="text-xs text-slate-600 leading-relaxed">{errorMsg || 'La legalización no está disponible.'}</p>
        </div>
      </div>
    );
  }

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
                Legalisa <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">Panel de Aprobación Público</span>
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

      {/* Main Panel */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
          {/* Banner Title */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 font-mono">{legalizacion.codigo}</h2>
                  {getStatusBadge(legalizacion.estado)}
                </div>
                <p className="text-xs text-slate-500">{legalizacion.motivo}</p>
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-6 text-xs">
            {/* SAP Service Layer Draft Output */}
            {sapSyncing && (
              <div className="p-3.5 rounded-2xl text-[11px] bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                Enviando automáticamente a SAP...
              </div>
            )}

            {sapResult && (
              <div
                className={`p-3.5 rounded-2xl text-[11px] flex items-center justify-between border ${
                  sapResult.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                <span>{sapResult.message}</span>
                {sapResult.docEntry && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-mono font-bold text-[10px]">
                    DocEntry: {sapResult.docEntry}
                  </span>
                )}
              </div>
            )}

            {/* Attributes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-slate-500 text-[10px]">Solicitante</p>
                  <p className="font-semibold text-slate-900">{legalizacion.usuarioNombre}</p>
                  <p className="text-[10px] text-slate-500">{legalizacion.usuarioEmail}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Building className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-slate-500 text-[10px]">Centro de Costo</p>
                  <p className="font-semibold text-slate-900">{legalizacion.centroCosto}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-slate-500 text-[10px]">Fecha de Registro</p>
                  <p className="font-semibold text-slate-900">{legalizacion.fecha}</p>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] text-slate-500">Anticipo Recibido</p>
                <p className="text-base font-bold font-mono text-slate-900 mt-1">
                  {formatCOP(legalizacion.anticipoRecibido)}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] text-slate-500">Total Gastos Soportados</p>
                <p className="text-base font-bold font-mono text-blue-900 mt-1">
                  {formatCOP(legalizacion.totalGastos)}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="text-[11px] text-slate-500">Saldo Diferencia</p>
                <p className={`text-base font-bold font-mono mt-1 ${legalizacion.saldoDiferencia >= 0 ? 'text-emerald-700' : 'text-blue-700'}`}>
                  {formatCOP(legalizacion.saldoDiferencia)}
                </p>
                <span className="text-[10px] text-slate-500 font-medium">
                  {legalizacion.saldoDiferencia >= 0 ? 'Pagar a Empleado' : 'Devolver a Empresa'}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                Desglose de Comprobantes & Gastos ({legalizacion.lineas?.length || 0})
              </h3>
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Cuenta Contable</th>
                      <th className="py-3 px-4">Concepto & Soporte</th>
                      <th className="py-3 px-4">NIT Proveedor</th>
                      <th className="py-3 px-4 text-right">Subtotal</th>
                      <th className="py-3 px-4 text-right">IVA</th>
                      <th className="py-3 px-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {legalizacion.lineas?.map((linea) => (
                      <tr key={linea.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500">{linea.fecha}</td>
                        <td className="py-3 px-4 font-mono text-[11px] font-bold text-blue-900">
                          {linea.cuentaTitulo}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">{linea.concepto}</p>
                          <div className="flex flex-col gap-0.5 text-[10px] text-slate-500">
                            <span>Factura/Soporte: {linea.facturaNumero || 'N/A'}</span>
                            {linea.soporteUrl && (
                              <a
                                href={linea.soporteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline font-bold flex items-center gap-1 mt-0.5 cursor-pointer"
                              >
                                <FileText className="w-3 h-3 text-blue-500" /> Ver Adjunto Soporte
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {linea.proveedorNit || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {formatCOP(linea.valorSubtotal)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {formatCOP(linea.valorIva)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCOP(linea.valorTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Gallery of Attachments */}
            {legalizacion.lineas?.some(l => l.soporteUrl) && (
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-sm">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" /> Soportes y Documentos Adjuntos
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {legalizacion.lineas.filter(l => l.soporteUrl).map((linea, index) => {
                    const isImg = linea.soporteUrl?.match(/\.(jpeg|jpg|gif|png)$/i) || linea.soporteUrl?.startsWith('data:image/');
                    return (
                      <div key={linea.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900 text-[11px] truncate">{linea.concepto || `Gasto #${index + 1}`}</p>
                          <p className="text-[10px] text-slate-500 font-mono">Proveedor NIT: {linea.proveedorNit || 'N/A'}</p>
                        </div>
                        {isImg ? (
                          <div className="w-full aspect-[4/3] rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow relative group">
                            <img
                              src={linea.soporteUrl}
                              alt={`Soporte ${linea.concepto}`}
                              className="w-full h-full object-cover cursor-zoom-in"
                              onClick={() => window.open(linea.soporteUrl, '_blank')}
                              title="Click para ampliar"
                            />
                          </div>
                        ) : (
                          <a
                            href={linea.soporteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 border-dashed rounded-lg hover:border-blue-500 hover:bg-blue-50/25 transition-colors gap-2 text-center cursor-pointer group"
                          >
                            <FileText className="w-8 h-8 text-blue-600 group-hover:scale-105 transition-transform" />
                            <span className="font-bold text-blue-600 text-[10px] group-hover:underline">Ver Documento Soporte</span>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes Section */}
            {legalizacion.observacionesAprobacion && (
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
                <p className="text-[10px] font-bold uppercase text-blue-800">Notas de Auditoría / Aprobación</p>
                <p className="text-slate-800 mt-1 italic">&ldquo;{legalizacion.observacionesAprobacion}&rdquo;</p>
              </div>
            )}

            {/* Public Action Control Card */}
            {legalizacion.estado === 'pendiente' && (
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Observaciones del Aprobador / Comentario de Revisión:
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Escriba las observaciones del aprobador aquí o los motivos en caso de rechazo..."
                  rows={3}
                  className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-sm"
                />
                <div className="flex items-center justify-end gap-3">
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleAction('rechazado')}
                    className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" /> Rechazar Legalización
                  </button>
                  <button
                    disabled={isSubmitting}
                    onClick={() => handleAction('aprobado')}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> Aprobar Legalización
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
