import React, { useState, useEffect } from 'react';
import { 
  Scale, Plus, Search, AlertCircle, Layers, 
  CheckCircle, ArrowRight, ShieldCheck, Box
} from 'lucide-react';
import { fetchRawMaterials, addRawMaterial } from '../api';

export default function RawMaterialView({ onOpenIssueModal }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New RM form
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [form, setForm] = useState('Round Bar');
  const [unit, setUnit] = useState('kg');
  const [stockQuantity, setStockQuantity] = useState('');
  const [heatNumber, setHeatNumber] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadMaterials();
  }, []);

  async function loadMaterials() {
    try {
      setLoading(true);
      const data = await fetchRawMaterials();
      setMaterials(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMaterial(e) {
    e.preventDefault();
    try {
      setSubmitting(true);
      await addRawMaterial({
        code,
        name,
        grade,
        form,
        unit,
        stock_quantity: parseFloat(stockQuantity || 0),
        heat_number: heatNumber,
        unit_cost: parseFloat(unitCost || 0),
        notes
      });
      setShowAddModal(false);
      resetForm();
      loadMaterials();
    } catch (err) {
      alert(err.message || 'Failed to add raw material');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setCode('');
    setName('');
    setGrade('');
    setForm('Round Bar');
    setUnit('kg');
    setStockQuantity('');
    setHeatNumber('');
    setUnitCost('');
    setNotes('');
  }

  const filtered = materials.filter(m => 
    m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.grade.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.form.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-400" />
            <span>Raw Material Master Inventory</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Tracked by <strong>Weight (kg/MT)</strong> or <strong>Length (meters/mm)</strong>. Raw material codes are independent and issued across multiple item codes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>+ Add Raw Material Stock</span>
          </button>

          <button
            onClick={onOpenIssueModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-600/20 transition-all"
          >
            <Scale className="w-4 h-4" />
            <span>Issue Stock for Item</span>
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search raw material code, grade, form..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900 text-white rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 placeholder-slate-500"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold text-[11px]">
                <th className="py-3 px-4">RM Code & Grade</th>
                <th className="py-3 px-4">Material Name & Form</th>
                <th className="py-3 px-4">Unit of Measure</th>
                <th className="py-3 px-4 text-right">Available Stock</th>
                <th className="py-3 px-4">Heat / TC Lot #</th>
                <th className="py-3 px-4 text-right">Rate / Unit</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">Loading raw materials...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500">No raw materials found.</td>
                </tr>
              ) : (
                filtered.map(rm => (
                  <tr key={rm.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60 inline-block">
                        {rm.code}
                      </div>
                      <div className="text-[11px] text-slate-300 font-medium mt-1">{rm.grade}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-white font-medium">{rm.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Form: <span className="text-cyan-300">{rm.form}</span></div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                        {rm.unit}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-mono">
                      <span className={`text-sm font-bold ${
                        rm.stock_quantity > 100 ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {rm.stock_quantity}
                      </span>
                      <span className="text-slate-500 ml-1">{rm.unit}</span>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-400">
                      {rm.heat_number || 'N/A'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      ₹{rm.unit_cost?.toFixed(2) || '0.00'}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={onOpenIssueModal}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-amber-600 hover:text-white text-amber-400 text-xs font-medium border border-slate-700 transition-colors inline-flex items-center gap-1"
                      >
                        <span>Issue</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Raw Material Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                <span>Add New Raw Material Stock</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMaterial} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">RM Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RM-EN8-RD50"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Material Grade *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EN8 / AISI 304"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Full Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EN8 Carbon Steel Round Bar Ø50mm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Stock Form</label>
                  <select
                    value={form}
                    onChange={(e) => setForm(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Round Bar">Round Bar</option>
                    <option value="Flat Bar">Flat Bar</option>
                    <option value="Plate">Plate / Sheet</option>
                    <option value="Hex Bar">Hex Bar</option>
                    <option value="Hollow Tube">Hollow Tube</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Unit of Measure</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="meters">Meters (m)</option>
                    <option value="mm">Millimeters (mm)</option>
                    <option value="MT">Metric Tons (MT)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Quantity Stock</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="e.g. 1500"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Heat / TC Number</label>
                  <input
                    type="text"
                    placeholder="e.g. HT-9842"
                    value={heatNumber}
                    onChange={(e) => setHeatNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Unit Cost (₹)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 68.5"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
                >
                  {submitting ? 'Saving...' : 'Save Raw Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
