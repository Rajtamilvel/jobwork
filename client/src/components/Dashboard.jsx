import React, { useState } from 'react';
import { 
  AlertTriangle, CheckCircle2, Clock, Truck, ShieldAlert, 
  Search, ArrowRight, ArrowUpRight, Flame, Layers, PhoneCall, 
  FileText, Check, ChevronRight, User, Package, Eye, RotateCcw, PackageCheck
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
  const vendorLoads = data?.vendor_loads || [];

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
      
      {/* 1. KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Active Batches</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">{metrics.total_active_batches ?? 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            {metrics.batches_inhouse ?? 0} In-House • {metrics.batches_with_vendors ?? 0} at Vendors
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">With Vendors</span>
            <Truck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-300">{metrics.batches_with_vendors ?? 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Subcontract processes</p>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border transition-all ${
          metrics.critical_batches_count > 0 
            ? 'bg-red-950/40 border-red-500/60 pulse-critical' 
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-red-400 font-semibold">Critical Orders</span>
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400">{metrics.critical_batches_count ?? 0}</div>
          <p className="text-[11px] text-red-300/80 mt-1">High-priority dispatch</p>
        </div>

        <div className={`rounded-xl p-4 shadow-sm border transition-all ${
          metrics.overdue_count > 0 
            ? 'bg-amber-950/40 border-amber-500/60' 
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-amber-400 font-semibold">Vendor Overdue</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{metrics.overdue_count ?? 0}</div>
          <p className="text-[11px] text-amber-300/80 mt-1">Passed lead time SLA</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">In-House Shop</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-300">{metrics.batches_inhouse ?? 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">CNC, VMC & Inspection</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total WIP Units</span>
            <Package className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-300">{metrics.total_pieces_in_progress ?? 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Total pieces in transit/process</p>
        </div>
      </div>

      {/* 2. Urgent Vendor Delivery Follow-up Banner */}
      {urgentFollowups.length > 0 && (
        <div className="bg-gradient-to-r from-red-950/80 via-amber-950/70 to-slate-900 border border-red-500/40 rounded-xl p-4 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-500/20 text-red-400 rounded-lg shrink-0 mt-0.5">
                <PhoneCall className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  Vendor Material Delivery Follow-up Required ({urgentFollowups.length} Items)
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Raw material or semi-finished items sent to vendors require urgent follow-up for delivery tracking.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {urgentFollowups.slice(0, 3).map(u => (
                    <div 
                      key={u.id} 
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/40 border border-red-500/30 text-xs text-slate-200"
                    >
                      <span className="font-mono font-bold text-cyan-300">{u.item_code}</span>
                      <span className="text-slate-400">@ {u.current_process}</span>
                      <span className="text-amber-300">({u.vendor_name})</span>
                      <span className="text-red-400 font-semibold">{u.lead_status?.badge}</span>
                      <button
                        onClick={() => onOpenFollowup(u)}
                        className="ml-1 text-cyan-400 hover:text-cyan-300 font-medium underline text-[11px]"
                      >
                        Follow-up Now
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Filter Bar & Quick Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Item (CM001), Vendor, Process..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 text-white rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 placeholder-slate-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: `All (${batches.length})` },
            { id: 'critical', label: `Critical (${metrics.critical_batches_count || 0})`, color: 'text-red-400' },
            { id: 'vendors', label: `With Vendors (${metrics.batches_with_vendors || 0})` },
            { id: 'overdue', label: `Overdue (${metrics.overdue_count || 0})`, color: 'text-amber-400' },
            { id: 'welding', label: `Welding Assemblies` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium whitespace-nowrap transition-colors ${
                filterType === tab.id
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              } ${tab.color || ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Main Item & Process Tracking Matrix Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Item & Multi-Vendor Process Matrix</span>
              <span className="text-xs text-slate-400 font-normal">
                (Item Code constant from Raw Material to Finished Product)
              </span>
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Showing {filteredBatches.length} of {activeBatches.length} in-process orders
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold text-[11px]">
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
            <tbody className="divide-y divide-slate-800">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500">
                    No matching batches found. Try clearing your search or filter.
                  </td>
                </tr>
              ) : (
                filteredBatches.map(b => {
                  const isFinished = b.status === 'Completed' || b.current_process?.trim().toLowerCase() === 'finished product';
                  return (
                  <tr 
                    key={b.id} 
                    className={`hover:bg-slate-800/50 transition-colors ${
                      b.is_critical ? 'bg-red-950/15' : ''
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
                                className="font-mono text-sm font-bold text-cyan-400 bg-cyan-950/60 hover:bg-cyan-900/80 hover:text-cyan-200 px-2 py-0.5 rounded border border-cyan-800/60 transition-colors cursor-pointer"
                                title="View stage stocks & pipeline for this item"
                              >
                                {b.item_code}
                              </button>
                            ) : (
                              <span className="font-mono text-sm font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                                {b.item_code}
                              </span>
                            )}
                            {b.is_welding_stage && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-600/40 text-[10px] font-semibold flex items-center gap-1" title="Welded assembly requiring multiple items">
                                <Flame className="w-3 h-3 text-amber-400" />
                                WELD ASSY
                              </span>
                            )}
                          </div>
                          <div className="text-white font-medium mt-1 truncate max-w-[200px]" title={b.item_name}>
                            {b.item_name}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>Dwg: <code className="text-slate-300">{b.drawing_no || 'N/A'}</code></span>
                            <span>•</span>
                            <span className="font-mono text-slate-400">{b.batch_no}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Raw Material Link (Separate code, weight/length) */}
                    <td className="py-3 px-4">
                      {b.raw_material_code ? (
                        <div>
                          <div className="font-mono text-[11px] text-amber-300 font-semibold flex items-center gap-1">
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
                        <span className="text-slate-500 italic">No RM linked</span>
                      )}
                    </td>

                    {/* Current Process & Stage */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white text-xs bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                            {b.current_process}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Stage {b.current_stage_sequence}/{b.total_stages}
                          </span>
                        </div>
                        
                        {/* Progress bar */}
                        <div className="w-32 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-cyan-500 h-full rounded-full transition-all"
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
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-medium">
                          <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Finished Goods Store</span>
                        </div>
                      ) : b.is_inhouse ? (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-950/60 text-blue-300 border border-blue-800/60 font-medium">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
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
                            <div className="text-[10px] font-mono text-cyan-400 mt-0.5">
                              DC: {b.challan_no}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="py-3 px-3 text-right">
                      <div className="font-mono text-sm font-bold text-white">
                        {b.quantity_accepted} <span className="text-[11px] font-normal text-slate-400">pcs</span>
                      </div>
                      {b.quantity_rejected > 0 && (
                        <div className="text-[11px] font-mono text-red-400">
                          Scrap: {b.quantity_rejected} pcs
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500">
                        Total: {b.quantity_total}
                      </div>
                    </td>

                    {/* Lead Time & Delivery */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          b.lead_status?.color === 'red' 
                            ? 'bg-red-950 text-red-300 border border-red-600/50 pulse-critical'
                            : b.lead_status?.color === 'amber'
                            ? 'bg-amber-950 text-amber-300 border border-amber-600/50'
                            : 'bg-cyan-950 text-cyan-300 border border-cyan-700/50'
                        }`}>
                          {b.lead_status?.badge}
                        </span>
                        
                        <div className="text-[11px] text-slate-400">
                          Due: <span className="text-slate-200">{b.expected_delivery_date || 'N/A'}</span>
                        </div>
                        {b.date_sent_to_vendor && (
                          <div className="text-[10px] text-slate-500">
                            Sent: {b.date_sent_to_vendor}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Critical Urgency Toggle */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => onToggleCritical(b.id)}
                        className={`p-1.5 rounded-lg border transition-all ${
                          b.is_critical
                            ? 'bg-red-900/60 border-red-500 text-red-300 shadow-md shadow-red-900/30'
                            : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                        title={b.is_critical ? "Marked as CRITICAL (Click to toggle)" : "Click to mark as CRITICAL"}
                      >
                        <ShieldAlert className={`w-4 h-4 ${b.is_critical ? 'text-red-400 beacon-dot' : ''}`} />
                      </button>
                      <div className="text-[10px] mt-0.5 font-semibold">
                        {b.is_critical ? (
                          <span className="text-red-400 font-bold">YES</span>
                        ) : (
                          <span className="text-slate-600">NO</span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onViewRoute(b)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1"
                          title="View complete route stepper from Raw Material to Finished Item"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Route</span>
                        </button>

                        {isFinished ? (
                          <button
                            onClick={() => onRework && onRework(b)}
                            className="px-2 py-1 rounded bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-medium shadow-sm transition-colors flex items-center gap-1"
                            title="Send finished batch back to a process stage for rework"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Rework</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onAdvanceStage(b)}
                            className="px-2 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-medium shadow-sm transition-colors flex items-center gap-1"
                            title="Advance batch to next process stage (Receive & Dispatch)"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>Next</span>
                          </button>
                        )}

                        {!b.is_inhouse && !isFinished && (
                          <button
                            onClick={() => onOpenFollowup(b)}
                            className="p-1 rounded bg-slate-800 hover:bg-amber-950 hover:text-amber-300 text-slate-400 border border-slate-700 transition-colors"
                            title="Log Vendor Follow-up Call / WhatsApp message"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {b.challan_no && (
                          <button
                            onClick={() => onViewChallan(b.challan_no)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                            title="View / Print Outward Delivery Challan"
                          >
                            <FileText className="w-3.5 h-3.5" />
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

      {/* 5. Subcontract Vendor Shopfloor Load Distribution */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Truck className="w-4 h-4 text-cyan-400" />
          <span>Vendor Workshop Capacity & Material Holdings</span>
          <span className="text-xs text-slate-400 font-normal">
            (Track materials currently lying at external vendor premises)
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {vendorLoads.map(v => (
            <div 
              key={v.id} 
              className={`p-3.5 rounded-lg border transition-all ${
                v.active_batches > 0 
                  ? 'bg-slate-950 border-slate-700' 
                  : 'bg-slate-950/40 border-slate-900 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white truncate max-w-[180px]">{v.name}</h4>
                  <p className="text-[11px] text-cyan-400 mt-0.5">{v.processes_offered}</p>
                </div>
                {v.active_batches > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-bold">
                    {v.active_batches} Batches
                  </span>
                )}
              </div>
              
              <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-800 pt-2 text-slate-400">
                <span>Material with Vendor:</span>
                <span className="font-mono font-bold text-white">{v.total_quantity} pcs</span>
              </div>
              {v.phone && (
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <PhoneCall className="w-3 h-3 text-slate-500" />
                  <span>{v.phone}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
