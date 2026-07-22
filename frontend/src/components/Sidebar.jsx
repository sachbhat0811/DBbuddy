import React from 'react';
import { Activity, Database, Zap, ShieldAlert, Network, Lock, DollarSign, LayoutList } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'telemetry', label: 'Live Telemetry', icon: <Activity size={20} /> },
    { id: 'profiler', label: 'Query Profiler', icon: <Zap size={20} /> },
    { id: 'vitals', label: 'Infra Vitals', icon: <Database size={20} /> },
    { id: 'replication', label: 'Replication', icon: <Network size={20} /> },
    { id: 'transactions', label: 'Transactions', icon: <Lock size={20} /> },
    { id: 'dbviewer', label: 'Database Viewer', icon: <LayoutList size={20} /> },
    { id: 'cost', label: 'Cost Realization', icon: <DollarSign size={20} /> },
    { id: 'recovery', label: 'Schema Resilience', icon: <ShieldAlert size={20} /> },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Database color="#6366f1" size={28} />
        <h2>DBbuddy</h2>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map(item => (
          <div 
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
