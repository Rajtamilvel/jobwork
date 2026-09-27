import React, { useState, useEffect } from 'react';
import { 
  Layers, Plus, Search, ChevronRight, ChevronDown, Truck, Clock, 
  Flame, CheckCircle2, ArrowRight, RefreshCw, Box, Boxes, Trash2, AlertTriangle,
  ArrowUpDown, Edit3, List, LayoutGrid, Lock, PackageCheck, Sparkles, Filter
} from 'lucide-react';
import { fetchItems, fetchItemRoutes, deleteItem } from '../api';
import EditItemModal from './EditItemModal';
import StockAmendmentModal from './StockAmendmentModal';

export default function ItemsRouteView({ onOpenAddModal, onLaunchBatch, onViewItemStocks }) {
  const [items, setItems] = useState([]);
  const [itemRoutes, setItemRoutes] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' (default expandable table) | 'cards'
  const [deletingCode, setDeletingCode] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [amendingItem, setAmendingItem] = useState(null);
  const [showStockAmendmentModal, setShowStockAmendmentModal] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      setLoading(true);
      const data = await fetchItems();
      setItems(data);

      // Fetch routes for each item
      const routesMap = {};
      for (const itm of data) {
        try {
          const r = await fetchItemRoutes(itm.item_code);
          routesMap[itm.item_code] = r;
        } catch (e) {
          console.error(e);
        }
      }
      setItemRoutes(routesMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteItem(item) {
    if (item.active_batches_count > 0) {
      alert(`Cannot remove item "${item.item_code}" because it currently has ${item.active_batches_count} active batch(es) in production.`);
      return;
    }

    const confirmRemove = window.confirm(
      `Are you sure you want to permanently remove item "${item.item_code} - ${item.name}" and all its sequential process routes?\n\nThis action cannot be undone.`
    );
    if (!confirmRemove) return;

    try {
      setDeletingCode(item.item_code);
      setActionError(null);
      setActionSuccess(null);
      await deleteItem(item.item_code);
      setActionSuccess(`Item "${item.item_code}" and its process routes were removed successfully.`);
      await loadItems();
    } catch (err) {
      console.error(err);
      setActionError(err.message || 'Failed to remove item');
    } finally {
      setDeletingCode(null);
    }
  }

  function toggleExpand(itemCode) {
    setExpandedItems(prev => ({
      ...prev,
      [itemCode]: !prev[itemCode]
    }));
  }

  const filtered = items.filter(i => 
    i.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (i.material_code && i.material_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (i.raw_material_name && i.raw_material_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const allExpanded = filtered.length > 0 && filtered.every(i => Boolean(expandedItems[i.item_code]));

  function toggleExpandAll() {
    const nextState = !allExpanded;
    const next = {};
    filtered.forEach(i => {
      next[i.item_code] = nextState;
    });
    setExpandedItems(prev => ({ ...prev, ...next }));
  }

  return (
    <div className="space-y-5">
      
      {/* ─── HEADER: Title & Primary Actions ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400 shadow-sm">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">Items Master & Process Routes</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-mono font-semibold">
                {filtered.length} items
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Part drawings, linked raw materials, and sequential jobwork subcontract manufacturing routes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowStockAmendmentModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/70 text-xs font-bold shadow-sm transition-all cursor-pointer"
            title="Open manual stock amendment (+ / -) modal"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>+/- Stock Amendment</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item & Route</span>
          </button>

          <button
            onClick={loadItems}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            title="Refresh Items"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Alerts */}
      {actionError && (
        <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* ─── STREAMLINED CONTROL TOOLBAR ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Item Code, Part Name, Drawing, or RM..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 text-white rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 placeholder-slate-500 transition-colors"
          />
        </div>

        {/* View and Expand Toggles */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Expand All / Collapse All Button */}
          <button
            onClick={toggleExpandAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-800 transition-colors cursor-pointer"
            title={allExpanded ? "Collapse all item process routes" : "Expand all item process routes"}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${allExpanded ? 'rotate-180 text-cyan-400' : 'text-slate-400'}`} />
            <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
          </button>

          {/* View Mode Toggle: List View (Default) vs Cards View */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700/80'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Compact Table List View with Expandable Process Routes"
            >
              <List className="w-3.5 h-3.5" />
              <span>List View</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700/80'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Visual Cards View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards View</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── 1. LIST VIEW (PROPORTIONALLY ALIGNED TABLE WITH EXPANDABLE ROUTES) ─── */}
      {viewMode === 'list' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="text-center py-16 text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              <span className="text-xs">Loading items & process routes...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500 bg-slate-900 rounded-xl">
              No items found. Click "+ Add Item & Route" above to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <colgroup>
                  <col style={{ width: '48px' }} />
                  <col style={{ width: '130px' }} />
                  <col style={{ minWidth: '220px' }} />
                  <col style={{ width: '220px' }} />
                  <col style={{ width: '240px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '250px' }} />
                </colgroup>
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold text-[11px]">
                    <th className="py-3 px-3 text-center">
                      <button
                        onClick={toggleExpandAll}
                        className="p-1 rounded text-slate-400 hover:text-white"
                        title={allExpanded ? "Collapse All Rows" : "Expand All Rows"}
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${allExpanded ? 'rotate-180 text-cyan-400' : ''}`} />
                      </button>
                    </th>
                    <th className="py-3 px-3">Item Code</th>
                    <th className="py-3 px-4">Part Name & Drawing</th>
                    <th className="py-3 px-4">Raw Material Link</th>
                    <th className="py-3 px-4">Process Route & Cycle</th>
                    <th className="py-3 px-3 text-center">Active Batches</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filtered.map(item => {
                    const routes = itemRoutes[item.item_code] || [];
                    const primaryRoute = routes[0];
                    const stages = primaryRoute?.stages || [];
                    const isExpanded = Boolean(expandedItems[item.item_code]);
                    const totalLeadTime = stages.reduce((acc, s) => acc + (s.lead_time_days || 0), 0);

                    return (
                      <React.Fragment key={item.id}>
                        {/* Main Item Row */}
                        <tr 
                          onClick={() => toggleExpand(item.item_code)}
                          className={`group transition-colors cursor-pointer ${
                            isExpanded 
                              ? 'bg-slate-800/60 border-l-2 border-l-cyan-400' 
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-3.5 px-3 text-center align-middle">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(item.item_code);
                              }}
                              className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                              title={isExpanded ? "Collapse process route" : "Expand process route"}
                            >
                              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-cyan-400' : 'text-slate-500'}`} />
                            </button>
                          </td>

                          <td className="py-3.5 px-3 align-middle font-mono font-bold">
                            <span className="text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded border border-cyan-800/80 inline-block text-xs">
                              {item.item_code}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 align-middle">
                            <div className="font-bold text-white text-xs leading-snug group-hover:text-cyan-300 transition-colors">
                              {item.name}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                              <span>Dwg: <code className="text-slate-300">{item.drawing_no || 'N/A'}</code></span>
                              {item.notes && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-500 truncate max-w-xs">{item.notes}</span>
                                </>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-middle">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.material_code ? (
                                <span className="font-mono font-bold text-xs text-amber-300 bg-amber-950/70 px-2 py-0.5 rounded border border-amber-800/70">
                                  {item.material_code}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-500 italic">No RM</span>
                              )}
                              {item.weight !== undefined && item.weight !== null && item.weight > 0 && (
                                <span className="font-mono text-xs font-semibold text-cyan-300 bg-cyan-950/70 px-2 py-0.5 rounded border border-cyan-800/70">
                                  {item.weight} kg
                                </span>
                              )}
                            </div>
                            {item.raw_material_name && (
                              <div className="text-[10px] text-slate-400 mt-1 truncate max-w-[200px]" title={item.raw_material_name}>
                                {item.raw_material_name}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 align-middle">
                            {primaryRoute ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-slate-200 text-xs">
                                    {primaryRoute.route_name}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 border border-slate-700 text-[10px] font-mono font-bold">
                                    {stages.length} Stages
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  <span>~{totalLeadTime} Days Total Cycle</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-xs">No route configured</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-center align-middle">
                            {item.active_batches_count > 0 ? (
                              <span className="px-2.5 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700 text-[10px] font-bold inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                                <span>{item.active_batches_count} Active</span>
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs font-mono">-</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center align-middle">
                            <div 
                              className="flex items-center justify-center gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => onLaunchBatch(item)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-600 hover:text-white text-cyan-300 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                                title="Launch new batch"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Batch</span>
                              </button>

                              <button
                                onClick={() => setEditingItem(item)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                                title="Edit part specs & process route stages"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Edit</span>
                              </button>

                              <button
                                onClick={() => setAmendingItem(item)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 hover:text-white text-xs font-semibold border border-emerald-700/60 transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                                title="Manual Stock Amendment (+ / -)"
                              >
                                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Stock</span>
                              </button>

                              {onViewItemStocks && (
                                <button
                                  onClick={() => onViewItemStocks(item.item_code)}
                                  className="p-1.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 text-cyan-300 hover:text-white border border-cyan-700/60 transition-colors shadow-sm cursor-pointer"
                                  title="View stage-by-stage stocks & pipeline"
                                >
                                  <Boxes className="w-3.5 h-3.5 text-cyan-400" />
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteItem(item)}
                                disabled={deletingCode === item.item_code || item.active_batches_count > 0}
                                className={`p-1.5 rounded-lg border transition-all ${
                                  item.active_batches_count > 0
                                    ? 'bg-slate-900/50 text-slate-700 border-slate-800 cursor-not-allowed'
                                    : 'bg-slate-800 hover:bg-red-950 hover:text-red-300 text-slate-400 border-slate-700 cursor-pointer'
                                }`}
                                title={item.active_batches_count > 0 ? "Cannot delete with active batches" : "Remove item"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Sub-Row (Route Sequence Flow) */}
                        {isExpanded && (
                          <tr className="bg-slate-950/90 border-b border-slate-800 animate-in fade-in duration-150">
                            <td colSpan="7" className="p-4 pl-12 space-y-3">
                              {primaryRoute ? (
                                <div className="space-y-3">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                        <Layers className="w-3.5 h-3.5 text-cyan-400" />
                                        <span>Process Route Sequence:</span>
                                      </span>
                                      <span className="text-xs text-cyan-300 font-semibold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                                        {primaryRoute.route_name}
                                      </span>
                                      <span className="text-[11px] text-slate-400">
                                        ({stages.length} Sequential Stages • ~{totalLeadTime} Days Total Cycle)
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setEditingItem(item)}
                                        className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                        <span>Edit Stages</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Horizontal Visual Flowchart */}
                                  <div className="flex items-center gap-2 overflow-x-auto py-2 pr-2">
                                    {stages.map((stage, idx) => {
                                      const isFinal = stage.process_name?.toLowerCase() === 'finished product' || idx === stages.length - 1;

                                      return (
                                        <React.Fragment key={stage.id || idx}>
                                          <div className={`shrink-0 p-3 rounded-xl text-xs space-y-1.5 min-w-[145px] shadow-sm ${
                                            isFinal
                                              ? 'bg-gradient-to-b from-slate-950 to-emerald-950/30 border border-emerald-500/60 ring-1 ring-emerald-500/20'
                                              : 'bg-slate-900 border border-slate-800 hover:border-slate-700'
                                          }`}>
                                            <div className="flex items-center justify-between">
                                              <span className={`text-[10px] font-mono ${isFinal ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                                                Stage #{stage.sequence_no}
                                              </span>
                                              {stage.is_welding_stage ? (
                                                <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-600 text-[9px] font-bold">
                                                  WELD
                                                </span>
                                              ) : isFinal ? (
                                                <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 text-[8px] font-bold">
                                                  ASSEMBLY
                                                </span>
                                              ) : null}
                                            </div>

                                            <div className={`font-bold text-xs truncate ${isFinal ? 'text-emerald-300' : 'text-white'}`} title={stage.process_name}>
                                              {stage.process_name}
                                            </div>

                                            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
                                              <span className="truncate max-w-[90px]">
                                                {isFinal ? 'In-House Store' : (stage.is_inhouse ? 'In-House' : (stage.vendor_name || 'Vendor'))}
                                              </span>
                                              <span className={`font-mono font-semibold ${isFinal ? 'text-emerald-400' : 'text-cyan-400'}`}>
                                                {stage.lead_time_days}d
                                              </span>
                                            </div>
                                          </div>

                                          {idx < stages.length - 1 && (
                                            <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                  </div>

                                  {item.notes && (
                                    <div className="text-[11px] text-slate-400 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                                      <strong className="text-slate-300">Engineering Notes:</strong> {item.notes}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500 italic">
                                  No sequential route configured for this item yet.
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ─── 2. CARDS VIEW (LARGE VISUAL PROCESS BLOCKS) ─── */
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-16 text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              <span className="text-xs">Loading items & process routes...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500 bg-slate-900 rounded-xl border border-slate-800">
              No items found. Click "+ Add Item & Route" above to create one.
            </div>
          ) : (
            filtered.map(item => {
              const routes = itemRoutes[item.item_code] || [];
              const primaryRoute = routes[0];
              const stages = primaryRoute?.stages || [];
              const isExpanded = Boolean(expandedItems[item.item_code]);

              return (
                <div 
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 hover:border-slate-700 transition-all"
                >
                  {/* Item Summary Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-base font-black text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded border border-cyan-800">
                          {item.item_code}
                        </span>
                        <h3 className="text-base font-bold text-white">{item.name}</h3>
                        {item.material_code && (
                          <span className="font-mono text-xs font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                            RM: {item.material_code}
                          </span>
                        )}
                        {item.weight !== undefined && item.weight !== null && item.weight > 0 && (
                          <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                            {item.weight} kg
                          </span>
                        )}
                        {item.active_batches_count > 0 && (
                          <span className="px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 text-[10px] font-bold">
                            {item.active_batches_count} Active Batch{item.active_batches_count > 1 ? 'es' : ''}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
                        {item.raw_material_name && (
                          <span>RM Name: <span className="text-slate-300 font-medium">{item.raw_material_name}</span></span>
                        )}
                        {item.notes && <span>• {item.notes}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                      <button
                        onClick={() => onLaunchBatch(item)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-600 hover:text-white text-cyan-300 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Launch Batch</span>
                      </button>

                      <button
                        onClick={() => setEditingItem(item)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                        title="Edit part specs & process route stages"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => setAmendingItem(item)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 hover:text-white text-xs font-semibold border border-emerald-700/60 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                        title="Manual Stock Amendment (+ / -)"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
                        <span>+/- Stock</span>
                      </button>

                      {onViewItemStocks && (
                        <button
                          onClick={() => onViewItemStocks(item.item_code)}
                          className="px-3 py-1.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 text-cyan-300 hover:text-white text-xs font-semibold border border-cyan-700/60 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                          title="View stage-by-stage stocks & pipeline for this item"
                        >
                          <Boxes className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Stage Stocks</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteItem(item)}
                        disabled={deletingCode === item.item_code || item.active_batches_count > 0}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                          item.active_batches_count > 0
                            ? 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed'
                            : 'bg-slate-800 hover:bg-red-950/80 hover:border-red-500/60 text-slate-400 hover:text-red-300 border-slate-700 cursor-pointer'
                        }`}
                        title={item.active_batches_count > 0 ? `Cannot remove: ${item.active_batches_count} active batch(es) in production` : `Remove item ${item.item_code} and all its routes`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{deletingCode === item.item_code ? 'Removing...' : 'Remove Item'}</span>
                      </button>

                      <button
                        onClick={() => toggleExpand(item.item_code)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                          isExpanded
                            ? 'bg-cyan-950/70 text-cyan-300 border-cyan-700/60 hover:bg-cyan-900/80'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                        }`}
                        title={isExpanded ? "Collapse route stages" : "Expand route stages"}
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-cyan-400' : ''}`} />
                        <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Configured Process Route Stages */}
                  {isExpanded && (
                    primaryRoute ? (
                      <div className="space-y-2 animate-in fade-in duration-150 pt-1">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-semibold text-slate-300">
                            Process Route: {primaryRoute.route_name} ({stages.length} Stages)
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Sequential Manufacturing Sequence
                          </span>
                        </div>

                        {/* Visual Route Sequence Flow */}
                        <div className="flex items-center gap-2 overflow-x-auto py-2 pr-2">
                          {stages.map((stage, idx) => {
                            const isFinal = stage.process_name?.toLowerCase() === 'finished product' || idx === stages.length - 1;

                            return (
                              <React.Fragment key={stage.id || idx}>
                                <div className={`shrink-0 p-2.5 rounded-lg text-xs space-y-1 min-w-[135px] ${
                                  isFinal
                                    ? 'bg-gradient-to-b from-slate-950 to-emerald-950/25 border border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/20'
                                    : 'bg-slate-950 border border-slate-800'
                                }`}>
                                  <div className="flex items-center justify-between">
                                    <span className={`text-[10px] font-mono ${isFinal ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                                      Stage #{stage.sequence_no}
                                    </span>
                                    {stage.is_welding_stage ? (
                                      <span className="px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-600 text-[9px] font-bold">
                                        WELD
                                      </span>
                                    ) : isFinal ? (
                                      <span className="px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 text-[8px] font-bold">
                                        ASSEMBLY
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className={`font-bold text-xs truncate ${isFinal ? 'text-emerald-300' : 'text-white'}`} title={stage.process_name}>
                                    {stage.process_name}
                                  </div>

                                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
                                    <span className="truncate max-w-[85px]">
                                      {isFinal ? 'In-House Store' : (stage.is_inhouse ? 'In-House' : (stage.vendor_name || 'Vendor'))}
                                    </span>
                                    <span className={`font-mono font-semibold ${isFinal ? 'text-emerald-400' : 'text-cyan-400'}`}>{stage.lead_time_days}d</span>
                                  </div>
                                </div>

                                {idx < stages.length - 1 && (
                                  <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic pt-1">
                        No route configured yet.
                      </div>
                    )
                  )}

                </div>
              );
            })
          )}
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSuccess={() => {
            setActionSuccess(`Item "${editingItem.item_code}" was updated successfully.`);
            loadItems();
          }}
        />
      )}

      {/* Stock Amendment Modal */}
      {(showStockAmendmentModal || amendingItem) && (
        <StockAmendmentModal
          initialItem={amendingItem || undefined}
          onClose={() => {
            setShowStockAmendmentModal(false);
            setAmendingItem(null);
          }}
          onSuccess={() => {
            setActionSuccess('Stock amendment applied successfully.');
            loadItems();
          }}
        />
      )}

    </div>
  );
}
