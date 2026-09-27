const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export async function loginUser(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to sign in' }));
    throw new Error(err.detail || 'Failed to sign in');
  }
  return res.json();
}

export async function registerUser({ username, password, full_name, role }) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, full_name, role })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create account' }));
    throw new Error(err.detail || 'Failed to create account');
  }
  return res.json();
}

export async function fetchAuthUsers() {
  const res = await fetch(`${API_BASE}/auth/users`);
  if (!res.ok) throw new Error('Failed to fetch user directory');
  return res.json();
}

export async function fetchDashboard() {
  const res = await fetch(`${API_BASE}/dashboard/overview`);
  if (!res.ok) throw new Error('Failed to fetch dashboard data');
  return res.json();
}

export async function fetchBatches(params = {}) {
  const query = new URLSearchParams();
  if (params.item_code) query.append('item_code', params.item_code);
  if (params.vendor_id) query.append('vendor_id', params.vendor_id);
  if (params.critical_only) query.append('critical_only', 'true');
  
  const res = await fetch(`${API_BASE}/batches?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch batches');
  return res.json();
}

export async function createBatch(data) {
  const res = await fetch(`${API_BASE}/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create batch' }));
    throw new Error(err.detail || 'Failed to create batch');
  }
  return res.json();
}

export async function toggleCritical(batchId) {
  const res = await fetch(`${API_BASE}/batches/${batchId}/toggle-critical`, {
    method: 'PATCH'
  });
  if (!res.ok) throw new Error('Failed to toggle critical status');
  return res.json();
}

export async function advanceBatch(batchId, data) {
  const res = await fetch(`${API_BASE}/batches/${batchId}/advance-stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to advance stage' }));
    throw new Error(err.detail || 'Failed to advance stage');
  }
  return res.json();
}

export async function reworkBatch(batchId, data) {
  const res = await fetch(`${API_BASE}/batches/${batchId}/rework`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to send batch for rework' }));
    throw new Error(err.detail || 'Failed to send batch for rework');
  }
  return res.json();
}

export async function fetchBatchRouteProgress(batchId) {
  const res = await fetch(`${API_BASE}/batches/${batchId}/route-progress`);
  if (!res.ok) throw new Error('Failed to fetch route progress');
  return res.json();
}

export async function fetchRawMaterials() {
  const res = await fetch(`${API_BASE}/raw-materials`);
  if (!res.ok) throw new Error('Failed to fetch raw materials');
  return res.json();
}

export async function addRawMaterial(data) {
  const res = await fetch(`${API_BASE}/raw-materials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to add raw material' }));
    throw new Error(err.detail || 'Failed to add raw material');
  }
  return res.json();
}

export async function issueRawMaterial(data) {
  const res = await fetch(`${API_BASE}/raw-materials/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to issue raw material' }));
    throw new Error(err.detail || 'Failed to issue raw material');
  }
  return res.json();
}

export async function fetchItems() {
  const res = await fetch(`${API_BASE}/items`);
  if (!res.ok) throw new Error('Failed to fetch items');
  return res.json();
}

export async function createItem(data) {
  const res = await fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create item' }));
    throw new Error(err.detail || 'Failed to create item');
  }
  return res.json();
}

export async function fetchItemRoutes(itemCode) {
  const res = await fetch(`${API_BASE}/items/${encodeURIComponent(itemCode)}/routes`);
  if (!res.ok) throw new Error('Failed to fetch item routes');
  return res.json();
}

export async function createItemRoute(itemCode, data) {
  const res = await fetch(`${API_BASE}/items/${encodeURIComponent(itemCode)}/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create route' }));
    throw new Error(err.detail || 'Failed to create route');
  }
  return res.json();
}

export async function deleteItem(itemCode) {
  const res = await fetch(`${API_BASE}/items/${encodeURIComponent(itemCode)}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to delete item' }));
    throw new Error(err.detail || 'Failed to delete item');
  }
  return res.json();
}

export async function checkWeldingReadiness(batchId) {
  const res = await fetch(`${API_BASE}/welding-boms/check-readiness/${batchId}`);
  if (!res.ok) throw new Error('Failed to check welding component readiness');
  return res.json();
}

export async function fetchVendors() {
  const res = await fetch(`${API_BASE}/vendors`);
  if (!res.ok) throw new Error('Failed to fetch vendors');
  return res.json();
}

export async function createVendor(data) {
  const res = await fetch(`${API_BASE}/vendors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create vendor' }));
    throw new Error(err.detail || 'Failed to create vendor');
  }
  return res.json();
}

export async function updateVendor(vendorId, data) {
  const res = await fetch(`${API_BASE}/vendors/${vendorId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update vendor' }));
    throw new Error(err.detail || 'Failed to update vendor');
  }
  return res.json();
}

export async function deleteVendor(vendorId) {
  const res = await fetch(`${API_BASE}/vendors/${vendorId}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to delete vendor' }));
    throw new Error(err.detail || 'Failed to delete vendor');
  }
  return res.json();
}

export async function toggleVendorType(vendorId) {
  const res = await fetch(`${API_BASE}/vendors/${vendorId}/toggle-type`, {
    method: 'PATCH'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to toggle vendor type' }));
    throw new Error(err.detail || 'Failed to toggle vendor type');
  }
  return res.json();
}

export async function fetchLogisticsPlan(targetDate) {
  const query = targetDate ? `?target_date=${encodeURIComponent(targetDate)}` : '';
  const res = await fetch(`${API_BASE}/logistics-plan${query}`);
  if (!res.ok) throw new Error('Failed to fetch logistics plan');
  return res.json();
}


export async function fetchFollowups(params = {}) {
  const query = new URLSearchParams();
  if (params.vendor_id) query.append('vendor_id', params.vendor_id);
  if (params.batch_id) query.append('batch_id', params.batch_id);
  
  const res = await fetch(`${API_BASE}/followups?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch follow-ups');
  return res.json();
}

export async function addFollowup(data) {
  const res = await fetch(`${API_BASE}/followups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to add follow-up' }));
    throw new Error(err.detail || 'Failed to add follow-up');
  }
  return res.json();
}

export async function fetchChallans(challanType = null) {
  const query = challanType ? `?challan_type=${encodeURIComponent(challanType)}` : '';
  const res = await fetch(`${API_BASE}/challans${query}`);
  if (!res.ok) throw new Error('Failed to fetch challans');
  return res.json();
}

export async function fetchRecentFinishedGoods(limit = 50) {
  const res = await fetch(`${API_BASE}/finished-goods/recent?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch recent finished goods');
  return res.json();
}

export async function createChallan(data) {
  const res = await fetch(`${API_BASE}/challans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create challan' }));
    throw new Error(err.detail || 'Failed to create challan');
  }
  return res.json();
}

export async function fetchVendorStocks() {
  const res = await fetch(`${API_BASE}/vendor-stocks`);
  if (!res.ok) throw new Error('Failed to fetch vendor stocks');
  return res.json();
}

export async function fetchDailyTasks() {
  const res = await fetch(`${API_BASE}/daily-tasks`);
  if (!res.ok) throw new Error('Failed to fetch daily tasks');
  return res.json();
}

export async function createItemWithRoute(data) {
  const res = await fetch(`${API_BASE}/items/create-with-route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create item and route' }));
    throw new Error(err.detail || 'Failed to create item and route');
  }
  return res.json();
}

export async function bulkDispatchToVendor(data) {
  const res = await fetch(`${API_BASE}/vendors/bulk-dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to dispatch items to vendor' }));
    throw new Error(err.detail || 'Failed to dispatch items to vendor');
  }
  return res.json();
}

export async function fetchItemStocksByStage() {
  const res = await fetch(`${API_BASE}/stock/items-by-stage`);
  if (!res.ok) throw new Error('Failed to fetch item stocks by stage');
  return res.json();
}

// ==========================================
// ASSEMBLY & FINISHED ITEM CONSUMPTION APIS
// ==========================================

export async function fetchAssemblies() {
  const res = await fetch(`${API_BASE}/assemblies`);
  if (!res.ok) throw new Error('Failed to fetch assemblies');
  return res.json();
}

export async function createAssembly(data) {
  const res = await fetch(`${API_BASE}/assemblies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create assembly' }));
    throw new Error(err.detail || 'Failed to create assembly');
  }
  return res.json();
}

export async function updateAssembly(id, data) {
  const res = await fetch(`${API_BASE}/assemblies/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update assembly' }));
    throw new Error(err.detail || 'Failed to update assembly');
  }
  return res.json();
}

export async function deleteAssembly(id) {
  const res = await fetch(`${API_BASE}/assemblies/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to delete assembly' }));
    throw new Error(err.detail || 'Failed to delete assembly');
  }
  return res.json();
}

export async function assignAssemblyBOMItem(assemblyId, data) {
  const res = await fetch(`${API_BASE}/assemblies/${assemblyId}/bom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to assign item to assembly' }));
    throw new Error(err.detail || 'Failed to assign item to assembly');
  }
  return res.json();
}

export async function removeAssemblyBOMItem(assemblyId, bomId) {
  const res = await fetch(`${API_BASE}/assemblies/${assemblyId}/bom/${bomId}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to remove item from assembly' }));
    throw new Error(err.detail || 'Failed to remove item from assembly');
  }
  return res.json();
}

export async function fetchProductionPlans(month = null) {
  const query = month ? `?month=${encodeURIComponent(month)}` : '';
  const res = await fetch(`${API_BASE}/production-planning/plans${query}`);
  if (!res.ok) throw new Error('Failed to fetch production plans');
  return res.json();
}

export async function saveMonthlyTargets(data) {
  const res = await fetch(`${API_BASE}/production-planning/monthly-targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to save monthly targets' }));
    throw new Error(err.detail || 'Failed to save monthly targets');
  }
  return res.json();
}

export async function saveDailySchedule(data) {
  const res = await fetch(`${API_BASE}/production-planning/daily-schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to save daily schedule' }));
    throw new Error(err.detail || 'Failed to save daily schedule');
  }
  return res.json();
}

export async function fetchDailyConsumption(month = null) {
  const query = month ? `?month=${encodeURIComponent(month)}` : '';
  const res = await fetch(`${API_BASE}/production-planning/daily-consumption${query}`);
  if (!res.ok) throw new Error('Failed to fetch daily finished item consumption');
  return res.json();
}

export async function updateItem(itemCode, data) {
  const res = await fetch(`${API_BASE}/items/${encodeURIComponent(itemCode)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update item' }));
    throw new Error(err.detail || 'Failed to update item');
  }
  return res.json();
}

export async function amendStock(data) {
  const res = await fetch(`${API_BASE}/stock/amendment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to apply stock amendment' }));
    throw new Error(err.detail || 'Failed to apply stock amendment');
  }
  return res.json();
}

export async function fetchStockAmendments(params = {}) {
  const query = new URLSearchParams();
  if (params.item_code) query.append('item_code', params.item_code);
  if (params.raw_material_code) query.append('raw_material_code', params.raw_material_code);
  if (params.target_type) query.append('target_type', params.target_type);
  if (params.limit) query.append('limit', params.limit);

  const res = await fetch(`${API_BASE}/stock/amendments?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch stock amendments');
  return res.json();
}

export async function fetchItemsToStart(params = {}) {
  const query = new URLSearchParams();
  if (params.month) query.append('month', params.month);
  if (params.target_date) query.append('target_date', params.target_date);

  const res = await fetch(`${API_BASE}/production-planning/items-to-start?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch items to start');
  return res.json();
}





