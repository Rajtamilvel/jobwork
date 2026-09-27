import React, { useState, useEffect } from 'react';
import { 
  X, ArrowRight, CheckCircle2, AlertTriangle, Truck, 
  Clock, ShieldCheck, FileText, Calendar, PackageCheck, Info
} from 'lucide-react';
import { advanceBatch, fetchVendors, fetchBatchRouteProgress } from '../api';

export default function AdvanceStageModal({ batch, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [routeProgress, setRouteProgress] = useState(null);

  // Form state
  const [quantityAccepted, setQuantityAccepted] = useState(batch?.quantity_accepted || 0);
  const [quantityRejected, setQuantityRejected] = useState(0);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState(3);
  const [challanNo, setChallanNo] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (!batch) return;
    setQuantityAccepted(batch.quantity_accepted || 0);
    setQuantityRejected(0);
    setChallanNo(`DC-OUT-${Date.now().toString().slice(-6)}`);
    loadInitialData();
  }, [batch]);

  async function loadInitialData() {
    try {
      const [vendorData, progData] = await Promise.all([
        fetchVendors(),
        fetchBatchRouteProgress(batch.id).catch(() => null)
      ]);
      setVendors(vendorData || []);
      setRouteProgress(progData);

      // Check next stage in route
      if (progData?.timeline) {
        const next = progData.timeline.find(s => s.sequence_no > batch.current_stage_sequence);
        if (next) {
          setLeadTimeDays(next.lead_time_days || 3);
          if (next.default_vendor_name && next.default_vendor_name !== 'In-House Shop') {
            const foundV = (vendorData || []).find(v => v.name === next.default_vendor_name);
            if (foundV) setSelectedVendorId(String(foundV.id));
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Determine next stage
  const nextStage = routeProgress?.timeline?.find(s => s.sequence_no > batch.current_stage_sequence);
  const isNextFinished = !nextStage || nextStage.process_name?.trim().toLowerCase() === 'finished product';

  // Calculate live quantities
  const availableQty = batch?.quantity_accepted || 0;
  const numAccepted = parseInt(quantityAccepted || 0, 10);
  const numRejected = parseInt(quantityRejected || 0, 10);
  const pendingRemainder = availableQty - numAccepted - numRejected;
  const isPartial = pendingRemainder > 0 && numAccepted > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (numAccepted <= 0) {
      setError('Accepted quantity must be greater than 0');
      return;
    }
    if (numAccepted + numRejected > availableQty) {
      setError(`Total moved (${numAccepted} accepted + ${numRejected} rejected) exceeds available batch quantity (${availableQty} pcs)`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        quantity_accepted: numAccepted,
        quantity_rejected: numRejected,
        remarks: remarks || (isNextFinished ? 'Moved into Finished Goods Store' : `Advanced from ${batch.current_process}`)
      };

      if (isNextFinished) {
        payload.next_vendor_id = null;
        payload.next_is_inhouse = true;
        payload.next_lead_time_days = 0;
        payload.challan_no = null;
      } else {
        payload.next_vendor_id = selectedVendorId ? parseInt(selectedVendorId, 10) : null;
        payload.next_is_inhouse = false;
        payload.next_lead_time_days = parseInt(leadTimeDays || 3, 10);
        payload.challan_no = challanNo;
      }

      await advanceBatch(batch.id, payload);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to advance stage');
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
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Advance Process Stage:</span>
              <span className="font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800 text-sm">
                {batch.item_code}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Current: <strong className="text-white">{batch.current_process}</strong> ({batch.vendor_name || 'In-House'}) • Batch: <span className="font-mono text-cyan-300">{batch.batch_no}</span>
            </p>
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

          {/* Section 1: Quality Check & Quantities Received */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>1. Receiving Inspection & Quantity Count</span>
              </h4>
              <span className="text-xs text-slate-400 font-mono">
                Total Available: <strong className="text-white">{availableQty} pcs</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Accepted Good Pieces <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={availableQty}
                  value={quantityAccepted}
                  onChange={(e) => setQuantityAccepted(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Rejected / Scrap Pieces
                </label>
                <input
                  type="number"
                  min="0"
                  max={availableQty - (numAccepted || 0)}
                  value={quantityRejected}
                  onChange={(e) => setQuantityRejected(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-red-400 font-mono text-sm focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* Live Partial Quantity Transparency Banner */}
            {isPartial && (
              <div className="p-3 bg-cyan-950/70 border border-cyan-500/40 rounded-lg text-xs text-cyan-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-cyan-300">
                    Partial Batch Advancement ({numAccepted} of {availableQty} pcs)
                  </div>
                  <div className="text-[11px] text-cyan-100 mt-1">
                    • <strong>{numAccepted} pcs</strong> will advance forward to {isNextFinished ? 'Finished Goods Store' : (nextStage?.process_name || 'next stage')}.
                  </div>
                  <div className="text-[11px] text-amber-300 font-medium mt-0.5">
                    • Pending Balance: <strong>{pendingRemainder} pcs</strong> will stay safely with <u>{batch.vendor_name || 'current vendor'}</u> at <strong>{batch.current_process}</strong> under remainder batch <code className="font-mono bg-cyan-900/80 px-1 py-0.5 rounded text-white">{batch.batch_no}-R</code>.
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1">Inspection / Quality Remarks</label>
              <input
                type="text"
                placeholder="e.g. Dimensions verified, surface finish OK"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Section 2: Next Process Destination */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5">
              <ArrowRight className="w-4 h-4 text-cyan-400" />
              <span>2. Next Process Destination</span>
            </h4>

            {isNextFinished ? (
              /* Automatic Move to Finished Goods Store */
              <div className="p-4 bg-emerald-950/50 border border-emerald-500/40 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <PackageCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Final Process: Finished Product</span>
                </div>
                <p className="text-xs text-emerald-200/90 leading-relaxed">
                  The route stages are complete! This quantity will be logged as <strong>Completed Product</strong> and stored directly in the <strong>Finished Goods Store</strong> inventory.
                </p>
                <div className="text-xs text-slate-400 bg-emerald-900/30 border border-emerald-700/40 p-2.5 rounded-lg flex items-center justify-between">
                  <span>Destination: <strong className="text-white">Finished Goods Store (FG)</strong></span>
                  <span>Quantity: <strong className="text-emerald-400 font-mono">{numAccepted} pcs</strong></span>
                </div>
                <p className="text-[11px] text-slate-400 italic">
                  * Note: Once in Finished Goods, it remains as ready stock unless manually sent back for rework to a particular process.
                </p>
              </div>
            ) : (
              /* Intermediate Vendor Stage */
              <div className="space-y-3 pt-1">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Next Route Stage:</span>
                  <span className="text-white font-semibold flex items-center gap-1.5">
                    <span className="text-cyan-400 font-mono">Stage {nextStage?.sequence_no}:</span>
                    <span>{nextStage?.process_name}</span>
                  </span>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Select Subcontract Vendor <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Choose Vendor for {nextStage?.process_name || 'Next Stage'} --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.processes_offered}) - Lead: {v.default_lead_time_days}d
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      Vendor Lead Time (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={leadTimeDays}
                      onChange={(e) => setLeadTimeDays(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      Outward Delivery Challan No.
                    </label>
                    <input
                      type="text"
                      value={challanNo}
                      onChange={(e) => setChallanNo(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            )}
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
              disabled={loading || numAccepted <= 0 || (!isNextFinished && !selectedVendorId)}
              className={`px-5 py-2 rounded-lg text-white text-xs font-semibold shadow-lg flex items-center gap-1.5 disabled:opacity-50 ${
                isNextFinished
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                  : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/30'
              }`}
            >
              {isNextFinished ? (
                <>
                  <PackageCheck className="w-4 h-4" />
                  <span>{loading ? 'Moving...' : 'Confirm & Move to Finished Product'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{loading ? 'Processing...' : 'Confirm & Dispatch to Next Vendor'}</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
