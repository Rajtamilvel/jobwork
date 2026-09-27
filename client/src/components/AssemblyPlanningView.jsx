import React, { useState, useEffect, useRef } from 'react';
import {
  Boxes, Calendar, ChevronLeft, ChevronRight, Plus, Trash2,
  Wand2, Save, AlertTriangle, CheckCircle2, ShieldAlert,
  ArrowRight, Info, Layers, RefreshCw, X, Edit3, Cpu, Sparkles,
  Target, CheckCheck, Activity, SlidersHorizontal
} from 'lucide-react';
import {
  fetchAssemblies, createAssembly, deleteAssembly,
  assignAssemblyBOMItem, removeAssemblyBOMItem,
  fetchProductionPlans, saveMonthlyTargets, saveDailySchedule,
  fetchDailyConsumption, fetchItems
} from '../api';

export default function AssemblyPlanningView() {
  const [activeSubTab, setActiveSubTab] = useState('consumption'); // 'consumption', 'planner', 'assemblies'
  const [plannerViewMode, setPlannerViewMode] = useState('dual');   // 'dual', 'plan', 'actual'
  
  // Current selected month: YYYY-MM
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  
  // Data states
  const [consumptionData, setConsumptionData] = useState(null);
  const [plansData, setPlansData] = useState(null);
  const [assemblies, setAssemblies] = useState([]);
  const [masterItems, setMasterItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Modals & Popovers
  const [selectedCellDetail, setSelectedCellDetail] = useState(null);
  const [showNewAssemblyModal, setShowNewAssemblyModal] = useState(false);
  const [showAssignItemModal, setShowAssignItemModal] = useState(null); // assembly object

  // Form states
  const [newAssemblyForm, setNewAssemblyForm] = useState({
    assembly_code: '',
    name: '',
    description: '',
    customer: '',
    drawing_no: ''
  });

  const [assignItemForm, setAssignItemForm] = useState({
    item_code: '',
    consumption_qty: 1,
    unit: 'pcs',
    notes: ''
  });

  // Local editable state for daily plan inputs
  // editableSchedule[assembly_id][date] = planned_qty
  // editableActuals[assembly_id][date] = actual_qty
  const [editableSchedule, setEditableSchedule] = useState({});
  const [editableActuals, setEditableActuals] = useState({});
  const [editableMonthlyTargets, setEditableMonthlyTargets] = useState({});

  // Scroll & Slider Refs & States for 31-day wide tables
  const daywiseScrollRef = useRef(null);
  const consumptionScrollRef = useRef(null);
  const [daywiseScrollPct, setDaywiseScrollPct] = useState(0);
  const [consumptionScrollPct, setConsumptionScrollPct] = useState(0);

  function handleTableScroll(ref, setPct) {
    if (!ref.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = ref.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      setPct(Math.round((scrollLeft / maxScroll) * 100));
    }
  }

  function handleSliderChange(ref, pct, setPct) {
    if (!ref.current) return;
    const { scrollWidth, clientWidth } = ref.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      ref.current.scrollLeft = (pct / 100) * maxScroll;
      setPct(pct);
    }
  }

  function scrollByDelta(ref, delta) {
    if (!ref.current) return;
    ref.current.scrollBy({ left: delta, behavior: 'smooth' });
  }

  function scrollToDayIndex(ref, dayNum, totalDays) {
    if (!ref.current) return;
    const { scrollWidth, clientWidth } = ref.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      const ratio = Math.max(0, Math.min(1, (dayNum - 1) / Math.max(1, (totalDays || 30) - 1)));
      ref.current.scrollTo({ left: ratio * maxScroll, behavior: 'smooth' });
    }
  }

  useEffect(() => {
    loadAllData();
  }, [selectedMonth]);

  async function loadAllData() {
    try {
      setLoading(true);
      const [consRes, plansRes, asmsRes, itemsRes] = await Promise.all([
        fetchDailyConsumption(selectedMonth),
        fetchProductionPlans(selectedMonth),
        fetchAssemblies(),
        fetchItems()
      ]);

      setConsumptionData(consRes);
      setPlansData(plansRes);
      setAssemblies(asmsRes);
      setMasterItems(itemsRes);

      // Initialize local editable structures from plansRes
      const schedMap = {};
      const actualsMap = {};
      const targetsMap = {};
      plansRes.assemblies.forEach(asm => {
        targetsMap[asm.id] = asm.target_quantity || 0;
        schedMap[asm.id] = {};
        actualsMap[asm.id] = {};
        asm.daywise_schedule.forEach(ds => {
          schedMap[asm.id][ds.date] = ds.planned_quantity;
          actualsMap[asm.id][ds.date] = (ds.actual_quantity !== null && ds.actual_quantity !== undefined)
            ? ds.actual_quantity
            : '';
        });
      });
      setEditableSchedule(schedMap);
      setEditableActuals(actualsMap);
      setEditableMonthlyTargets(targetsMap);

    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Failed to load planning data' });
    } finally {
      setLoading(false);
    }
  }

  // Month navigation helpers
  function handlePrevMonth() {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setSelectedMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  }

  function handleNextMonth() {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    setSelectedMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  }

  // Save Monthly Targets & Auto-Distribute
  async function handleSaveMonthlyTargets(autoDistribute = true) {
    try {
      setSaving(true);
      const targets = Object.keys(editableMonthlyTargets).map(aid => ({
        assembly_id: Number(aid),
        target_quantity: Number(editableMonthlyTargets[aid]) || 0,
        working_days: 25
      }));

      await saveMonthlyTargets({
        year_month: selectedMonth,
        auto_distribute: autoDistribute,
        targets: targets
      });

      setMessage({
        type: 'success',
        text: autoDistribute ? 'Monthly targets saved & auto-distributed across working days!' : 'Monthly targets saved!'
      });
      await loadAllData();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Failed to save monthly targets' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  }

  // Save Fine-Tuned Daywise Schedule (both Planned and Actual)
  async function handleSaveDaywiseSchedule() {
    try {
      setSaving(true);
      const items = [];
      Object.keys(editableSchedule).forEach(aid => {
        Object.keys(editableSchedule[aid]).forEach(dt => {
          const actVal = editableActuals[aid]?.[dt];
          items.push({
            plan_date: dt,
            assembly_id: Number(aid),
            planned_quantity: Number(editableSchedule[aid][dt]) || 0,
            actual_quantity: (actVal !== undefined && actVal !== '' && actVal !== null)
              ? Number(actVal)
              : null
          });
        });
      });

      await saveDailySchedule({ items });
      setMessage({ type: 'success', text: 'Daywise Planned & Actual production schedule saved! Component consumption updated.' });
      await loadAllData();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Failed to save daily schedule' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  }

  // Handle New Assembly creation
  async function handleCreateAssembly(e) {
    e.preventDefault();
    try {
      setSaving(true);
      await createAssembly(newAssemblyForm);
      setShowNewAssemblyModal(false);
      setNewAssemblyForm({ assembly_code: '', name: '', description: '', customer: '', drawing_no: '' });
      setMessage({ type: 'success', text: 'Assembly product created successfully!' });
      await loadAllData();
    } catch (err) {
      alert(err.message || 'Failed to create assembly');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  }

  // Handle Delete Assembly
  async function handleDeleteAssembly(asm) {
    if (!confirm(`Are you sure you want to delete assembly "${asm.assembly_code}" and all its BOM assignments?`)) return;
    try {
      await deleteAssembly(asm.id);
      setMessage({ type: 'success', text: `Assembly ${asm.assembly_code} deleted.` });
      await loadAllData();
    } catch (err) {
      alert(err.message || 'Failed to delete assembly');
    }
  }

  // Handle Assign Component Item to Assembly
  async function handleAssignItem(e) {
    e.preventDefault();
    if (!showAssignItemModal) return;
    try {
      setSaving(true);
      await assignAssemblyBOMItem(showAssignItemModal.id, {
        item_code: assignItemForm.item_code,
        consumption_qty: Number(assignItemForm.consumption_qty) || 1,
        unit: assignItemForm.unit || 'pcs',
        notes: assignItemForm.notes
      });
      setShowAssignItemModal(null);
      setAssignItemForm({ item_code: '', consumption_qty: 1, unit: 'pcs', notes: '' });
      setMessage({ type: 'success', text: 'Item assigned to assembly BOM!' });
      await loadAllData();
    } catch (err) {
      alert(err.message || 'Failed to assign item');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  }

  // Handle Remove Item from Assembly
  async function handleRemoveBOMItem(assemblyId, bomId, itemCode) {
    if (!confirm(`Remove item ${itemCode} from this assembly?`)) return;
    try {
      await removeAssemblyBOMItem(assemblyId, bomId);
      setMessage({ type: 'success', text: `Item ${itemCode} removed from assembly.` });
      await loadAllData();
    } catch (err) {
      alert(err.message || 'Failed to remove item');
    }
  }

  return (
    <div className="space-y-6">
      
      {/* ─── COMPACT PAGE HEADER & MONTH CONTROLLER ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
          <h2 className="text-sm font-bold text-white tracking-wide">Assembly Planning & Consumption</h2>
        </div>

        {/* Month Selector & Controls */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-inner">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-2.5 text-xs font-bold text-cyan-300 flex items-center gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>{selectedMonth}</span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setSelectedMonth(currentMonthStr)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer"
          >
            Current Month
          </button>

          <button
            onClick={loadAllData}
            disabled={loading}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications Banner */}
      {message && (
        <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
          message.type === 'error'
            ? 'bg-red-950/80 border-red-500/50 text-red-200'
            : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'error' ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="cursor-pointer opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── NAVIGATION SUB-TABS ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 flex-wrap sm:flex-nowrap">
        <button
          onClick={() => setActiveSubTab('consumption')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'consumption'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md shadow-cyan-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Boxes className="w-4 h-4 text-cyan-400" />
          <span>Daily Consumption Matrix</span>
          {consumptionData?.summary?.critical_shortages_count > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {consumptionData.summary.critical_shortages_count} Deficit
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('planner')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'planner'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md shadow-cyan-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span>Monthly & Daywise Planner</span>
        </button>

        <button
          onClick={() => setActiveSubTab('assemblies')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'assemblies'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md shadow-cyan-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Assembly BOM Master ({assemblies.length})</span>
        </button>
      </div>

      {/* ─── SUB-TAB 1: DAILY CONSUMPTION MATRIX ──────────────────────────────── */}
      {activeSubTab === 'consumption' && (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-3 h-3 text-cyan-400" />
                <span>Planned Assemblies</span>
              </div>
              <div className="text-xl font-black text-white mt-1">
                {consumptionData?.summary?.total_assemblies_planned || 0}
                <span className="text-[11px] font-normal text-slate-400 ml-1">units</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-emerald-400" />
                <span>Actual Assemblies Produced</span>
              </div>
              <div className="text-xl font-black text-emerald-400 mt-1">
                {consumptionData?.summary?.total_assemblies_actual || 0}
                <span className="text-[11px] font-normal text-slate-400 ml-1">units</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Boxes className="w-3 h-3 text-cyan-400" />
                <span>Components Needed</span>
              </div>
              <div className="text-xl font-black text-cyan-300 mt-1">
                {consumptionData?.summary?.total_components_demanded || 0}
                <span className="text-[11px] font-normal text-slate-400 ml-1">pcs</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3 h-3 text-red-400" />
                <span>Stock Deficit Items</span>
              </div>
              <div className={`text-xl font-black mt-1 ${
                (consumptionData?.summary?.critical_shortages_count || 0) > 0 ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {consumptionData?.summary?.critical_shortages_count || 0}
                <span className="text-[11px] font-normal text-slate-400 ml-1">items</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-slate-400" />
                <span>Monitored Parts</span>
              </div>
              <div className="text-xl font-black text-slate-200 mt-1">
                {consumptionData?.items?.length || 0}
                <span className="text-[11px] font-normal text-slate-400 ml-1">BOM parts</span>
              </div>
            </div>
          </div>

          {/* Core Consumption Matrix Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Daywise Consumption Matrix</span>
                  <span className="text-xs font-normal text-slate-400">({selectedMonth})</span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Consumption uses <strong>Actual Produced Output</strong> for days where recorded, and falls back to <strong>Planned Quotas</strong> for future days. Click any cell to inspect breakdown.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-950 border border-emerald-500/60"></span>
                  <span>Based on Actuals</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-950 border border-cyan-500/50"></span>
                  <span>Based on Plan</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-950/60 border border-red-500/50"></span>
                  <span>Stock Deficit</span>
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs">Computing finished item consumption metrics...</p>
              </div>
            ) : !consumptionData?.items || consumptionData.items.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <Boxes className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">No Component Items Mapped to Assemblies Yet</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Go to the <strong>Assembly BOM Master</strong> tab to assign processed items (e.g. CM001, CM002) to an assembly with consumption ratios.
                </p>
                <button
                  onClick={() => setActiveSubTab('assemblies')}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Configure Assembly BOM
                </button>
              </div>
            ) : (
              <>
                {/* Horizontal Timeline Slider & Navigation Controls */}
                <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 shadow-sm">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="text-[11px] font-semibold text-slate-300">Days Slider:</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={consumptionScrollPct}
                        onChange={(e) => handleSliderChange(consumptionScrollRef, Number(e.target.value), setConsumptionScrollPct)}
                        className="w-32 sm:w-48 md:w-64 h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        title="Slide to scroll through days 1 to 31"
                      />
                      <span className="font-mono text-[10px] text-cyan-400 font-bold min-w-[32px] text-right">{consumptionScrollPct}%</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => scrollByDelta(consumptionScrollRef, -300)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 shadow-sm transition-all cursor-pointer"
                        title="Scroll left"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollByDelta(consumptionScrollRef, 300)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 shadow-sm transition-all cursor-pointer"
                        title="Scroll right"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Jump Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Quick Jump:</span>
                    <button
                      type="button"
                      onClick={() => scrollToDayIndex(consumptionScrollRef, 1, consumptionData?.days?.length || 30)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                    >
                      Days 1–10
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToDayIndex(consumptionScrollRef, 11, consumptionData?.days?.length || 30)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                    >
                      Days 11–20
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToDayIndex(consumptionScrollRef, 21, consumptionData?.days?.length || 30)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                    >
                      Days 21–{consumptionData?.days?.length || 31}
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToDayIndex(consumptionScrollRef, now.getDate(), consumptionData?.days?.length || 30)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-[11px] font-bold text-cyan-300 border border-cyan-700/60 shadow-sm transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>📍 Today (Day {now.getDate()})</span>
                    </button>
                  </div>
                </div>

                <div 
                  ref={consumptionScrollRef}
                  onScroll={() => handleTableScroll(consumptionScrollRef, setConsumptionScrollPct)}
                  className="overflow-x-auto custom-scrollbar-x"
                >
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-3 px-3.5 sticky left-0 z-20 bg-slate-950 min-w-[150px] border-r border-slate-800/80">Item Code</th>
                      <th className="py-3 px-3 min-w-[85px] text-right">Finished Stock</th>
                      <th className="py-3 px-3 min-w-[75px] text-right">WIP Stock</th>
                      <th className="py-3 px-3 min-w-[85px] text-right">Month Need</th>
                      <th className="py-3 px-3 min-w-[85px] text-right border-r border-slate-800/80">Net Balance</th>
                      <th className="py-3 px-3 min-w-[125px] border-r border-slate-800/80">Coverage Status</th>
                      
                      {/* Day Columns 1..N */}
                      {consumptionData.days.map(d => {
                        const isToday = d.date === consumptionData.summary.current_date;
                        return (
                          <th
                            key={d.date}
                            className={`py-2 px-1 text-center min-w-[56px] ${
                              isToday
                                ? 'bg-cyan-950/70 text-cyan-300 font-black border-x border-cyan-500/40'
                                : d.is_working_day
                                ? 'text-slate-300'
                                : 'text-slate-600 bg-slate-950/90'
                            }`}
                          >
                            <div className="text-[9px] font-normal">{d.day_name}</div>
                            <div>{d.day}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {consumptionData.items.map((item) => {
                      return (
                        <tr key={item.item_code} className="hover:bg-slate-850/50 transition-colors group">
                          {/* Sticky Item Code & Name */}
                          <td className="py-2.5 px-3.5 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-850 border-r border-slate-800/80">
                            <div className="font-extrabold text-cyan-300 flex items-center gap-1.5">
                              <span>{item.item_code}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[150px]" title={item.item_name}>
                              {item.item_name}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <span>Used in:</span>
                              <span className="text-slate-300 font-semibold">
                                {item.assemblies_using.map(a => `${a.assembly_code} (×${a.consumption_rate})`).join(', ')}
                              </span>
                            </div>
                          </td>

                          {/* Finished Stock */}
                          <td className="py-2.5 px-3 text-right font-bold text-white">
                            {item.current_finished_stock}
                          </td>

                          {/* WIP Stock */}
                          <td className="py-2.5 px-3 text-right text-slate-400">
                            {item.current_wip_stock}
                          </td>

                          {/* Total Month Demand */}
                          <td className="py-2.5 px-3 text-right font-bold text-cyan-300">
                            {item.total_month_consumption}
                          </td>

                          {/* Net Balance */}
                          <td className={`py-2.5 px-3 text-right font-extrabold border-r border-slate-800/80 ${
                            item.net_balance >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {item.net_balance > 0 ? `+${item.net_balance}` : item.net_balance}
                          </td>

                          {/* Coverage Badge */}
                          <td className="py-2.5 px-3 border-r border-slate-800/80">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap ${
                              item.coverage_status === 'COVERED'
                                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/50'
                                : item.coverage_status === 'ZERO_STOCK'
                                ? 'bg-red-950 text-red-400 border border-red-600/70 animate-pulse'
                                : 'bg-amber-950/80 text-amber-300 border border-amber-600/50'
                            }`}>
                              {item.coverage_status === 'COVERED' ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <ShieldAlert className="w-3 h-3 text-red-400" />
                              )}
                              <span>{item.coverage_badge}</span>
                            </span>
                          </td>

                          {/* Day-by-day cell quantities */}
                          {consumptionData.days.map((d) => {
                            const qty = item.daily_quantities[d.date] || 0;
                            const isActual = item.daily_is_actual?.[d.date] || false;
                            const isToday = d.date === consumptionData.summary.current_date;
                            const breakdown = item.daily_breakdowns[d.date] || [];

                            return (
                              <td
                                key={d.date}
                                onClick={() => {
                                  if (qty > 0) {
                                    setSelectedCellDetail({
                                      date: d.date,
                                      day: d.day,
                                      item_code: item.item_code,
                                      item_name: item.item_name,
                                      total_qty: qty,
                                      is_actual: isActual,
                                      breakdown: breakdown
                                    });
                                  }
                                }}
                                className={`py-2 px-1 text-center font-bold text-[11px] transition-all ${
                                  qty > 0 ? 'cursor-pointer hover:scale-105' : ''
                                } ${
                                  isToday ? 'bg-cyan-950/40 border-x border-cyan-500/30' : ''
                                } ${
                                  !d.is_working_day ? 'bg-slate-950/40 text-slate-600' : ''
                                }`}
                              >
                                {qty > 0 ? (
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors shadow-sm inline-block min-w-[34px] ${
                                    isActual
                                      ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600/60 hover:bg-emerald-900'
                                      : 'bg-cyan-950/90 text-cyan-300 border-cyan-700/50 hover:bg-cyan-900'
                                  }`} title={isActual ? 'Consumption based on recorded actual output' : 'Projected consumption based on planned quota'}>
                                    {qty}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 font-normal">-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {/* Total Row */}
                    <tr className="bg-slate-950/90 font-extrabold text-xs border-t-2 border-slate-700">
                      <td className="py-3 px-3.5 sticky left-0 z-10 bg-slate-950 text-white uppercase tracking-wider border-r border-slate-800">
                        Total Daily Demand
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">
                        {consumptionData.items.reduce((acc, i) => acc + i.current_finished_stock, 0)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400">
                        {consumptionData.items.reduce((acc, i) => acc + i.current_wip_stock, 0)}
                      </td>
                      <td className="py-3 px-3 text-right text-cyan-400">
                        {consumptionData.summary.total_components_demanded}
                      </td>
                      <td className="py-3 px-3 text-right border-r border-slate-800"></td>
                      <td className="py-3 px-3 border-r border-slate-800"></td>
                      {consumptionData.days.map((d) => {
                        const totalOnDay = consumptionData.daily_totals[d.date] || 0;
                        const isToday = d.date === consumptionData.summary.current_date;
                        return (
                          <td
                            key={d.date}
                            className={`py-2 px-1 text-center font-extrabold text-[11px] ${
                              isToday ? 'bg-cyan-950/60 text-cyan-300 border-x border-cyan-500/30' : 'text-slate-300'
                            }`}
                          >
                            {totalOnDay > 0 ? totalOnDay : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── SUB-TAB 2: MONTHLY & DAYWISE PRODUCTION PLANNER ──────────────────── */}
      {activeSubTab === 'planner' && (
        <div className="space-y-6">
          {/* Section 1: Monthly Target Quotas */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span>Monthly Assembly Production Targets</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Set target assembly quantities for {selectedMonth}. Click "Auto-Distribute" to divide evenly across working days (Mon–Sat).
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => handleSaveMonthlyTargets(true)}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition-all cursor-pointer disabled:opacity-50"
                  title="Divide monthly target evenly across all working days"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Auto-Distribute to Days</span>
                </button>

                <button
                  onClick={() => handleSaveMonthlyTargets(false)}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Targets</span>
                </button>
              </div>
            </div>

            {/* Assembly Targets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plansData?.assemblies?.map((asm) => {
                return (
                  <div key={asm.id} className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-extrabold text-white tracking-wide">{asm.assembly_code}</div>
                        <div className="text-xs text-slate-400">{asm.name}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300">
                        {asm.customer || 'OEM'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-400">Monthly Target (Units):</label>
                      <input
                        type="number"
                        min="0"
                        value={editableMonthlyTargets[asm.id] ?? asm.target_quantity ?? 0}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          setEditableMonthlyTargets(prev => ({ ...prev, [asm.id]: val }));
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold text-sm focus:outline-none focus:border-cyan-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="e.g. 250"
                      />
                    </div>

                    <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-slate-800/80">
                      <span>Scheduled Plan: <strong className="text-cyan-300">{asm.total_scheduled_quantity}</strong></span>
                      <span>Actual Output: <strong className="text-emerald-400">{asm.total_actual_quantity || 0}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Daywise Calendar Fine-Tuning Grid (Plan vs Actual) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Daywise Assembly Schedule (Planned vs Actual Output)</span>
                  <span className="text-xs font-normal text-slate-400">({selectedMonth})</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Record actual production output alongside planned targets to calculate accurate finished component inventory.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                {/* View Mode Switcher */}
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 shadow-inner text-xs">
                  <button
                    onClick={() => setPlannerViewMode('plan')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      plannerViewMode === 'plan'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🎯 Plan Only
                  </button>
                  <button
                    onClick={() => setPlannerViewMode('actual')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      plannerViewMode === 'actual'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ✅ Actual Only
                  </button>
                  <button
                    onClick={() => setPlannerViewMode('dual')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      plannerViewMode === 'dual'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📊 Plan & Actual (Dual)
                  </button>
                </div>

                <button
                  onClick={handleSaveDaywiseSchedule}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Daywise Plan</span>
                </button>
              </div>
            </div>

            {/* Horizontal Timeline Slider & Navigation Controls */}
            <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 shadow-sm">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-300">Days Slider:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={daywiseScrollPct}
                    onChange={(e) => handleSliderChange(daywiseScrollRef, Number(e.target.value), setDaywiseScrollPct)}
                    className="w-32 sm:w-48 md:w-64 h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    title="Slide to scroll through days 1 to 31"
                  />
                  <span className="font-mono text-[10px] text-cyan-400 font-bold min-w-[32px] text-right">{daywiseScrollPct}%</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => scrollByDelta(daywiseScrollRef, -300)}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 shadow-sm transition-all cursor-pointer"
                    title="Scroll left"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollByDelta(daywiseScrollRef, 300)}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 shadow-sm transition-all cursor-pointer"
                    title="Scroll right"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick Jump Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Quick Jump:</span>
                <button
                  type="button"
                  onClick={() => scrollToDayIndex(daywiseScrollRef, 1, plansData?.days?.length || 30)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                >
                  Days 1–10
                </button>
                <button
                  type="button"
                  onClick={() => scrollToDayIndex(daywiseScrollRef, 11, plansData?.days?.length || 30)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                >
                  Days 11–20
                </button>
                <button
                  type="button"
                  onClick={() => scrollToDayIndex(daywiseScrollRef, 21, plansData?.days?.length || 30)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                >
                  Days 21–{plansData?.days?.length || 31}
                </button>
                <button
                  type="button"
                  onClick={() => scrollToDayIndex(daywiseScrollRef, now.getDate(), plansData?.days?.length || 30)}
                  className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-[11px] font-bold text-cyan-300 border border-cyan-700/60 shadow-sm transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>📍 Today (Day {now.getDate()})</span>
                </button>
              </div>
            </div>

            <div 
              ref={daywiseScrollRef}
              onScroll={() => handleTableScroll(daywiseScrollRef, setDaywiseScrollPct)}
              className="overflow-x-auto custom-scrollbar-x"
            >
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-3.5 sticky left-0 z-20 bg-slate-950 min-w-[150px] border-r border-slate-800">Assembly</th>
                    {plannerViewMode === 'dual' && (
                      <th className="py-3 px-2 min-w-[50px] text-center border-r border-slate-800">Type</th>
                    )}
                    <th className="py-3 px-3 min-w-[70px] text-right">Target</th>
                    <th className="py-3 px-3 min-w-[80px] text-right">Scheduled</th>
                    <th className="py-3 px-3 min-w-[80px] text-right border-r border-slate-800">Actual Sum</th>

                    {/* Days */}
                    {plansData?.days?.map((d) => {
                      const isToday = d.date === currentMonthStr + `-${String(now.getDate()).padStart(2, '0')}`;
                      return (
                        <th
                          key={d.date}
                          className={`py-2 px-1 text-center min-w-[68px] ${
                            isToday ? 'bg-cyan-950/80 text-cyan-300 font-bold' : d.is_working_day ? 'text-slate-300' : 'text-slate-600 bg-slate-950'
                          }`}
                        >
                          <div className="text-[9px] font-normal">{d.day_name}</div>
                          <div>{d.day}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {plansData?.assemblies?.map((asm) => {
                    const scheduledTotal = plansData.days.reduce((acc, d) => {
                      const v = editableSchedule[asm.id]?.[d.date];
                      return acc + (Number(v) || 0);
                    }, 0);

                    const actualTotal = plansData.days.reduce((acc, d) => {
                      const v = editableActuals[asm.id]?.[d.date];
                      return acc + (Number(v) || 0);
                    }, 0);

                    return (
                      <React.Fragment key={asm.id}>
                        {/* Planned Row (Visible in 'plan' or 'dual' mode) */}
                        {(plannerViewMode === 'plan' || plannerViewMode === 'dual') && (
                          <tr className="hover:bg-slate-850/40 transition-colors">
                            <td className={`py-2 px-3.5 sticky left-0 z-10 bg-slate-900 border-r border-slate-800 ${plannerViewMode === 'dual' ? 'border-b-0' : ''}`}>
                              <div className="font-extrabold text-white">{asm.assembly_code}</div>
                              <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{asm.name}</div>
                            </td>

                            {plannerViewMode === 'dual' && (
                              <td className="py-1 px-2 text-center border-r border-slate-800">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                                  PLAN
                                </span>
                              </td>
                            )}

                            <td className="py-2 px-3 text-right font-bold text-slate-300">
                              {editableMonthlyTargets[asm.id] ?? asm.target_quantity ?? 0}
                            </td>

                            <td className={`py-2 px-3 text-right font-bold ${
                              scheduledTotal === Number(editableMonthlyTargets[asm.id] ?? asm.target_quantity ?? 0)
                                ? 'text-cyan-300'
                                : 'text-amber-400'
                            }`}>
                              {scheduledTotal}
                            </td>

                            <td className="py-2 px-3 text-right font-bold border-r border-slate-800 text-emerald-400">
                              {actualTotal}
                            </td>

                            {plansData.days.map((d) => {
                              const planVal = editableSchedule[asm.id]?.[d.date] ?? 0;
                              return (
                                <td key={d.date} className="py-1 px-1 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={planVal === 0 ? '' : planVal}
                                    placeholder="0"
                                    onChange={(e) => {
                                      const newVal = e.target.value === '' ? 0 : Number(e.target.value);
                                      setEditableSchedule(prev => ({
                                        ...prev,
                                        [asm.id]: {
                                          ...prev[asm.id],
                                          [d.date]: newVal
                                        }
                                      }));
                                    }}
                                    className="w-[56px] px-1 py-1 text-center font-bold text-xs bg-slate-950 border border-slate-800 rounded focus:border-cyan-400 focus:outline-none focus:bg-slate-900 text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-sm"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        )}

                        {/* Actual Output Row (Visible in 'actual' or 'dual' mode) */}
                        {(plannerViewMode === 'actual' || plannerViewMode === 'dual') && (
                          <tr className={`hover:bg-slate-850/40 transition-colors bg-emerald-950/10 ${plannerViewMode === 'dual' ? 'border-b-2 border-slate-800' : ''}`}>
                            <td className="py-2 px-3.5 sticky left-0 z-10 bg-slate-900 border-r border-slate-800">
                              {plannerViewMode === 'actual' ? (
                                <div>
                                  <div className="font-extrabold text-white">{asm.assembly_code}</div>
                                  <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{asm.name}</div>
                                </div>
                              ) : (
                                <div className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                                  <CheckCheck className="w-3 h-3" />
                                  <span>Actual Floor Output</span>
                                </div>
                              )}
                            </td>

                            {plannerViewMode === 'dual' && (
                              <td className="py-1 px-2 text-center border-r border-slate-800">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                  ACT
                                </span>
                              </td>
                            )}

                            <td className="py-2 px-3 text-right font-bold text-slate-400">
                              {editableMonthlyTargets[asm.id] ?? asm.target_quantity ?? 0}
                            </td>

                            <td className="py-2 px-3 text-right font-bold text-cyan-300">
                              {scheduledTotal}
                            </td>

                            <td className="py-2 px-3 text-right font-extrabold border-r border-slate-800 text-emerald-400">
                              {actualTotal}
                            </td>

                            {plansData.days.map((d) => {
                              const actVal = editableActuals[asm.id]?.[d.date] ?? '';
                              const planVal = editableSchedule[asm.id]?.[d.date] ?? 0;
                              const isRecorded = actVal !== '' && actVal !== null && actVal !== undefined;

                              return (
                                <td key={d.date} className="py-1 px-1 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={actVal}
                                    placeholder="-"
                                    onChange={(e) => {
                                      const newVal = e.target.value === '' ? '' : Number(e.target.value);
                                      setEditableActuals(prev => ({
                                        ...prev,
                                        [asm.id]: {
                                          ...prev[asm.id],
                                          [d.date]: newVal
                                        }
                                      }));
                                    }}
                                    className={`w-[56px] px-1 py-1 text-center font-bold text-xs rounded border focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-sm ${
                                      isRecorded
                                        ? Number(actVal) >= planVal && planVal > 0
                                          ? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-300 focus:border-emerald-400'
                                          : 'bg-amber-950/80 border-amber-500/70 text-amber-300 focus:border-amber-400'
                                        : 'bg-slate-950/80 border-slate-800 text-slate-400 focus:border-emerald-400'
                                    }`}
                                    title={isRecorded ? `Actual: ${actVal} (Plan: ${planVal})` : 'Enter actual completed output'}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── SUB-TAB 3: ASSEMBLY BOM MASTER (ASSIGN ITEMS) ─────────────────────── */}
      {activeSubTab === 'assemblies' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Assembly Master & BOM Consumption Mapping</h2>
              <p className="text-xs text-slate-400">
                Define finished assembly models and specify the consumption quantity for each machined part (e.g., CM001 × 1, CM002 × 2).
              </p>
            </div>
            <button
              onClick={() => setShowNewAssemblyModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-cyan-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Assembly Product</span>
            </button>
          </div>

          {/* Assemblies Cards List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {assemblies.map((asm) => {
              return (
                <div key={asm.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-cyan-400 tracking-wide">{asm.assembly_code}</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300">
                          {asm.drawing_no || 'DWG-N/A'}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white">{asm.name}</h3>
                      {asm.description && <p className="text-xs text-slate-400">{asm.description}</p>}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowAssignItemModal(asm)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 text-xs font-semibold transition-colors cursor-pointer"
                        title="Assign processed item to this assembly"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Assign Item</span>
                      </button>

                      <button
                        onClick={() => handleDeleteAssembly(asm)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                        title="Delete assembly"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Assigned Component Items Table */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Consumed Components (BOM)</span>
                      <span>{asm.bom_items?.length || 0} Parts Mapped</span>
                    </div>

                    {(!asm.bom_items || asm.bom_items.length === 0) ? (
                      <div className="py-6 text-center text-slate-500 text-xs bg-slate-950/60 rounded-xl border border-dashed border-slate-800 space-y-1">
                        <p>No components assigned to this assembly yet.</p>
                        <button
                          onClick={() => setShowAssignItemModal(asm)}
                          className="text-cyan-400 hover:underline font-semibold"
                        >
                          + Assign first item (e.g. CM001, CM002)
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] font-bold uppercase">
                              <th className="py-2 px-3">Item Code</th>
                              <th className="py-2 px-3 text-center">Consumption Qty</th>
                              <th className="py-2 px-3 text-right">Finished Stock</th>
                              <th className="py-2 px-3 text-right">WIP Stock</th>
                              <th className="py-2 px-2 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-medium">
                            {asm.bom_items.map((b) => {
                              return (
                                <tr key={b.bom_id} className="hover:bg-slate-900/60">
                                  <td className="py-2.5 px-3">
                                    <div className="font-extrabold text-white">{b.item_code}</div>
                                    <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{b.item_name}</div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 font-extrabold border border-cyan-700/50">
                                      {b.consumption_qty} {b.unit}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-white">
                                    {b.finished_stock}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-slate-400">
                                    {b.wip_stock}
                                  </td>
                                  <td className="py-2.5 px-2 text-center">
                                    <button
                                      onClick={() => handleRemoveBOMItem(asm.id, b.bom_id, b.item_code)}
                                      className="text-slate-500 hover:text-red-400 p-1 rounded cursor-pointer"
                                      title="Remove from assembly"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── MODAL 1: CELL DETAIL POPUP (Breakdown of day's consumption) ──────── */}
      {selectedCellDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Consumption Drilldown</span>
                <h3 className="text-base font-extrabold text-white mt-0.5">
                  {selectedCellDetail.item_code} - {selectedCellDetail.date}
                </h3>
                <p className="text-xs text-slate-400">{selectedCellDetail.item_name}</p>
              </div>
              <button
                onClick={() => setSelectedCellDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-slate-400">Total Consumed on this Day:</div>
                <div className="text-[10px] font-bold text-slate-500">
                  {selectedCellDetail.is_actual ? 'Based on actual recorded output' : 'Based on planned quota'}
                </div>
              </div>
              <span className="text-lg font-black text-cyan-300">{selectedCellDetail.total_qty} pcs</span>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assembly Breakdown:</div>
              <div className="space-y-2">
                {selectedCellDetail.breakdown.map((b, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{b.assembly_code}</span>
                        {b.is_actual ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            Actual: {b.effective_qty}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                            Plan: {b.effective_qty}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {b.effective_qty} units × {b.consumption_rate} pcs/unit
                      </div>
                    </div>
                    <div className="text-sm font-black text-cyan-300">
                      = {b.item_consumed_qty} pcs
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setSelectedCellDetail(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: NEW ASSEMBLY PRODUCT ────────────────────────────────────── */}
      {showNewAssemblyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white">Create New Assembly Product</h3>
              <button
                onClick={() => setShowNewAssemblyModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAssembly} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Assembly Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CM101A6"
                  value={newAssemblyForm.assembly_code}
                  onChange={(e) => setNewAssemblyForm({ ...newAssemblyForm, assembly_code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-bold uppercase focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Assembly Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Heavy Transmission Drive Assembly"
                  value={newAssemblyForm.name}
                  onChange={(e) => setNewAssemblyForm({ ...newAssemblyForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Customer / OEM</label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Transmissions"
                    value={newAssemblyForm.customer}
                    onChange={(e) => setNewAssemblyForm({ ...newAssemblyForm, customer: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Drawing Number</label>
                  <input
                    type="text"
                    placeholder="e.g. DWG-ASM-101A6"
                    value={newAssemblyForm.drawing_no}
                    onChange={(e) => setNewAssemblyForm({ ...newAssemblyForm, drawing_no: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Description</label>
                <textarea
                  rows="2"
                  placeholder="Assembly application notes..."
                  value={newAssemblyForm.description}
                  onChange={(e) => setNewAssemblyForm({ ...newAssemblyForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewAssemblyModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Assembly'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: ASSIGN COMPONENT ITEM TO ASSEMBLY ──────────────────────── */}
      {showAssignItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">Assign Component Item</h3>
                <p className="text-xs text-cyan-400 font-semibold">Assembly: {showAssignItemModal.assembly_code}</p>
              </div>
              <button
                onClick={() => setShowAssignItemModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignItem} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Select Manufactured Component Item *</label>
                <select
                  required
                  value={assignItemForm.item_code}
                  onChange={(e) => setAssignItemForm({ ...assignItemForm, item_code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">-- Choose Item (e.g. CM001, CM002) --</option>
                  {masterItems.map((itm) => (
                    <option key={itm.item_code} value={itm.item_code}>
                      {itm.item_code} - {itm.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Consumption Qty per Assembly *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    placeholder="e.g. 1 or 2"
                    value={assignItemForm.consumption_qty}
                    onChange={(e) => setAssignItemForm({ ...assignItemForm, consumption_qty: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-bold focus:border-cyan-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Unit</label>
                  <input
                    type="text"
                    value={assignItemForm.unit}
                    onChange={(e) => setAssignItemForm({ ...assignItemForm, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Main drive shaft pinion or dual flange collar"
                  value={assignItemForm.notes}
                  onChange={(e) => setAssignItemForm({ ...assignItemForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignItemModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Assigning...' : 'Assign to Assembly'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
