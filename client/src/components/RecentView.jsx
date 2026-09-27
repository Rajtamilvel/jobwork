import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, Printer, Truck, ArrowUpRight, 
  Calendar, CheckCircle, Package, PackageCheck, RotateCcw,
  Clock, Eye, Boxes, ArrowRight, ShieldCheck
} from 'lucide-react';
import { fetchChallans, fetchRecentFinishedGoods } from '../api';

export default function RecentView({ onSelectChallan, onViewRoute, onRework }) {
  const [activeSubTab, setActiveSubTab] = useState('finished_goods'); // 'finished_goods' | 'challans'
  
  // Finished Goods state
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [loadingFG, setLoadingFG] = useState(true);
  const [searchFG, setSearchFG] = useState('');

  // Challans state
  const [challans, setChallans] = useState([]);
  const [loadingChallans, setLoadingChallans] = useState(true);
  const [searchChallans, setSearchChallans] = useState('');
  const [challanFilter, setChallanFilter] = useState('all');

  useEffect(() => {
    loadFinishedGoods();
    loadChallans();
  }, []);

  async function loadFinishedGoods() {
    try {
      setLoadingFG(true);
      const data = await fetchRecentFinishedGoods();
      setFinishedGoods(data || []);
    } catch (err) {
      console.error('Error fetching recent finished goods:', err);
    } finally {
      setLoadingFG(false);
    }
  }

  async function loadChallans() {
    try {
      setLoadingChallans(true);
      const data = await fetchChallans();
      setChallans(data || []);
    } catch (err) {
      console.error('Error fetching challans:', err);
    } finally {
      setLoadingChallans(false);
    }
  }

  // Filter finished goods
  const filteredFG = finishedGoods.filter(item => {
    const term = searchFG.toLowerCase();
    return (
      item.item_code?.toLowerCase().includes(term) ||
      item.item_name?.toLowerCase().includes(term) ||
      item.batch_no?.toLowerCase().includes(term) ||
      item.drawing_no?.toLowerCase().includes(term) ||
      item.raw_material_code?.toLowerCase().includes(term)
    );
  });

  // Filter challans
  const filteredChallans = challans.filter(c => {
    const term = searchChallans.toLowerCase();
    const match = 
      c.challan_no?.toLowerCase().includes(term) ||
      c.item_code?.toLowerCase().includes(term) ||
      c.vendor_name?.toLowerCase().includes(term) ||
      c.process_name?.toLowerCase().includes(term);

    if (!match) return false;
    if (challanFilter === 'outward') return c.challan_type?.includes('Outward');
    if (challanFilter === 'return') return c.challan_type?.includes('Return');
    return true;
  });

  const totalFinishedPcs = finishedGoods.reduce((acc, curr) => acc + (curr.quantity_accepted || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Top Header & Sub-Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-wide">Recent Activity & Inward Store</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit log of completed finished products received in store and outward/inward delivery challans
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('finished_goods')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'finished_goods'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>Recently Received Finished Goods</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeSubTab === 'finished_goods' ? 'bg-emerald-800 text-white' : 'bg-slate-800 text-slate-300'
            }`}>
              {finishedGoods.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('challans')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'challans'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Delivery Challans</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeSubTab === 'challans' ? 'bg-cyan-800 text-white' : 'bg-slate-800 text-slate-300'
            }`}>
              {challans.length}
            </span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. RECENTLY RECEIVED FINISHED GOODS VIEW                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'finished_goods' && (
        <div className="space-y-4">
          
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Total Finished Stock Received
                </div>
                <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                  {totalFinishedPcs} <span className="text-xs font-normal text-slate-400">pcs</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <PackageCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Completed Batches
                </div>
                <div className="text-2xl font-black font-mono text-white mt-1">
                  {finishedGoods.length} <span className="text-xs font-normal text-slate-400">batches</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Storage Destination
                </div>
                <div className="text-sm font-bold text-slate-200 mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Finished Goods Store (FG)
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Ready for Production & Dispatch
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Boxes className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Item Code, Batch No, Drawing, RM..."
                value={searchFG}
                onChange={(e) => setSearchFG(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 text-white rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500 placeholder-slate-500"
              />
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Showing {filteredFG.length} of {finishedGoods.length} finished batches
            </span>
          </div>

          {/* Finished Goods Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold text-[11px]">
                    <th className="py-3 px-4">Item Code & Details</th>
                    <th className="py-3 px-4">Raw Material Link</th>
                    <th className="py-3 px-4 text-right">Finished Quantity</th>
                    <th className="py-3 px-4">Completion Date</th>
                    <th className="py-3 px-4">Route Progression</th>
                    <th className="py-3 px-4 text-center">Store Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {loadingFG ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-500">
                        Loading recently received finished goods...
                      </td>
                    </tr>
                  ) : filteredFG.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-500">
                        No finished product batches found.
                      </td>
                    </tr>
                  ) : (
                    filteredFG.map(b => (
                      <tr key={b.id} className="hover:bg-slate-800/50 transition-colors">
                        
                        {/* Item Code & Details */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                              {b.item_code}
                            </span>
                          </div>
                          <div className="text-white font-medium mt-1 truncate max-w-[220px]" title={b.item_name}>
                            {b.item_name}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>Dwg: <code className="text-slate-300">{b.drawing_no || 'N/A'}</code></span>
                            <span>•</span>
                            <span className="font-mono text-slate-400">{b.batch_no}</span>
                          </div>
                        </td>

                        {/* Raw Material Link */}
                        <td className="py-3 px-4">
                          {b.raw_material_code ? (
                            <div>
                              <div className="font-mono text-[11px] text-amber-300 font-semibold">
                                {b.raw_material_code}
                              </div>
                              <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                                {b.raw_material_quantity} {b.raw_material_unit || 'kg'} issued
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">No RM linked</span>
                          )}
                        </td>

                        {/* Finished Quantity */}
                        <td className="py-3 px-4 text-right">
                          <div className="font-mono text-sm font-black text-emerald-400">
                            {b.quantity_accepted} <span className="text-xs font-normal text-slate-400">pcs</span>
                          </div>
                          {b.quantity_rejected > 0 && (
                            <div className="text-[10px] font-mono text-red-400">
                              Scrap: {b.quantity_rejected} pcs
                            </div>
                          )}
                          <div className="text-[10px] text-slate-500">
                            Orig Batch: {b.quantity_total}
                          </div>
                        </td>

                        {/* Completion Date */}
                        <td className="py-3 px-4">
                          <div className="text-slate-200 font-medium flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{b.date_finished || b.expected_delivery_date || 'Completed'}</span>
                          </div>
                          {b.date_started && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Started: {b.date_started}
                            </div>
                          )}
                        </td>

                        {/* Route Progression */}
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/60">
                              <CheckCircle className="w-3 h-3 text-emerald-400" />
                              <span>Completed ({b.total_stages}/{b.total_stages} Stages)</span>
                            </span>
                            <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                              {b.route_name}
                            </div>
                          </div>
                        </td>

                        {/* Store Status */}
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-medium">
                            <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Finished Goods Store</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {onViewRoute && (
                              <button
                                onClick={() => onViewRoute(b)}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1"
                                title="View batch manufacturing timeline & route history"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Route</span>
                              </button>
                            )}

                            {onRework && (
                              <button
                                onClick={() => onRework(b)}
                                className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium shadow-sm transition-colors flex items-center gap-1"
                                title="Send finished batch back to a process stage for rework"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Rework</span>
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. DELIVERY CHALLANS REGISTER VIEW                            */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'challans' && (
        <div className="space-y-4">
          
          {/* Filter & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Challan No, Item Code, Vendor..."
                value={searchChallans}
                onChange={(e) => setSearchChallans(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 text-white rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 placeholder-slate-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {['all', 'outward', 'return'].map(f => (
                <button
                  key={f}
                  onClick={() => setChallanFilter(f)}
                  className={`px-3 py-1 text-xs rounded-lg font-medium capitalize transition-colors cursor-pointer ${
                    challanFilter === f
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {f === 'all' ? 'All Challans' : f}
                </button>
              ))}
            </div>
          </div>

          {/* Challan Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold text-[11px]">
                    <th className="py-3 px-4">Challan No & Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Vendor / Destination</th>
                    <th className="py-3 px-4">Item Code & Process</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4 text-right">Weight / Length</th>
                    <th className="py-3 px-4">Transporter & Vehicle</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {loadingChallans ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-500">Loading delivery challans...</td>
                    </tr>
                  ) : filteredChallans.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-500">No delivery challans found.</td>
                    </tr>
                  ) : (
                    filteredChallans.map(c => (
                      <tr key={c.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-cyan-400">
                            {c.challan_no}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span>{c.date}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
                            {c.challan_type}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-white font-medium flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-slate-400" />
                            <span>{c.vendor_name || 'Subcontractor'}</span>
                          </div>
                          {c.vendor_phone && (
                            <div className="text-[10px] text-slate-400 mt-0.5">{c.vendor_phone}</div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-white flex items-center gap-1">
                            <span>{c.item_code}</span>
                          </div>
                          <div className="text-[11px] text-cyan-300 mt-0.5">
                            Process: {c.process_name}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {c.quantity} pcs
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-amber-300">
                          {c.weight_or_length ? `${c.weight_or_length} ${c.unit || 'kg'}` : '-'}
                        </td>

                        <td className="py-3 px-4 text-slate-300">
                          <div>{c.transporter || 'Direct'}</div>
                          {c.vehicle_no && (
                            <div className="font-mono text-[10px] text-slate-500">{c.vehicle_no}</div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => onSelectChallan(c.challan_no)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-600 hover:text-white text-cyan-400 text-xs font-medium border border-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Print</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
