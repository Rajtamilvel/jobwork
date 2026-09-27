import React, { useState, useEffect } from 'react';
import { 
  PlayCircle, Clock, AlertTriangle, CheckCircle2, ShieldAlert, 
  Calendar, Layers, Truck, Plus, RefreshCw, Search, ChevronDown, 
  ChevronRight, ArrowRight, Package, Sparkles, Filter, Factory, 
  ArrowUpRight, AlertCircle, FileText, Check, Cpu
} from 'lucide-react';
import { fetchItemsToStart } from '../api';

export default function ItemsToStartView({ onLaunchBatch, onNavigateToRoute }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'urgent', 'soon', 'covered'
  const [selectedMonth, setSelectedMonth] = useState('2026-09');
  const [targetDate, setTargetDate] = useState('2026-09-27');
  const [expandedItems, setExpandedItems] = useState({});

  useEffect(() => {
    loadData();
  }, [selectedMonth, targetDate]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchItemsToStart({
        month: selectedMonth,
        target_date: targetDate
      });
      setData(res);
      // Auto-expand urgent items by default
      const autoExpanded = {};
      (res.items || []).forEach(it => {
        if (it.urgency === 'URGENT_START') {
          autoExpanded[it.item_code] = true;
        }
      });
      setExpandedItems(autoExpanded);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load items to start');
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
    (data?.items || []).forEach(it => {
      next[it.item_code] = expand;
    });
    setExpandedItems(next);
  }

  const items = data?.items || [];
  const summary = data?.summary || {
    total_items: 0,
    urgent_start_count: 0,
    start_soon_count: 0,
    total_planned_demand: 0,
    total_actual_consumed: 0
  };

  // Filter items
  const filteredItems = items.filter(it => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      it.item_code.toLowerCase().includes(term) ||
      it.name.toLowerCase().includes(term) ||
      (it.material_code && it.material_code.toLowerCase().includes(term)) ||
      (it.drawing_no && it.drawing_no.toLowerCase().includes(term)) ||
      it.assemblies_using.some(a => a.assembly_code.toLowerCase().includes(term) || a.assembly_name.toLowerCase().includes(term));

    if (!matchesSearch) return false;

    if (filterMode === 'urgent') return it.urgency === 'URGENT_START';
    if (filterMode === 'soon') return it.urgency === 'START_SOON';
    if (filterMode === 'covered') return it.urgency === 'SUFFICIENT_COVERAGE';

    return true;
  });

  return (
    <div className="space-y-3.5 animate-in fade-in duration-200">
      
      {/* ─── 1. TOP HEADER & WORKFLOW CONTEXT ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/20 via-orange-500/20 to-red-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm shrink-0">
              <PlayCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Production Process Launch</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 font-bold border border-amber-800/60">
                  Lead Time vs Plan Demand
                </span>
              </h2>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 ml-9">
            Launch multi-stage routes on time based on assembly daily plan demand, actual consumed quantity, and sequential lead times.
          </p>
        </div>

        {/* Global Controls & Date Selectors */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Target Month Picker */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 shadow-inner">
            <Calendar className="w-3 h-3 text-cyan-400 shrink-0" />
            <label className="text-[11px] text-slate-400 font-medium whitespace-nowrap">Month:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white font-mono font-bold text-xs focus:outline-none cursor-pointer"
            />
          </div>

          {/* Target Date Picker */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 shadow-inner">
            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
            <label className="text-[11px] text-slate-400 font-medium whitespace-nowrap">Date:</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="bg-transparent text-white font-mono font-bold text-xs focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer shrink-0"
            title="Refresh Process Launch Analysis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── 2. HIGH-LEVEL KPI METRICS ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Urgent Starts Required */}
        <div className="bg-gradient-to-br from-red-950/40 via-slate-900 to-slate-900 border border-red-500/40 rounded-xl p-2.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold text-red-300">Start Immediately</span>
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
          </div>
          <div className="text-xl font-extrabold text-red-400 font-mono mt-0.5">
            {summary.urgent_start_count} <span className="text-[11px] font-sans font-normal text-slate-400">items</span>
          </div>
          <div className="text-[10px] text-red-300/80 truncate">Zero stock or due within lead time</div>
        </div>

        {/* Start Soon */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold text-amber-300">Schedule Start Soon</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-extrabold text-amber-400 font-mono mt-0.5">
            {summary.start_soon_count} <span className="text-[11px] font-sans font-normal text-slate-400">items</span>
          </div>
          <div className="text-[10px] text-slate-400 truncate">Due within next 5 working days</div>
        </div>

        {/* Total Planned Month Demand */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold text-cyan-300">Total Plan Demand</span>
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-extrabold text-cyan-400 font-mono mt-0.5">
            {summary.total_planned_demand.toLocaleString()} <span className="text-[11px] font-sans font-normal text-slate-400">pcs</span>
          </div>
          <div className="text-[10px] text-slate-400 truncate">Demanded by monthly schedules</div>
        </div>

        {/* Total Consumed Quantity */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold text-emerald-300">Total Consumed (Actuals)</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5">
            {summary.total_actual_consumed.toLocaleString()} <span className="text-[11px] font-sans font-normal text-slate-400">pcs</span>
          </div>
          <div className="text-[10px] text-slate-400 truncate">Actual assemblies completed</div>
        </div>
      </div>

      {/* ─── 3. FILTER & SEARCH CONTROLS ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Part Code, Name, Assembly..."
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
            onClick={() => setFilterMode('urgent')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              filterMode === 'urgent'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-slate-950 text-red-400 hover:text-red-300 border border-slate-800'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Start Immediately ({summary.urgent_start_count})</span>
          </button>

          <button
            onClick={() => setFilterMode('soon')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              filterMode === 'soon'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-950 text-amber-400 hover:text-amber-300 border border-slate-800'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Start Soon ({summary.start_soon_count})</span>
          </button>

          <button
            onClick={() => setFilterMode('covered')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterMode === 'covered'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-emerald-300 border border-slate-800'
            }`}
          >
            Covered by Stock
          </button>

          <div className="h-3.5 w-px bg-slate-800 mx-0.5 hidden sm:block" />

          <button
            onClick={() => toggleExpandAll(true)}
            className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-cyan-300 bg-slate-950 hover:bg-slate-800 border border-slate-800 cursor-pointer"
          >
            Expand All
          </button>

          <button
            onClick={() => toggleExpandAll(false)}
            className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-800 cursor-pointer"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* ─── 4. MAIN PROCESS LAUNCH ITEMS LIST ──────────────────────────────── */}
      <div className="space-y-2">
        {loading && !data ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-2.5 bg-slate-900/40 rounded-xl border border-slate-800">
            <div className="w-7 h-7 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400 font-medium">Calculating process lead times, plan demand, and start urgency...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 text-center bg-slate-900/40 rounded-xl border border-slate-800 p-6 space-y-2">
            <Package className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No items found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No parts match the selected filter. Try changing your search query or filter mode.
            </p>
          </div>
        ) : (
          filteredItems.map(item => {
            const isExpanded = Boolean(expandedItems[item.item_code]);
            const isUrgent = item.urgency === 'URGENT_START';
            const isSoon = item.urgency === 'START_SOON';
            const isCovered = item.urgency === 'SUFFICIENT_COVERAGE';

            return (
              <div
                key={item.item_code}
                className={`bg-slate-900 border rounded-xl transition-all overflow-hidden ${
                  isUrgent
                    ? 'border-red-500/60 shadow-md shadow-red-950/20'
                    : isSoon
                      ? 'border-amber-500/50 shadow-sm shadow-amber-950/15'
                      : isExpanded
                        ? 'border-cyan-500/40 shadow-sm'
                        : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* ─── ITEM MAIN ROW HEADER (COMPACT & INLINE) ─────────────── */}
                <div 
                  onClick={() => toggleExpand(item.item_code)}
                  className="px-3 py-2 sm:px-3.5 sm:py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 lg:gap-3 cursor-pointer hover:bg-slate-800/40 transition-colors select-none"
                >
                  {/* Left: Item Specs & Urgency */}
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
                        <span className="font-mono text-xs sm:text-sm font-extrabold text-cyan-400 shrink-0">
                          {item.item_code}
                        </span>
                        <h3 className="text-xs sm:text-sm font-bold text-white hover:text-cyan-200 transition-colors truncate max-w-[240px] sm:max-w-sm md:max-w-md">
                          {item.name}
                        </h3>

                        {/* Status Tag */}
                        {isUrgent ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-950 text-red-300 border border-red-700 flex items-center gap-1 shadow-sm shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
                            <span>{item.urgency_label}</span>
                          </span>
                        ) : isSoon ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700 flex items-center gap-1 shrink-0">
                            <Clock className="w-2.5 h-2.5 text-amber-400" />
                            <span>{item.urgency_label}</span>
                          </span>
                        ) : isCovered ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 shrink-0">
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                            <span>Covered</span>
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] text-slate-400 bg-slate-800 border border-slate-700 shrink-0">
                            No Demand
                          </span>
                        )}
                      </div>

                      {/* Consuming Assemblies */}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                        {item.assemblies_using.length > 0 ? (
                          <>
                            <span className="text-[10px] text-slate-500 font-medium">Assemblies:</span>
                            {item.assemblies_using.map(asm => (
                              <span 
                                key={asm.assembly_code}
                                className="px-1.5 py-0.2 rounded bg-slate-950 text-slate-300 border border-slate-800 text-[10px] font-mono"
                                title={asm.assembly_name}
                              >
                                {asm.assembly_code} <strong className="text-cyan-400 font-semibold">({asm.consumption_rate}x)</strong>
                              </span>
                            ))}
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No assembly BOM mapping</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Comparative Metrics Chips & Inline Action Button */}
                  <div className="flex items-center justify-between lg:justify-end gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-800/80">
                    
                    {/* 1. Process Lead Time */}
                    <div className="bg-slate-950/70 border border-slate-800/80 px-2 sm:px-2.5 py-1 rounded-lg text-left sm:text-right shrink-0 min-w-[88px] sm:min-w-[100px]">
                      <div className="text-[9px] text-slate-400 uppercase font-semibold flex items-center sm:justify-end gap-1">
                        <Clock className="w-2.5 h-2.5 text-amber-400" />
                        <span>Lead Time</span>
                      </div>
                      <div className="text-xs font-mono font-bold text-amber-300">
                        {item.total_lead_time_days}d <span className="text-[10px] font-normal text-slate-400">({item.stages.length} stg)</span>
                      </div>
                    </div>

                    {/* 2. Daily Plan Demand */}
                    <div className="bg-slate-950/70 border border-slate-800/80 px-2 sm:px-2.5 py-1 rounded-lg text-left sm:text-right shrink-0 min-w-[95px] sm:min-w-[110px]">
                      <div className="text-[9px] text-slate-400 uppercase font-semibold flex items-center sm:justify-end gap-1">
                        <Calendar className="w-2.5 h-2.5 text-cyan-400" />
                        <span>Daily Plan</span>
                      </div>
                      <div className="text-xs font-mono font-bold text-cyan-300">
                        {item.daily_plan_quantity_today} <span className="text-[10px] font-normal text-slate-400">today</span>
                        <span className="text-slate-600 mx-1">|</span>
                        <span className="text-[10px] text-slate-300">{item.total_month_plan_quantity}m</span>
                      </div>
                    </div>

                    {/* 3. Consumed Quantity */}
                    <div className="bg-slate-950/70 border border-slate-800/80 px-2 sm:px-2.5 py-1 rounded-lg text-left sm:text-right shrink-0 min-w-[95px] sm:min-w-[110px]">
                      <div className="text-[9px] text-slate-400 uppercase font-semibold flex items-center sm:justify-end gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                        <span>Consumed</span>
                      </div>
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        {item.consumed_quantity_today !== null ? `${item.consumed_quantity_today}` : '0'} <span className="text-[10px] font-normal text-slate-400">today</span>
                        <span className="text-slate-600 mx-1">|</span>
                        <span className="text-[10px] text-slate-300">{item.total_month_consumed_quantity}m</span>
                      </div>
                    </div>

                    {/* 4. Stock vs Shortfall */}
                    <div className="bg-slate-950/70 border border-slate-800/80 px-2 sm:px-2.5 py-1 rounded-lg text-left sm:text-right shrink-0 min-w-[105px] sm:min-w-[120px]">
                      <div className="text-[9px] text-slate-400 uppercase font-semibold flex items-center sm:justify-end gap-1">
                        <Package className="w-2.5 h-2.5 text-slate-400" />
                        <span>Stock / Shortfall</span>
                      </div>
                      <div className="text-xs font-mono font-bold">
                        <span className="text-slate-200">{item.total_available_stock}</span>
                        <span className="text-slate-600 mx-1">/</span>
                        {item.suggested_start_qty > 0 ? (
                          <span className="text-red-400 font-extrabold">-{item.suggested_start_qty} pcs</span>
                        ) : (
                          <span className="text-emerald-400 font-semibold">Surplus</span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        FG:{item.current_finished_stock} WIP:{item.current_wip_stock}
                      </div>
                    </div>

                    {/* 5. Start Process Button */}
                    <div className="shrink-0 flex items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onLaunchBatch) {
                            onLaunchBatch({
                              item_code: item.item_code,
                              route_id: item.route_id,
                              quantity: item.suggested_start_qty || item.default_quantity || 100
                            });
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          isUrgent
                            ? 'bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-red-950/40 hover:scale-[1.02]'
                            : isSoon
                              ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-amber-950/30'
                              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/20'
                        }`}
                        title={`Launch process batch for ${item.item_code}`}
                      >
                        <PlayCircle className="w-3.5 h-3.5 fill-current" />
                        <span>Start</span>
                        {item.suggested_start_qty > 0 && (
                          <span className="bg-black/30 px-1.5 py-0.5 rounded text-[10px] font-mono">
                            {item.suggested_start_qty}
                          </span>
                        )}
                      </button>
                    </div>

                  </div>
                </div>

                {/* ─── 5. EXPANDED VIEW: PROCESS STAGES & CALENDAR CONSUMPTION ─ */}
                {isExpanded && (
                  <div className="border-t border-slate-800/90 bg-slate-950/80 p-3 sm:p-4 space-y-3 animate-in fade-in duration-150">
                    
                    {/* Header inside expand */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-cyan-400" />
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                          Process Stages Flow & Production Lead Time ({item.total_lead_time_days} Days Total)
                        </h4>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center gap-3">
                        {item.must_start_date && (
                          <span>Latest Start Target: <strong className={`font-mono ${isUrgent ? 'text-red-400 font-bold' : 'text-amber-300'}`}>{item.must_start_date}</strong></span>
                        )}
                        {item.runout_date && (
                          <span>Stockout Date: <strong className="font-mono text-red-300">{item.runout_date}</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Sequential Route Stages Stepper with Lead Times */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Sequential Manufacturing Process Route:</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {item.stages.map((stg, sIdx) => (
                          <div 
                            key={stg.sequence_no}
                            className="p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-0.5 relative"
                          >
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-mono font-bold text-cyan-400">Step {stg.sequence_no}</span>
                              <span className="px-1.5 py-0.2 rounded font-mono font-semibold bg-amber-950 text-amber-300 border border-amber-800 text-[9px]">
                                {stg.lead_time_days}d lead
                              </span>
                            </div>
                            <div className="text-xs font-bold text-white truncate" title={stg.process_name}>
                              {stg.process_name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                              {stg.is_inhouse ? (
                                <span className="text-emerald-400 font-medium">In-House</span>
                              ) : (
                                <span className="text-indigo-300 truncate" title={stg.default_vendor_name || 'Subcontractor'}>
                                  {stg.default_vendor_name || 'Subcontractor'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stock Position & Active WIP Batches */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5">
                      {/* Left: Inventory Breakdown */}
                      <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
                        <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Current Stock Standing</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                            <div className="text-[9px] text-slate-400 uppercase">Store FG</div>
                            <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                              {item.current_finished_stock} pcs
                            </div>
                          </div>
                          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                            <div className="text-[9px] text-slate-400 uppercase">Vendor WIP</div>
                            <div className="text-xs font-mono font-bold text-amber-400 mt-0.5">
                              {item.current_wip_stock} pcs
                            </div>
                          </div>
                          <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                            <div className="text-[9px] text-slate-400 uppercase">Month Demand</div>
                            <div className="text-xs font-mono font-bold text-cyan-400 mt-0.5">
                              {item.total_month_plan_quantity} pcs
                            </div>
                          </div>
                        </div>
                        {item.suggested_start_qty > 0 && (
                          <div className="p-2 rounded-lg bg-red-950/40 border border-red-500/30 text-xs flex items-center justify-between text-red-300">
                            <span>Recommended Launch Quantity:</span>
                            <strong className="font-mono text-white text-xs">{item.suggested_start_qty} pcs</strong>
                          </div>
                        )}
                      </div>

                      {/* Right: Active Batches in Process */}
                      <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
                        <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-amber-400" />
                          <span>Active Batches Currently in Pipeline</span>
                        </div>
                        {item.wip_batches.length > 0 ? (
                          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                            {item.wip_batches.map(wb => (
                              <div 
                                key={wb.id}
                                className="p-1.5 rounded-lg bg-slate-950 text-xs flex items-center justify-between gap-2 border border-slate-800"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-cyan-400 text-xs">{wb.batch_no}</span>
                                    <span className="text-[11px] text-slate-300">{wb.current_process}</span>
                                  </div>
                                  <div className="text-[9px] text-slate-400">
                                    {wb.vendor_name ? `Vendor: ${wb.vendor_name}` : 'In-House Station'}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-mono font-bold text-amber-300 text-xs">{wb.quantity_accepted} pcs</div>
                                  <div className="text-[9px] text-slate-400">{wb.status}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 italic py-3 text-center">
                            No batches currently active in WIP. Ready to launch from raw material.
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
