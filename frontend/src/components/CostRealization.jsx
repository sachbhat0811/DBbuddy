import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { DollarSign, AlertTriangle, TrendingDown, TrendingUp, Info, Server } from 'lucide-react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

const CostRealization = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE}/cost/insights`)
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.data?.message || err.message));
  }, []);

  if (error) {
    return (
      <div className="fade-in" style={{ padding: 24, color: 'var(--danger)', border: '1px dashed var(--danger)', borderRadius: 8 }}>
        <h2>AWS Cost Explorer Error</h2>
        <p>{error}</p>
        <p>Make sure AWS credentials and DB_INSTANCE_IDENTIFIER are set in the backend .env file.</p>
      </div>
    );
  }

  if (!data) return <div className="fade-in">Fetching structural cost insights from AWS...</div>;

  return (
    <div className="fade-in">
      <h1>AWS Structural Cost & Optimization</h1>

      <div className="glass-panel" style={{ marginBottom: 24, background: 'rgba(59, 130, 246, 0.1)', borderColor: 'var(--accent-primary)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Info color="var(--accent-primary)" size={24} />
          <p style={{ margin: 0, lineHeight: 1.5, color: '#e0e7ff' }}>
            This module fetches live AWS structural data via the RDS API. It calculates your exact estimated monthly run rate based on instance class and storage, and provides concrete scaling recommendations.
          </p>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        <div className="glass-panel" style={{ borderColor: 'var(--success)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <DollarSign color="var(--success)" />
            <h3 style={{ margin: 0 }}>Monthly Run Rate (Estimated)</h3>
          </div>
          <div style={{ fontSize: '3.5rem', fontWeight: 700, color: 'var(--success)' }}>
            ${data.costs.total.toFixed(2)}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }} className="text-muted">
            <span>Compute: ${data.costs.compute.toFixed(2)}</span>
            <span>Storage: ${data.costs.storage.toFixed(2)}</span>
          </div>
        </div>
        
        <div className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Server color="var(--accent-primary)" />
            <h3 style={{ margin: 0 }}>Current Infrastructure</h3>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
            {data.instanceInfo.class}
          </div>
          <div style={{ marginTop: 8, lineHeight: 1.6 }} className="text-muted">
            <p style={{ margin: 0 }}>Engine: {data.instanceInfo.engine}</p>
            <p style={{ margin: 0 }}>Storage: {data.instanceInfo.storage}</p>
            <p style={{ margin: 0 }}>Multi-AZ: {data.instanceInfo.multiAZ ? 'Enabled' : 'Disabled'}</p>
          </div>
        </div>
      </div>

      <div className="glass-panel">
        <h2>Rightsizing & Structural Recommendations</h2>
        <div className="data-table-container" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Target Class</th>
                <th>Cost Impact</th>
                <th>Insight / Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {data.recommendations.map((rec, idx) => {
                const isSaving = rec.impact.startsWith('-');
                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{rec.action}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{rec.targetClass}</td>
                    <td>
                      <span className={`badge ${isSaving ? 'badge-success' : 'badge-warning'}`}>
                        {rec.impact}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        {isSaving ? <TrendingDown size={16} color="var(--success)" style={{ marginTop: 4, flexShrink: 0 }} /> : <TrendingUp size={16} color="var(--warning)" style={{ marginTop: 4, flexShrink: 0 }} />}
                        <span style={{ lineHeight: 1.5 }}>{rec.description}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.recommendations.length === 0 && (
                <tr><td colSpan="4" style={{ textAlign: 'center' }}>No recommendations available at this time.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CostRealization;
