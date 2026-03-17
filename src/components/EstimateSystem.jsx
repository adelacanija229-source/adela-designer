import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, Edit2, Book, Search, Printer } from 'lucide-react';
import { offlineStore, STORES } from '../db/offlineStore';

const EstimateSystem = ({ project, onPrint }) => {
    const [estimates, setEstimates] = useState([]);
    const [loading, setLoading] = useState(true);

    // Library Modal State
    const [showLibrary, setShowLibrary] = useState(false);
    const [libraryItems, setLibraryItems] = useState([]);
    const [libSearch, setLibSearch] = useState('');
    const [libCategory, setLibCategory] = useState('All');
    const [selectedLibItems, setSelectedLibItems] = useState(new Set());

    const loadLibrary = async () => {
        const data = await offlineStore.getAll(STORES.PRICE_LIBRARY);
        setLibraryItems(data || []);
    };

    const loadEstimates = async () => {
        if (!project?.id) return;
        setLoading(true);
        try {
            const list = await offlineStore.getByIndex(STORES.ESTIMATES, 'projectId', project.id);
            setEstimates(list);
        } catch (error) {
            console.error('Failed to load estimates:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (project?.id) {
            loadEstimates();
        }
    }, [project]);

    useEffect(() => {
        if (showLibrary) {
            loadLibrary();
        }
    }, [showLibrary]);

    const addItem = async () => {
        const newItem = {
            projectId: project.id,
            category: '공종 선택',
            itemName: '',
            spec: '',
            unit: 'm2',
            quantity: 0,
            unitPrice: 0,
            status: 'maintain', // 'maintain' | 'add' | 'remove' | 'change'
            isBaseline: false,
            remarks: ''
        };
        const saved = await offlineStore.save(STORES.ESTIMATES, newItem);
        setEstimates([...estimates, saved]);
        window.dispatchEvent(new Event('db-updated'));
    };

    const updateItem = async (id, field, value) => {
        const updated = estimates.map(item => {
            if (item.id === id) {
                const newItem = { ...item, [field]: value };
                // Auto-sync with DB (debounce could be added later)
                offlineStore.save(STORES.ESTIMATES, newItem);
                return newItem;
            }
            return item;
        });
        setEstimates(updated);
        window.dispatchEvent(new Event('db-updated'));
    };

    const deleteItem = async (id) => {
        if (window.confirm('항목을 삭제하시겠습니까?')) {
            await offlineStore.delete(STORES.ESTIMATES, id);
            setEstimates(estimates.filter(item => item.id !== id));
            window.dispatchEvent(new Event('db-updated'));
        }
    };

    const handleAddFromLibrary = async () => {
        const selected = libraryItems.filter(item => selectedLibItems.has(item.id));
        let addedParams = [];
        for (const libItem of selected) {
            let itemRemarks = '';
            const parts = [];
            if (libItem.company) parts.push(`[${libItem.company}]`);
            if (libItem.note) parts.push(libItem.note);
            if (parts.length > 0) itemRemarks = parts.join(' ');

            const newItem = {
                projectId: project.id,
                category: libItem.category,
                itemName: libItem.name,
                spec: libItem.spec,
                unit: libItem.unit,
                quantity: 1, // Defaulting to 1 for convenience
                unitPrice: (libItem.materialPrice || 0) + (libItem.laborPrice || 0),
                status: 'add',
                isBaseline: false,
                remarks: itemRemarks
            };
            const saved = await offlineStore.save(STORES.ESTIMATES, newItem);
            addedParams.push(saved);
        }
        setEstimates([...estimates, ...addedParams]);
        setShowLibrary(false);
        setSelectedLibItems(new Set());
        window.dispatchEvent(new Event('db-updated'));
    };

    const toggleLibSelect = (id) => {
        const newSet = new Set(selectedLibItems);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedLibItems(newSet);
    };

    const calculateTotal = (base, useVat, useOverhead, overheadType, overheadAmount, useDiscount, discountType, discountAmount) => {
        let dc = 0;
        if (useDiscount) {
            dc = discountType === 'percent' ? Math.round(base * ((discountAmount || 0) / 100)) : (discountAmount || 0);
        }
        const afterDc = Math.max(0, base - dc);

        let vat = 0;
        if (useVat) {
            vat = Math.round(afterDc * 0.1);
        }

        let overhead = 0;
        if (useOverhead) {
            overhead = overheadType === 'percent' ? Math.round(afterDc * ((overheadAmount || 0) / 100)) : (overheadAmount || 0);
        }

        return Math.round(afterDc + vat + overhead);
    };

    const initialTotal = calculateTotal(
        project.initialAmount || 0,
        project.useVAT,
        project.useOverhead,
        project.overheadType,
        project.overheadAmount,
        project.useDiscount,
        project.discountType,
        project.discountAmount
    );

    const deltaBase = estimates.reduce((acc, item) => {
        const amount = item.quantity * item.unitPrice;
        if (item.status === 'remove') return acc - amount;
        if (item.status === 'maintain') return acc;
        return acc + amount; // add or change
    }, 0);

    const currentBase = (project.initialAmount || 0) + deltaBase;

    const currentTotal = calculateTotal(
        currentBase,
        project.useVAT,
        project.useOverhead,
        project.overheadType,
        project.overheadAmount,
        project.useDiscount,
        project.discountType,
        project.discountAmount
    );

    const diff = currentTotal - initialTotal;

    if (loading) return <div className="empty-state">데이터를 불러오는 중...</div>;

    return (
        <div className="estimate-system" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 className="page-title">견적 / 변경 관리</h2>
                    <p className="page-desc">최초 계약 대비 변경 내역을 추적하고 승인 현황을 관리합니다.</p>
                </div>
                <button className="btn btn-outline no-print" onClick={onPrint} style={{ backgroundColor: 'white' }}>
                    <Printer size={16} /> 이 내용 인쇄
                </button>
            </div>

            <div className="">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px', padding: '32px', background: 'transparent', borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--border-color)' }}>
                    <div className="summary-item">
                        <span className="label">최초 계약 합계</span>
                        <span className="value" style={{ color: 'var(--text-main)', fontSize: '22px', fontWeight: '900' }}>
                            ₩ {initialTotal.toLocaleString()}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '4px' }}>
                            공급가: {(project.initialAmount || 0).toLocaleString()}원
                            {project.useDiscount ? ` (DC 적용)` : ''}
                        </span>
                    </div>
                    <div className="summary-item" style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
                        <span className="label">현재 제안 합계</span>
                        <span className="value" style={{ color: 'var(--accent-deep)', fontSize: '22px', fontWeight: '900' }}>
                            ₩ {currentTotal.toLocaleString()}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '4px' }}>
                            공급가: {currentBase.toLocaleString()}원
                        </span>
                    </div>
                    <div className="summary-item" style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
                        <span className="label">증감액 (Delta)</span>
                        <span className="value" style={{ color: diff >= 0 ? '#C2410C' : '#0369A1', fontSize: '22px', fontWeight: '900' }}>
                            {diff >= 0 ? '+' : ''} ₩ {diff.toLocaleString()}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500', marginTop: '4px' }}>최초 계약 대비 변동분</span>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px', gap: '10px' }}>
                    <button className="btn btn-outline" onClick={() => setShowLibrary(true)} style={{ borderRadius: '12px' }}>
                        <Book size={18} /> 단가장 열기
                    </button>
                    <button className="btn btn-primary" onClick={addItem} style={{ borderRadius: '12px' }}>
                        <Plus size={18} /> 빈 항목 추가
                    </button>
                </div>

                <div className="estimate-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                    {estimates.map(item => (
                        <div key={item.id} style={{
                            background: item.status === 'add' ? 'rgba(240, 253, 244, 0.5)' : item.status === 'remove' ? 'rgba(254, 242, 242, 0.5)' : 'var(--surface)',
                            border: `1.5px solid ${item.status === 'add' ? '#86EFAC' : item.status === 'remove' ? '#FECACA' : 'var(--border-color)'}`,
                            borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px',
                            boxShadow: 'var(--shadow-soft)',
                            transition: 'var(--transition-main)'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {/* Top Header: Status & Category & Delete */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <select
                                            className="borderless-input"
                                            style={{ width: 'auto', fontWeight: '900', color: 'var(--accent-deep)', padding: '4px 0', cursor: 'pointer', fontSize: '13px' }}
                                            value={item.status}
                                            onChange={(e) => updateItem(item.id, 'status', e.target.value)}
                                        >
                                            <option value="maintain">유지</option>
                                            <option value="add">추가</option>
                                            <option value="remove">삭제</option>
                                            <option value="change">변경</option>
                                        </select>
                                        <div style={{ width: '1px', height: '14px', background: 'var(--border-color)' }}></div>
                                        <select
                                            className="borderless-input"
                                            style={{ fontWeight: '800', color: 'var(--accent-deep)', width: '150px', fontSize: '13px', cursor: 'pointer' }}
                                            value={item.category}
                                            onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                                        >
                                            <option value="" disabled>공종 선택</option>
                                            <option value="도장 공사">도장 공사</option>
                                            <option value="도배공사">도배공사</option>
                                            <option value="바닥공사">바닥공사</option>
                                            <option value="확장공사">확장공사</option>
                                            <option value="창호공사">창호공사</option>
                                            <option value="가구공사">가구공사</option>
                                            <option value="욕실공사">욕실공사</option>
                                            <option value="목공공사">목공공사</option>
                                            <option value="전기조명">전기조명</option>
                                            <option value="타일공사">타일공사</option>
                                            <option value="철거공사">철거공사</option>
                                            <option value="설비공사">설비공사</option>
                                            <option value="기타공사">기타공사</option>
                                            <option value="에어컨공사">에어컨공사</option>
                                            <option value="래핑공사">래핑공사</option>
                                            <option value="배관청소">배관청소</option>
                                            <option value="준공청소">준공청소</option>
                                        </select>
                                    </div>
                                    <button className="btn-icon" style={{ color: '#EF4444', padding: '4px', opacity: 0.5, transition: 'opacity 0.2s' }} onClick={() => deleteItem(item.id)} title="항목 삭제" onMouseOver={(e) => e.currentTarget.style.opacity = '1'} onMouseOut={(e) => e.currentTarget.style.opacity = '0.5'}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                {/* Main Horizontal Input Row */}
                                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '4px' }}>
                                    <div style={{ flex: '2' }}>
                                        <input
                                            className="borderless-input"
                                            style={{ fontSize: '15px', fontWeight: '800', ...(item.status === 'remove' ? { textDecoration: 'line-through', opacity: 0.5 } : {}) }}
                                            placeholder="품명 및 상세 스펙 입력"
                                            value={item.itemName}
                                            onChange={(e) => updateItem(item.id, 'itemName', e.target.value)}
                                        />
                                    </div>
                                    <div style={{ flex: '1' }}>
                                        <input
                                            className="borderless-input"
                                            style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}
                                            placeholder="비고 (선택)"
                                            value={item.remarks}
                                            onChange={(e) => updateItem(item.id, 'remarks', e.target.value)}
                                        />
                                    </div>
                                    <div style={{ width: '60px' }}>
                                        <input
                                            className="borderless-input"
                                            style={{ textAlign: 'center', fontSize: '14px', fontWeight: '700' }}
                                            placeholder="단위"
                                            value={item.unit}
                                            onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                        />
                                    </div>
                                    <div style={{ width: '60px' }}>
                                        <input
                                            type="number"
                                            className="borderless-input"
                                            style={{ textAlign: 'right', fontSize: '15px', fontWeight: '800' }}
                                            placeholder="수량"
                                            value={item.quantity === 0 ? '' : item.quantity}
                                            onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                                            onFocus={(e) => e.target.select()}
                                        />
                                    </div>
                                    <div style={{ width: '120px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700' }}>₩</span>
                                        <input
                                            type="number"
                                            className="borderless-input"
                                            style={{ flex: 1, textAlign: 'right', fontSize: '15px', fontWeight: '800' }}
                                            placeholder="단가"
                                            value={item.unitPrice === 0 ? '' : item.unitPrice}
                                            onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                                            onFocus={(e) => e.target.select()}
                                        />
                                    </div>
                                    <div style={{ width: '140px', textAlign: 'right', fontSize: '16px', fontWeight: '900', color: 'var(--accent-deep)' }}>
                                        ₩ {(item.quantity * item.unitPrice).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Library Modal */}
            {showLibrary && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(125, 110, 102, 0.4)', backdropFilter: 'blur(8px)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'var(--surface)', width: '1000px', maxWidth: '95vw', height: '85vh',
                        borderRadius: '32px', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 32px 64px rgba(0,0,0,0.15)', border: '1px solid var(--border-color)',
                        overflow: 'hidden'
                    }}>
                        <div style={{ padding: '32px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-base)' }}>
                            <div>
                                <h3 style={{ fontSize: '24px', fontWeight: '900', margin: 0, display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent-deep)' }}>
                                    <Book size={24} /> 단가 라이브러리
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)', fontWeight: '500' }}>필요한 품목을 선택하여 견적서에 바로 추가하세요.</p>
                            </div>
                            <button className="btn-icon" onClick={() => setShowLibrary(false)} style={{ background: 'var(--surface)', padding: '12px', borderRadius: '16px' }}><X size={24} /></button>
                        </div>

                        <div style={{ padding: '24px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '16px' }}>
                            <select
                                className="form-input"
                                value={libCategory}
                                onChange={(e) => setLibCategory(e.target.value)}
                                style={{ width: '180px', borderRadius: '12px' }}
                            >
                                <option value="All">전체 카테고리</option>
                                {[...new Set(libraryItems.map(i => i.category))].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>

                            <div style={{ position: 'relative', flex: 1 }}>
                                <Search size={20} style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="품명이나 상세 스펙을 검색하세요..."
                                    style={{ paddingLeft: '48px', width: '100%', borderRadius: '12px' }}
                                    value={libSearch}
                                    onChange={(e) => setLibSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px' }}>
                            <table className="adela-table" style={{ margin: '16px 0' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface)' }}>
                                    <tr>
                                        <th style={{ width: '50px', textAlign: 'center' }}>✓</th>
                                        <th style={{ width: '100px' }}>공종</th>
                                        <th style={{ width: '200px' }}>품명</th>
                                        <th style={{ width: '150px' }}>규격</th>
                                        <th style={{ width: '80px', textAlign: 'center' }}>단위</th>
                                        <th style={{ textAlign: 'right', minWidth: '120px' }}>공급 단가</th>
                                        <th style={{ width: '120px' }}>업체명</th>
                                        <th>특이사항</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {libraryItems.filter(item => {
                                        const c = libCategory === 'All' || item.category === libCategory;
                                        const s = item.name.toLowerCase().includes(libSearch.toLowerCase()) || item.spec.toLowerCase().includes(libSearch.toLowerCase());
                                        return c && s;
                                    }).map(item => (
                                        <tr key={item.id} onClick={() => toggleLibSelect(item.id)} style={{ cursor: 'pointer', background: selectedLibItems.has(item.id) ? 'var(--bg-base)' : 'transparent', transition: 'var(--transition-main)' }}>
                                            <td style={{ textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedLibItems.has(item.id)}
                                                    onChange={() => { }}
                                                    style={{ width: '20px', height: '20px', accentColor: 'var(--accent-deep)' }}
                                                />
                                            </td>
                                            <td><span style={{ background: 'var(--bg-base)', color: 'var(--accent-deep)', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '800' }}>{item.category}</span></td>
                                            <td style={{ fontWeight: '700', color: 'var(--accent-deep)' }}>{item.name}</td>
                                            <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.spec}</td>
                                            <td style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>{item.unit}</td>
                                            <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--accent-deep)' }}>
                                                {((item.materialPrice || 0) + (item.laborPrice || 0)).toLocaleString()}원
                                            </td>
                                            <td style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>{item.company}</td>
                                            <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.note}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ padding: '32px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-base)' }}>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-muted)' }}>
                                선택된 품목: <span style={{ color: 'var(--accent-deep)', fontSize: '20px', fontWeight: '900' }}>{selectedLibItems.size}</span> 개
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button className="btn btn-outline" onClick={() => setShowLibrary(false)} style={{ background: 'var(--surface)' }}>취소</button>
                                <button
                                    className="btn btn-primary"
                                    disabled={selectedLibItems.size === 0}
                                    onClick={handleAddFromLibrary}
                                    style={{ padding: '12px 32px' }}
                                >
                                    선택한 항목 추가하기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .summary-item { display: flex; flex-direction: column; gap: 4px; }
                .summary-item .label { font-size: 13px; color: var(--text-muted); font-weight: 600; }
                .summary-item .value { font-size: 24px; font-weight: 800; }
                
                .status-add { background-color: #f0fff4; }
                .status-remove { background-color: #fff5f5; opacity: 0.8; }
                .status-change { background-color: #f0f7ff; }
                
                .data-table tr.status-add td:first-child { border-left: 4px solid #48bb78; }
                .data-table tr.status-remove td:first-child { border-left: 4px solid #f56565; }
                .data-table tr.status-change td:first-child { border-left: 4px solid #4299e1; }
            `}</style>
        </div>
    );
};

export default EstimateSystem;
