import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Image as ImageIcon, Download, Upload, Filter, X, Save, FolderOpen, Box, Inbox, MoveRight } from 'lucide-react';
import { offlineStore, STORES } from '../db/offlineStore';

const ASSET_TYPES = [
  { id: 'space', label: '공간별 사례', icon: <FolderOpen size={18} /> },
  { id: 'material', label: '자재/아이템', icon: <Box size={18} /> },
  { id: 'inbox', label: '미분류(Inbox)', icon: <Inbox size={18} /> }
];

const SPACE_CATEGORIES = ['전체', '현관', '거실', '주방', '욕실', '안방', '자녀방', '드레스룸', '발코니', '기타'];
const MATERIAL_CATEGORIES = ['전체', '타일', '마루', '도배', '필름', '조명', '하드웨어', '가구', '수전/도기', '기타'];

const AssetManager = () => {
  const [assets, setAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [activeType, setActiveType] = useState('space');
  const [activeCategory, setActiveCategory] = useState('전체');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    type: 'space',
    category: '거실',
    name: '',
    description: '',
    image: null,
    tags: ''
  });

  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);

  const loadAssets = async () => {
    try {
      const data = await offlineStore.getAll(STORES.ASSET_LIBRARY);
      setAssets(data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
    } catch (err) {
      console.error('Failed to load assets', err);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  useEffect(() => {
    let result = assets.filter(a => a.type === activeType);
    
    if (activeType !== 'inbox' && activeCategory !== '전체') {
      result = result.filter(a => a.category === activeCategory);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(a => 
        a.name?.toLowerCase().includes(lower) || 
        a.description?.toLowerCase().includes(lower) ||
        a.tags?.toLowerCase().includes(lower)
      );
    }
    setFilteredAssets(result);
  }, [assets, activeType, activeCategory, searchTerm]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("이미지는 5MB 이하로 업로드해주세요.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, image: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.image) {
      alert('이미지는 필수입니다.');
      return;
    }

    try {
      const itemToSave = {
        ...formData,
        id: editingItem ? editingItem.id : undefined,
      };
      await offlineStore.save(STORES.ASSET_LIBRARY, itemToSave);
      await loadAssets();
      closeModal();
    } catch (err) {
      console.error('Failed to save asset', err);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      try {
        await offlineStore.delete(STORES.ASSET_LIBRARY, id);
        await loadAssets();
      } catch (err) {
        console.error('Delete failed', err);
      }
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      type: item.type || 'space',
      category: item.category || '거실',
      name: item.name || '',
      description: item.description || '',
      image: item.image || null,
      tags: item.tags || ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({
      type: activeType,
      category: activeType === 'space' ? '거실' : '타일',
      name: '', description: '', image: null, tags: ''
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExportAll = () => {
    const dataStr = JSON.stringify(assets, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ADELA_Asset_Library_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedData = JSON.parse(text);
      if (Array.isArray(importedData)) {
        for (const item of importedData) {
          await offlineStore.save(STORES.ASSET_LIBRARY, item);
        }
        await loadAssets();
        alert('라이브러리를 성공적으로 가져왔습니다.');
      }
    } catch (error) {
      console.error('Import failed', error);
      alert('파일 형식이 올바르지 않습니다.');
    }
    if (importInputRef.current) importInputRef.current.value = '';
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <div className="header-left">
          <h2>개인 라이브러리 (Asset)</h2>
          <p className="subtitle">현장 사례 및 자재 데이터를 체계적으로 관리하여 제안서에 활용합니다.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={() => importInputRef.current?.click()}>
            <Download size={16} /> 가져오기
          </button>
          <input type="file" ref={importInputRef} onChange={handleImport} style={{ display: 'none' }} accept=".json" />
          <button className="btn btn-outline" onClick={handleExportAll}>
            <Upload size={16} /> 전체 내보내기
          </button>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> 새 에셋 등록
          </button>
        </div>
      </div>

      {/*Asset Types Navigation*/}
      <div className="asset-type-tabs" style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        {ASSET_TYPES.map(type => (
          <button
            key={type.id}
            onClick={() => {
              setActiveType(type.id);
              setActiveCategory('전체');
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px',
              border: 'none', background: activeType === type.id ? '#1e293b' : 'transparent',
              color: activeType === type.id ? 'white' : '#64748b', cursor: 'pointer', transition: 'all 0.2s',
              fontWeight: activeType === type.id ? '600' : '400'
            }}
          >
            {type.icon} {type.label}
          </button>
        ))}
      </div>

      <div className="filters-section" style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
          <input 
            type="text" placeholder="명칭, 설명, 태그로 검색..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
        </div>
        
        {activeType !== 'inbox' && (
          <div className="category-tabs" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {(activeType === 'space' ? SPACE_CATEGORIES : MATERIAL_CATEGORIES).map(cat => (
              <button
                key={cat} onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '6px 14px', borderRadius: '20px', border: '1px solid',
                  borderColor: activeCategory === cat ? '#2563eb' : '#e2e8f0',
                  backgroundColor: activeCategory === cat ? '#eff6ff' : 'white',
                  color: activeCategory === cat ? '#1d4ed8' : '#64748b',
                  whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.2s', fontSize: '13px'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="asset-grid" style={{ 
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px', paddingBottom: '40px'
      }}>
        {filteredAssets.map(item => (
          <div key={item.id} className="asset-card" style={{
            background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)', transition: 'all 0.2s'
          }}>
            <div className="asset-image" style={{ height: '160px', background: '#f8fafc', position: 'relative' }}>
              <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div className="asset-actions" style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px' }}>
                <button onClick={() => openEditModal(item)} style={{ background: 'rgba(255,255,255,0.9)', border: 'none', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}>
                  <Edit2 size={14} color="#475569" />
                </button>
                <button onClick={() => handleDelete(item.id)} style={{ background: 'rgba(255,255,255,0.9)', border: 'none', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}>
                  <Trash2 size={14} color="#ef4444" />
                </button>
              </div>
            </div>
            <div className="asset-info" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: '700' }}>{item.category}</span>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>{new Date(item.updatedAt).toLocaleDateString()}</span>
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1e293b', fontWeight: '600' }}>{item.name || '제목 없음'}</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {item.description}
              </p>
              {item.tags && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {item.tags.split(',').map(tag => (
                    <span key={tag} style={{ fontSize: '10px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#475569' }}>#{tag.trim()}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {filteredAssets.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '100px', textAlign: 'center', color: '#94a3b8', background: 'white', borderRadius: '16px', border: '2px dashed #e2e8f0' }}>
            <ImageIcon size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <p style={{ fontSize: '16px' }}>등록된 에셋이 없습니다. 새로운 사진을 등록해보세요!</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="modal-content" style={{
            background: 'white', width: '90%', maxWidth: '700px',
            borderRadius: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>{editingItem ? '에셋 수정' : '새 에셋 등록'}</h3>
              <button onClick={closeModal} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', padding: '8px', borderRadius: '50%' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ padding: '32px', overflowY: 'auto' }}>
              <form id="asset-form" onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>에셋 종류</label>
                    <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                      {ASSET_TYPES.map(t => (
                        <button
                          key={t.id} type="button" onClick={() => setFormData(prev => ({ ...prev, type: t.id }))}
                          style={{
                            flex: 1, padding: '8px', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                            background: formData.type === t.id ? 'white' : 'transparent',
                            color: formData.type === t.id ? '#0f172a' : '#64748b',
                            boxShadow: formData.type === t.id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                            fontWeight: formData.type === t.id ? '700' : '400'
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {formData.type !== 'inbox' && (
                    <div className="form-group">
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>카테고리</label>
                      <select 
                        name="category" value={formData.category} onChange={handleInputChange}
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white' }}
                      >
                        {(formData.type === 'space' ? SPACE_CATEGORIES : MATERIAL_CATEGORIES).filter(c => c !== '전체').map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>제목</label>
                    <input 
                      type="text" name="name" value={formData.name} onChange={handleInputChange}
                      placeholder="예: 거실 아트월 디자인"
                      style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>설명/메모</label>
                    <textarea 
                      name="description" value={formData.description} onChange={handleInputChange}
                      placeholder="시공 디테일이나 특징을 적어주세요." rows={4}
                      style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', resize: 'none' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>태그</label>
                    <input 
                      type="text" name="tags" value={formData.tags} onChange={handleInputChange}
                      placeholder="쉼표로 구분 (예: 모던, 유리블럭, 간접조명)"
                      style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>대표 이미지 *</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    style={{ 
                      flex: 1, minHeight: '300px', borderRadius: '16px', border: '2px dashed #cbd5e1', 
                      background: '#f8fafc', overflow: 'hidden', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
                    }}
                  >
                    {formData.image ? (
                      <img src={formData.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                        <Upload size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                        <p style={{ margin: 0, fontSize: '14px' }}>클릭하여 사진 업로드</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>최대 5MB (JPG, PNG)</p>
                      </div>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
                </div>
              </form>
            </div>

            <div style={{ padding: '24px 32px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#f8fafc' }}>
              <button onClick={closeModal} style={{ padding: '12px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: '600' }}>취소</button>
              <button type="submit" form="asset-form" style={{ padding: '12px 32px', borderRadius: '12px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={18} /> 저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetManager;
