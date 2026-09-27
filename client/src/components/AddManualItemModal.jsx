import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Trash2, ArrowUp, ArrowDown, CheckCircle2, 
  Layers, AlertTriangle, Flame, Clock, Truck, Sparkles,
  Lock, PackageCheck
} from 'lucide-react';
import { fetchVendors, fetchRawMaterials, createItemWithRoute } from '../api';
import AddVendorModal from './AddVendorModal';

export default function AddManualItemModal({ onClose, onSuccess }) {
  const [vendors, setVendors] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [pendingStageIdx, setPendingStageIdx] = useState(null);

  // Item Details
  const [itemCode, setItemCode] = useState('');
  const [name, setName] = useState('');
  const [materialCode, setMaterialCode] = useState('');
  const [rawMaterialName, setRawMaterialName] = useState('');
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [routeName, setRouteName] = useState('Standard Manufacturing Route');

  // Stages - Final stage is always locked as 'Finished Product' for Production Assembly
  const [stages, setStages] = useState([
    { sequence_no: 1, process_name: 'Cutting', vendor_id: null, is_inhouse: true, lead_time_days: 1, is_welding_stage: false, notes: '' },
    { sequence_no: 2, process_name: 'Forging', vendor_id: null, is_inhouse: false, lead_time_days: 5, is_welding_stage: false, notes: '' },
    { sequence_no: 3, process_name: 'Normalizing', vendor_id: null, is_inhouse: false, lead_time_days: 3, is_welding_stage: false, notes: '' },
    { sequence_no: 4, process_name: 'Shot Blasting', vendor_id: null, is_inhouse: false, lead_time_days: 2, is_welding_stage: false, notes: '' },
    { sequence_no: 5, process_name: 'Machining', vendor_id: null, is_inhouse: true, lead_time_days: 4, is_welding_stage: false, notes: '' },
    { sequence_no: 6, process_name: 'Hobbing', vendor_id: null, is_inhouse: false, lead_time_days: 4, is_welding_stage: false, notes: '' },
    { sequence_no: 7, process_name: 'Nitriding', vendor_id: null, is_inhouse: false, lead_time_days: 4, is_welding_stage: false, notes: '' },
    { sequence_no: 8, process_name: 'Finished Product', vendor_id: null, is_inhouse: true, lead_time_days: 1, is_welding_stage: false, notes: 'Finished Product ready for production assembly' }
  ]);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const [vData, rmData] = await Promise.all([
        fetchVendors(),
        fetchRawMaterials()
      ]);
      setVendors(vData);
      setRawMaterials(rmData);
    } catch (err) {
      console.error(err);
    }
  }

  function handleMaterialCodeChange(selectedCode) {
    setMaterialCode(selectedCode);
    const matched = rawMaterials.find(r => r.code?.toLowerCase() === selectedCode?.trim().toLowerCase());
    if (matched && matched.name) {
      setRawMaterialName(matched.name);
    }
  }

  // Pre-configured route templates (all guaranteed to end in Finished Product for Production Assembly)
  function loadTemplate(templateType) {
    if (templateType === 'standard_forging') {
      setRouteName('Forging, Hobbing & Nitriding Route');
      setStages([
        { sequence_no: 1, process_name: 'Cutting', vendor_id: null, is_inhouse: true, lead_time_days: 1, is_welding_stage: false, notes: 'Cut stock billets' },
        { sequence_no: 2, process_name: 'Forging', vendor_id: null, is_inhouse: false, lead_time_days: 5, is_welding_stage: false, notes: 'Closed die hot forging' },
        { sequence_no: 3, process_name: 'Normalizing', vendor_id: null, is_inhouse: false, lead_time_days: 3, is_welding_stage: false, notes: 'Heat treatment stress relief' },
        { sequence_no: 4, process_name: 'Shot Blasting', vendor_id: null, is_inhouse: false, lead_time_days: 2, is_welding_stage: false, notes: 'Descaling' },
        { sequence_no: 5, process_name: 'Machining', vendor_id: null, is_inhouse: true, lead_time_days: 4, is_welding_stage: false, notes: 'CNC Turning & VMC Milling' },
        { sequence_no: 6, process_name: 'Hobbing', vendor_id: null, is_inhouse: false, lead_time_days: 4, is_welding_stage: false, notes: 'Gear tooth cutting' },
        { sequence_no: 7, process_name: 'Nitriding', vendor_id: null, is_inhouse: false, lead_time_days: 4, is_welding_stage: false, notes: 'Plasma case hardening' },
        { sequence_no: 8, process_name: 'Finished Product', vendor_id: null, is_inhouse: true, lead_time_days: 1, is_welding_stage: false, notes: 'Finished Product ready for production assembly' }
      ]);
    } else if (templateType === 'direct_cnc') {
      setRouteName('Direct CNC Turn-Mill Route');
      setStages([
        { sequence_no: 1, process_name: 'Cutting', vendor_id: null, is_inhouse: true, lead_time_days: 1, is_welding_stage: false, notes: 'Band saw cutting' },
        { sequence_no: 2, process_name: 'CNC Turning', vendor_id: null, is_inhouse: true, lead_time_days: 3, is_welding_stage: false, notes: 'Direct bar profile turning' },
        { sequence_no: 3, process_name: 'VMC Milling', vendor_id: null, is_inhouse: true, lead_time_days: 2, is_welding_stage: false, notes: 'Keyway and holes' },
        { sequence_no: 4, process_name: 'Nitriding', vendor_id: null, is_inhouse: false, lead_time_days: 4, is_welding_stage: false, notes: 'Surface hardening' },
        { sequence_no: 5, process_name: 'Finished Product', vendor_id: null, is_inhouse: true, lead_time_days: 1, is_welding_stage: false, notes: 'Finished Product ready for production assembly' }
      ]);
    } else if (templateType === 'welded_assy') {
      setRouteName('Multi-Item Welded Sub-Assembly Route');
      setStages([
        { sequence_no: 1, process_name: 'Child Parts Staging', vendor_id: null, is_inhouse: true, lead_time_days: 1, is_welding_stage: false, notes: 'Gather sub-components' },
        { sequence_no: 2, process_name: 'Welding', vendor_id: null, is_inhouse: false, lead_time_days: 3, is_welding_stage: true, notes: 'TIG/MIG multi-part weld assembly' },
        { sequence_no: 3, process_name: 'Stress Relieving', vendor_id: null, is_inhouse: false, lead_time_days: 2, is_welding_stage: false, notes: 'Post-weld heat treatment' },
        { sequence_no: 4, process_name: 'Finish Boring', vendor_id: null, is_inhouse: true, lead_time_days: 2, is_welding_stage: false, notes: 'Machining after weld' },
        { sequence_no: 5, process_name: 'Finished Product', vendor_id: null, is_inhouse: true, lead_time_days: 1, is_welding_stage: false, notes: 'Finished Product ready for production assembly' }
      ]);
    }
  }

  // Inserts a new intermediate process stage BEFORE the final 'Finished Product' stage
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
        return [...intermediate, newStage, finalStage].map((s, idx) => ({
          ...s,
          sequence_no: idx + 1
        }));
      } else {
        const finishedStage = {
          sequence_no: prev.length + 2,
          process_name: 'Finished Product',
          vendor_id: null,
          is_inhouse: true,
          lead_time_days: 1,
          is_welding_stage: false,
          notes: 'Finished Product ready for production assembly'
        };
        return [...prev, newStage, finishedStage].map((s, idx) => ({
          ...s,
          sequence_no: idx + 1
        }));
      }
    });
  }

  function removeStage(index) {
    if (stages.length <= 2) return; // Keep at least 1 intermediate process step + final Finished Product stage
    if (index === stages.length - 1) return; // Never allow deleting the terminal Finished Product stage
    setStages(prev => {
      const filtered = prev.filter((_, idx) => idx !== index);
      return filtered.map((s, idx) => ({ ...s, sequence_no: idx + 1 }));
    });
  }

  function updateStage(index, field, value) {
    setStages(prev => {
      const isFinal = index === prev.length - 1;
      // Prevent mutating the terminal stage into a non-finished or vendor step
      if (isFinal && (field === 'process_name' || field === 'is_inhouse')) {
        return prev;
      }
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!itemCode.trim() || !name.trim()) {
      setError('Please fill in Item Code and Name.');
      return;
    }
    if (stages.some(s => !s.process_name.trim())) {
      setError('Every process stage must have a name.');
      return;
    }

    // Strictly enforce that the final stage is 'Finished Product' (In-House) for Production Assembly
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
      await createItemWithRoute({
        item_code: itemCode.trim().toUpperCase(),
        name: name.trim(),
        material_code: materialCode?.trim().toUpperCase() || null,
        raw_material_name: rawMaterialName?.trim() || null,
        weight: weight !== '' && !isNaN(weight) ? parseFloat(weight) : 0.0,
        notes: notes || null,
        route_name: routeName || `${itemCode} Route`,
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
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create item with route');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-950 text-cyan-400 rounded-xl border border-cyan-800/60">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Add Item & Multi-Process Route Manually
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Define constant Item Code and customize individual process stages with assigned vendors & lead times
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/80 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Item Details */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold uppercase text-cyan-400">
              1. Item Master Details (Item Code is Constant)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Item Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CM001"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-cyan-400 uppercase focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-300 mb-1">Item Description / Part Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Heavy Duty Flanged Pinion Shaft"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">RM Code</label>
                <input
                  type="text"
                  list="rm-codes-list-add"
                  placeholder="e.g. RM06RD07"
                  value={materialCode}
                  onChange={(e) => handleMaterialCodeChange(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-cyan-400 uppercase focus:outline-none focus:border-cyan-500"
                />
                <datalist id="rm-codes-list-add">
                  {rawMaterials.map(rm => (
                    <option key={rm.code} value={rm.code}>
                      {rm.code} - {rm.grade || rm.name}
                    </option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">RM Name</label>
                <input
                  type="text"
                  placeholder="Raw material description"
                  value={rawMaterialName}
                  onChange={(e) => setRawMaterialName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Weight</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="e.g. 2.45"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 pr-8"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold uppercase pointer-events-none">
                    kg
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Route Name</label>
                <input
                  type="text"
                  placeholder="e.g. Standard Forging Route"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Engineering / Part Notes</label>
                <input
                  type="text"
                  placeholder="e.g. High wear resistance required"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Route Builder & Templates */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div>
                <h4 className="text-xs font-semibold uppercase text-cyan-400 flex items-center gap-1.5">
                  <span>2. Sequential Process Route Builder ({stages.length} Stages)</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Configure sequential process steps from initial stage to Finished Product
                </p>
              </div>

              {/* Template Shortcuts */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-500">Quick Templates:</span>
                <button
                  type="button"
                  onClick={() => loadTemplate('standard_forging')}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-cyan-300 border border-slate-700 transition-colors"
                >
                  Forging Route
                </button>
                <button
                  type="button"
                  onClick={() => loadTemplate('direct_cnc')}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-indigo-300 border border-slate-700 transition-colors"
                >
                  Direct CNC
                </button>
                <button
                  type="button"
                  onClick={() => loadTemplate('welded_assy')}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-amber-300 border border-slate-700 transition-colors"
                >
                  Welding BOM
                </button>
              </div>
            </div>

            {/* Stages Table */}
            <div className="space-y-2.5">
              {stages.map((stage, idx) => {
                const isFinal = idx === stages.length - 1;

                if (isFinal) {
                  return (
                    <div 
                      key={idx} 
                      className="p-3.5 bg-gradient-to-r from-slate-900 via-emerald-950/20 to-slate-900 rounded-xl border border-emerald-500/50 shadow-sm grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center text-xs ring-1 ring-emerald-500/20"
                    >
                      <div className="sm:col-span-1 text-center font-mono font-bold flex flex-col items-center">
                        <span className="text-emerald-400">#{idx + 1}</span>
                        <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-500">Final</span>
                      </div>

                      <div className="sm:col-span-3">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-950 border border-emerald-500/60 rounded-lg text-xs text-emerald-300 font-bold shadow-inner">
                          <PackageCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Finished Product</span>
                          <span className="ml-auto text-[9px] text-emerald-400/90 font-mono px-1 py-0.2 rounded bg-emerald-950 border border-emerald-700">
                            Assembly
                          </span>
                        </div>
                      </div>

                      <div className="sm:col-span-4 flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-200 w-full">
                          <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="font-semibold text-white">In-House Store</span>
                          <span className="text-[10px] text-emerald-400 font-medium truncate">(Ready for Assembly)</span>
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">Lead:</span>
                          <input
                            type="number"
                            min="1"
                            value={stage.lead_time_days || 1}
                            onChange={(e) => updateStage(idx, 'lead_time_days', e.target.value)}
                            className="w-14 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white text-center focus:outline-none focus:border-emerald-500"
                          />
                          <span className="text-[10px] text-slate-400">Days</span>
                        </div>
                      </div>

                      <div className="sm:col-span-2 flex items-center justify-end">
                        <span 
                          className="px-2 py-1 rounded-md bg-emerald-950/80 border border-emerald-600/50 text-[10px] text-emerald-300 font-semibold flex items-center gap-1 shadow-sm"
                          title="Final finished product stage feeds directly into Production Assembly BOMs"
                        >
                          <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>Assembly Ready</span>
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={idx} 
                    className="p-3 bg-slate-900 rounded-lg border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs"
                  >
                    <div className="sm:col-span-1 text-center font-mono font-bold text-slate-400">
                      #{idx + 1}
                    </div>

                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        required
                        placeholder="e.g. Cutting, Forging..."
                        value={stage.process_name}
                        onChange={(e) => updateStage(idx, 'process_name', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white font-semibold focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="sm:col-span-4 flex items-center gap-2">
                      <label className="flex items-center gap-1 cursor-pointer text-[11px] text-slate-300 shrink-0">
                        <input
                          type="checkbox"
                          checked={stage.is_inhouse}
                          onChange={(e) => updateStage(idx, 'is_inhouse', e.target.checked)}
                          className="rounded bg-slate-950 border-slate-700 text-cyan-600 focus:ring-0"
                        />
                        <span>In-House</span>
                      </label>

                      {!stage.is_inhouse && (
                        <div className="flex items-center gap-1 w-full min-w-0">
                          <select
                            value={stage.vendor_id || ''}
                            onChange={(e) => {
                              const val = e.target.value ? parseInt(e.target.value, 10) : null;
                              updateStage(idx, 'vendor_id', val);
                              const found = vendors.find(v => v.id === val);
                              if (found && found.default_lead_time_days) {
                                updateStage(idx, 'lead_time_days', found.default_lead_time_days);
                              }
                            }}
                            className="w-full min-w-0 px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-500"
                          >
                            <option value="">-- Choose Vendor --</option>
                            {vendors.map(v => (
                              <option key={v.id} value={v.id}>
                                {v.name} ({v.default_lead_time_days}d)
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingStageIdx(idx);
                              setShowAddVendorModal(true);
                            }}
                            className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-white shrink-0 border border-slate-700 text-[10px] font-semibold transition-colors"
                            title="Register a new subcontract vendor manually"
                          >
                            + New
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Lead:</span>
                        <input
                          type="number"
                          min="1"
                          value={stage.lead_time_days}
                          onChange={(e) => updateStage(idx, 'lead_time_days', e.target.value)}
                          className="w-14 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-white text-center focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400">Days</span>
                      </div>
                    </div>

                    <div className="sm:col-span-2 flex items-center justify-end gap-2">
                      <label className="flex items-center gap-1 cursor-pointer text-[10px] text-amber-400 font-semibold" title="Mark if this process is a welding assembly consuming child parts">
                        <input
                          type="checkbox"
                          checked={stage.is_welding_stage}
                          onChange={(e) => updateStage(idx, 'is_welding_stage', e.target.checked)}
                          className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
                        />
                        <span>Weld</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => removeStage(idx)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        title="Remove Stage"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={addStage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-400 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer shadow-sm w-fit"
                title="Inserts a new intermediate process stage before the final Finished Product stage"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Process Step (Before Finished Product)</span>
              </button>

              <span className="text-[11px] text-slate-500 italic">
                Final stage is locked as Finished Product for Production Assembly
              </span>
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
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/30 flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Register Item & Process Route'}</span>
            </button>
          </div>
        </form>

      </div>

      {showAddVendorModal && (
        <AddVendorModal
          onClose={() => {
            setShowAddVendorModal(false);
            setPendingStageIdx(null);
          }}
          onSuccess={async (newVendor) => {
            setShowAddVendorModal(false);
            try {
              const freshVendors = await fetchVendors();
              setVendors(freshVendors);
              if (pendingStageIdx !== null && newVendor) {
                // Find vendor in fresh list
                const matched = freshVendors.find(v => v.code === newVendor.code || v.id === newVendor.id);
                if (matched) {
                  updateStage(pendingStageIdx, 'vendor_id', matched.id);
                  if (matched.default_lead_time_days) {
                    updateStage(pendingStageIdx, 'lead_time_days', matched.default_lead_time_days);
                  }
                }
              }
            } catch (err) {
              console.error(err);
            } finally {
              setPendingStageIdx(null);
            }
          }}
        />
      )}
    </div>
  );
}
