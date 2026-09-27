import React, { useState, useEffect } from 'react';
import { 
  Truck, Search, PhoneCall, CheckCircle2, ShieldAlert, 
  AlertTriangle, Clock, FileText, ArrowRight, RefreshCw, Package,
  Building2, UserPlus
} from 'lucide-react';
import { fetchVendorStocks } from '../api';

export default function VendorStocksView({ 
  onOpenFollowup, 
  onAdvanceStage, 
  onViewChallan, 
  onOpenBulkDispatch,
  onOpenAddVendor,
  onNavigateToVendors
}) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL', 'TRIP', 'LOCAL'

  useEffect(() => {
    loadStocks();
  }, []);

  async function loadStocks() {
    try {
      setLoading(true);
      const data = await fetchVendorStocks();
      setVendors(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate totals
  const totalPieces = vendors.reduce((acc, v) => acc + (v.total_quantity || 0), 0);
  const totalActiveItems = vendors.reduce((acc, v) => acc + (v.items_count || 0), 0);
  const vendorsWithStock = vendors.filter(v => v.items_count > 0);

  // Filter vendors based on search and type
  const filteredVendors = vendors.filter(v => {
    if (typeFilter === 'TRIP' && v.vendor_type !== 'Trip') return false;
    if (typeFilter === 'LOCAL' && (v.vendor_type || 'Local') !== 'Local') return false;

    const term = (searchTerm || '').toLowerCase();
    const vendorMatch = (v.vendor_name || '').toLowerCase().includes(term) || (v.processes_offered || '').toLowerCase().includes(term) || (v.vendor_code || '').toLowerCase().includes(term);
    const itemMatch = v.items?.some(it => 
      (it.item_code || '').toLowerCase().includes(term) || (it.item_name || '').toLowerCase().includes(term) || (it.batch_no || '').toLowerCase().includes(term)
    );
    return vendorMatch || itemMatch;
  });

  return (
    <div className="space-y-6">
      
      {/* Compact Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-indigo-400 shrink-0" />
          <h2 className="text-sm font-bold text-white tracking-wide">Vendor Stocks & Holdings</h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenAddVendor}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 text-xs font-semibold border border-slate-800 hover:border-cyan-700/60 transition-all cursor-pointer shadow-sm"
            title="Register new Subcontract Vendor"
          >
            <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Add Vendor</span>
          </button>

          <button
            onClick={onNavigateToVendors}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-slate-800 transition-all cursor-pointer"
            title="Open Vendor Directory"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Vendors Directory</span>
          </button>

          <button
            onClick={onOpenBulkDispatch}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Send to Vendor</span>
          </button>

          <button
            onClick={loadStocks}
            disabled={loading}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            title="Refresh Vendor Stocks"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 uppercase font-semibold">Total Stock Across All Vendors</span>
          <div className="text-2xl font-black text-indigo-300 mt-1">{totalPieces} <span className="text-xs font-normal text-slate-400">pcs</span></div>
          <p className="text-[11px] text-slate-500 mt-1">{totalActiveItems} batches currently being subcontracted</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 uppercase font-semibold">Vendors Currently Holding Material</span>
          <div className="text-2xl font-black text-white mt-1">{vendorsWithStock.length} / {vendors.length}</div>
          <p className="text-[11px] text-slate-500 mt-1">Active subcontractor workshops</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-red-400 uppercase font-bold">Vendors with Overdue Deliveries</span>
          <div className="text-2xl font-black text-red-400 mt-1">
            {vendors.filter(v => v.overdue_count > 0).length}
          </div>
          <p className="text-[11px] text-red-300/80 mt-1">Requires urgent delivery follow-up</p>
        </div>
      </div>

      {/* Search & Logistics Type Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by Item Code (CM001), Item Name, or Vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900 text-white rounded-lg border border-slate-800 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
              typeFilter === 'ALL' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Vendors
          </button>
          <button
            onClick={() => setTypeFilter('TRIP')}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
              typeFilter === 'TRIP' ? 'bg-amber-600 text-white shadow-sm' : 'text-amber-400 hover:bg-amber-950/50'
            }`}
          >
            <Truck className="w-3 h-3" />
            <span>Trip Vendors</span>
          </button>
          <button
            onClick={() => setTypeFilter('LOCAL')}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
              typeFilter === 'LOCAL' ? 'bg-cyan-600 text-white shadow-sm' : 'text-cyan-400 hover:bg-cyan-950/50'
            }`}
          >
            <Building2 className="w-3 h-3" />
            <span>Local Vendors</span>
          </button>
        </div>
      </div>

      {/* Vendor Stock Cards */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading vendor stock inventory...</div>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-slate-900 rounded-xl border border-slate-800">
            No vendors match your search.
          </div>
        ) : (
          filteredVendors.map(vendor => (
            <div 
              key={vendor.vendor_id}
              className={`bg-slate-900 border rounded-2xl overflow-hidden shadow-sm transition-all ${
                vendor.overdue_count > 0 
                  ? 'border-red-500/50' 
                  : vendor.items_count > 0 
                  ? 'border-slate-800' 
                  : 'border-slate-900 opacity-60'
              }`}
            >
              
              {/* Vendor Header */}
              <div className="p-4 sm:px-6 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                      {vendor.vendor_code}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      vendor.vendor_type === 'Trip'
                        ? 'bg-amber-950/80 text-amber-300 border-amber-600'
                        : 'bg-cyan-950/80 text-cyan-300 border-cyan-700'
                    }`}>
                      {vendor.vendor_type === 'Trip' ? '🚚 Trip Vendor' : '🛵 Local Vendor'}
                    </span>
                    <h3 className="text-base font-bold text-white">{vendor.vendor_name}</h3>
                    {vendor.overdue_count > 0 && (
                      <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-600 text-[10px] font-bold">
                        {vendor.overdue_count} OVERDUE
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>Capabilities: <strong className="text-cyan-300">{vendor.processes_offered}</strong></span>
                    {vendor.contact_person && (
                      <span>Contact: <strong className="text-white">{vendor.contact_person}</strong> ({vendor.phone})</span>
                    )}
                    <span>Lead Time: <strong className="text-white font-mono">{vendor.default_lead_time_days} Days</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-slate-500 block">Total Stock Held:</span>
                    <span className="text-lg font-mono font-black text-white">{vendor.total_quantity} <span className="text-xs font-normal text-slate-400">pcs</span></span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-200 text-xs font-bold border border-slate-700">
                    {vendor.items_count} Items
                  </span>
                </div>
              </div>

              {/* Items Sitting with this Vendor */}
              <div className="p-0">
                {vendor.items_count === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 italic">
                    No material currently sitting with this vendor.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-950/60 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
                          <th className="py-2.5 px-5">Item Code</th>
                          <th className="py-2.5 px-4">Item Name & Drawing</th>
                          <th className="py-2.5 px-4">Process in Work</th>
                          <th className="py-2.5 px-4 text-right">Quantity Held</th>
                          <th className="py-2.5 px-4">Sent Date</th>
                          <th className="py-2.5 px-4">Committed Due Date</th>
                          <th className="py-2.5 px-4">SLA Status</th>
                          <th className="py-2.5 px-3 text-center">Critical</th>
                          <th className="py-2.5 px-5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {vendor.items.map(item => (
                          <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                            {/* Item Code (Prominently styled) */}
                            <td className="py-3 px-5">
                              <span className="font-mono text-sm font-black text-cyan-400 bg-cyan-950/90 px-2.5 py-1 rounded border border-cyan-700 shadow-sm inline-block">
                                {item.item_code}
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{item.batch_no}</div>
                            </td>

                            {/* Item Name & RM / Weight */}
                            <td className="py-3 px-4">
                              <div className="font-bold text-white text-xs">{item.item_name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {item.material_code && (
                                  <span className="font-mono text-[10px] text-amber-300 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-800/60">
                                    {item.material_code}
                                  </span>
                                )}
                                {item.weight > 0 && (
                                  <span className="font-mono text-[10px] text-cyan-300 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/60">
                                    {item.weight} kg
                                  </span>
                                )}
                                {item.raw_material_name && (
                                  <span className="text-[10px] text-slate-400 truncate max-w-[150px]" title={item.raw_material_name}>
                                    {item.raw_material_name}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Process in Work */}
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-white font-semibold text-xs border border-slate-700">
                                {item.current_process}
                              </span>
                              {item.challan_no && (
                                <div className="text-[10px] font-mono text-indigo-300 mt-1">DC: {item.challan_no}</div>
                              )}
                            </td>

                            {/* Quantity */}
                            <td className="py-3 px-4 text-right">
                              <span className="font-mono text-sm font-bold text-white">{item.quantity}</span>
                              <span className="text-[11px] text-slate-400 ml-1">pcs</span>
                            </td>

                            {/* Sent Date */}
                            <td className="py-3 px-4 font-mono text-slate-400 text-xs">
                              {item.date_sent || 'N/A'}
                            </td>

                            {/* Committed Due Date */}
                            <td className="py-3 px-4 font-mono text-slate-200 text-xs font-medium">
                              {item.expected_delivery_date || 'N/A'}
                            </td>

                            {/* SLA Status */}
                            <td className="py-3 px-4">
                              <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold ${
                                item.lead_status?.color === 'red'
                                  ? 'bg-red-950 text-red-300 border border-red-600 pulse-critical'
                                  : item.lead_status?.color === 'amber'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-600'
                                  : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                              }`}>
                                {item.lead_status?.badge}
                              </span>
                            </td>

                            {/* Critical Indicator */}
                            <td className="py-3 px-3 text-center">
                              {item.is_critical ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-600 text-[10px] font-bold">
                                  <ShieldAlert className="w-3 h-3 text-red-400" />
                                  <span>YES</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-600">No</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => onOpenFollowup({
                                    ...item,
                                    current_vendor_id: vendor.vendor_id,
                                    vendor_name: vendor.vendor_name,
                                    vendor_contact: vendor.contact_person
                                  })}
                                  className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm"
                                  title="Log Phone Call / WhatsApp follow-up"
                                >
                                  <PhoneCall className="w-3 h-3" />
                                  <span>Call</span>
                                </button>

                                <button
                                  onClick={() => onAdvanceStage(item)}
                                  className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm"
                                  title="Receive material & advance to next stage"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Receive</span>
                                </button>

                                {item.challan_no && (
                                  <button
                                    onClick={() => onViewChallan(item.challan_no)}
                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                                    title="View Delivery Challan"
                                  >
                                    <FileText className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
}
