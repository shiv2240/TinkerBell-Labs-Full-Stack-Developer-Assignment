import React, { useState, useEffect, useMemo } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const LANG_MAP = {
  en: 'English [en]',
  hi: 'Hindi [hi]',
  kn: 'Kannada [kn]',
  es: 'Spanish [es] (Invalid - 422)'
};

// Inline SVG Icons
function ServerIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function RefreshIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function AlertIcon({ size = 24, className = 'text-amber-400' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export default function App() {
  // Remote Server State
  const [serverRecord, setServerRecord] = useState(null);
  const [serverActor, setServerActor] = useState({ role: 'editor', siteId: 'S01' });
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form Client State
  const [actorRole, setActorRole] = useState('editor');
  const [actorSite, setActorSite] = useState('S01');

  const [includeLang, setIncludeLang] = useState(true);
  const [includeVol, setIncludeVol] = useState(true);
  const [formLang, setFormLang] = useState('en');
  const [formVol, setFormVol] = useState(2);

  // Validation & Conflict
  const [inlineErrors, setInlineErrors] = useState({});
  const [conflictData, setConflictData] = useState(null);

  // Inspector & Audit
  const [activeTab, setActiveTab] = useState('last');
  const [lastResponse, setLastResponse] = useState(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  // Pagination & Date Filter State
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'custom'
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Initialize audit history from localStorage
  const [auditHistory, setAuditHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('safe_device_settings_audit_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Normalize each entry with a date field if missing
        return parsed.map(item => ({
          ...item,
          date: item.date || (item.id ? new Date(item.id).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
        }));
      }
      return [];
    } catch (err) {
      console.error('Failed to load audit history from localStorage:', err);
      return [];
    }
  });

  const [toasts, setToasts] = useState([]);

  // Synchronize audit history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('safe_device_settings_audit_history', JSON.stringify(auditHistory));
    } catch (err) {
      console.error('Failed to save audit history to localStorage:', err);
    }
  }, [auditHistory]);

  const clearHistory = () => {
    setAuditHistory([]);
    try {
      localStorage.removeItem('safe_device_settings_audit_history');
    } catch (err) {
      console.error('Failed to clear audit history from localStorage:', err);
    }
    setExpandedHistoryId(null);
    setCurrentPage(1);
    addToast('Audit history cleared from local storage.', 'info');
  };

  // Toast Helper
  const addToast = (msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // 1. Initial State Fetch
  const fetchState = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/state`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setServerRecord(data.current);
      setServerActor(data.actor);
      setActorRole(data.actor.role);
      setActorSite(data.actor.siteId);

      // Sync form
      setFormLang(data.current.settings.language);
      setFormVol(data.current.settings.volume);
      setIsBackendOnline(true);
    } catch (err) {
      setIsBackendOnline(false);
      addToast(`Cannot connect to backend (${API_BASE}): ${err.message}`, 'error');
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  // 2. Diff Tracking for Unsaved Changes
  const hasLangChanged = useMemo(() => {
    if (!includeLang || !serverRecord) return false;
    return formLang !== serverRecord.settings.language;
  }, [includeLang, formLang, serverRecord]);

  const hasVolChanged = useMemo(() => {
    if (!includeVol || !serverRecord) return false;
    return formVol !== serverRecord.settings.volume;
  }, [includeVol, formVol, serverRecord]);

  const hasUnsavedChanges = hasLangChanged || hasVolChanged;

  // 3. Outgoing Payload Generator
  const outgoingPayload = useMemo(() => {
    if (!serverRecord) return {};
    const settings = {};
    if (includeLang) settings.language = formLang;
    if (includeVol) settings.volume = formVol;

    return {
      deviceId: serverRecord.deviceId,
      expectedVersion: serverRecord.version,
      settings
    };
  }, [serverRecord, includeLang, includeVol, formLang, formVol]);

  // 4. Client-side Inline Validation
  const validateForm = () => {
    const errors = {};
    if (!includeLang && !includeVol) {
      errors.general = 'Request must include at least one setting (empty settings forbidden).';
    }
    if (includeLang && !['en', 'hi', 'kn'].includes(formLang)) {
      errors.language = `Invalid language "${formLang}". Only en, hi, kn allowed.`;
    }
    if (includeVol && (typeof formVol !== 'number' || formVol < 0 || formVol > 5)) {
      errors.volume = 'Volume must be an integer between 0 and 5.';
    }
    setInlineErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 5. Send Update Request
  const handleSave = async (customPayload = null, source = 'Form Save') => {
    if (!customPayload && !validateForm()) {
      addToast('Please resolve inline validation errors before saving.', 'error');
      return;
    }

    const payload = customPayload || outgoingPayload;
    setIsLoading(true);
    const start = performance.now();

    try {
      const res = await fetch(`${API_BASE}/api/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor: { role: actorRole, siteId: actorSite },
          request: payload
        })
      });

      const elapsed = Math.round(performance.now() - start);
      const data = await res.json();
      setIsLoading(false);

      setLastResponse(data);

      const now = new Date();
      const newEntry = {
        id: Date.now(),
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString(),
        status: data.status,
        source,
        elapsed,
        request: payload,
        response: data
      };

      setAuditHistory(prev => [newEntry, ...prev]);

      if (data.status === 200 && data.record) {
        setServerRecord(data.record);
        setFormLang(data.record.settings.language);
        setFormVol(data.record.settings.volume);
        setInlineErrors({});
        addToast(`Success (200)! Saved version incremented to v${data.record.version}`, 'success');
      } else if (data.status === 409) {
        addToast('Concurrency Conflict (409): Record was modified by another actor!', 'warning');
        const freshRes = await fetch(`${API_BASE}/api/state`);
        const freshData = await freshRes.json();
        setConflictData({
          clientReq: payload,
          serverRecord: freshData.current
        });
      } else if (data.status === 403) {
        addToast('403 FORBIDDEN: Actor lacks edit privileges on this site.', 'error');
      } else if (data.status === 404) {
        addToast(`404 NOT_FOUND: Device "${payload.deviceId}" not found.`, 'error');
      } else if (data.status === 422) {
        addToast('422 INVALID_INPUT: Payload rejected by validation checks.', 'error');
      }
    } catch (err) {
      setIsLoading(false);
      addToast(`Network request failed: ${err.message}`, 'error');
    }
  };

  // Scenario Buttons
  const triggerConflictScenario = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/simulate-conflict`, { method: 'POST' });
      const data = await res.json();
      addToast(`Simulated external write: server record updated to v${data.current.version}. Now click 'Save Settings' to trigger 409!`, 'warning');
      setServerRecord(prev => ({ ...prev, version: data.current.version }));
    } catch (err) {
      addToast(`Failed: ${err.message}`, 'error');
    }
  };

  const triggerStaleVersion = () => {
    handleSave({ ...outgoingPayload, expectedVersion: 1 }, 'Scenario: Stale Version');
  };

  const triggerWrongDevice = () => {
    handleSave({ ...outgoingPayload, deviceId: 'D99_UNKNOWN' }, 'Scenario: Wrong Device');
  };

  const triggerMalformed = () => {
    handleSave(
      {
        deviceId: serverRecord?.deviceId || 'D01',
        expectedVersion: 3,
        settings: { volume: true, unexpectedKey: 'test' },
        extraTopKey: 123
      },
      'Scenario: Malformed Payload'
    );
  };

  const resetEnvironment = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reset`, { method: 'POST' });
      const data = await res.json();
      setServerRecord(data.current);
      setServerActor(data.actor);
      setActorRole(data.actor.role);
      setActorSite(data.actor.siteId);
      setFormLang(data.current.settings.language);
      setFormVol(data.current.settings.volume);
      setInlineErrors({});
      setConflictData(null);
      addToast('Environment reset to default PRD fixture.', 'success');
    } catch (err) {
      addToast(`Reset failed: ${err.message}`, 'error');
    }
  };

  // Filter & Pagination computations
  const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const filteredHistory = useMemo(() => {
    return auditHistory.filter(item => {
      const itemDate = item.date || (item.id ? new Date(item.id).toISOString().split('T')[0] : '');
      if (dateFilter === 'today') {
        return itemDate === todayDateStr;
      }
      if (dateFilter === 'custom' && customDate) {
        return itemDate === customDate;
      }
      return true;
    });
  }, [auditHistory, dateFilter, customDate, todayDateStr]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);

  const paginatedHistory = useMemo(() => {
    const startIndex = (activePage - 1) * itemsPerPage;
    return filteredHistory.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredHistory, activePage, itemsPerPage]);

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 200:
        return 'bg-emerald-500 text-white';
      case 409:
        return 'bg-amber-500 text-slate-950 font-extrabold';
      case 403:
        return 'bg-rose-500 text-white';
      case 404:
        return 'bg-sky-500 text-white';
      case 422:
        return 'bg-red-500 text-white';
      default:
        return 'bg-slate-700 text-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900/85 backdrop-blur-md border-b border-slate-800 px-4 md:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0">
            <ServerIcon size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold text-white tracking-tight">Safe Device Settings Console</h1>
              <span className="text-xs bg-indigo-500/20 text-indigo-300 font-mono px-2 py-0.5 rounded border border-indigo-500/30 hidden sm:inline-block">
                Tailwind CSS v4
              </span>
            </div>
            <p className="text-xs text-slate-400">Optimistic Concurrency & Partial Update Validator</p>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
          <button
            type="button"
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition active:scale-95"
            onClick={resetEnvironment}
            title="Reset server state to PRD baseline"
          >
            <RefreshIcon size={14} />
            Reset State
          </button>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${isBackendOnline
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
            <span className={`w-2 h-2 rounded-full ${isBackendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
            <span className="truncate max-w-[170px] sm:max-w-none">
              {isBackendOnline ? `Backend Connected (${API_BASE})` : 'Backend Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-[1400px] mx-auto w-full p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Left Column: Device State & Settings Form */}
        <div className="flex flex-col gap-6">
          {/* Current Saved State Card */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <span className="block text-[10px] font-bold tracking-wider uppercase text-indigo-400 mb-0.5">
                  PERSISTENT STORAGE
                </span>
                <h2 className="text-lg font-bold text-white tracking-tight">Saved Device State</h2>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  ID: {serverRecord?.deviceId || '...'}
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                  Site: {serverRecord?.siteId || '...'}
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  v{serverRecord?.version || '...'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Active Language
                </span>
                <span className="text-base font-bold text-slate-100">
                  {serverRecord ? LANG_MAP[serverRecord.settings.language] || serverRecord.settings.language : '...'}
                </span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Volume Level
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-slate-100 font-mono">
                    {serverRecord?.settings.volume ?? '...'} / 5
                  </span>
                  <div className="flex items-end gap-1 h-5">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`w-1.5 rounded-sm transition-all ${serverRecord && lvl <= serverRecord.settings.volume
                            ? 'bg-indigo-500 shadow-sm shadow-indigo-500/50'
                            : 'bg-slate-800'
                          }`}
                        style={{ height: `${lvl * 4}px` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Actor Identity Controls */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="block text-[10px] font-bold tracking-wider uppercase text-indigo-400 mb-0.5">
                  STEP 1 PERMISSIONS
                </span>
                <h2 className="text-lg font-bold text-white tracking-tight">Simulated Actor Identity</h2>
              </div>
              <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                PRD §4.1
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Adjust actor credentials to test permission validation (PRD Step 1: 403 FORBIDDEN).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300" htmlFor="actor-role">Role</label>
                <select
                  id="actor-role"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                  value={actorRole}
                  onChange={(e) => setActorRole(e.target.value)}
                >
                  <option value="editor">editor (Authorized)</option>
                  <option value="viewer">viewer (Forbidden - 403)</option>
                  <option value="guest">guest (Forbidden - 403)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300" htmlFor="actor-site">Site ID</label>
                <input
                  id="actor-site"
                  type="text"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                  value={actorSite}
                  onChange={(e) => setActorSite(e.target.value)}
                  placeholder="e.g. S01"
                />
                <span className="text-[11px] text-slate-500">Must match device site ({serverRecord?.siteId || 'S01'})</span>
              </div>
            </div>
          </section>

          {/* Settings Editor Form */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="block text-[10px] font-bold tracking-wider uppercase text-indigo-400 mb-0.5">
                  PARTIAL UPDATE FORM
                </span>
                <h2 className="text-lg font-bold text-white tracking-tight">Device Settings Editor</h2>
              </div>
              {hasUnsavedChanges && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                  ● Unsaved Changes
                </span>
              )}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              {inlineErrors.general && (
                <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg mb-3">
                  {inlineErrors.general}
                </div>
              )}

              {/* Language Section */}
              <div className={`p-4 rounded-xl border mb-3 transition ${hasLangChanged
                  ? 'bg-amber-500/5 border-amber-500/40'
                  : 'bg-slate-950/60 border-slate-800'
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-indigo-500 w-4 h-4 cursor-pointer"
                      checked={includeLang}
                      onChange={(e) => {
                        setIncludeLang(e.target.checked);
                        setInlineErrors({});
                      }}
                    />
                    <span>Include <strong>language</strong> in update</span>
                  </label>
                  {hasLangChanged && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                      Modified
                    </span>
                  )}
                </div>

                <select
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition disabled:opacity-40"
                  value={formLang}
                  disabled={!includeLang}
                  onChange={(e) => {
                    setFormLang(e.target.value);
                    setInlineErrors({});
                  }}
                >
                  <option value="en">English [en]</option>
                  <option value="hi">Hindi [hi]</option>
                  <option value="kn">Kannada [kn]</option>
                  <option value="es">Spanish [es] (Invalid - 422)</option>
                </select>
                {inlineErrors.language && (
                  <div className="text-xs text-rose-400 mt-1.5">{inlineErrors.language}</div>
                )}
              </div>

              {/* Volume Section */}
              <div className={`p-4 rounded-xl border mb-4 transition ${hasVolChanged
                  ? 'bg-amber-500/5 border-amber-500/40'
                  : 'bg-slate-950/60 border-slate-800'
                }`}>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-indigo-500 w-4 h-4 cursor-pointer"
                      checked={includeVol}
                      onChange={(e) => {
                        setIncludeVol(e.target.checked);
                        setInlineErrors({});
                      }}
                    />
                    <span>Include <strong>volume</strong> in update</span>
                  </label>
                  {hasVolChanged && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                      Modified
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="1"
                    className="flex-1 accent-indigo-500 cursor-pointer disabled:opacity-40"
                    value={formVol}
                    disabled={!includeVol}
                    onChange={(e) => {
                      setFormVol(parseInt(e.target.value, 10));
                      setInlineErrors({});
                    }}
                  />
                  <div className="min-w-[60px] text-center font-mono text-sm font-bold bg-slate-900 border border-slate-700 px-2 py-1 rounded">
                    {formVol} / 5
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {[0, 1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      type="button"
                      key={lvl}
                      className={`py-1.5 text-xs font-semibold rounded transition disabled:opacity-40 ${formVol === lvl
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/50'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                        }`}
                      disabled={!includeVol}
                      onClick={() => {
                        setFormVol(lvl);
                        setInlineErrors({});
                      }}
                    >
                      {lvl === 0 ? '0 (Mute)' : lvl === 5 ? '5 (Max)' : lvl}
                    </button>
                  ))}
                </div>
                {inlineErrors.volume && (
                  <div className="text-xs text-rose-400 mt-1.5">{inlineErrors.volume}</div>
                )}
              </div>

              {/* Version & Device Metadata Box */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-950 border border-dashed border-slate-800 text-xs mb-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Client Expected Version:</span>
                  <span className="font-mono font-bold text-sky-400">v{serverRecord?.version || 3}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Target Device ID:</span>
                  <span className="font-mono font-bold text-sky-400">{serverRecord?.deviceId || 'D01'}</span>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-indigo-500/25 transition disabled:opacity-50 disabled:pointer-events-none"
                  disabled={isLoading}
                  aria-busy={isLoading}
                >
                  {isLoading ? 'Saving Update...' : 'Save Settings'}
                </button>
                <button
                  type="button"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-2.5 px-4 rounded-xl font-semibold transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                  disabled={!hasUnsavedChanges || isLoading}
                  onClick={() => {
                    if (serverRecord) {
                      setFormLang(serverRecord.settings.language);
                      setFormVol(serverRecord.settings.volume);
                      setInlineErrors({});
                      addToast('Reverted pending changes to saved record.', 'info');
                    }
                  }}
                >
                  Revert Edits
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Right Column: Scenarios, Inspector & Audit History */}
        <div className="flex flex-col gap-6">
          {/* Scenario Simulators */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition">
            <div className="mb-3">
              <span className="block text-[10px] font-bold tracking-wider uppercase text-indigo-400 mb-0.5">
                EDGE CASES & SCENARIOS
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">Error & Concurrency Simulators</h2>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Simulate Concurrent Edit (409)</h4>
                  <p className="text-[11px] text-slate-400">Bumps server record behind client to trigger optimistic locking conflict.</p>
                </div>
                <button
                  type="button"
                  className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-semibold text-xs px-3 py-2 rounded-lg transition shrink-0"
                  onClick={triggerConflictScenario}
                >
                  Trigger 409 Conflict
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Send Stale Expected Version</h4>
                  <p className="text-[11px] text-slate-400">Sends payload with <code className="text-sky-400 font-mono">expectedVersion: 1</code> (409 Conflict).</p>
                </div>
                <button
                  type="button"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs px-3 py-2 rounded-lg transition shrink-0"
                  onClick={triggerStaleVersion}
                >
                  Send Stale Version
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Target Non-Existent Device</h4>
                  <p className="text-[11px] text-slate-400">Sends payload with <code className="text-sky-400 font-mono">deviceId: "D99_UNKNOWN"</code> (404 Not Found).</p>
                </div>
                <button
                  type="button"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs px-3 py-2 rounded-lg transition shrink-0"
                  onClick={triggerWrongDevice}
                >
                  Test 404 Device
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Inject Illegal Types / Extra Keys</h4>
                  <p className="text-[11px] text-slate-400">Sends payload with boolean volume and extra top-level field (422).</p>
                </div>
                <button
                  type="button"
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs px-3 py-2 rounded-lg transition shrink-0"
                  onClick={triggerMalformed}
                >
                  Test 422 Payload
                </button>
              </div>
            </div>
          </section>

          {/* Response Inspector & Audit */}
          <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-700 transition">
            <div className="mb-3">
              <span className="block text-[10px] font-bold tracking-wider uppercase text-indigo-400 mb-0.5">
                INSPECTOR & AUDIT
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">Live Response Inspector</h2>
            </div>

            {/* Tabs Navigation */}
            <div className="flex border-b border-slate-800 mb-4 overflow-x-auto whitespace-nowrap gap-1">
              <button
                type="button"
                className={`py-2 px-3 text-xs font-semibold relative transition ${activeTab === 'last' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'
                  }`}
                onClick={() => setActiveTab('last')}
              >
                Last Execution
              </button>
              <button
                type="button"
                className={`py-2 px-3 text-xs font-semibold relative transition ${activeTab === 'outgoing' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'
                  }`}
                onClick={() => setActiveTab('outgoing')}
              >
                Live Payload Preview
              </button>
              <button
                type="button"
                className={`py-2 px-3 text-xs font-semibold relative transition ${activeTab === 'history' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'
                  }`}
                onClick={() => setActiveTab('history')}
              >
                Audit History ({filteredHistory.length}{filteredHistory.length !== auditHistory.length ? ` / ${auditHistory.length}` : ''})
              </button>
            </div>

            {/* Tab: Last Response */}
            {activeTab === 'last' && (
              <div>
                {lastResponse ? (
                  <div>
                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 mb-3">
                      <span className={`px-2.5 py-1 rounded text-xs font-bold font-mono ${getStatusBadgeClass(lastResponse.status)}`}>
                        {lastResponse.status} {lastResponse.error || 'OK'}
                      </span>
                      <span className="text-xs text-slate-300">
                        {lastResponse.status === 200
                          ? 'Settings update merged and version incremented'
                          : lastResponse.status === 409
                            ? 'Optimistic concurrency conflict detected'
                            : lastResponse.status === 403
                              ? 'Permission denied (unauthorized actor role or site)'
                              : lastResponse.status === 404
                                ? 'Device not found'
                                : 'Payload failed schema or type validation'}
                      </span>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                      <div className="px-3.5 py-2 bg-slate-900/60 border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
                        Response JSON
                      </div>
                      <pre className="p-3.5 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed">
                        {JSON.stringify(lastResponse, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <p className="text-center py-8 text-xs text-slate-400">
                    No update requests executed yet. Click "Save Settings" or trigger a scenario.
                  </p>
                )}
              </div>
            )}

            {/* Tab: Outgoing Preview */}
            {activeTab === 'outgoing' && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-3.5 py-2 bg-slate-900/60 border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
                  Outgoing HTTP Body Preview
                </div>
                <pre className="p-3.5 font-mono text-xs text-sky-300 overflow-x-auto leading-relaxed">
                  {JSON.stringify(
                    {
                      actor: { role: actorRole, siteId: actorSite },
                      request: outgoingPayload
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            )}

            {/* Tab: Audit History with Date Filter & Pagination */}
            {activeTab === 'history' && (
              <div className="flex flex-col gap-3">
                {/* Audit Top Controls: Storage badge, Date Filter & Clear */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="text-xs text-slate-400 font-medium">Persisted in Local Storage</span>
                  </div>

                  {auditHistory.length > 0 && (
                    <button
                      type="button"
                      className="text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-2.5 py-1 rounded transition"
                      onClick={clearHistory}
                    >
                      Clear History
                    </button>
                  )}
                </div>

                {/* Filter Bar: All / Today / Custom Date */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Date:</span>
                    <button
                      type="button"
                      className={`text-xs px-2.5 py-1 rounded font-medium transition ${dateFilter === 'all'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                      onClick={() => { setDateFilter('all'); setCurrentPage(1); }}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={`text-xs px-2.5 py-1 rounded font-medium transition ${dateFilter === 'today'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                      onClick={() => { setDateFilter('today'); setCurrentPage(1); }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className={`text-xs px-2.5 py-1 rounded font-medium transition ${dateFilter === 'custom'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                      onClick={() => { setDateFilter('custom'); setCurrentPage(1); }}
                    >
                      Custom
                    </button>
                  </div>

                  {dateFilter === 'custom' && (
                    <div className="flex items-center gap-1.5 w-full sm:w-auto mt-1 sm:mt-0">
                      <input
                        type="date"
                        className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-indigo-500"
                        value={customDate}
                        onChange={(e) => {
                          setCustomDate(e.target.value);
                          setCurrentPage(1);
                        }}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span>Rows:</span>
                    <select
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 outline-none"
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                    </select>
                  </div>
                </div>

                {/* Audit Items List */}
                {paginatedHistory.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {paginatedHistory.map(entry => {
                      const isExpanded = expandedHistoryId === entry.id;
                      return (
                        <div
                          key={entry.id}
                          className={`rounded-xl border transition overflow-hidden ${isExpanded
                              ? 'bg-slate-950 border-indigo-500/70 shadow-md shadow-indigo-500/10'
                              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                            }`}
                        >
                          {/* Row Header */}
                          <div
                            onClick={() => setExpandedHistoryId(isExpanded ? null : entry.id)}
                            className="flex items-center justify-between p-3 cursor-pointer user-select-none gap-2 hover:bg-slate-900/40 transition"
                          >
                            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                              <span className="font-mono text-xs text-slate-400 whitespace-nowrap">
                                {entry.time}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono tracking-wide ${getStatusBadgeClass(entry.status)}`}>
                                {entry.status}
                              </span>
                              <span className="text-xs font-semibold text-slate-200 truncate max-w-[150px] sm:max-w-none">
                                {entry.source}
                              </span>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className="font-mono text-[11px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                {entry.elapsed}ms
                              </span>
                              <span className="text-xs text-slate-500">
                                {isExpanded ? '▲' : '▼'}
                              </span>
                            </div>
                          </div>

                          {/* Expanded JSON Inspector */}
                          {isExpanded && (
                            <div className="p-3 bg-slate-950 border-t border-slate-800/80 flex flex-col gap-2.5 text-xs">
                              <div>
                                <div className="text-[10px] font-mono uppercase text-slate-400 mb-1 font-semibold">
                                  Sent Request Payload:
                                </div>
                                <pre className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 font-mono text-[11px] text-sky-300 overflow-x-auto max-h-32">
                                  {JSON.stringify(entry.request, null, 2)}
                                </pre>
                              </div>

                              <div>
                                <div className="text-[10px] font-mono uppercase text-slate-400 mb-1 font-semibold">
                                  Server Response ({entry.status}):
                                </div>
                                <pre className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-32">
                                  {JSON.stringify(entry.response, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center py-8 text-xs text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800/60">
                    {auditHistory.length === 0
                      ? 'Audit history is empty. Save settings or trigger a scenario to record history.'
                      : 'No audit records match the selected date filter.'}
                  </p>
                )}

                {/* Pagination Controls */}
                {filteredHistory.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs text-slate-400 mt-1">
                    <div>
                      Showing {(activePage - 1) * itemsPerPage + 1}–{Math.min(activePage * itemsPerPage, filteredHistory.length)} of {filteredHistory.length}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 disabled:pointer-events-none transition"
                        disabled={activePage <= 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      >
                        Previous
                      </button>

                      <span className="px-2 font-mono text-slate-300">
                        {activePage} / {totalPages}
                      </span>

                      <button
                        type="button"
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40 disabled:pointer-events-none transition"
                        disabled={activePage >= totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Concurrency Conflict Resolution Modal (409) */}
      {conflictData && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 p-4 sm:p-5 bg-slate-950/80 border-b border-slate-800">
              <AlertIcon size={26} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Optimistic Concurrency Conflict (409)</h3>
                <p className="text-xs text-slate-400 mt-0.5">Another user or process updated this device while you were editing.</p>
              </div>
            </div>

            <div className="p-4 sm:p-5 flex flex-col gap-3 text-xs">
              <p className="text-slate-300">
                Your edit expected <strong className="font-mono text-amber-400">v{conflictData.clientReq.expectedVersion}</strong>, but the remote record is now at <strong className="font-mono text-sky-400">v{conflictData.serverRecord.version}</strong>.
              </p>

              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <th className="p-2.5 font-semibold">Field</th>
                      <th className="p-2.5 font-semibold">Your Pending Edit</th>
                      <th className="p-2.5 font-semibold">Latest Server State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/60 font-mono">
                    <tr>
                      <td className="p-2.5 font-sans font-bold text-slate-300">Version</td>
                      <td className="p-2.5 text-amber-400">v{conflictData.clientReq.expectedVersion} (stale)</td>
                      <td className="p-2.5 text-sky-400">v{conflictData.serverRecord.version} (latest)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-sans font-bold text-slate-300">Language</td>
                      <td className="p-2.5 text-amber-400">
                        {conflictData.clientReq.settings.language ?? <em className="font-sans text-slate-500">omitted</em>}
                      </td>
                      <td className="p-2.5 text-sky-400">{conflictData.serverRecord.settings.language}</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-sans font-bold text-slate-300">Volume</td>
                      <td className="p-2.5 text-amber-400">
                        {conflictData.clientReq.settings.volume ?? <em className="font-sans text-slate-500">omitted</em>}
                      </td>
                      <td className="p-2.5 text-sky-400">{conflictData.serverRecord.settings.volume}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 p-4 bg-slate-950/80 border-t border-slate-800">
              <button
                type="button"
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition"
                onClick={() => {
                  setServerRecord(conflictData.serverRecord);
                  setFormLang(conflictData.serverRecord.settings.language);
                  setFormVol(conflictData.serverRecord.settings.volume);
                  setConflictData(null);
                  addToast('Discarded local changes and synced with server state.', 'info');
                }}
              >
                Discard Mine & Load Server State
              </button>
              <button
                type="button"
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-md shadow-indigo-500/25"
                onClick={() => {
                  const updatedPayload = {
                    ...conflictData.clientReq,
                    expectedVersion: conflictData.serverRecord.version
                  };
                  setConflictData(null);
                  addToast(`Re-submitting with expectedVersion: ${conflictData.serverRecord.version}...`, 'info');
                  handleSave(updatedPayload, 'Conflict Overwrite');
                }}
              >
                Adopt New Version (v{conflictData.serverRecord.version}) & Overwrite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Shelf */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`p-3 rounded-xl text-xs font-medium shadow-lg border animate-in slide-in-from-bottom duration-200 ${t.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
                : t.type === 'error'
                  ? 'bg-rose-950/90 text-rose-200 border-rose-800'
                  : t.type === 'warning'
                    ? 'bg-amber-950/90 text-amber-200 border-amber-800'
                    : 'bg-sky-950/90 text-sky-200 border-sky-800'
              }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
