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

function AlertIcon({ size = 24, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

  // Initialize audit history from localStorage
  const [auditHistory, setAuditHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('safe_device_settings_audit_history');
      return stored ? JSON.parse(stored) : [];
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
      setAuditHistory(prev => [
        {
          id: Date.now(),
          time: new Date().toLocaleTimeString(),
          status: data.status,
          source,
          elapsed,
          request: payload,
          response: data
        },
        ...prev
      ]);

      if (data.status === 200 && data.record) {
        setServerRecord(data.record);
        setFormLang(data.record.settings.language);
        setFormVol(data.record.settings.volume);
        setInlineErrors({});
        addToast(`Success (200)! Saved version incremented to v${data.record.version}`, 'success');
      } else if (data.status === 409) {
        // Concurrency conflict
        addToast('Concurrency Conflict (409): Record was modified by another actor!', 'warning');
        // Fetch latest server record for side-by-side diff
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

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon">
            <ServerIcon size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <h1 className="brand-title">Safe Device Settings Console</h1>
              <span className="brand-badge">React + Vite</span>
            </div>
            <p className="brand-subtitle">Optimistic Concurrency & Partial Update Validator</p>
          </div>
        </div>

        <div className="header-status">
          <button className="btn btn-secondary" onClick={resetEnvironment} title="Reset server state to PRD baseline">
            <RefreshIcon size={14} />
            Reset State
          </button>
          <div className={`backend-pill ${isBackendOnline ? 'online' : 'offline'}`}>
            <span className="status-dot"></span>
            <span>{isBackendOnline ? `Backend Connected (${API_BASE})` : 'Backend Offline'}</span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="main-content">
        {/* Left Column: Device State & Form */}
        <div className="layout-column">
          {/* Current Saved State Card */}
          <section className="ui-card">
            <div className="ui-card-header">
              <div>
                <span className="eyebrow">PERSISTENT RECORD</span>
                <h2 className="card-title">Saved Device State</h2>
              </div>
              <div className="badge-group">
                <span className="chip chip-device">ID: {serverRecord?.deviceId || '...'}</span>
                <span className="chip chip-site">Site: {serverRecord?.siteId || '...'}</span>
                <span className="chip chip-version">v{serverRecord?.version || '...'}</span>
              </div>
            </div>

            <div className="state-grid">
              <div className="state-item">
                <span className="state-label">Configured Language</span>
                <span className="state-value">{serverRecord ? LANG_MAP[serverRecord.settings.language] || serverRecord.settings.language : '...'}</span>
              </div>

              <div className="state-item">
                <span className="state-label">Audio Volume</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="state-value">{serverRecord?.settings.volume ?? '...'} / 5</span>
                  <div className="volume-bar-track">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`volume-bar-item ${serverRecord && lvl <= serverRecord.settings.volume ? 'active' : ''}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Actor Controls */}
          <section className="ui-card">
            <div className="ui-card-header">
              <div>
                <span className="eyebrow">STEP 1 PERMISSIONS</span>
                <h2 className="card-title">Simulated Actor Identity</h2>
              </div>
            </div>
            <p className="card-description">
              Adjust actor credentials to test permission validation (PRD Step 1: 403 FORBIDDEN).
            </p>

            <div className="form-grid-2">
              <div className="input-group">
                <label className="input-label" htmlFor="actor-role">Role</label>
                <select
                  id="actor-role"
                  className="select-control"
                  value={actorRole}
                  onChange={(e) => setActorRole(e.target.value)}
                >
                  <option value="editor">editor (Authorized)</option>
                  <option value="viewer">viewer (Forbidden - 403)</option>
                  <option value="guest">guest (Forbidden - 403)</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="actor-site">Site ID</label>
                <input
                  id="actor-site"
                  type="text"
                  className="text-control"
                  value={actorSite}
                  onChange={(e) => setActorSite(e.target.value)}
                  placeholder="e.g. S01"
                />
                <span className="input-hint">Must match device site ({serverRecord?.siteId || 'S01'})</span>
              </div>
            </div>
          </section>

          {/* Settings Editor Form */}
          <section className="ui-card">
            <div className="ui-card-header">
              <div>
                <span className="eyebrow">PARTIAL UPDATE EDITOR</span>
                <h2 className="card-title">Device Settings Form</h2>
              </div>
              {hasUnsavedChanges && (
                <span className="chip chip-unsaved">● Unsaved Changes</span>
              )}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              {inlineErrors.general && (
                <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                  {inlineErrors.general}
                </div>
              )}

              {/* Language Section */}
              <div className={`field-card ${hasLangChanged ? 'is-modified' : ''}`}>
                <div className="field-card-header">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={includeLang}
                      onChange={(e) => {
                        setIncludeLang(e.target.checked);
                        setInlineErrors({});
                      }}
                    />
                    <span>Include <strong>language</strong> in update</span>
                  </label>
                  {hasLangChanged && <span className="pill-modified">Modified</span>}
                </div>

                <select
                  className="select-control"
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
                  <div style={{ color: 'var(--color-danger)', fontSize: '0.78rem', marginTop: '0.4rem' }}>
                    {inlineErrors.language}
                  </div>
                )}
              </div>

              {/* Volume Section */}
              <div className={`field-card ${hasVolChanged ? 'is-modified' : ''}`}>
                <div className="field-card-header">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={includeVol}
                      onChange={(e) => {
                        setIncludeVol(e.target.checked);
                        setInlineErrors({});
                      }}
                    />
                    <span>Include <strong>volume</strong> in update</span>
                  </label>
                  {hasVolChanged && <span className="pill-modified">Modified</span>}
                </div>

                <div className="slider-row">
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="1"
                    className="slider-input"
                    value={formVol}
                    disabled={!includeVol}
                    onChange={(e) => {
                      setFormVol(parseInt(e.target.value, 10));
                      setInlineErrors({});
                    }}
                  />
                  <div className="value-pill">{formVol} / 5</div>
                </div>

                <div className="btn-step-group">
                  {[0, 1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      type="button"
                      key={lvl}
                      className={`step-btn ${formVol === lvl ? 'active' : ''}`}
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
                  <div style={{ color: 'var(--color-danger)', fontSize: '0.78rem', marginTop: '0.4rem' }}>
                    {inlineErrors.volume}
                  </div>
                )}
              </div>

              {/* Version & Device Meta Context */}
              <div className="version-context">
                <div>
                  <span className="context-prop">Expected Version:</span>
                  <span className="context-val">v{serverRecord?.version || 3}</span>
                </div>
                <div>
                  <span className="context-prop">Target Device:</span>
                  <span className="context-val">{serverRecord?.deviceId || 'D01'}</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="button-row">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                  aria-busy={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Settings'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!hasUnsavedChanges || isLoading}
                  onClick={() => {
                    if (serverRecord) {
                      setFormLang(serverRecord.settings.language);
                      setFormVol(serverRecord.settings.volume);
                      setInlineErrors({});
                      addToast('Reverted form changes.', 'info');
                    }
                  }}
                >
                  Revert Edits
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Right Column: Scenarios & Inspector */}
        <div className="layout-column">
          {/* Scenario Simulators */}
          <section className="ui-card">
            <div className="ui-card-header">
              <div>
                <span className="eyebrow">EDGE CASES & SCENARIOS</span>
                <h2 className="card-title">Error & Concurrency Simulators</h2>
              </div>
            </div>

            <div className="scenario-list">
              <div className="scenario-card">
                <div className="scenario-info">
                  <h4>Simulate Concurrent Edit (409)</h4>
                  <p>Bumps server version to trigger optimistic concurrency conflict.</p>
                </div>
                <button className="btn btn-warning" onClick={triggerConflictScenario}>
                  Trigger 409 Conflict
                </button>
              </div>

              <div className="scenario-card">
                <div className="scenario-info">
                  <h4>Send Stale Expected Version</h4>
                  <p>Sends update with <code>expectedVersion: 1</code> (409 Conflict).</p>
                </div>
                <button className="btn btn-outline" onClick={triggerStaleVersion}>
                  Send Stale Version
                </button>
              </div>

              <div className="scenario-card">
                <div className="scenario-info">
                  <h4>Target Non-Existent Device</h4>
                  <p>Sends update with <code>deviceId: "D99_UNKNOWN"</code> (404 Not Found).</p>
                </div>
                <button className="btn btn-outline" onClick={triggerWrongDevice}>
                  Test 404 Device
                </button>
              </div>

              <div className="scenario-card">
                <div className="scenario-info">
                  <h4>Inject Illegal Types / Extra Keys</h4>
                  <p>Sends payload with boolean volume and extra top-level key (422).</p>
                </div>
                <button className="btn btn-outline" onClick={triggerMalformed}>
                  Test 422 Payload
                </button>
              </div>
            </div>
          </section>

          {/* Response Inspector & Audit */}
          <section className="ui-card">
            <div className="ui-card-header">
              <div>
                <span className="eyebrow">INSPECTOR & AUDIT</span>
                <h2 className="card-title">Live Response Inspector</h2>
              </div>
            </div>

            <div className="tab-nav">
              <button
                className={`tab-nav-btn ${activeTab === 'last' ? 'active' : ''}`}
                onClick={() => setActiveTab('last')}
              >
                Last Execution
              </button>
              <button
                className={`tab-nav-btn ${activeTab === 'outgoing' ? 'active' : ''}`}
                onClick={() => setActiveTab('outgoing')}
              >
                Live Payload Preview
              </button>
              <button
                className={`tab-nav-btn ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                Audit History ({auditHistory.length})
              </button>
            </div>

            {/* Tab: Last Response */}
            {activeTab === 'last' && (
              <div>
                {lastResponse ? (
                  <div>
                    <div className={`status-card status-${lastResponse.status}`}>
                      <span className="status-badge">{lastResponse.status} {lastResponse.error || 'OK'}</span>
                      <span style={{ fontSize: '0.85rem' }}>
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

                    <div className="code-box">
                      <div className="code-box-header">Response JSON</div>
                      <pre className="code-box-body">{JSON.stringify(lastResponse, null, 2)}</pre>
                    </div>
                  </div>
                ) : (
                  <p style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    No update requests executed yet. Click "Save Settings" or trigger a scenario.
                  </p>
                )}
              </div>
            )}

            {/* Tab: Outgoing Preview */}
            {activeTab === 'outgoing' && (
              <div className="code-box">
                <div className="code-box-header">Outgoing HTTP Body Preview</div>
                <pre className="code-box-body">
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

            {/* Tab: Audit History */}
            {activeTab === 'history' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }}></span>
                    Persisted in Local Storage
                  </span>
                  {auditHistory.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                      onClick={clearHistory}
                    >
                      Clear History
                    </button>
                  )}
                </div>

                {auditHistory.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '340px', overflowY: 'auto' }}>
                    {auditHistory.map(entry => {
                      const isExpanded = expandedHistoryId === entry.id;
                      return (
                        <div
                          key={entry.id}
                          style={{
                            background: 'var(--bg-card-subtle)',
                            border: `1px solid ${isExpanded ? 'var(--border-focus)' : 'var(--border-subtle)'}`,
                            borderRadius: '8px',
                            overflow: 'hidden',
                            transition: 'border-color 0.15s ease'
                          }}
                        >
                          <div
                            onClick={() => setExpandedHistoryId(isExpanded ? null : entry.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.65rem 0.85rem',
                              cursor: 'pointer',
                              userSelect: 'none'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                                {entry.time}
                              </span>
                              <span className={`status-badge status-${entry.status}`}>{entry.status}</span>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{entry.source}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                                {entry.elapsed}ms
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                {isExpanded ? '▲' : '▼'}
                              </span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div style={{ padding: '0.75rem', background: '#090d16', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}>
                              <div style={{ marginBottom: '0.6rem' }}>
                                <div style={{ color: 'var(--text-dim)', marginBottom: '0.2rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontSize: '0.68rem' }}>
                                  Sent Request Payload:
                                </div>
                                <pre style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>
                                  {JSON.stringify(entry.request, null, 2)}
                                </pre>
                              </div>

                              <div>
                                <div style={{ color: 'var(--text-dim)', marginBottom: '0.2rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontSize: '0.68rem' }}>
                                  Server Response ({entry.status}):
                                </div>
                                <pre style={{ fontFamily: 'var(--font-mono)', color: '#a7f3d0', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>
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
                  <p style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    Audit log is empty. Save settings or trigger a scenario to record history.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Concurrency Conflict Resolution Modal (409) */}
      {conflictData && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-top">
              <AlertIcon size={28} color="var(--color-warning)" />
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Optimistic Concurrency Conflict (409)</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Another user or process saved changes while you were editing.
                </p>
              </div>
            </div>

            <div className="modal-content-area">
              <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Your edit expected <strong>v{conflictData.clientReq.expectedVersion}</strong>, but the remote record is now at <strong>v{conflictData.serverRecord.version}</strong>.
              </p>

              <table className="diff-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Your Pending Edit</th>
                    <th>Latest Server State</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Version</strong></td>
                    <td style={{ color: 'var(--color-warning)' }}>v{conflictData.clientReq.expectedVersion} (stale)</td>
                    <td style={{ color: '#38bdf8' }}>v{conflictData.serverRecord.version} (latest)</td>
                  </tr>
                  <tr>
                    <td><strong>Language</strong></td>
                    <td style={{ color: 'var(--color-warning)' }}>
                      {conflictData.clientReq.settings.language ?? <em>omitted</em>}
                    </td>
                    <td style={{ color: '#38bdf8' }}>{conflictData.serverRecord.settings.language}</td>
                  </tr>
                  <tr>
                    <td><strong>Volume</strong></td>
                    <td style={{ color: 'var(--color-warning)' }}>
                      {conflictData.clientReq.settings.volume ?? <em>omitted</em>}
                    </td>
                    <td style={{ color: '#38bdf8' }}>{conflictData.serverRecord.settings.volume}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="modal-bottom">
              <button
                type="button"
                className="btn btn-secondary"
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
                className="btn btn-primary"
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
      <div className="toast-shelf">
        {toasts.map(t => (
          <div key={t.id} className={`toast-bubble ${t.type}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
