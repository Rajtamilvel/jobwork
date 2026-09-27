import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Minus, ArrowUpDown, History, AlertTriangle, 
  CheckCircle2, Package, Layers, Scale, Sparkles, Clock, 
  HelpCircle, ShieldAlert, ArrowRight, RefreshCw, FileText, Truck
} from 'lucide-react';
import { 
  fetchItems, fetchItemRoutes, fetchRawMaterials, fetchVendors,
  fetchItemStocksByStage, amendStock, fetchStockAmendments 
} from '../api';

const REASON_OPTIONS = [
  'Physical Stock Count Variance',
  'Scrap / Damage Write-Off',
  'Sample / Testing Issue',
  'Unrecorded Production Stock',
  'Customer Return / Re-entry',
  'Assembly Shortage Rectification',
  'Other Manual Adjustment'
];

export default function StockAmendmentModal({ 
  initialItem = null,
  initialTargetType = 'finished_goods',
  initialStageSeq = null,
  initialRawMaterialCode = null,
  onClose, 
  onSuccess 
}) {
  const [activeTab, setActiveTab] = useState('amend'); // 'amend' | 'history'
  const [targetType, setTargetType] = useState(initialTargetType); // 'finished_goods', 'stage_wip', 'raw_material'
  const [adjustmentType, setAdjustmentType] = useState('add'); // 'add' (+) | 'deduct' (-)
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Physical Stock Count Variance');
  const [remarks, setRemarks] = useState('');
  
  // Data sources
  const [items, setItems] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [stockByStageData, setStockByStageData] = useState(null);
  const [routesMap, setRoutesMap] = useState({});
  const [historyList, setHistoryList] = useState([]);
  const [vendors, setVendors] = useState([]);
  
  // Selected targets
  const [selectedItemCode, setSelectedItemCode] = useState(
    typeof initialItem === 'string' ? initialItem : (initialItem?.item_code || '')
  );
  const [selectedStageSeq, setSelectedStageSeq] = useState(initialStageSeq || null);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedRawMaterialCode, setSelectedRawMaterialCode] = useState(initialRawMaterialCode || '');

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, selectedItemCode, selectedRawMaterialCode, targetType]);

  async function loadData() {
    try {
      const [itemsRes, rmRes, stockRes, vendorsRes] = await Promise.all([
        fetchItems(),
        fetchRawMaterials(),
        fetchItemStocksByStage().catch(() => null),
        fetchVendors().catch(() => [])
      ]);

      setItems(itemsRes);
      setRawMaterials(rmRes);
      setStockByStageData(stockRes);
      setVendors(vendorsRes);

      // Default selections if none provided
      let currentItem = selectedItemCode;
      if (!currentItem && itemsRes.length > 0) {
        currentItem = itemsRes[0].item_code;
        setSelectedItemCode(currentItem);
      }

      if (!selectedRawMaterialCode && rmRes.length > 0) {
        setSelectedRawMaterialCode(rmRes[0].code);
      }

      // Fetch routes for the selected item
      if (currentItem) {
        loadItemRoute(currentItem);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load reference inventory data');
    }
  }

  async function loadItemRoute(code) {
    if (!code) return;
    try {
      const routes = await fetchItemRoutes(code);
      setRoutesMap(prev => ({ ...prev, [code]: routes }));
      if (routes && routes.length > 0 && routes[0].stages?.length > 0) {
        if (selectedStageSeq === null) {
          // Default to first stage
          setSelectedStageSeq(routes[0].stages[0].sequence_no);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  function handleItemChange(code) {
    setSelectedItemCode(code);
    setSelectedStageSeq(null);
    loadItemRoute(code);
  }

  async function loadHistory() {
    try {
      setHistoryLoading(true);
      const params = { limit: 50 };
      if (selectedItemCode && (targetType === 'finished_goods' || targetType === 'stage_wip')) {
        params.item_code = selectedItemCode;
      } else if (selectedRawMaterialCode && targetType === 'raw_material') {
        params.raw_material_code = selectedRawMaterialCode;
      }
      const data = await fetchStockAmendments(params);
      setHistoryList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  }

  // Calculate current stock based on targetType
  const currentItemStockInfo = stockByStageData?.items?.find(i => i.item_code === selectedItemCode);
  const currentRoutes = routesMap[selectedItemCode] || [];
  const primaryRoute = currentRoutes[0];
  const stages = primaryRoute?.stages || [];
  const selectedStageObj = stages.find(s => s.sequence_no === Number(selectedStageSeq));

  useEffect(() => {
    if (selectedStageObj) {
      if (!selectedStageObj.is_inhouse && selectedStageObj.vendor_id) {
        setSelectedVendorId(String(selectedStageObj.vendor_id));
      } else if (selectedStageObj.is_inhouse) {
        setSelectedVendorId('');
      }
    }
  }, [selectedStageSeq, selectedStageObj]);

  let currentStock = 0;
  let unitLabel = 'pcs';
  let stageName = '';

  if (targetType === 'finished_goods') {
    currentStock = currentItemStockInfo?.total_finished_quantity || 0;
    unitLabel = 'pcs';
  } else if (targetType === 'stage_wip') {
    unitLabel = 'pcs';
    if (selectedStageSeq !== null) {
      const stg = currentItemStockInfo?.stages_pipeline?.find(s => s.sequence_no === Number(selectedStageSeq));
      currentStock = stg?.current_quantity || 0;
      stageName = stg?.process_name || `Stage #${selectedStageSeq}`;
    }
  } else if (targetType === 'raw_material') {
    const rm = rawMaterials.find(r => r.code === selectedRawMaterialCode);
    currentStock = rm?.stock_quantity || 0;
    unitLabel = rm?.unit || 'kg';
  }

  const numQty = parseFloat(quantity) || 0;
  const projectedStock = adjustmentType === 'add' 
    ? currentStock + numQty 
    : currentStock - numQty;

  const isDeductTooMuch = adjustmentType === 'deduct' && numQty > currentStock;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (numQty <= 0) {
      setError('Please enter an amendment quantity greater than 0.');
      return;
    }

    if (isDeductTooMuch) {
      setError(`Cannot deduct ${numQty} ${unitLabel}: current stock is only ${currentStock} ${unitLabel}.`);
      return;
    }

    if (targetType === 'stage_wip' && (selectedStageSeq === null || selectedStageSeq === undefined)) {
      setError('Please select a specific manufacturing process stage.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        target_type: targetType,
        adjustment_type: adjustmentType,
        quantity: numQty,
        reason: reason,
        remarks: remarks.trim() || undefined
      };

      if (targetType === 'finished_goods') {
        payload.item_code = selectedItemCode;
      } else if (targetType === 'stage_wip') {
        payload.item_code = selectedItemCode;
        payload.stage_sequence = Number(selectedStageSeq);
        payload.stage_name = stageName;
        if (selectedVendorId) {
          payload.vendor_id = Number(selectedVendorId);
        }
      } else if (targetType === 'raw_material') {
        payload.raw_material_code = selectedRawMaterialCode;
      }

      const res = await amendStock(payload);
      setSuccessMsg(res.message || 'Stock amendment recorded successfully!');
      setQuantity('');
      setRemarks('');

      // Reload fresh stock and inform parent
      const freshStock = await fetchItemStocksByStage().catch(() => null);
      if (freshStock) setStockByStageData(freshStock);
      const freshRm = await fetchRawMaterials().catch(() => []);
      if (freshRm) setRawMaterials(freshRm);

      if (onSuccess) onSuccess(res);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to submit stock amendment');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center">
              <ArrowUpDown className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                Stock Amendment
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono font-normal">
                  Audit Verified
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Direct manual stock adjustment with physical variance & scrap audit logging
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('amend')}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  activeTab === 'amend'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Amend
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1 rounded-md font-semibold flex items-center gap-1 transition-all ${
                  activeTab === 'history'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Logs</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/50 text-red-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{successMsg}</div>
            </div>
          )}

          {activeTab === 'amend' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* 1. Target Inventory Category */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                  Select Inventory Type to Amend
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTargetType('finished_goods')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      targetType === 'finished_goods'
                        ? 'bg-cyan-950/70 border-cyan-500/80 text-white ring-1 ring-cyan-500/50 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Package className={`w-4 h-4 ${targetType === 'finished_goods' ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold">Finished Goods</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Ready for Production Assembly
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('stage_wip')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      targetType === 'stage_wip'
                        ? 'bg-cyan-950/70 border-cyan-500/80 text-white ring-1 ring-cyan-500/50 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Layers className={`w-4 h-4 ${targetType === 'stage_wip' ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold">Stage WIP</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Specific Process Stage WIP
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('raw_material')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      targetType === 'raw_material'
                        ? 'bg-cyan-950/70 border-cyan-500/80 text-white ring-1 ring-cyan-500/50 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Scale className={`w-4 h-4 ${targetType === 'raw_material' ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold">Raw Material</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Warehouse Stock Billet / Rod
                    </p>
                  </button>
                </div>
              </div>

              {/* 2. Target Selection (Item / Stage or Raw Material) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                {targetType !== 'raw_material' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Select Item / Part
                      </label>
                      <select
                        value={selectedItemCode}
                        onChange={(e) => handleItemChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                      >
                        {items.map(it => (
                          <option key={it.item_code} value={it.item_code}>
                            {it.item_code} - {it.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {targetType === 'stage_wip' ? (
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Select Manufacturing Stage
                        </label>
                        <select
                          value={selectedStageSeq || ''}
                          onChange={(e) => setSelectedStageSeq(e.target.value ? Number(e.target.value) : null)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                        >
                          <option value="">-- Choose Process Stage --</option>
                          {stages.map(s => (
                            <option key={s.id || s.sequence_no} value={s.sequence_no}>
                              Stage #{s.sequence_no}: {s.process_name} ({s.is_inhouse ? 'In-House' : (s.vendor_name || 'Vendor')})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Target Process Stage
                        </label>
                        <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-emerald-400 font-semibold flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Finished Product (Ready for Assembly)</span>
                        </div>
                      </div>
                    )}

                    {targetType === 'stage_wip' && selectedStageObj && !selectedStageObj.is_inhouse && (
                      <div className="sm:col-span-2 p-3 bg-slate-900/90 rounded-xl border border-indigo-900/60 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Assigned Subcontract Vendor</span>
                          </label>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Stock will reflect in Vendor Stocks page
                          </span>
                        </div>
                        <select
                          value={selectedVendorId || ''}
                          onChange={(e) => setSelectedVendorId(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none font-medium"
                        >
                          <option value="">-- Choose Subcontract Vendor --</option>
                          {vendors.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.code} - {v.name} ({v.processes_offered || 'Vendor'})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Select Raw Material
                    </label>
                    <select
                      value={selectedRawMaterialCode}
                      onChange={(e) => setSelectedRawMaterialCode(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                    >
                      {rawMaterials.map(rm => (
                        <option key={rm.code} value={rm.code}>
                          {rm.code} - {rm.name} (Grade: {rm.grade}, Stock: {rm.stock_quantity} {rm.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 3. +/- Action & Quantity Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Adjustment Direction
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustmentType('add')}
                      className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        adjustmentType === 'add'
                          ? 'bg-emerald-950 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/50 shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Plus className="w-4 h-4 text-emerald-400" />
                      <span>Add (+) Stock</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdjustmentType('deduct')}
                      className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        adjustmentType === 'deduct'
                          ? 'bg-rose-950 border-rose-500 text-rose-300 ring-1 ring-rose-500/50 shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Minus className="w-4 h-4 text-rose-400" />
                      <span>Deduct (-) Stock</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Quantity to Amend ({unitLabel})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={targetType === 'raw_material' ? 'any' : '1'}
                      min={targetType === 'raw_material' ? '0.001' : '1'}
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder={targetType === 'raw_material' ? 'e.g. 25.5' : 'e.g. 25'}
                      className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-white focus:outline-none transition-colors ${
                        isDeductTooMuch 
                          ? 'border-rose-500 text-rose-400' 
                          : 'border-slate-700 focus:border-cyan-500'
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      {unitLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Real-time Calculation Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Stock Impact Calculation</span>
                  <span className="font-mono text-cyan-400">
                    {targetType === 'finished_goods' ? 'Finished Stock' : (targetType === 'stage_wip' ? `${stageName || 'Stage'} WIP` : 'Raw Material')}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-center">
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Current Stock</div>
                    <div className="text-base font-black font-mono text-white">
                      {currentStock} <span className="text-xs font-normal text-slate-400">{unitLabel}</span>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Amendment</div>
                    <div className={`text-base font-black font-mono ${adjustmentType === 'add' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {numQty > 0 ? (adjustmentType === 'add' ? `+${numQty}` : `-${numQty}`) : '0'} 
                      <span className="text-xs font-normal text-slate-400"> {unitLabel}</span>
                    </div>
                  </div>

                  <div className={`p-2 rounded-lg border ${
                    isDeductTooMuch 
                      ? 'bg-rose-950/40 border-rose-500/80 text-rose-300' 
                      : 'bg-cyan-950/40 border-cyan-500/60 text-cyan-300'
                  }`}>
                    <div className="text-[10px] text-slate-400">Projected New Stock</div>
                    <div className="text-base font-black font-mono">
                      {numQty > 0 ? projectedStock : currentStock} 
                      <span className="text-xs font-normal opacity-80"> {unitLabel}</span>
                    </div>
                  </div>
                </div>

                {isDeductTooMuch && (
                  <div className="text-[11px] text-rose-400 flex items-center gap-1.5 pt-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Insufficient inventory! You cannot deduct more than current stock ({currentStock} {unitLabel}).</span>
                  </div>
                )}
              </div>

              {/* 4. Reason & Remarks */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Reason for Amendment <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                  >
                    {REASON_OPTIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Remarks / Engineer Notes <span className="text-slate-500 font-normal">(Optional audit notes)</span>
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g., Physical count done by Quality Team on rack A4"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Footer Actions */}
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
                  disabled={loading || isDeductTooMuch || numQty <= 0}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 ${
                    isDeductTooMuch || numQty <= 0
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                      : adjustmentType === 'add'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 cursor-pointer font-black'
                        : 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white cursor-pointer font-black'
                  }`}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Applying Amendment...</span>
                    </>
                  ) : (
                    <>
                      {adjustmentType === 'add' ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                      <span>Apply {adjustmentType === 'add' ? '+' : '-'}{numQty || ''} Stock Amendment</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          ) : (
            /* Audit Logs View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-cyan-400" />
                  Recent Stock Amendment Audit Records
                </h3>
                <button
                  type="button"
                  onClick={loadHistory}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 px-2"
                >
                  <RefreshCw className={`w-3 h-3 ${historyLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {historyLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading audit history...</div>
              ) : historyList.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No stock amendments recorded yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                  {historyList.map(h => (
                    <div key={h.id} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-slate-400">
                            {h.amendment_no}
                          </span>
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                            h.adjustment_type === 'add'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                              : 'bg-rose-950 text-rose-300 border border-rose-700'
                          }`}>
                            {h.adjustment_type === 'add' ? '+' : '-'}{h.quantity}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                            {h.target_type}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {h.created_at}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300 pt-1">
                        <div>
                          {h.item_code && <span className="font-bold text-cyan-400 font-mono mr-2">{h.item_code}</span>}
                          {h.stage_name && <span className="text-slate-400">[{h.stage_name}]</span>}
                          {h.raw_material_code && <span className="font-bold text-amber-400 font-mono mr-2">{h.raw_material_code}</span>}
                          <span className="text-slate-200 ml-1">• {h.reason}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {h.previous_stock} &rarr; <span className="font-bold text-white">{h.new_stock}</span>
                        </div>
                      </div>

                      {h.remarks && (
                        <div className="text-[11px] text-slate-400 italic pt-0.5 border-t border-slate-900">
                          Note: {h.remarks}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
