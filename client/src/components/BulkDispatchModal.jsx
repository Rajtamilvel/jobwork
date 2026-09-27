import React, { useState, useEffect } from 'react';
import { 
  X, Truck, CheckSquare, Square, CheckCircle2, AlertTriangle, 
  FileText, Calendar, Layers 
} from 'lucide-react';
import { fetchVendors, fetchBatches, bulkDispatchToVendor } from '../api';

export default function BulkDispatchModal({ onClose, onSuccess }) {
  const [vendors, setVendors] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedBatchIds, setSelectedBatchIds] = useState(new Set());
  const [challanNo, setChallanNo] = useState(`DC-OUT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [transporter, setTransporter] = useState('VRL Logistics');
  const [vehicleNo, setVehicleNo] = useState('KA-01-E-9041');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [vData, bData] = await Promise.all([
        fetchVendors(),
        fetchBatches()
      ]);
      setVendors(vData);
      // Filter batches not completed
      const activeBatches = bData.filter(b => b.status !== 'Completed');
      setBatches(activeBatches);
      if (vData.length > 0) setSelectedVendorId(vData[0].id.toString());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelectBatch(id) {
    setSelectedBatchIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedBatchIds.size === batches.length) {
      setSelectedBatchIds(new Set());
    } else {
      setSelectedBatchIds(new Set(batches.map(b => b.id)));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedVendorId) {
      setError('Please select a destination vendor.');
      return;
    }
    if (selectedBatchIds.size === 0) {
      setError('Please select at least one item to dispatch.');
      return;
    }

    const itemsToSend = batches
      .filter(b => selectedBatchIds.has(b.id))
      .map(b => ({
        batch_id: b.id,
        item_code: b.item_code,
        quantity: b.quantity_accepted,
        process_name: b.current_process
      }));

    try {
      setSubmitting(true);
      setError(null);
      await bulkDispatchToVendor({
        vendor_id: parseInt(selectedVendorId, 10),
        challan_no: challanNo,
        date: date,
        items: itemsToSend,
        transporter,
        vehicle_no: vehicleNo,
        remarks: remarks || `Multiple items dispatched to vendor`
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to dispatch items');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedVendor = vendors.find(v => v.id.toString() === selectedVendorId);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-950 text-indigo-400 rounded-xl border border-indigo-800/60">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Dispatch Multiple Items to Same Vendor
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Send several batches/items together on a single shared Outward Delivery Challan
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/80 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Destination Vendor */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold uppercase text-indigo-300">
              1. Select Destination Vendor
            </h4>

            <div>
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
              >
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.vendor_type === 'Trip' ? '🚚 [TRIP] ' : '🛵 [LOCAL] '}{v.name} ({v.processes_offered}) - Lead: {v.default_lead_time_days} Days
                  </option>
                ))}
              </select>
            </div>

            {selectedVendor && (
              <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  selectedVendor.vendor_type === 'Trip' 
                    ? 'bg-amber-950 text-amber-300 border border-amber-600' 
                    : 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                }`}>
                  {selectedVendor.vendor_type === 'Trip' ? '🚚 Trip Vendor (Outstation)' : '🛵 Local Vendor (Local Subcontract)'}
                </span>
                <span>Contact: <strong className="text-white">{selectedVendor.contact_person || 'Vendor'}</strong> ({selectedVendor.phone})</span>
                <span>•</span>
                <span>Committed Lead Time: <strong className="text-cyan-300 font-mono">{selectedVendor.default_lead_time_days} Days</strong></span>
              </div>
            )}
          </div>

          {/* Multiple Item Selection */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase text-cyan-400">
                2. Select Items to Send ({selectedBatchIds.size} selected)
              </h4>
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-cyan-400 hover:underline"
              >
                {selectedBatchIds.size === batches.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/60">
              {batches.map(b => {
                const isSelected = selectedBatchIds.has(b.id);
                return (
                  <div 
                    key={b.id}
                    onClick={() => toggleSelectBatch(b.id)}
                    className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/70'
                        : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-indigo-400">
                        {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-600" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-cyan-400">{b.item_code}</span>
                          <span className="text-xs font-medium text-white">{b.item_name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Process: <strong className="text-slate-200">{b.current_process}</strong> • Current Location: {b.vendor_name}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-white">{b.quantity_accepted} pcs</div>
                      <div className="text-[10px] text-slate-500">{b.batch_no}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shared Delivery Challan Details */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold uppercase text-slate-400">
              3. Shared Outward Delivery Challan
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Challan Number *</label>
                <input
                  type="text"
                  required
                  value={challanNo}
                  onChange={(e) => setChallanNo(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Dispatch Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Transporter</label>
                <input
                  type="text"
                  value={transporter}
                  onChange={(e) => setTransporter(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Vehicle No.</label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || selectedBatchIds.size === 0}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Truck className="w-4 h-4" />
              <span>{submitting ? 'Dispatching...' : `Dispatch ${selectedBatchIds.size} Items to Vendor`}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
