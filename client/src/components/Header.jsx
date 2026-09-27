import React, { useState, useEffect, useRef } from 'react';
import {
  Factory, AlertCircle, PlusCircle, RotateCw, ShieldAlert,
  Truck, Calendar, Layers, Plus, Building2, UserPlus, Boxes,
  FileText, ChevronDown, LayoutDashboard, Cpu, ArrowUpDown, PlayCircle, Clock,
  LogOut, User
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
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-40 transition-colors">
      {/* ─── TIER 1: BRAND IDENTITY & SYSTEM ACTIONS ─────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-3 pb-2.5">
        <div className="flex items-center justify-between gap-4">
          
          {/* Brand & Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30 flex-shrink-0">
              <Factory className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <h1 className="text-base sm:text-lg font-extrabold text-white tracking-wide flex items-center gap-1.5 whitespace-nowrap">
                  RAJTAMIL <span className="text-cyan-400">JOBWORK</span>
                </h1>
                <span className="whitespace-nowrap px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 rounded-full shadow-sm">
                  ENGINEER OS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate hidden sm:block">
                Subcontract Movement, Multi-Vendor Routing & Vendor Stock Tracker
              </p>
            </div>
          </div>

          {/* Status Indicators & Action Hub */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            {/* Critical Alert Pill */}
            {criticalCount > 0 && (
              <button
                onClick={() => setActiveTab('daily-tasks')}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-500/50 text-red-300 hover:bg-red-900/60 hover:border-red-400 text-xs font-semibold transition-all cursor-pointer shadow-sm group"
                title="Click to view urgent critical batches in Daily Tasks"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <ShieldAlert className="w-3.5 h-3.5 text-red-400 group-hover:scale-110 transition-transform" />
                <span className="whitespace-nowrap">{criticalCount} <span className="hidden sm:inline">Critical</span></span>
              </button>
            )}

            {/* Overdue Alert Pill */}
            {overdueCount > 0 && (
              <button
                onClick={() => setActiveTab('daily-tasks')}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-500/50 text-amber-300 hover:bg-amber-900/60 hover:border-amber-400 text-xs font-semibold transition-all cursor-pointer shadow-sm group"
                title="Click to review overdue vendor tasks in Daily Tasks"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                <span className="whitespace-nowrap">{overdueCount} <span className="hidden sm:inline">Overdue</span></span>
              </button>
            )}

            <div className="hidden sm:block h-5 w-px bg-slate-800 mx-0.5" />

            {/* Dispatch to Vendor (Direct CTA) */}
            <button
              onClick={onOpenBulkDispatch}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-medium border border-indigo-500/40 shadow-sm hover:shadow-indigo-600/25 transition-all cursor-pointer"
              title="Dispatch parts to subcontractor on a shared Challan"
            >
              <Truck className="w-3.5 h-3.5 text-indigo-200" />
              <span>Send to Vendor</span>
            </button>

            {/* Primary CTA: New Batch */}
            <button
              onClick={onOpenNewBatch}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              title="Launch new production run and create Job Card"
            >
              <PlusCircle className="w-3.5 h-3.5 text-slate-950" />
              <span>New Batch</span>
            </button>

            {/* Quick Actions Dropdown Menu */}
            <div className="relative" ref={quickMenuRef}>
              <button
                onClick={() => setShowQuickMenu(prev => !prev)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
                  showQuickMenu
                    ? 'bg-slate-800 text-white border-cyan-500/60 ring-2 ring-cyan-500/20'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700/80'
                }`}
                title="Quick creation & dispatch shortcuts"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Actions</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showQuickMenu ? 'rotate-180 text-cyan-400' : ''}`} />
              </button>

              {/* Dropdown Menu Popover */}
              {showQuickMenu && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-slate-900 border border-slate-700/90 shadow-2xl shadow-black/80 py-2 z-50 backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Quick Movement & Dispatch
                  </div>

                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenBulkDispatch();
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-start gap-3 hover:bg-slate-800/80 transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-indigo-900 transition-colors">
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
                    className="w-full px-3.5 py-2 text-left flex items-start gap-3 hover:bg-slate-800/80 transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-700/50 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-cyan-900 transition-colors">
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

                  <div className="my-1.5 border-t border-slate-800/80" />

                  <div className="px-3.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Master Setup
                  </div>

                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      onOpenAddVendor();
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-start gap-3 hover:bg-slate-800/80 transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-700/50 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-emerald-900 transition-colors">
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
                    className="w-full px-3.5 py-2 text-left flex items-start gap-3 hover:bg-slate-800/80 transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-950/80 border border-amber-700/50 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-amber-900 transition-colors">
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

                  <div className="my-1.5 border-t border-slate-800/80" />

                  <button
                    onClick={() => {
                      setShowQuickMenu(false);
                      if (onOpenStockAmendment) onOpenStockAmendment();
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-start gap-3 hover:bg-slate-800/80 transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-700/50 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-emerald-900 transition-colors">
                      <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
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
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh live data"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            {/* Authenticated User Status & Logout */}
            {currentUser && (
              <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-800">
                <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-xs">
                  <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-[10px]">
                    {currentUser.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="text-left">
                    <div className="text-[11px] font-bold text-white leading-none">
                      {currentUser.full_name || currentUser.username}
                    </div>
                    <div className="text-[9px] text-cyan-400 font-mono leading-tight mt-0.5">
                      {currentUser.role || 'Engineer'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-red-950/80 text-slate-400 hover:text-red-300 border border-slate-700 hover:border-red-600/50 text-xs transition-colors cursor-pointer"
                  title={`Sign Out (${currentUser.username})`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── TIER 2: DEDICATED NAVIGATION TAB BAR ───────────────────────────── */}
      <div className="border-t border-slate-800/70 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <nav className="flex items-center gap-1.5 overflow-x-auto py-1.5 scrollbar-none no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/10 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                  <span>{item.label}</span>
                  {item.badge != null && (
                    <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-sm">
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
