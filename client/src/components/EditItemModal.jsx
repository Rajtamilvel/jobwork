import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Trash2, ArrowUp, ArrowDown, CheckCircle2, 
  Layers, AlertTriangle, Flame, Clock, Truck, Sparkles,
  Lock, PackageCheck, Edit3, Save, RefreshCw
} from 'lucide-react';
import { fetchVendors, fetchRawMaterials, fetchItemRoutes, updateItem } from '../api';
import AddVendorModal from './AddVendorModal';

export default function EditItemModal({ item, onClose, onSuccess }) {
  const [vendors, setVendors] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [pendingStageIdx, setPendingStageIdx] = useState(null);

  // Item Fields
  const [name, setName] = useState(item?.name || '');
  const [materialCode, setMaterialCode] = useState(item?.material_code || '');
  const [rawMaterialName, setRawMaterialName] = useState(item?.raw_material_name || '');
  const [weight, setWeight] = useState(item?.weight !== undefined && item?.weight !== null ? item.weight : '');
  const [defaultQuantity, setDefaultQuantity] = useState(item?.default_quantity || 100);
  const [notes, setNotes] = useState(item?.notes || '');
  const [routeName, setRouteName] = useState('Standard Manufacturing Route');

  // Stages
  const [stages, setStages] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, [item?.item_code]);

  async function loadInitialData() {
    if (!item?.item_code) return;
    try {
      setInitialLoading(true);
      setError(null);
      const [vendorsRes, rmRes, routesRes] = await Promise.all([
        fetchVendors(),
        fetchRawMaterials(),
        fetchItemRoutes(item.item_code)
      ]);

      setVendors(vendorsRes);
      setRawMaterials(rmRes);

      if (item?.material_code) {
        const matched = rmRes.find(r => r.code === item.material_code);
        if (matched) {
          setRawMaterialName(matched.name);
        }
      }

      if (routesRes && routesRes.length > 0) {
        const primaryRoute = routesRes[0];
        setRouteName(primaryRoute.route_name || `${item.item_code} Route`);
        
        let existingStages = (primaryRoute.stages || []).map(s => ({
          id: s.id,
          sequence_no: s.sequence_no,
          process_name: s.process_name,
          vendor_id: s.vendor_id || null,
          is_inhouse: Boolean(s.is_inhouse),
          lead_time_days: s.lead_time_days || 3,
          is_welding_stage: Boolean(s.is_welding_stage),
          notes: s.notes || ''
        }));

        // Guarantee final stage is Finished Product
        const hasFinal = existingStages.length > 0 && 
          existingStages[existingStages.length - 1].process_name?.trim().toLowerCase() === 'finished product';
        
        if (!hasFinal) {
          existingStages.push({
            sequence_no: existingStages.length + 1,
            process_name: 'Finished Product',
            vendor_id: null,
            is_inhouse: true,
            lead_time_days: 1,
            is_welding_stage: false,
            notes: 'Finished Product ready for production assembly'
          });
        }

        setStages(existingStages);
      } else {
        // Fallback default stages ending in Finished Product
        setStages([
          { sequence_no: 1, process_name: 'Machining', vendor_id: null, is_inhouse: true, lead_time_days: 3, is_welding_stage: false, notes: '' },
          { sequence_no: 2, process_name: 'Finished Product', vendor_id: null, is_inhouse: true, lead_time_days: 1, is_welding_stage: false, notes: 'Finished Product ready for production assembly' }
        ]);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load item configuration');
    } finally {
      setInitialLoading(false);
    }
  }

  function handleMaterialCodeChange(selectedCode) {
    setMaterialCode(selectedCode);
    const matched = rawMaterials.find(r => r.code?.toLowerCase() === selectedCode?.trim().toLowerCase());
    if (matched && matched.name) {
      setRawMaterialName(matched.name);
    }
  }

  // Insert a new intermediate stage before the terminal 'Finished Product' stage
  function addStage() {
    setStages(prev => {
      const lastIdx = prev.length - 1;
      const finalStage = prev[lastIdx];
      const newStage = {
        sequence_no: prev.length,
        process_name: '',
        vendor_id: null,
        is_inhouse: false,
        lead_time_days: 3,
        is_welding_stage: false,
        notes: ''
      };

      if (finalStage && finalStage.process_name.trim().toLowerCase() === 'finished product') {
        const intermediate = prev.slice(0, lastIdx);
        return [
          ...intermediate,
          newStage,
          { ...finalStage, sequence_no: prev.length + 1 }
        ];
      } else {
        return [
          ...prev,
          newStage,
          {
            sequence_no: prev.length + 2,
            process_name: 'Finished Product',
            vendor_id: null,
            is_inhouse: true,
            lead_time_days: 1,
            is_welding_stage: false,
            notes: 'Finished Product ready for production assembly'
          }
        ];
      }
    });
  }

  // Delete intermediate stage (cannot delete the terminal Finished Product stage)
  function removeStage(index) {
    if (index === stages.length - 1) {
      alert('The terminal "Finished Product" stage is mandatory for assembly readiness and cannot be removed.');
      return;
    }
    if (stages.length <= 2) {
      alert('An item route must have at least one manufacturing process before the Finished Product stage.');
      return;
    }

    setStages(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((s, idx) => ({ ...s, sequence_no: idx + 1 }));
    });
  }

  function moveStage(index, direction) {
    if (index === stages.length - 1 || index + direction === stages.length - 1) {
      alert('The terminal "Finished Product" stage must always remain the final step in the sequence.');
      return;
    }

    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= stages.length - 1) return;

    setStages(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[newIdx];
      copy[newIdx] = temp;
      return copy.map((s, idx) => ({ ...s, sequence_no: idx + 1 }));
    });
  }

  function updateStage(index, field, value) {
    setStages(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide an Item Name.');
      return;
    }
    if (stages.some(s => !s.process_name.trim())) {
      setError('Every process stage must have a valid process name.');
      return;
    }

    // Guarantee the final stage is Finished Product
    const stagesPayload = [...stages];
    const lastStage = stagesPayload[stagesPayload.length - 1];
    if (!lastStage || lastStage.process_name.trim().toLowerCase() !== 'finished product') {
      stagesPayload.push({
        sequence_no: stagesPayload.length + 1,
        process_name: 'Finished Product',
        vendor_id: null,
        is_inhouse: true,
        lead_time_days: 1,
        is_welding_stage: false,
        notes: 'Finished Product ready for production assembly'
      });
    } else {
      stagesPayload[stagesPayload.length - 1] = {
        ...lastStage,
        process_name: 'Finished Product',
        is_inhouse: true,
        vendor_id: null,
        lead_time_days: Math.max(1, parseInt(lastStage.lead_time_days || 1, 10)),
        notes: lastStage.notes || 'Finished Product ready for production assembly'
      };
    }

    try {
      setLoading(true);
      setError(null);

      await updateItem(item.item_code, {
        name: name.trim(),
        material_code: materialCode?.trim().toUpperCase() || null,
        raw_material_name: rawMaterialName?.trim() || null,
        weight: weight !== '' && !isNaN(weight) ? parseFloat(weight) : 0.0,
        default_quantity: parseInt(defaultQuantity, 10) || 100,
        notes: notes || null,
        route_name: routeName || `${item.item_code} Route`,
        stages: stagesPayload.map((s, idx) => ({
          sequence_no: idx + 1,
          process_name: s.process_name,
          vendor_id: s.is_inhouse ? null : (s.vendor_id ? parseInt(s.vendor_id, 10) : null),
          is_inhouse: s.is_inhouse,
          lead_time_days: parseInt(s.lead_time_days || 1, 10),
          is_welding_stage: s.is_welding_stage,
          notes: s.notes || null
        }))
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update item and process route');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Edit Item & Process Route
                </h3>
                <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                  {item?.item_code}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Update part specs, raw material association, and sequential manufacturing route stages
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

        {/* Content */}
        {initialLoading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
            <span className="text-xs">Loading item configuration...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Section 1: Item Master Details */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-semibold uppercase text-cyan-400 tracking-wider">
                1. Item Master Specifications
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Item Code <span className="text-slate-600 font-normal">(Immutable)</span>
                  </label>
                  <input
                    type="text"
                    disabled
                    value={item?.item_code || ''}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-300 mb-1 font-semibold">
                    Part Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Pinion Shaft 18T"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-semibold">
                    RM Code
                  </label>
                  <input
                    type="text"
                    list="rm-codes-list-edit"
                    placeholder="e.g. RM06RD07"
                    value={materialCode}
                    onChange={(e) => handleMaterialCodeChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-400 focus:border-cyan-500 focus:outline-none font-mono uppercase"
                  />
                  <datalist id="rm-codes-list-edit">
                    {rawMaterials.map(rm => (
                      <option key={rm.code} value={rm.code}>
                        {rm.code} - {rm.grade || rm.name}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-semibold">
                    RM Name
                  </label>
                  <input
                    type="text"
                    value={rawMaterialName}
                    onChange={(e) => setRawMaterialName(e.target.value)}
                    placeholder="e.g. EN8 Carbon Steel Round Bar Ø50mm"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-semibold">
                    Weight
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="e.g. 2.45"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none pr-8 font-mono"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold uppercase pointer-events-none">
                      kg
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-semibold">
                    Default Batch Size
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={defaultQuantity}
                    onChange={(e) => setDefaultQuantity(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-300 mb-1 font-semibold">
                    Engineering Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Critical tooth depth tolerance ±0.02mm"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Sequential Process Route Stages */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase text-cyan-400 tracking-wider">
                    2. Sequential Process Route Stages
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Arrange steps sequentially. Final step is locked to <strong className="text-emerald-400">Finished Product</strong>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addStage}
                  className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 text-xs font-bold border border-cyan-800 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Intermediate Stage</span>
                </button>
              </div>

              {/* Route Name Input */}
              <div>
                <label className="block text-xs text-slate-300 mb-1 font-semibold">
                  Route Name / Description
                </label>
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="e.g. Standard Multi-Vendor Machining Route"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Stages List */}
              <div className="space-y-2.5">
                {stages.map((stage, idx) => {
                  const isFinal = idx === stages.length - 1;

                  return (
                    <div
                      key={stage.id || idx}
                      className={`p-3 rounded-xl border transition-all ${
                        isFinal
                          ? 'bg-emerald-950/20 border-emerald-500/50 shadow-sm'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center gap-3">
                        {/* Sequence badge & Reorder buttons */}
                        <div className="flex items-center gap-1.5">
                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-black ${
                            isFinal ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' : 'bg-slate-800 text-slate-300'
                          }`}>
                            #{stage.sequence_no}
                          </span>

                          {!isFinal && (
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveStage(idx, -1)}
                                className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30"
                                title="Move Up"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === stages.length - 2}
                                onClick={() => moveStage(idx, 1)}
                                className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30"
                                title="Move Down"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Process Name */}
                        <div className="flex-1 min-w-[140px]">
                          {isFinal ? (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-600/40 text-xs font-bold text-emerald-300">
                              <PackageCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>Finished Product (Ready for Assembly)</span>
                              <Lock className="w-3 h-3 text-emerald-400 ml-auto" title="Locked terminal stage" />
                            </div>
                          ) : (
                            <input
                              type="text"
                              required
                              value={stage.process_name}
                              onChange={(e) => updateStage(idx, 'process_name', e.target.value)}
                              placeholder="Process Name (e.g. Turning, Grinding)"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-none"
                            />
                          )}
                        </div>

                        {/* Location: In-House vs Vendor */}
                        <div className="w-[110px]">
                          {isFinal ? (
                            <span className="text-xs text-emerald-400 font-bold px-2 py-1 rounded bg-emerald-950/60 border border-emerald-800 block text-center">
                              In-House Store
                            </span>
                          ) : (
                            <select
                              value={stage.is_inhouse ? 'true' : 'false'}
                              onChange={(e) => updateStage(idx, 'is_inhouse', e.target.value === 'true')}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                            >
                              <option value="true">In-House</option>
                              <option value="false">Vendor Subcon</option>
                            </select>
                          )}
                        </div>

                        {/* Vendor Assignment */}
                        <div className="flex-1 min-w-[150px]">
                          {isFinal || stage.is_inhouse ? (
                            <span className="text-xs text-slate-500 italic px-2 py-1 block">
                              Internal Shop Floor
                            </span>
                          ) : (
                            <select
                              value={stage.vendor_id || ''}
                              onChange={(e) => updateStage(idx, 'vendor_id', e.target.value || null)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                            >
                              <option value="">-- Select Assigned Vendor --</option>
                              {vendors.map(v => (
                                <option key={v.id} value={v.id}>
                                  {v.name} ({v.processes_offered || 'Subcon'})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Lead Time Days */}
                        <div className="w-[85px]">
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              value={stage.lead_time_days || 1}
                              onChange={(e) => updateStage(idx, 'lead_time_days', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none text-center pr-6"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                              days
                            </span>
                          </div>
                        </div>

                        {/* Remove button */}
                        {!isFinal && (
                          <button
                            type="button"
                            onClick={() => removeStage(idx)}
                            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                            title="Remove stage"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Item & Route</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
