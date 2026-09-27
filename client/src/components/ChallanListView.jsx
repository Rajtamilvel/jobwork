import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, Printer, Truck, ArrowUpRight, 
  Calendar, CheckCircle, Package 
} from 'lucide-react';
import { fetchChallans } from '../api';

export default function ChallanListView({ onSelectChallan }) {
  const [challans, setChallans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    loadChallans();
  }, []);

  async function loadChallans() {
    try {
      setLoading(true);
      const data = await fetchChallans();
      setChallans(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = challans.filter(c => {
    const term = searchTerm.toLowerCase();
    const match = 
      c.challan_no?.toLowerCase().includes(term) ||
      c.item_code?.toLowerCase().includes(term) ||
      c.vendor_name?.toLowerCase().includes(term) ||
      c.process_name?.toLowerCase().includes(term);

    if (!match) return false;
    if (filterType === 'outward') return c.challan_type?.includes('Outward');
    if (filterType === 'return') return c.challan_type?.includes('Return');
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Compact Top Header */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
          <h2 className="text-sm font-bold text-white tracking-wide">Delivery Challans Register</h2>
        </div>

        <span className="text-xs text-slate-400 font-mono">
          Total <strong className="text-white">{challans.length}</strong> Challans
        </span>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Challan No, Item Code, Vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 text-white rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 placeholder-slate-500"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {['all', 'outward', 'return'].map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3 py-1 text-xs rounded-lg font-medium capitalize transition-colors ${
                filterType === f
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
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500">Loading delivery challans...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500">No delivery challans found.</td>
                </tr>
              ) : (
                filtered.map(c => (
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
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-600 hover:text-white text-cyan-400 text-xs font-medium border border-slate-700 transition-colors inline-flex items-center gap-1"
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
  );
}
