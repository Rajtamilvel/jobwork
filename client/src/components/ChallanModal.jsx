import React, { useState, useEffect } from 'react';
import { X, Printer, FileText, CheckCircle, Truck, Download } from 'lucide-react';
import { fetchChallans } from '../api';

export default function ChallanModal({ challanNo, onClose }) {
  const [challan, setChallan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!challanNo) return;
    loadChallan();
  }, [challanNo]);

  async function loadChallan() {
    try {
      setLoading(true);
      const data = await fetchChallans();
      const match = data.find(c => c.challan_no === challanNo);
      setChallan(match || data[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (!challanNo && !challan) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        
        {/* Modal Top Bar (Hidden in Print) */}
        <div className="no-print px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">
              Official Jobwork Delivery Challan
            </h3>
            <span className="text-xs font-mono bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800">
              {challan?.challan_no}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow"
            >
              <Printer className="w-4 h-4" />
              <span>Print Challan</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div className="p-8 bg-white text-black font-sans text-xs print-area max-h-[80vh] overflow-y-auto">
          
          {/* Header */}
          <div className="border-b-2 border-black pb-4 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-black uppercase tracking-wider text-black">
                  PRECISION JOBWORK ENGINEERING
                </h1>
                <p className="text-[11px] text-gray-700">
                  Toolroom, CNC Machining & Subcontract Manufacturing Works
                </p>
                <p className="text-[10px] text-gray-600">
                  Industrial Estate, Phase II • GSTIN: 29ABCDE1234F1Z5 • Phone: +91 98450 00111
                </p>
              </div>

              <div className="text-right border border-black p-2 bg-gray-50">
                <div className="text-sm font-bold uppercase text-black">
                  DELIVERY CHALLAN
                </div>
                <div className="text-[10px] text-gray-600">
                  (For Jobwork / Subcontract Processing)
                </div>
                <div className="text-xs font-mono font-bold mt-1">
                  Challan No: {challan?.challan_no}
                </div>
                <div className="text-[11px]">
                  Date: {challan?.date}
                </div>
              </div>
            </div>
          </div>

          {/* Consignor & Consignee */}
          <div className="grid grid-cols-2 gap-4 border border-black p-3 mb-4 text-xs">
            <div>
              <span className="font-bold text-gray-700 block uppercase text-[10px]">Issued By (Consignor):</span>
              <strong className="text-sm">PRECISION JOBWORK ENGINEERING</strong>
              <p className="text-gray-700">Engineering Workshop & Store Yard</p>
              <p className="text-gray-700">Contact: Jobwork Engineer (+91 98450 00111)</p>
            </div>

            <div className="border-l border-black pl-3">
              <span className="font-bold text-gray-700 block uppercase text-[10px]">Send To Vendor (Consignee):</span>
              <strong className="text-sm">{challan?.vendor_name || 'Subcontractor'}</strong>
              <p className="text-gray-700">{challan?.vendor_address || 'Vendor Facility'}</p>
              <p className="text-gray-700">Phone: {challan?.vendor_phone || 'N/A'}</p>
            </div>
          </div>

          {/* Dispatch Details */}
          <div className="grid grid-cols-3 gap-2 border border-black p-2 mb-4 text-[11px] bg-gray-50">
            <div>
              <span className="text-gray-600">Nature of Jobwork:</span>
              <div className="font-bold uppercase text-black">{challan?.process_name}</div>
            </div>
            <div>
              <span className="text-gray-600">Transporter:</span>
              <div className="font-medium text-black">{challan?.transporter || 'Direct Handover / Tempo'}</div>
            </div>
            <div>
              <span className="text-gray-600">Vehicle No:</span>
              <div className="font-mono font-bold text-black">{challan?.vehicle_no || 'TN-09-AK-3312'}</div>
            </div>
          </div>

          {/* Table of Items */}
          <table className="w-full border-collapse border border-black mb-6 text-xs">
            <thead>
              <tr className="bg-gray-200 border-b border-black text-left uppercase text-[10px]">
                <th className="border border-black p-2 text-center w-10">S.No</th>
                <th className="border border-black p-2">Item Code</th>
                <th className="border border-black p-2">Description / Part Details</th>
                <th className="border border-black p-2 text-center">Operation to Do</th>
                <th className="border border-black p-2 text-right">Quantity (Pcs)</th>
                <th className="border border-black p-2 text-right">Gross Weight / Length</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-2 text-center font-mono">1</td>
                <td className="border border-black p-2 font-mono font-bold text-sm">
                  {challan?.item_code}
                </td>
                <td className="border border-black p-2">
                  <div className="font-bold">{challan?.item_name}</div>
                  <div className="text-[11px] text-gray-600">Dwg: {challan?.drawing_no || 'Standard Spec'}</div>
                  <div className="text-[10px] text-gray-500 italic mt-0.5">{challan?.remarks}</div>
                </td>
                <td className="border border-black p-2 text-center font-semibold">
                  {challan?.process_name}
                </td>
                <td className="border border-black p-2 text-right font-mono font-bold text-sm">
                  {challan?.quantity} pcs
                </td>
                <td className="border border-black p-2 text-right font-mono">
                  {challan?.weight_or_length ? `${challan.weight_or_length} ${challan.unit || 'kg'}` : 'As per lot'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Terms & Declarations */}
          <div className="border border-black p-3 mb-6 text-[10px] text-gray-700 space-y-1">
            <p><strong>Declaration:</strong> Material sent is meant strictly for jobwork / subcontract processing and will be returned to us after process completion. Not for sale.</p>
            <p><strong>Vendor Note:</strong> Please verify quantity, dimensions, and weight upon receipt. Rejections/scrap must be returned with separate reconciliation.</p>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-6 pt-6 text-center text-xs">
            <div className="border-t border-black pt-2">
              <span className="text-gray-600 block text-[10px]">Prepared By</span>
              <strong className="block mt-4">Jobwork Engineer</strong>
            </div>

            <div className="border-t border-black pt-2">
              <span className="text-gray-600 block text-[10px]">Transporter / Driver Sign</span>
              <strong className="block mt-4">Vehicle Operator</strong>
            </div>

            <div className="border-t border-black pt-2">
              <span className="text-gray-600 block text-[10px]">Receiver's Stamp & Sign</span>
              <strong className="block mt-4">For {challan?.vendor_name}</strong>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="no-print px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
