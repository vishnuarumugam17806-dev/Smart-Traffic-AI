import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User as UserIcon, Shield, Phone, MapPin, BadgeCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../api/client';
import { useStore } from '../store/useStore';

export const Login: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'admin' | 'police_login' | 'police_register'>('admin');
  
  // Admin Login state
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('admin123');

  // Police Login state
  const [policeIdentifier, setPoliceIdentifier] = useState('POLICE-7782');
  const [policePassword, setPolicePassword] = useState('police123');

  // Police Register state
  const [regFullName, setRegFullName] = useState('');
  const [regArea, setRegArea] = useState('');
  const [regPoliceId, setRegPoliceId] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSuccess, setRegSuccess] = useState<string>('');

  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { setUser } = useStore();
  const navigate = useNavigate();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRegSuccess('');
    setLoading(true);

    try {
      const res = await apiClient.post('/auth/login', {
        username: adminUsername,
        password: adminPassword,
      });

      if (res.data.access_token) {
        setUser(res.data.user, res.data.access_token);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid admin credentials');
    } finally {
      setLoading(false);
    }
  };

  const handlePoliceLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRegSuccess('');
    setLoading(true);

    try {
      const res = await apiClient.post('/auth/login', {
        police_id: policeIdentifier,
        password: policePassword,
      });

      if (res.data.access_token) {
        setUser(res.data.user, res.data.access_token);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid police credentials or account pending approval');
    } finally {
      setLoading(false);
    }
  };

  const handlePoliceRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRegSuccess('');
    setLoading(true);

    try {
      const res = await apiClient.post('/auth/register', {
        full_name: regFullName,
        area_jurisdiction: regArea,
        police_id: regPoliceId,
        mobile_number: regMobile,
        password: regPassword,
      });

      setRegSuccess(`Registration successful for Officer ${res.data.full_name || regPoliceId}. You can now sign in!`);
      setActiveTab('police_login');
      setPoliceIdentifier(regPoliceId);
      setPolicePassword(regPassword);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Check if Police ID or Mobile is already registered.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-2xl relative overflow-hidden text-slate-100">
        
        {/* Brand Logo & Confidential Banner */}
        <div className="text-center mb-6 relative z-10">
          <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shadow-inner">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-wider text-white">SMART TRAFFIC AI</h2>
          <p className="text-xs text-blue-400 font-mono mt-1 uppercase tracking-widest">Confidential Police & Admin Command Portal</p>
        </div>

        {/* Tab Selection Navigation */}
        <div className="grid grid-cols-3 gap-1 bg-slate-900/60 p-1 rounded-lg mb-6 border border-slate-700/60 text-xs font-medium">
          <button
            type="button"
            onClick={() => { setActiveTab('admin'); setError(''); setRegSuccess(''); }}
            className={`py-2 rounded-md transition-all ${activeTab === 'admin' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Admin Sign In
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('police_login'); setError(''); setRegSuccess(''); }}
            className={`py-2 rounded-md transition-all ${activeTab === 'police_login' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Police Sign In
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('police_register'); setError(''); setRegSuccess(''); }}
            className={`py-2 rounded-md transition-all ${activeTab === 'police_register' ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Officer Register
          </button>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {regSuccess && (
          <div className="mb-5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{regSuccess}</span>
          </div>
        )}

        {/* Tab 1: Admin Sign In */}
        {activeTab === 'admin' && (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono font-bold text-slate-300 mb-1 uppercase">Admin Username</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter admin username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-slate-300 mb-1 uppercase">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors shadow-md disabled:opacity-50 mt-2"
            >
              {loading ? 'Authenticating...' : 'Sign In as System Admin'}
            </button>
          </form>
        )}

        {/* Tab 2: Police Officer Login */}
        {activeTab === 'police_login' && (
          <form onSubmit={handlePoliceLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono font-bold text-slate-300 mb-1 uppercase">Police ID / Mobile No / Badge</label>
              <div className="relative">
                <BadgeCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={policeIdentifier}
                  onChange={(e) => setPoliceIdentifier(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. POLICE-7782 or 9876543210"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-slate-300 mb-1 uppercase">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={policePassword}
                  onChange={(e) => setPolicePassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter police account password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors shadow-md disabled:opacity-50 mt-2"
            >
              {loading ? 'Verifying Credentials...' : 'Sign In as Officer'}
            </button>
          </form>
        )}

        {/* Tab 3: Police Officer Confidential Registration */}
        {activeTab === 'police_register' && (
          <form onSubmit={handlePoliceRegister} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-mono font-bold text-slate-300 mb-1 uppercase">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  placeholder="Officer Full Name"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold text-slate-300 mb-1 uppercase">Assigned Area / Station</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={regArea}
                  onChange={(e) => setRegArea(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Central Traffic Division"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-mono font-bold text-slate-300 mb-1 uppercase">Police ID / Badge</label>
                <div className="relative">
                  <BadgeCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={regPoliceId}
                    onChange={(e) => setRegPoliceId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    placeholder="POLICE-XXXX"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold text-slate-300 mb-1 uppercase">Mobile Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={regMobile}
                    onChange={(e) => setRegMobile(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    placeholder="10-digit mobile"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold text-slate-300 mb-1 uppercase">Confidential Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  placeholder="Create secure password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors shadow-md disabled:opacity-50 mt-3"
            >
              {loading ? 'Submitting Registration...' : 'Register Police Account'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-[10px] text-slate-400 font-mono border-t border-slate-700/60 pt-4">
          Default Admin: <span className="text-blue-400 font-bold">admin / admin123</span>
        </div>
      </div>
    </div>
  );
};
