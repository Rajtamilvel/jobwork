import React, { useState, useEffect } from 'react';
import { 
  Boxes, Search, RefreshCw, ChevronDown, ChevronRight, 
  Truck, Clock, AlertTriangle, CheckCircle2, ShieldAlert, 
  Plus, PhoneCall, FileText, Package, Filter, 
  ArrowRight, Factory, ArrowUpDown, Edit3, Printer,
  Building2, Eye, ExternalLink, Calendar, MapPin
} from 'lucide-react';
import { fetchItemStocksByStage } from '../api';
import EditItemModal from './EditItemModal';
import StockAmendmentModal from './StockAmendmentModal';

export default function ItemStockStagesView({ 
  selectedItemCode: controlledSelectedItemCode,
  onSelectItem: controlledOnSelectItem,
  onAdvanceStage, 
  onOpenFollowup, 
  onViewChallan, 
  onOpenNewBatch 
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'with-vendor', 'finished-only', 'overdue'
  const [expandedItems, setExpandedItems] = useState({}); // { [itemCode]: boolean }
  const [internalSelectedItemCode, setInternalSelectedItemCode] = useState('all');
  const [editingItem, setEditingItem] = useState(null);
  const [showStockAmendmentModal, setShowStockAmendmentModal] = useState(false);
  const [amendingItemTarget, setAmendingItemTarget] = useState(null);

  const currentItemCode = controlledSelectedItemCode !== undefined ? controlledSelectedItemCode : internalSelectedItemCode;

  function handleSelectItem(code) {
    if (controlledOnSelectItem) {
      controlledOnSelectItem(code);
    }
    setInternalSelectedItemCode(code);
  }

  useEffect(() => {
    loadStockData();
  }, []);

  // When a specific item is selected from parent, expand it automatically
  useEffect(() => {
    if (currentItemCode && currentItemCode !== 'all') {
      setExpandedItems(prev => ({
        ...prev,
        [currentItemCode]: true
      }));
    }
  }, [currentItemCode]);

  async function loadStockData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchItemStocksByStage();
      setData(res);
      // Auto-expand items that currently have vendor stock or overdue
      const autoExpanded = {};
      if (res && res.items) {
        res.items.forEach(it => {
          if (it.total_wip_quantity > 0 || it.overdue_batches_count > 0) {
            autoExpanded[it.item_code] = true;
          }
        });
      }
      setExpandedItems(prev => ({ ...autoExpanded, ...prev }));
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch item stock list');
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(itemCode) {
    setExpandedItems(prev => ({
      ...prev,
      [itemCode]: !prev[itemCode]
    }));
  }

  function toggleExpandAll(expand) {
    const next = {};
    items.forEach(i => {
      next[i.item_code] = expand;
    });
    setExpandedItems(next);
  }

  // Parse and extract vendor holdings & in-house stocks cleanly
  function parseItemStockHoldings(item) {
    const vendorHoldings = [];
    const inhouseWip = [];

    // Parse stages pipeline
    (item.stages_pipeline || []).forEach(stage => {
      (stage.batches || []).forEach(b => {
        if (!b.is_inhouse && (b.current_vendor_id || b.vendor_name)) {
          vendorHoldings.append ? null : vendorHoldings.push({
            vendor_id: b.current_vendor_id,
            vendor_name: b.vendor_name || stage.default_vendor_name || 'Subcontractor',
            vendor_contact: b.vendor_contact,
            vendor_phone: b.vendor_phone,
            stage_seq: b.current_stage_sequence || stage.sequence_no,
            process_name: b.current_process || stage.process_name,
            quantity: b.quantity_accepted || 0,
            batch_no: b.batch_no,
            batch_id: b.id,
            challan_no: b.challan_no,
            date_sent: b.date_sent_to_vendor,
            expected_date: b.expected_delivery_date,
            lead_status: b.lead_status || { badge: 'In Progress', color: 'blue', is_overdue: false },
            notes: b.notes,
            raw_batch: b
          });
        } else if (b.status !== 'Completed' && b.current_process !== 'Finished Product') {
          inhouseWip.push({
            stage_seq: b.current_stage_sequence || stage.sequence_no,
            process_name: b.current_process || stage.process_name,
            quantity: b.quantity_accepted || 0,
            batch_no: b.batch_no,
            batch_id: b.id,
            date_started: b.date_started,
            raw_batch: b
          });
        }
      });
    });

    // Group vendor holdings by vendor name
    const vendorGroups = {};
    vendorHoldings.forEach(vh => {
      const vName = vh.vendor_name;
      if (!vendorGroups[vName]) {
        vendorGroups[vName] = {
          vendor_name: vName,
          vendor_id: vh.vendor_id,
          vendor_contact: vh.vendor_contact,
          vendor_phone: vh.vendor_phone,
          total_quantity: 0,
          batches: []
        };
      }
      vendorGroups[vName].total_quantity += vh.quantity;
      vendorGroups[vName].batches.push(vh);
    });

    const totalVendorWip = vendorHoldings.reduce((sum, v) => sum + v.quantity, 0);
    const totalInhouseWip = inhouseWip.reduce((sum, v) => sum + v.quantity, 0);
    const totalFinished = item.total_finished_quantity || 0;
    const totalStock = totalFinished + totalVendorWip + totalInhouseWip;

    return {
      vendorHoldings,
      vendorGroups: Object.values(vendorGroups),
      inhouseWip,
      totalVendorWip,
      totalInhouseWip,
      totalFinished,
      totalStock
    };
  }

  const items = data?.items || [];
  const summary = data?.summary || {
    total_items_count: items.length,
    total_wip_quantity: 0,
    total_finished_quantity: 0,
    total_overdue_batches: 0
  };

  // Filter items based on search and selected filterMode
  const filteredItems = items.filter(item => {
    const { vendorGroups, totalVendorWip, totalFinished } = parseItemStockHoldings(item);

    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      item.item_code.toLowerCase().includes(term) ||
      item.name.toLowerCase().includes(term) ||
      (item.material_code && item.material_code.toLowerCase().includes(term)) ||
      (item.raw_material_name && item.raw_material_name.toLowerCase().includes(term)) ||
      vendorGroups.some(vg => vg.vendor_name.toLowerCase().includes(term)) ||
      (item.stages_pipeline || []).some(s => s.process_name.toLowerCase().includes(term));

    if (!matchesSearch) return false;

    if (filterMode === 'with-vendor') return totalVendorWip > 0;
    if (filterMode === 'finished-only') return totalFinished > 0;
    if (filterMode === 'overdue') return item.overdue_batches_count > 0;

    return true;
  });

  const totalVendorHoldingsCount = items.filter(i => parseItemStockHoldings(i).totalVendorWip > 0).length;

  return (
    <div className="space-y-3.5 animate-in fade-in duration-200">
      
      {/* ─── 1. TOP HEADER & QUICK STATS BAR ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Items & Stock Register</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                  {items.length} Items Cataloged
                </span>
              </h2>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 ml-9">
            Click any item to inspect which subcontract vendors are holding active components in the manufacturing pipeline.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setAmendingItemTarget(null);
              setShowStockAmendmentModal(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/60 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            title="Open manual stock amendment (+ / -) modal"
          >
            <ArrowUpDown className="w-3 h-3" />
            <span>+/- Stock Amendment</span>
          </button>

          <button
            onClick={() => onOpenNewBatch && onOpenNewBatch()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Launch Batch</span>
          </button>

          <button
            onClick={loadStockData}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            title="Refresh Stock List"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── 2. HIGH-LEVEL KPI METRICS BAR ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium">Finished in Store</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5">
            {summary.total_finished_quantity.toLocaleString()} <span className="text-[11px] font-sans text-slate-400 font-normal">pcs</span>
          </div>
          <div className="text-[10px] text-slate-400 truncate">Ready for assembly & dispatch</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium">Stock with Vendors</span>
            <Truck className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-extrabold text-amber-400 font-mono mt-0.5">
            {summary.total_wip_quantity.toLocaleString()} <span className="text-[11px] font-sans text-slate-400 font-normal">pcs</span>
          </div>
          <div className="text-[10px] text-amber-300/80 truncate font-medium">
            Across {totalVendorHoldingsCount} subcontracted items
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium">Total Pipeline Stock</span>
            <Package className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-extrabold text-cyan-400 font-mono mt-0.5">
            {(summary.total_finished_quantity + summary.total_wip_quantity).toLocaleString()} <span className="text-[11px] font-sans text-slate-400 font-normal">pcs</span>
          </div>
          <div className="text-[10px] text-slate-400 truncate">Finished goods + active WIP</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium">Overdue at Vendors</span>
            <AlertTriangle className={`w-3.5 h-3.5 ${summary.total_overdue_batches > 0 ? 'text-red-400' : 'text-slate-500'}`} />
          </div>
          <div className={`text-xl font-extrabold font-mono mt-0.5 ${summary.total_overdue_batches > 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {summary.total_overdue_batches} <span className="text-[11px] font-sans text-slate-400 font-normal">batches</span>
          </div>
          <div className="text-[10px] text-slate-400 truncate">Requires vendor follow-up</div>
        </div>
      </div>

      {/* ─── 3. SEARCH & FILTER CONTROLS ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-900/80 p-2 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Item Code, Name, Material, or Vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1 text-xs bg-slate-950 text-white rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 placeholder-slate-500"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto justify-end">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterMode === 'all'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Items ({items.length})
          </button>

          <button
            onClick={() => setFilterMode('with-vendor')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              filterMode === 'with-vendor'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-amber-300 border border-slate-800'
            }`}
          >
            <Truck className="w-3 h-3 text-amber-400" />
            <span>With Vendors ({totalVendorHoldingsCount})</span>
          </button>

          <button
            onClick={() => setFilterMode('finished-only')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterMode === 'finished-only'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-emerald-300 border border-slate-800'
            }`}
          >
            In Store
          </button>

          <button
            onClick={() => setFilterMode('overdue')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              filterMode === 'overdue'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-red-300 border border-slate-800'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span>Overdue ({summary.total_overdue_batches})</span>
          </button>

          <div className="h-3.5 w-px bg-slate-800 mx-0.5 hidden sm:block" />

          <button
            onClick={() => toggleExpandAll(true)}
            className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-cyan-300 bg-slate-950 hover:bg-slate-800 border border-slate-800 cursor-pointer"
            title="Expand all items"
          >
            Expand All
          </button>

          <button
            onClick={() => toggleExpandAll(false)}
            className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-800 cursor-pointer"
            title="Collapse all items"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* ─── 4. MAIN ITEMS & STOCK LIST ────────────────────────────────────── */}
      <div className="space-y-2">
        {loading && !data ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-2.5 bg-slate-900/40 rounded-xl border border-slate-800">
            <div className="w-7 h-7 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400 font-medium">Loading items and vendor stock data...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 text-center bg-slate-900/40 rounded-xl border border-slate-800 p-6 space-y-2">
            <Package className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No items found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No manufactured items match your search or selected filter. Try resetting your search or filter.
            </p>
            <button
              onClick={() => { setSearchTerm(''); setFilterMode('all'); }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredItems.map(item => {
            const { 
              vendorHoldings, vendorGroups, inhouseWip, 
              totalVendorWip, totalInhouseWip, totalFinished, totalStock 
            } = parseItemStockHoldings(item);

            const isExpanded = Boolean(expandedItems[item.item_code]);
            const hasVendorHoldings = vendorHoldings.length > 0;
            const hasOverdue = item.overdue_batches_count > 0;

            return (
              <div 
                key={item.item_code}
                className={`bg-slate-900 border rounded-xl transition-all overflow-hidden ${
                  isExpanded 
                    ? 'border-cyan-500/50 shadow-md shadow-cyan-950/20' 
                    : hasOverdue
                      ? 'border-red-900/50 hover:border-red-700/60'
                      : hasVendorHoldings 
                        ? 'border-slate-800 hover:border-slate-700' 
                        : 'border-slate-800/70 hover:border-slate-700/80 opacity-95'
                }`}
              >
                {/* ─── Item Row Summary Header (Click to Open) ───────────────── */}
                <div 
                  onClick={() => toggleExpand(item.item_code)}
                  className="px-3 py-2 sm:px-3.5 sm:py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 lg:gap-3 cursor-pointer hover:bg-slate-800/40 transition-colors select-none"
                >
                  {/* Left: Item Code, Name, Specs */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button 
                      type="button"
                      aria-label="Toggle details"
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-transform shrink-0 ${
                        isExpanded ? 'bg-cyan-500/20 text-cyan-400 rotate-180' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs sm:text-sm font-extrabold text-cyan-400 tracking-wide shrink-0">
                          {item.item_code}
                        </span>
                        <h3 className="text-xs sm:text-sm font-bold text-white hover:text-cyan-200 transition-colors truncate max-w-[240px] sm:max-w-sm md:max-w-md">
                          {item.name}
                        </h3>
                        {hasOverdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950 text-red-300 border border-red-800 flex items-center gap-1 shrink-0">
                            <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                            <span>{item.overdue_batches_count} Overdue</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                        {item.drawing_no && (
                          <span>Dwg: <strong className="text-slate-300 font-mono">{item.drawing_no}</strong></span>
                        )}
                        {item.material_code && (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                            <span>Mat: <strong className="text-slate-300">{item.material_code}</strong></span>
                          </span>
                        )}
                        {item.weight > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                            <span>Weight: <strong className="text-slate-300">{item.weight} kg</strong></span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Stock Metrics Columns & Quick Action Chips */}
                  <div className="flex items-center justify-between lg:justify-end gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-800/80">
                    
                    {/* Finished Stock in Store */}
                    <div className="bg-slate-950/70 border border-slate-800/80 px-2 sm:px-2.5 py-1 rounded-lg text-left sm:text-right shrink-0 min-w-[75px] sm:min-w-[85px]">
                      <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Store FG</div>
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        {totalFinished > 0 ? `${totalFinished} pcs` : <span className="text-slate-600">0 pcs</span>}
                      </div>
                    </div>

                    {/* Vendor WIP Stock */}
                    <div className="bg-slate-950/70 border border-slate-800/80 px-2 sm:px-2.5 py-1 rounded-lg text-left sm:text-right shrink-0 min-w-[120px] sm:min-w-[145px]">
                      <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider flex items-center sm:justify-end gap-1">
                        <Truck className="w-2.5 h-2.5 text-amber-400" />
                        <span>With Vendors</span>
                      </div>
                      <div className="text-xs font-mono font-bold text-amber-400">
                        {totalVendorWip > 0 ? `${totalVendorWip} pcs` : <span className="text-slate-600">0 pcs</span>}
                      </div>
                      {vendorGroups.length > 0 && (
                        <div className="text-[9px] text-slate-400 truncate max-w-[150px]">
                          {vendorGroups.map(v => `${v.vendor_name} (${v.total_quantity})`).join(', ')}
                        </div>
                      )}
                    </div>

                    {/* Total Stock */}
                    <div className="bg-slate-950/70 border border-slate-800/80 px-2 sm:px-2.5 py-1 rounded-lg text-left sm:text-right shrink-0 min-w-[80px] sm:min-w-[95px]">
                      <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Total Stock</div>
                      <div className="text-xs sm:text-sm font-mono font-extrabold text-white">
                        {totalStock} <span className="text-[10px] font-sans text-slate-400 font-normal">pcs</span>
                      </div>
                    </div>

                    {/* Expand Button Indicator */}
                    <div className="shrink-0">
                      <button
                        type="button"
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-xs font-semibold text-cyan-300 border border-slate-700/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>{isExpanded ? 'Hide' : 'Vendors'}</span>
                      </button>
                    </div>

                  </div>
                </div>

                {/* ─── 5. EXPANDED VIEW: SUBCONTRACTOR HOLDINGS TABLE (Full Width) ─── */}
                {isExpanded && (
                  <div className="border-t border-slate-800/90 bg-slate-950/70 p-3 sm:p-4 space-y-3 animate-in fade-in duration-150">
                    
                    {/* Header bar inside the expanded view */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/70">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Building2 className="w-4 h-4 text-amber-400" />
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                          Subcontractor Stock & Pipeline Holdings for <span className="text-cyan-400 font-mono">{item.item_code}</span>
                        </h4>
                        {hasOverdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950 text-red-300 border border-red-800 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                            <span>Action needed: Overdue</span>
                          </span>
                        )}
                      </div>

                      {/* Item-level Quick Actions */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAmendingItemTarget(item);
                            setShowStockAmendmentModal(true);
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <ArrowUpDown className="w-3 h-3" />
                          <span>+/- Amend Stock</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenNewBatch && onOpenNewBatch(item);
                          }}
                          className="px-2 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Launch Batch</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingItem(item);
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Route</span>
                        </button>
                      </div>
                    </div>

                    {/* ─── FULL-WIDTH VENDOR HOLDINGS TABLE ─────────────────── */}
                    {hasVendorHoldings ? (
                      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-inner">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                <th className="py-2 px-3">Subcontractor Vendor</th>
                                <th className="py-2 px-3">Process Stage</th>
                                <th className="py-2 px-3">Batch & DC Number</th>
                                <th className="py-2 px-3 text-right">Holding Qty</th>
                                <th className="py-2 px-3">Dispatch Date & Status</th>
                                <th className="py-2 px-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-sans">
                              {vendorHoldings.map((batchInfo, bIdx) => {
                                const lead = batchInfo.lead_status || {};
                                return (
                                  <tr key={bIdx} className="hover:bg-slate-800/30 transition-colors">
                                    {/* 1. Vendor Info */}
                                    <td className="py-2.5 px-3 align-middle">
                                      <div className="font-bold text-white flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        <span>{batchInfo.vendor_name}</span>
                                      </div>
                                      {(batchInfo.vendor_contact || batchInfo.vendor_phone) && (
                                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                          {batchInfo.vendor_contact && <span>{batchInfo.vendor_contact}</span>}
                                          {batchInfo.vendor_phone && (
                                            <span className="font-mono text-cyan-300">{batchInfo.vendor_phone}</span>
                                          )}
                                        </div>
                                      )}
                                    </td>

                                    {/* 2. Process Stage */}
                                    <td className="py-2.5 px-3 align-middle">
                                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 inline-flex items-center gap-1">
                                        Stage {batchInfo.stage_seq}: {batchInfo.process_name}
                                      </span>
                                    </td>

                                    {/* 3. Batch No & DC Challan */}
                                    <td className="py-2.5 px-3 align-middle">
                                      <div className="font-mono font-bold text-cyan-400 text-xs">
                                        {batchInfo.batch_no}
                                      </div>
                                      {batchInfo.challan_no ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onViewChallan && onViewChallan(batchInfo.challan_no);
                                          }}
                                          className="text-cyan-400 hover:text-cyan-300 underline font-mono text-[11px] flex items-center gap-1 cursor-pointer mt-0.5"
                                          title="View / Print Delivery Challan"
                                        >
                                          <FileText className="w-3 h-3 text-cyan-400" />
                                          <span>{batchInfo.challan_no}</span>
                                          <Printer className="w-2.5 h-2.5 text-slate-400" />
                                        </button>
                                      ) : (
                                        <span className="text-[10px] text-slate-500 font-mono">Direct / No DC</span>
                                      )}
                                    </td>

                                    {/* 4. Holding Quantity */}
                                    <td className="py-2.5 px-3 align-middle text-right">
                                      <span className="font-mono font-extrabold text-amber-400 text-sm">
                                        {batchInfo.quantity}
                                      </span>
                                      <span className="text-[11px] text-slate-400 ml-1">pcs</span>
                                    </td>

                                    {/* 5. Dispatch Date & Status */}
                                    <td className="py-2.5 px-3 align-middle">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {batchInfo.date_sent && (
                                          <span className="text-[11px] text-slate-400">
                                            Sent: <strong className="text-slate-300 font-mono">{batchInfo.date_sent}</strong>
                                          </span>
                                        )}
                                        {lead.badge && (
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            lead.is_overdue
                                              ? 'bg-red-950 text-red-300 border border-red-800'
                                              : 'bg-blue-950 text-blue-300 border border-blue-800'
                                          }`}>
                                            {lead.badge}
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    {/* 6. Action Buttons */}
                                    <td className="py-2.5 px-3 align-middle text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenFollowup && onOpenFollowup(batchInfo.raw_batch);
                                          }}
                                          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                                          title="Record Follow-Up"
                                        >
                                          <PhoneCall className="w-3 h-3 text-cyan-400" />
                                          <span>Follow-Up</span>
                                        </button>

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onAdvanceStage && onAdvanceStage(batchInfo.raw_batch);
                                          }}
                                          className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                                          title="Receive or advance to next process"
                                        >
                                          <span>Advance</span>
                                          <ArrowRight className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-950/90 border-t border-slate-800 text-xs font-semibold text-slate-300">
                                <td colSpan={3} className="py-2 px-3 text-slate-400">
                                  Total Subcontractor Holding across {vendorGroups.length} vendor(s)
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-amber-400 text-sm">
                                  {totalVendorWip} pcs
                                </td>
                                <td colSpan={2}></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-1">
                        <p className="text-xs text-slate-400 font-medium">
                          No stock is currently held at external subcontractor vendors for this item.
                        </p>
                        <p className="text-[11px] text-slate-500">
                          All stock is either in finished store or ready to be dispatched from raw material.
                        </p>
                      </div>
                    )}

                    {/* ─── SECTION B: IN-HOUSE FINISHED GOODS & RAW MATERIAL ─── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                      {/* Finished Goods Store */}
                      <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Finished Goods in Store</span>
                          </span>
                          <span className="font-mono font-extrabold text-emerald-400 text-sm">
                            {totalFinished} pcs
                          </span>
                        </div>
                        {item.finished_batches && item.finished_batches.length > 0 ? (
                          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                            {item.finished_batches.map(fb => (
                              <div key={fb.id} className="text-[11px] flex items-center justify-between text-slate-400 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800/80">
                                <span className="font-mono text-slate-300 font-medium">{fb.batch_no}</span>
                                <span className="text-emerald-300 font-mono font-bold">{fb.quantity_accepted} pcs completed</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 italic">No completed stock currently in store.</div>
                        )}
                      </div>

                      {/* Raw Material Inventory Available */}
                      <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                            <Factory className="w-3.5 h-3.5" />
                            <span>Raw Material Available</span>
                          </span>
                          {item.raw_material_stock !== undefined && (
                            <span className="font-mono font-bold text-cyan-300 text-sm">
                              {item.raw_material_stock} {item.raw_material_unit || 'kg'}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 space-y-0.5">
                          {item.material_code ? (
                            <div>
                              Code: <strong className="text-slate-200 font-mono">{item.material_code}</strong>
                              {item.raw_material_name && <span className="text-slate-400 ml-1">({item.raw_material_name})</span>}
                            </div>
                          ) : (
                            <div className="text-slate-500 italic">No raw material linked to this manufactured item.</div>
                          )}
                          {item.route_name && (
                            <div className="text-[10px] text-slate-500 truncate">
                              Route: {item.route_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

      {/* ─── 6. MODALS ──────────────────────────────────────────────────────── */}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSuccess={() => {
            setEditingItem(null);
            loadStockData();
          }}
        />
      )}

      {showStockAmendmentModal && (
        <StockAmendmentModal
          item={amendingItemTarget}
          onClose={() => {
            setShowStockAmendmentModal(false);
            setAmendingItemTarget(null);
          }}
          onSuccess={() => {
            setShowStockAmendmentModal(false);
            setAmendingItemTarget(null);
            loadStockData();
          }}
        />
      )}

    </div>
  );
}
