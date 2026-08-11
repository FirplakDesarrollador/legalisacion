'use client';

import React, { useState } from 'react';
import { BookOpenCheck, Search, RefreshCw, Tag } from 'lucide-react';
import { CuentaContable } from '@/types/legalizaciones';

interface CuentasTableProps {
  cuentas: CuentaContable[];
  loading: boolean;
  onRefresh: () => void;
}

export const CuentasTable: React.FC<CuentasTableProps> = ({
  cuentas,
  loading,
  onRefresh,
}) => {
  const [filterText, setFilterText] = useState('');

  const filtered = cuentas.filter((c) => {
    const term = filterText.toLowerCase();
    return (
      c.Título?.toLowerCase().includes(term) ||
      c.categoria?.toLowerCase().includes(term) ||
      c.id.toString().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BookOpenCheck className="w-4 h-4 text-blue-600" /> Plan Único de Cuentas Contables (Supabase)
          </h2>
          <p className="text-xs text-slate-500">
            Cargado en tiempo real desde la tabla <code className="text-blue-600 font-mono font-bold">public.cuentas</code>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Buscar por código, título o categoría..."
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
              <th className="py-3.5 px-4">ID</th>
              <th className="py-3.5 px-4">Código & Título Contable</th>
              <th className="py-3.5 px-4">Categoría de Gasto</th>
              <th className="py-3.5 px-4">Creado Por</th>
              <th className="py-3.5 px-4">Fecha de Alta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                  {loading ? 'Cargando plan de cuentas desde Supabase...' : 'No se encontraron cuentas contables.'}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 text-slate-400">{c.id}</td>
                  <td className="py-3.5 px-4 font-bold text-blue-900">
                    {c.Título}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 font-sans">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200">
                      <Tag className="w-3 h-3 text-blue-500" />
                      {c.categoria}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-sans">
                    {c['Creado por'] || 'Administrador Global'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-sans">
                    {c.Creado || 'N/A'}
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
