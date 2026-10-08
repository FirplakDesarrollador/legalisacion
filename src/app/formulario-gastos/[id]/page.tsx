'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, FileText, User, Calendar, AlertCircle, Receipt, UserCheck, X } from 'lucide-react';
import { supabase, getLocalLegalizacionesGastos, fetchOrganizationUsers, OrganizationUser, fetchCuentasFromSupabase, fetchCentrosCostoFromSupabase } from '@/lib/supabase';
import { Legalizacion, LineaGasto, CuentaContable, CentroCosto } from '@/types/legalizaciones';
import { SearchableSelect } from '@/components/SearchableSelect';

export default function PublicGastoApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const [legalizacion, setLegalizacion] = useState<Legalizacion | null>(null);
  const [editableLineas, setEditableLineas] = useState<LineaGasto[]>([]);
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [centros, setCentros] = useState<CentroCosto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sapSyncing, setSapSyncing] = useState(false);
  const [sapResult, setSapResult] = useState<{ success: boolean; message: string; docEntry?: number } | null>(null);

  // Reasignar Aprobación States
  const [showReasignarModal, setShowReasignarModal] = useState(false);
  const [orgUsers, setOrgUsers] = useState<OrganizationUser[]>([]);
  const [selectedNewApproverEmail, setSelectedNewApproverEmail] = useState('');
  const [motivoReasignacion, setMotivoReasignacion] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);

  useEffect(() => {
    async function loadLegalizacion() {
      try {
        let found: Legalizacion | null = null;

        // 1. Try legalizaciones_gastos table
        let { data, error } = await supabase
          .from('legalizaciones_gastos')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!data) {
          const resByCode = await supabase
            .from('legalizaciones_gastos')
            .select('*')
            .eq('codigo', id)
            .maybeSingle();
          data = resByCode.data;
        }

        // 2. Try legalizaciones gastos table fallback
        if (!data) {
          const res2 = await supabase
            .from('legalizaciones gastos')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          data = res2.data;
        }

        // 3. Try local storage fallback
        if (!data) {
          const localList = getLocalLegalizacionesGastos();
          const localMatch = localList.find((l) => l.id === id || l.codigo === id);
          if (localMatch) {
            found = localMatch;
          }
        } else {
          found = {
            id: data.id,
            codigo: data.codigo,
            fecha: data.fecha,
            usuarioNombre: data.usuario_nombre || data.usuarioNombre,
            usuarioEmail: data.usuario_email || data.usuarioEmail,
            centroCosto: data.centro_costo || data.centroCosto,
            motivo: data.motivo,
            estado: data.estado,
            anticipoRecibido: data.anticipo_recibido ?? data.anticipoRecibido ?? 0,
            totalGastos: data.total_gastos ?? data.totalGastos ?? 0,
            saldoDiferencia: data.saldo_diferencia ?? data.saldoDiferencia ?? 0,
            observacionesAprobacion: data.observaciones_aprobacion || data.observacionesAprobacion,
            lineas: data.lineas || [],
            created_at: data.created_at,
            updated_at: data.updated_at,
            aprobadorNombre: data.aprobador_nombre || data.aprobadorNombre,
            aprobadorEmail: data.aprobador_email || data.aprobadorEmail,
            sapDocEntry: data.sap_doc_entry || data.sapDocEntry,
          };
        }

        if (!found) {
          setErrorMsg('No se encontró la legalización de gastos solicitada o fue eliminada.');
        } else {
          setLegalizacion(found);
          setEditableLineas(found.lineas || []);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Error de comunicación al buscar la legalización.');
      } finally {
        setLoading(false);
      }
    }
    
    async function loadCatalogs() {
      try {
        const [cData, centrosData] = await Promise.all([
          fetchCuentasFromSupabase(),
          fetchCentrosCostoFromSupabase()
        ]);
        setCuentas(cData);
        setCentros(centrosData);
      } catch (err) {
        console.warn('Error cargando catálogos:', err);
      }
    }
    
    loadLegalizacion();
    loadCatalogs();
  }, [id]);

  useEffect(() => {
    async function loadUsers() {
      try {
        const users = await fetchOrganizationUsers();
        setOrgUsers(users);
      } catch (err) {
        console.warn('Error cargando usuarios para reasignar:', err);
      }
    }
    loadUsers();
  }, []);

  const handleReasignar = async () => {
    if (!legalizacion || !selectedNewApproverEmail) {
      alert('Por favor seleccione el nuevo usuario aprobador.');
      return;
    }
    const newApprover = orgUsers.find(
      (u) => u.email.toLowerCase() === selectedNewApproverEmail.toLowerCase()
    ) || {
      nombre: selectedNewApproverEmail.split('@')[0],
      email: selectedNewApproverEmail,
    };

    setIsReassigning(true);
    try {
      const nowIso = new Date().toISOString();
      const observacionReasig = motivoReasignacion.trim()
        ? `[Reasignado a ${newApprover.nombre} (${newApprover.email})]: ${motivoReasignacion.trim()}`
        : `[Reasignado a ${newApprover.nombre} (${newApprover.email})]`;

      const updateFields: any = {
        aprobador_nombre: newApprover.nombre,
        aprobador_email: newApprover.email,
        observaciones_aprobacion: legalizacion.observacionesAprobacion
          ? `${legalizacion.observacionesAprobacion}\n${observacionReasig}`
          : observacionReasig,
        updated_at: nowIso,
      };

      let { error } = await supabase
        .from('legalizaciones_gastos')
        .update(updateFields)
        .eq('id', legalizacion.id);

      if (error) {
        // Fallback to legalizaciones gastos
        const res2 = await supabase
          .from('legalizaciones gastos')
          .update(updateFields)
          .eq('id', legalizacion.id);
        error = res2.error;
      }

      // Notificar al nuevo aprobador vía API proxy
      try {
        const link = `${window.location.origin}/formulario-gastos/${legalizacion.id}`;
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            correo: newApprover.email,
            titulo: `Aprobación Reasignada - Legalización de Gastos ${legalizacion.codigo}`,
            contenido: `Se te ha reasignado la aprobación de la legalización de gastos ${legalizacion.codigo} de ${legalizacion.usuarioNombre} por valor de ${formatCOP(legalizacion.totalGastos)} COP.${motivoReasignacion.trim() ? ` Motivo: ${motivoReasignacion.trim()}` : ''}`,
            link: link,
          }),
        });
      } catch (notifErr) {
        console.error('Error enviando notificación:', notifErr);
      }

      setLegalizacion({
        ...legalizacion,
        observacionesAprobacion: updateFields.observaciones_aprobacion,
      });
      setShowReasignarModal(false);
      setMotivoReasignacion('');
      setSelectedNewApproverEmail('');
      alert(`✅ Aprobación reasignada exitosamente a ${newApprover.nombre} (${newApprover.email}). Se ha enviado la notificación correspondiente.`);
    } catch (err: any) {
      alert('Error al reasignar: ' + err.message);
    } finally {
      setIsReassigning(false);
    }
  };

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

  const getMatchedCentroValue = (rawConcepto?: string) => {
    if (!rawConcepto) return '';
    const trimmed = rawConcepto.trim();
    const match = centros.find(c =>
      c.codigo.toLowerCase() === trimmed.toLowerCase() ||
      `${c.codigo} - ${c.Título}`.toLowerCase() === trimmed.toLowerCase() ||
      trimmed.toLowerCase().startsWith(c.codigo.toLowerCase() + ' -') ||
      trimmed.toLowerCase().startsWith(c.codigo.toLowerCase() + ' ')
    );
    return match ? `${match.codigo} - ${match.Título}` : trimmed;
  };

  const getMatchedCuentaId = (lineId: string | number, fallbackId?: number | null, fallbackTitulo?: string) => {
    const line = editableLineas.find(el => el.id === lineId);
    const cId = line?.cuentaId ?? fallbackId;
    if (cId) return String(cId);
    const title = line?.cuentaTitulo || fallbackTitulo || '';
    if (title) {
      const matched = cuentas.find(c =>
        String(c.id) === title ||
        c.Título.toLowerCase() === title.toLowerCase() ||
        title.toLowerCase().startsWith(c.Título.toLowerCase()) ||
        c.Título.toLowerCase().startsWith(title.toLowerCase())
      );
      if (matched) return String(matched.id);
    }
    return '';
  };

  const handleAction = async (nuevoEstado: Legalizacion['estado']) => {
    if (!legalizacion) return;
    setIsSubmitting(true);

    try {
      // 1. Guardar de inmediato la aprobación en la base de datos
      const updateData = {
        estado: nuevoEstado,
        observaciones_aprobacion: observaciones,
        lineas: editableLineas,
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase
        .from('legalizaciones_gastos')
        .update(updateData)
        .eq('id', legalizacion.id);

      if (error) {
        await supabase
          .from('legalizaciones gastos')
          .update(updateData)
          .eq('id', legalizacion.id);
      }

      const updatedLeg: Legalizacion = {
        ...legalizacion,
        estado: nuevoEstado,
        observacionesAprobacion: observaciones,
        lineas: editableLineas,
      };

      // Cambiar inmediatamente la UI a Aprobado / Rechazado
      setLegalizacion(updatedLeg);
      setIsSubmitting(false);

      // 2. Notificación en segundo plano al solicitante
      try {
        const link = typeof window !== 'undefined' ? `${window.location.origin}/formulario-gastos/${legalizacion.id}` : '';
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            correo: legalizacion.usuarioEmail,
            titulo: `Legalización de Gastos ${legalizacion.codigo} - ${nuevoEstado === 'aprobado' ? 'Aprobada' : 'Rechazada'}`,
            contenido: `Tu legalización de gastos ${legalizacion.codigo} ha sido ${nuevoEstado === 'aprobado' ? 'aprobada' : 'rechazada'}.${observaciones ? ` Observaciones: ${observaciones}` : ''}`,
            link: link,
          }),
        }).catch((e) => console.error('Error enviando notificación de estado:', e));
      } catch (e) {
        console.error(e);
      }

      // 3. Si es aprobado, enviar borrador a SAP con indicador en vivo y límite de tiempo
      if (nuevoEstado === 'aprobado') {
        setSapSyncing(true);
        setSapResult(null);
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s max timeout

          const res = await fetch('/api/sap/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedLeg),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          let sapData;
          try {
            sapData = await res.json();
          } catch {
            throw new Error(`Respuesta inválida del servidor SAP (${res.status}).`);
          }

          if (sapData.success && sapData.docEntry) {
            setSapResult({
              success: true,
              message: `Borrador registrado exitosamente en SAP Business One (#${sapData.docEntry})`,
              docEntry: sapData.docEntry,
            });
            setLegalizacion(prev => prev ? { ...prev, sapDocEntry: sapData.docEntry } : null);

            // Guardar docEntry en Supabase
            try {
              await supabase
                .from('legalizaciones_gastos')
                .update({ sap_doc_entry: sapData.docEntry })
                .eq('id', legalizacion.id);
            } catch {}
          } else {
            setSapResult({
              success: false,
              message: sapData.message || 'No fue posible registrar el borrador en SAP Service Layer',
            });
          }
        } catch (sapErr: any) {
          console.error('Error al sincronizar con SAP:', sapErr);
          setSapResult({
            success: false,
            message: sapErr.name === 'AbortError'
              ? 'Tiempo de espera agotado al conectar con SAP (Servidor tardó más de 20s en responder).'
              : (sapErr.message || 'Error de conexión con SAP Service Layer.'),
          });
        } finally {
          setSapSyncing(false);
        }
      }
    } catch (err: any) {
      alert('Error al actualizar estado: ' + err.message);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-white text-xs space-y-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p>Cargando información de la legalización de gastos...</p>
        </div>
      </div>
    );
  }

  if (errorMsg || !legalizacion) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-slate-100 space-y-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Error de Acceso</h2>
          <p className="text-xs text-slate-500">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      <div className="max-w-5xl w-full mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 border border-blue-400/30 rounded-2xl">
              <Receipt className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Aprobación de Legalización de Gastos &bull; {legalizacion.sapDocEntry ? `SAP #${legalizacion.sapDocEntry}` : legalizacion.codigo}
              </h1>
              <p className="text-xs text-slate-400">
                Sistema Corporativo Firplak S.A.S &bull; Portal de Aprobación
              </p>
            </div>
          </div>
          <div>{getStatusBadge(legalizacion.estado)}</div>
        </div>

        {/* Main Card */}
        <div className="bg-white text-slate-800 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden p-6 sm:p-8 space-y-6 text-xs">
          {/* SAP Service Layer Status Banners */}
          {sapSyncing && (
            <div className="p-3.5 rounded-2xl text-[11px] bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Sincronizando y enviando borrador automáticamente a SAP Business One...</span>
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
                  DocEntry: #{sapResult.docEntry}
                </span>
              )}
            </div>
          )}

          {!sapResult && legalizacion.sapDocEntry && (
            <div className="p-3.5 rounded-2xl text-xs flex items-center justify-between border bg-emerald-50 text-emerald-800 border-emerald-200">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Legalización registrada en SAP Business One
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-200 text-emerald-900 font-mono font-bold text-[10px]">
                DocEntry: #{legalizacion.sapDocEntry}
              </span>
            </div>
          )}

          {/* Metadata Cards (2 columns without general Centro de Costos) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Solicitante</span>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                  {legalizacion.usuarioNombre?.charAt(0) || 'U'}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{legalizacion.usuarioNombre}</p>
                  <p className="text-[11px] text-slate-500">{legalizacion.usuarioEmail}</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Balance de Liquidación</span>
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Anticipo:</span>
                  <span className="font-mono font-medium text-slate-800">{formatCOP(legalizacion.anticipoRecibido)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Gastos:</span>
                  <span className="font-mono font-bold text-blue-900">{formatCOP(legalizacion.totalGastos)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">Saldo Neto:</span>
                  <span className={`font-mono font-bold ${legalizacion.saldoDiferencia >= 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                    {formatCOP(legalizacion.saldoDiferencia)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" /> Comprobantes y Líneas ({legalizacion.lineas?.length || 0})
            </h3>
            <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">Fecha</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Tipo / Factura</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">NIT Proveedor</th>
                    <th className="py-2.5 px-3 min-w-[220px]">Centro de Costos</th>
                    <th className="py-2.5 px-3 min-w-[300px]">Cuenta Contable</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Valor Total</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Soporte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {legalizacion.lineas?.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{l.fecha}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-800">{l.tipoDocumento || 'Factura'}</span>
                        {l.facturaNumero && <p className="text-[10px] text-slate-500 font-mono">{l.facturaNumero}</p>}
                        {l.incluyeTransporte === 'SI' && (
                          <div className="mt-1 text-[10px] text-blue-700 bg-blue-50/80 p-1.5 rounded-lg border border-blue-200 space-y-0.5">
                            <p className="font-bold">🚗 Transporte: {l.medioTransporte || 'No especificado'}</p>
                            <p className="text-slate-600">
                              {l.origen || '-'} ➔ {l.destino || '-'} ({l.numeroPasajeros || 1} pas.) {l.esIdaVuelta ? '• Ida y vuelta' : ''}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900">{l.proveedorNit || '-'}</span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700 min-w-[220px]">
                        {legalizacion.estado === 'pendiente' ? (() => {
                          const rawVal = editableLineas.find(el => el.id === l.id)?.concepto || l.concepto || legalizacion.centroCosto || '';
                          const currentVal = getMatchedCentroValue(rawVal);
                          return (
                            <select
                              value={currentVal}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditableLineas(prev => prev.map(line => line.id === l.id ? { ...line, concepto: val } : line));
                              }}
                              title={currentVal || 'Centro de Costo'}
                              className="w-full min-w-[200px] text-xs py-1.5 px-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none shadow-xs font-medium"
                            >
                              <option value="">-- Seleccione Centro de Costo --</option>
                              {centros.map(c => {
                                const full = `${c.codigo} - ${c.Título}`;
                                return (
                                  <option key={c.codigo} value={full} title={full}>
                                    {full}
                                  </option>
                                );
                              })}
                              {currentVal && !centros.some(c => `${c.codigo} - ${c.Título}` === currentVal || c.codigo === currentVal) && (
                                <option value={currentVal} title={currentVal}>{currentVal}</option>
                              )}
                            </select>
                          );
                        })() : (
                          editableLineas.find(el => el.id === l.id)?.concepto || l.concepto || legalizacion.centroCosto
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-blue-900 font-mono font-medium min-w-[300px]">
                        {legalizacion.estado === 'pendiente' ? (() => {
                          const currentCuentaId = getMatchedCuentaId(l.id, l.cuentaId, l.cuentaTitulo);
                          const activeCuenta = cuentas.find(c => String(c.id) === currentCuentaId);
                          return (
                            <select
                              value={currentCuentaId}
                              onChange={(e) => {
                                const val = e.target.value;
                                const acc = cuentas.find(c => String(c.id) === val);
                                setEditableLineas(prev => prev.map(line => line.id === l.id ? { ...line, cuentaId: val ? Number(val) : null, cuentaTitulo: acc ? `${acc.Título} - ${acc.categoria}` : '' } : line));
                              }}
                              title={activeCuenta ? `${activeCuenta.Título} (${activeCuenta.categoria})` : 'Cuenta Contable'}
                              className="w-full min-w-[280px] text-xs py-1.5 px-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none shadow-xs font-mono font-normal"
                            >
                              <option value="">-- Seleccione Cuenta Contable --</option>
                              {cuentas.map(c => (
                                <option key={c.id} value={c.id} title={`${c.Título} (${c.categoria})`}>
                                  {c.Título} ({c.categoria})
                                </option>
                              ))}
                            </select>
                          );
                        })() : (
                          editableLineas.find(el => el.id === l.id)?.cuentaTitulo || l.cuentaTitulo || 'Cuenta asociada'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {l.moneda === 'USD' ? (
                          <span className="text-amber-900 font-bold">
                            ${Number(l.valorTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded">USD</span>
                          </span>
                        ) : (
                          formatCOP(l.valorTotal)
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {(() => {
                          const lista = l.soportes && l.soportes.length > 0
                            ? l.soportes
                            : l.soporteUrl ? [{ name: 'Ver Soporte', url: l.soporteUrl }] : [];
                          if (lista.length === 0) return <span className="text-slate-400 text-[10px]">Sin archivo</span>;
                          return (
                            <div className="flex flex-col gap-0.5 items-center">
                              {lista.map((s, i) => (
                                <a
                                  key={i}
                                  href={s.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline font-semibold text-[11px]"
                                >
                                  {lista.length > 1 ? `Soporte ${i + 1}` : 'Ver Soporte'}
                                </a>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Observations and Approval Buttons */}
          {legalizacion.estado === 'pendiente' ? (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
                <label className="block font-bold text-amber-900 text-xs">
                  Observaciones de Aprobación / Rechazo (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Indique cualquier comentario..."
                  className="w-full p-2.5 bg-white border border-amber-200 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleAction('rechazado')}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-semibold shadow-2xs transition-all flex items-center gap-1.5 text-xs cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Rechazar</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowReasignarModal(true)}
                  className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl font-semibold shadow-2xs transition-all flex items-center gap-1.5 text-xs cursor-pointer disabled:opacity-50"
                >
                  <UserCheck className="w-4 h-4 text-amber-700" />
                  <span>Reasignar Aprobación</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleAction('aprobado')}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 text-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Aprobando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Aprobar Legalización</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="text-slate-600 font-medium">Estado actual de la legalización:</span>
              <div>{getStatusBadge(legalizacion.estado)}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500">
          Firplak S.A.S &bull; Departamento de Contabilidad y Finanzas
        </div>
      </div>

      {/* Modal Reasignar Aprobación */}
      {showReasignarModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Reasignar Aprobación</h3>
                  <p className="text-[11px] text-blue-100">Transfiere la revisión a otro funcionario</p>
                </div>
              </div>
              <button
                onClick={() => setShowReasignarModal(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1 text-slate-700">
                <p>Legalización: <strong className="font-mono text-blue-900">{legalizacion.codigo}</strong></p>
                <p>Solicitante: <strong className="text-slate-900">{legalizacion.usuarioNombre}</strong></p>
                <p>Total a Aprobar: <strong className="text-emerald-700 font-mono">{formatCOP(legalizacion.totalGastos)}</strong></p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nuevo Usuario Aprobador *
                </label>
                <SearchableSelect
                  required
                  placeholder="-- Seleccione o busque el nuevo aprobador --"
                  searchPlaceholder="Buscar por nombre o correo..."
                  value={selectedNewApproverEmail}
                  onChange={(val) => setSelectedNewApproverEmail(val)}
                  options={orgUsers.map((u) => ({
                    value: u.email,
                    label: `${u.nombre} - ${u.email}`,
                    sublabel: u.area || 'Firplak',
                  }))}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Motivo o Justificación de la Reasignación (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={motivoReasignacion}
                  onChange={(e) => setMotivoReasignacion(e.target.value)}
                  placeholder="Ej. Por ausencia o delegación de funciones del responsable de área..."
                  className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isReassigning}
                  onClick={() => setShowReasignarModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isReassigning || !selectedNewApproverEmail}
                  onClick={handleReasignar}
                  className={`px-5 py-2 font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 ${
                    isReassigning || !selectedNewApproverEmail
                      ? 'bg-slate-300 cursor-not-allowed shadow-none'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 cursor-pointer'
                  }`}
                >
                  {isReassigning ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Reasignando...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      <span>Confirmar Reasignación</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
