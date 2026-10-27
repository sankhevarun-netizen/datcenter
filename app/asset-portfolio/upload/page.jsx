'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Plug } from 'lucide-react';

export default function AssetPortfolioUploadPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/asset-portfolio/normalize', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-xl font-extrabold text-text-primary mb-1" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
        Upload Asset Register
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Upload your facility register as .xlsx or .csv. Column names don't need to match exactly — our AI maps your headers onto the canonical schema automatically.
      </p>

      <a
        href="/api/asset-portfolio/template"
        className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-lg border border-grey-border text-xs font-semibold text-text-primary hover:bg-grey-bg transition-colors"
      >
        <Download size={13} /> Download Excel Template
      </a>

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-grey-border rounded-xl p-10 text-center cursor-pointer hover:border-accent/50 hover:bg-grey-bg transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />
        <FileSpreadsheet size={28} className="mx-auto text-text-muted mb-2" />
        {file ? (
          <p className="text-sm font-semibold text-text-primary">{file.name}</p>
        ) : (
          <p className="text-sm text-text-secondary">Drag & drop your file here, or click to browse</p>
        )}
      </div>

      {file && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-navy hover:bg-[#002A73] text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <Upload size={14} /> {uploading ? 'Normalizing & importing…' : 'Upload & Normalize'}
        </button>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 bg-danger-light border border-danger/20 rounded-lg p-3">
          <AlertCircle size={14} className="text-danger flex-shrink-0 mt-0.5" />
          <p className="text-xs text-danger">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-4 bg-success-light border border-success/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={15} className="text-success" />
            <p className="text-sm font-semibold text-text-primary">Import complete</p>
          </div>
          <p className="text-xs text-text-secondary">
            Asset Register: {result.register.rows_imported} of {result.register.rows_total} rows imported
            {result.register.rows_flagged > 0 && `, ${result.register.rows_flagged} flagged (missing required fields)`}.
          </p>
          {result.events && (
            <p className="text-xs text-text-secondary mt-1">
              Capex & Events Log: {result.events.rows_imported} of {result.events.rows_total} rows imported.
            </p>
          )}
          <Link href="/asset-portfolio" className="inline-block mt-3 text-xs font-semibold text-accent hover:underline">
            View on Globe →
          </Link>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-grey-border">
        <Link
          href="/integrations"
          className="inline-flex items-center gap-2 text-xs font-medium text-text-secondary hover:text-accent transition-colors"
        >
          <Plug size={13} /> Looking for a live data connector instead? Open Integrations →
        </Link>
      </div>
    </div>
  );
}
