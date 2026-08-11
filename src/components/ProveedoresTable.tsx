'use client';

import React, { useState } from 'react';
import { Building2, Search, Mail, MapPin, RefreshCw } from 'lucide-react';
import { Proveedor } from '@/types/legalizaciones';

interface ProveedoresTableProps {
  proveedores: Proveedor[];
  loading: boolean;
  onRefresh: () => void;
}

export const ProveedoresTable: React.FC<ProveedoresTableProps> = ({
  proveedores,
  loading,
  onRefresh,
}) => {
  const [filterText, setFilterText] = useState('');

  const filtered = proveedores.filter((p) => {
    const term = filterText.toLowerCase();
    return (
      p.razon_social?.toLowerCase().includes(term) ||
      p.numero_identificacion?.toLowerCase().includes(term) ||
      p.email?.toLowerCase().includes(term) ||
      p.ciudad?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      {/* Table Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" /> Catálogo de Proveedores & Terceros (Supabase)
          </h2>
          <p className="text-xs text-slate-500">
            Cargado en tiempo real desde la tabla <code className="text-blue-600 font-mono font-bold">public.proveedores</code>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filtrar por Razón Social, NIT o Email..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-blue-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
            title="Recargar desde Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-4">Razón Social / Proveedor</th>
              <th className="py-3.5 px-4">NIT / Identificación</th>
              <th className="py-3.5 px-4">Tipo Contraparte</th>
              <th className="py-3.5 px-4">Contacto / Email</th>
              <th className="py-3.5 px-4">Ubicación</th>
              <th className="py-3.5 px-4">Estado Contable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  {loading ? 'Cargando proveedores desde Supabase...' : 'No se encontraron proveedores registrados.'}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {p.razon_social || 'Desconocido'}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-blue-900">
                    {p.numero_identificacion || 'Sin ID'}
                  </td>
                  <td className="py-3.5 px-4 capitalize text-slate-600">
                    {p.tipo_contraparte?.replace('_', ' ') || 'N/A'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {p.email || 'No registrado'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {p.ciudad || 'Colombia'} ({p.pais || 'CO'})
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border capitalize ${
                        p.estado === 'aprobado'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {p.estado || 'activo'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
