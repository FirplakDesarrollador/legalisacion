'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  CreditCard,
  Receipt,
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  User,
  ArrowRight,
  Calendar,
  Building,
  DollarSign,
  ChevronRight,
  UserCheck,
  Check
} from 'lucide-react';
import { supabase, fetchOrganizationUsers, OrganizationUser } from '@/lib/supabase';
import { SearchableSelect } from '@/components/SearchableSelect';

interface ApprovalItem {
  id: string;
  codigo: string;
  tipo: 'Tarjeta de Crédito' | 'Gastos' | 'Caja Menor';
  tipoKey: 'tarjeta' | 'gastos' | 'caja_menor';
  solicitante: string;
  solicitanteEmail: string;
  fecha: string;
  total: number;
  estado: string;
  centroCosto?: string;
  motivo?: string;
  url: string;
  created_at?: string;
  sapDocEntry?: string | number;
}

function ApprovalsDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlEmail = searchParams.get('email') || '';
  const [currentApproverEmail, setCurrentApproverEmail] = useState<string>('');
  const [orgUsers, setOrgUsers] = useState<OrganizationUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [items, setItems] = useState<ApprovalItem[]>([]);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'pendientes' | 'historico'>('pendientes');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'todos' | 'tarjeta' | 'gastos' | 'caja_menor'>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showUserSwitcher, setShowUserSwitcher] = useState<boolean>(false);

  // Initialize approver email
  useEffect(() => {
    let emailToUse = urlEmail.trim().toLowerCase();

    if (!emailToUse && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('legalisa_approver_email');
        if (saved) emailToUse = saved.trim().toLowerCase();
      } catch {}

      if (!emailToUse) {
        try {
          const authUser = localStorage.getItem('legalisa_active_user');
          if (authUser) {
            const parsed = JSON.parse(authUser);
            if (parsed?.email) emailToUse = parsed.email.trim().toLowerCase();
          }
        } catch {}
      }
    }

    if (emailToUse) {
      setCurrentApproverEmail(emailToUse);
      try {
        localStorage.setItem('legalisa_approver_email', emailToUse);
      } catch {}
    }
  }, [urlEmail]);

  // Load org users for selector
  useEffect(() => {
    async function loadUsers() {
      try {
        const users = await fetchOrganizationUsers();
        setOrgUsers(users);
      } catch (err) {
        console.warn('Error loading organization users:', err);
      }
    }
    loadUsers();
  }, []);

  // Fetch approvals for current approver
  const loadApprovals = async (targetEmail: string) => {
    if (!targetEmail) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const normEmail = targetEmail.toLowerCase().trim();

      // 1. Fetch Cajas_menores table to map Responsable -> Approver
      const { data: cmDefinitions } = await supabase.from('Cajas_menores').select('*');
      const cmMap = new Map<string, string>();
      (cmDefinitions || []).forEach((cm: any) => {
        const parts = (cm.Aprobador || '').split('#');
        const appEmail = (parts[1] || parts[0] || '').toLowerCase().trim();
        if (cm.Responsable) {
          cmMap.set(cm.Responsable.toLowerCase().trim(), appEmail);
        }
      });

      // 2. Fetch all 3 tables in parallel
      const [tcRes, gastosRes, cajasRes] = await Promise.all([
        supabase.from('legalizaciones_tarjetas_credito').select('*').order('created_at', { ascending: false }),
        supabase.from('legalizaciones_gastos').select('*').order('created_at', { ascending: false }),
        supabase.from('legalizaciones cajas menores').select('*').order('created_at', { ascending: false }),
      ]);

      const aggregated: ApprovalItem[] = [];

      // Helper to extract reassigned email
      const getReassignedEmail = (observaciones?: string | null): string | null => {
        if (!observaciones) return null;
        const matches = observaciones.match(/\[Reasignado a [^\]]*\(([^)]+)\)\]/gi);
        if (matches && matches.length > 0) {
          const last = matches[matches.length - 1];
          const inner = last.match(/\(([^)]+)\)/);
          if (inner && inner[1]) return inner[1].toLowerCase().trim();
        }
        return null;
      };

      // 2.1 Process Tarjetas de Crédito
      (tcRes.data || []).forEach((row: any) => {
        let approver = (row.aprobador_email || '').toLowerCase().trim();
        const reassigned = getReassignedEmail(row.observaciones_aprobacion);
        if (reassigned) approver = reassigned;

        if (approver === normEmail) {
          aggregated.push({
            id: row.id,
            codigo: row.codigo || `TC-${row.id}`,
            tipo: 'Tarjeta de Crédito',
            tipoKey: 'tarjeta',
            solicitante: row.usuario_nombre || 'No especificado',
            solicitanteEmail: row.usuario_email || '',
            fecha: row.fecha || row.created_at,
            total: Number(row.total_gastos || 0),
            estado: row.estado || 'pendiente',
            centroCosto: row.centro_costo || '',
            motivo: row.motivo || '',
            url: `/formulario-tarjetas-credito/${row.id}?email=${encodeURIComponent(normEmail)}`,
            created_at: row.created_at,
            sapDocEntry: row.sap_doc_entry,
          });
        }
      });

      // 2.2 Process Gastos
      (gastosRes.data || []).forEach((row: any) => {
        let approver = (row.aprobador_email || '').toLowerCase().trim();
        const reassigned = getReassignedEmail(row.observaciones_aprobacion);
        if (reassigned) approver = reassigned;

        if (approver === normEmail) {
          aggregated.push({
            id: row.id,
            codigo: row.codigo || `LEG-${row.id}`,
            tipo: 'Gastos',
            tipoKey: 'gastos',
            solicitante: row.usuario_nombre || 'No especificado',
            solicitanteEmail: row.usuario_email || '',
            fecha: row.fecha || row.created_at,
            total: Number(row.total_gastos || 0),
            estado: row.estado || 'pendiente',
            centroCosto: row.centro_costo || '',
            motivo: row.motivo || '',
            url: `/formulario-gastos/${row.id}?email=${encodeURIComponent(normEmail)}`,
            created_at: row.created_at,
            sapDocEntry: row.sap_doc_entry,
          });
        }
      });

      // 2.3 Process Cajas Menores
      (cajasRes.data || []).forEach((row: any) => {
        let approver = '';
        const applicantName = (row.usuarioNombre || '').toLowerCase().trim();
        for (const [respKey, appEmail] of cmMap.entries()) {
          if (applicantName.includes(respKey) || respKey.includes(applicantName)) {
            approver = appEmail;
            break;
          }
        }
        const reassigned = getReassignedEmail(row.observacionesAprobacion || row.observaciones_aprobacion);
        if (reassigned) approver = reassigned;

        if (approver === normEmail) {
          aggregated.push({
            id: row.id,
            codigo: row.codigo || `CM-${row.id}`,
            tipo: 'Caja Menor',
            tipoKey: 'caja_menor',
            solicitante: row.usuarioNombre || 'No especificado',
            solicitanteEmail: row.usuarioEmail || '',
            fecha: row.fecha || row.created_at,
            total: Number(row.totalGastos || 0),
            estado: row.estado || 'pendiente',
            centroCosto: row.centroCosto || '',
            motivo: row.motivo || '',
            url: `/formulario-publico/${row.id}?email=${encodeURIComponent(normEmail)}`,
            created_at: row.created_at,
            sapDocEntry: row.sap_doc_entry,
          });
        }
      });

      setItems(aggregated);
    } catch (err) {
      console.error('Error cargando aprobaciones:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentApproverEmail) {
      loadApprovals(currentApproverEmail);
    } else {
      setLoading(false);
    }
  }, [currentApproverEmail]);

  const handleApproverChange = (newEmail: string) => {
    const clean = newEmail.trim().toLowerCase();
    setCurrentApproverEmail(clean);
    try {
      localStorage.setItem('legalisa_approver_email', clean);
    } catch {}
    router.replace(`/aprobaciones?email=${encodeURIComponent(clean)}`);
    setShowUserSwitcher(false);
  };

  const handleRefresh = () => {
    if (currentApproverEmail) {
      setRefreshing(true);
      loadApprovals(currentApproverEmail);
    }
  };

  // Find user display name
  const approverUser = useMemo(() => {
    return orgUsers.find((u) => u.email.toLowerCase() === currentApproverEmail.toLowerCase());
  }, [orgUsers, currentApproverEmail]);

  const approverDisplayName = approverUser?.nombre || currentApproverEmail.split('@')[0] || 'Usuario Aprobador';

  // Partition into Pendientes vs Historico
  const { pendientes, historico } = useMemo(() => {
    const pend: ApprovalItem[] = [];
    const hist: ApprovalItem[] = [];

    items.forEach((item) => {
      const st = (item.estado || '').toLowerCase().trim();
      if (st === 'pendiente' || st === 'pendiente de revisión' || st === 'pendiente de aprobacion') {
        pend.push(item);
      } else {
        hist.push(item);
      }
    });

    return { pendientes: pend, historico: hist };
  }, [items]);

  // Active list based on tab
  const baseList = activeTab === 'pendientes' ? pendientes : historico;

  // Filtered by type and search term
  const filteredItems = useMemo(() => {
    return baseList.filter((item) => {
      // Type filter
      if (selectedTypeFilter !== 'todos' && item.tipoKey !== selectedTypeFilter) {
        return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchCode = item.codigo.toLowerCase().includes(q);
        const matchSol = item.solicitante.toLowerCase().includes(q);
        const matchEmail = item.solicitanteEmail.toLowerCase().includes(q);
        const matchCC = (item.centroCosto || '').toLowerCase().includes(q);
        const matchMot = (item.motivo || '').toLowerCase().includes(q);
        const matchAmount = String(item.total).includes(q);
        return matchCode || matchSol || matchEmail || matchCC || matchMot || matchAmount;
      }

      return true;
    });
  }, [baseList, selectedTypeFilter, searchTerm]);

  // Metrics
  const totalMontoPendiente = useMemo(() => {
    return pendientes.reduce((acc, curr) => acc + curr.total, 0);
  }, [pendientes]);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (estado: string) => {
    const st = estado.toLowerCase();
    if (st === 'aprobado') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Aprobado
        </span>
      );
    }
    if (st === 'rechazado') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3.5 h-3.5 text-rose-600" /> Rechazado
        </span>
      );
    }
    if (st === 'pagado' || st === 'procesado') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> Procesado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse">
        <Clock className="w-3.5 h-3.5 text-amber-600" /> Pendiente
      </span>
    );
  };

  const getTypeBadge = (tipoKey: ApprovalItem['tipoKey']) => {
    switch (tipoKey) {
      case 'tarjeta':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            <CreditCard className="w-3.5 h-3.5 text-purple-600" /> Tarjeta de Crédito
          </span>
        );
      case 'gastos':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Receipt className="w-3.5 h-3.5 text-blue-600" /> Gastos
          </span>
        );
      case 'caja_menor':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Wallet className="w-3.5 h-3.5 text-emerald-600" /> Caja Menor
          </span>
        );
    }
  };

  const approverOptions = useMemo(() => {
    return orgUsers.map((u) => ({
      value: u.email.toLowerCase(),
      label: u.nombre,
      sublabel: `${u.email}${u.area ? ` • ${u.area}` : ''}`,
    }));
  }, [orgUsers]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex items-center justify-between gap-4">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
                <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-slate-900 tracking-tight">Legalisa</h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                    Mis Aprobaciones
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Panel Unificado de Legalizaciones Asignadas
                </p>
              </div>
            </div>

            {/* Current Approver Indicator & Switcher */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setShowUserSwitcher(!showUserSwitcher)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium border border-slate-200 transition-all cursor-pointer"
                title="Cambiar usuario aprobador"
              >
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[11px]">
                  {approverDisplayName.charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="font-semibold text-slate-900 leading-none truncate max-w-[140px]">
                    {approverDisplayName}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                    {currentApproverEmail || 'Sin usuario'}
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
                title="Actualizar listado"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* User Switcher Dropdown (Modal / Inline) */}
          {showUserSwitcher && (
            <div className="mt-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-xl max-w-lg mx-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-blue-600" /> Seleccionar Usuario Aprobador
                </span>
                <button
                  onClick={() => setShowUserSwitcher(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                Consulta los pendientes e históricos de cualquier aprobador de la organización:
              </p>
              <SearchableSelect
                options={approverOptions}
                value={currentApproverEmail}
                onChange={handleApproverChange}
                placeholder="Buscar aprobador por nombre o correo..."
                searchPlaceholder="Escribe para buscar..."
              />
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* No Approver Selected State */}
        {!currentApproverEmail && !loading && (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center max-w-md mx-auto shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mx-auto">
              <User className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Selecciona tu usuario</h2>
            <p className="text-xs text-slate-500">
              Para ver tus legalizaciones pendientes por aprobar e histórico, selecciona tu nombre o correo corporativo.
            </p>
            <div className="text-left">
              <SearchableSelect
                options={approverOptions}
                value=""
                onChange={handleApproverChange}
                placeholder="Seleccionar mi usuario..."
                searchPlaceholder="Buscar por nombre o correo..."
              />
            </div>
          </div>
        )}

        {currentApproverEmail && (
          <>
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Pendientes */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Pendientes por Aprobar
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">{pendientes.length}</span>
                  <span className="text-xs text-amber-700 font-semibold">
                    {pendientes.length === 1 ? 'legalización' : 'legalizaciones'}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Requieren tu revisión y aprobación
                </div>
              </div>

              {/* Monto Pendiente */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Monto Total Pendiente
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-xl font-black text-blue-700">
                    {formatCOP(totalMontoPendiente)}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Suma total de gastos pendientes
                </div>
              </div>

              {/* Histórico Aprobadas */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Histórico Aprobadas
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">{historico.length}</span>
                  <span className="text-xs text-emerald-700 font-semibold">gestionadas</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Aprobadas, procesadas o rechazadas
                </div>
              </div>

              {/* Total Asignadas */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total Asignadas
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">{items.length}</span>
                  <span className="text-xs text-indigo-700 font-semibold">totales</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400 truncate">
                  Para {approverDisplayName}
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              {/* Tabs Navigation & Search Controls */}
              <div className="p-4 sm:p-6 border-b border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  {/* Primary Tabs */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
                    <button
                      onClick={() => setActiveTab('pendientes')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'pendientes'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span>Pendientes por Aprobar</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          activeTab === 'pendientes'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {pendientes.length}
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveTab('historico')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'historico'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Histórico de Aprobaciones</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          activeTab === 'historico'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {historico.length}
                      </span>
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar por código, solicitante, centro de costo..."
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-Filters: Legalization Type Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5" /> Filtrar tipo:
                  </span>
                  {[
                    { key: 'todos', label: 'Todos' },
                    { key: 'tarjeta', label: 'Tarjetas de Crédito', icon: CreditCard },
                    { key: 'gastos', label: 'Gastos', icon: Receipt },
                    { key: 'caja_menor', label: 'Cajas Menores', icon: Wallet },
                  ].map((filter) => {
                    const isSelected = selectedTypeFilter === filter.key;
                    const Icon = filter.icon;
                    return (
                      <button
                        key={filter.key}
                        onClick={() => setSelectedTypeFilter(filter.key as any)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {Icon && <Icon className="w-3.5 h-3.5" />}
                        <span>{filter.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Table / List View */}
              {loading ? (
                <div className="p-12 text-center space-y-3">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-slate-500 font-semibold">Cargando legalizaciones asignadas...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    {activeTab === 'pendientes' ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <Search className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {activeTab === 'pendientes'
                      ? '¡Estás al día!'
                      : 'No se encontraron registros'}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {activeTab === 'pendientes'
                      ? `No tienes legalizaciones pendientes por aprobar asignadas a ${approverDisplayName}.`
                      : searchTerm || selectedTypeFilter !== 'todos'
                      ? 'No hay registros que coincidan con los filtros seleccionados.'
                      : `Aún no se registran aprobaciones históricas para ${approverDisplayName}.`}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3.5 px-4 sm:px-6">Código / Tipo</th>
                        <th className="py-3.5 px-4">Solicitante</th>
                        <th className="py-3.5 px-4 hidden md:table-cell">Centro de Costo / Motivo</th>
                        <th className="py-3.5 px-4">Fecha</th>
                        <th className="py-3.5 px-4 text-right">Total Gastos</th>
                        <th className="py-3.5 px-4 text-center">Estado</th>
                        <th className="py-3.5 px-4 sm:px-6 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.map((item) => (
                        <tr
                          key={`${item.tipoKey}-${item.id}`}
                          className="hover:bg-blue-50/40 transition-colors group"
                        >
                          {/* Código & Tipo */}
                          <td className="py-3.5 px-4 sm:px-6">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors flex items-center gap-1.5">
                                {item.codigo}
                                {item.sapDocEntry && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                                    SAP #{item.sapDocEntry}
                                  </span>
                                )}
                              </span>
                              <div>{getTypeBadge(item.tipoKey)}</div>
                            </div>
                          </td>

                          {/* Solicitante */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                                {item.solicitante.charAt(0).toUpperCase()}
                              </div>
                              <div className="truncate max-w-[180px]">
                                <div className="font-semibold text-slate-900 truncate">
                                  {item.solicitante}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {item.solicitanteEmail || 'Sin correo'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Centro de Costo & Motivo */}
                          <td className="py-3.5 px-4 hidden md:table-cell">
                            <div className="max-w-[220px]">
                              <div className="font-medium text-slate-800 truncate" title={item.centroCosto}>
                                {item.centroCosto || 'N/A'}
                              </div>
                              {item.motivo && (
                                <div className="text-[10px] text-slate-500 truncate" title={item.motivo}>
                                  {item.motivo}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Fecha */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                            {formatDate(item.fecha)}
                          </td>

                          {/* Total */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <span className="font-bold text-slate-900 text-sm">
                              {formatCOP(item.total)}
                            </span>
                          </td>

                          {/* Estado */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {getStatusBadge(item.estado)}
                          </td>

                          {/* Acción */}
                          <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                            <Link
                              href={item.url}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-sm ${
                                activeTab === 'pendientes'
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                                  : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200'
                              }`}
                            >
                              <span>{activeTab === 'pendientes' ? 'Revisar / Aprobar' : 'Ver Detalle'}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-500 font-bold">Cargando Portal de Aprobaciones...</p>
          </div>
        </div>
      }
    >
      <ApprovalsDashboard />
    </Suspense>
  );
}
