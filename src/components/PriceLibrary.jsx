import React, { useState, useEffect } from 'react';
import { Settings, DownloadCloud, Search, AlertCircle, CheckCircle } from 'lucide-react';
import { STORES, offlineStore } from '../db/offlineStore';

export default function PriceLibrary() {
    const [libUrl, setLibUrl] = useState('');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load URL if saved
            const settings = await offlineStore.getById(STORES.SETTINGS, 'libraryConfig');
            if (settings && settings.url) {
                setLibUrl(settings.url);
            }

            // Load cached library
            const data = await offlineStore.getAll(STORES.PRICE_LIBRARY);
            setItems(data || []);
        } catch (error) {
            console.error('Failed to load library data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveUrl = async () => {
        try {
            await offlineStore.save(STORES.SETTINGS, { id: 'libraryConfig', url: libUrl });
            showMessage('success', '라이브러리 주소가 저장되었습니다.');
        } catch {
            showMessage('error', '주소 저장에 실패했습니다.');
        }
    };

    const handleSync = async () => {
        if (!libUrl) {
            showMessage('error', '웹 앱 URL 주소를 먼저 입력해주세요.');
            return;
        }

        setSyncing(true);
        setMessage(null);

        try {
            const response = await fetch(libUrl, { method: 'GET' });
            if (!response.ok) throw new Error('Network response was not ok');

            const result = await response.json();

            if (result.status === 'success' && Array.isArray(result.data)) {
                // Clear existing library
                const db = await (await import('../db/offlineStore')).initDB();
                const tx = db.transaction(STORES.PRICE_LIBRARY, 'readwrite');
                const store = tx.objectStore(STORES.PRICE_LIBRARY);

                await store.clear(); // Clear old data

                let addedCount = 0;
                for (const row of result.data) {
                    await store.add({
                        id: crypto.randomUUID(),
                        category: row.category || '미분류',
                        name: row.name || '이름 없음',
                        spec: row.spec || '',
                        unit: row.unit || '',
                        materialPrice: Number(row.materialPrice) || 0,
                        laborPrice: Number(row.laborPrice) || 0,
                        company: row.company || '',
                        updateDate: row.updateDate || '',
                        note: row.note || ''
                    });
                    addedCount++;
                }

                await tx.done;

                // 성공적으로 동기화된 버전 정보를 저장하여 App.jsx 배너를 사라지게 함
                if (result.version) {
                    await offlineStore.save(STORES.SETTINGS, {
                        id: 'last_price_sync',
                        version: result.version,
                        date: result.date || new Date().toISOString()
                    });
                }

                showMessage('success', `성공적으로 ${addedCount}개의 단가 데이터를 동기화했습니다!`);
                loadData(); // Reload UI
            } else {
                throw new Error(result.message || '데이터 구조가 올바르지 않습니다.');
            }

        } catch (error) {
            console.error('Sync Error:', error);
            showMessage('error', `동기화 실패: 올바른 구글 웹 앱 URL인지 확인해주세요. (${error.message})`);
        } finally {
            setSyncing(false);
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const filteredItems = items.filter(item => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = item.name.toLowerCase().includes(term) ||
            item.spec.toLowerCase().includes(term) ||
            (item.company && item.company.toLowerCase().includes(term)) ||
            (item.note && item.note.toLowerCase().includes(term));
        const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const uniqueCategories = ['All', ...new Set(items.map(item => item.category))];

    if (loading) return <div className="empty-state">라이브러리 로딩 중...</div>;

    return (
        <div className="price-library" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <h2 className="page-title">단가 라이브러리</h2>
                <p className="page-desc">구글 스프레드시트의 마스터 단가표를 오프라인으로 긁어와(캐싱) 저장합니다.</p>
            </div>

            {/* Settings & Sync Panel */}
            <div className="glass-card" style={{ marginBottom: '24px', background: '#f8f9fa' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px', color: '#555' }}>
                            <Settings size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                            구글 시트 웹 앱 URL 주소 (GET 방식 배포본)
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="https://script.google.com/macros/s/..."
                                value={libUrl}
                                onChange={(e) => setLibUrl(e.target.value)}
                            />
                            <button className="btn btn-outline" onClick={handleSaveUrl}>주소 저장</button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '62px' }}>
                        <button
                            className="btn btn-primary"
                            style={{ padding: '0 24px', height: '38px', minWidth: '160px' }}
                            onClick={handleSync}
                            disabled={syncing}
                        >
                            {syncing ? '동기화 중...' : <><DownloadCloud size={16} /> 최신 단가 캐싱</>}
                        </button>
                    </div>
                </div>

                {message && (
                    <div style={{
                        marginTop: '16px',
                        padding: '12px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: message.type === 'success' ? '#e8f5e9' : '#ffebee',
                        color: message.type === 'success' ? '#2e7d32' : '#c62828',
                        fontSize: '13px',
                        fontWeight: '500'
                    }}>
                        {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                        {message.text}
                    </div>
                )}
            </div>

            {/* Offline Data Table */}
            <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800' }}>
                        내장된 라이브러리 목록
                        <span style={{ fontSize: '13px', color: '#888', fontWeight: 'normal', marginLeft: '8px' }}>
                            (총 {items.length}건)
                        </span>
                    </h3>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <select
                            className="form-select"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            style={{ minWidth: '140px' }}
                        >
                            {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat} ({cat === 'All' ? items.length : items.filter(i => i.category === cat).length})</option>)}
                        </select>

                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#999' }} />
                            <input
                                type="text"
                                className="form-input"
                                placeholder="품명/스펙 검색..."
                                style={{ paddingLeft: '32px', width: '200px' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    <table className="adela-table">
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#fff' }}>
                            <tr>
                                <th className="col-category">공종</th>
                                <th className="col-name">품명</th>
                                <th className="col-spec">규격</th>
                                <th className="col-unit">단위</th>
                                <th className="col-price">자재 단가</th>
                                <th className="col-price">시공 단가</th>
                                <th className="col-company">업체명</th>
                                <th className="col-date">업데이트 일자</th>
                                <th className="col-note">특이사항</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                                        {items.length === 0 ? "동기화된 단가 데이터가 없습니다. 구글 시트를 연동해주세요." : "검색 결과가 없습니다."}
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map(item => (
                                    <tr key={item.id}>
                                        <td className="col-category">
                                            <span className="category-badge">
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="col-name">{item.name}</td>
                                        <td className="col-spec">{item.spec}</td>
                                        <td className="col-unit">{item.unit}</td>
                                        <td className="col-price">{item.materialPrice?.toLocaleString()}</td>
                                        <td className="col-price">{item.laborPrice?.toLocaleString()}</td>
                                        <td className="col-company">{item.company}</td>
                                        <td className="col-date">{item.updateDate}</td>
                                        <td className="col-note">{item.note}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
