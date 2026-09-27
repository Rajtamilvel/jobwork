import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle, Clock, AlertCircle, Truck, Flame, 
  Layers, ArrowRight, ShieldCheck, Scale, FileText, ChevronRight
} from 'lucide-react';
import { fetchBatchRouteProgress, checkWeldingReadiness } from '../api';

export default function ItemRouteModal({ batch, onClose, onAdvanceStage }) {
  const [loading, setLoading] = useState(true);
  const [routeData, setRouteData] = useState(null);
  const [weldingReadiness, setWeldingReadiness] = useState(null);

  useEffect(() => {
    if (!batch) return;
    loadRoute();
  }, [batch]);

  async function loadRoute() {
    try {
      setLoading(true);
      const data = await fetchBatchRouteProgress(batch.id);
      setRouteData(data);

      // If any stage is welding, check component readiness
      if (batch.is_welding_stage) {
        const readiness = await checkWeldingReadiness(batch.id);
        setWeldingReadiness(readiness);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (!batch) return null;

  const timeline = routeData?.timeline || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-950 text-cyan-400 rounded-xl border border-cyan-800/60">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Lifecycle Route:</span>
                  <span className="font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800 text-sm">
                    {batch.item_code}
                  </span>
                </h3>
                <span className="text-xs text-slate-400">
                  (Constant Item Code from Raw Material to Finished Product)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {batch.item_name} {batch.material_code ? `• RM: ${batch.material_code}` : ''} • Batch: <span className="font-mono text-slate-300">{batch.batch_no}</span>
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

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Raw Material Origin Banner */}
          <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg shrink-0">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase text-amber-400">Raw Material Origin</span>
                  <span className="font-mono text-xs bg-amber-950 text-amber-300 px-2 py-0.5 rounded border border-amber-700/40">
                    {batch.raw_material_code || 'Stock Bar'}
                  </span>
                </div>
                <div className="text-sm font-semibold text-white mt-1">
                  Issued: <span className="text-amber-300 font-mono">{batch.raw_material_quantity} {batch.raw_material_unit || 'kg'}</span>
                  <span className="text-xs text-slate-400 font-normal ml-2">
                    (Cut & shaped for {batch.quantity_total} pieces of {batch.item_code})
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Raw material was issued by weight/length. Item code remains strictly <strong className="text-cyan-300">{batch.item_code}</strong> through all subsequent operations.
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs text-slate-400">Batch Qty:</div>
              <div className="text-lg font-mono font-bold text-white">{batch.quantity_accepted} pcs</div>
              {batch.quantity_rejected > 0 && (
                <div className="text-xs text-red-400">Scrap: {batch.quantity_rejected} pcs</div>
              )}
            </div>
          </div>

          {/* Welding Assembly BOM Breakdown (if stage is welding) */}
          {weldingReadiness && (
            <div className="bg-slate-950 p-4 rounded-xl border border-amber-600/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <h4 className="text-sm font-bold text-white">
                    Welding Stage Component BOM & Readiness
                  </h4>
                </div>
                <span className={`text-xs px-2.5 py-0.5 rounded font-semibold ${
                  weldingReadiness.ready
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : 'bg-amber-950 text-amber-300 border border-amber-700'
                }`}>
                  {weldingReadiness.ready ? 'All Components Ready for Welding' : 'Waiting for Child Components'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                For 1 unit of {batch.item_code}, multiple child components with variable quantities are welded together.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {weldingReadiness.components.map(c => (
                  <div key={c.child_item_code} className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-cyan-400">{c.child_item_code}</span>
                      <span className="text-slate-400 font-mono">{c.quantity_per_unit} per assy</span>
                    </div>
                    <div className="text-xs text-white font-medium mt-1 truncate">{c.child_name}</div>
                    <div className="mt-2 text-[11px] flex items-center justify-between border-t border-slate-800 pt-1.5">
                      <span className="text-slate-400">Required: <strong className="text-white">{c.total_required} {c.unit}</strong></span>
                      <span className={`font-semibold ${c.is_ready ? 'text-emerald-400' : 'text-red-400'}`}>
                        {c.is_ready ? 'READY' : `Lacking ${c.total_required - c.total_available}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sequential Process Stepper */}
          {loading ? (
            <div className="py-12 text-center text-slate-400">Loading process route...</div>
          ) : (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Sequential Process Route ({timeline.length} Stages)
              </h4>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {timeline.map((step, idx) => {
                  const isCurrent = step.status === 'current';
                  const isCompleted = step.status === 'completed';
                  const isUpcoming = step.status === 'upcoming';

                  return (
                    <div key={step.stage_id || idx} className="relative group">
                      
                      {/* Marker Node */}
                      <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all ${
                        isCompleted
                          ? 'bg-emerald-600 border-emerald-400 text-white'
                          : isCurrent
                          ? 'bg-cyan-600 border-cyan-300 text-white ring-4 ring-cyan-500/20'
                          : 'bg-slate-900 border-slate-700 text-slate-500'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : isCurrent ? (
                          <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
                        ) : (
                          <span className="text-[9px] font-mono font-bold">{step.sequence_no}</span>
                        )}
                      </div>

                      {/* Stage Card */}
                      <div className={`p-4 rounded-xl border transition-all ${
                        isCurrent
                          ? 'bg-slate-950 border-cyan-500/80 shadow-lg shadow-cyan-950/40'
                          : isCompleted
                          ? 'bg-slate-950/60 border-emerald-900/40 opacity-90'
                          : 'bg-slate-950/40 border-slate-800 opacity-60'
                      }`}>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-mono text-slate-400">Stage {step.sequence_no}:</span>
                            <span className="text-sm font-bold text-white">{step.process_name}</span>
                            {step.is_welding_stage && (
                              <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600/40 text-[10px] font-bold flex items-center gap-1">
                                <Flame className="w-3 h-3 text-amber-400" />
                                WELDING BOM
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {isCurrent && (
                              <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-600 text-xs font-bold animate-pulse">
                                CURRENT ACTIVE STAGE
                              </span>
                            )}
                            {isCompleted && (
                              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[11px] font-medium">
                                Completed
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Location & Lead Time */}
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs border-t border-slate-800/80 pt-2 text-slate-300">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Location:</span>
                            <span className="font-medium text-white flex items-center gap-1">
                              {step.is_inhouse ? (
                                <>
                                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                                  <span>In-House Shop</span>
                                </>
                              ) : (
                                <>
                                  <Truck className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>{step.vendor_name}</span>
                                </>
                              )}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-500 block text-[10px]">Standard Lead Time:</span>
                            <span className="font-mono text-white">{step.lead_time_days} Days</span>
                          </div>

                          {step.history && (
                            <div>
                              <span className="text-slate-500 block text-[10px]">Actual Quantities:</span>
                              <span className="font-mono text-emerald-400 font-semibold">
                                {step.history.quantity_out || step.history.quantity_in} pcs OK
                              </span>
                              {step.history.quantity_rejected > 0 && (
                                <span className="text-red-400 font-mono ml-1">
                                  ({step.history.quantity_rejected} scrap)
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Audit Details (Dates & Challans) */}
                        {step.history && (
                          <div className="mt-2 text-[11px] text-slate-400 bg-slate-900/80 p-2 rounded border border-slate-800 flex flex-wrap items-center gap-x-4 gap-y-1">
                            {step.history.date_in && <span>In: {step.history.date_in}</span>}
                            {step.history.date_out && <span>Out: {step.history.date_out}</span>}
                            {step.history.challan_out && (
                              <span className="text-cyan-400 font-mono">DC: {step.history.challan_out}</span>
                            )}
                            {step.history.remarks && (
                              <span className="text-slate-300 italic">"{step.history.remarks}"</span>
                            )}
                          </div>
                        )}

                        {/* Current Stage Action */}
                        {isCurrent && (
                          <div className="mt-4 flex items-center justify-end">
                            <button
                              onClick={() => {
                                onClose();
                                onAdvanceStage(batch);
                              }}
                              className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-600/20"
                            >
                              <span>Receive & Advance to Next Stage</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            Item Code: {batch.item_code} • Current: {batch.current_process}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
