import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Dashboard from '../components/Dashboard';
import DocumentEditor from '../components/DocumentEditor';
import UploadModal from '../components/UploadModal';
import ShareModal from '../components/ShareModal';
import { useToast } from '../contexts/ToastContext';
import * as api from '../api';

export default function WorkspacePage() {
  const { id: docIdFromRoute } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [sharingDoc, setSharingDoc] = useState(null);

  const loadDocs = useCallback(async () => {
    try {
      const { owned, shared } = await api.getDocuments();
      const all = [
        ...owned.map(d => ({ ...d, role: 'owner' })),
        ...shared,
      ];
      setDocs(all);
      return all;
    } catch {
      toast.error('Failed to load documents');
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  async function handleNewDoc() {
    try {
      const doc = await api.createDocument({ title: 'Untitled Document' });
      setDocs(prev => [{ ...doc, role: 'owner' }, ...prev]);
      navigate(`/doc/${doc.id}`);
      toast.success('New document created');
    } catch {
      toast.error('Failed to create document');
    }
  }

  function handleDocumentCreated(doc) {
    setDocs(prev => [{ ...doc, role: 'owner' }, ...prev]);
    navigate(`/doc/${doc.id}`);
  }

  function handleDocDeleted(docId) {
    setDocs(prev => prev.filter(d => d.id !== docId));
  }

  function handleDocRenamed(docId, newTitle) {
    setDocs(prev => prev.map(d => (d.id === docId ? { ...d, title: newTitle } : d)));
  }

  if (loading) {
    return (
      <div className="workspace-loading-screen">
        <span className="spinner spinner-lg" />
        <span>Loading Docs…</span>
      </div>
    );
  }

  // If a document ID is in the URL, render the Editor view (Image 2)
  if (docIdFromRoute) {
    return (
      <DocumentEditor
        key={docIdFromRoute}
        docId={docIdFromRoute}
        onDeleted={handleDocDeleted}
        onTitleSync={handleDocRenamed}
      />
    );
  }

  // Otherwise, render the Dashboard view (Image 1)
  return (
    <>
      <Dashboard
        documents={docs}
        onNewDoc={handleNewDoc}
        onImportClick={() => setShowUpload(true)}
        onDocDeleted={handleDocDeleted}
        onDocRenamed={handleDocRenamed}
        onShareClick={doc => setSharingDoc(doc)}
      />

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onDocumentCreated={handleDocumentCreated}
        />
      )}

      {sharingDoc && (
        <ShareModal
          document={sharingDoc}
          onClose={() => setSharingDoc(null)}
          onSharesUpdated={() => loadDocs()}
        />
      )}
    </>
  );
}
