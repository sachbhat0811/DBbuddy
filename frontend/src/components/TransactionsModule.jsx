import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Lock, Shield } from 'lucide-react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

const TransactionsModule = () => {
  const [activeTrx, setActiveTrx] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [isolationLevel, setIsolationLevel] = useState('');

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_BASE}/transactions/active`);
      setActiveTrx(res.data.data.active || []);
      setConflicts(res.data.data.conflicts || []);
      
      const isoRes = await axios.get(`${API_BASE}/transactions/isolation`);
      setIsolationLevel(isoRes.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    const intv = setInterval(fetchData, 3000);
    return () => clearInterval(intv);
  }, []);

  return (
    <div className="fade-in">
      <h1>Concurrency & Isolation Mechanics</h1>

      <div className="glass-panel" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Shield size={32} color="var(--accent-primary)" />
          <div>
            <h3 style={{ margin: 0 }}>Global Isolation Level</h3>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginTop: 4 }}>{isolationLevel}</div>
          </div>
        </div>
        <p className="text-muted" style={{ lineHeight: 1.6 }}>
          {isolationLevel === 'REPEATABLE-READ' && 'Default InnoDB snapshot isolation. Protects against Dirty Reads and Non-Repeatable Reads, but allows Phantom Reads in some cases. Uses Gap Locks.'}
          {isolationLevel === 'READ-COMMITTED' && 'Protects against Dirty Reads. Non-Repeatable Reads and Phantom Reads can occur. Less lock contention.'}
          {isolationLevel === 'READ-UNCOMMITTED' && 'No protection against Dirty Reads. Fastest performance but highly unsafe for financial transactions.'}
          {isolationLevel === 'SERIALIZABLE' && 'Maximum isolation. Prevents all read anomalies by converting all plain SELECTs to SELECT ... FOR SHARE.'}
        </p>
      </div>

      <div className="glass-panel" style={{ marginBottom: 24, borderColor: conflicts.length > 0 ? 'var(--danger)' : 'var(--border-color)' }}>
        <h2 style={{ color: conflicts.length > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>Critical Lock Conflicts (sys.innodb_lock_waits)</h2>
        <div className="data-table-container" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Victim (Waiting) Thread</th>
                <th>Waiting Query</th>
                <th>Culprit (Blocking) Thread</th>
                <th>Blocking Query</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((c, idx) => (
                <tr key={idx}>
                  <td><span className="badge badge-danger">{c.waiting_thread}</span> (Trx: {c.waiting_trx_id})</td>
                  <td style={{ fontFamily: 'monospace', color: '#fca5a5', fontSize: '0.85rem' }}>{c.waiting_query || 'Unknown'}</td>
                  <td><span className="badge badge-warning">{c.blocking_thread}</span> (Trx: {c.blocking_trx_id})</td>
                  <td style={{ fontFamily: 'monospace', color: '#fcd34d', fontSize: '0.85rem' }}>{c.blocking_query || 'N/A (Idle in Trx)'}</td>
                </tr>
              ))}
              {conflicts.length === 0 && (
                <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No critical lock conflicts detected.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel">
        <h2>Active Transaction Locks (innodb_trx)</h2>
        <div className="data-table-container" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Trx ID</th>
                <th>Thread</th>
                <th>State</th>
                <th>Rows Locked</th>
                <th>Time Elapsed</th>
                <th>Query Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {activeTrx.map((trx, idx) => {
                const started = new Date(trx.trx_started);
                const elapsedSec = Math.floor((new Date() - started) / 1000);
                const isLong = elapsedSec > 10;
                return (
                <tr key={idx}>
                  <td>{trx.trx_id}</td>
                  <td>{trx.trx_mysql_thread_id}</td>
                  <td><span className={`badge ${isLong ? 'badge-danger' : 'badge-warning'}`}>{trx.trx_state}</span></td>
                  <td>{trx.trx_rows_locked}</td>
                  <td style={{ color: isLong ? 'var(--danger)' : 'inherit', fontWeight: isLong ? 'bold' : 'normal' }}>
                    {elapsedSec}s
                  </td>
                  <td style={{ fontFamily: 'monospace', color: '#a5b4fc', fontSize: '0.85rem' }}>{trx.trx_query || 'N/A (Holding Lock)'}</td>
                </tr>
                );
              })}
              {activeTrx.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center' }}>No active transactions found holding locks.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransactionsModule;
