import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, FileText, Edit3, Download, LogOut, Check } from 'lucide-react';
import Icon from './Icon';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatRelativeTime } from '../utils/date';
import * as api from '../api';

const DEMO_USERS = [
  { email: 'alice@ajaia.com', name: 'Alice Chen', color: '#6366f1' },
  { email: 'bob@ajaia.com', name: 'Bob Kim', color: '#10b981' },
  { email: 'carol@ajaia.com', name: 'Carol Davis', color: '#f59e0b' },
];

export default function Dashboard({
  documents = [],
  onNewDoc,
  onImportClick,
  onDocDeleted,
  onDocRenamed,
  onShareClick,
}) {
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('all'); // 'my' | 'shared' | 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuDocId, setActiveMenuDocId] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [renamingDocId, setRenamingDocId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const menuRef = useRef(null);
  const userMenuRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuDocId(null);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter documents based on tab and search
  const filteredDocs = documents.filter(doc => {
    const isOwner = doc.role === 'owner' || doc.owner_id === user?.id;
    if (activeTab === 'my' && !isOwner) return false;
    if (activeTab === 'shared' && isOwner) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatches = (doc.title || '').toLowerCase().includes(q);
      const ownerMatches = (doc.ownerName || '').toLowerCase().includes(q);
      return titleMatches || ownerMatches;
    }
    return true;
  });

  function getAccessBadge(doc) {
    const isOwner = doc.role === 'owner' || doc.owner_id === user?.id;
    if (isOwner) {
      return <span className="access-badge badge-owned">Owned</span>;
    }
    const perm = doc.permission || doc.role;
    if (perm === 'edit') {
      return <span className="access-badge badge-shared">Shared · Editor</span>;
    }
    return <span className="access-badge badge-shared">Shared · Viewer</span>;
  }

  function getOwnerDisplay(doc) {
    const isOwner = doc.role === 'owner' || doc.owner_id === user?.id;
    if (isOwner) return 'You';
    if (doc.ownerName) {
      return doc.ownerName.split(' ')[0];
    }
    return 'Team';
  }

  async function handleFastSwitchUser(targetEmail) {
    if (targetEmail === user?.email) {
      setUserMenuOpen(false);
      return;
    }
    try {
      const data = await api.login(targetEmail, 'password123');
      login(data.user, data.token);
      setUserMenuOpen(false);
      toast.success(`Switched account to ${data.user.name}`);
      window.location.reload();
    } catch {
      toast.error('Failed to switch user');
    }
  }

  async function handleSaveRename(docId) {
    if (!renameValue.trim()) {
      setRenamingDocId(null);
      return;
    }
    try {
      await api.updateDocument(docId, { title: renameValue.trim() });
      onDocRenamed?.(docId, renameValue.trim());
      setRenamingDocId(null);
      toast.success('Document renamed');
    } catch {
      toast.error('Failed to rename document');
    }
  }

  async function handleDelete(doc) {
    setActiveMenuDocId(null);
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      await api.deleteDocument(doc.id);
      onDocDeleted?.(doc.id);
      toast.success('Document deleted');
    } catch {
      toast.error('Failed to delete document');
    }
  }

  function handleExport(doc, e) {
    e.stopPropagation();
    setActiveMenuDocId(null);
    try {
      let rawText = '';
      try {
        const parsed = JSON.parse(doc.content);
        if (parsed?.content) {
          rawText = parsed.content
            .map(node => (node.content ? node.content.map(c => c.text).join('') : ''))
            .filter(Boolean)
            .join('\n\n');
        }
      } catch {
        rawText = doc.content || '';
      }
      const blob = new Blob([rawText || doc.title], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title || 'document'}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported "${doc.title}.md"`);
    } catch {
      toast.error('Export failed');
    }
  }

  const userInitial = user?.name ? user.name[0].toUpperCase() : 'A';

  return (
    <div className="dashboard-page">
      {/* Top Navbar */}
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <div className="dashboard-logo">
            <Icon name="new-document" size={20} style={{ marginRight: '8px' }} />
            <span className="logo-text">Papers</span>
          </div>

          <div className="dashboard-header-actions">
            <button
              id="dashboard-import-btn"
              className="btn btn-secondary-mock"
              onClick={onImportClick}
            >
              Import file
            </button>

            <button
              id="dashboard-new-doc-btn"
              className="btn btn-primary-mock"
              onClick={onNewDoc}
            >
              New document
            </button>

            {/* User Avatar Circle */}
            <div className="user-avatar-container" ref={userMenuRef}>
              <button
                className="user-avatar-btn"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                title={`${user?.name} (${user?.email})`}
                aria-label="User profile and switcher"
              >
                {userInitial}
              </button>

              {userMenuOpen && (
                <div className="user-dropdown-menu">
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-name">{user?.name}</div>
                    <div className="user-dropdown-email">{user?.email}</div>
                  </div>

                  <div className="user-dropdown-divider" />

                  <div className="user-dropdown-section-label">SWITCH DEMO ACCOUNT</div>
                  {DEMO_USERS.map(u => (
                    <button
                      key={u.email}
                      className={`user-switch-item ${u.email === user?.email ? 'active' : ''}`}
                      onClick={() => handleFastSwitchUser(u.email)}
                    >
                      <div className="avatar-mini" style={{ background: u.color }}>
                        {u.name[0]}
                      </div>
                      <div className="user-switch-info">
                        <div className="user-switch-name">{u.name}</div>
                        <div className="user-switch-email">{u.email}</div>
                      </div>
                      {u.email === user?.email && <Check size={14} className="check-icon" />}
                    </button>
                  ))}

                  <div className="user-dropdown-divider" />

                  <button className="user-dropdown-logout" onClick={logout}>
                    <LogOut size={14} />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="dashboard-main">
        <div className="dashboard-container">
          <h1 className="dashboard-title">Documents</h1>

          {/* Navigation Tabs & Search Bar */}
          <div className="dashboard-controls-row">
            <div className="dashboard-tabs">
              <button
                className={`dashboard-tab ${activeTab === 'all' || activeTab === 'my' ? 'active' : ''}`}
                onClick={() => setActiveTab('my')}
              >
                My documents
              </button>
              <button
                className={`dashboard-tab ${activeTab === 'shared' ? 'active' : ''}`}
                onClick={() => setActiveTab('shared')}
              >
                Shared with me
              </button>
            </div>

            <div className="dashboard-search-wrapper">
              <input
                id="search-docs-input"
                type="text"
                className="dashboard-search-input"
                placeholder="Search documents"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Documents Table Card */}
          <div className="docs-table-card">
            <table className="docs-table">
              <thead>
                <tr>
                  <th className="th-title">Title</th>
                  <th className="th-access">Access</th>
                  <th className="th-owner">Owner</th>
                  <th className="th-updated">Updated</th>
                  <th className="th-actions"></th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map(doc => {
                  const isOwner = doc.role === 'owner' || doc.owner_id === user?.id;
                  const isRenaming = renamingDocId === doc.id;

                  return (
                    <tr
                      key={doc.id}
                      className="docs-table-row"
                      onClick={() => !isRenaming && navigate(`/doc/${doc.id}`)}
                    >
                      {/* Title */}
                      <td className="td-title">
                        {isRenaming ? (
                          <div
                            className="rename-box"
                            onClick={e => e.stopPropagation()}
                          >
                            <input
                              className="rename-input"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveRename(doc.id);
                                if (e.key === 'Escape') setRenamingDocId(null);
                              }}
                              autoFocus
                            />
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleSaveRename(doc.id)}
                            >
                              Save
                            </button>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => setRenamingDocId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="doc-row-title">{doc.title || 'Untitled Document'}</span>
                        )}
                      </td>

                      {/* Access Badge */}
                      <td className="td-access">
                        {getAccessBadge(doc)}
                      </td>

                      {/* Owner */}
                      <td className="td-owner">
                        <span className="owner-text">{getOwnerDisplay(doc)}</span>
                      </td>

                      {/* Updated Relative Time */}
                      <td className="td-updated">
                        <span className="updated-text">
                          {formatRelativeTime(doc.updatedAt || doc.updated_at || doc.created_at)}
                        </span>
                      </td>

                      {/* Action Menu */}
                      <td className="td-actions" onClick={e => e.stopPropagation()}>
                        <div className="action-menu-relative">
                          <button
                            className="btn-dots"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id);
                            }}
                            title="More options"
                            aria-label="More options"
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          {activeMenuDocId === doc.id && (
                            <div className="row-dropdown-menu" ref={menuRef}>
                              <button
                                className="row-dropdown-item"
                                onClick={() => {
                                  setActiveMenuDocId(null);
                                  navigate(`/doc/${doc.id}`);
                                }}
                              >
                                <FileText size={14} />
                                <span>Open document</span>
                              </button>

                              {isOwner && (
                                <button
                                  className="row-dropdown-item"
                                  onClick={() => {
                                    setActiveMenuDocId(null);
                                    onShareClick?.(doc);
                                  }}
                                >
                                  <Icon name="share" size={14} />
                                  <span>Share…</span>
                                </button>
                              )}

                              {isOwner && (
                                <button
                                  className="row-dropdown-item"
                                  onClick={() => {
                                    setActiveMenuDocId(null);
                                    setRenamingDocId(doc.id);
                                    setRenameValue(doc.title);
                                  }}
                                >
                                  <Edit3 size={14} />
                                  <span>Rename</span>
                                </button>
                              )}

                              <button
                                className="row-dropdown-item"
                                onClick={(e) => handleExport(doc, e)}
                              >
                                <Download size={14} />
                                <span>Download (.md)</span>
                              </button>

                              {isOwner && (
                                <>
                                  <div className="row-dropdown-divider" />
                                  <button
                                    className="row-dropdown-item text-danger"
                                    onClick={() => handleDelete(doc)}
                                  >
                                    <Icon name="delete" size={14} />
                                    <span>Delete</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-table-cell">
                      <div className="empty-table-content">
                        <FileText size={32} className="empty-icon" />
                        <div className="empty-title">
                          {searchQuery ? 'No documents match your search' : 'No documents found'}
                        </div>
                        <div className="empty-subtitle">
                          {searchQuery
                            ? 'Try searching with a different keyword.'
                            : 'Create a new document or import a file to get started.'}
                        </div>
                        {!searchQuery && (
                          <div className="empty-actions">
                            <button className="btn btn-primary-mock" onClick={onNewDoc}>
                              New document
                            </button>
                            <button className="btn btn-secondary-mock" onClick={onImportClick}>
                              Import file
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Subtitle Note */}
          <p className="dashboard-footer-note">
            Import supports .txt, .md and .docx files up to 2 MB.
          </p>
        </div>
      </main>
    </div>
  );
}
