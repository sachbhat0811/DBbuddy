import React, { useState } from 'react';
import axios from 'axios';
import { Lock } from 'lucide-react';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

const LoginScreen = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { password });
      onLogin(res.data.token);
    } catch (err) {
      setError('Invalid password');
    }
  };

  return (
    <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="glass-panel" style={{ width: 400, padding: 32, textAlign: 'center' }}>
        <Lock size={48} className="text-primary" style={{ marginBottom: 16, margin: '0 auto' }} />
        <h2 style={{ marginBottom: 8 }}>Secure Access</h2>
        <p className="text-muted" style={{ marginBottom: 24 }}>Please authenticate to access telemetry.</p>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input 
            type="password" 
            placeholder="Dashboard Password" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ 
              padding: 12, 
              borderRadius: 6, 
              background: 'rgba(0,0,0,0.5)', 
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: 16
            }}
          />
          {error && <p style={{ color: '#ef4444', margin: 0 }}>{error}</p>}
          <button type="submit" className="action-button primary">Unlock Dashboard</button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
