import React, { useState } from 'react';
import axios from 'axios';
import { Database, Shield, Server, Key } from 'lucide-react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

const inputStyle = {
  padding: '10px 12px',
  borderRadius: 6,
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  fontFamily: 'monospace'
};

const labelStyle = {
  display: 'block',
  textAlign: 'left',
  marginBottom: 4,
  fontSize: '0.85rem',
  color: 'var(--text-muted)'
};

const LoginScreen = ({ onLogin }) => {
  const [connectionType, setConnectionType] = useState('public');
  const [formData, setFormData] = useState({
    dbHost: '', dbPort: '3306', dbUser: '', dbPassword: '', dbName: '',
    replicaHost: '',
    sshHost: '', sshPort: '22', sshUser: '', sshKey: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { ...formData, connectionType };
      const res = await axios.post(`${API_BASE}/auth/login`, payload);
      onLogin(res.data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Connection failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="glass-panel" style={{ width: 500, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <button 
            type="button"
            onClick={() => setConnectionType('public')}
            style={{ 
              flex: 1, padding: '16px', background: connectionType === 'public' ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none', color: connectionType === 'public' ? 'white' : 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              borderBottom: connectionType === 'public' ? '2px solid var(--primary)' : '2px solid transparent'
            }}>
            <Database size={18} /> Standard Connection
          </button>
          <button 
            type="button"
            onClick={() => setConnectionType('private')}
            style={{ 
              flex: 1, padding: '16px', background: connectionType === 'private' ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none', color: connectionType === 'private' ? 'white' : 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              borderBottom: connectionType === 'private' ? '2px solid var(--accent-primary)' : '2px solid transparent'
            }}>
            <Shield size={18} /> Over SSH (Bastion)
          </button>
        </div>

        <form onSubmit={handleLogin} style={{ padding: 32 }}>
          {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: 12, borderRadius: 6, marginBottom: 24, border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.9rem' }}>{error}</div>}
          
          {connectionType === 'private' && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: '1rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Server size={16} className="text-muted"/> SSH Bastion Server</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>SSH Host IP</label>
                  <input required name="sshHost" value={formData.sshHost} onChange={handleChange} placeholder="e.g. 54.123.45.67" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Port</label>
                  <input required name="sshPort" value={formData.sshPort} onChange={handleChange} placeholder="22" style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>SSH Username</label>
                <input required name="sshUser" value={formData.sshUser} onChange={handleChange} placeholder="e.g. ec2-user" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>SSH Private Key (PEM format)</label>
                <textarea required name="sshKey" value={formData.sshKey} onChange={handleChange} placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..." style={{ ...inputStyle, height: 100, resize: 'vertical' }} />
              </div>
            </div>
          )}

          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Database size={16} className="text-muted"/> MySQL Database</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>DB Host (Endpoint)</label>
                <input required name="dbHost" value={formData.dbHost} onChange={handleChange} placeholder={connectionType === 'private' ? 'Internal DB IP or RDS Endpoint' : 'Public DB IP or RDS Endpoint'} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Port</label>
                <input required name="dbPort" value={formData.dbPort} onChange={handleChange} placeholder="3306" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Username</label>
                <input required name="dbUser" value={formData.dbUser} onChange={handleChange} placeholder="e.g. root" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input required type="password" name="dbPassword" value={formData.dbPassword} onChange={handleChange} placeholder="********" style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Database Name</label>
              <input required name="dbName" value={formData.dbName} onChange={handleChange} placeholder="e.g. dbbuddy" style={inputStyle} />
            </div>
            
            <div style={{ marginBottom: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <label style={labelStyle}>Replica Endpoint (Optional, for Replication Tab)</label>
              <input name="replicaHost" value={formData.replicaHost} onChange={handleChange} placeholder={connectionType === 'private' ? 'Internal Replica IP or RDS Endpoint' : 'Public Replica IP or RDS Endpoint'} style={inputStyle} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="action-button primary" style={{ width: '100%', padding: '14px', fontSize: '1rem' }}>
            {loading ? 'Establishing Connection...' : 'Connect to Database'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
