import React, { useState } from 'react';
import axios from 'axios';
import { Download, CheckCircle, TrendingDown, Server } from 'lucide-react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

const SchemaResilience = () => {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [result, setResult] = useState(null);
  
  const [structureOnly, setStructureOnly] = useState(false);
  const [singleTransaction, setSingleTransaction] = useState(true);
  const [compress, setCompress] = useState(false);
  const [history, setHistory] = useState([]);

  const fetchHistory = () => {
    axios.get(`${API_BASE}/automation/history`).then(res => setHistory(res.data.data)).catch(console.error);
  };

  const handleDownload = async (filename) => {
    try {
      const res = await axios.get(`${API_BASE}/automation/download/${filename}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      alert("Failed to download file: " + err.message);
    }
  };

  React.useEffect(() => {
    fetchHistory();
  }, []);

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await axios.post(`${API_BASE}/automation/backup`, {
          structureOnly, singleTransaction, compress
      });
      setResult(res.data);
      fetchHistory();
    } catch (err) {
      alert('Backup failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="fade-in">
      <h1>Schema Resilience</h1>

      <div className="dashboard-grid">
        <div className="glass-panel">
          <h2>Logical Recovery Portal</h2>
          <p className="text-muted" style={{ marginBottom: 24, lineHeight: '1.6' }}>
            Trigger a native <code>mysqldump</code> logical backup directly onto the EC2 volume. Generates flat <code>.sql</code> files enabling seamless drop-recovery capabilities across environments.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24, background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={singleTransaction} onChange={e => setSingleTransaction(e.target.checked)} />
              <span>Use Non-Locking Snapshot (<code>--single-transaction</code>)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={structureOnly} onChange={e => setStructureOnly(e.target.checked)} />
              <span>Structure Only (<code>--no-data</code>)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={compress} onChange={e => setCompress(e.target.checked)} />
              <span>GZIP Compression (Requires gzip in OS path)</span>
            </label>
          </div>

          {result && result.status === 'success' && (
            <div className="glass-panel" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <CheckCircle className="text-success" />
                <h3 className="text-success" style={{ margin: 0 }}>Backup Generated Successfully</h3>
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>
                <p style={{ margin: '4px 0' }}><strong>File:</strong> {result.data.filename}</p>
                <p style={{ margin: '4px 0' }}><strong>Size:</strong> {(result.data.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); handleDownload(result.data.filename); }}
                className="action-button primary" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', cursor: 'pointer' }}
              >
                <Download size={16} />
                Download {result.data.filename.endsWith('.gz') ? 'Archive' : 'SQL File'}
              </a>
            </div>
          )}

          <button 
            className="btn-primary" 
            onClick={handleBackup} 
            disabled={isBackingUp}
          >
            <Download size={18} /> {isBackingUp ? 'Generating Backup...' : 'Trigger Logical Backup'}
          </button>
        </div>

        <div className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Server size={24} color="var(--accent-secondary)" />
            <h2 style={{ margin: 0 }}>Backup History Archive</h2>
          </div>
          <p className="text-muted" style={{ marginBottom: 16, lineHeight: '1.6' }}>
            Historical logical backups available on the server volume.
          </p>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Created At</th>
                  <th>Size</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'monospace', color: '#a5b4fc', fontSize: '0.85rem' }}>{h.filename}</td>
                    <td>{new Date(h.created).toLocaleString()}</td>
                    <td>{(h.size / 1024 / 1024).toFixed(2)} MB</td>
                    <td>
                      <a 
                        href="#"
                        onClick={(e) => { e.preventDefault(); handleDownload(h.filename); }}
                        style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                      >
                        <Download size={14} /> Download
                      </a>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td colSpan="4" style={{ textAlign: 'center' }}>No historical backups found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchemaResilience;
