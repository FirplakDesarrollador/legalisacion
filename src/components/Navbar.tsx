'use client';

import React from 'react';
import { Database, Search, Bell, ShieldCheck, UserCheck, RefreshCw, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { HealthCheckResult } from '@/lib/supabase';

interface NavbarProps {
  health: HealthCheckResult | null;
  onRefreshHealth: () => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  currentUser: { email: string; name: string; role: string } | null;
  onLogout: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  health,
  onRefreshHealth,
  searchTerm,
  onSearchChange,
  currentUser,
  onLogout,
  isSidebarOpen = true,
  onToggleSidebar,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 shadow-sm text-slate-800">
      {/* Brand & Supabase Status */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold ${
              isSidebarOpen
                ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 shadow-xs'
            }`}
            title={isSidebarOpen ? 'Ocultar menú lateral' : 'Mostrar menú lateral'}
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-4 h-4 text-slate-600" />
            ) : (
              <PanelLeftOpen className="w-4 h-4 text-blue-600" />
            )}
            <span className="hidden md:inline">{isSidebarOpen ? 'Ocultar Menú' : 'Ver Menú'}</span>
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/20 text-white">
            <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
              Legalisa <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">Supabase Connected</span>
            </h1>
            <p className="text-xs text-slate-500">Sistema Inteligente de Legalización de Gastos & Viáticos</p>
          </div>
        </div>

        {/* Supabase Live Badge */}
        <div className="hidden lg:flex items-center gap-2 ml-4 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${health?.connected ? 'bg-blue-500' : 'bg-amber-500'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${health?.connected ? 'bg-blue-600' : 'bg-amber-600'}`}></span>
          </span>
          <Database className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-600 font-mono text-[11px] truncate max-w-[220px]">
            {health?.connected ? 'zohdtksgxhbheaftgmsi.supabase.co' : 'Conectando...'}
          </span>
          <button
            onClick={onRefreshHealth}
            title="Recargar estado Supabase"
            className="text-slate-400 hover:text-blue-600 transition-colors ml-1"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Global Search & User Actions */}
      <div className="flex items-center gap-4">
        <div className="relative w-64 md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por empleado, motivo, nit o factura..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-1 focus:ring-blue-600 transition-all"
          />
        </div>

        <button className="relative p-2 text-slate-500 hover:text-blue-600 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full"></span>
        </button>

        {/* User Badge */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs">
            <UserCheck className="w-4 h-4 text-blue-700" />
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-slate-900 leading-tight">
              {currentUser?.name || 'Administrador Tesorería'}
            </p>
            <p className="text-[10px] text-slate-500 leading-tight">
              {currentUser?.email || 'admin@firplak.com'}
            </p>
          </div>

          <button
            onClick={onLogout}
            title="Cerrar Sesión"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
