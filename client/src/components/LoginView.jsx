import React, { useState } from 'react';
import { 
  Factory, User, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, 
  AlertCircle, CheckCircle2, UserPlus, LogIn, Briefcase, BadgeCheck
} from 'lucide-react';
import { loginUser, registerUser } from '../api';

export default function LoginView({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'

  // Form Fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('Engineer');

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  function resetForm() {
    setError(null);
    setSuccessMsg(null);
    setPassword('');
    setConfirmPassword('');
  }

  function handleSwitchMode(newMode) {
    setMode(newMode);
    resetForm();
  }

  async function handleLogin(e) {
    if (e) e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your User ID.');
      return;
    }
    if (!password) {
      setError('Please enter your Password.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await loginUser(username.trim(), password);
      
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('rajtamil_auth_user', JSON.stringify(res.user));
      storage.setItem('rajtamil_auth_token', res.token);

      if (onLoginSuccess) {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setError(err.message || 'Invalid User ID or Password');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e) {
    if (e) e.preventDefault();
    const cleanUsername = username.trim();
    const cleanFullName = fullName.trim();

    if (!cleanUsername || cleanUsername.length < 3) {
      setError('User ID must be at least 3 characters.');
      return;
    }
    if (!cleanFullName) {
      setError('Please enter your Full Name.');
      return;
    }
    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await registerUser({
        username: cleanUsername,
        password: password,
        full_name: cleanFullName,
        role: role
      });

      // Automatically store session & log in
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('rajtamil_auth_user', JSON.stringify(res.user));
      storage.setItem('rajtamil_auth_token', res.token);

      setSuccessMsg('Account created successfully! Entering workstation...');
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(res.user);
        }
      }, 700);
    } catch (err) {
      setError(err.message || 'Failed to create user account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#06080f] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden selection:bg-cyan-500 selection:text-slate-950 font-sans">
      
      {/* Ambient background lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[380px] bg-gradient-to-tr from-cyan-600/[0.12] via-blue-600/[0.08] to-indigo-600/[0.12] blur-3xl pointer-events-none rounded-full" />
      <div className="absolute -bottom-24 right-1/4 w-[500px] h-[350px] bg-cyan-600/[0.05] blur-3xl pointer-events-none rounded-full" />

      {/* Main Authentication Enclosure (Double-Bezel Architecture) */}
      <div className="bezel-outer w-full max-w-md relative z-10 shadow-2xl">
        <div className="bezel-inner p-8">
          
          {/* Brand Header */}
          <div className="text-center space-y-3 mb-7">
            <div className="inline-flex p-1 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 shadow-lg shadow-cyan-500/10">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 via-cyan-600 to-blue-600 flex items-center justify-center shadow-inner">
                <Factory className="w-6 h-6 text-slate-950 stroke-[2.2]" />
              </div>
            </div>

            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center justify-center gap-1.5">
                <span>RAJTAMIL</span>
                <span className="text-cyan-400">JOBWORK</span>
              </h1>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold tracking-wider uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 rounded-full shadow-sm">
                  ENGINEER OS
                </span>
                <span className="text-[11px] text-slate-400 font-medium">• Precision Workstation</span>
              </div>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 mb-6 bg-black/40 rounded-xl border border-white/[0.06]">
            <button
              type="button"
              onClick={() => handleSwitchMode('login')}
              className={`btn-machined flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white/[0.08] text-white shadow-sm border border-white/[0.1]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchMode('signup')}
              className={`btn-machined flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-white/[0.08] text-white shadow-sm border border-white/[0.1]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Register User</span>
            </button>
          </div>

          {/* Error Notification */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="font-medium leading-relaxed">{error}</div>
            </div>
          )}

          {/* Success Notification */}
          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="font-medium leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* Form: Sign In Mode */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* User ID Field */}
              <div>
                <label className="block text-[11px] font-mono font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  User ID <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. admin or engineer"
                    className="w-full pl-10 pr-3 py-2.5 bg-black/40 text-white rounded-xl border border-white/[0.08] focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 font-mono text-sm placeholder-slate-500 transition-colors"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-[11px] font-mono font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-10 py-2.5 bg-black/40 text-white rounded-xl border border-white/[0.08] focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 font-mono text-sm placeholder-slate-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-700 bg-black text-cyan-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Remember on this workstation</span>
                </label>
              </div>

              {/* Submit Button (Button-in-Button Architecture) */}
              <button
                type="submit"
                disabled={loading}
                className="btn-machined w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-extrabold text-sm shadow-lg shadow-cyan-500/25 border border-cyan-300/40 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Session...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Workstation</span>
                    <span className="w-5 h-5 rounded-lg bg-slate-950/20 flex items-center justify-center">
                      <ArrowRight className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
                    </span>
                  </>
                )}
              </button>

              {/* Switch to Signup Prompt */}
              <div className="text-center pt-3 text-xs text-slate-400">
                Need a new shopfloor user login?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signup')}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2 cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          )}

          {/* Form: Sign Up Mode */}
          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-3.5">
              
              {/* User ID Field */}
              <div>
                <label className="block text-[11px] font-mono font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  User ID / Login ID <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="e.g. suresh or engineer_2"
                    className="w-full pl-10 pr-3 py-2.5 bg-black/40 text-white rounded-xl border border-white/[0.08] focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 font-mono text-sm placeholder-slate-500 transition-colors"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">Lowercase alphanumeric & underscores</p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-[11px] font-mono font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <BadgeCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Suresh Kumar"
                    className="w-full pl-10 pr-3 py-2.5 bg-black/40 text-white rounded-xl border border-white/[0.08] focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 text-sm placeholder-slate-500 transition-colors"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-[11px] font-mono font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Shopfloor Role <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-[#0a0e19] text-white rounded-xl border border-white/[0.08] focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 text-sm transition-colors cursor-pointer"
                  >
                    <option value="Engineer">Jobwork & Process Engineer</option>
                    <option value="Supervisor">Shopfloor Supervisor</option>
                    <option value="Quality Inspector">Quality Inspector (QC)</option>
                    <option value="Operator">CNC / Machine Operator</option>
                    <option value="Management">Management / COO</option>
                    <option value="Admin">System Administrator</option>
                  </select>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-mono font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 4 characters"
                    className="w-full pl-10 pr-10 py-2.5 bg-black/40 text-white rounded-xl border border-white/[0.08] focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 font-mono text-sm placeholder-slate-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-[11px] font-mono font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Confirm Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type password"
                    className="w-full pl-10 pr-3 py-2.5 bg-black/40 text-white rounded-xl border border-white/[0.08] focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 font-mono text-sm placeholder-slate-500 transition-colors"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="btn-machined w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/25 border border-emerald-400/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Registering Account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 stroke-[2.5]" />
                    <span>Register & Authorize Workstation</span>
                  </>
                )}
              </button>

              {/* Switch to Sign In Prompt */}
              <div className="text-center pt-2 text-xs text-slate-400">
                Already have an authorized User ID?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2 cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* Security watermark */}
          <div className="mt-6 text-center text-[10px] font-mono text-slate-500 flex items-center justify-center gap-1.5 border-t border-white/[0.06] pt-4">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted Session • Precision Shopfloor OS</span>
          </div>

        </div>
      </div>

      {/* Footer Branding */}
      <div className="mt-7 text-center text-xs text-slate-500 font-mono">
        RAJTAMIL Precision Jobwork & Subcontract Engineering OS
      </div>

    </div>
  );
}
