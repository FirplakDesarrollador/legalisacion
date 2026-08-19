import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, CheckCircle2, FileText, Calculator, Paperclip, ExternalLink, Receipt, User, Mail, ChevronDown, Search } from 'lucide-react';
import { Legalizacion, LineaGasto, CuentaContable, Proveedor, CentroCosto } from '@/types/legalizaciones';
import { fetchCentrosCostoFromSupabase, fetchOrganizationUsers, OrganizationUser, supabase } from '@/lib/supabase';

interface NuevaGastoModalProps {
  isOpen: boolean;
  onClose: () => void;
  cuentas: CuentaContable[];
  proveedores: Proveedor[];
  onSave: (nueva: Legalizacion) => void;
}

export const NuevaGastoModal: React.FC<NuevaGastoModalProps> = ({
  isOpen,
  onClose,
  cuentas,
  proveedores,
  onSave,
}) => {
  if (!isOpen) return null;

  const [centros, setCentros] = useState<CentroCosto[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrganizationUser[]>([]);
  
  const [usuarioNombre, setUsuarioNombre] = useState('Mateo Benavides Rios');
  const [usuarioEmail, setUsuarioEmail] = useState('mateo.benavides@firplak.com');
  const [centroCosto, setCentroCosto] = useState('Desarrollo TI');
  const [motivo, setMotivo] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [anticipoRecibido, setAnticipoRecibido] = useState<number>(0);

  // Dropdown states for search
  const [showSolicitanteDropdown, setShowSolicitanteDropdown] = useState(false);
  const [solicitanteSearch, setSolicitanteSearch] = useState('');
  const solicitanteRef = useRef<HTMLDivElement>(null);

  const [showAprobadorDropdown, setShowAprobadorDropdown] = useState(false);
  const [aprobadorSearch, setAprobadorSearch] = useState('');
  const aprobadorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [centrosData, usersData] = await Promise.all([
          fetchCentrosCostoFromSupabase(),
          fetchOrganizationUsers(),
        ]);
        setCentros(centrosData);
        setOrgUsers(usersData);
      } catch (err) {
        console.error('Error cargando datos para modal de gastos:', err);
      }
    }
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

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

  const [lineas, setLineas] = useState<LineaGasto[]>([
    {
      id: 'lin-init-1',
      fecha: new Date().toISOString().split('T')[0],
      concepto: '',
      cuentaId: null,
      cuentaTitulo: '',
      proveedorNombre: '',
      tipoDocumento: 'Factura',
      facturaNumero: '',
      valorSubtotal: 0,
      valorIva: 0,
      valorTotal: 0,
    },
  ]);

  const formatCOP = (num: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const handleAddLinea = () => {
    const newLine: LineaGasto = {
      id: `lin-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      fecha: new Date().toISOString().split('T')[0],
      concepto: '',
      cuentaId: null,
      cuentaTitulo: '',
      proveedorNombre: '',
      tipoDocumento: 'Factura',
      facturaNumero: '',
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

  const totalGastos = lineas.reduce((acc, l) => acc + (l.valorTotal || 0), 0);
  const saldoDiferencia = totalGastos - anticipoRecibido;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioNombre.trim()) {
      alert('Por favor ingrese el nombre del solicitante.');
      return;
    }
    if (!motivo.trim()) {
      alert('Por favor ingrese el motivo del gasto.');
      return;
    }

    const randomNum = Math.floor(100 + Math.random() * 900);
    const nuevaLeg: Legalizacion = {
      id: `leg-gasto-${Date.now()}`,
      codigo: `LEG-GST-${randomNum}`,
      fecha,
      usuarioNombre,
      usuarioEmail,
      centroCosto,
      motivo,
      estado: 'pendiente',
      anticipoRecibido,
      totalGastos,
      saldoDiferencia,
      lineas,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Trigger Power Automate Notification
    try {
      const link = typeof window !== 'undefined' ? `${window.location.origin}/formulario-gastos/${nuevaLeg.id}` : '';
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: usuarioEmail,
          titulo: `Aprobación de Legalización de Gastos - ${nuevaLeg.codigo}`,
          contenido: `Tienes esta legalización de gastos pendiente por aprobar de ${usuarioNombre} por valor de ${formatCOP(totalGastos)}.`,
          link: link,
        }),
      }).catch((flowErr) => {
        console.error('Error enviando notificación a Power Automate:', flowErr);
      });
    } catch (err) {
      console.error('Error al preparar notificación:', err);
    }

    onSave(nuevaLeg);
    onClose();
  };

  const filteredSolicitantes = orgUsers.filter((u) => {
    const term = (solicitanteSearch || usuarioNombre).toLowerCase();
    return u.nombre.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
  });

  const filteredAprobadores = orgUsers.filter((u) => {
    const term = (aprobadorSearch || usuarioEmail).toLowerCase();
    return u.nombre.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Nueva Legalización de Gastos</h2>
              <p className="text-xs text-blue-100">Registre los comprobantes y gastos de viaje / representación</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* General Information */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" /> Información General
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Searchable Solicitante Field */}
              <div className="relative" ref={solicitanteRef}>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nombre del Solicitante (Microsoft M365) *
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
                    className="w-full p-2 pr-7 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                  />
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {showSolicitanteDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {filteredSolicitantes.length === 0 ? (
                      <div className="p-3 text-slate-400 text-[11px] text-center">
                        No se encontraron usuarios coincidentes
                      </div>
                    ) : (
                      filteredSolicitantes.map((user) => (
                        <div
                          key={user.email}
                          onClick={() => {
                            setUsuarioNombre(user.nombre);
                            if (user.area && user.area !== 'General') {
                              setCentroCosto(user.area);
                            }
                            setShowSolicitanteDropdown(false);
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
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Searchable Aprobador / Correo Field */}
              <div className="relative" ref={aprobadorRef}>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Correo Electrónico (Aprobador/Solicitante) *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={usuarioEmail}
                    onFocus={() => {
                      setShowAprobadorDropdown(true);
                      setAprobadorSearch(usuarioEmail);
                    }}
                    onChange={(e) => {
                      setUsuarioEmail(e.target.value);
                      setAprobadorSearch(e.target.value);
                      setShowAprobadorDropdown(true);
                    }}
                    placeholder="ejemplo@firplak.com"
                    className="w-full p-2 pr-7 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                  />
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {showAprobadorDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {filteredAprobadores.length === 0 ? (
                      <div className="p-3 text-slate-400 text-[11px] text-center">
                        No se encontraron correos coincidentes
                      </div>
                    ) : (
                      filteredAprobadores.map((user) => (
                        <div
                          key={user.email}
                          onClick={() => {
                            setUsuarioEmail(user.email);
                            setShowAprobadorDropdown(false);
                          }}
                          className="p-2.5 hover:bg-blue-50 cursor-pointer transition-colors flex items-center gap-2.5 text-left"
                        >
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {user.nombre.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 truncate text-xs">{user.email}</p>
                            <p className="text-[10px] text-slate-500 truncate">{user.nombre} {user.area ? `• ${user.area}` : ''}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Fecha de Radicación
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Área / Centro de Costos General
                </label>
                <input
                  type="text"
                  value={centroCosto}
                  onChange={(e) => setCentroCosto(e.target.value)}
                  placeholder="Ej. Operaciones Comercial"
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Anticipo Recibido ($ COP)
                </label>
                <input
                  type="number"
                  min={0}
                  value={anticipoRecibido || ''}
                  onChange={(e) => setAnticipoRecibido(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Motivo / Justificación del Gasto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Viáticos viaje a Bogotá cliente X"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Line Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-600" /> Líneas de Gasto Soportado
              </h3>
              <button
                type="button"
                onClick={handleAddLinea}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Añadir Línea
              </button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {lineas.map((linea) => (
                <div
                  key={linea.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Fecha Gasto</label>
                      <input
                        type="date"
                        value={linea.fecha}
                        onChange={(e) => handleUpdateLinea(linea.id, 'fecha', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Tipo Doc.</label>
                      <select
                        value={linea.tipoDocumento || 'Factura'}
                        onChange={(e) => handleUpdateLinea(linea.id, 'tipoDocumento', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
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
                          className="w-full p-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-400 font-mono italic cursor-not-allowed text-[11px]"
                        />
                      ) : (
                        <input
                          type="text"
                          placeholder="Ej. FE-1092"
                          value={linea.facturaNumero}
                          onChange={(e) => handleUpdateLinea(linea.id, 'facturaNumero', e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-900"
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Centro de Costos *</label>
                      <select
                        required
                        value={linea.concepto || ''}
                        onChange={(e) => {
                          handleUpdateLinea(linea.id, 'concepto', e.target.value);
                          handleUpdateLinea(linea.id, 'cuentaId', null);
                        }}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
                      >
                        <option value="" disabled>-- Seleccione Centro de Costo --</option>
                        {centros.map((c) => (
                          <option key={c.id} value={`${c.codigo} - ${c.Título}`}>
                            {c.codigo} - {c.Título}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Cuenta Contable (Supabase) *</label>
                      <select
                        value={linea.cuentaId || ''}
                        onChange={(e) => handleUpdateLinea(linea.id, 'cuentaId', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-blue-900 font-mono font-semibold"
                        required
                      >
                        <option value="" disabled>-- Seleccione Cuenta Contable --</option>
                        {cuentas.filter((c) => {
                          if (!linea.concepto) return true;
                          const cc = linea.concepto.toUpperCase();
                          if (cc.startsWith('GA')) return c.Título.startsWith('51');
                          if (cc.startsWith('GV')) return c.Título.startsWith('52');
                          if (cc.startsWith('IP')) return c.Título.startsWith('73');
                          if (cc.startsWith('MO')) return c.Título.startsWith('72');
                          return true;
                        }).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.Título} ({c.categoria})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Valor del Gasto ($ COP)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={linea.valorSubtotal || ''}
                        onChange={(e) => handleUpdateLinea(linea.id, 'valorSubtotal', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono font-bold text-xs"
                        min={0}
                        required
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Total Línea ($ COP)</label>
                        <div className="p-1.5 bg-slate-100 border border-slate-200 rounded-lg text-blue-900 font-mono font-bold text-xs">
                          {formatCOP(linea.valorTotal)}
                        </div>
                      </div>
                      {lineas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLinea(linea.id)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Eliminar línea"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* File Upload Row */}
                  <div className="mt-2 border-t border-slate-200/70 pt-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                        Adjuntar Documento / Soporte ({linea.tipoDocumento || 'Factura'})
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
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleUpdateLinea(linea.id, 'soporteFile', file);
                          handleUpdateLinea(linea.id, 'soporteUrl', 'uploading');
                          
                          const fileExt = file.name.split('.').pop();
                          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
                          const filePath = `comprobantes/${fileName}`;
                          
                          try {
                            const { data: uploadData, error: uploadError } = await supabase.storage
                              .from('soportes')
                              .upload(filePath, file);
                              
                            if (!uploadError) {
                              const { data: urlData } = supabase.storage
                                .from('soportes')
                                .getPublicUrl(filePath);
                              handleUpdateLinea(linea.id, 'soporteUrl', urlData.publicUrl);
                            } else {
                              console.error('Error uploading file:', uploadError);
                              handleUpdateLinea(linea.id, 'soporteUrl', '');
                              alert('Error al subir el archivo: ' + uploadError.message);
                            }
                          } catch (err: any) {
                            console.error('Error de red al subir:', err);
                            handleUpdateLinea(linea.id, 'soporteUrl', '');
                          }
                        }
                      }}
                      className="block w-full text-xs text-slate-500
                        file:mr-4 file:py-1 file:px-3
                        file:rounded-lg file:border-0
                        file:text-xs file:font-bold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100
                        cursor-pointer transition-colors"
                    />
                    {linea.soporteUrl === 'uploading' && (
                      <div className="mt-1 flex items-center gap-1.5 text-blue-700 font-bold text-[10px]">
                        <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Subiendo documento a Supabase Storage...</span>
                      </div>
                    )}
                    {linea.soporteUrl && linea.soporteUrl !== 'uploading' && (
                      <div className="mt-1 flex items-center gap-1.5 text-emerald-700 font-bold text-[10px]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>✓ Documento guardado correctamente</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Real-time Summary Card */}
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

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md shadow-blue-600/20 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Guardar Legalización</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
