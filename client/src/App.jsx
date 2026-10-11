import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import DailyTasksView from './components/DailyTasksView';
import VendorStocksView from './components/VendorStocksView';
import ItemsRouteView from './components/ItemsRouteView';
import RecentView from './components/RecentView';
import VendorDirectoryView from './components/VendorDirectoryView';
import ItemStockStagesView from './components/ItemStockStagesView';
import ItemsToStartView from './components/ItemsToStartView';
import AssemblyPlanningView from './components/AssemblyPlanningView';
import LoginView from './components/LoginView';

// Modals
import ItemRouteModal from './components/ItemRouteModal';
import AdvanceStageModal from './components/AdvanceStageModal';
import VendorFollowUpModal from './components/VendorFollowUpModal';
import NewBatchModal from './components/NewBatchModal';
import AddManualItemModal from './components/AddManualItemModal';
import BulkDispatchModal from './components/BulkDispatchModal';
import ChallanModal from './components/ChallanModal';
import AddVendorModal from './components/AddVendorModal';
import StockAmendmentModal from './components/StockAmendmentModal';
import ReworkModal from './components/ReworkModal';

import { fetchDashboard, toggleCritical } from './api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('rajtamil_auth_user') || sessionStorage.getItem('rajtamil_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'daily-tasks', 'item-stocks', 'items-to-start', 'assembly-plan', 'vendor-stocks', 'vendors', 'items-routes', 'challans'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active Modals
  const [selectedBatchForRoute, setSelectedBatchForRoute] = useState(null);
  const [selectedBatchForAdvance, setSelectedBatchForAdvance] = useState(null);
  const [selectedBatchForRework, setSelectedBatchForRework] = useState(null);
  const [selectedBatchForFollowup, setSelectedBatchForFollowup] = useState(null);
  const [selectedChallanNo, setSelectedChallanNo] = useState(null);
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [newBatchPrefill, setNewBatchPrefill] = useState(null);
  const [showAddManualItemModal, setShowAddManualItemModal] = useState(false);
  const [showBulkDispatchModal, setShowBulkDispatchModal] = useState(false);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [showStockAmendmentModal, setShowStockAmendmentModal] = useState(false);
  const [selectedItemCodeForStock, setSelectedItemCodeForStock] = useState('all');

  function handleNavigateToItemStocks(itemCode) {
    if (itemCode) {
      setSelectedItemCodeForStock(itemCode);
    }
    setActiveTab('item-stocks');
  }

  function handleLogout() {
    localStorage.removeItem('rajtamil_auth_user');
    localStorage.removeItem('rajtamil_auth_token');
    sessionStorage.removeItem('rajtamil_auth_user');
    sessionStorage.removeItem('rajtamil_auth_token');
    setCurrentUser(null);
  }

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchDashboard();
      setData(res);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleCritical(batchId) {
    try {
      const res = await toggleCritical(batchId);
      setData(prev => {
        if (!prev) return prev;
        const updatedBatches = prev.batches.map(b => 
          b.id === batchId ? { ...b, is_critical: res.is_critical } : b
        );
        const criticalCount = updatedBatches.filter(b => b.is_critical && b.status !== 'Completed').length;
        return {
          ...prev,
          metrics: { ...prev.metrics, critical_batches_count: criticalCount },
          batches: updatedBatches
        };
      });
    } catch (err) {
      alert('Error updating critical status: ' + err.message);
    }
  }

  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#06080f] text-slate-100 flex flex-col relative overflow-x-hidden selection:bg-cyan-500 selection:text-slate-950 font-sans">
      
      {/* Ambient Atmospheric Mesh Lighting */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[360px] bg-gradient-to-b from-cyan-600/[0.08] via-indigo-600/[0.04] to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/3 -left-48 w-[500px] h-[500px] bg-blue-600/[0.03] blur-[120px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 -right-48 w-[600px] h-[500px] bg-cyan-600/[0.03] blur-[140px] pointer-events-none -z-10" />
      
      {/* Top Header */}
      <Header
        metrics={data?.metrics}
        onRefresh={loadData}
        onOpenNewBatch={() => setShowNewBatchModal(true)}
        onOpenAddManualItem={() => setShowAddManualItemModal(true)}
        onOpenBulkDispatch={() => setShowBulkDispatchModal(true)}
        onOpenAddVendor={() => setShowAddVendorModal(true)}
        onOpenStockAmendment={() => setShowStockAmendmentModal(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-7">
        {loading && !data ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-5">
            <div className="relative flex items-center justify-center">
              <div className="w-14 h-14 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin"></div>
              <div className="absolute w-8 h-8 rounded-full border-2 border-indigo-500/20 border-b-indigo-400 animate-spin [animation-direction:reverse]"></div>
              <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full shadow-[0_0_12px_#22d3ee]"></div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">RAJTAMIL ENGINEER OS</p>
              <p className="text-xs text-slate-400 font-medium">Synchronizing shopfloor telemetry & vendor pipelines...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bezel-outer max-w-lg mx-auto my-16">
            <div className="bezel-inner p-6 text-center space-y-4">
              <div className="w-10 h-10 mx-auto rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold">
                !
              </div>
              <div>
                <h2 className="text-sm font-bold text-rose-300 uppercase tracking-wide">Workstation Connection Alert</h2>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{error}</p>
                <p className="text-[11px] text-slate-500 mt-1">Verify backend API status or network reachability.</p>
              </div>
              <button
                onClick={loadData}
                className="btn-machined px-5 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
              >
                Retry Telemetry Stream
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 1. Dashboard View */}
            {activeTab === 'dashboard' && (
              <Dashboard
                data={data}
                onToggleCritical={handleToggleCritical}
                onViewRoute={(batch) => setSelectedBatchForRoute(batch)}
                onAdvanceStage={(batch) => setSelectedBatchForAdvance(batch)}
                onOpenFollowup={(batch) => setSelectedBatchForFollowup(batch)}
                onViewChallan={(challanNo) => setSelectedChallanNo(challanNo)}
                onOpenNewBatch={() => setShowNewBatchModal(true)}
                onViewItemStocks={handleNavigateToItemStocks}
                onRework={(batch) => setSelectedBatchForRework(batch)}
              />
            )}

            {/* 2. Daily Tasks View (Dedicated Page) */}
            {activeTab === 'daily-tasks' && (
              <DailyTasksView
                onOpenFollowup={(batch) => setSelectedBatchForFollowup(batch)}
                onAdvanceStage={(batch) => setSelectedBatchForAdvance(batch)}
                onOpenBulkDispatch={() => setShowBulkDispatchModal(true)}
              />
            )}

            {/* 3. Item Stock & Stage-by-Stage WIP Pipeline */}
            {activeTab === 'item-stocks' && (
              <ItemStockStagesView
                selectedItemCode={selectedItemCodeForStock}
                onSelectItem={setSelectedItemCodeForStock}
                onAdvanceStage={(batch) => setSelectedBatchForAdvance(batch)}
                onOpenFollowup={(batch) => setSelectedBatchForFollowup(batch)}
                onViewChallan={(challanNo) => setSelectedChallanNo(challanNo)}
                onOpenNewBatch={(item) => setShowNewBatchModal(true)}
              />
            )}

            {/* 3.2 Items to Start (Process Launch Readiness) */}
            {activeTab === 'items-to-start' && (
              <ItemsToStartView
                onLaunchBatch={(params) => {
                  setNewBatchPrefill(params);
                  setShowNewBatchModal(true);
                }}
                onNavigateToRoute={() => setActiveTab('items-routes')}
              />
            )}

            {/* 3.5 Finished Item Assembly Consumption & Production Planning */}
            {activeTab === 'assembly-plan' && (
              <AssemblyPlanningView />
            )}

            {/* 4. Vendor Stocks View (High-visibility item code and name holdings) */}
            {activeTab === 'vendor-stocks' && (
              <VendorStocksView
                onOpenFollowup={(batch) => setSelectedBatchForFollowup(batch)}
                onAdvanceStage={(batch) => setSelectedBatchForAdvance(batch)}
                onViewChallan={(challanNo) => setSelectedChallanNo(challanNo)}
                onOpenBulkDispatch={() => setShowBulkDispatchModal(true)}
                onOpenAddVendor={() => setShowAddVendorModal(true)}
                onNavigateToVendors={() => setActiveTab('vendors')}
              />
            )}

            {/* 4. Subcontract Vendor Directory & Capabilities */}
            {activeTab === 'vendors' && (
              <VendorDirectoryView
                onOpenAddModal={() => setShowAddVendorModal(true)}
              />
            )}

            {/* 5. Items & Process Routes (Manual creation & route sequence) */}
            {activeTab === 'items-routes' && (
              <ItemsRouteView
                onOpenAddModal={() => setShowAddManualItemModal(true)}
                onLaunchBatch={(item) => setShowNewBatchModal(true)}
                onViewItemStocks={handleNavigateToItemStocks}
              />
            )}

            {/* 6. Recent (Finished Goods Inward & Delivery Challans Register) */}
            {(activeTab === 'recent' || activeTab === 'challans') && (
              <RecentView
                onSelectChallan={(challanNo) => setSelectedChallanNo(challanNo)}
                onViewRoute={(batch) => setSelectedBatchForRoute(batch)}
                onRework={(batch) => setSelectedBatchForRework(batch)}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="no-print border-t border-slate-900 bg-slate-950 py-4 px-4 text-center text-xs text-slate-600">
        <p>MachinaWork Pro • Jobwork & Subcontract Engineering OS • Constant Item Code & Multi-Vendor Tracking</p>
      </footer>

      {/* --- POPUP MODALS --- */}
      {selectedBatchForRoute && (
        <ItemRouteModal
          batch={selectedBatchForRoute}
          onClose={() => setSelectedBatchForRoute(null)}
          onAdvanceStage={(b) => {
            setSelectedBatchForRoute(null);
            setSelectedBatchForAdvance(b);
          }}
        />
      )}

      {selectedBatchForAdvance && (
        <AdvanceStageModal
          batch={selectedBatchForAdvance}
          onClose={() => setSelectedBatchForAdvance(null)}
          onSuccess={loadData}
        />
      )}

      {selectedBatchForRework && (
        <ReworkModal
          batch={selectedBatchForRework}
          onClose={() => setSelectedBatchForRework(null)}
          onSuccess={loadData}
        />
      )}

      {selectedBatchForFollowup && (
        <VendorFollowUpModal
          batch={selectedBatchForFollowup}
          onClose={() => setSelectedBatchForFollowup(null)}
          onSuccess={loadData}
        />
      )}

      {selectedChallanNo && (
        <ChallanModal
          challanNo={selectedChallanNo}
          onClose={() => setSelectedChallanNo(null)}
        />
      )}

      {showNewBatchModal && (
        <NewBatchModal
          initialItemCode={newBatchPrefill?.item_code}
          initialRouteId={newBatchPrefill?.route_id}
          initialQuantity={newBatchPrefill?.quantity}
          onClose={() => {
            setShowNewBatchModal(false);
            setNewBatchPrefill(null);
          }}
          onSuccess={() => {
            setShowNewBatchModal(false);
            setNewBatchPrefill(null);
            loadData();
          }}
        />
      )}

      {showAddManualItemModal && (
        <AddManualItemModal
          onClose={() => setShowAddManualItemModal(false)}
          onSuccess={loadData}
        />
      )}

      {showBulkDispatchModal && (
        <BulkDispatchModal
          onClose={() => setShowBulkDispatchModal(false)}
          onSuccess={loadData}
        />
      )}

      {showAddVendorModal && (
        <AddVendorModal
          onClose={() => setShowAddVendorModal(false)}
          onSuccess={() => {
            loadData();
          }}
        />
      )}

      {showStockAmendmentModal && (
        <StockAmendmentModal
          onClose={() => setShowStockAmendmentModal(false)}
          onSuccess={loadData}
        />
      )}

    </div>
  );
}
