import { FileText, LogOut } from 'lucide-react';
import Icon from './Icon';
import { useAuth } from '../contexts/AuthContext';

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function Sidebar({
  documents,
  activeDocId,
  onSelectDoc,
  onNewDoc,
  onUpload,
}) {
  const { user, logout } = useAuth();

  const owned = documents.filter(d => d.role === 'owner');
  const shared = documents.filter(d => d.role !== 'owner');

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Icon name="new-document" size={24} />
        </div>
        <span className="sidebar-logo-text">Papers</span>
      </div>

      {/* Actions */}
      <div className="sidebar-actions">
        <button id="new-doc-btn" className="btn-new-doc" onClick={onNewDoc}>
          <Icon name="new-document" size={15} />
          New Document
        </button>
        <button id="upload-btn" className="btn-upload" onClick={onUpload}>
          <Icon name="upload" size={14} />
          Import File
        </button>
      </div>

      {/* Document list */}
      <div className="sidebar-scroll-container">
        {owned.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-label">My Documents</div>
            <ul className="sidebar-list" style={{ overflow: 'visible' }}>
              {owned.map(doc => (
                <li
                  key={doc.id}
                  className={`sidebar-doc-item ${activeDocId === doc.id ? 'active' : ''}`}
                  onClick={() => onSelectDoc(doc.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && onSelectDoc(doc.id)}
                >
                  <FileText size={14} style={{ flexShrink: 0 }} />
                  <span className="sidebar-doc-item-name">{doc.title || 'Untitled'}</span>
                  <span className="sidebar-doc-badge badge-owner">mine</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {shared.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-label">Shared with Me</div>
            <ul className="sidebar-list" style={{ overflow: 'visible' }}>
              {shared.map(doc => (
                <li
                  key={doc.id}
                  className={`sidebar-doc-item ${activeDocId === doc.id ? 'active' : ''}`}
                  onClick={() => onSelectDoc(doc.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && onSelectDoc(doc.id)}
                >
                  <FileText size={14} style={{ flexShrink: 0 }} />
                  <span className="sidebar-doc-item-name">{doc.title || 'Untitled'}</span>
                  <span className="sidebar-doc-badge badge-shared">{doc.role}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {documents.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: 12, lineHeight: 1.7 }}>
            No documents yet.
            <br />
            Click <strong style={{ color: 'var(--color-text-2)' }}>New Document</strong> to get started.
          </div>
        )}
      </div>

      {/* User footer */}
      <div className="sidebar-user">
        <div
          className="avatar"
          style={{ background: user?.avatarColor || '#6366f1' }}
          title={user?.name}
        >
          {getInitials(user?.name)}
        </div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.name}</div>
          <div className="sidebar-user-email">{user?.email}</div>
        </div>
        <button className="btn-logout" onClick={logout} title="Sign out">
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
