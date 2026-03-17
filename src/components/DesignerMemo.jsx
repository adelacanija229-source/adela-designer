import React, { useState, useEffect, useCallback } from 'react';
import { offlineStore, STORES } from '../db/offlineStore';
import { Save, FileText, CheckCircle } from 'lucide-react';

const DesignerMemo = ({ project }) => {
    const [memoContent, setMemoContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    const loadMemo = useCallback(async () => {
        if (!project?.id) return;
        const memos = await offlineStore.getByIndex(STORES.DESIGNER_MEMOS, 'projectId', project.id);
        if (memos && memos.length > 0) {
            setMemoContent(memos[0].content);
        } else {
            setMemoContent('');
        }
    }, [project?.id]);

    useEffect(() => {
        if (project?.id) {
            loadMemo();
        }
    }, [project?.id, loadMemo]);

    const handleSave = async () => {
        if (!project?.id) {
            alert("선택된 현장 정보가 없습니다. 현장을 먼저 선택하거나 잠시 후 다시 시도해주세요.");
            return;
        }

        setIsSaving(true);
        try {
            const memos = await offlineStore.getByIndex(STORES.DESIGNER_MEMOS, 'projectId', project.id);

            const memoData = {
                projectId: project.id,
                content: memoContent,
                updatedAt: new Date().toISOString()
            };

            if (memos && memos.length > 0) {
                memoData.id = memos[0].id; // Update existing
            } else {
                memoData.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(); // Create new with UUID if possible
            }

            await offlineStore.save(STORES.DESIGNER_MEMOS, memoData);
            setSaveMessage('저장되었습니다.');
            window.dispatchEvent(new Event('memo-updated'));

            setTimeout(() => {
                setSaveMessage('');
            }, 3000);
        } catch (error) {
            console.error("메모 저장 실패:", error);
            alert("저장 중 오류가 발생했습니다. 브라우저 캐시를 삭제하거나 새로고침 후 다시 시도해주세요.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="designer-memo" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '500px' }}>
            <div className="glass-card" style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                flex: 1, 
                border: '1px solid #e2e8f0', 
                background: '#ffffff', 
                padding: '32px', 
                margin: 0,
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid #f1f5f9', paddingBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#0f172a', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={20} color="white" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>
                                Designer Directives
                            </h3>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0', fontWeight: '500' }}>현장 주요 지침 및 지시사항 가이드라인</p>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {saveMessage && (
                            <span style={{ fontSize: '14px', color: '#059669', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                                <CheckCircle size={16} /> {saveMessage}
                            </span>
                        )}
                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{ 
                                background: '#1e293b', 
                                border: 'none', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px',
                                padding: '10px 20px',
                                borderRadius: '10px',
                                fontWeight: '700'
                            }}
                        >
                            <Save size={18} /> {isSaving ? '저장 중...' : '지침 저장하기'}
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                    <textarea
                        className="form-textarea"
                        style={{
                            flex: 1,
                            width: '100%',
                            resize: 'none',
                            fontSize: '17px',
                            fontWeight: '500',
                            lineHeight: '1.8',
                            padding: '10px 0',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#334155',
                            fontFamily: "'Inter', 'Pretendard', system-ui, sans-serif"
                        }}
                        placeholder={`이곳에 현장 중요 지침을 입력하세요.\r\n\r\n주요 포인트:\r\n- 가독성을 위해 문장 앞에 '-' 또는 '•'를 사용하면 좋습니다.\r\n- 숫자(1, 2, 3)를 매겨 순서를 정리할 수도 있습니다.\r\n- 이 내용은 모든 페이지 상단 배너에 상시 노출되어 실수 방지를 돕습니다.`}
                        value={memoContent}
                        onChange={(e) => setMemoContent(e.target.value)}
                    />
                    
                    <div style={{ 
                        marginTop: '20px', 
                        padding: '16px', 
                        background: '#f8fafc', 
                        borderRadius: '12px', 
                        border: '1px solid #f1f5f9',
                        fontSize: '13px',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <div style={{ minWidth: '80px', fontWeight: '800', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pro Tip</div>
                        <p style={{ margin: 0 }}>문장 끝에 마침표를 찍거나 줄바꿈을 적절히 활용하면 상단 배너에서도 더 깔끔하게 보입니다.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DesignerMemo;
