import React, { useState, useEffect, useRef } from 'react';
import { Plus, FileText, Trash2, Edit2, Layout, Image as ImageIcon, CheckCircle2, ChevronRight, Save, LayoutGrid, List, Layers, X, Search, Upload } from 'lucide-react';
import { offlineStore, STORES } from '../db/offlineStore';

const ProposalBuilder = ({ project, onPrint, onHasUnsavedChanges }) => {
  const [proposals, setProposals] = useState([]);
  const [activeProposal, setActiveProposal] = useState(null);
  const [isAssetSelectorOpen, setIsAssetSelectorOpen] = useState(false);
  const [assets, setAssets] = useState([]);
  const [targetSectionIndex, setTargetSectionIndex] = useState(null);
  const directUploadRef = useRef(null);

  // Track unsaved changes
  useEffect(() => {
    if (activeProposal) {
      onHasUnsavedChanges?.(true);
    } else {
      onHasUnsavedChanges?.(false);
    }
  }, [activeProposal, onHasUnsavedChanges]);

  // Filter components for asset selector
  const [searchTerm, setSearchTerm] = useState('');
  const [activeType, setActiveType] = useState('space');

  const loadProposals = async () => {
    if (!project?.id) return;
    try {
      const data = await offlineStore.getByIndex(STORES.PROPOSALS, 'projectId', project.id);
      setProposals(data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
    } catch (err) {
      console.error('Failed to load proposals', err);
    }
  };

  const loadAssets = async () => {
    try {
      const data = await offlineStore.getAll(STORES.ASSET_LIBRARY);
      setAssets(data);
    } catch (err) {
      console.error('Failed to load assets', err);
    }
  };

  useEffect(() => {
    loadProposals();
    loadAssets();
  }, [project?.id]);

  const handleCreateNew = () => {
    const newProposal = {
      id: crypto.randomUUID(),
      projectId: project.id,
      title: `${project.name} 공간 제안서`,
      sections: [
        { id: crypto.randomUUID(), type: 'space', name: '거실', assets: [], memo: '' }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setActiveProposal(newProposal);
  };

  const handleSave = async () => {
    if (!activeProposal) return;
    try {
      const toSave = { ...activeProposal, updatedAt: new Date().toISOString() };
      await offlineStore.save(STORES.PROPOSALS, toSave);
      await loadProposals();
      onHasUnsavedChanges?.(false);
      setActiveProposal(null);
      alert('제안서가 저장되었습니다.');
    } catch (err) {
      console.error('Save failed', err);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const addSection = (type) => {
    const newSection = {
      id: crypto.randomUUID(),
      type: type, // 'space' or 'item'
      name: type === 'space' ? '신규 공간' : '신규 아이템',
      assets: [],
      memo: ''
    };
    setActiveProposal(prev => ({
      ...prev,
      sections: [...prev.sections, newSection]
    }));
  };

  const removeSection = (id) => {
    setActiveProposal(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== id)
    }));
  };

  const updateSection = (id, field, value) => {
    setActiveProposal(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
  };

  const openAssetSelector = (sectionIndex) => {
    setTargetSectionIndex(sectionIndex);
    setIsAssetSelectorOpen(true);
  };

  const selectAsset = (asset) => {
    if (targetSectionIndex === null) return;
    
    setActiveProposal(prev => {
      const newSections = [...prev.sections];
      const section = newSections[targetSectionIndex];
      // Avoid duplicates
      if (!section.assets.some(a => a.id === asset.id)) {
        section.assets = [...section.assets, { id: asset.id, image: asset.image, name: asset.name }];
      }
      return { ...prev, sections: newSections };
    });
    setIsAssetSelectorOpen(false);
  };

  const handleDirectUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || targetSectionIndex === null) return;

    // Image compression helper
    const compressImage = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_SIZE = 1200;

            if (width > height) {
              if (width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
              }
            } else {
              if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8)); // 80% quality
          };
        };
      });
    };

    try {
      const compressedData = await compressImage(file);
      setActiveProposal(prev => {
        const newSections = [...prev.sections];
        newSections[targetSectionIndex].assets = [
          ...newSections[targetSectionIndex].assets, 
          { id: crypto.randomUUID(), image: compressedData, name: file.name }
        ];
        return { ...prev, sections: newSections };
      });
      if (directUploadRef.current) directUploadRef.current.value = '';
    } catch (err) {
      console.error('Upload failed', err);
      alert('이미지 처리 중 오류가 발생했습니다.');
    }
  };

  const removeAssetFromSection = (sectionIndex, assetId) => {
    setActiveProposal(prev => {
      const newSections = [...prev.sections];
      newSections[sectionIndex].assets = newSections[sectionIndex].assets.filter(a => a.id !== assetId);
      return { ...prev, sections: newSections };
    });
  };

  if (!activeProposal) {
    return (
      <div className="view-container">
        <div className="view-header">
          <div className="header-left">
            <h2>제안서 제작</h2>
            <p className="subtitle">라이브러리의 데이터를 활용하여 맞춤형 인테리어 제안서를 작성합니다.</p>
          </div>
          <button className="btn btn-primary" onClick={handleCreateNew}>
            <Plus size={16} /> 새 제안서 작성
          </button>
        </div>

        <div className="proposals-list" style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {proposals.map(p => (
            <div key={p.id} className="proposal-card" style={{
              background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ background: '#f1f5f9', padding: '8px', borderRadius: '12px', color: '#64748b' }}>
                  <FileText size={20} />
                </div>
                <button 
                  onClick={async () => {
                    if (window.confirm('정말 삭제하시겠습니까?')) {
                      await offlineStore.delete(STORES.PROPOSALS, p.id);
                      loadProposals();
                    }
                  }}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700' }}>{p.title}</h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>마지막 수정: {new Date(p.updatedAt).toLocaleDateString()}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button className="btn btn-outline" style={{ flex: 1, fontSize: '13px' }} onClick={() => setActiveProposal(p)}>
                  <Edit2 size={14} /> 편집하기
                </button>
                <button className="btn btn-outline" style={{ flex: 1, fontSize: '13px' }} onClick={() => onPrint(p)}>
                  <Layout size={14} /> PDF 미리보기
                </button>
              </div>
            </div>
          ))}
          {proposals.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '80px', textAlign: 'center', background: 'white', border: '2px dashed #e2e8f0', borderRadius: '20px', color: '#94a3b8' }}>
              <Layers size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
              <p>아직 작성된 제안서가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      <div className="view-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', padding: '20px 0' }}>
        <div className="header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px', marginBottom: '4px' }}>
            <span>제안서 제작</span> <ChevronRight size={14} /> <span>{project.name}</span>
          </div>
          <input 
            type="text" value={activeProposal.title} onChange={(e) => setActiveProposal(prev => ({ ...prev, title: e.target.value }))}
            style={{ fontSize: '24px', fontWeight: '800', border: 'none', background: 'transparent', width: '100%', outline: 'none', padding: 0 }}
          />
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={() => {
            if (activeProposal.sections.some(s => s.assets.length > 0) || activeProposal.title !== `${project.name} 공간 제안서`) {
              if (!window.confirm('작성 중인 내용이 있습니다. 취소하시겠습니까?')) return;
            }
            onHasUnsavedChanges?.(false);
            setActiveProposal(null);
          }}>취소</button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} /> 저장 및 완료
          </button>
        </div>
      </div>

      <div className="proposal-canvas" style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '100px' }}>
        {activeProposal.sections.map((section, idx) => (
          <div key={section.id} className="proposal-section" style={{
            background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#2563eb', background: '#eff6ff', padding: '4px 8px', borderRadius: '6px' }}>
                  {section.type === 'space' ? 'SPACE' : 'ITEM'}
                </span>
                <input 
                  type="text" value={section.name} onChange={(e) => updateSection(section.id, 'name', e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontWeight: '700', fontSize: '15px', outline: 'none' }}
                />
              </div>
              <button onClick={() => removeSection(section.id)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: '24px' }}>
              <div className="section-images" style={{ 
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' 
              }}>
                {section.assets.map(asset => (
                  <div key={asset.id} style={{ height: '140px', borderRadius: '12px', overflow: 'hidden', position: 'relative', border: '1px solid #f1f5f9' }}>
                    <img src={asset.image} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button 
                      onClick={() => removeAssetFromSection(idx, asset.id)}
                      style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => openAssetSelector(idx)}
                  style={{ 
                    height: '140px', borderRadius: '12px', border: '2px dashed #e2e8f0', background: '#f8fafc', color: '#94a3b8',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer'
                  }}
                >
                  <Plus size={24} />
                  <span style={{ fontSize: '12px', fontWeight: '600' }}>라이브러리에서 추가</span>
                </button>
                <button 
                  onClick={() => { setTargetSectionIndex(idx); directUploadRef.current?.click(); }}
                  style={{ 
                    height: '140px', borderRadius: '12px', border: '2px dashed #e2e8f0', background: '#f8fafc', color: '#94a3b8',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer'
                  }}
                >
                  <Upload size={24} />
                  <span style={{ fontSize: '12px', fontWeight: '600' }}>파일 직접 업로드</span>
                </button>
              </div>
              
              <div className="section-memo">
                <textarea 
                  value={section.memo} onChange={(e) => updateSection(section.id, 'memo', e.target.value)}
                  placeholder="디자인 의도나 특이사항을 입력해 주세요 (두께, 브랜드, 컬러 등 요약 권장)"
                  rows={3}
                  style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9', background: '#fdfdfd', resize: 'none', fontSize: '14px' }}
                />
              </div>
            </div>
          </div>
        ))}
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '10px' }}>
          <button className="btn btn-outline" style={{ borderRadius: '30px', padding: '12px 24px' }} onClick={() => addSection('space')}>
            <LayoutGrid size={18} /> 공간 섹션 추가
          </button>
          <button className="btn btn-outline" style={{ borderRadius: '30px', padding: '12px 24px' }} onClick={() => addSection('item')}>
            <Plus size={18} /> 아이템 섹션 추가
          </button>
        </div>
      </div>

      <input type="file" ref={directUploadRef} onChange={handleDirectUpload} style={{ display: 'none' }} accept="image/*" />

      {/* Asset Selection Modal */}
      {isAssetSelectorOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 3000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="modal-content" style={{
            background: '#f8fafc', width: '90%', maxWidth: '850px', height: '85vh',
            borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ padding: '24px 32px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>라이브러리 자산 선택</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>제안서에 삽입할 공간 사례 또는 자재를 선택하세요.</p>
              </div>
              <button onClick={() => setIsAssetSelectorOpen(false)} style={{ background: '#f1f5f9', border: 'none', padding: '10px', borderRadius: '50%', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ padding: '20px 32px', background: 'white', display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                <button 
                  onClick={() => setActiveType('space')}
                  style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: activeType === 'space' ? 'white' : 'transparent', fontWeight: activeType === 'space' ? '700' : '400' }}
                >공간</button>
                <button 
                  onClick={() => setActiveType('material')}
                  style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: activeType === 'material' ? 'white' : 'transparent', fontWeight: activeType === 'material' ? '700' : '400' }}
                >자재</button>
                <button 
                  onClick={() => setActiveType('inbox')}
                  style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: activeType === 'inbox' ? 'white' : 'transparent', fontWeight: activeType === 'inbox' ? '700' : '400' }}
                >미분류</button>
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#cbd5e1' }} />
                <input 
                  type="text" placeholder="검색어 입력..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '8px 36px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
              {assets
                .filter(a => a.type === activeType)
                .filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.description.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(asset => (
                  <div key={asset.id} onClick={() => selectAsset(asset)} className="selector-item" style={{
                    background: 'white', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', border: '2px solid transparent', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }} onMouseOver={(e) => e.currentTarget.style.borderColor = '#2563eb'} onMouseOut={(e) => e.currentTarget.style.borderColor = 'transparent'}>
                    <div style={{ height: '120px' }}>
                      <img src={asset.image} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ padding: '10px' }}>
                      <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: '700', marginBottom: '4px', display: 'block' }}>{asset.category}</span>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.name}</h4>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProposalBuilder;
