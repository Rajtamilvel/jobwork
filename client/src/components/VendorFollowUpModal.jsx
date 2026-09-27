import React, { useState, useEffect } from 'react';
import { 
  X, PhoneCall, MessageSquare, Mail, Calendar, Clock, 
  Send, Copy, Check, AlertTriangle, CheckCircle, Truck, FileText
} from 'lucide-react';
import { fetchFollowups, addFollowup } from '../api';

export default function VendorFollowUpModal({ batch, onClose, onSuccess }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // New Log Form
  const [contactPerson, setContactPerson] = useState(batch?.vendor_contact || '');
  const [method, setMethod] = useState('Call');
  const [statusUpdate, setStatusUpdate] = useState('');
  const [promisedDate, setPromisedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!batch) return;
    loadLogs();
  }, [batch]);

  async function loadLogs() {
    try {
      setLoading(true);
      const data = await fetchFollowups({ batch_id: batch.id });
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Pre-formatted WhatsApp reminder text
  const whatsappTemplate = `Dear ${batch?.vendor_contact || 'Sir/Team'} (${batch?.vendor_name}),
Regarding Jobwork Challan ${batch?.challan_no || 'DC'} for Item Code ${batch?.item_code} (${batch?.quantity_accepted} pcs) sent for ${batch?.current_process}.
Our expected delivery date is ${batch?.expected_delivery_date || 'immediate'}. 
Please share the current work status and dispatch ETA.
Thank you,
Jobwork Engineering Team`;

  function handleCopyTemplate() {
    navigator.clipboard.writeText(whatsappTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleAddLog(e) {
    e.preventDefault();
    if (!statusUpdate) return;

    try {
      setSubmitting(true);
      await addFollowup({
        batch_id: batch.id,
        vendor_id: batch.current_vendor_id,
        challan_no: batch.challan_no,
        contact_person: contactPerson,
        method,
        vendor_status_update: statusUpdate,
        promised_date: promisedDate || null,
        notes: notes || null
      });
      setStatusUpdate('');
      setNotes('');
      await loadLogs();
      if (onSuccess) onSuccess();
    } catch (err) {
      alert(err.message || 'Failed to add follow-up log');
    } finally {
      setSubmitting(false);
    }
  }

  if (!batch) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-950 text-amber-400 rounded-xl border border-amber-800/60">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Vendor Material Delivery Follow-up:</span>
                <span className="font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800 text-sm">
                  {batch.item_code}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Vendor: <strong className="text-white">{batch.vendor_name}</strong> • Process: <span className="text-cyan-300">{batch.current_process}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Status Overview Card */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Quantity Sent:</span>
              <span className="font-mono font-bold text-white text-sm">{batch.quantity_accepted} pcs</span>
              {batch.raw_material_quantity && (
                <div className="text-[10px] text-amber-300">({batch.raw_material_quantity} {batch.raw_material_unit})</div>
              )}
            </div>

            <div>
              <span className="text-slate-500 block">Date Sent:</span>
              <span className="text-slate-300 font-mono">{batch.date_sent_to_vendor || 'N/A'}</span>
            </div>

            <div>
              <span className="text-slate-500 block">Expected Due Date:</span>
              <span className="text-slate-200 font-mono">{batch.expected_delivery_date || 'N/A'}</span>
            </div>

            <div>
              <span className="text-slate-500 block">SLA Status:</span>
              <span className={`inline-block px-2 py-0.5 rounded font-semibold text-[11px] mt-0.5 ${
                batch.lead_status?.color === 'red'
                  ? 'bg-red-950 text-red-300 border border-red-600/50'
                  : 'bg-amber-950 text-amber-300 border border-amber-600/50'
              }`}>
                {batch.lead_status?.badge}
              </span>
            </div>
          </div>

          {/* Quick WhatsApp Reminder Generator */}
          <div className="bg-slate-950 p-4 rounded-xl border border-indigo-900/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span>Ready-to-Send WhatsApp / SMS Reminder</span>
              </span>

              <button
                onClick={handleCopyTemplate}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-300 text-xs border border-indigo-700/50 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Text'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 rounded-lg text-slate-300 font-mono text-[11px] whitespace-pre-wrap border border-slate-800">
              {whatsappTemplate}
            </pre>
          </div>

          {/* Log New Follow-up Form */}
          <form onSubmit={handleAddLog} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              + Log New Vendor Follow-up Call / Message
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Call">Phone Call</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Email">Email</option>
                  <option value="Visit">Shop Visit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Promised Delivery Date</label>
                <input
                  type="date"
                  value={promisedDate}
                  onChange={(e) => setPromisedDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Vendor Status Update <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Quenching completed, tempering underway, driver will dispatch at 4 PM"
                value={statusUpdate}
                onChange={(e) => setStatusUpdate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !statusUpdate}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md shadow-amber-600/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Saving...' : 'Save Follow-up Note'}</span>
              </button>
            </div>
          </form>

          {/* Previous Follow-up History */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Follow-up History Log ({logs.length})
            </h4>

            {loading ? (
              <div className="text-xs text-slate-500 py-4 text-center">Loading follow-ups...</div>
            ) : logs.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center bg-slate-950 p-4 rounded-xl border border-slate-800">
                No previous follow-up logs recorded for this batch.
              </div>
            ) : (
              <div className="space-y-2.5">
                {logs.map(log => (
                  <div key={log.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{log.contact_person || 'Vendor'}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                          {log.method}
                        </span>
                        {log.promised_date && (
                          <span className="text-[11px] text-cyan-300 font-mono bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40">
                            Promised: {log.promised_date}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500 text-[11px]">{log.date_contacted}</span>
                    </div>

                    <p className="text-slate-200 mt-1">"{log.vendor_status_update}"</p>
                    {log.notes && <p className="text-[11px] text-slate-400 italic mt-0.5">{log.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex justify-end">
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
