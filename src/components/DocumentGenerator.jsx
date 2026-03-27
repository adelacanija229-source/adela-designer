import React, { useState, useEffect } from 'react';
import { offlineStore, STORES } from '../db/offlineStore';
import { Printer, FileText, BookOpen, Calculator, ShoppingBag, Layers } from 'lucide-react';
import { ADELA_LOGO_B64 } from '../assets/logo';

const DocumentGenerator = ({ project, isPrintView = false, printMode = 'full', setPrintMode }) => {
    const [logs, setLogs] = useState([]);
    const [estimates, setEstimates] = useState([]);
    const [furniture, setFurniture] = useState([]);
    const [specs, setSpecs] = useState(null);
    const [proposals, setProposals] = useState([]);

    useEffect(() => {
        const loadData = async () => {
            if (!project?.id) return;
            const meetingLogs = await offlineStore.getByIndex(STORES.MEETING_LOGS, 'projectId', project.id);
            setLogs(meetingLogs.sort((a, b) => new Date(b.date) - new Date(a.date)));

            const estList = await offlineStore.getByIndex(STORES.ESTIMATES, 'projectId', project.id);
            setEstimates(estList);

            const furnList = await offlineStore.getByIndex(STORES.FURNITURE, 'projectId', project.id);
            setFurniture(furnList);

            const specList = await offlineStore.getByIndex(STORES.CONSTRUCTION_SPECS, 'projectId', project.id);
            if (specList && specList.length > 0) {
                setSpecs(specList[0]);
            }

            const propList = await offlineStore.getByIndex(STORES.PROPOSALS, 'projectId', project.id);
            setProposals(propList.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
        };

        loadData();

        const handleUpdate = () => {
            loadData();
        };

        window.addEventListener('db-updated', handleUpdate);
        return () => window.removeEventListener('db-updated', handleUpdate);
    }, [project?.id]);

    const handlePrint = () => window.print();

    if (!project?.id) return null;

    const showMeetings = printMode === 'full' || printMode === 'meetings';
    const showEstimates = printMode === 'full' || printMode === 'estimates';
    const showFurniture = printMode === 'full' || printMode === 'furniture';
    const showSpecs = printMode === 'full' || printMode === 'specs';
    const showProposals = printMode === 'full' || printMode === 'proposals';

    const getModeLabel = () => ({
        full: '전체 문서',
        meetings: '디자인 미팅 회의록',
        estimates: '견적 / 변경 관리 내역',
        furniture: '가구 / 별도 계약 내역',
        specs: '공간별 특기 시방서',
        proposals: '공간 디자인 제안서'
    }[printMode]);

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
        return acc + amount;
    }, 0);

    const estBase = (project.initialAmount || 0) + deltaBase;

    const estTotal = calculateTotal(
        estBase,
        project.useVAT,
        project.useOverhead,
        project.overheadType,
        project.overheadAmount,
        project.useDiscount,
        project.discountType,
        project.discountAmount
    );
    const furnTotal = furniture.reduce((acc, item) => acc + item.price, 0);

    const diff = estTotal - initialTotal;

    const estimateImages = Array.isArray(project?.furnitureEstimateImages) ? project.furnitureEstimateImages :
        (project?.furnitureEstimateImage ? [project.furnitureEstimateImage] : []);

    return (
        <div className={isPrintView ? 'print-container' : ''}>
            {!isPrintView && (
                <div style={{ marginBottom: '32px' }}>
                    <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h2 className="page-title">최종 출력물 생성</h2>
                            <p className="page-desc">출력 범위를 선택 후 [인쇄 / PDF 저장]을 누르세요. 인쇄 설정에서 <strong>"배경 그래픽"</strong>을 켜주세요.</p>
                        </div>
                        <button className="btn btn-primary" onClick={handlePrint} style={{ minWidth: '160px' }}>
                            <Printer size={18} /> 인쇄 / PDF 저장
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginTop: '8px' }}>
                        {[
                            { key: 'full', icon: <FileText size={24} />, title: '전체 문서', color: 'var(--primary-red)' },
                            { key: 'meetings', icon: <BookOpen size={24} />, title: '회의록만', color: '#0369A1' },
                            { key: 'estimates', icon: <Calculator size={24} />, title: '견적/변경만', color: '#059669' },
                            { key: 'furniture', icon: <ShoppingBag size={24} />, title: '가구 내역만', color: '#7C3AED' },
                            { key: 'specs', icon: <Layers size={24} />, title: '시방서만', color: '#2563EB' },
                            { key: 'proposals', icon: <Printer size={24} />, title: '제안서만', color: '#DB2777' },
                        ].map(({ key, icon, title, color }) => (
                            <div key={key} onClick={() => setPrintMode(key)} style={{
                                padding: '16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                                border: 'none',
                                background: 'transparent',
                                transition: 'all 0.2s',
                                opacity: printMode === key ? 1 : 0.6
                            }}>
                                <div style={{ color: printMode === key ? color : 'var(--text-muted)', marginBottom: '8px' }}>{icon}</div>
                                <h4 style={{ fontSize: '13px', fontWeight: '700', color: printMode === key ? color : 'var(--text-main)' }}>{title}</h4>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className={!isPrintView ? 'glass-card' : ''} style={{ maxWidth: !isPrintView ? '900px' : '100%', margin: !isPrintView ? '0 auto' : '0', padding: !isPrintView ? '40px' : '0' }}>
                {/* Header */}
                <div style={{ borderBottom: '3px solid var(--primary-red)', paddingBottom: '20px', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>INTERIOR DESIGN DOCUMENT</p>
                            <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)' }}>{project.name}</h1>
                            <p style={{ fontSize: '14px', color: 'var(--primary-red)', fontWeight: '600', marginTop: '4px' }}>{getModeLabel()}</p>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>
                            <p>발행일: {new Date().toLocaleDateString('ko-KR')}</p>
                            <img src={ADELA_LOGO_B64} alt="ADELA DESIGN TEAM" style={{ marginTop: '12px', height: '54px', display: 'block', marginLeft: 'auto' }} />
                        </div>
                    </div>
                </div>

                {/* Meetings */}
                {showMeetings && logs.length > 0 && (
                    <div style={{ marginBottom: '40px' }}>
                        <h2 style={{ fontSize: '16px', borderBottom: '2px solid #0369A1', paddingBottom: '8px', color: '#0369A1', marginBottom: '16px' }}>■ 디자인 미팅 회의록</h2>
                        {logs.map(log => (
                            <div key={log.id} style={{ marginBottom: '20px', border: '1px solid #eee', pageBreakInside: 'avoid' }}>
                                <div style={{ background: '#f8fbfc', padding: '8px 12px', fontWeight: '700', fontSize: '13px' }}>📅 {log.date} (참석: {log.attendees})</div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead><tr style={{ background: '#fafafa' }}>
                                        <th style={{ border: '1px solid #eee', padding: '6px' }}>안건</th>
                                        <th style={{ border: '1px solid #eee', padding: '6px' }}>결정 사항</th>
                                        <th style={{ border: '1px solid #eee', padding: '6px' }}>보류 사항</th>
                                        <th style={{ border: '1px solid #eee', padding: '6px', width: '60px' }}>상태</th>
                                    </tr></thead>
                                    <tbody>{log.agendas.map((a, i) => (
                                        <tr key={i}>
                                            <td style={{ border: '1px solid #eee', padding: '10px', textAlign: 'left', whiteSpace: 'pre-wrap' }}>{a.topic}</td>
                                            <td style={{ border: '1px solid #eee', padding: '10px', textAlign: 'left', fontWeight: '500', color: '#1E40AF', whiteSpace: 'pre-wrap' }}>{a.decision}</td>
                                            <td style={{ border: '1px solid #eee', padding: '10px', textAlign: 'left', fontWeight: '500', color: '#B45309', whiteSpace: 'pre-wrap' }}>{a.pending || '-'}</td>
                                            <td style={{ border: '1px solid #eee', padding: '10px', textAlign: 'center' }}>{a.status}</td>
                                        </tr>
                                    ))}</tbody>
                                </table>

                                {log.images && log.images.length > 0 && (
                                    <div style={{ marginTop: '16px', borderTop: '1px dashed #ccc', paddingTop: '16px' }}>
                                        <h5 style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>[ 첨부된 제안 이미지 ]</h5>
                                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                            {log.images.map((imgUrl, idx) => (
                                                <div key={idx} style={{ flex: '1 1 auto', maxWidth: '30%', border: '1px solid #eee', padding: '4px' }}>
                                                    <img src={imgUrl} alt="회의 첨부 이미지" style={{ width: '100%', height: 'auto', display: 'block' }} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Estimates (Comparison) */}
                {showEstimates && estimates.length > 0 && (
                    <div style={{ marginBottom: '40px' }}>
                        <h2 style={{ fontSize: '16px', borderBottom: '2px solid #059669', paddingBottom: '8px', color: '#059669', marginBottom: '16px' }}>■ 견적 및 변경 내역 추적</h2>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead><tr style={{ background: '#059669', color: 'white' }}>
                                <th style={{ padding: '8px', border: '1px solid #059669' }}>구분</th>
                                <th style={{ padding: '8px', border: '1px solid #059669' }}>공정</th>
                                <th style={{ padding: '8px', border: '1px solid #059669' }}>품목 / 상세 사양</th>
                                <th style={{ padding: '8px', border: '1px solid #059669' }}>단위</th>
                                <th style={{ padding: '8px', border: '1px solid #059669' }}>수량</th>
                                <th style={{ padding: '8px', border: '1px solid #059669' }}>금액 (₩)</th>
                            </tr></thead>
                            <tbody>{estimates.map(item => (
                                <tr key={item.id} style={{
                                    background: item.status === 'add' ? '#f0fff4' : item.status === 'remove' ? '#fff5f5' : 'white',
                                    textDecoration: item.status === 'remove' ? 'line-through' : 'none',
                                    color: item.status === 'remove' ? '#999' : '#000'
                                }}>
                                    <td style={{ border: '1px solid #eee', padding: '8px', textAlign: 'center', fontWeight: '700' }}>
                                        {({ add: '추가', remove: '삭제', change: '변경', maintain: '유지' }[item.status])}
                                    </td>
                                    <td style={{ border: '1px solid #eee', padding: '8px' }}>{item.category}</td>
                                    <td style={{ border: '1px solid #eee', padding: '8px' }}>{item.itemName}</td>
                                    <td style={{ border: '1px solid #eee', padding: '8px', textAlign: 'center' }}>{item.unit}</td>
                                    <td style={{ border: '1px solid #eee', padding: '8px', textAlign: 'center' }}>{item.quantity}</td>
                                    <td style={{ border: '1px solid #eee', padding: '8px', textAlign: 'right', fontWeight: '600' }}>
                                        {(item.quantity * item.unitPrice).toLocaleString()}
                                    </td>
                                </tr>
                            ))}</tbody>
                            <tfoot><tr style={{ background: '#f8faf9', fontWeight: '800' }}>
                                <td colSpan="5" style={{ border: '1px solid #eee', padding: '10px', textAlign: 'right' }}>최종 공서 견적 합계 (가구 제외)</td>
                                <td style={{ border: '1px solid #eee', padding: '10px', textAlign: 'right', color: '#059669' }}>₩ {estTotal.toLocaleString()}</td>
                            </tr></tfoot>
                        </table>
                    </div>
                )}

                {/* Furniture */}
                {showFurniture && (furniture.length > 0 || estimateImages.length > 0) && (
                    <div style={{ marginBottom: '40px', pageBreakBefore: ((showMeetings && logs.length > 0) || (showEstimates && estimates.length > 0)) ? 'always' : 'auto' }}>
                        <h2 style={{ fontSize: '16px', borderBottom: '2px solid #7C3AED', paddingBottom: '8px', color: '#7C3AED', marginBottom: '16px' }}>■ 가구 / 별도 계약 품목</h2>

                        {estimateImages.length > 0 && (
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '14px', marginBottom: '12px', color: '#555', fontWeight: 'bold' }}>[ 첨부 가구 견적서 ]</h3>
                                {estimateImages.map((img, idx) => (
                                    <div key={idx} style={{ border: '1px solid #eee', padding: '12px', borderRadius: '8px', marginBottom: '12px', pageBreakBefore: idx > 0 ? 'always' : 'auto' }}>
                                        <img src={img} style={{ width: '100%', height: 'auto', display: 'block' }} alt={`첨부 가구 견적서 ${idx + 1}`} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {furniture.length > 0 && (
                            <>
                                <h3 style={{ fontSize: '14px', marginBottom: '12px', color: '#555', fontWeight: 'bold', marginTop: estimateImages.length > 0 ? '32px' : '0' }}>[ 개별 가구 사양 ]</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                    {furniture.map(item => (
                                        <div key={item.id} style={{ border: '1px solid #eee', display: 'flex', pageBreakInside: 'avoid' }}>
                                            <div style={{ width: '120px', height: '120px', background: '#f5f5f5' }}>
                                                {item.image && <img src={item.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                            </div>
                                            <div style={{ flex: 1, padding: '10px', fontSize: '11px' }}>
                                                <p style={{ fontWeight: '700', fontSize: '13px', marginBottom: '4px' }}>{item.name}</p>
                                                <p style={{ color: '#666', marginBottom: '8px' }}>{item.spec}</p>
                                                <p style={{ fontWeight: '800', textAlign: 'right', color: '#7C3AED' }}>₩ {item.price.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: '16px', padding: '12px', background: '#f5f3ff', textAlign: 'right', fontWeight: '800', fontSize: '14px', border: '1px solid #ddd' }}>
                                    가구 총 합계: <span style={{ color: '#7C3AED' }}>₩ {furnTotal.toLocaleString()}</span>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Construction Specs */}
                {showSpecs && specs && specs.rooms && specs.rooms.length > 0 && (
                    <div style={{ marginBottom: '40px', pageBreakBefore: ((showMeetings && logs.length > 0) || (showEstimates && estimates.length > 0) || (showFurniture && furniture.length > 0)) ? 'always' : 'auto' }}>
                        <h2 style={{ fontSize: '16px', borderBottom: '2px solid #2563EB', paddingBottom: '8px', color: '#2563EB', marginBottom: '16px' }}>■ 공간별 특기 시방서</h2>
                        
                        {specs.rooms.map(room => (
                            <div key={room.roomId} style={{ marginBottom: '24px', pageBreakInside: 'avoid' }}>
                                <div style={{ background: '#eff6ff', padding: '8px 12px', fontWeight: 'bold', fontSize: '14px', borderLeft: '4px solid #2563EB', marginBottom: '12px', color: '#1e3a8a' }}>
                                    {room.roomName}
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ background: '#fcfcfc', color: '#475569' }}>
                                            <th style={{ border: '1px solid #e2e8f0', padding: '8px', width: '80px' }}>분류</th>
                                            <th style={{ border: '1px solid #e2e8f0', padding: '8px', width: '140px' }}>제품명/자재명</th>
                                            <th style={{ border: '1px solid #e2e8f0', padding: '8px', width: '140px' }}>브랜드/규격</th>
                                            <th style={{ border: '1px solid #e2e8f0', padding: '8px' }}>시공 지침 / 현장 오더</th>
                                            <th style={{ border: '1px solid #e2e8f0', padding: '8px', width: '70px' }}>이미지</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {room.items.length === 0 ? (
                                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '16px', color: '#94a3b8' }}>기록된 시방 내역이 없습니다.</td></tr>
                                        ) : room.items.map(item => (
                                            <tr key={item.itemId}>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'center' }}>{item.category}</td>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '8px', fontWeight: '700', color: '#0f172a' }}>{item.customMaterialDetails.name}</td>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '8px', color: '#475569' }}>
                                                    {item.customMaterialDetails.brand && <span>{item.customMaterialDetails.brand}<br/></span>}
                                                    {item.customMaterialDetails.spec}
                                                </td>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '8px', whiteSpace: 'pre-wrap', color: '#334155' }}>{item.constructionDirectives || '-'}</td>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '4px', textAlign: 'center' }}>
                                                    {item.spaceImage ? <img src={item.spaceImage} alt="Ref" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px', display: 'block', margin: '0 auto' }}/> : <span style={{ color: '#cbd5e1', fontSize: '11px' }}>없음</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                )}

                {/* Proposals */}
                {showProposals && proposals.length > 0 && (
                    <div style={{ marginBottom: '40px', pageBreakBefore: 'always' }}>
                        <h2 style={{ fontSize: '16px', borderBottom: '2px solid #DB2777', paddingBottom: '8px', color: '#DB2777', marginBottom: '16px' }}>■ 공간 디자인 제안서</h2>
                        
                        {proposals.map(prop => (
                            <div key={prop.id} style={{ marginBottom: '32px' }}>
                                <div style={{ background: '#fdf2f8', padding: '10px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#9d174d', margin: 0 }}>{prop.title}</h3>
                                    <span style={{ fontSize: '12px', color: '#be185d' }}>{new Date(prop.updatedAt).toLocaleDateString()}</span>
                                </div>

                                {prop.sections.map((section, sIdx) => (
                                    <div key={section.id} style={{ marginBottom: '24px', pageBreakInside: 'avoid' }}>
                                        <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ background: '#334155', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{section.type.toUpperCase()}</span>
                                            {section.name}
                                        </div>
                                        
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', marginBottom: '12px' }}>
                                            {section.assets.map((asset, aIdx) => (
                                                <div key={aIdx} style={{ border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                                                    <img src={asset.image} alt={asset.name} style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }} />
                                                    <div style={{ padding: '8px', fontSize: '11px', background: '#fafafa', borderTop: '1px solid #eee', textAlign: 'center', color: '#64748b' }}>
                                                        {asset.name}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {section.memo && (
                                            <div style={{ padding: '12px 16px', background: '#f8fafc', borderLeft: '3px solid #cbd5e1', fontSize: '12px', color: '#475569', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                                {section.memo}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {/* Final Summary Footer */}
                {(printMode === 'full' || printMode === 'estimates') && (
                    <div style={{ marginTop: '50px', border: '2px solid var(--text-main)', padding: '24px', borderRadius: '8px', pageBreakInside: 'avoid' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '20px', textAlign: 'center' }}>종합 견적 및 고객 확인</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                            <div>
                                <table style={{ width: '100%', fontSize: '13px' }}>
                                    <tbody>
                                        <tr style={{ height: '30px' }}>
                                            <td>
                                                최초 계약 합계
                                                <span style={{ fontSize: '11px', color: '#666', marginLeft: '8px' }}>
                                                    (공급가: {(project.initialAmount || 0).toLocaleString()}
                                                    {project.useDiscount ? ` - DC: ${project.discountType === 'percent' ? project.discountAmount + '%' : project.discountAmount?.toLocaleString()}` : ''}
                                                    {project.useVAT ? ' + VAT' : ''}
                                                    {project.useOverhead ? ` + 잡비: ${project.overheadType === 'percent' ? project.overheadAmount + '%' : project.overheadAmount?.toLocaleString()}` : ''})
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: '700' }}>₩ {initialTotal.toLocaleString()}</td>
                                        </tr>
                                        <tr style={{ height: '30px', color: diff >= 0 ? '#e53e3e' : '#3182ce' }}>
                                            <td>공사 변경 증감 (Delta)</td>
                                            <td style={{ textAlign: 'right', fontWeight: '700' }}>{diff >= 0 ? '+' : ''} ₩ {diff.toLocaleString()}</td>
                                        </tr>
                                        <tr style={{ height: '30px', borderTop: '1px solid #eee' }}>
                                            <td>
                                                최종 공사비 제안
                                                <span style={{ fontSize: '11px', color: '#666', marginLeft: '8px' }}>
                                                    (공급가: {estBase.toLocaleString()}
                                                    {project.useDiscount ? ` - DC: ${project.discountType === 'percent' ? project.discountAmount + '%' : project.discountAmount?.toLocaleString()}` : ''}
                                                    {project.useVAT ? ' + VAT' : ''}
                                                    {project.useOverhead ? ` + 잡비: ${project.overheadType === 'percent' ? project.overheadAmount + '%' : project.overheadAmount?.toLocaleString()}` : ''})
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: '700' }}>₩ {estTotal.toLocaleString()}</td>
                                        </tr>
                                        <tr style={{ height: '30px' }}><td>가구/별도 합계</td><td style={{ textAlign: 'right', fontWeight: '700' }}>₩ {furnTotal.toLocaleString()}</td></tr>
                                        <tr style={{ height: '45px', borderTop: '2px solid #000', fontSize: '16px' }}>
                                            <td style={{ fontWeight: '800' }}>총 합계 (VAT/잡비 포함)</td>
                                            <td style={{ textAlign: 'right', fontWeight: '900', color: 'var(--primary-red)' }}>₩ {(estTotal + furnTotal).toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ borderLeft: '1px solid #eee', paddingLeft: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>위 변경 내역 및 최종 가구 사양에 대해 고객님께 충분히 설명드렸으며, 이에 동의함을 확인합니다.</p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                                    <div style={{ fontSize: '13px' }}>고객 성명: ________________ (인)</div>
                                    <div style={{ fontSize: '13px' }}>날짜: 202__ . ___ . ___</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentGenerator;
