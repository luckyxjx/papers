import { useState, useEffect } from 'react';
import { X, UserPlus, Trash2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../api';

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function ShareModal({ document, onClose, onSharesUpdated }) {
  const { user } = useAuth();
  const toast = useToast();

  const [allUsers, setAllUsers] = useState([]);
  const [shares, setShares] = useState(document.shares || []);
  const [selectedUser, setSelectedUser] = useState('');
  const [permission, setPermission] = useState('view');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getUsers().then(users => {
      // Filter out current user and already-shared users
      setAllUsers(users.filter(u => u.id !== user.id));
    });
  }, [user.id]);

  const availableUsers = allUsers.filter(u => !shares.find(s => s.userId === u.id));

  async function handleShare() {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const newShare = await api.shareDocument(document.id, selectedUser, permission);
      const updatedShares = [...shares.filter(s => s.userId !== selectedUser), newShare];
      setShares(updatedShares);
      setSelectedUser('');
      onSharesUpdated?.(updatedShares);
      toast.success(`Document shared successfully!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to share document');
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(userId, userName) {
    try {
      await api.revokeShare(document.id, userId);
      const updatedShares = shares.filter(s => s.userId !== userId);
      setShares(updatedShares);
      onSharesUpdated?.(updatedShares);
      toast.success(`Access revoked for ${userName}`);
    } catch (err) {
      toast.error('Failed to revoke access');
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Share "{document.title}"</span>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {/* Owner info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div className="avatar" style={{ background: document.ownerAvatarColor || '#6366f1' }}>
              {getInitials(document.ownerName || user.name)}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{document.ownerName || user.name} (you)</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>Owner</div>
            </div>
          </div>

          {/* Add collaborator */}
          {availableUsers.length > 0 && (
            <div className="form-group">
              <label className="form-label">Add People</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  id="share-user-select"
                  className="form-select"
                  value={selectedUser}
                  onChange={e => setSelectedUser(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">Choose a teammate…</option>
                  {availableUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
                <select
                  id="share-permission-select"
                  className="form-select"
                  value={permission}
                  onChange={e => setPermission(e.target.value)}
                  style={{ width: 90 }}
                >
                  <option value="view">View</option>
                  <option value="edit">Edit</option>
                </select>
                <button
                  id="share-add-btn"
                  className="btn btn-primary btn-sm"
                  onClick={handleShare}
                  disabled={!selectedUser || loading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {loading ? <span className="spinner" /> : <UserPlus size={14} />}
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Current shares */}
          {shares.length > 0 && (
            <div className="form-group">
              <label className="form-label">People with access</label>
              <div className="share-user-list">
                {shares.map(s => (
                  <div key={s.userId} className="share-user-item">
                    <div className="avatar" style={{ background: s.avatarColor || '#6366f1', width: 30, height: 30, fontSize: 12 }}>
                      {getInitials(s.name)}
                    </div>
                    <div className="share-user-info">
                      <div className="share-user-name">{s.name}</div>
                      <div className="share-user-email">{s.email}</div>
                    </div>
                    <span className={`share-permission-badge ${s.permission === 'edit' ? 'perm-edit' : 'perm-view'}`}>
                      {s.permission}
                    </span>
                    <button
                      className="btn-icon"
                      onClick={() => handleRevoke(s.userId, s.name)}
                      title="Revoke access"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {shares.length === 0 && availableUsers.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--color-text-3)', fontSize: 13, padding: '12px 0' }}>
              All teammates already have access.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
