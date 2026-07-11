import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import TelemetryModule from './components/TelemetryModule';
import QueryProfiler from './components/QueryProfiler';
import VitalsAnalytics from './components/VitalsAnalytics';
import SchemaResilience from './components/SchemaResilience';
import ReplicationDashboard from './components/ReplicationDashboard';
import TransactionsModule from './components/TransactionsModule';
import CostRealization from './components/CostRealization';
import DatabaseViewer from './components/DatabaseViewer';
import LandingPage from './components/LandingPage';
import LoginScreen from './components/LoginScreen';
import axios from 'axios';

function App() {
  const [isLaunched, setIsLaunched] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('telemetry');

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setIsAuthenticated(true);
    }
  }, []);

  if (!isLaunched) {
    return <LandingPage onLaunch={() => setIsLaunched(true)} />;
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={(token) => {
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setIsAuthenticated(true);
    }} />;
  }

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        {activeTab === 'telemetry' && <TelemetryModule />}
        {activeTab === 'profiler' && <QueryProfiler />}
        {activeTab === 'vitals' && <VitalsAnalytics />}
        {activeTab === 'replication' && <ReplicationDashboard />}
        {activeTab === 'transactions' && <TransactionsModule />}
        {activeTab === 'dbviewer' && <DatabaseViewer />}
        {activeTab === 'cost' && <CostRealization />}
        {activeTab === 'recovery' && <SchemaResilience />}
      </main>
    </div>
  );
}

export default App;
