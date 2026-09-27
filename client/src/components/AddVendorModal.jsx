import React, { useState, useEffect } from 'react';
import { X, Truck, Building2, Phone, Mail, MapPin, Clock, Star, Sparkles, AlertTriangle } from 'lucide-react';
import { createVendor, updateVendor } from '../api';

const COMMON_PROCESSES = [
  'Forging',
  'Heat Treatment',
  'Normalizing',
  'Shot Blasting',
  'Hobbing',
  'Nitriding',
  'CNC Machining',
  'Welding',
  'Cylindrical Grinding',
  'Induction Hardening',
  'Zinc Plating',
  'Black Phosphating'
];

export default function AddVendorModal({ onClose, onSuccess, vendorToEdit = null }) {
  const isEditing = Boolean(vendorToEdit && vendorToEdit.id);

  const [code, setCode] = useState(vendorToEdit?.code || '');
  const [name, setName] = useState(vendorToEdit?.name || '');
  const [contactPerson, setContactPerson] = useState(vendorToEdit?.contact_person || '');
  const [phone, setPhone] = useState(vendorToEdit?.phone || '');
  const [email, setEmail] = useState(vendorToEdit?.email || '');
  const [address, setAddress] = useState(vendorToEdit?.address || '');
  const [processesOffered, setProcessesOffered] = useState(vendorToEdit?.processes_offered || '');
  const [defaultLeadTimeDays, setDefaultLeadTimeDays] = useState(vendorToEdit?.default_lead_time_days || 3);
  const [rating, setRating] = useState(vendorToEdit?.rating || 4.5);
  const [notes, setNotes] = useState(vendorToEdit?.notes || '');
  const [vendorType, setVendorType] = useState(vendorToEdit?.vendor_type || 'Local');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (vendorToEdit) {
      setCode(vendorToEdit.code || '');
      setName(vendorToEdit.name || '');
      setContactPerson(vendorToEdit.contact_person || '');
      setPhone(vendorToEdit.phone || '');
      setEmail(vendorToEdit.email || '');
      setAddress(vendorToEdit.address || '');
      setProcessesOffered(vendorToEdit.processes_offered || '');
      setDefaultLeadTimeDays(vendorToEdit.default_lead_time_days || 3);
      setRating(vendorToEdit.rating || 4.5);
      setNotes(vendorToEdit.notes || '');
      setVendorType(vendorToEdit.vendor_type || 'Local');
    }
  }, [vendorToEdit]);

  function handleProcessTagClick(proc) {
    if (!processesOffered) {
      setProcessesOffered(proc);
      return;
    }
    const currentList = processesOffered.split(',').map(s => s.trim());
    if (currentList.includes(proc)) {
      setProcessesOffered(currentList.filter(s => s !== proc).join(', '));
    } else {
      setProcessesOffered([...currentList, proc].join(', '));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!code.trim() || !name.trim()) {
      setError('Vendor Code and Name are required.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        contact_person: contactPerson.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        processes_offered: processesOffered.trim() || 'General Jobwork',
        default_lead_time_days: parseInt(defaultLeadTimeDays, 10) || 3,
        rating: parseFloat(rating) || 4.5,
        notes: notes.trim() || null,
        vendor_type: vendorType || 'Local'
      };

      let res;
      if (isEditing) {
        res = await updateVendor(vendorToEdit.id, payload);
      } else {
        res = await createVendor(payload);
      }

      if (onSuccess) {
        onSuccess(res || payload);
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save vendor');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center">
              <Truck className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{isEditing ? 'Edit Vendor Details' : 'Register New Subcontract Vendor'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEditing ? 'Update vendor details and lead times' : 'Add external jobwork vendor with capabilities and standard turnaround days'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/80 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Code & Lead Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Vendor Code * <span className="text-[10px] text-slate-500 font-normal">(Unique identifier)</span>
              </label>
              <input
                type="text"
                required
                disabled={isEditing}
                placeholder="e.g. VND-SUN or VND-HT01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono font-bold text-cyan-400 uppercase placeholder-slate-600 focus:outline-none focus:border-cyan-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Default Lead Time (Days) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  min="1"
                  max="90"
                  value={defaultLeadTimeDays}
                  onChange={(e) => setDefaultLeadTimeDays(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                  Days
                </span>
              </div>
            </div>
          </div>

          {/* Logistics Classification: Local vs Trip */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Logistics Plan Category *</span>
              <span className="text-[10px] text-slate-400 font-normal">Categorizes vendor for Day-Before Planning</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVendorType('Local')}
                className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  vendorType === 'Local'
                    ? 'bg-cyan-950/80 border-cyan-500 text-white shadow-md shadow-cyan-950/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${vendorType === 'Local' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>Local Vendor</span>
                    {vendorType === 'Local' && <span className="text-[10px] font-normal text-cyan-300 font-mono">(Active)</span>}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    City / Local industrial area (Local Plan)
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVendorType('Trip')}
                className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  vendorType === 'Trip'
                    ? 'bg-amber-950/80 border-amber-500 text-white shadow-md shadow-amber-950/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${vendorType === 'Trip' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>Trip Vendor</span>
                    {vendorType === 'Trip' && <span className="text-[10px] font-normal text-amber-300 font-mono">(Active)</span>}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    Outstation / Vehicle route (Trip Plan)
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Company / Workshop Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Vendor / Workshop Name *
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="e.g. Sun Forgings & Stampings Pvt Ltd"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Processes & Capabilities */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Processes & Capabilities *
              </label>
              <span className="text-[10px] text-cyan-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Quick suggestions below
              </span>
            </div>
            <input
              type="text"
              required
              placeholder="e.g. Closed Die Forging, Normalizing, Shot Blasting"
              value={processesOffered}
              onChange={(e) => setProcessesOffered(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
            {/* Quick Process Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {COMMON_PROCESSES.map(proc => {
                const isSelected = processesOffered.split(',').map(s => s.trim()).includes(proc);
                return (
                  <button
                    key={proc}
                    type="button"
                    onClick={() => handleProcessTagClick(proc)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                      isSelected
                        ? 'bg-cyan-600 text-white border border-cyan-400'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {isSelected ? `✓ ${proc}` : `+ ${proc}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contact Person & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Contact Person</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Patel"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Phone / Mobile</label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. +91 98450 11223"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Email & Rating */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="e.g. dispatch@sunforgings.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1 flex items-center justify-between">
                <span>Vendor Rating (1 to 5)</span>
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400" />
                  {rating}
                </span>
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="0.1"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs text-slate-300 mb-1">Address / Industrial Area</label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <textarea
                rows="2"
                placeholder="e.g. Plot 42, Peenya Industrial Area Phase 2, Bangalore"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-slate-300 mb-1">Internal Notes / Payment Terms</label>
            <textarea
              rows="2"
              placeholder="e.g. Payment: Net 30 days. Weekly batch pickup on Thursdays."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>{submitting ? 'Saving...' : isEditing ? 'Update Vendor' : 'Register Vendor'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
