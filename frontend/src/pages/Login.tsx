import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrafficCone, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import { apiClient } from '../api/client';
import { useStore } from '../store/useStore';

export const Login: React.FC = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { setUser } = useStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const res = await apiClient.post('/auth/login', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.access_token) {
        setUser(res.data.user, res.data.access_token);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid username or password credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm bg-white p-8 rounded-lg border border-surfaceBorder shadow-md relative overflow-hidden">
        
        {/* Brand Logo & Heading */}
        <div className="text-center mb-8 relative z-10">
          <img src="/vigitra_logo.jpg" alt="VIGITRA Logo" className="w-12 h-12 mx-auto mb-4 rounded-lg object-cover shadow-sm" />
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">VIGITRA</h2>
          <p className="text-xs text-slate-500 font-mono mt-1">Operator Control Center Portal</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded bg-accent-danger/10 border border-accent-danger/25 text-accent-danger text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5 relative z-10">
          <div>
            <label className="block text-xs font-mono font-bold text-slate-650 mb-1.5 uppercase">Operator Username</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50 border border-surfaceBorder rounded-lg pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none"
                placeholder="Enter username"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-slate-650 mb-1.5 uppercase">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-surfaceBorder rounded-lg pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none"
                placeholder="Enter password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? 'Authenticating Session...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-[10px] text-slate-500 font-mono">
          Default Credentials: <span className="text-slate-700 font-bold">admin / admin123</span>
        </div>
      </div>
    </div>
  );
};
