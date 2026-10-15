import { useState, useCallback, useRef } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import * as api from '../api';

const SUPPORTED = ['.txt', '.md', '.docx'];
const MIME_MAP = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export default function UploadModal({ onClose, onDocumentCreated }) {
  const toast = useToast();
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  function handleFile(f) {
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!SUPPORTED.includes(ext)) {
      toast.error(`Unsupported type. Use: ${SUPPORTED.join(', ')}`);
      return;
    }
    setFile(f);
  }

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    try {
      const doc = await api.uploadToDocument(file);
      toast.success(`"${doc.title}" created from upload!`);
      onDocumentCreated(doc);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Import File as Document</span>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div
            className={`upload-zone ${dragging ? 'dragging' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <div className="upload-zone-icon">
              <Upload size={22} />
            </div>
            <div className="upload-zone-title">
              {file ? file.name : 'Drop a file or click to browse'}
            </div>
            <div className="upload-zone-sub">
              Supported file types:
            </div>
            <div className="upload-zone-types">
              {SUPPORTED.map(t => (
                <span key={t} className="file-type-badge">{t}</span>
              ))}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={SUPPORTED.join(',')}
              className="hidden"
              onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
            />
          </div>

          {file && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <FileText size={16} color="var(--color-primary-h)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{file.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{(file.size / 1024).toFixed(1)} KB</div>
              </div>
              <button className="btn-icon" onClick={() => setFile(null)}><X size={14} /></button>
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--color-text-3)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--color-text-2)' }}>What happens:</strong> The file will be converted into a new editable document.
            .txt and .md files are parsed directly. .docx files are imported via mammoth.
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            id="upload-import-btn"
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!file || loading}
          >
            {loading ? <span className="spinner" /> : <Upload size={14} />}
            {loading ? 'Importing…' : 'Import as Document'}
          </button>
        </div>
      </div>
    </div>
  );
}
