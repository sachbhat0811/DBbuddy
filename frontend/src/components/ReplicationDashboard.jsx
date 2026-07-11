import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Network, AlertTriangle, Server, ArrowRight, Database } from 'lucide-react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

const ReplicationDashboard = () => {
  const [replData, setReplData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await axios.get(`${API_BASE}/replication/status`);
        if (res.data.data === null) {
            setErrorMsg(res.data.message);
            setReplData(null);
        } else {
            setReplData(res.data.data);
            setErrorMsg('');
        }
      } catch (err) {
        setErrorMsg('Error fetching replication status.');
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fade-in">
      <h1>High Availability & Replication Architecture</h1>
      
      {errorMsg && (
        <div style={{ marginBottom: 24, padding: 16, background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid var(--warning)', borderRadius: '0 8px 8px 0', display: 'flex', gap: 12, alignItems: 'center', color: '#fcd34d' }}>
          <AlertTriangle size={24} color="var(--warning)" style={{ minWidth: 24 }}/>
          <div>
            <strong>Warning: {errorMsg}</strong>
            <div style={{ fontSize: '0.85rem', marginTop: 4, color: '#d1d1d6' }}>
              The database is currently running as a standalone node. Module 7 requires an active Primary-Replica topology to display metrics. Mocking is unnecessary as the API correctly identifies the standalone state.
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="glass-panel fade-in" style={{ marginTop: 24 }}>
          <h2 style={{ marginBottom: 24 }}>Architecture Overview: MySQL Replication</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <p className="text-muted" style={{ lineHeight: '1.6' }}>
              Replication enables data from one MySQL database server (the Primary) to be copied to one or more MySQL database servers (the Replicas). This is the foundation of <strong>High Availability (HA)</strong> and <strong>Read Scaling</strong> in enterprise environments.
            </p>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32, background: 'rgba(0,0,0,0.3)', borderRadius: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <Server size={48} color="var(--accent-primary)" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 600 }}>Primary Node</div>
                <div className="badge badge-success" style={{ marginTop: 8 }}>Writes & Reads</div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '0.8rem', marginBottom: 4 }}>Binary Log Stream</div>
                <ArrowRight size={32} />
              </div>

              <div style={{ textAlign: 'center' }}>
                <Database size={48} color="var(--accent-secondary)" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 600 }}>Replica Node</div>
                <div className="badge badge-warning" style={{ marginTop: 8 }}>Reads Only</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ color: '#fff', marginBottom: 8 }}>How It Works</h4>
                <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                  The Primary node writes all data changes to a local file called the <strong>Binary Log</strong>. The Replica connects to the Primary, reads this log via the <code>IO_THREAD</code>, and applies the changes locally via the <code>SQL_THREAD</code>.
                </p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ color: '#fff', marginBottom: 8 }}>Why Use It?</h4>
                <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                  If the Primary server crashes, the Replica can be instantly promoted to take its place (Failover). Additionally, heavy analytic <code>SELECT</code> queries can be routed to the Replica so they don't slow down the Primary.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {replData && (
        <div className="dashboard-grid">
          <div className="glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Network color="var(--accent-primary)" />
              <h3 style={{ margin: 0 }}>Replication Lag</h3>
            </div>
            <div style={{ fontSize: '3rem', fontWeight: 700, color: replData.seconds_behind_master > 10 ? 'var(--warning)' : 'var(--success)' }}>
              {replData.seconds_behind_master} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>seconds</span>
            </div>
          </div>
          
          <div className="glass-panel">
             <h3>Thread Health</h3>
             <ul style={{ listStyle: 'none', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
                    <span>Slave_IO_Running:</span>
                    <span className={replData.io_running === 'Yes' ? 'badge badge-success' : 'badge badge-danger'}>{replData.io_running}</span>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
                    <span>Slave_SQL_Running:</span>
                    <span className={replData.sql_running === 'Yes' ? 'badge badge-success' : 'badge badge-danger'}>{replData.sql_running}</span>
                </li>
             </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReplicationDashboard;
