'use client';

import React, { useState } from 'react';
import { Wallet, PlusCircle, SlidersHorizontal, Copy, ExternalLink, Check } from 'lucide-react';

export type TabType = 'cajas_menores' | 'dashboard' | 'legalizaciones' | 'cuentas' | 'proveedores' | 'reportes';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenNuevaModal: () => void;
  counts: {
    legalizaciones: number;
    cajasMenores: number;
    cuentas: number;
    proveedores: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenNuevaModal,
  counts,
}) => {
  const [copied, setCopied] = useState(false);

  const menuItems = [
    {
      id: 'legalizaciones' as TabType,
      label: 'Cajas Menores',
      icon: SlidersHorizontal,
      badge: counts.legalizaciones,
    },
    {
      id: 'cajas_menores' as TabType,
      label: 'Tarjetas de credito',
      icon: Wallet,
      badge: counts.cajasMenores,
    },
  ];

  const handleCopyFormLink = () => {
    const isTC = activeTab === 'cajas_menores'; // 'cajas_menores' id corresponds to Tarjetas de Credito
    const url = `${window.location.origin}${isTC ? '/formulario-tarjetas-credito' : '/formulario-publico'}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <aside className="w-64 bg-slate-50 border-r border-slate-200 p-4 flex flex-col justify-between shrink-0 min-h-[calc(100vh-65px)]">
      <div className="space-y-6">


        {/* Navigation Section */}
        <div>
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Menú Principal
          </p>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== null && item.badge !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Public Form Info Box */}
        <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 shadow-sm text-slate-700 text-xs space-y-2">
          <div className="text-blue-900 font-bold text-[11px] mb-1">
            Formularios Públicos
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] flex items-center gap-1.5">Cajas Menores</span>
              <a href="/formulario-publico" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5 text-[10px]">
                Abrir <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] flex items-center gap-1.5">Tarjetas de Crédito</span>
              <a href="/formulario-tarjetas-credito" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5 text-[10px]">
                Abrir <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          <p className="text-[9px] text-slate-600 leading-relaxed mt-2">
            Accesibles para cualquier usuario sin necesidad de iniciar sesión.
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="border-t border-slate-200 pt-3 text-[10px] text-slate-400 text-center font-medium">
        Legalisa App v1.0.0 &bull; Cajas Menores & Viáticos
      </div>
    </aside>
  );
};
