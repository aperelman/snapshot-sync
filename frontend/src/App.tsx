import React, { useState, useEffect, useCallback } from 'react';
import SnapshotBrowser from './SnapshotBrowser';
import styles from './App.module.css';

// Types
interface Snapshot {
  id: string;
  date: string;
  description?: string;
  sizeBytes?: number;
  fileCount?: number;
}

interface Configs {
  [key: string]: Snapshot[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001"\;

const App: React.FC = () => {
  const [configs, setConfigs] = useState<Configs>({});
  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [showBrowser, setShowBrowser] = useState<boolean>(false);

  // Load snapshots
  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/snapshots`);
      if (!response.ok) throw new Error('Failed to load snapshots');
      const data = await response.json();
      setConfigs(data.configs || {});
      
      // Auto-select first config if available
      const configKeys = Object.keys(data.configs || {});
      if (configKeys.length > 0 && !selectedConfig) {
        setSelectedConfig(configKeys[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error loading snapshots:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedConfig]);

  // Load snapshots for selected config
  useEffect(() => {
    if (selectedConfig && configs[selectedConfig]) {
      setSnapshots(configs[selectedConfig] || []);
    } else {
      setSnapshots([]);
    }
  }, [selectedConfig, configs]);

  // Initial load
  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  // Handle config change
  const handleConfigChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedConfig(e.target.value);
    setSelectedSnapshot(null);
    setShowBrowser(false);
  };

  // Handle snapshot double-click
  const handleSnapshotDoubleClick = (snapshot: Snapshot) => {
    setSelectedSnapshot(snapshot);
    setShowBrowser(true);
  };

  // Handle back from browser
  const handleBrowserClose = () => {
    setShowBrowser(false);
    setSelectedSnapshot(null);
  };

  // Format date for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className={styles['app-loading']}>
        <div className={styles.spinner}></div>
        <p>Loading snapshots...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles['app-error']}>
        <p>Error: {error}</p>
        <button onClick={loadSnapshots}>Retry</button>
      </div>
    );
  }

  const configKeys = Object.keys(configs);

  return (
    <div className={styles.app}>
      <header className={styles['app-header']}>
        <h1>📸 Snapshot Sync UI</h1>
        <p>Browse and manage your snapshots</p>
      </header>

      <main className={styles['app-main']}>
        <div className={styles.controls}>
          <label htmlFor="config-select">Select Config:</label>
          <select 
            id="config-select"
            value={selectedConfig}
            onChange={handleConfigChange}
            disabled={configKeys.length === 0}
          >
            {configKeys.length === 0 ? (
              <option value="">No configs available</option>
            ) : (
              configKeys.map(key => (
                <option key={key} value={key}>{key}</option>
              ))
            )}
          </select>
          <span className={styles['snapshot-count']}>
            {snapshots.length} snapshots
          </span>
        </div>

        {showBrowser && selectedSnapshot ? (
          <div className={styles['browser-container']}>
            <div className={styles['browser-header']}>
              <button onClick={handleBrowserClose} className={styles['close-browser']}>
                ← Back to snapshots
              </button>
              <h2>
                Browsing: {selectedConfig} / {selectedSnapshot.id}
              </h2>
            </div>
            <SnapshotBrowser 
              config={selectedConfig} 
              snapshotId={selectedSnapshot.id}
            />
          </div>
        ) : (
          <div className={styles['snapshots-list']}>
            {snapshots.length === 0 ? (
              <p className={styles['empty-message']}>No snapshots found for this config</p>
            ) : (
              <table className={styles['snapshots-table']}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Size</th>
                    <th>Files</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snapshot) => (
                    <tr 
                      key={snapshot.id}
                      onDoubleClick={() => handleSnapshotDoubleClick(snapshot)}
                      className={styles['snapshot-row']}
                    >
                      <td className={styles['snapshot-id']}>{snapshot.id}</td>
                      <td>{formatDate(snapshot.date)}</td>
                      <td>{snapshot.description || 'N/A'}</td>
                      <td>
                        {snapshot.sizeBytes 
                          ? (snapshot.sizeBytes / (1024**3)).toFixed(2) + ' GB'
                          : 'N/A'
                        }
                      </td>
                      <td>{snapshot.fileCount || 'N/A'}</td>
                      <td>
                        <button 
                          onClick={() => handleSnapshotDoubleClick(snapshot)}
                          className={styles['browse-button']}
                        >
                          Browse 📂
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className={styles.hint}>
              💡 Double-click on a snapshot or click "Browse" to explore its contents
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
