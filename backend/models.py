from pydantic import BaseModel, Field
from typing import Optional, List

class LoginRequest(BaseModel):
    username: str
    password: str

class SignupRequest(BaseModel):
    username: str
    password: str
    full_name: str
    role: Optional[str] = "Engineer"

class RawMaterialCreate(BaseModel):
    code: str
    name: str
    grade: str
    form: str
    unit: str
    stock_quantity: float = 0.0
    heat_number: Optional[str] = None
    unit_cost: float = 0.0
    notes: Optional[str] = None

class RawMaterialIssue(BaseModel):
    raw_material_code: str
    quantity_used: float
    target_item_code: str
    batch_no: Optional[str] = None
    target_item_quantity: int
    notes: Optional[str] = None

class ItemCreate(BaseModel):
    item_code: str
    name: str
    drawing_no: Optional[str] = None
    revision: Optional[str] = "A"
    material_code: Optional[str] = None
    raw_material_name: Optional[str] = None
    weight: Optional[float] = 0.0
    default_quantity: int = 100
    notes: Optional[str] = None

class VendorCreate(BaseModel):
    code: str
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    processes_offered: str
    default_lead_time_days: int = 3
    rating: float = 4.5
    notes: Optional[str] = None
    vendor_type: Optional[str] = "Local"  # 'Local' or 'Trip'

class VendorTypeUpdate(BaseModel):
    vendor_type: str  # 'Local' or 'Trip'

class RouteStageCreate(BaseModel):
    sequence_no: int
    process_name: str
    vendor_id: Optional[int] = None
    is_inhouse: bool = False
    lead_time_days: int = 3
    is_welding_stage: bool = False
    notes: Optional[str] = None

class ProcessRouteCreate(BaseModel):
    item_code: str
    route_name: str
    description: Optional[str] = None
    is_default: bool = True
    stages: List[RouteStageCreate]

class WeldingBOMItemCreate(BaseModel):
    route_stage_id: int
    parent_item_code: str
    child_item_code: str
    quantity_per_unit: float
    unit: str = "pcs"
    notes: Optional[str] = None

class BatchCreate(BaseModel):
    batch_no: str
    item_code: str
    route_id: int
    quantity_total: int
    raw_material_code: Optional[str] = None
    raw_material_quantity: Optional[float] = None
    raw_material_unit: Optional[str] = None
    is_critical: bool = False
    notes: Optional[str] = None

class BatchAdvance(BaseModel):
    quantity_accepted: int
    quantity_rejected: int = 0
    next_vendor_id: Optional[int] = None
    next_is_inhouse: Optional[bool] = None
    next_lead_time_days: Optional[int] = None
    challan_no: Optional[str] = None
    remarks: Optional[str] = None

class BatchRework(BaseModel):
    target_stage_sequence: int
    quantity: int
    vendor_id: Optional[int] = None
    challan_no: Optional[str] = None
    remarks: Optional[str] = None

class VendorFollowUpCreate(BaseModel):
    batch_id: int
    vendor_id: int
    challan_no: Optional[str] = None
    contact_person: Optional[str] = None
    method: str = "Call"  # Call, WhatsApp, Email, Visit
    vendor_status_update: str
    promised_date: Optional[str] = None
    notes: Optional[str] = None

class ChallanCreate(BaseModel):
    challan_no: str
    challan_type: str = "Outward to Vendor"
    date: str
    vendor_id: Optional[int] = None
    batch_id: Optional[int] = None
    item_code: str
    process_name: Optional[str] = None
    quantity: int
    weight_or_length: Optional[float] = None
    unit: Optional[str] = None
    transporter: Optional[str] = None
    vehicle_no: Optional[str] = None
    remarks: Optional[str] = None

class StageDefinition(BaseModel):
    sequence_no: int
    process_name: str
    vendor_id: Optional[int] = None
    is_inhouse: bool = False
    lead_time_days: int = 3
    is_welding_stage: bool = False
    notes: Optional[str] = None
    welding_components: Optional[List[dict]] = None # [{child_item_code, quantity_per_unit}]

class ItemWithRouteCreate(BaseModel):
    item_code: str
    name: str
    drawing_no: Optional[str] = None
    revision: Optional[str] = "A"
    material_code: Optional[str] = None
    raw_material_name: Optional[str] = None
    weight: Optional[float] = 0.0
    notes: Optional[str] = None
    route_name: Optional[str] = "Standard Process Route"
    stages: List[StageDefinition]

class BulkDispatchItem(BaseModel):
    batch_id: int
    item_code: str
    quantity: int
    process_name: str

class BulkDispatchToVendor(BaseModel):
    vendor_id: int
    date: str
    challan_no: Optional[str] = None
    items: List[BulkDispatchItem]
    transporter: Optional[str] = None
    vehicle_no: Optional[str] = None
    remarks: Optional[str] = None

# ==========================================
# ASSEMBLY & FINISHED ITEM CONSUMPTION MODELS
# ==========================================

class AssemblyCreate(BaseModel):
    assembly_code: str
    name: str
    description: Optional[str] = None
    customer: Optional[str] = None
    drawing_no: Optional[str] = None

class AssemblyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    customer: Optional[str] = None
    drawing_no: Optional[str] = None

class AssemblyBOMItemCreate(BaseModel):
    item_code: str
    consumption_qty: float = 1.0
    unit: Optional[str] = "pcs"
    notes: Optional[str] = None

class AssemblyBOMItemUpdate(BaseModel):
    consumption_qty: float
    unit: Optional[str] = "pcs"
    notes: Optional[str] = None

class MonthlyTargetItem(BaseModel):
    assembly_id: int
    target_quantity: int
    working_days: Optional[int] = 25
    notes: Optional[str] = None

class MonthlyTargetsPayload(BaseModel):
    year_month: str  # e.g. "2026-09" or "2026-10"
    auto_distribute: Optional[bool] = True
    targets: List[MonthlyTargetItem]

class DailyScheduleItem(BaseModel):
    plan_date: str   # e.g. "2026-09-01"
    assembly_id: int
    planned_quantity: int
    actual_quantity: Optional[int] = None
    notes: Optional[str] = None

class DailyScheduleBatchUpdate(BaseModel):
    items: List[DailyScheduleItem]

# ==========================================
# ITEM EDIT & STOCK AMENDMENT MODELS
# ==========================================

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    drawing_no: Optional[str] = None
    revision: Optional[str] = None
    material_code: Optional[str] = None
    raw_material_name: Optional[str] = None
    weight: Optional[float] = None
    default_quantity: Optional[int] = None
    notes: Optional[str] = None
    route_name: Optional[str] = None
    stages: Optional[List[StageDefinition]] = None

class StockAmendmentCreate(BaseModel):
    target_type: str  # 'finished_goods', 'raw_material', 'stage_wip'
    adjustment_type: str  # 'add' or 'deduct'
    quantity: float
    item_code: Optional[str] = None
    stage_sequence: Optional[int] = None
    stage_name: Optional[str] = None
    vendor_id: Optional[int] = None
    raw_material_code: Optional[str] = None
    reason: str
    remarks: Optional[str] = None



