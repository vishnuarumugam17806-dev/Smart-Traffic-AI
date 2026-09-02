import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { User } from '../types';

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    apiClient.get('/users').then((res) => setUsers(res.data)).catch(console.error);
  }, []);

  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-surfaceBorder pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">USER & ROLE MANAGEMENT</h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Role-Based Access Control and Operator Registry</p>
        </div>
      </div>

      <div className="glass-panel rounded-lg overflow-hidden border border-surfaceBorder bg-white shadow-sm">
        <table className="w-full text-left text-xs font-mono select-none">
          <thead className="bg-slate-50 text-slate-650 uppercase border-b border-surfaceBorder">
            <tr>
              <th className="p-3.5">USER ID</th>
              <th className="p-3.5">USERNAME</th>
              <th className="p-3.5">EMAIL</th>
              <th className="p-3.5">ROLE</th>
              <th className="p-3.5">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-3.5 font-bold text-primary-500">#{u.id}</td>
                <td className="p-3.5 font-bold text-slate-800">{u.username}</td>
                <td className="p-3.5 text-slate-500">{u.email}</td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-primary-50 text-primary-500 border border-primary-500/10">
                    {u.role}
                  </span>
                </td>
                <td className="p-3.5 text-accent-success font-bold">ACTIVE</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
