import React, { useState, useEffect } from 'react';
import { 
  Truck, Plus, Search, PhoneCall, Mail, MapPin, 
  Clock, Star, ShieldCheck, Edit3, Trash2, RefreshCw,
  Building2, Layers, AlertCircle
} from 'lucide-react';
import { fetchVendors, deleteVendor, toggleVendorType } from '../api';
import AddVendorModal from './AddVendorModal';

export default function VendorDirectoryView({ onOpenAddModal }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL', 'TRIP', 'LOCAL'
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [vendorToEdit, setVendorToEdit] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    loadVendors();
  }, []);

  async function loadVendors() {
    try {
      setLoading(true);
      setActionError(null);
      const data = await fetchVendors();
      setVendors(data);
    } catch (err) {
      console.error(err);
      setActionError('Failed to load vendors: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenAdd() {
    setVendorToEdit(null);
    setVendorModalOpen(true);
  }

  function handleOpenEdit(vendor) {
    setVendorToEdit(vendor);
    setVendorModalOpen(true);
  }

  async function handleDeleteVendor(vendor) {
    if (vendor.active_jobs_count > 0) {
      alert(`Cannot delete ${vendor.name} because they currently have ${vendor.active_jobs_count} active jobwork orders.`);
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete vendor "${vendor.name}" (${vendor.code})?`);
    if (!confirmDelete) return;

    try {
      setDeletingId(vendor.id);
      setActionError(null);
      await deleteVendor(vendor.id);
      await loadVendors();
    } catch (err) {
      console.error(err);
      setActionError(err.message || 'Failed to delete vendor');
      setDeletingId(null);
    }
  }

  async function handleToggleType(v) {
    try {
      setTogglingId(v.id);
      const res = await toggleVendorType(v.id);
      setVendors(prev => prev.map(item => item.id === v.id ? { ...item, vendor_type: res.vendor_type } : item));
    } catch (err) {
      setActionError(err.message || 'Failed to toggle vendor type');
    } finally {
      setTogglingId(null);
    }
  }

  const tripCount = vendors.filter(v => v.vendor_type === 'Trip').length;
  const localCount = vendors.filter(v => (v.vendor_type || 'Local') === 'Local').length;

  const filtered = vendors.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.processes_offered.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.contact_person && v.contact_person.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;
    if (typeFilter === 'TRIP') return v.vendor_type === 'Trip';
    if (typeFilter === 'LOCAL') return (v.vendor_type || 'Local') === 'Local';
    return true;
  });

  const totalActiveJobs = vendors.reduce((sum, v) => sum + (v.active_jobs_count || 0), 0);
  const avgLeadTime = vendors.length > 0 
    ? (vendors.reduce((sum, v) => sum + (v.default_lead_time_days || 0), 0) / vendors.length).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      
      {/* Compact Top Header */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <h2 className="text-sm font-bold text-white tracking-wide">Vendor Directory</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Vendor</span>
          </button>

          <button
            onClick={loadVendors}
            disabled={loading}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            title="Refresh Vendors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards & Logistics Filter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div 
          onClick={() => setTypeFilter('ALL')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            typeFilter === 'ALL' ? 'bg-slate-900 border-cyan-500 shadow-md shadow-cyan-950/40' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">All Vendors</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1">{vendors.length}</div>
        </div>

        <div 
          onClick={() => setTypeFilter('TRIP')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            typeFilter === 'TRIP' ? 'bg-amber-950/60 border-amber-500 shadow-md shadow-amber-950/50' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-amber-300 font-medium flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              <span>Trip Vendors</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50">
              Trip Plan
            </span>
          </div>
          <div className="text-xl font-bold text-amber-300 mt-1">{tripCount}</div>
        </div>

        <div 
          onClick={() => setTypeFilter('LOCAL')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            typeFilter === 'LOCAL' ? 'bg-cyan-950/60 border-cyan-500 shadow-md shadow-cyan-950/50' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-cyan-300 font-medium flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Local Vendors</span>
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-700/50">
              Local Plan
            </span>
          </div>
          <div className="text-xl font-bold text-cyan-300 mt-1">{localCount}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Active Jobs</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-indigo-400 mt-1">{totalActiveJobs}</div>
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-red-950/80 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by vendor name, code, process or contact..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900 text-white rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 placeholder-slate-500"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              typeFilter === 'ALL' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({vendors.length})
          </button>
          <button
            onClick={() => setTypeFilter('TRIP')}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
              typeFilter === 'TRIP' ? 'bg-amber-600 text-white shadow-sm' : 'text-amber-400 hover:bg-amber-950/50'
            }`}
          >
            <Truck className="w-3 h-3" />
            <span>Trip ({tripCount})</span>
          </button>
          <button
            onClick={() => setTypeFilter('LOCAL')}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
              typeFilter === 'LOCAL' ? 'bg-cyan-600 text-white shadow-sm' : 'text-cyan-400 hover:bg-cyan-950/50'
            }`}
          >
            <Building2 className="w-3 h-3" />
            <span>Local ({localCount})</span>
          </button>
        </div>
      </div>

      {/* Grid of Vendor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-16 text-slate-400 flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading Subcontract Vendors...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-3 text-center py-16 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800/60">
            <p className="text-sm font-medium text-slate-400">No vendors found matching "{searchTerm}"</p>
            <button
              onClick={handleOpenAdd}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add This Vendor Now</span>
            </button>
          </div>
        ) : (
          filtered.map(v => (
            <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 hover:border-slate-700 transition-all flex flex-col justify-between">
              
              <div className="space-y-3">
                {/* Header: Code, Name, Rating & Trip/Local Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/60 uppercase">
                        {v.code}
                      </span>
                      {/* Trip / Local Quick Toggle Pill */}
                      <button
                        type="button"
                        onClick={() => handleToggleType(v)}
                        disabled={togglingId === v.id}
                        title={`Click to switch to ${v.vendor_type === 'Trip' ? 'Local' : 'Trip'} vendor`}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase transition-all flex items-center gap-1 cursor-pointer border ${
                          v.vendor_type === 'Trip'
                            ? 'bg-amber-950/90 text-amber-300 border-amber-600/80 hover:bg-amber-900'
                            : 'bg-cyan-950/90 text-cyan-300 border-cyan-700/80 hover:bg-cyan-900'
                        }`}
                      >
                        {v.vendor_type === 'Trip' ? (
                          <Truck className="w-3 h-3 text-amber-400" />
                        ) : (
                          <Building2 className="w-3 h-3 text-cyan-400" />
                        )}
                        <span>{v.vendor_type === 'Trip' ? 'Trip Vendor' : 'Local Vendor'}</span>
                        <span className="text-[9px] opacity-60 underline ml-0.5">Toggle</span>
                      </button>
                    </div>
                    <h3 className="text-sm font-bold text-white mt-1 line-clamp-1" title={v.name}>{v.name}</h3>
                  </div>

                  <div className="flex items-center gap-1 text-amber-400 text-xs font-bold bg-amber-950/60 px-2 py-1 rounded border border-amber-800/40 shrink-0">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{v.rating}</span>
                  </div>
                </div>

                {/* Processes Offered */}
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                    Capabilities & Processes:
                  </span>
                  <p className="text-xs font-medium text-cyan-300 line-clamp-2" title={v.processes_offered}>
                    {v.processes_offered}
                  </p>
                </div>

                {/* Lead Time & Active Batches */}
                <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-800 pt-3">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Lead: <strong className="text-white font-mono">{v.default_lead_time_days}d</strong></span>
                  </div>

                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      v.active_jobs_count > 0 
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        : 'bg-slate-950 text-slate-500'
                    }`}>
                      {v.active_jobs_count} Active Orders
                    </span>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800 pt-3">
                  {v.contact_person && (
                    <div className="text-white font-medium flex items-center gap-1.5">
                      <span className="text-slate-500 text-[11px]">Contact:</span>
                      <span className="truncate">{v.contact_person}</span>
                    </div>
                  )}
                  {v.phone && (
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <PhoneCall className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{v.phone}</span>
                    </div>
                  )}
                  {v.email && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{v.email}</span>
                    </div>
                  )}
                  {v.address && (
                    <div className="flex items-start gap-1.5 text-[11px] text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-1" title={v.address}>{v.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="border-t border-slate-800 pt-3 mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(v)}
                  className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>

                <button
                  type="button"
                  disabled={deletingId === v.id || v.active_jobs_count > 0}
                  onClick={() => handleDeleteVendor(v)}
                  className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${
                    v.active_jobs_count > 0
                      ? 'text-slate-600 cursor-not-allowed'
                      : 'text-slate-500 hover:text-red-400'
                  }`}
                  title={v.active_jobs_count > 0 ? "Cannot delete vendor with active orders" : "Delete vendor"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletingId === v.id ? 'Deleting...' : 'Delete'}</span>
                </button>
              </div>

            </div>
          ))
        )}
      </div>

      {/* Add / Edit Vendor Modal */}
      {vendorModalOpen && (
        <AddVendorModal
          vendorToEdit={vendorToEdit}
          onClose={() => {
            setVendorModalOpen(false);
            setVendorToEdit(null);
          }}
          onSuccess={() => {
            loadVendors();
          }}
        />
      )}

    </div>
  );
}
