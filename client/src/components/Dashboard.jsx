import React, { useState } from 'react';
import { 
  AlertTriangle, CheckCircle2, Clock, Truck, ShieldAlert, 
  Search, ArrowRight, ArrowUpRight, Flame, Layers, PhoneCall, 
  FileText, Check, ChevronRight, User, Package, Eye, RotateCcw, PackageCheck,
  TrendingUp, Activity, Sparkles, Filter
} from 'lucide-react';

export default function Dashboard({ 
  data, 
  onToggleCritical, 
  onViewRoute, 
  onAdvanceStage, 
  onOpenFollowup, 
  onViewChallan,
  onOpenNewBatch,
  onOpenIssueRM,
  onViewItemStocks,
  onRework
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'critical', 'vendors', 'overdue', 'welding'

  const batches = data?.batches || [];
  const metrics = data?.metrics || {};

  // Exclude completed finished goods from active shopfloor dashboard
  const activeBatches = batches.filter(
    b => b.status !== 'Completed' && b.current_process?.trim().toLowerCase() !== 'finished product'
  );

  // Filter batches based on search and selected filter pill
  const filteredBatches = activeBatches.filter(b => {
    const term = searchTerm.toLowerCase();
    const matchSearch = 
      b.item_code?.toLowerCase().includes(term) ||
      b.item_name?.toLowerCase().includes(term) ||
      b.batch_no?.toLowerCase().includes(term) ||
      b.current_process?.toLowerCase().includes(term) ||
      b.vendor_name?.toLowerCase().includes(term) ||
      b.raw_material_code?.toLowerCase().includes(term);

    if (!matchSearch) return false;

    if (filterType === 'critical') return b.is_critical;
    if (filterType === 'vendors') return !b.is_inhouse && b.status !== 'Completed';
    if (filterType === 'overdue') return b.lead_status?.is_overdue;
    if (filterType === 'welding') return b.is_welding_stage;
    return true;
  });

  // Identify batches needing delivery follow-up (Overdue or Due within 2 days with vendor)
  const urgentFollowups = activeBatches.filter(
    b => !b.is_inhouse && b.status === 'With Vendor' && (b.lead_status?.is_overdue || (b.lead_status?.days_remaining !== null && b.lead_status?.days_remaining <= 1))
  );

  return (
    <div className="space-y-6">
      
      {/* 1. KPI Summary Cards (Double-Bezel Nested Architecture) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* Active Batches */}
        <div className="bezel-outer group">
          <div className="bezel-inner p-4 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Active Batches</span>
              <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-extrabold text-white font-mono tracking-tight">
                {metrics.total_active_batches ?? 0}
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">
                <span className="text-slate-300 font-mono">{metrics.batches_inhouse ?? 0}</span> in-house • <span className="text-cyan-300 font-mono">{metrics.batches_with_vendors ?? 0}</span> vendor
              </p>
            </div>
          </div>
        </div>

        {/* With Vendors */}
        <div className="bezel-outer group">
          <div className="bezel-inner p-4 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">With Vendors</span>
              <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Truck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-extrabold text-indigo-300 font-mono tracking-tight">
                {metrics.batches_with_vendors ?? 0}
              </div>
              <p className="text-[10px] text-indigo-400/80 mt-1 font-medium">Subcontract pipelines</p>
            </div>
          </div>
        </div>

        {/* Critical Orders */}
        <div className={`bezel-outer group ${
          metrics.critical_batches_count > 0 ? 'ring-1 ring-rose-500/40' : ''
        }`}>
          <div className={`bezel-inner p-4 h-full flex flex-col justify-between ${
            metrics.critical_batches_count > 0 ? 'bg-gradient-to-b from-rose-950/30 to-[#0f1526]' : ''
          }`}>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400">Critical Orders</span>
              <div className="w-6 h-6 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-extrabold text-rose-400 font-mono tracking-tight flex items-center gap-2">
                <span>{metrics.critical_batches_count ?? 0}</span>
                {metrics.critical_batches_count > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                )}
              </div>
              <p className="text-[10px] text-rose-300/80 mt-1 font-medium">High-priority dispatch</p>
            </div>
          </div>
        </div>

        {/* Vendor Overdue */}
        <div className={`bezel-outer group ${
          metrics.overdue_count > 0 ? 'ring-1 ring-amber-500/40' : ''
        }`}>
          <div className={`bezel-inner p-4 h-full flex flex-col justify-between ${
            metrics.overdue_count > 0 ? 'bg-gradient-to-b from-amber-950/30 to-[#0f1526]' : ''
          }`}>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">Vendor Overdue</span>
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-extrabold text-amber-400 font-mono tracking-tight">
                {metrics.overdue_count ?? 0}
              </div>
              <p className="text-[10px] text-amber-300/80 mt-1 font-medium">Passed lead time SLA</p>
            </div>
          </div>
        </div>

        {/* In-House Shop */}
        <div className="bezel-outer group">
          <div className="bezel-inner p-4 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">In-House Shop</span>
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-extrabold text-emerald-300 font-mono tracking-tight">
                {metrics.batches_inhouse ?? 0}
              </div>
              <p className="text-[10px] text-emerald-400/80 mt-1 font-medium">CNC, VMC & Inspection</p>
            </div>
          </div>
        </div>

        {/* Total WIP Units */}
        <div className="bezel-outer group">
          <div className="bezel-inner p-4 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Total WIP Units</span>
              <div className="w-6 h-6 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Package className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-extrabold text-teal-300 font-mono tracking-tight">
                {metrics.total_pieces_in_progress ?? 0}
              </div>
              <p className="text-[10px] text-teal-400/80 mt-1 font-medium">Units in active process</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Urgent Vendor Delivery Follow-up Banner */}
      {urgentFollowups.length > 0 && (
        <div className="bezel-outer">
          <div className="bezel-inner p-4 bg-gradient-to-r from-rose-950/40 via-amber-950/30 to-[#0d121f] border-rose-500/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                  <PhoneCall className="w-4 h-4 animate-bounce" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-white flex items-center gap-2 tracking-wide uppercase font-mono">
                    <span>Vendor Follow-up Priority Stream</span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px]">
                      {urgentFollowups.length} Items Due
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Subcontract components exceed or are within 24h of promised turnaround time. Follow up with vendor dispatch coordinator.
                  </p>
                  
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {urgentFollowups.slice(0, 3).map(u => (
                      <div 
                        key={u.id} 
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-black/40 border border-white/10 text-xs text-slate-200"
                      >
                        <span className="font-mono font-bold text-cyan-400">{u.item_code}</span>
                        <span className="text-slate-400">@ {u.current_process}</span>
                        <span className="text-amber-300 font-medium">({u.vendor_name})</span>
                        <span className="text-rose-400 font-mono text-[11px] font-bold">{u.lead_status?.badge}</span>
                        <button
                          onClick={() => onOpenFollowup(u)}
                          className="btn-machined ml-1 text-cyan-400 hover:text-cyan-300 font-semibold underline text-[11px] cursor-pointer"
                        >
                          Call Now
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Filter Bar & Quick Search */}
      <div className="bezel-outer">
        <div className="bezel-inner p-2.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Item (CM001), Vendor, Process, Batch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-black/30 text-white rounded-xl border border-white/[0.08] focus:outline-none focus:border-cyan-500/60 placeholder-slate-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
            {[
              { id: 'all', label: `All (${batches.length})` },
              { id: 'critical', label: `Critical (${metrics.critical_batches_count || 0})`, color: 'text-rose-400' },
              { id: 'vendors', label: `With Vendors (${metrics.batches_with_vendors || 0})` },
              { id: 'overdue', label: `Overdue (${metrics.overdue_count || 0})`, color: 'text-amber-400' },
              { id: 'welding', label: `Welding Assemblies` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`btn-machined px-3 py-1.5 text-xs rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filterType === tab.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/10'
                    : 'bg-black/20 text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-white/[0.05]'
                } ${tab.color || ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Main Item & Process Tracking Matrix Table (Double-Bezel Architecture) */}
      <div className="bezel-outer">
        <div className="bezel-inner overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.01]">
            <div>
              <h2 className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wider font-mono">
                <span>Process Matrix & Telemetry Stream</span>
                <span className="text-[11px] text-slate-400 font-normal font-sans lowercase">
                  (unbroken item code lifecycle)
                </span>
              </h2>
            </div>
            <span className="text-[11px] text-cyan-400/90 font-mono font-medium">
              Showing {filteredBatches.length} of {activeBatches.length} active orders
            </span>
          </div>

          <div className="overflow-x-auto custom-scrollbar-x">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-black/40 text-slate-400 border-b border-white/[0.06] uppercase tracking-wider font-semibold text-[10px] font-mono">
                  <th className="py-3 px-4">Item Code & Details</th>
                  <th className="py-3 px-4">Raw Material Link</th>
                  <th className="py-3 px-4">Current Process & Stage</th>
                  <th className="py-3 px-4">Vendor / Location</th>
                  <th className="py-3 px-3 text-right">Quantity</th>
                  <th className="py-3 px-4">Lead Time & Delivery</th>
                  <th className="py-3 px-3 text-center">Critical</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-500">
                      No matching batches found. Try clearing your search filter.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map(b => {
                    const isFinished = b.status === 'Completed' || b.current_process?.trim().toLowerCase() === 'finished product';
                    return (
                    <tr 
                      key={b.id} 
                      className={`hover:bg-white/[0.02] transition-colors ${
                        b.is_critical ? 'bg-rose-950/[0.12]' : ''
                      }`}
                    >
                      {/* Item Code & Details */}
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              {onViewItemStocks ? (
                                <button
                                  onClick={() => onViewItemStocks(b.item_code)}
                                  className="btn-machined font-mono text-xs font-bold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/80 px-2 py-0.5 rounded-lg border border-cyan-500/30 transition-all cursor-pointer shadow-sm"
                                  title="View stage stocks & pipeline for this item"
                                >
                                  {b.item_code}
                                </button>
                              ) : (
                                <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded-lg border border-cyan-500/30">
                                  {b.item_code}
                                </span>
                              )}
                              {b.is_welding_stage && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-500/40 text-[9px] font-mono font-bold flex items-center gap-1">
                                  <Flame className="w-3 h-3 text-amber-400" />
                                  WELD ASSY
                                </span>
                              )}
                            </div>
                            <div className="text-white font-medium mt-1 truncate max-w-[200px]" title={b.item_name}>
                              {b.item_name}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>Dwg: <code className="text-slate-300 font-mono">{b.drawing_no || 'N/A'}</code></span>
                              <span>•</span>
                              <span className="font-mono text-slate-400">{b.batch_no}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Raw Material Link */}
                      <td className="py-3 px-4">
                        {b.raw_material_code ? (
                          <div>
                            <div className="font-mono text-[11px] text-amber-300 font-bold flex items-center gap-1">
                              <span>{b.raw_material_code}</span>
                            </div>
                            <div className="text-slate-300 font-mono text-[11px] mt-0.5">
                              {b.raw_material_quantity} {b.raw_material_unit || 'kg'}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Issued for {b.quantity_total} pcs
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">No RM linked</span>
                        )}
                      </td>

                      {/* Current Process & Stage */}
                      <td className="py-3 px-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white text-xs bg-white/[0.04] px-2 py-0.5 rounded-lg border border-white/[0.08]">
                              {b.current_process}
                            </span>
                            <span className="text-[10px] font-mono text-cyan-400 font-semibold">
                              Stage {b.current_stage_sequence}/{b.total_stages}
                            </span>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="w-32 bg-black/40 rounded-full h-1.5 overflow-hidden border border-white/[0.05]">
                            <div 
                              className="bg-gradient-to-r from-cyan-500 to-teal-400 h-full rounded-full transition-all shadow-[0_0_8px_#22d3ee]"
                              style={{ width: `${(b.current_stage_sequence / b.total_stages) * 100}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                            {b.route_name}
                          </div>
                        </div>
                      </td>

                      {/* Vendor / Location */}
                      <td className="py-3 px-4">
                        {isFinished ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 font-medium">
                            <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Finished Goods Store</span>
                          </div>
                        ) : b.is_inhouse ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cyan-950/50 text-cyan-300 border border-cyan-500/30 font-medium">
                            <Clock className="w-3.5 h-3.5 text-cyan-400" />
                            <span>In-House Shop</span>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-white flex items-center gap-1">
                              <Truck className="w-3.5 h-3.5 text-indigo-400" />
                              <span>{b.vendor_name}</span>
                            </div>
                            {b.vendor_contact && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {b.vendor_contact} {b.vendor_phone ? `(${b.vendor_phone})` : ''}
                              </div>
                            )}
                            {b.challan_no && (
                              <div className="text-[10px] font-mono text-cyan-400 mt-0.5 font-bold">
                                DC: {b.challan_no}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-mono text-sm font-bold text-white">
                          {b.quantity_accepted} <span className="text-[10px] font-normal text-slate-400">pcs</span>
                        </div>
                        {b.quantity_rejected > 0 && (
                          <div className="text-[11px] font-mono text-rose-400 font-semibold">
                            Scrap: {b.quantity_rejected} pcs
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500 font-mono">
                          Total: {b.quantity_total}
                        </div>
                      </td>

                      {/* Lead Time & Delivery */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold ${
                            b.lead_status?.color === 'red' 
                              ? 'bg-rose-950/80 text-rose-300 border border-rose-500/40 pulse-critical'
                              : b.lead_status?.color === 'amber'
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                              : 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
                          }`}>
                            {b.lead_status?.badge}
                          </span>
                          
                          <div className="text-[11px] text-slate-400">
                            Due: <span className="text-slate-200 font-mono">{b.expected_delivery_date || 'N/A'}</span>
                          </div>
                          {b.date_sent_to_vendor && (
                            <div className="text-[10px] text-slate-500 font-mono">
                              Sent: {b.date_sent_to_vendor}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Critical Urgency Toggle */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => onToggleCritical(b.id)}
                          className={`btn-machined p-2 rounded-xl border transition-all cursor-pointer ${
                            b.is_critical
                              ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-md shadow-rose-900/30'
                              : 'bg-black/30 border-white/[0.08] text-slate-500 hover:text-slate-300'
                          }`}
                          title={b.is_critical ? "Marked as CRITICAL (Click to toggle)" : "Click to mark as CRITICAL"}
                        >
                          <ShieldAlert className={`w-4 h-4 ${b.is_critical ? 'text-rose-400 beacon-dot' : ''}`} />
                        </button>
                        <div className="text-[9px] mt-0.5 font-mono font-bold">
                          {b.is_critical ? (
                            <span className="text-rose-400">YES</span>
                          ) : (
                            <span className="text-slate-600">NO</span>
                          )}
                        </div>
                      </td>

                      {/* Actions (Machined Pill Buttons) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onViewRoute(b)}
                            className="btn-machined px-2.5 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-cyan-300 hover:text-white text-xs font-semibold border border-white/[0.08] transition-all flex items-center gap-1.5 cursor-pointer"
                            title="View complete route stepper from Raw Material to Finished Item"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Route</span>
                          </button>

                          {isFinished ? (
                            <button
                              onClick={() => onRework && onRework(b)}
                              className="btn-machined px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 hover:text-white text-xs font-semibold border border-amber-500/40 transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Send finished batch back to a process stage for rework"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Rework</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => onAdvanceStage(b)}
                              className="btn-machined px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-bold border border-cyan-400/40 transition-all flex items-center gap-1.5 shadow-md shadow-cyan-500/20 cursor-pointer"
                              title="Advance batch to next process stage (Receive & Dispatch)"
                            >
                              <span>Advance</span>
                              <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
