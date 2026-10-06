'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Calculator,
  Plus,
  Trash2,
  Database,
  Send,
  UserCheck,
  Paperclip,
  ExternalLink,
  Receipt,
  ChevronDown,
  User,
  Mail,
  Save,
  FolderOpen,
  Clock,
  AlertCircle,
  FileText,
  RotateCcw,
  X,
  Search,
  Calendar,
  UploadCloud,
  Camera,
} from 'lucide-react';
import {
  fetchCuentasFromSupabase,
  fetchProveedoresFromSupabase,
  fetchCentrosCostoFromSupabase,
  fetchOrganizationUsers,
  OrganizationUser,
  saveLocalLegalizacionGasto,
  saveLegalizacionGastoToSupabase,
  fetchLegalizacionGastoById,
  fetchBorradoresGastosByUser,
  deleteLegalizacionGasto,
  supabase
} from '@/lib/supabase';
import { CuentaContable, Proveedor, LineaGasto, Legalizacion, CentroCosto } from '@/types/legalizaciones';
import { SearchableSelect } from '@/components/SearchableSelect';

export default function FormularioGastosPublicoPage() {
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [centros, setCentros] = useState<CentroCosto[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrganizationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [lastCodigo, setLastCodigo] = useState('');
  const [showAvisoBancario, setShowAvisoBancario] = useState(true);

  // Draft management states
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [currentDraftCodigo, setCurrentDraftCodigo] = useState<string>('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [unloadedDraftDetected, setUnloadedDraftDetected] = useState<Legalizacion | null>(null);

  // "Mis Borradores" modal state
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [draftSearchEmail, setDraftSearchEmail] = useState('');
  const [userDraftsList, setUserDraftsList] = useState<Legalizacion[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);

  // Form states
  const [usuarioNombre, setUsuarioNombre] = useState('');
  const [usuarioEmail, setUsuarioEmail] = useState('');
  const [aprobadorNombre, setAprobadorNombre] = useState('');
  const [aprobadorEmail, setAprobadorEmail] = useState('');
  const [centroCosto, setCentroCosto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [recibioAnticipo, setRecibioAnticipo] = useState<'no' | 'si'>('no');
  const [anticipoRecibido, setAnticipoRecibido] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      moneda: 'COP',
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

  const handleLoadDraft = (draft: Legalizacion) => {
    setCurrentDraftId(draft.id);
    setCurrentDraftCodigo(draft.codigo || '');
    setUsuarioNombre(draft.usuarioNombre || '');
    setUsuarioEmail(draft.usuarioEmail || '');
    setAprobadorNombre(draft.aprobadorNombre || '');
    setAprobadorEmail(draft.aprobadorEmail || '');
    setCentroCosto(draft.centroCosto || '');
    setMotivo(draft.motivo || '');
    setFecha(draft.fecha || new Date().toISOString().split('T')[0]);
    setRecibioAnticipo((draft.anticipoRecibido || 0) > 0 ? 'si' : 'no');
    setAnticipoRecibido(draft.anticipoRecibido || 0);

    if (draft.lineas && draft.lineas.length > 0) {
      setLineas(draft.lineas);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('formulario_gastos_active_draft_id', draft.id);
      const url = new URL(window.location.href);
      url.searchParams.set('borrador', draft.id);
      window.history.replaceState({}, '', url.toString());
    }

    setUnloadedDraftDetected(null);
    setShowDraftsModal(false);
    setDraftNotice(`✓ Borrador ${draft.codigo || ''} cargado exitosamente.`);
    setTimeout(() => setDraftNotice(null), 5000);
  };

  const checkDraftsForUser = async (email: string, nombre?: string) => {
    if (!email) return;
    const cleanEmail = email.trim().toLowerCase();

    // If already editing a draft, do not prompt
    if (currentDraftId) return;

    try {
      // 1. Check user-specific localStorage first
      const localDraftId = typeof window !== 'undefined'
        ? (localStorage.getItem(`formulario_gastos_draft_${cleanEmail}`) || localStorage.getItem('formulario_gastos_active_draft_id'))
        : null;

      if (localDraftId) {
        const found = await fetchLegalizacionGastoById(localDraftId);
        if (found && found.estado === 'borrador' && (found.usuarioEmail || '').trim().toLowerCase() === cleanEmail) {
          setUnloadedDraftDetected(found);
          return;
        }
      }

      // 2. Check Supabase for active drafts belonging specifically to this user
      const userDrafts = await fetchBorradoresGastosByUser(cleanEmail);
      if (userDrafts && userDrafts.length > 0) {
        setUnloadedDraftDetected(userDrafts[0]);
      } else {
        setUnloadedDraftDetected(null);
      }
    } catch (err) {
      console.error('Error verificando borradores del usuario:', err);
    }
  };

  // Only check URL params on mount (?borrador=... or ?id=...)
  useEffect(() => {
    async function checkForUrlDraft() {
      if (typeof window === 'undefined') return;

      const params = new URLSearchParams(window.location.search);
      const urlDraftId = params.get('borrador') || params.get('id');

      if (urlDraftId) {
        const found = await fetchLegalizacionGastoById(urlDraftId);
        if (found && found.estado === 'borrador') {
          handleLoadDraft(found);
        }
      }
    }

    checkForUrlDraft();
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
      moneda: 'COP',
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

  const handleUploadSoporte = async (lineaId: string, file: File) => {
    handleUpdateLinea(lineaId, 'soporteFile', file);
    handleUpdateLinea(lineaId, 'soporteUrl', 'uploading');

    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `comprobantes/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('soportes')
        .upload(filePath, file);

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('soportes')
          .getPublicUrl(filePath);
        handleUpdateLinea(lineaId, 'soporteUrl', urlData.publicUrl);
      } else {
        console.error('Error uploading file:', uploadError);
        handleUpdateLinea(lineaId, 'soporteUrl', '');
        alert('Error al subir el archivo: ' + uploadError.message);
      }
    } catch (err: any) {
      console.error('Error de red al subir:', err);
      handleUpdateLinea(lineaId, 'soporteUrl', '');
      alert('Error de red al subir el archivo.');
    }
  };

  const totalGastos = lineas.reduce((acc, l) => acc + (l.valorTotal || 0), 0);
  const saldoDiferencia = totalGastos - anticipoRecibido;

  const handleGuardarBorrador = async () => {
    if (isSavingDraft) return;

    if (!usuarioNombre.trim() && !usuarioEmail.trim()) {
      alert('Por favor ingresa al menos tu Nombre o Correo electrónico para poder guardar tu borrador y recuperarlo después.');
      return;
    }

    setIsSavingDraft(true);
    try {
      const draftId = currentDraftId || `leg-gst-draft-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const draftCodigo = currentDraftCodigo || `BORR-${Math.floor(1000 + Math.random() * 9000)}`;

      const cleanLineas = lineas.map(({ soporteFile, soporteFiles, ...rest }: any) => rest);

      const draftGasto: Legalizacion = {
        id: draftId,
        codigo: draftCodigo,
        fecha,
        usuarioNombre: usuarioNombre.trim() || 'Borrador sin nombre',
        usuarioEmail: usuarioEmail.trim() || '',
        aprobadorNombre: aprobadorNombre.trim() || '',
        aprobadorEmail: aprobadorEmail.trim() || '',
        centroCosto: centroCosto || 'General',
        motivo: motivo.trim() || 'Borrador en preparación',
        estado: 'borrador',
        anticipoRecibido,
        totalGastos,
        saldoDiferencia,
        lineas: cleanLineas,
        gestionContable: 'Por procesar',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await saveLegalizacionGastoToSupabase(draftGasto);

      setCurrentDraftId(draftId);
      setCurrentDraftCodigo(draftCodigo);

      if (typeof window !== 'undefined') {
        const cleanEmail = usuarioEmail.trim().toLowerCase();
        localStorage.setItem(`formulario_gastos_draft_${cleanEmail}`, draftId);
        localStorage.removeItem('formulario_gastos_active_draft_id');
        const url = new URL(window.location.href);
        url.searchParams.set('borrador', draftId);
        window.history.replaceState({}, '', url.toString());
      }

      setUnloadedDraftDetected(null);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setDraftNotice(`✓ Borrador ${draftCodigo} guardado en la nube (${timeStr}). Puedes continuar luego.`);
      setTimeout(() => setDraftNotice(null), 6000);
    } catch (err) {
      console.error('Error guardando borrador:', err);
      alert('Ocurrió un error al guardar el borrador en la nube.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleDiscardDraft = () => {
    if (confirm('¿Deseas descartar este borrador y empezar un formulario en blanco?')) {
      if (typeof window !== 'undefined') {
        if (usuarioEmail) {
          localStorage.removeItem(`formulario_gastos_draft_${usuarioEmail.trim().toLowerCase()}`);
        }
        localStorage.removeItem('formulario_gastos_active_draft_id');
        const url = new URL(window.location.href);
        url.searchParams.delete('borrador');
        url.searchParams.delete('id');
        window.history.replaceState({}, '', url.pathname);
      }
      setCurrentDraftId(null);
      setCurrentDraftCodigo('');
      setUnloadedDraftDetected(null);
      handleResetForm();
    }
  };

  const handleOpenDraftsModal = async () => {
    setShowDraftsModal(true);
    const emailToSearch = usuarioEmail.trim() || draftSearchEmail.trim();
    if (emailToSearch) {
      setDraftSearchEmail(emailToSearch);
      setIsLoadingDrafts(true);
      try {
        const drafts = await fetchBorradoresGastosByUser(emailToSearch);
        setUserDraftsList(drafts);
      } finally {
        setIsLoadingDrafts(false);
      }
    }
  };

  const handleSearchUserDrafts = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!draftSearchEmail.trim()) {
      alert('Por favor ingresa un correo para buscar borradores.');
      return;
    }
    setIsLoadingDrafts(true);
    try {
      const drafts = await fetchBorradoresGastosByUser(draftSearchEmail.trim());
      setUserDraftsList(drafts);
    } finally {
      setIsLoadingDrafts(false);
    }
  };

  const handleDeleteUserDraft = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de eliminar este borrador permanentemente?')) return;
    setDeletingDraftId(id);
    try {
      await deleteLegalizacionGasto(id);
      setUserDraftsList((prev) => prev.filter((d) => d.id !== id));
      if (currentDraftId === id) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('formulario_gastos_active_draft_id');
          const url = new URL(window.location.href);
          url.searchParams.delete('borrador');
          url.searchParams.delete('id');
          window.history.replaceState({}, '', url.pathname);
        }
        setCurrentDraftId(null);
        setCurrentDraftCodigo('');
      }
    } finally {
      setDeletingDraftId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!usuarioNombre.trim()) {
      alert('Por favor ingrese o seleccione su nombre.');
      return;
    }
    if (!usuarioEmail.trim()) {
      alert('Por favor ingrese su correo electrónico.');
      return;
    }
    if (!aprobadorEmail.trim()) {
      alert('Por favor seleccione o ingrese el correo electrónico del aprobador.');
      return;
    }
    if (!motivo.trim()) {
      alert('Por favor ingrese el motivo del gasto.');
      return;
    }

    const lineasSinSoporte = lineas.some(
      (l) => (!l.soporteUrls || l.soporteUrls.length === 0) && (!l.soportes || l.soportes.length === 0) && (!l.soporteUrl || l.soporteUrl.trim() === '')
    );
    if (lineasSinSoporte) {
      alert('Los soportes/facturas son obligatorios. Por favor adjunta el comprobante en cada línea de gasto.');
      return;
    }

    setIsSubmitting(true);

    try {
      const cleanLineas = lineas.map(({ soporteFile, soporteFiles, ...rest }: any) => rest);
      let assignedCodigo = `LEG-${Math.floor(100 + Math.random() * 900)}`;
      try {
        const numRes = await fetch('/api/sap/next-number');
        if (numRes.ok) {
          const numData = await numRes.json();
          if (numData.codigo) {
            assignedCodigo = numData.codigo;
          }
        }
      } catch {
        // fallback
      }

      const finalId = currentDraftId || `leg-gst-${Date.now()}`;

      const nuevaLeg: Legalizacion = {
        id: finalId,
        codigo: assignedCodigo,
        fecha,
        usuarioNombre,
        usuarioEmail,
        aprobadorNombre: aprobadorNombre || '',
        aprobadorEmail: aprobadorEmail.trim(),
        centroCosto: centroCosto || 'General',
        motivo,
        estado: 'pendiente',
        anticipoRecibido,
        totalGastos,
        saldoDiferencia,
        lineas: cleanLineas,
        gestionContable: 'Por procesar',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Save to Supabase and local storage
      await saveLegalizacionGastoToSupabase(nuevaLeg);

      // Clear active draft from local storage & URL
      if (typeof window !== 'undefined') {
        if (usuarioEmail) {
          localStorage.removeItem(`formulario_gastos_draft_${usuarioEmail.trim().toLowerCase()}`);
        }
        localStorage.removeItem('formulario_gastos_active_draft_id');
        const url = new URL(window.location.href);
        url.searchParams.delete('borrador');
        url.searchParams.delete('id');
        window.history.replaceState({}, '', url.pathname);
      }
      setCurrentDraftId(null);
      setCurrentDraftCodigo('');

      // Trigger Power Automate Flow for approval notification
      try {
        const link = `${window.location.origin}/formulario-gastos/${nuevaLeg.id}`;
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            correo: aprobadorEmail.trim() || usuarioEmail,
            titulo: `Aprobación de Legalización de Gastos - ${assignedCodigo}`,
            contenido: `Tienes esta legalización de gastos pendiente por aprobar de ${usuarioNombre} por valor de ${formatCOP(totalGastos)}.`,
            link: link,
          }),
        });
      } catch (flowErr) {
        console.error('Error enviando notificación al proxy:', flowErr);
      }

      setLastCodigo(assignedCodigo);
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmitted(false);
    setLastCodigo('');
    setCurrentDraftId(null);
    setCurrentDraftCodigo('');
    setUnloadedDraftDetected(null);
    setDraftNotice(null);
    setMotivo('');
    setUsuarioNombre('');
    setUsuarioEmail('');
    setAprobadorNombre('');
    setAprobadorEmail('');
    setCentroCosto('');
    setRecibioAnticipo('no');
    setAnticipoRecibido(0);
    setSolicitanteSearch('');
    setAprobadorSearch('');
    setFecha(new Date().toISOString().split('T')[0]);
    setLineas([
      {
        id: `lin-gst-${Date.now()}`,
        fecha: new Date().toISOString().split('T')[0],
        concepto: '',
        cuentaId: null,
        cuentaTitulo: '',
        proveedorNombre: '',
        proveedorNit: '',
        tipoDocumento: 'Factura',
        facturaNumero: '',
        moneda: 'COP',
        valorSubtotal: 0,
        valorIva: 0,
        valorTotal: 0,
        soporteFile: undefined,
        soporteUrl: '',
      },
    ]);
    if (typeof window !== 'undefined') {
      if (usuarioEmail) {
        localStorage.removeItem(`formulario_gastos_draft_${usuarioEmail.trim().toLowerCase()}`);
      }
      localStorage.removeItem('formulario_gastos_active_draft_id');
      const url = new URL(window.location.href);
      url.searchParams.delete('borrador');
      url.searchParams.delete('id');
      window.history.replaceState({}, '', url.pathname);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
            Crear otro formulario / Radicar otra legalización
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

          <button
            type="button"
            onClick={handleOpenDraftsModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-2xl text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95"
            title="Ver y cargar borradores guardados"
          >
            <FolderOpen className="w-4 h-4 text-blue-400" />
            <span>Mis Borradores</span>
          </button>
        </div>

        {/* Notice Toast */}
        {draftNotice && (
          <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 px-4 py-3 rounded-2xl flex items-center gap-2.5 text-xs shadow-lg animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{draftNotice}</span>
          </div>
        )}

        {/* Unloaded Draft Detected Banner */}
        {unloadedDraftDetected && !currentDraftId && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 text-xs shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-amber-100">Borrador anterior detectado</p>
                <p className="text-[11px] text-amber-300/80">
                  Hola <strong className="text-white">{unloadedDraftDetected.usuarioNombre}</strong>, tienes un borrador pendiente ({unloadedDraftDetected.codigo}) por {formatCOP(unloadedDraftDetected.totalGastos)}.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => handleLoadDraft(unloadedDraftDetected)}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs active:scale-95"
              >
                Cargar Borrador
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    if (unloadedDraftDetected.usuarioEmail) {
                      localStorage.removeItem(`formulario_gastos_draft_${unloadedDraftDetected.usuarioEmail.trim().toLowerCase()}`);
                    }
                    localStorage.removeItem('formulario_gastos_active_draft_id');
                  }
                  setUnloadedDraftDetected(null);
                }}
                className="px-3 py-2 text-amber-300 hover:text-white text-xs cursor-pointer font-medium"
              >
                Descartar
              </button>
            </div>
          </div>
        )}

        {/* Active Draft Banner */}
        {currentDraftId && (
          <div className="bg-blue-600/15 border border-blue-500/30 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white">Editando Borrador:</span>
                  <span className="font-mono bg-blue-500/30 text-blue-200 px-2.5 py-0.5 rounded-lg font-bold text-xs border border-blue-400/30">
                    {currentDraftCodigo}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                    Estado: Borrador (No radicado)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Tus cambios quedan guardados como borrador. Cuando todo esté listo, haz clic en "Radicar y Enviar Definitivo".
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={handleGuardarBorrador}
                disabled={isSavingDraft}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
              >
                {isSavingDraft ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Guardar Cambios</span>
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="flex items-center gap-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-colors cursor-pointer border border-slate-700"
                title="Descartar borrador y comenzar en blanco"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Nuevo</span>
              </button>
            </div>
          </div>
        )}

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
                                setUsuarioEmail(user.email);
                                if (user.area && user.area !== 'General') setCentroCosto(user.area);
                                setShowSolicitanteDropdown(false);
                                checkDraftsForUser(user.email, user.nombre);
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
                    {usuarioEmail && (
                      <p className="text-[10px] text-slate-500 mt-1 truncate">
                        Solicitante: <span className="font-semibold text-slate-700">{usuarioEmail}</span>
                      </p>
                    )}
                  </div>

                  {/* Searchable Aprobador Field */}
                  <div className="relative" ref={aprobadorRef}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-slate-600">
                        Correo Electrónico Aprobador *
                      </label>
                      {aprobadorNombre && (
                        <span className="text-[10px] text-blue-600 font-bold truncate max-w-[160px]" title={aprobadorNombre}>
                          ✓ {aprobadorNombre}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={showAprobadorDropdown ? aprobadorSearch : (aprobadorEmail ? `${aprobadorEmail}${aprobadorNombre ? ` (${aprobadorNombre})` : ''}` : '')}
                        onFocus={() => {
                          setAprobadorSearch('');
                          setShowAprobadorDropdown(true);
                        }}
                        onClick={() => {
                          setShowAprobadorDropdown(true);
                        }}
                        onChange={(e) => {
                          setAprobadorSearch(e.target.value);
                          setAprobadorEmail(e.target.value);
                          const matchUser = orgUsers.find(
                            (u) => u.email.toLowerCase() === e.target.value.trim().toLowerCase()
                          );
                          if (matchUser) {
                            setAprobadorNombre(matchUser.nombre);
                          }
                          setShowAprobadorDropdown(true);
                        }}
                        placeholder="Buscar o escribir aprobador..."
                        className="w-full p-2.5 pr-14 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-medium text-xs"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {(aprobadorEmail || aprobadorSearch) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAprobadorEmail('');
                              setAprobadorNombre('');
                              setAprobadorSearch('');
                              setShowAprobadorDropdown(true);
                            }}
                            className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                            title="Limpiar y cambiar aprobador"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextState = !showAprobadorDropdown;
                            setShowAprobadorDropdown(nextState);
                            if (nextState) {
                              setAprobadorSearch('');
                            }
                          }}
                          className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                          title="Desplegar lista de aprobadores"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${showAprobadorDropdown ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {showAprobadorDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
                        <div className="p-2 bg-slate-50 text-[10px] text-slate-500 font-semibold sticky top-0 border-b border-slate-100 flex items-center justify-between">
                          <span>Directorio de Aprobadores (M365)</span>
                          <span>
                            {orgUsers.filter((u) => {
                              if (!aprobadorSearch.trim()) return true;
                              const term = aprobadorSearch.toLowerCase();
                              return u.nombre.toLowerCase().includes(term) || u.email.toLowerCase().includes(term) || (u.area || '').toLowerCase().includes(term);
                            }).length} usuarios
                          </span>
                        </div>
                        {orgUsers
                          .filter((u) => {
                            if (!aprobadorSearch.trim()) return true;
                            const term = aprobadorSearch.toLowerCase();
                            return u.nombre.toLowerCase().includes(term) || u.email.toLowerCase().includes(term) || (u.area || '').toLowerCase().includes(term);
                          })
                          .map((user) => (
                            <div
                              key={user.email}
                              onClick={() => {
                                setAprobadorEmail(user.email);
                                setAprobadorNombre(user.nombre);
                                setAprobadorSearch('');
                                setShowAprobadorDropdown(false);
                              }}
                              className={`p-2.5 hover:bg-blue-50 cursor-pointer transition-colors flex items-center gap-2.5 text-left ${
                                aprobadorEmail.toLowerCase() === user.email.toLowerCase() ? 'bg-blue-50/80 border-l-4 border-blue-600' : ''
                              }`}
                            >
                              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                                {user.nombre.charAt(0)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <p className="font-semibold text-slate-900 truncate text-xs">{user.nombre}</p>
                                  {aprobadorEmail.toLowerCase() === user.email.toLowerCase() && (
                                    <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.2 rounded-full">Seleccionado</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 truncate">{user.email} {user.area ? `• ${user.area}` : ''}</p>
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
                          <SearchableSelect
                            required
                            placeholder="-- Seleccione Centro de Costo --"
                            searchPlaceholder="Buscar centro de costo..."
                            value={linea.concepto}
                            onChange={(val) => {
                              handleUpdateLinea(linea.id, 'concepto', val);
                              handleUpdateLinea(linea.id, 'cuentaId', null);
                            }}
                            options={centros.map((c) => ({
                              value: `${c.codigo} - ${c.Título}`,
                              label: `${c.codigo} - ${c.Título}`,
                              sublabel: c.Título,
                            }))}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Tipo de Moneda *</label>
                          <select
                            value={linea.moneda || 'COP'}
                            onChange={(e) => handleUpdateLinea(linea.id, 'moneda', e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:border-blue-600 text-xs"
                          >
                            <option value="COP">Pesos Colombianos (COP)</option>
                            <option value="USD">USD (Dólares)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Cuenta Contable (Supabase) *</label>
                          <SearchableSelect
                            placeholder="-- Seleccione Cuenta Contable --"
                            searchPlaceholder="Buscar código o nombre de cuenta..."
                            value={linea.cuentaId ? String(linea.cuentaId) : ''}
                            onChange={(val) => handleUpdateLinea(linea.id, 'cuentaId', val ? Number(val) : '')}
                            options={cuentas
                              .filter((c) => {
                                if (!linea.concepto) return true;
                                const cc = linea.concepto.toUpperCase();
                                if (cc.startsWith('GA')) return c.Título.startsWith('51');
                                if (cc.startsWith('GV')) return c.Título.startsWith('52');
                                if (cc.startsWith('IP')) return c.Título.startsWith('73');
                                if (cc.startsWith('MO')) return c.Título.startsWith('72');
                                return true;
                              })
                              .map((c) => ({
                                value: String(c.id),
                                label: `${c.Título} (${c.categoria})`,
                                sublabel: c.categoria,
                              }))}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Valor del Gasto ({linea.moneda === 'USD' ? 'USD $' : '$ COP'}) *
                          </label>
                          <input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={linea.valorSubtotal || ''}
                            onChange={(e) => handleUpdateLinea(linea.id, 'valorSubtotal', e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono font-bold text-xs"
                            required
                          />
                        </div>
                      </div>

                      {/* File Upload Row */}
                      <div className="mt-2 border-t border-slate-200/70 pt-2.5">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                            <span>Adjuntar Soporte ({linea.tipoDocumento || 'Factura'})</span>
                            <span className="text-rose-600 font-bold">* Obligatorio</span>
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

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Adjuntar Archivo */}
                          <label
                            htmlFor={`file-upload-gastos-${linea.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                          >
                            <UploadCloud className="w-4 h-4 text-blue-600" />
                            <span>
                              {linea.soporteUrl && linea.soporteUrl !== 'uploading'
                                ? 'Cambiar archivo'
                                : 'Adjuntar archivo...'}
                            </span>
                          </label>
                          <input
                            id={`file-upload-gastos-${linea.id}`}
                            type="file"
                            accept=".pdf,image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadSoporte(linea.id, file);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />

                          {/* Tomar Foto */}
                          <label
                            htmlFor={`camera-upload-gastos-${linea.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                          >
                            <Camera className="w-4 h-4 text-emerald-600" />
                            <span>Tomar foto</span>
                          </label>
                          <input
                            id={`camera-upload-gastos-${linea.id}`}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadSoporte(linea.id, file);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />

                          <span className="text-[10px] text-slate-400">
                            Puedes adjuntar PDF/imagen o capturar foto con la cámara
                          </span>
                        </div>

                        {linea.soporteUrl === 'uploading' && (
                          <div className="mt-2 flex items-center gap-1.5 text-blue-700 font-bold text-[10px]">
                            <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <span>Subiendo documento a Supabase Storage...</span>
                          </div>
                        )}
                        {linea.soporteUrl && linea.soporteUrl !== 'uploading' && (
                          <div className="mt-2 flex items-center gap-1.5 text-emerald-700 font-bold text-[10px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>✓ Documento guardado correctamente</span>
                          </div>
                        )}
                        {!linea.soporteUrl && (
                          <p className="mt-1.5 text-[10px] text-rose-600 font-medium">
                            * Se debe adjuntar o tomar foto del soporte obligatoriamente.
                          </p>
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

              {/* Submit & Save Draft Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleGuardarBorrador}
                  disabled={isSavingDraft || isSubmitting}
                  className={`w-full sm:w-auto sm:px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm ${
                    isSavingDraft ? 'opacity-60 cursor-not-allowed' : 'active:scale-[0.99] cursor-pointer'
                  }`}
                >
                  {isSavingDraft ? (
                    <>
                      <span className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></span>
                      <span>Guardando Borrador...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-blue-600" />
                      <span>{currentDraftId ? 'Guardar Cambios de Borrador' : 'Guardar Borrador'}</span>
                    </>
                  )}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || isSavingDraft}
                  className={`flex-1 w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-600/25 transition-all flex items-center justify-center gap-2 ${
                    isSubmitting ? 'opacity-60 cursor-not-allowed' : 'active:scale-[0.99] cursor-pointer'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Enviando Legalización Definitiva...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Radicar y Enviar Definitivo</span>
                    </>
                  )}
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

      {/* Modal: Mis Borradores Guardados */}
      {showDraftsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white text-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Mis Borradores Guardados</h3>
                  <p className="text-[11px] text-slate-500">Recupera cualquier borrador previo para continuar editándolo o enviarlo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDraftsModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search by Email */}
            <form onSubmit={handleSearchUserDrafts} className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={draftSearchEmail}
                  onChange={(e) => setDraftSearchEmail(e.target.value)}
                  placeholder="Ingresa tu correo institucional..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <button
                type="submit"
                disabled={isLoadingDrafts}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isLoadingDrafts ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Buscar</span>
              </button>
            </form>

            {/* Drafts List */}
            <div className="flex-1 overflow-y-auto space-y-3 min-h-[160px] max-h-[360px] pr-1">
              {isLoadingDrafts ? (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Buscando borradores guardados...</span>
                </div>
              ) : userDraftsList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl space-y-1">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-600">No se encontraron borradores</p>
                  <p className="text-[11px] text-slate-400">
                    {draftSearchEmail
                      ? `No hay borradores guardados para "${draftSearchEmail}".`
                      : 'Escribe tu correo arriba para consultar los borradores que has guardado.'}
                  </p>
                </div>
              ) : (
                userDraftsList.map((draft) => (
                  <div
                    key={draft.id}
                    className="p-3.5 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-900 text-xs bg-blue-100/70 px-2 py-0.5 rounded-md">
                          {draft.codigo}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {draft.updated_at ? new Date(draft.updated_at).toLocaleDateString() : draft.fecha}
                        </span>
                      </div>
                      <p className="font-semibold text-xs text-slate-800 truncate">
                        {draft.motivo || 'Sin motivo'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Líneas: <span className="font-bold text-slate-700">{draft.lineas?.length || 0}</span> | Total: <span className="font-bold text-slate-900">{formatCOP(draft.totalGastos)}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleLoadDraft(draft)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        Cargar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteUserDraft(draft.id, e)}
                        disabled={deletingDraftId === draft.id}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Eliminar borrador"
                      >
                        {deletingDraftId === draft.id ? (
                          <span className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin block"></span>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDraftsModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aviso Importante Certificación Bancaria */}
      {showAvisoBancario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[#f3f5f8] border border-slate-200 rounded-3xl p-6 sm:p-10 max-w-md w-full shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl sm:text-3xl font-black text-red-600 tracking-tight">
              ¡Importante!
            </h2>

            <p className="text-slate-800 text-sm sm:text-base leading-relaxed font-normal px-1">
              Si es primer vez que solicita reembolso de gastos, por favor enviar certificación bancaria al correo:
            </p>

            <div>
              <a
                href="mailto:coordinacionfinanciera@firplak.com"
                className="text-[#2eb85c] hover:text-[#259b4c] font-semibold text-base sm:text-lg break-all transition-colors inline-block"
              >
                coordinacionfinanciera@firplak.com
              </a>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAvisoBancario(false)}
                className="px-10 py-2.5 bg-[#3b66b2] hover:bg-[#2f5394] active:scale-95 text-white font-bold text-sm sm:text-base rounded-xl shadow-md transition-all cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

