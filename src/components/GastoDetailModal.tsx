'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, FileText, User, Calendar, AlertCircle, Receipt } from 'lucide-react';
import { Legalizacion } from '@/types/legalizaciones';

interface GastoDetailModalProps {
  gasto: Legalizacion | null;
  onClose: () => void;
  onUpdateStatus: (id: string, nuevoEstado: Legalizacion['estado'], observaciones?: string) => void;
}

export const GastoDetailModal: React.FC<GastoDetailModalProps> = ({
  gasto,
  onClose,
  onUpdateStatus,
}) => {
  const [observaciones, setObservaciones] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!gasto) return null;

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
    setIsSubmitting(true);

    // Automatic SAP draft creation when approved
    if (nuevoEstado === 'aprobado') {
      try {
        await fetch('/api/sap/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gasto),
        });
      } catch (sapErr) {
        console.error('Error al enviar borrador automático a SAP:', sapErr);
      }
    }

    try {
      const link = typeof window !== 'undefined' ? `${window.location.origin}/formulario-gastos/${gasto.id}` : '';
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: gasto.usuarioEmail,
          titulo: `Legalización de Gastos ${gasto.codigo} - ${nuevoEstado === 'aprobado' ? 'Aprobada' : 'Rechazada'}`,
          contenido: `Tu legalización de gastos ${gasto.codigo} ha sido ${nuevoEstado === 'aprobado' ? 'aprobada y enviada a SAP' : 'rechazada'}.${observaciones ? ` Observaciones: ${observaciones}` : ''}`,
          link: link,
        }),
      }).catch((e) => console.error('Error enviando notificación de estado:', e));
    } catch (e) {
      console.error(e);
    }

    setTimeout(() => {
      onUpdateStatus(gasto.id, nuevoEstado, observaciones);
      setIsSubmitting(false);
      onClose();
    }, 300);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  {gasto.sapDocEntry ? `SAP #${gasto.sapDocEntry}` : gasto.codigo}
                </h2>
                <span className="text-xs text-blue-200 font-normal">| {gasto.fecha}</span>
              </div>
              <p className="text-xs text-blue-100">{gasto.motivo || 'Legalización de Gastos'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(gasto.estado)}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Main Info Cards (2 columns without general Centro de Costos) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Solicitante</span>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                  {gasto.usuarioNombre?.charAt(0) || 'U'}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{gasto.usuarioNombre}</p>
                  <p className="text-[11px] text-slate-500">{gasto.usuarioEmail}</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Balance de Liquidación</span>
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Anticipo:</span>
                  <span className="font-mono font-medium text-slate-800">{formatCOP(gasto.anticipoRecibido)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Gastos:</span>
                  <span className="font-mono font-bold text-blue-900">{formatCOP(gasto.totalGastos)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">Saldo Neto:</span>
                  <span className={`font-mono font-bold ${gasto.saldoDiferencia >= 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                    {formatCOP(gasto.saldoDiferencia)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Lines Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" /> Comprobantes y Líneas ({gasto.lineas?.length || 0})
            </h3>
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Tipo / Factura</th>
                    <th className="py-2.5 px-3">NIT Proveedor</th>
                    <th className="py-2.5 px-3">Centro de Costos</th>
                    <th className="py-2.5 px-3">Cuenta Contable</th>
                    <th className="py-2.5 px-3 text-right">Valor Total</th>
                    <th className="py-2.5 px-3 text-center">Soporte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gasto.lineas?.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 text-slate-700">{l.fecha}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-800">{l.tipoDocumento || 'Factura'}</span>
                        {l.facturaNumero && <p className="text-[10px] text-slate-500 font-mono">{l.facturaNumero}</p>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-slate-900">{l.proveedorNit || '-'}</span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">
                        {l.concepto || gasto.centroCosto}
                      </td>
                      <td className="py-2.5 px-3 text-blue-900 font-mono font-medium">
                        {l.cuentaTitulo || 'Cuenta asociada'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCOP(l.valorTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {l.soporteUrl ? (
                          <a
                            href={l.soporteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-semibold text-[11px]"
                          >
                            Ver Soporte
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Sin archivo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Observations Box for Approval */}
          {gasto.estado === 'pendiente' && (
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
              <label className="block font-bold text-amber-900 text-xs">
                Observaciones del Aprobador (Opcional)
              </label>
              <textarea
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Indique cualquier comentario o razón de aprobación/rechazo..."
                className="w-full p-2.5 bg-white border border-amber-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 text-xs"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold transition-colors text-xs"
          >
            Cerrar
          </button>

          {gasto.estado === 'pendiente' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleAction('rechazado')}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5 text-xs disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span>Rechazar</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleAction('aprobado')}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 text-xs disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Aprobar Legalización</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
