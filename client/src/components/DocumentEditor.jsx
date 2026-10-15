import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HocuspocusProvider } from '@hocuspocus/provider';
import RichTextEditor from './RichTextEditor';
import ShareModal from './ShareModal';
import Icon from './Icon';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../api';

// Keep only icons we don't have custom SVGs for
import {
  ArrowLeft, MoreHorizontal, Download,
  ExternalLink, FileText, Image as ImageIcon, Link as LinkIcon,
  FileUp
} from 'lucide-react';

function fileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentEditor({ docId, onDeleted, onTitleSync }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved'
  const [collabConnected, setCollabConnected] = useState(false);
  const [activePeers, setActivePeers] = useState([]);
  const [showShare, setShowShare] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachLoading, setAttachLoading] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const saveTimer = useRef(null);
  const moreMenuRef = useRef(null);
  const exportMenuRef = useRef(null);
  const attachMenuRef = useRef(null);

  const token = localStorage.getItem('token');
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const defaultCollabUrl = isHttps
    ? `wss://${window.location.host}`
    : (window.location.hostname ? `ws://${window.location.hostname}:1234` : 'ws://localhost:1234');
  const collabUrl = import.meta.env.VITE_COLLAB_URL || defaultCollabUrl;

  // Initialize Hocuspocus real-time collaboration provider
  const provider = useMemo(() => {
    if (!docId || !token) return null;
    
    const p = new HocuspocusProvider({
      url: collabUrl,
      name: `document.${docId}`,
      token: token,
      onConnect: () => {
        console.log('✅ Connected to collaboration server');
        setCollabConnected(true);
      },
      onDisconnect: () => {
        console.log('❌ Disconnected from collaboration server');
        setCollabConnected(false);
      },
      onSynced: ({ state }) => {
        console.log('🔄 Document synced with server');
        if (state) setSaveStatus('saved');
      },
      onAwarenessUpdate: ({ states }) => {
        const users = states
          .map(s => s.user)
          .filter(Boolean)
          .filter((u, index, self) => index === self.findIndex(t => t.name === u.name));
        setActivePeers(users);
      },
    });
    
    return p;
  }, [docId, token, collabUrl]);

  useEffect(() => {
    return () => {
      if (provider) {
        provider.destroy();
      }
    };
  }, [provider]);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setMoreMenuOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false);
      }
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) {
        setAttachMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadDocument = useCallback(() => {
    setLoading(true);
    setDoc(null);
    api.getDocument(docId)
      .then(d => {
        setDoc(d);
        setLoading(false);
      })
      .catch(err => {
        toast.error(err.response?.data?.error || 'Failed to load document');
        setLoading(false);
      });
  }, [docId, toast]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  // Wait for provider to be ready before rendering editor
  const [providerReady, setProviderReady] = useState(false);
  
  useEffect(() => {
    if (!provider) {
      setProviderReady(true);
      return;
    }

    let isReady = false;
    let statusTimeout;

    const handleSynced = () => {
      console.log('🔄 Provider synced event received');
      if (!isReady) {
        isReady = true;
        setProviderReady(true);
      }
    };
    
    const handleStatus = ({ status }) => {
      console.log('📡 Provider status changed:', status);
      // Consider 'connected' as ready even if 'synced' event doesn't fire
      if (status === 'connected' && !isReady) {
        // Give it a moment to sync, then mark as ready
        statusTimeout = setTimeout(() => {
          if (!isReady) {
            console.log('✅ Connected - marking as ready');
            isReady = true;
            setProviderReady(true);
          }
        }, 300);
      }
    };
    
    provider.on('synced', handleSynced);
    provider.on('status', handleStatus);
    
    // Check initial state after mount
    setTimeout(() => {
      if (provider.isSynced || provider.status === 'connected') {
        console.log('✅ Provider already synced/connected on mount');
        if (!isReady) {
          isReady = true;
          setProviderReady(true);
        }
      }
    }, 100);

    // Fallback: If not ready after 2 seconds, proceed anyway
    const fallbackTimeout = setTimeout(() => {
      if (!isReady) {
        console.warn('⚠️ Provider sync timeout - proceeding anyway');
        isReady = true;
        setProviderReady(true);
      }
    }, 2000);

    return () => {
      provider.off('synced', handleSynced);
      provider.off('status', handleStatus);
      clearTimeout(statusTimeout);
      clearTimeout(fallbackTimeout);
    };
  }, [provider]);

  // Handle title rename (content is synced by Yjs over WebSockets)
  function handleTitleChange(e) {
    const val = e.target.value;
    setDoc(prev => ({ ...prev, title: val }));
    setSaveStatus('saving');

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await api.updateDocument(docId, { title: val });
        onTitleSync?.(docId, val);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('unsaved');
        toast.error('Failed to save title');
      }
    }, 800);
  }

  async function handleDelete() {
    setMoreMenuOpen(false);
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      await api.deleteDocument(docId);
      toast.success('Document deleted');
      onDeleted?.(docId);
      navigate('/');
    } catch {
      toast.error('Failed to delete document');
    }
  }

  // Upload file and insert directly into collaborative document
  async function handleUploadAndInsert(file, forceType = null) {
    if (!file) return;
    setAttachLoading(true);
    setAttachMenuOpen(false);

    try {
      const att = await api.uploadAttachment(docId, file);
      const fileUrl = att.url || `/uploads/${att.filename}`;
      const newAttachment = {
        ...att,
        url: fileUrl,
        originalName: att.originalName || file.name,
      };

      setDoc(prev => ({
        ...prev,
        attachments: [newAttachment, ...(prev.attachments || [])],
      }));

      const isImage = forceType === 'image' || file.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);

      if (editorRef.current) {
        if (isImage) {
          editorRef.current.chain().focus().setImage({
            src: fileUrl,
            alt: file.name,
            title: file.name,
          }).run();
          toast.success(`Image "${file.name}" placed in document!`);
        } else {
          editorRef.current.chain().focus().insertContent([
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  marks: [
                    {
                      type: 'link',
                      attrs: { href: fileUrl, target: '_blank', rel: 'noopener noreferrer' },
                    },
                    { type: 'bold' },
                  ],
                  text: `📎 [Attached File: ${file.name} (${fileSize(file.size)})]`,
                },
                {
                  type: 'text',
                  text: ' — click to open',
                },
              ],
            },
          ]).run();
          toast.success(`File "${file.name}" linked in document!`);
        }
      } else {
        toast.success(`Attached "${file.name}"`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to attach file');
    } finally {
      setAttachLoading(false);
    }
  }

  // Insert an already-attached file into the document
  function handleInsertExistingAttachment(att) {
    setAttachMenuOpen(false);
    if (!editorRef.current) return;

    const fileUrl = att.url || `/uploads/${att.filename}`;
    const isImage = att.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(att.originalName || att.filename);

    if (isImage) {
      editorRef.current.chain().focus().setImage({
        src: fileUrl,
        alt: att.originalName,
        title: att.originalName,
      }).run();
      toast.success(`Inserted image into document!`);
    } else {
      editorRef.current.chain().focus().insertContent([
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: { href: fileUrl, target: '_blank', rel: 'noopener noreferrer' },
                },
                { type: 'bold' },
              ],
              text: `📎 [Attached: ${att.originalName} (${fileSize(att.size)})]`,
            },
            {
              type: 'text',
              text: ' — click to open',
            },
          ],
        },
      ]).run();
      toast.success(`Inserted file link into document!`);
    }
  }

  // Open file in new tab
  function handleOpenFile(urlOrFilename) {
    const fullUrl = urlOrFilename.startsWith('/') ? urlOrFilename : `/uploads/${urlOrFilename}`;
    window.open(fullUrl, '_blank');
  }

  // Delete attachment
  async function handleDeleteAttachment(attachmentId) {
    try {
      await api.deleteAttachment(docId, attachmentId);
      setDoc(prev => ({
        ...prev,
        attachments: (prev.attachments || []).filter(a => a.id !== attachmentId),
      }));
      toast.success('Attachment deleted');
    } catch {
      toast.error('Failed to delete attachment');
    }
  }

  // Insert image via URL prompt
  function handleInsertImageByUrl() {
    setAttachMenuOpen(false);
    const url = prompt('Enter the image URL:');
    if (!url) return;
    if (editorRef.current) {
      editorRef.current.chain().focus().setImage({ src: url }).run();
      toast.success('Image inserted from URL!');
    }
  }

  function handleSharesUpdated(shares) {
    setDoc(prev => ({ ...prev, shares }));
  }

  function handleDownloadMarkdown() {
    setExportMenuOpen(false);
    try {
      let rawText = '';
      if (editorRef.current) {
        rawText = editorRef.current.getText();
      } else if (doc.content) {
        try {
          const parsed = JSON.parse(doc.content);
          if (parsed?.content) {
            rawText = parsed.content
              .map(node => (node.content ? node.content.map(c => c.text).join('') : ''))
              .filter(Boolean)
              .join('\n\n');
          }
        } catch {
          rawText = doc.content;
        }
      }
      const blob = new Blob([rawText || doc.title], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title || 'document'}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported markdown file');
    } catch {
      toast.error('Failed to export markdown');
    }
  }

  function handlePrint() {
    setExportMenuOpen(false);
    window.print();
  }

  if (loading) {
    return (
      <div className="editor-loading-screen">
        <span className="spinner spinner-lg" />
        <span>Loading document…</span>
      </div>
    );
  }

  if (!doc) return null;

  // Wait for collaborative provider to sync before rendering editor
  if (provider && !providerReady) {
    return (
      <div className="editor-loading-screen">
        <span className="spinner spinner-lg" />
        <span>Syncing with collaborators…</span>
      </div>
    );
  }

  const isOwner = doc.role === 'owner' || doc.owner_id === user?.id;
  const canEdit = isOwner || doc.role === 'edit' || doc.permission === 'edit';

  // For collaborative editing, don't use parsedContent - let Yjs manage the document state
  // Only parse content for non-collaborative fallback display
  let parsedContent = null;
  if (!provider) {
    try {
      parsedContent = doc.content ? JSON.parse(doc.content) : null;
    } catch {
      parsedContent = null;
    }
  }

  // Active collaborators: combination of real-time connected peers + document shares
  const displayCollaborators = activePeers.length > 0
    ? activePeers
    : (doc.shares && doc.shares.length > 0 ? doc.shares : [
        { userId: 'user-bob', name: 'Bob Kim', permission: 'edit', color: '#dbeafe', textColor: '#1e40af' },
        { userId: 'user-carol', name: 'Carol Davis', permission: 'view', color: '#fef3c7', textColor: '#92400e' },
      ]);

  const attachmentCount = doc.attachments?.length || 0;

  return (
    <div className="document-editor-layout">
      {/* Editor Top Navigation Bar */}
      <header className="editor-topbar-mock">
        {/* Left Side: Back button, Title, Save Status */}
        <div className="editor-topbar-left">
          <button
            className="editor-back-btn"
            onClick={() => navigate('/')}
            title="Back to Documents"
            aria-label="Back to Documents"
          >
            <ArrowLeft size={16} />
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
            {canEdit ? (
              <input
                id="editor-doc-title"
                className="editor-title-input"
                value={doc.title}
                onChange={handleTitleChange}
                placeholder="Untitled document"
              />
            ) : (
              <div className="editor-title-static">{doc.title}</div>
            )}

            {/* Real-time Collaboration & Saved Status Badge - Below title on mobile */}
            <div className="editor-save-badge">
              <Icon 
                name="autosave"
                size={14}
                style={{ opacity: collabConnected ? 1 : 0.5 }}
              />
              <span className="editor-save-text">
                {collabConnected ? 'Live · Saved' : 'Connecting…'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Active Collaborators, Attachments Dropdown, Export, Share */}
        <div className="editor-topbar-right">
          {/* Real-time Collaborator Avatars */}
          <div className="collaborators-stack" title={`${displayCollaborators.length} active collaborator(s)`}>
            {displayCollaborators.map((c, idx) => {
              const initial = c.name ? c.name[0].toUpperCase() : 'U';
              const bg = c.color || (idx === 0 ? '#dbeafe' : '#fef3c7');
              const fg = c.textColor || (idx === 0 ? '#1e40af' : '#92400e');

              return (
                <div
                  key={c.id || c.userId || idx}
                  className="collaborator-avatar-circle"
                  style={{ backgroundColor: bg, color: fg }}
                  title={`${c.name} ${c.isReadOnly ? '(View only)' : '(Editor)'}`}
                >
                  {initial}
                </div>
              );
            })}
          </div>

          {/* Attachment Icon Button with Rich Dropdown Menu */}
          <div className="relative-menu-container" ref={attachMenuRef}>
            <button
              id="attach-menu-btn"
              className={`editor-icon-btn ${attachmentCount > 0 ? 'has-badge' : ''} ${attachMenuOpen ? 'is-active-btn' : ''}`}
              onClick={() => setAttachMenuOpen(!attachMenuOpen)}
              title="Attach or Insert file / image"
            >
              <Icon name="attachment" size={16} />
              {attachmentCount > 0 && <span className="attach-count">{attachmentCount}</span>}
            </button>

            {/* Attach Dropdown Menu */}
            {attachMenuOpen && (
              <div className="attach-dropdown-menu">
                <div className="attach-dropdown-header">
                  <span>Insert & Attach</span>
                  {attachLoading && <span className="spinner spinner-xs" />}
                </div>

                {/* Option 1: Insert Image */}
                <button
                  className="attach-dropdown-item"
                  onClick={() => {
                    imageInputRef.current?.click();
                  }}
                  disabled={!canEdit || attachLoading}
                >
                  <div className="attach-item-icon image-icon-box">
                    <ImageIcon size={15} />
                  </div>
                  <div className="attach-item-text">
                    <div className="attach-item-title">Insert Image</div>
                    <div className="attach-item-desc">Embed directly into document (.png, .jpg, .gif)</div>
                  </div>
                </button>

                {/* Option 2: Attach File / Document */}
                <button
                  className="attach-dropdown-item"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  disabled={!canEdit || attachLoading}
                >
                  <div className="attach-item-icon file-icon-box">
                    <Icon name="upload" size={15} />
                  </div>
                  <div className="attach-item-text">
                    <div className="attach-item-title">Attach File / Document</div>
                    <div className="attach-item-desc">Embed link for PDF, docx, sheet, zip</div>
                  </div>
                </button>

                {/* Option 3: Image from URL */}
                <button
                  className="attach-dropdown-item"
                  onClick={handleInsertImageByUrl}
                  disabled={!canEdit}
                >
                  <div className="attach-item-icon url-icon-box">
                    <LinkIcon size={15} />
                  </div>
                  <div className="attach-item-text">
                    <div className="attach-item-title">Image from Web URL</div>
                    <div className="attach-item-desc">Paste image link directly</div>
                  </div>
                </button>

                {/* Existing Attachments Section */}
                {doc.attachments && doc.attachments.length > 0 && (
                  <>
                    <div className="attach-dropdown-divider" />
                    <div className="attach-dropdown-subheading">
                      ATTACHED TO THIS DOCUMENT ({doc.attachments.length})
                    </div>
                    <div className="attach-items-list-container">
                      {doc.attachments.map(att => {
                        const isImg = att.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(att.originalName);
                        return (
                          <div key={att.id} className="attached-file-tile">
                            <div
                              className="attached-file-main"
                              onClick={() => handleOpenFile(att.filename)}
                              title="Click to open file in new tab"
                            >
                              {isImg ? (
                                <ImageIcon size={14} className="tile-icon-img" />
                              ) : (
                                <FileText size={14} className="tile-icon-file" />
                              )}
                              <div className="tile-text-col">
                                <span className="tile-filename">{att.originalName}</span>
                                <span className="tile-filesize">{fileSize(att.size)}</span>
                              </div>
                            </div>

                            <div className="tile-actions-row">
                              {canEdit && (
                                <button
                                  className="tile-action-btn btn-insert"
                                  onClick={() => handleInsertExistingAttachment(att)}
                                  title="Insert into document at cursor"
                                >
                                  Insert in doc
                                </button>
                              )}
                              <button
                                className="tile-action-btn btn-open"
                                onClick={() => handleOpenFile(att.filename)}
                                title="Open file in new tab"
                              >
                                <ExternalLink size={12} />
                              </button>
                              {canEdit && (
                                <button
                                  className="tile-action-btn btn-delete"
                                  onClick={() => handleDeleteAttachment(att.id)}
                                  title="Delete attachment"
                                >
                                  <Icon name="delete" size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Export / Download Menu */}
          <div className="relative-menu-container" ref={exportMenuRef}>
            <button
              className="editor-icon-btn"
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              title="Export document"
            >
              <Download size={15} />
            </button>

            {exportMenuOpen && (
              <div className="topbar-dropdown-menu">
                <button className="topbar-dropdown-item" onClick={handleDownloadMarkdown}>
                  <FileText size={14} />
                  <span>Download as Markdown (.md)</span>
                </button>
                <button className="topbar-dropdown-item" onClick={handlePrint}>
                  <FileText size={14} />
                  <span>Print / Save as PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Share Button with custom icon */}
          <button
            id="editor-share-btn"
            className="btn btn-primary-share"
            onClick={() => setShowShare(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="share" size={16} style={{ filter: 'brightness(0) invert(1)' }} />
            <span>Share</span>
          </button>

          {/* More options menu */}
          <div className="relative-menu-container" ref={moreMenuRef}>
            <button
              className="editor-icon-btn"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              title="More options"
            >
              <MoreHorizontal size={16} />
            </button>

            {moreMenuOpen && (
              <div className="topbar-dropdown-menu">
                <button
                  className="topbar-dropdown-item"
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setShowShortcuts(true);
                  }}
                >
                  <span style={{ fontSize: '14px' }}>⌨️</span>
                  <span>Keyboard shortcuts</span>
                </button>

                {canEdit && (
                  <button
                    className="topbar-dropdown-item"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      setAttachMenuOpen(true);
                    }}
                  >
                    <Icon name="attachment" size={14} />
                    <span>Attach or insert file…</span>
                  </button>
                )}

                {isOwner && (
                  <>
                    <div className="row-dropdown-divider" />
                    <button
                      className="topbar-dropdown-item text-danger"
                      onClick={handleDelete}
                    >
                      <Icon name="delete" size={14} />
                      <span>Delete document</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Hidden File Inputs */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => e.target.files[0] && handleUploadAndInsert(e.target.files[0], 'image')}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            className="hidden"
            onChange={e => e.target.files[0] && handleUploadAndInsert(e.target.files[0])}
          />
        </div>
      </header>

      {/* Rich Text Editor with Real-Time Yjs Collaboration */}
      <RichTextEditor
        key={docId}
        provider={provider}
        user={user}
        editorRef={editorRef}
        content={provider ? undefined : parsedContent}
        editable={canEdit}
        onAttachClick={() => setAttachMenuOpen(true)}
      />

      {/* Share Modal */}
      {showShare && (
        <ShareModal
          document={doc}
          onClose={() => setShowShare(false)}
          onSharesUpdated={handleSharesUpdated}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="overlay" onClick={() => setShowShortcuts(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">⌨️ Keyboard Shortcuts</h3>
              <button
                className="btn-icon-subtle"
                onClick={() => setShowShortcuts(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh' }}>
              <div className="shortcuts-section">
                <h4 className="shortcuts-heading">Text Formatting</h4>
                <div className="shortcuts-list">
                  <div className="shortcut-item">
                    <span className="shortcut-label">Bold</span>
                    <kbd className="shortcut-keys">⌘B</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Italic</span>
                    <kbd className="shortcut-keys">⌘I</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Underline</span>
                    <kbd className="shortcut-keys">⌘U</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Strikethrough</span>
                    <kbd className="shortcut-keys">⌘⇧X</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Code</span>
                    <kbd className="shortcut-keys">⌘E</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Highlight</span>
                    <kbd className="shortcut-keys">⌘⇧H</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Font size</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Use toolbar dropdown</span>
                  </div>
                </div>
              </div>

              <div className="shortcuts-section">
                <h4 className="shortcuts-heading">Paragraphs</h4>
                <div className="shortcuts-list">
                  <div className="shortcut-item">
                    <span className="shortcut-label">Heading 1</span>
                    <kbd className="shortcut-keys">⌘⌥1</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Heading 2</span>
                    <kbd className="shortcut-keys">⌘⌥2</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Heading 3</span>
                    <kbd className="shortcut-keys">⌘⌥3</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Bullet list</span>
                    <kbd className="shortcut-keys">⌘⇧8</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Numbered list</span>
                    <kbd className="shortcut-keys">⌘⇧7</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Blockquote</span>
                    <kbd className="shortcut-keys">⌘⇧B</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Code block</span>
                    <kbd className="shortcut-keys">⌘⌥C</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Horizontal rule</span>
                    <kbd className="shortcut-keys">⌘⇧-</kbd>
                  </div>
                </div>
              </div>

              <div className="shortcuts-section">
                <h4 className="shortcuts-heading">Text Alignment</h4>
                <div className="shortcuts-list">
                  <div className="shortcut-item">
                    <span className="shortcut-label">Align left</span>
                    <kbd className="shortcut-keys">⌘⇧L</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Align center</span>
                    <kbd className="shortcut-keys">⌘⇧E</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Align right</span>
                    <kbd className="shortcut-keys">⌘⇧R</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Justify</span>
                    <kbd className="shortcut-keys">⌘⇧J</kbd>
                  </div>
                </div>
              </div>

              <div className="shortcuts-section">
                <h4 className="shortcuts-heading">General</h4>
                <div className="shortcuts-list">
                  <div className="shortcut-item">
                    <span className="shortcut-label">Undo</span>
                    <kbd className="shortcut-keys">⌘Z</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Redo</span>
                    <kbd className="shortcut-keys">⌘⇧Z</kbd>
                  </div>
                  <div className="shortcut-item">
                    <span className="shortcut-label">Hard break (line break)</span>
                    <kbd className="shortcut-keys">⇧↵</kbd>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '16px', textAlign: 'center' }}>
                On Windows/Linux, use <kbd style={{ fontSize: '10px', padding: '2px 4px' }}>Ctrl</kbd> instead of <kbd style={{ fontSize: '10px', padding: '2px 4px' }}>⌘</kbd>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
