'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, FileText, User, Building, Calendar, AlertCircle, Send, Database } from 'lucide-react';
import { TarjetaCredito } from '@/types/tarjetasCredito';

interface TarjetaCreditoDetailModalProps {
  tarjetaCredito: TarjetaCredito | null;
  onClose: () => void;
  onUpdateStatus: (id: string, nuevoEstado: TarjetaCredito['estado'], observaciones?: string) => void;
}

export const TarjetaCreditoDetailModal: React.FC<TarjetaCreditoDetailModalProps> = ({
  tarjetaCredito,
  onClose,
  onUpdateStatus,
}) => {
  const [observaciones, setObservaciones] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sapSyncing, setSapSyncing] = useState(false);
  const [sapResult, setSapResult] = useState<{ success: boolean; message: string; docEntry?: number } | null>(null);

  if (!tarjetaCredito) return null;

  const formatCOP = (num: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getStatusBadge = (estado: TarjetaCredito['estado']) => {
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

  const handleAction = async (nuevoEstado: TarjetaCredito['estado']) => {
    setIsSubmitting(true);
    if (nuevoEstado === 'aprobado') {
      await handleEnviarSAP();
      // wait a bit for user to see the success message before closing
      setTimeout(() => {
        onUpdateStatus(tarjetaCredito.id, nuevoEstado, observaciones);
        setIsSubmitting(false);
        onClose();
      }, 1500);
    } else {
      setTimeout(() => {
        onUpdateStatus(tarjetaCredito.id, nuevoEstado, observaciones);
        setIsSubmitting(false);
        onClose();
      }, 300);
    }
  };

  const handleEnviarSAP = async () => {
    setSapSyncing(true);
    setSapResult(null);
    try {
      const res = await fetch('/api/sap/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tarjetaCredito),
      });

      const data = await res.json();
      setSapResult({
        success: data.success,
        message: data.message || (data.success ? 'Borrador creado en SAP Service Layer' : 'Error al conectar con SAP'),
        docEntry: data.docEntry,
      });
    } catch (err: any) {
      setSapResult({
        success: false,
        message: err.message || 'Error de conexión con la API de SAP Service Layer',
      });
    } finally {
      setSapSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 font-mono">{tarjetaCredito.codigo}</h2>
                {getStatusBadge(tarjetaCredito.estado)}
              </div>
              <p className="text-xs text-slate-500">{tarjetaCredito.motivo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* SAP Service Layer Draft Output */}
          {sapSyncing && (
            <div className="p-3.5 rounded-2xl text-[11px] bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              Enviando automáticamente a SAP...
            </div>
          )}

          {sapResult && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-center justify-between border ${
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

          {/* Main Attributes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <p className="text-slate-500 text-[10px]">Solicitante</p>
                <p className="font-semibold text-slate-900">{tarjetaCredito.usuarioNombre}</p>
                <p className="text-[10px] text-slate-500">{tarjetaCredito.usuarioEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Building className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <p className="text-slate-500 text-[10px]">Centro de Costo</p>
                <p className="font-semibold text-slate-900">{tarjetaCredito.centroCosto}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <p className="text-slate-500 text-[10px]">Fecha de Registro</p>
                <p className="font-semibold text-slate-900">{tarjetaCredito.fecha}</p>
              </div>
            </div>
          </div>

          {/* Balance Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700">
              <p className="text-[11px] text-slate-500">Anticipo Recibido</p>
              <p className="text-base font-bold font-mono text-slate-900 mt-1">
                {formatCOP(tarjetaCredito.anticipoRecibido)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700">
              <p className="text-[11px] text-slate-500">Total Gastos Soportados</p>
              <p className="text-base font-bold font-mono text-blue-900 mt-1">
                {formatCOP(tarjetaCredito.totalGastos)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700">
              <p className="text-[11px] text-slate-500">Saldo Diferencia</p>
              <p className={`text-base font-bold font-mono mt-1 ${tarjetaCredito.saldoDiferencia >= 0 ? 'text-emerald-700' : 'text-blue-700'}`}>
                {formatCOP(tarjetaCredito.saldoDiferencia)}
              </p>
              <span className="text-[10px] text-slate-500 font-medium">
                {tarjetaCredito.saldoDiferencia >= 0 ? 'Pagar a Empleado' : 'Devolver a Empresa'}
              </span>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Desglose de Comprobantes & Gastos ({tarjetaCredito.lineas.length})
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
                  {tarjetaCredito.lineas.map((linea) => (
                    <tr key={linea.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500">{linea.fecha}</td>
                      <td className="py-3 px-4 font-mono text-[11px] font-bold text-blue-900">
                        {linea.cuentaTitulo}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{linea.concepto}</p>
                        <span className="text-[10px] text-slate-500">Factura/Soporte: {linea.facturaNumero}</span>
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
          {tarjetaCredito.lineas.some(l => l.soporteUrl) && (
            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-sm">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" /> Soportes y Documentos Adjuntos
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {tarjetaCredito.lineas.filter(l => l.soporteUrl).map((linea, index) => {
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

          {/* Observations & Approval trail */}
          {tarjetaCredito.observacionesAprobacion && (
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs">
              <p className="text-[10px] font-bold uppercase text-blue-800">Notas de Auditoría / Aprobación</p>
              <p className="text-slate-800 mt-1 italic">&ldquo;{tarjetaCredito.observacionesAprobacion}&rdquo;</p>
            </div>
          )}

          {/* Approval Action Box */}
          {tarjetaCredito.estado === 'pendiente' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="block text-xs font-semibold text-slate-800">
                Observaciones del Aprobador / Comentario de Revisión:
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Añadir observaciones o motivo de rechazo..."
                rows={2}
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
              />
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  disabled={isSubmitting}
                  onClick={() => handleAction('rechazado')}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <XCircle className="w-4 h-4" /> Rechazar Legalización
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() => handleAction('aprobado')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> Aprobar Legalización
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Sincronizado con Supabase Backend & SAP Service Layer</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
