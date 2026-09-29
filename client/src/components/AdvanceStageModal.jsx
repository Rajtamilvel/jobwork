import React, { useState, useEffect } from 'react';
import { 
  X, ArrowRight, CheckCircle2, AlertTriangle, Truck, 
  Clock, ShieldCheck, FileText, Calendar, PackageCheck, Info,
  Split, Plus, Trash2, Users, Layers
} from 'lucide-react';
import { advanceBatch, splitAdvanceBatch, fetchVendors, fetchBatchRouteProgress } from '../api';

export default function AdvanceStageModal({ batch, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [routeProgress, setRouteProgress] = useState(null);

  // Dispatch mode: 'single' (traditional) | 'split' (multi-vendor split)
  const [dispatchMode, setDispatchMode] = useState('single');

  // Single mode state
  const [quantityAccepted, setQuantityAccepted] = useState(batch?.quantity_accepted || 0);
  const [quantityRejected, setQuantityRejected] = useState(0);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState(3);
  const [challanNo, setChallanNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // Multi-vendor split allocations state
  const [allocations, setAllocations] = useState([
    {
      vendor_id: '',
      quantity: 0,
      lead_time_days: 3,
      challan_no: '',
      sub_batch_no: ''
    },
    {
      vendor_id: '',
      quantity: 0,
      lead_time_days: 3,
      challan_no: '',
      sub_batch_no: ''
    }
  ]);

  useEffect(() => {
    if (!batch) return;
    const totalAvail = batch.quantity_accepted || 0;
    setQuantityAccepted(totalAvail);
    setQuantityRejected(0);
    const ts = Date.now().toString().slice(-6);
    setChallanNo(`DC-OUT-${ts}`);

    // Pre-populate split allocations with smart halves
    const half1 = Math.ceil(totalAvail / 2);
    const half2 = totalAvail - half1;
    setAllocations([
      {
        vendor_id: '',
        quantity: half1,
        lead_time_days: 3,
        challan_no: `DC-OUT-${ts}-A`,
        sub_batch_no: `${batch.batch_no}-A`
      },
      {
        vendor_id: '',
        quantity: half2,
        lead_time_days: 3,
        challan_no: `DC-OUT-${ts}-B`,
        sub_batch_no: `${batch.batch_no}-B`
      }
    ]);

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

  // Split mode calculations
  const totalAllocated = allocations.reduce((sum, a) => sum + (parseInt(a.quantity, 10) || 0), 0);
  const splitRemaining = numAccepted - totalAllocated;

  function handleAddAllocation() {
    const nextIdx = allocations.length;
    const letter = String.fromCharCode(65 + nextIdx);
    const ts = Date.now().toString().slice(-6);
    const defaultQty = splitRemaining > 0 ? splitRemaining : 0;
    setAllocations([
      ...allocations,
      {
        vendor_id: '',
        quantity: defaultQty,
        lead_time_days: 3,
        challan_no: `DC-OUT-${ts}-${letter}`,
        sub_batch_no: `${batch.batch_no}-${letter}`
      }
    ]);
  }

  function handleRemoveAllocation(index) {
    if (allocations.length <= 2) return;
    setAllocations(allocations.filter((_, i) => i !== index));
  }

  function handleAllocationChange(index, field, value) {
    const updated = [...allocations];
    updated[index] = { ...updated[index], [field]: value };
    setAllocations(updated);
  }

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

    if (dispatchMode === 'split') {
      if (totalAllocated <= 0) {
        setError('Please allocate pieces to at least one vendor.');
        return;
      }
      if (totalAllocated > numAccepted) {
        setError(`Total allocated across vendors (${totalAllocated} pcs) exceeds accepted lot quantity (${numAccepted} pcs).`);
        return;
      }
      for (let i = 0; i < allocations.length; i++) {
        const a = allocations[i];
        const qty = parseInt(a.quantity, 10) || 0;
        if (qty > 0 && !isNextFinished && !a.vendor_id && a.vendor_id !== 'inhouse') {
          setError(`Please select a destination vendor for Destination #${i + 1} (${a.sub_batch_no || 'Sub-lot'}).`);
          return;
        }
      }
    }

    try {
      setLoading(true);
      setError(null);

      if (dispatchMode === 'split') {
        const activeAllocations = allocations.filter(a => (parseInt(a.quantity, 10) || 0) > 0);
        const payload = {
          quantity_rejected: numRejected,
          remarks: remarks || `Split advance from ${batch.current_process} into ${activeAllocations.length} sub-lots`,
          allocations: activeAllocations.map(a => ({
            quantity: parseInt(a.quantity, 10),
            vendor_id: isNextFinished || a.vendor_id === 'inhouse' ? null : (a.vendor_id ? parseInt(a.vendor_id, 10) : null),
            is_inhouse: isNextFinished || a.vendor_id === 'inhouse' || !a.vendor_id,
            challan_no: isNextFinished ? null : a.challan_no,
            lead_time_days: isNextFinished ? 0 : parseInt(a.lead_time_days || 3, 10),
            sub_batch_no: a.sub_batch_no
          }))
        };

        await splitAdvanceBatch(batch.id, payload);
      } else {
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
      }

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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        
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
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    setQuantityAccepted(val);
                    if (val > 0) {
                      const h1 = Math.ceil(val / 2);
                      const h2 = val - h1;
                      setAllocations(prev => [
                        { ...prev[0], quantity: h1 },
                        { ...prev[1], quantity: h2 },
                        ...prev.slice(2).map(p => ({ ...p, quantity: 0 }))
                      ]);
                    }
                  }}
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
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5">
                <ArrowRight className="w-4 h-4 text-cyan-400" />
                <span>2. Next Process Destination</span>
              </h4>
              {!isNextFinished && (
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950/70 border border-cyan-800/50 px-2 py-0.5 rounded">
                  Stage {nextStage?.sequence_no}: {nextStage?.process_name}
                </span>
              )}
            </div>

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
              /* Intermediate Vendor Stage with Single vs Multi-Vendor Split Choice */
              <div className="space-y-3">
                {/* Segmented Mode Selector */}
                <div className="grid grid-cols-2 p-1 bg-slate-900 rounded-xl border border-slate-800 gap-1">
                  <button
                    type="button"
                    onClick={() => setDispatchMode('single')}
                    className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                      dispatchMode === 'single'
                        ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Single Destination (100% to 1 Vendor)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDispatchMode('split')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      dispatchMode === 'split'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/25 border border-cyan-400/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Split className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Multi-Vendor Split Dispatch</span>
                    <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.2 rounded-full font-mono font-bold">
                      1-Click
                    </span>
                  </button>
                </div>

                {dispatchMode === 'single' ? (
                  /* Single Vendor Option */
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">
                        Select Subcontract Vendor <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={selectedVendorId}
                        onChange={(e) => setSelectedVendorId(e.target.value)}
                        required={dispatchMode === 'single'}
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
                ) : (
                  /* Multi-Vendor Split Option */
                  <div className="space-y-3 pt-1">
                    {/* Live Balance Tracker */}
                    <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <Split className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Distribute {numAccepted} pcs across Vendors</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Each vendor receives an independent sub-lot and outward delivery challan.
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono">
                          <span className="text-slate-400">Allocated: </span>
                          <strong className={totalAllocated === numAccepted ? 'text-emerald-400' : totalAllocated > numAccepted ? 'text-red-400' : 'text-amber-400'}>
                            {totalAllocated}
                          </strong>
                          <span className="text-slate-500"> / {numAccepted} pcs</span>
                        </div>
                        <div className="text-[10px] mt-0.5">
                          {splitRemaining === 0 && (
                            <span className="text-emerald-400 font-medium">✓ 100% Balanced</span>
                          )}
                          {splitRemaining > 0 && (
                            <span className="text-amber-400 font-medium">{splitRemaining} pcs unallocated</span>
                          )}
                          {splitRemaining < 0 && (
                            <span className="text-red-400 font-medium">+{Math.abs(splitRemaining)} pcs over limit!</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Allocation Cards */}
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {allocations.map((alloc, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-xl p-3 space-y-2.5 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-300 text-[10px] font-bold flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="text-xs font-semibold text-white">
                                Destination #{idx + 1}
                              </span>
                              <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                                Sub-lot: {alloc.sub_batch_no || `${batch.batch_no}-${String.fromCharCode(65 + idx)}`}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {splitRemaining > 0 && idx === allocations.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleAllocationChange(idx, 'quantity', (parseInt(alloc.quantity, 10) || 0) + splitRemaining)}
                                  className="text-[10px] px-2 py-0.5 rounded bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 border border-cyan-700/60 transition-colors"
                                >
                                  + Add Remaining ({splitRemaining})
                                </button>
                              )}
                              {allocations.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAllocation(idx)}
                                  className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                                  title="Remove this destination"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-12 gap-2.5 items-end">
                            {/* Vendor Dropdown */}
                            <div className="col-span-5">
                              <label className="block text-[11px] text-slate-300 mb-1">
                                Subcontract Vendor <span className="text-red-400">*</span>
                              </label>
                              <select
                                value={alloc.vendor_id}
                                onChange={(e) => handleAllocationChange(idx, 'vendor_id', e.target.value)}
                                required={dispatchMode === 'split'}
                                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                              >
                                <option value="">-- Choose Vendor --</option>
                                <option value="inhouse">🏭 In-House Shop</option>
                                {vendors.map(v => (
                                  <option key={v.id} value={v.id}>
                                    {v.name} ({v.processes_offered})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Quantity */}
                            <div className="col-span-3">
                              <label className="block text-[11px] text-slate-300 mb-1">
                                Quantity (pcs) <span className="text-red-400">*</span>
                              </label>
                              <input
                                type="number"
                                min="1"
                                required={dispatchMode === 'split'}
                                value={alloc.quantity}
                                onChange={(e) => handleAllocationChange(idx, 'quantity', parseInt(e.target.value, 10) || 0)}
                                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            {/* Challan No */}
                            <div className="col-span-2">
                              <label className="block text-[11px] text-slate-300 mb-1">
                                Challan No
                              </label>
                              <input
                                type="text"
                                value={alloc.challan_no}
                                onChange={(e) => handleAllocationChange(idx, 'challan_no', e.target.value)}
                                placeholder="Auto DC"
                                className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-cyan-300 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            {/* Lead Time */}
                            <div className="col-span-2">
                              <label className="block text-[11px] text-slate-300 mb-1">
                                Lead (Days)
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={alloc.lead_time_days}
                                onChange={(e) => handleAllocationChange(idx, 'lead_time_days', parseInt(e.target.value, 10) || 1)}
                                className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add another vendor button */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={handleAddAllocation}
                        className="px-3 py-1.5 rounded-lg border border-dashed border-cyan-700/80 bg-cyan-950/30 hover:bg-cyan-950/70 text-cyan-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Another Vendor Split</span>
                      </button>

                      {splitRemaining > 0 && (
                        <span className="text-[11px] text-amber-300/90 italic">
                          * {splitRemaining} pcs will stay at {batch.current_process} as remainder batch {batch.batch_no}-R
                        </span>
                      )}
                    </div>
                  </div>
                )}
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
              disabled={
                loading ||
                numAccepted <= 0 ||
                (isNextFinished
                  ? false
                  : dispatchMode === 'split'
                  ? totalAllocated <= 0 || totalAllocated > numAccepted
                  : !selectedVendorId)
              }
              className={`px-5 py-2 rounded-lg text-white text-xs font-semibold shadow-lg flex items-center gap-1.5 disabled:opacity-50 ${
                isNextFinished
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                  : dispatchMode === 'split'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-600/30'
                  : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/30'
              }`}
            >
              {isNextFinished ? (
                <>
                  <PackageCheck className="w-4 h-4" />
                  <span>{loading ? 'Moving...' : 'Confirm & Move to Finished Product'}</span>
                </>
              ) : dispatchMode === 'split' ? (
                <>
                  <Split className="w-4 h-4" />
                  <span>{loading ? 'Splitting...' : `Confirm & Split Dispatch (${totalAllocated} pcs)`}</span>
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

