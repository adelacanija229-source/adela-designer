import React, { useState, useRef } from 'react';
import { offlineStore, STORES } from '../db/offlineStore';
import { Plus, Save, Trash2, Edit2, Download, Upload, Image as ImageIcon } from 'lucide-react';

const ProjectRegistration = ({ projects, onSaved, onSelect, activeProjectId }) => {
    const [formData, setFormData] = useState({
        name: '',
        client: '',
        address: '',
        designer: '',
        startDate: '',
        endDate: '',
        initialAmount: 0,
        useVAT: false,
        useOverhead: false,
        overheadType: 'amount',
        overheadAmount: 0,
        useDiscount: false,
        discountType: 'amount',
        discountAmount: 0
    });
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const fileInputRef = useRef(null);
    const bgInputRef = useRef(null);
    const [targetBgProjectId, setTargetBgProjectId] = useState(null);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                await offlineStore.importProject(data);
                alert('프로젝트를 성공적으로 가져왔습니다.');
                onSaved();
            } catch (err) {
                console.error(err);
                alert('프로젝트를 가져오는 데 실패했습니다: 올바르지 않은 파일입니다.');
            }
        };
        reader.readAsText(file);
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleBgUploadClick = (projectId, e) => {
        e.stopPropagation();
        setTargetBgProjectId(projectId);
        bgInputRef.current?.click();
    };

    const handleBgFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !targetBgProjectId) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const base64Image = event.target.result;
                const project = projects.find(p => p.id === targetBgProjectId);
                if (project) {
                    await offlineStore.save(STORES.PROJECTS, { ...project, bgImage: base64Image });
                    onSaved();
                }
            } catch (err) {
                console.error(err);
                alert('배경 이미지 저장에 실패했습니다.');
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleExport = async (project, e) => {
        e.stopPropagation();
        try {
            const data = await offlineStore.exportProject(project.id);
            if (!data) return alert('현장 데이터를 찾을 수 없습니다.');

            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `ADELA_현장_${project.name}.json`.replace(/[^a-z0-9가-힣_.-]/gi, '_');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('데이터 내보내기 중 오류가 발생했습니다.');
        }
    };

    const handleStartCreate = () => {
        setFormData({
            name: '', client: '', address: '', designer: '', startDate: '', endDate: '',
            initialAmount: 0, useVAT: false, useOverhead: false, overheadType: 'amount', overheadAmount: 0,
            useDiscount: false, discountType: 'amount', discountAmount: 0
        });
        setEditingId(null);
        setIsCreating(true);
    };

    const handleEdit = (project, e) => {
        e.stopPropagation();
        setFormData({
            name: project.name || '',
            client: project.client || '',
            address: project.address || '',
            designer: project.designer || '',
            startDate: project.startDate || '',
            endDate: project.endDate || '',
            initialAmount: project.initialAmount || 0,
            useVAT: project.useVAT || false,
            useOverhead: project.useOverhead || false,
            overheadType: project.overheadType || 'amount',
            overheadAmount: project.overheadAmount || 0,
            useDiscount: project.useDiscount || false,
            discountType: project.discountType || 'amount',
            discountAmount: project.discountAmount || 0,
            bgImage: project.bgImage || null  // ✅ Preserve uploaded background image
        });
        setEditingId(project.id);
        setIsCreating(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name) return alert('현장 이름을 입력해주세요.');

        const projectData = {
            ...formData,
            status: '진행중'
        };

        if (editingId) {
            projectData.id = editingId;
        }

        const savedItem = await offlineStore.save(STORES.PROJECTS, projectData);

        setFormData({ name: '', client: '', address: '', designer: '', startDate: '', endDate: '' });
        setIsCreating(false);
        setEditingId(null);
        onSaved();

        // Auto-select the newly created or edited project
        if (savedItem && savedItem.id) {
            onSelect(savedItem.id);
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (confirm('이 현장 데이터를 완전히 삭제하시겠습니까? 관련 회의록 및 시방서도 접근이 불가합니다.')) {
            await offlineStore.delete(STORES.PROJECTS, id);
            onSaved();
        }
    };

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 className="page-title">현장 정보 (기본설정)</h2>
                    <p className="page-desc">진행할 현장을 선택하거나 새 현장의 기본 정보를 등록하세요. 등록된 정보는 출력물 헤더에 고정 노출됩니다.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        style={{ display: 'none' }} 
                        accept=".json" 
                        onChange={handleFileChange} 
                    />
                    <input 
                        type="file" 
                        ref={bgInputRef} 
                        style={{ display: 'none' }} 
                        accept="image/*" 
                        onChange={handleBgFileChange} 
                    />
                    <button className="btn btn-outline" onClick={handleImportClick} title="다른 사용자가 저장한 프로젝트 파일을 불러옵니다.">
                        <Download size={18} /> 현장 데이터 가져오기
                    </button>
                    <button className="btn btn-primary" onClick={handleStartCreate}>
                        <Plus size={18} /> 새 현장 등록
                    </button>
                </div>
            </div>

            {isCreating && (
                <div className="glass-card" style={{ border: '2.5px solid var(--accent-deep)', maxWidth: '900px' }}>
                    <h3 className="card-title" style={{ fontSize: '24px', marginBottom: '8px' }}>{editingId ? '현장 정보 수정하기' : '새 현장 기본 정보 입력'}</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="form-grid">
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <label className="form-label" style={{ width: '160px', marginBottom: 0 }}>현장/프로젝트 이름 *</label>
                                <input required className="borderless-input" style={{ flex: 1 }} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="예) 압구정 현대 4차 32평" />
                            </div>
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <label className="form-label" style={{ width: '160px', marginBottom: 0 }}>고객명/의뢰인 연락처</label>
                                <input className="borderless-input" style={{ flex: 1 }} value={formData.client} onChange={e => setFormData({ ...formData, client: e.target.value })} placeholder="홍길동 (010-1234-5678)" />
                            </div>
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <label className="form-label" style={{ width: '160px', marginBottom: 0 }}>현장 상세 주소</label>
                                <input className="borderless-input" style={{ flex: 1 }} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="서울시 강남구 압구정동 XXX-XX" />
                            </div>
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <label className="form-label" style={{ width: '160px', marginBottom: 0 }}>담당 디자이너</label>
                                <input className="borderless-input" style={{ flex: 1 }} value={formData.designer} onChange={e => setFormData({ ...formData, designer: e.target.value })} placeholder="김아델라 실장" />
                            </div>
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <label className="form-label" style={{ width: '160px', marginBottom: 0 }}>예상 착공일</label>
                                <input type="date" className="borderless-input" style={{ flex: 1 }} value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <label className="form-label" style={{ width: '160px', marginBottom: 0 }}>예상 마감일</label>
                                <input type="date" className="borderless-input" style={{ flex: 1 }} value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1', borderTop: '1px dashed var(--border-color)', paddingTop: '24px', marginTop: '16px' }}>
                                <label className="form-label" style={{ color: 'var(--accent-deep)', fontWeight: '900', fontSize: '15px' }}>최초 계약(기본) 견적 정보</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px', background: 'var(--bg-base)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <label className="form-label" style={{ fontSize: '14px', fontWeight: 'bold', width: '130px', marginBottom: '0' }}>직접 공사비</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            style={{ flex: 1, margin: 0, background: 'var(--surface)' }}
                                            value={formData.initialAmount}
                                            onChange={e => setFormData({ ...formData, initialAmount: Number(e.target.value) })}
                                            onFocus={e => e.target.select()}
                                            placeholder="부가세 이전 순수 공사비 입력"
                                        />
                                        <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '700' }}>원</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '130px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold' }}>
                                                <input type="checkbox" checked={formData.useDiscount} onChange={e => setFormData({ ...formData, useDiscount: e.target.checked })} /> DC(할인) 적용
                                            </label>
                                        </div>
                                        {formData.useDiscount ? (
                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <select
                                                    className="form-input"
                                                    style={{ width: '110px', margin: 0, background: 'var(--surface)' }}
                                                    value={formData.discountType}
                                                    onChange={e => setFormData({ ...formData, discountType: e.target.value })}
                                                >
                                                    <option value="amount">금액(원)</option>
                                                    <option value="percent">비율(%)</option>
                                                </select>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    style={{ width: '100%', margin: 0, background: 'var(--surface)' }}
                                                    value={formData.discountAmount}
                                                    onChange={e => setFormData({ ...formData, discountAmount: Number(e.target.value) })}
                                                    onFocus={e => e.target.select()}
                                                    placeholder={formData.discountType === 'percent' ? "비율 입력 (%)" : "금액 입력 (원)"}
                                                />
                                            </div>
                                        ) : (
                                            <div style={{ flex: 1, color: 'var(--text-muted)', fontSize: '13px', paddingLeft: '12px' }}>(미적용)</div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '130px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold' }}>
                                                <input type="checkbox" checked={formData.useOverhead} onChange={e => setFormData({ ...formData, useOverhead: e.target.checked })} /> 공과잡비
                                            </label>
                                        </div>
                                        {formData.useOverhead ? (
                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <select
                                                    className="form-input"
                                                    style={{ width: '110px', margin: 0, background: 'var(--surface)' }}
                                                    value={formData.overheadType}
                                                    onChange={e => setFormData({ ...formData, overheadType: e.target.value })}
                                                >
                                                    <option value="amount">금액(원)</option>
                                                    <option value="percent">비율(%)</option>
                                                </select>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    style={{ width: '100%', margin: 0, background: 'var(--surface)' }}
                                                    value={formData.overheadAmount}
                                                    onChange={e => setFormData({ ...formData, overheadAmount: Number(e.target.value) })}
                                                    onFocus={e => e.target.select()}
                                                    placeholder={formData.overheadType === 'percent' ? "비율 입력 (%)" : "금액 입력 (원)"}
                                                />
                                            </div>
                                        ) : (
                                            <div style={{ flex: 1, color: 'var(--text-muted)', fontSize: '13px', paddingLeft: '12px' }}>
                                                (미적용)
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '130px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold' }}>
                                                <input type="checkbox" checked={formData.useVAT} onChange={e => setFormData({ ...formData, useVAT: e.target.checked })} /> 부가세(10%)
                                            </label>
                                        </div>
                                        <div style={{ flex: 1, color: 'var(--text-muted)', fontSize: '14px', paddingLeft: '12px', fontWeight: '600' }}>
                                            {formData.useVAT ? `+ ₩ ${(() => {
                                                const base = formData.initialAmount || 0;
                                                const dc = formData.useDiscount ? (formData.discountType === 'percent' ? base * ((formData.discountAmount || 0) / 100) : (formData.discountAmount || 0)) : 0;
                                                const afterDc = Math.max(0, base - dc);
                                                return Math.round(afterDc * 0.1).toLocaleString();
                                            })()}` : '(미적용)'}
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '12px', paddingTop: '20px', borderTop: '2px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
                                        <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-muted)' }}>최초 계약 총 합계:</span>
                                        <span style={{ fontSize: '22px', fontWeight: '900', color: 'var(--accent-deep)' }}>
                                            ₩ {(() => {
                                                const base = formData.initialAmount || 0;
                                                const dc = formData.useDiscount ? (formData.discountType === 'percent' ? Math.round(base * ((formData.discountAmount || 0) / 100)) : (formData.discountAmount || 0)) : 0;
                                                const afterDc = Math.max(0, base - dc);
                                                const vat = formData.useVAT ? Math.round(afterDc * 0.1) : 0;
                                                const oh = formData.useOverhead ? (formData.overheadType === 'percent' ? Math.round(afterDc * ((formData.overheadAmount || 0) / 100)) : (formData.overheadAmount || 0)) : 0;
                                                return Math.round(afterDc + vat + oh).toLocaleString();
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: '32px', display: 'flex', gap: '14px', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-outline" onClick={() => { setIsCreating(false); setEditingId(null); }}>취소</button>
                            <button type="submit" className="btn btn-primary"><Save size={20} /> {editingId ? '수정 완료' : '정보 저장'}</button>
                        </div>
                    </form>
                </div>
            )}

            <style>
            {`
                .project-widget {
                    height: 460px;
                    border-radius: 32px;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
                }
                .project-widget:hover {
                    transform: translateY(-6px) scale(1.02);
                    box-shadow: 0 24px 48px rgba(0,0,0,0.2);
                }
                .widget-actions {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    z-index: 10;
                }
                .project-widget:hover .widget-actions {
                    opacity: 1;
                }
                .widget-actions .btn-icon {
                    background: rgba(0,0,0,0.5) !important;
                    color: white !important;
                    backdrop-filter: blur(8px);
                    padding: 10px;
                    border-radius: 14px;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .widget-actions .btn-icon:hover {
                    background: rgba(255,255,255,0.2) !important;
                }
            `}
            </style>
            <div className="project-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px', maxWidth: '1400px' }}>
                {projects.length === 0 && !isCreating && (
                    <div className="empty-state glass-card" style={{ padding: '60px 24px' }}>
                        <p style={{ fontSize: '16px', color: 'var(--text-muted)' }}>아직 등록된 현장이 없습니다. [새 현장 등록] 버튼을 눌러 시작하세요.</p>
                    </div>
                )}

                {projects.map(p => {
                    const isDarkBg = !!p.bgImage;
                    const textColorStyle = isDarkBg ? { color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' } : { color: 'var(--text-main)' };
                    const mutedColorStyle = isDarkBg ? { color: 'rgba(255,255,255,0.8)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' } : { color: 'var(--text-muted)' };
                    
                    return (
                    <div
                        key={p.id}
                        className="glass-card project-widget"
                        style={{
                            marginBottom: 0,
                            cursor: 'pointer',
                            padding: '32px 24px',
                            border: activeProjectId === p.id ? '3px solid var(--primary-red)' : '1px solid rgba(255,255,255,0.2)',
                            background: p.bgImage 
                                ? `linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.1) 100%), url(${p.bgImage}) center/cover` 
                                : (activeProjectId === p.id ? 'var(--bg-base)' : 'var(--surface)'),
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        onClick={() => onSelect(p.id)}
                    >
                        <div className="widget-actions" onClick={e => e.stopPropagation()}>
                            <button className="btn-icon" onClick={(e) => handleBgUploadClick(p.id, e)} title="현장 배경 이미지 설정">
                                <ImageIcon size={18} />
                            </button>
                            <button className="btn-icon" onClick={(e) => handleExport(p, e)} title="팀원에게 공유하기 위해 현장 데이터를 다운로드 합니다.">
                                <Upload size={18} />
                            </button>
                            <button className="btn-icon" onClick={(e) => handleEdit(p, e)} title="현장 수정">
                                <Edit2 size={18} />
                            </button>
                            <button className="btn-icon" onClick={(e) => handleDelete(p.id, e)} title="현장 삭제" style={{ color: '#ff6b6b' }}>
                                <Trash2 size={18} />
                            </button>
                        </div>
                        
                        <div style={{ position: 'relative', zIndex: 2, paddingBottom: '10px' }}>
                            <h3 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '8px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', letterSpacing: '-0.5px', ...textColorStyle }}>
                                {p.name}
                                {activeProjectId === p.id && <span style={{ fontSize: '10px', background: 'var(--primary-red)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontWeight: '800', textShadow: 'none' }}>ACTIVE</span>}
                            </h3>
                            <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px', ...mutedColorStyle }}>C: {p.client || '미입력'} | D: {p.designer || '미배정'}</p>
                            <p style={{ fontSize: '13px', marginTop: '4px', opacity: isDarkBg ? 1 : 0.8, ...mutedColorStyle }}>📍 {p.address || '미입력'}</p>
                        </div>
                    </div>
                )})}
            </div>
        </div>
    );
};

export default ProjectRegistration;
