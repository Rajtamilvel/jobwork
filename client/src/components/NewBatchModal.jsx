import React, { useState, useEffect } from 'react';
import { 
  X, PlusCircle, CheckCircle2, AlertTriangle, Layers, 
  ShieldAlert, FileText, ArrowRight, Truck, Clock
} from 'lucide-react';
import { fetchItems, fetchItemRoutes, createBatch } from '../api';

export default function NewBatchModal({ onClose, onSuccess, initialItemCode, initialRouteId, initialQuantity }) {
  const [items, setItems] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [selectedItemCode, setSelectedItemCode] = useState(initialItemCode || '');
  const [selectedRouteId, setSelectedRouteId] = useState(initialRouteId || '');
  const [batchNo, setBatchNo] = useState(`WO-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`);
  const [quantityTotal, setQuantityTotal] = useState(initialQuantity || 200);
  const [isCritical, setIsCritical] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (selectedItemCode) {
      loadRoutes(selectedItemCode);
    }
  }, [selectedItemCode]);

  async function loadItems() {
    try {
      const itData = await fetchItems();
      setItems(itData);
      if (!selectedItemCode && itData.length > 0) {
        setSelectedItemCode(initialItemCode || itData[0].item_code);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadRoutes(itemCode) {
    try {
      const data = await fetchItemRoutes(itemCode);
      setRoutes(data);
      if (data.length > 0) {
        if (initialRouteId && data.some(r => r.id === Number(initialRouteId))) {
          setSelectedRouteId(Number(initialRouteId));
        } else {
          setSelectedRouteId(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedItemCode || !selectedRouteId) {
      setError('Please select Item Code and Process Route.');
      return;
    }
    if (quantityTotal <= 0) {
      setError('Quantity must be greater than 0.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await createBatch({
        batch_no: batchNo,
        item_code: selectedItemCode,
        route_id: parseInt(selectedRouteId, 10),
        quantity_total: parseInt(quantityTotal, 10),
        is_critical: isCritical,
        notes: notes || `Batch for ${selectedItemCode}`
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create work order batch');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-950 text-cyan-400 rounded-xl border border-cyan-800/60">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Launch New Production Batch
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Item code remains constant from start to finished product
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

          {/* Item & Batch Number */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Select Item Code *
              </label>
              <select
                value={selectedItemCode}
                onChange={(e) => setSelectedItemCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono font-bold text-cyan-400 focus:outline-none focus:border-cyan-500"
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
                Batch / Lot # *
              </label>
              <input
                type="text"
                required
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Process Route Selection */}
          <div>
            <label className="block text-xs text-slate-300 mb-1">
              Select Process Route *
            </label>
            <select
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              {routes.length === 0 ? (
                <option value="">No routes configured for this item</option>
              ) : (
                routes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.route_name} ({r.stages?.length || 0} Sequential Stages)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Quantity & Critical Toggle */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Batch Quantity (Pcs) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={quantityTotal}
                onChange={(e) => setQuantityTotal(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
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
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span>Mark as CRITICAL</span>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Production Notes</label>
            <input
              type="text"
              placeholder="e.g. Export urgent requirement, dispatch priority"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            />
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
              <span>{loading ? 'Starting...' : 'Start Batch Production'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
