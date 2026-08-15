import React, { useState, useEffect, useCallback } from 'react';
import styles from './SnapshotBrowser.module.css';

// Types
interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  permissions?: string;
}

interface SnapshotBrowserProps {
  config: string;
  snapshotId: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

const SnapshotBrowser: React.FC<SnapshotBrowserProps> = ({ config, snapshotId }) => {
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [path, setPath] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);

  // Load directory contents
  const loadDirectory = useCallback(async (dirPath: string = '') => {
    if (!config || !snapshotId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const url = `/api/snapshots/${config}/${snapshotId}/browse${dirPath ? `?path=${encodeURIComponent(dirPath)}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to load directory: ${response.statusText}`);
      }
      
      const data = await response.json();
      setItems(data.items || []);
      setPath(data.currentPath || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error loading directory:', err);
    } finally {
      setLoading(false);
    }
  }, [config, snapshotId]);

  // Load initial directory when config/snapshot changes
  useEffect(() => {
    if (config && snapshotId) {
      loadDirectory('');
    }
  }, [config, snapshotId, loadDirectory]);

  // Handle item click (navigate into directories)
  const handleItemClick = (item: FileItem) => {
    if (item.type === 'directory') {
      const newPath = path ? `${path}/${item.name}` : item.name;
      loadDirectory(newPath);
      setSelectedItem(null);
    } else {
      // For files, show details or preview
      setSelectedItem(item);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (path) {
      const parentPath = path.split('/').slice(0, -1).join('/');
      loadDirectory(parentPath);
    }
  };

  // Format file size
  const formatSize = (bytes?: number): string => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  // Format date
  const formatDate = (date?: string): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  if (loading) {
    return (
      <div className={styles['snapshot-browser-loading']}>
        <div className={styles.spinner}></div>
        <p>Loading directory contents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles['snapshot-browser-error']}>
        <p>Error: {error}</p>
        <button onClick={() => loadDirectory('')}>Retry</button>
      </div>
    );
  }

  return (
    <div className={styles['snapshot-browser']}>
      <div className={styles['browser-header']}>
        <h3>Snapshot: {snapshotId}</h3>
        <div className={styles.breadcrumb}>
          <button onClick={handleBack} disabled={!path} className={styles['back-button']}>
            ← Back
          </button>
          <span className={styles['path-display']}>/ {path || 'root'}</span>
        </div>
      </div>

      <div className={styles['browser-content']}>
        {items.length === 0 ? (
          <p className={styles['empty-message']}>This directory is empty</p>
        ) : (
          <ul className={styles['file-list']}>
            {items.map((item, index) => (
              <li 
                key={index} 
                className={`${styles['file-item']} ${styles[item.type]}`}
                onClick={() => handleItemClick(item)}
                onDoubleClick={() => {
                  if (item.type === 'directory') {
                    const newPath = path ? `${path}/${item.name}` : item.name;
                    loadDirectory(newPath);
                  }
                }}
              >
                <span className={styles['file-icon']}>
                  {item.type === 'directory' ? '📁' : '📄'}
                </span>
                <span className={styles['file-name']}>{item.name}</span>
                <span className={styles['file-size']}>{formatSize(item.size)}</span>
                <span className={styles['file-date']}>{formatDate(item.modified)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedItem && (
        <div className={styles['file-details-modal']}>
          <div className={styles['modal-content']}>
            <h3>File Details</h3>
            <p><strong>Name:</strong> {selectedItem.name}</p>
            <p><strong>Type:</strong> {selectedItem.type}</p>
            <p><strong>Size:</strong> {formatSize(selectedItem.size)}</p>
            <p><strong>Modified:</strong> {formatDate(selectedItem.modified)}</p>
            {selectedItem.permissions && (
              <p><strong>Permissions:</strong> {selectedItem.permissions}</p>
            )}
            <button onClick={() => setSelectedItem(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SnapshotBrowser;
