import React, { useState, useEffect, useRef } from 'react';
import {
  Factory, AlertCircle, PlusCircle, RotateCw, ShieldAlert,
  Truck, Calendar, Layers, Plus, Building2, UserPlus, Boxes,
  ChevronDown, LayoutDashboard, Cpu, ArrowUpDown, PlayCircle, Clock,
  LogOut, Sparkles
} from 'lucide-react';

export default function Header({
  metrics,
  onRefresh,
  onOpenNewBatch,
  onOpenAddManualItem,
  onOpenBulkDispatch,
  onOpenAddVendor,
  onOpenStockAmendment,
  activeTab,
  setActiveTab,
  currentUser,
  onLogout
}) {
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const quickMenuRef = useRef(null);

  const criticalCount = metrics?.critical_batches_count || 0;
  const overdueCount = metrics?.overdue_count || 0;

  // Close Quick Actions menu on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (quickMenuRef.current && !quickMenuRef.current.contains(event.target)) {
        setShowQuickMenu(false);
      }
    }
    if (showQuickMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showQuickMenu]);

  // Handle refresh with visual animation
  async function handleRefreshClick() {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'daily-tasks', label: 'Daily Tasks', icon: Calendar, badge: overdueCount > 0 ? overdueCount : null },
    { id: 'item-stocks', label: 'Item Stocks', icon: Boxes },
    { id: 'items-to-start', label: 'Items to Start', icon: PlayCircle },
    { id: 'assembly-plan', label: 'Assembly Plan', icon: Cpu },
    { id: 'vendor-stocks', label: 'Vendor Stocks', icon: Truck },
    { id: 'vendors', label: 'Vendors', icon: Building2 },
    { id: 'items-routes', label: 'Items & Routes', icon: Layers },
    { id: 'recent', label: 'Recent', icon: Clock },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#070a14]/90 backdrop-blur-xl border-b border-white/[0.07] shadow-xl shadow-black/40">
      {/* ─── TIER 1: BRAND IDENTITY & COMMAND SHORTCUTS ─────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          
          {/* Brand & Identity: Machined Double-Bezel Logo */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="p-1 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 shadow-lg shadow-cyan-500/10">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 via-cyan-600 to-blue-600 flex items-center justify-center shadow-inner">
                <Factory className="w-5 h-5 text-slate-950 stroke-[2.2]" />
              </div>
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-1.5 whitespace-nowrap">
                  <span>RAJTAMIL</span>
                  <span className="text-cyan-400">JOBWORK</span>
                </h1>
                <span className="whitespace-nowrap px-2.5 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase bg-cyan-950/70 text-cyan-300 border border-cyan-500/30 rounded-full shadow-[0_0_12px_-2px_rgba(6,182,212,0.3)]">
                  ENGINEER OS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate hidden sm:block font-medium">
                Subcontract Routing, Multi-Vendor Pipelines & Shopfloor Live Telemetry
              </p>
            </div>
          </div>

          {/* Status Indicators & Action Hub */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            {/* Critical Alert Pill */}
            {criticalCount > 0 && (
              <button
                onClick={() => setActiveTab('daily-tasks')}
                className="btn-machined flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold shadow-sm cursor-pointer group"
                title="Click to view urgent critical batches in Daily Tasks"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
                <span className="whitespace-nowrap font-mono">{criticalCount} <span className="hidden sm:inline font-sans">Critical</span></span>
              </button>
            )}

            {/* Overdue Alert Pill */}
            {overdueCount > 0 && (
              <button
                onClick={() => setActiveTab('daily-tasks')}
                className="btn-machined flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold shadow-sm cursor-pointer group"
                title="Click to review overdue vendor tasks in Daily Tasks"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                <span className="whitespace-nowrap font-mono">{overdueCount} <span className="hidden sm:inline font-sans">Overdue</span></span>
              </button>
            )}

            <div className="hidden sm:block h-5 w-px bg-white/[0.08] mx-0.5" />

            {/* Dispatch to Vendor (Button-in-Button Architecture) */}
            <button
              onClick={onOpenBulkDispatch}
              className="btn-machined hidden md:flex items-center pl-2 pr-3.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-200 hover:text-white text-xs font-medium border border-indigo-500/30 shadow-sm cursor-pointer"
              title="Dispatch parts to subcontractor on a shared Challan"
            >
              <span className="w-5 h-5 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mr-2">
                <Truck className="w-3 h-3 text-indigo-300" />
              </span>
              <span>Send to Vendor</span>
            </button>

            {/* Primary CTA: New Batch (Machined Button-in-Button) */}
            <button
              onClick={onOpenNewBatch}
              className="btn-machined flex items-center pl-2 pr-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-cyan-500/25 border border-cyan-300/40 cursor-pointer"
              title="Launch new production run and create Job Card"
            >
              <span className="w-5 h-5 rounded-lg bg-slate-950/20 flex items-center justify-center mr-2">
                <PlusCircle className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
              </span>
              <span>New Batch</span>
            </button>

            {/* Quick Actions Dropdown Menu */}
            <div className="relative" ref={quickMenuRef}>
              <button
                onClick={() => setShowQuickMenu(prev => !prev)}
                className={`btn-machined flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer ${
                  showQuickMenu
                    ? 'bg-white/[0.08] text-white border-cyan-500/50 ring-2 ring-cyan-500/20'
                    : 'bg-white/[0.03] hover:bg-white/[0.06] text-slate-300 hover:text-white border-white/[0.08]'
                }`}
                title="Quick creation & dispatch shortcuts"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Actions</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showQuickMenu ? 'rotate-180 text-cyan-400' : ''}`} />
              </button>

              {/* Dropdown Menu Popover */}
              {showQuickMenu && (
                <div className="absolute right-0 mt-2.5 w-76 rounded-2xl bg-[#0d121f]/95 border border-white/[0.1] shadow-2xl shadow-black/90 p-2 z-50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest">
                    Quick Movement & Dispatch
                  </div>

                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenBulkDispatch();
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left flex items-start gap-3 hover:bg-white/[0.05] transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-indigo-500/20 transition-colors">
                      <Truck className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                        Send to Vendor
                      </div>
                      <div className="text-[11px] text-slate-400 leading-tight">
                        Bulk dispatch with Delivery Challan
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenNewBatch();
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left flex items-start gap-3 hover:bg-white/[0.05] transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-cyan-500/20 transition-colors">
                      <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                        New Production Batch
                      </div>
                      <div className="text-[11px] text-slate-400 leading-tight">
                        Start job card & multi-process route
                      </div>
                    </div>
                  </button>

                  <div className="my-1.5 border-t border-white/[0.06]" />

                  <div className="px-3 py-1.5 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    Master Setup
                  </div>

                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenAddVendor();
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left flex items-start gap-3 hover:bg-white/[0.05] transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-emerald-500/20 transition-colors">
                      <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                        Register Vendor
                      </div>
                      <div className="text-[11px] text-slate-400 leading-tight">
                        Add subcontractor profile & capabilities
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenAddManualItem();
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left flex items-start gap-3 hover:bg-white/[0.05] transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-amber-500/20 transition-colors">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                        Add Item & Route
                      </div>
                      <div className="text-[11px] text-slate-400 leading-tight">
                        Configure item code & process steps
                      </div>
                    </div>
                  </button>

                  <div className="my-1.5 border-t border-white/[0.06]" />

                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      if (onOpenStockAmendment) onOpenStockAmendment();
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left flex items-start gap-3 hover:bg-white/[0.05] transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-teal-500/20 transition-colors">
                      <ArrowUpDown className="w-3.5 h-3.5 text-teal-400" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                        Stock Amendment (+ / -)
                      </div>
                      <div className="text-[11px] text-slate-400 leading-tight">
                        Adjust finished, WIP & raw material stock
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Refresh Live Data */}
            <button
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="btn-machined p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.08] transition-all cursor-pointer disabled:opacity-50"
              title="Refresh live telemetry"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            {/* Authenticated User Chip & Logout */}
            {currentUser && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-white/[0.08]">
                <div className="hidden lg:flex items-center gap-2.5 px-3 py-1 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs">
                  <div className="w-5 h-5 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-[10px] font-mono border border-cyan-500/30">
                    {currentUser.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="text-left">
                    <div className="text-[11px] font-bold text-slate-200 leading-none">
                      {currentUser.full_name || currentUser.username}
                    </div>
                    <div className="text-[9px] text-cyan-400 font-mono leading-tight mt-0.5">
                      {currentUser.role || 'Engineer'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  className="btn-machined flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.03] hover:bg-rose-500/15 text-slate-400 hover:text-rose-300 border border-white/[0.08] hover:border-rose-500/30 text-xs transition-colors cursor-pointer"
                  title={`Sign Out (${currentUser.username})`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px] font-medium">Exit</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── TIER 2: DEDICATED NAVIGATION TAB BAR ───────────────────────────── */}
      <div className="border-t border-white/[0.05] bg-[#05070e]/80">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <nav className="flex items-center gap-1.5 overflow-x-auto py-2 scrollbar-none no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`btn-machined flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/15'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                  {item.badge != null && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
