import React, { useState, useEffect } from 'react';
import { 
  X, Scale, Plus, ArrowRight, AlertTriangle, CheckCircle, 
  Layers, Package, ShieldCheck, Truck
} from 'lucide-react';
import { fetchRawMaterials, fetchItems, fetchItemRoutes, createBatch } from '../api';

export default function IssueRawMaterialModal({ onClose, onSuccess }) {
  const [rawMaterials, setRawMaterials] = useState([]);
  const [items, setItems] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form
  const [selectedRMCode, setSelectedRMCode] = useState('');
  const [quantityUsed, setQuantityUsed] = useState('');
  const [selectedItemCode, setSelectedItemCode] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [batchNo, setBatchNo] = useState(`BATCH-${new Date().getFullYear()}-${Date.now().toString().slice(-3)}`);
  const [targetQuantity, setTargetQuantity] = useState(100);
  const [isCritical, setIsCritical] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedItemCode) {
      loadRoutes(selectedItemCode);
    } else {
      setRoutes([]);
      setSelectedRouteId('');
    }
  }, [selectedItemCode]);

  async function loadData() {
    try {
      const [rmData, itemsData] = await Promise.all([
        fetchRawMaterials(),
        fetchItems()
      ]);
      setRawMaterials(rmData);
      setItems(itemsData);
      if (rmData.length > 0) setSelectedRMCode(rmData[0].code);
      if (itemsData.length > 0) setSelectedItemCode(itemsData[0].item_code);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadRoutes(itemCode) {
    try {
      const data = await fetchItemRoutes(itemCode);
      setRoutes(data);
      if (data.length > 0) {
        setSelectedRouteId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const selectedRM = rawMaterials.find(rm => rm.code === selectedRMCode);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedRMCode || !selectedItemCode || !selectedRouteId) {
      setError('Please select Raw Material, Target Item, and Process Route.');
      return;
    }
    if (!quantityUsed || parseFloat(quantityUsed) <= 0) {
      setError('Please enter a valid raw material quantity.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await createBatch({
        batch_no: batchNo,
        item_code: selectedItemCode,
        route_id: parseInt(selectedRouteId, 10),
        quantity_total: parseInt(targetQuantity, 10),
        raw_material_code: selectedRMCode,
        raw_material_quantity: parseFloat(quantityUsed),
        raw_material_unit: selectedRM?.unit || 'kg',
        is_critical: isCritical,
        notes: notes || `Issued ${quantityUsed} ${selectedRM?.unit} of ${selectedRMCode}`
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to issue raw material');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-950 text-amber-400 rounded-xl border border-amber-800/60">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Issue Raw Material for Target Item
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Allocate raw stock by Weight / Length to launch a manufactured item batch
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/80 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Raw Material Selection */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold uppercase text-amber-400 flex items-center gap-1.5">
              <span>Step 1: Select Raw Material Stock (Weight / Length)</span>
            </h4>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Raw Material Code & Grade
              </label>
              <select
                value={selectedRMCode}
                onChange={(e) => setSelectedRMCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
              >
                {rawMaterials.map(rm => (
                  <option key={rm.code} value={rm.code}>
                    {rm.code} - {rm.name} (Stock: {rm.stock_quantity} {rm.unit})
                  </option>
                ))}
              </select>
            </div>

            {selectedRM && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">
                    Quantity to Issue ({selectedRM.unit}) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    min="0.1"
                    max={selectedRM.stock_quantity}
                    placeholder={`e.g. 450`}
                    value={quantityUsed}
                    onChange={(e) => setQuantityUsed(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Stock Available</label>
                  <div className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-emerald-400 font-mono text-xs">
                    {selectedRM.stock_quantity} {selectedRM.unit} (Heat: {selectedRM.heat_number || 'N/A'})
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Target Item Conversion */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold uppercase text-cyan-400 flex items-center gap-1.5">
              <span>Step 2: Conversion to Manufactured Item Code</span>
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Target Item Code <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedItemCode}
                  onChange={(e) => setSelectedItemCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-cyan-400 focus:outline-none focus:border-cyan-500"
                >
                  {items.map(item => (
                    <option key={item.item_code} value={item.item_code}>
                      {item.item_code} - {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Target Batch Size (Pcs) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={targetQuantity}
                  onChange={(e) => setTargetQuantity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Select Manufacturing Process Route
              </label>
              <select
                value={selectedRouteId}
                onChange={(e) => setSelectedRouteId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {routes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.route_name} ({r.stages?.length || 0} Stages)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Batch / Lot Number</label>
                <input
                  type="text"
                  required
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-red-400 font-semibold">
                  <input
                    type="checkbox"
                    checked={isCritical}
                    onChange={(e) => setIsCritical(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-red-600 focus:ring-0"
                  />
                  <span>Mark as CRITICAL Order</span>
                </label>
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
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/30 flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{loading ? 'Processing...' : 'Issue Stock & Launch Batch'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
