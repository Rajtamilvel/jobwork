import React, { useState, useEffect } from 'react';
import { 
  X, RotateCcw, AlertTriangle, Truck, Clock, ShieldAlert,
  CheckCircle2, ArrowRight, Package
} from 'lucide-react';
import { reworkBatch, fetchBatchRouteProgress, fetchVendors } from '../api';

export default function ReworkModal({ batch, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [routeStages, setRouteStages] = useState([]);
  const [vendors, setVendors] = useState([]);

  // Form fields
  const [quantity, setQuantity] = useState(batch?.quantity_accepted || 1);
  const [targetStageSeq, setTargetStageSeq] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [challanNo, setChallanNo] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (!batch) return;
    setQuantity(batch.quantity_accepted || 1);
    setChallanNo(`DC-RWK-${Date.now().toString().slice(-6)}`);
    loadData();
  }, [batch]);

  async function loadData() {
    try {
      const [progData, vendorData] = await Promise.all([
        fetchBatchRouteProgress(batch.id),
        fetchVendors()
      ]);
      setVendors(vendorData || []);

      // Filter stages eligible for rework: all intermediate stages except "Finished Product"
      const eligible = (progData.timeline || []).filter(
        s => s.process_name?.trim().toLowerCase() !== 'finished product'
      );
      setRouteStages(eligible);
      if (eligible.length > 0) {
        // Default to the stage immediately before Finished Product or first stage
        const defaultStage = eligible[eligible.length - 1];
        setTargetStageSeq(String(defaultStage.sequence_no));
        if (defaultStage.vendor_name && defaultStage.vendor_name !== 'In-House Shop') {
          // match vendor if possible
          const foundV = (vendorData || []).find(v => v.name === defaultStage.vendor_name);
          if (foundV) setVendorId(String(foundV.id));
        }
      }
    } catch (err) {
      console.error('Error loading rework details:', err);
      setError('Failed to load route stages for this item');
    }
  }

  function handleStageChange(seqStr) {
    setTargetStageSeq(seqStr);
    const stage = routeStages.find(s => String(s.sequence_no) === seqStr);
    if (stage) {
      const foundV = vendors.find(v => v.name === stage.vendor_name);
      if (foundV) {
        setVendorId(String(foundV.id));
      } else {
        setVendorId('');
      }
    }
  }

  const selectedStage = routeStages.find(s => String(s.sequence_no) === String(targetStageSeq));
  const numQty = parseInt(quantity || 0, 10);
  const maxQty = batch?.quantity_accepted || 1;
  const isPartial = numQty > 0 && numQty < maxQty;
  const remainingInFG = Math.max(0, maxQty - numQty);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!targetStageSeq) {
      setError('Please select a target route stage for rework');
      return;
    }
    if (numQty <= 0 || numQty > maxQty) {
      setError(`Rework quantity must be between 1 and ${maxQty} pcs`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await reworkBatch(batch.id, {
        target_stage_sequence: parseInt(targetStageSeq, 10),
        quantity: numQty,
        vendor_id: vendorId ? parseInt(vendorId, 10) : null,
        challan_no: challanNo || null,
        remarks: remarks || `Manual rework to ${selectedStage?.process_name || 'Route Stage'}`
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to dispatch for rework');
    } finally {
      setLoading(false);
    }
  }

  if (!batch) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Send Finished Batch to Rework</span>
                <span className="font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800 text-xs">
                  {batch.item_code}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Batch: <strong className="text-white font-mono">{batch.batch_no}</strong> • In FG Store: <strong className="text-emerald-400">{batch.quantity_accepted} pcs</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
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

          {/* Section 1: Rework Quantity */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>1. Rework Quantity & Scope</span>
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Quantity for Rework (pcs) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={maxQty}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
                <div className="text-[10px] text-slate-500 mt-1">
                  Max available in FG: {maxQty} pcs
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 flex flex-col justify-center text-xs">
                {isPartial ? (
                  <>
                    <div className="text-cyan-400 font-semibold flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      <span>Partial Rework Split</span>
                    </div>
                    <div className="text-slate-300 mt-1 text-[11px]">
                      <strong>{remainingInFG} pcs</strong> will stay in FG Store.
                    </div>
                    <div className="text-slate-400 text-[10px] mt-0.5">
                      <strong>{numQty} pcs</strong> will move to rework as <code>{batch.batch_no}-RWK</code>.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-amber-400 font-semibold flex items-center gap-1">
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Full Batch Rework</span>
                    </div>
                    <div className="text-slate-300 mt-1 text-[11px]">
                      All <strong>{numQty} pcs</strong> will move back into production route.
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Destination Process Stage & Vendor */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5">
              <ArrowRight className="w-4 h-4 text-cyan-400" />
              <span>2. Send to Route Stage & Vendor</span>
            </h4>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Select Rework Stage <span className="text-red-400">*</span>
              </label>
              <select
                value={targetStageSeq}
                onChange={(e) => handleStageChange(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="">-- Choose Target Process Stage --</option>
                {routeStages.map(s => (
                  <option key={s.sequence_no} value={s.sequence_no}>
                    Stage {s.sequence_no}: {s.process_name} ({s.is_inhouse ? 'In-House' : s.vendor_name || 'Vendor'}) - Lead: {s.lead_time_days || 1}d
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Assign Vendor (if external)
                </label>
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Default / In-House --</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.processes_offered})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Rework Delivery Challan No.
                </label>
                <input
                  type="text"
                  value={challanNo}
                  onChange={(e) => setChallanNo(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                QC Reason / Rework Instructions <span className="text-red-400">*</span>
              </label>
              <textarea
                rows="2"
                required
                placeholder="Describe rejection reason, defect observed, or required correction (e.g. Dimensions out of tolerance by 0.05mm, re-machine flange face)..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
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
              disabled={loading || !targetStageSeq || numQty <= 0}
              className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-600/30 flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{loading ? 'Dispatching...' : `Confirm Rework (${numQty} pcs)`}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
