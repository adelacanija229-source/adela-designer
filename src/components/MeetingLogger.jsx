import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { offlineStore, STORES } from '../db/offlineStore';
import { Plus, Trash2, Save, Calendar, Edit2, Printer, AlertCircle, GitBranch, Clock, CheckCircle, List } from 'lucide-react';

// Auto-derive status: if pending content exists → '보류', else if decision exists → '완료', else → '검토'
const deriveStatus = (agenda) => {
    if ((agenda.pending || '').trim()) return '보류';
    if ((agenda.decision || '').trim()) return '완료';
    return '검토';
};

const TRADE_CATEGORIES = [
    '구조 미팅', '도장 공사', '도배공사', '바닥공사', '확장공사', '창호공사',
    '가구공사', '욕실공사', '목공공사', '전기조명', '타일공사',
    '철거공사', '설비공사', '기타공사', '에어콘공사', '래핑공사',
    '배관청소', '준공청소', '특별 안건'
];

const STATUS_CONFIG = {
    '완료': { label: '결정 완료', bg: 'var(--status-success-bg)', color: 'var(--status-success)', icon: <CheckCircle size={12} /> },
    '보류': { label: '보류중', bg: 'var(--status-warning-bg)', color: 'var(--status-warning)', icon: <Clock size={12} /> },
    '검토': { label: '미정', bg: 'var(--status-danger-bg)', color: 'var(--status-danger)', icon: <AlertCircle size={12} /> },
};

const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['검토'];
    return (
        <span style={{
            fontSize: '11px', padding: '4px 10px', borderRadius: '20px',
            backgroundColor: cfg.bg, color: cfg.color, fontWeight: '800',
            display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
        }}>
            {cfg.icon} {cfg.label}
        </span>
    );
};

const MeetingLogger = ({ project, onPrint, onHasUnsavedChanges }) => {
    const [logs, setLogs] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [viewMode, setViewMode] = useState('date'); // 'date' | 'topic' | 'structure'
    const [originalData, setOriginalData] = useState(null);

    const emptyForm = {
        date: new Date().toISOString().split('T')[0],
        attendees: '',
        agendas: [{ tradeCategories: [], customTopic: '', decision: '', pending: '' }],
        images: []
    };
    const [formData, setFormData] = useState(emptyForm);

    const loadLogs = useCallback(async () => {
        if (!project?.id) return;
        const all = await offlineStore.getByIndex(STORES.MEETING_LOGS, 'projectId', project.id);
        setLogs(all.sort((a, b) => new Date(b.date) - new Date(a.date)));
    }, [project?.id]);

    useEffect(() => {
        if (project?.id) {
            loadLogs();
            setIsEditing(false);
        }
    }, [project, loadLogs]);

    // Track unsaved changes
    useEffect(() => {
        if (!isEditing || !originalData || !onHasUnsavedChanges) {
            if (onHasUnsavedChanges) onHasUnsavedChanges(false);
            return;
        }
        const isDirty = JSON.stringify(formData) !== JSON.stringify(originalData);
        onHasUnsavedChanges(isDirty);
    }, [formData, originalData, isEditing, onHasUnsavedChanges]);

    const checkUnsavedAndProceed = (callback) => {
        if (!isEditing || !originalData) {
            callback();
            return;
        }
        const isDirty = JSON.stringify(formData) !== JSON.stringify(originalData);
        if (isDirty) {
            if (window.confirm('저장되지 않은 변경 사항이 있습니다. 정말 이동하시겠습니까?\n이동하면 작성 중인 내용은 사라집니다.')) {
                if (onHasUnsavedChanges) onHasUnsavedChanges(false);
                callback();
            }
        } else {
            callback();
        }
    };

    // All pending/review agendas across all logs
    const pendingItems = useMemo(() => {
        const items = [];
        logs.forEach(log => {
            (log.agendas || []).forEach(a => {
                const status = deriveStatus(a);
                if (status === '보류' || status === '검토') {
                    items.push({ ...a, status, logDate: log.date, logId: log.id });
                }
            });
        });
        return items;
    }, [logs]);

    // Group agendas by topic for timeline view
    // normalizeKey: collapse extra spaces + lowercase for matching, so slight spacing/case differences still group together
    const normalizeKey = (str) => (str || '').trim().replace(/\s+/g, ' ').toLowerCase();

    const topicTimeline = useMemo(() => {
        const map = {}; // key → { displayTopic, history, latestStatus }
        [...logs].reverse().forEach(log => {
            (log.agendas || []).forEach(a => {
                const rawTopic = (a.topic || '').trim();
                if (!rawTopic) return;
                const key = normalizeKey(rawTopic);
                const status = deriveStatus(a);
                if (!map[key]) map[key] = { topic: rawTopic, history: [], latestStatus: status };
                map[key].history.push({ ...a, status, logDate: log.date, logId: log.id });
                map[key].latestStatus = status;
                // Prefer the latest (longest or most recent) display name
                if (rawTopic.length > map[key].topic.length) map[key].topic = rawTopic;
            });
        });
        return Object.values(map).sort((a, b) => {
            const order = { '보류': 0, '검토': 1, '완료': 2 };
            return (order[a.latestStatus] ?? 1) - (order[b.latestStatus] ?? 1);
        });
    }, [logs]);

    const structureTimeline = useMemo(() => {
        const map = {};
        [...logs].reverse().forEach(log => {
            (log.agendas || []).forEach(a => {
                if (!(a.tradeCategories || []).includes('구조 미팅') && !normalizeKey(a.topic).includes('구조 미팅')) return;
                
                const rawTopic = (a.topic || '').trim();
                if (!rawTopic) return;
                const key = normalizeKey(rawTopic);
                const status = deriveStatus(a);
                if (!map[key]) map[key] = { topic: rawTopic, history: [], latestStatus: status };
                map[key].history.push({ ...a, status, logDate: log.date, logId: log.id });
                map[key].latestStatus = status;
                if (rawTopic.length > map[key].topic.length) map[key].topic = rawTopic;
            });
        });
        return Object.values(map).sort((a, b) => {
            const order = { '보류': 0, '검토': 1, '완료': 2 };
            return (order[a.latestStatus] ?? 1) - (order[b.latestStatus] ?? 1);
        });
    }, [logs]);

    const handlePrintHistory = (data = topicTimeline, titleSuffix = '안건별 히스토리') => {
        const projectName = project?.name || '현장명 미입력';
        const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
        const STATUS_LABEL = { '완료': '결정 완료', '보류': '보류중', '검토': '미정' };
        const STATUS_COLOR = { '완료': '#6B8E6B', '보류': '#B87C4C', '검토': '#A35050' };
        const STATUS_BG = { '완료': 'rgba(107, 142, 107, 0.15)', '보류': 'rgba(184, 124, 76, 0.15)', '검토': 'rgba(163, 80, 80, 0.15)' };

        const topicsHtml = data.map(group => {
            const headerBg = group.latestStatus === '완료' ? 'rgba(107, 142, 107, 0.05)' : 'rgba(184, 124, 76, 0.05)';
            const borderColor = STATUS_COLOR[group.latestStatus] || '#aaa';

            const entriesHtml = group.history.map((entry, idx) => {
                const isLast = idx === group.history.length - 1;
                const dotColor = STATUS_COLOR[entry.status] || '#aaa';
                return `
                <div style="display:flex;gap:16px;position:relative;">
                  <div style="display:flex;flex-direction:column;align-items:center;width:36px;flex-shrink:0;">
                    <div style="width:10px;height:10px;border-radius:50%;background:${dotColor};border:2px solid white;box-shadow:0 0 0 2px #ccc;margin-top:13px;flex-shrink:0;"></div>
                    ${!isLast ? '<div style="width:2px;flex:1;background:#e5e7eb;margin-top:3px;min-height:20px;"></div>' : ''}
                  </div>
                  <div style="flex:1;padding-bottom:16px;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                      <span style="font-size:11px;font-weight:700;color:#555;">${entry.logDate}</span>
                      <span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${STATUS_BG[entry.status]};color:${dotColor};font-weight:700;">${STATUS_LABEL[entry.status] || entry.status}</span>
                    </div>
                    ${entry.decision ? `<p style="font-size:12.5px;color:#1E40AF;margin:0 0 4px;white-space:pre-wrap;">✅ ${entry.decision}</p>` : ''}
                    ${entry.pending ? `<p style="font-size:12.5px;color:#B45309;margin:0;white-space:pre-wrap;">⏳ ${entry.pending}</p>` : ''}
                  </div>
                </div>`;
            }).join('');

            return `
            <div style="margin-bottom:24px;border:1.5px solid ${borderColor};border-radius:10px;overflow:hidden;page-break-inside:avoid;">
              <div style="padding:12px 20px;background:${headerBg};border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <span style="font-weight:800;font-size:14px;color:#1e293b;">${group.topic}</span>
                  <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:${STATUS_BG[group.latestStatus]};color:${borderColor};font-weight:700;">${STATUS_LABEL[group.latestStatus] || group.latestStatus}</span>
                </div>
                <span style="font-size:11px;color:#888;">${group.history.length}회 논의</span>
              </div>
              <div style="padding:12px 20px;">
                ${entriesHtml}
              </div>
            </div>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>${projectName} - ${titleSuffix}</title>
  <style>
    @page { size: A4; margin: 20mm 18mm; }
    * { box-sizing: border-box; font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
    body { margin: 0; color: #1e293b; font-size: 13px; }
    h1 { font-size: 20px; font-weight: 900; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 6px; }
    .divider { border: none; border-top: 2px solid #e2e8f0; margin: 16px 0 24px; }
  </style>
</head>
<body>
  <h1>${projectName} — ${titleSuffix}</h1>
  <p class="meta">출력일: ${today} &nbsp;|&nbsp; 전체 안건: ${data.length}건 (보류/미정: ${data.filter(t => t.latestStatus !== '완료').length}건)</p>
  <hr class="divider" />
  ${topicsHtml}
</body>
</html>`;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 400);
    };

    const handleStartNew = () => {
        setFormData(emptyForm);
        setOriginalData(emptyForm);
        setEditingId(null);
        setIsEditing(true);
    };

    const handleStartEdit = (log) => {
        const initialForm = {
            date: log.date,
            attendees: log.attendees,
            agendas: log.agendas ? log.agendas.map(a => ({
                tradeCategories: a.tradeCategories || (a.topic ? [a.topic] : []),
                customTopic: a.customTopic || '',
                decision: a.decision || '',
                pending: a.pending || ''
            })) : [{ tradeCategories: [], customTopic: '', decision: '', pending: '' }],
            images: log.images ? [...log.images] : []
        };
        setFormData(initialForm);
        setOriginalData(initialForm);
        setEditingId(log.id);
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const addAgendaRow = () => {
        setFormData({ ...formData, agendas: [...formData.agendas, { tradeCategories: [], customTopic: '', decision: '', pending: '' }] });
    };

    const toggleTradeCategory = (agendaIndex, trade) => {
        const newAgendas = JSON.parse(JSON.stringify(formData.agendas));
        const cats = newAgendas[agendaIndex].tradeCategories || [];
        if (cats.includes(trade)) {
            newAgendas[agendaIndex].tradeCategories = cats.filter(c => c !== trade);
        } else {
            newAgendas[agendaIndex].tradeCategories = [...cats, trade];
        }
        setFormData({ ...formData, agendas: newAgendas });
    };

    const updateAgenda = (index, field, value) => {
        const newAgendas = JSON.parse(JSON.stringify(formData.agendas));
        newAgendas[index][field] = value;
        setFormData({ ...formData, agendas: newAgendas });
    };

    const removeAgenda = (index) => {
        if (formData.agendas.length === 1) return;
        setFormData({ ...formData, agendas: formData.agendas.filter((_, i) => i !== index) });
    };

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        const readPromises = files.map(file => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(file);
        }));
        Promise.all(readPromises).then(base64Images => {
            setFormData(prev => ({ ...prev, images: [...(prev.images || []), ...base64Images] }));
        });
    };

    const removeImage = (index) => {
        setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    };

    const handleSave = async () => {
        const firstAgenda = formData.agendas[0];
        const firstTopic = [...(firstAgenda.tradeCategories || []), firstAgenda.customTopic || ''].filter(Boolean).join(', ');
        if (!formData.date || !firstTopic.trim()) {
            return alert('날짜와 최소 하나의 안건(공종 선택 또는 특별 안건)을 입력해주세요.');
        }
        // Derive topic string for backward compat with timeline display
        const agendas = formData.agendas.map(a => ({
            ...a,
            topic: [...(a.tradeCategories || []), a.customTopic || ''].filter(Boolean).join(', ')
        }));
        const logData = { ...formData, agendas, projectId: project.id };
        if (editingId) logData.id = editingId;
        await offlineStore.save(STORES.MEETING_LOGS, logData);
        setIsEditing(false);
        setEditingId(null);
        setOriginalData(null);
        setFormData(emptyForm);
        if (onHasUnsavedChanges) onHasUnsavedChanges(false);
        loadLogs();
        window.dispatchEvent(new Event('db-updated'));
    };

    const handleCancel = () => {
        checkUnsavedAndProceed(() => {
            setIsEditing(false);
            setEditingId(null);
            setOriginalData(null);
            setFormData(emptyForm);
        });
    };

    const handleDeleteLog = async (id) => {
        if (confirm('이 회의록을 삭제하시겠습니까?')) {
            await offlineStore.delete(STORES.MEETING_LOGS, id);
            loadLogs();
            window.dispatchEvent(new Event('db-updated'));
        }
    };

    return (
        <div className="meeting-logger" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Page Header */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 className="page-title">디자인 미팅 회의록</h2>
                    <p className="page-desc">고객과의 미팅 안건과 결정 사항을 차곡차곡 기록합니다. 보류 사항에 내용이 있으면 자동으로 미결정 이슈로 분류됩니다.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {!isEditing && (
                        <>
                            <button className="btn btn-outline no-print" onClick={onPrint}>
                                <Printer size={16} /> 이 내용 인쇄
                            </button>
                            <button className="btn btn-primary" onClick={handleStartNew}>
                                <Plus size={18} /> 새 회의록 작성
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Pending Issues Dashboard */}
            {!isEditing && pendingItems.length > 0 && (
                <div style={{
                    background: 'var(--bg-base)',
                    border: '1.5px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '0',
                    marginBottom: '40px',
                    boxShadow: 'none'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
                        <div style={{ background: 'var(--accent-deep)', borderRadius: '12px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AlertCircle size={18} color="white" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent-deep)', margin: 0, letterSpacing: '-0.5px' }}>
                                미결정 / 보류 이슈 ({pendingItems.length}건)
                            </h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>미결정 사항이 포함된 안건 리스트입니다. 결정 사항이 입력되면 자동으로 목록에서 제외됩니다.</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {pendingItems.map((item, idx) => (
                            <div key={idx} style={{
                                display: 'flex', alignItems: 'center', gap: '16px',
                                background: 'rgba(255,255,255,0.6)', borderRadius: 'var(--radius-md)',
                                padding: '16px 20px', border: '1px solid var(--border-color)',
                                boxShadow: 'none'
                            }}>
                                <StatusBadge status={item.status} />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-main)', margin: '0 0 2px 0' }}>{item.topic}</p>
                                    {item.pending && (
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>💬 {item.pending}</p>
                                    )}
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--accent-soft)', whiteSpace: 'nowrap', fontWeight: '700' }}>
                                    <Calendar size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                                    {item.logDate}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Edit / New Form */}
            {isEditing && (
                <div className="glass-card" style={{ border: '2.5px solid var(--accent-deep)' }}>
                    <h3 className="card-title" style={{ fontSize: '24px', marginBottom: '8px' }}>{editingId ? '미팅 기록 수정하기' : '새 미팅 기록 작성'}</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        💡 보류 사항에 내용을 입력하면 자동으로 미결정 이슈로 관리됩니다.
                    </p>
                    <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="form-label">미팅 날짜</label>
                            <input type="date" className="form-input" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ flex: 2 }}>
                            <label className="form-label">참석자 (고객 및 담당자)</label>
                            <input className="form-input" value={formData.attendees} onChange={e => setFormData({ ...formData, attendees: e.target.value })} placeholder="홍길동 고객님, 김아델라 디자이너" />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>

                        {formData.agendas.map((agenda, idx) => (
                            <div key={idx} style={{
                                padding: '20px', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px'
                            }}>
                                {/* Agenda Number */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent-deep)' }}>안건 #{idx + 1}</span>
                                    <button
                                        className="btn-icon"
                                        onClick={() => removeAgenda(idx)}
                                        style={{ color: '#EF4444', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '10px', height: '28px', padding: '0 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <Trash2 size={13} /> 삭제
                                    </button>
                                </div>

                                {/* Topic: Trade Chip Buttons */}
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>논의 공종 / 안건 선택 (복수 선택 가능)</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {TRADE_CATEGORIES.map(trade => {
                                            const isChecked = (agenda.tradeCategories || []).includes(trade);
                                            return (
                                                <button
                                                    key={trade}
                                                    type="button"
                                                    onClick={() => toggleTradeCategory(idx, trade)}
                                                    style={{
                                                        padding: '5px 10px', fontSize: '12px', borderRadius: '20px', cursor: 'pointer',
                                                        border: isChecked ? '2px solid var(--accent-deep)' : '1.5px solid var(--border-color)',
                                                        background: isChecked ? 'var(--accent-deep)' : 'var(--surface)',
                                                        color: isChecked ? 'white' : 'var(--text-main)',
                                                        fontWeight: isChecked ? '700' : '500',
                                                        transition: 'all 0.15s'
                                                    }}
                                                >
                                                    {trade}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Decision & Pending */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '12px', color: '#1E40AF' }}>✅ 결정 사항</label>
                                        <textarea
                                            className="form-textarea"
                                            style={{ width: '100%', minHeight: '70px', background: 'var(--surface)', borderColor: 'rgba(46, 125, 50, 0.2)', margin: 0 }}
                                            placeholder="결정된 내용 입력"
                                            value={agenda.decision}
                                            onChange={(e) => updateAgenda(idx, 'decision', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '12px', color: '#B45309' }}>⏳ 보류 사항</label>
                                        <textarea
                                            className="form-textarea"
                                            style={{ width: '100%', minHeight: '70px', background: 'var(--surface)', borderColor: 'rgba(249, 115, 22, 0.2)', margin: 0 }}
                                            placeholder="보류/추후 확인 사항"
                                            value={agenda.pending || ''}
                                            onChange={(e) => updateAgenda(idx, 'pending', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button className="btn btn-outline" style={{ alignSelf: 'flex-start', padding: '10px 20px', fontSize: '14px', marginTop: '8px' }} onClick={addAgendaRow}>
                            <Plus size={16} /> 안건 추가
                        </button>
                    </div>

                    <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={{ fontSize: '14px', margin: 0 }}>제안서 / 시안 이미지 첨부</h4>
                            <label className="btn btn-outline" style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '12px' }}>
                                <Plus size={14} /> 이미지 추가
                                <input type="file" multiple accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                            </label>
                        </div>
                        {formData.images && formData.images.length > 0 ? (
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {formData.images.map((imgUrl, idx) => (
                                    <div key={idx} style={{ position: 'relative', width: '120px', height: '80px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #eee' }}>
                                        <img src={imgUrl} alt={`첨부 이미지 ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        <button onClick={() => removeImage(idx)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(255,0,0,0.8)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>첨부된 이미지가 없습니다.</p>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                        <button className="btn btn-outline" onClick={handleCancel}>취소</button>
                        <button className="btn btn-primary" onClick={handleSave}><Save size={18} /> {editingId ? '수정 완료' : '저장하기'}</button>
                    </div>
                </div>
            )}

            {/* View Toggle */}
            {!isEditing && logs.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                    <button
                        className={`btn ${viewMode === 'date' ? 'btn-primary' : 'btn-outline'}`}
                        style={{ fontSize: '13px' }}
                        onClick={() => setViewMode('date')}
                    >
                        <List size={15} /> 날짜별 보기
                    </button>
                    <button
                        className={`btn ${viewMode === 'topic' ? 'btn-primary' : 'btn-outline'}`}
                        style={{ fontSize: '13px' }}
                        onClick={() => setViewMode('topic')}
                    >
                        <GitBranch size={15} /> 전체 안건별 히스토리
                    </button>
                    <button
                        className={`btn ${viewMode === 'structure' ? 'btn-primary' : 'btn-outline'}`}
                        style={{ fontSize: '13px' }}
                        onClick={() => setViewMode('structure')}
                    >
                        <GitBranch size={15} /> 구조 미팅 히스토리
                    </button>
                    {viewMode === 'topic' && topicTimeline.length > 0 && (
                        <button
                            className="btn btn-outline no-print"
                            style={{ fontSize: '13px', marginLeft: '8px', borderColor: '#2E7D32', color: '#2E7D32' }}
                            onClick={() => handlePrintHistory(topicTimeline, '안건별 히스토리')}
                        >
                            <Printer size={15} /> 히스토리 출력 (A4)
                        </button>
                    )}
                    {viewMode === 'structure' && structureTimeline.length > 0 && (
                        <button
                            className="btn btn-outline no-print"
                            style={{ fontSize: '13px', marginLeft: '8px', borderColor: '#2E7D32', color: '#2E7D32' }}
                            onClick={() => handlePrintHistory(structureTimeline, '구조 미팅 히스토리')}
                        >
                            <Printer size={15} /> 히스토리 출력 (A4)
                        </button>
                    )}
                </div>
            )}

            {logs.length === 0 && !isEditing && (
                <div className="empty-state glass-card">
                    <Calendar size={48} />
                    <h3>회의록이 없습니다.</h3>
                    <p>첫 번째 미팅 기록을 작성해 보세요.</p>
                </div>
            )}

            {/* DATE VIEW */}
            {viewMode === 'date' && !isEditing && logs.map(log => {
                return (
                    <div key={log.id} className="" style={{ marginBottom: '32px', padding: '0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                            <div>
                                <h3 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Calendar size={18} color="var(--primary-red)" /> {log.date} 미팅
                                </h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>참석자: {log.attendees || '미입력'}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => handleStartEdit(log)}
                                    title="회의록 수정"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleDeleteLog(log.id)}
                                    title="회의록 삭제"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F44336', padding: '4px' }}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {log.agendas && log.agendas.map((a, i) => {
                                const status = deriveStatus(a);
                                return (
                                    <div key={i} style={{
                                        display: 'flex', gap: '16px',
                                        backgroundColor: status === '보류' ? '#FFF7ED' : 'var(--bg-base)',
                                        padding: '12px 16px', borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border-color)',
                                        borderLeft: `4px solid ${status === '완료' ? '#2E7D32' : status === '보류' ? '#F97316' : '#EF4444'}`,
                                        alignItems: 'flex-start'
                                    }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>논의 안건</span>
                                            <p style={{ fontSize: '13px', whiteSpace: 'pre-wrap', fontWeight: '600', margin: '2px 0 0', lineHeight: '1.4' }}>{a.topic}</p>
                                        </div>
                                        <div style={{ flex: 1.5, minWidth: 0 }}>
                                            <span style={{ fontSize: '10px', color: '#1E40AF', fontWeight: 'bold' }}>✅ 결정 사항</span>
                                            <p style={{ fontSize: '13px', whiteSpace: 'pre-wrap', color: '#1E40AF', margin: '2px 0 0', lineHeight: '1.4' }}>{a.decision || '-'}</p>
                                        </div>
                                        <div style={{ flex: 1.5, minWidth: 0 }}>
                                            <span style={{ fontSize: '10px', color: '#B45309', fontWeight: 'bold' }}>⏳ 보류 사항</span>
                                            <p style={{ fontSize: '13px', whiteSpace: 'pre-wrap', color: '#B45309', margin: '2px 0 0', lineHeight: '1.4' }}>{a.pending || '-'}</p>
                                        </div>
                                        <div style={{ width: '76px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', paddingTop: '2px' }}>
                                            <StatusBadge status={status} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {log.images && log.images.length > 0 && (
                            <div style={{ marginTop: '16px', borderTop: '1px solid #eee', paddingTop: '16px' }}>
                                <h5 style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>첨부된 제안 이미지</h5>
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                    {log.images.map((imgUrl, idx) => (
                                        <div key={idx} style={{ width: '150px', height: '100px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #eee' }}>
                                            <img src={imgUrl} alt={`첨부 이미지 ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* TOPIC TIMELINE VIEW */}
            {viewMode === 'topic' && !isEditing && (
                <div>
                    {topicTimeline.length === 0 ? (
                        <div className="empty-state glass-card">회의록에 안건이 없습니다.</div>
                    ) : topicTimeline.map((topicGroup, tIdx) => (
                        <div key={tIdx} className="glass-card" style={{ marginBottom: '16px', padding: '0', overflow: 'hidden' }}>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '16px 24px',
                                background: topicGroup.latestStatus === '완료'
                                    ? 'linear-gradient(90deg, #f0fdf4, #dcfce7)'
                                    : 'linear-gradient(90deg, #fffbeb, #fef3c7)',
                                borderBottom: '1px solid var(--border-color)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <GitBranch size={16} color={topicGroup.latestStatus === '완료' ? '#2E7D32' : '#F57F17'} />
                                    <span style={{ fontWeight: '800', fontSize: '15px' }}>{topicGroup.topic}</span>
                                    <StatusBadge status={topicGroup.latestStatus} />
                                </div>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    {topicGroup.history.length}회 논의
                                </span>
                            </div>

                            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '0' }}>
                                {topicGroup.history.map((entry, eIdx) => (
                                    <div key={eIdx} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40px', flexShrink: 0 }}>
                                            <div style={{
                                                width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, marginTop: '14px',
                                                background: entry.status === '완료' ? '#2E7D32' : entry.status === '보류' ? '#F57F17' : '#E65100',
                                                border: '2px solid white', boxShadow: '0 0 0 2px #ddd'
                                            }} />
                                            {eIdx < topicGroup.history.length - 1 && (
                                                <div style={{ width: '2px', flex: 1, background: '#e5e7eb', marginTop: '4px', minHeight: '24px' }} />
                                            )}
                                        </div>
                                        <div style={{ flex: 1, paddingBottom: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Calendar size={11} /> {entry.logDate}
                                                </span>
                                                <StatusBadge status={entry.status} />
                                            </div>
                                            {entry.decision && (
                                                <p style={{ fontSize: '13px', color: '#1E40AF', margin: '0 0 4px', whiteSpace: 'pre-wrap' }}>
                                                    ✅ {entry.decision}
                                                </p>
                                            )}
                                            {entry.pending && (
                                                <p style={{ fontSize: '13px', color: '#B45309', margin: 0, whiteSpace: 'pre-wrap' }}>
                                                    ⏳ {entry.pending}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MeetingLogger;
