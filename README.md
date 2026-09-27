# Rajtamil Jobwork & Subcontract Engineer OS

Precision Jobwork, Multi-Vendor Subcontract Routing, and Production Stage Pipeline Management System.

---

## 🌟 Key Features

- **Constant Item Code & Multi-Vendor Tracking**: Manage manufacturing parts with fixed item codes across multiple external vendors.
- **Stage-by-Stage WIP Pipeline**: Visual stage transitions, vendor dispatches, and inward receipts.
- **Delivery Challan Register**: Automatic 3-copy delivery challan generation with transporter and vehicle details.
- **Items to Start & Assembly Planning**: Process readiness check against raw material availability and daily plan targets.
- **Stock Amendment (+ / -)**: Reconcile finished goods, raw materials, and stage WIP.
- **Authentication & Role-Based Access**:
  - Secure User ID and password authentication (SHA-256 encrypted).
  - New user sign-up with shopfloor role assignment (*Engineer*, *Supervisor*, *Quality Inspector*, *Operator*, *Management*, *Admin*).

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+)
- Python 3.10+
- SQLite3

### 1. Backend Setup (FastAPI)
```bash
cd backend
pip install -r requirements.txt # or fastapi uvicorn pydantic
python -m uvicorn main:app --reload --port 8000
```
Backend API will be running on `http://localhost:8000` with Swagger docs at `http://localhost:8000/docs`.

### 2. Frontend Setup (React + Vite)
```bash
cd client
npm install
npm run dev
```
Client application will be running on `http://localhost:5173`.

---

## 👥 Default Accounts

| User ID | Password | Role |
| :--- | :--- | :--- |
| `admin` | `admin123` | System Administrator |
| `engineer` | `engineer123` | Lead Jobwork Engineer |
| `rajtamil` | `rajtamil123` | Chief Operating Officer |
| `supervisor` | `supervisor123` | Shopfloor Supervisor |

*You can also create new users using the **New User Sign Up** tab on the login screen.*
