import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Image as ImageIcon, Download, Upload, Filter, X, Save } from 'lucide-react';
import { offlineStore, STORES } from '../db/offlineStore';

const CATEGORIES = [
  '전체', '도장 공사', '도배공사', '바닥공사', '확장공사', '창호공사', 
  '가구공사', '욕실공사', '목공공사', '전기조명', '타일공사', 
  '철거공사', '설비공사', '기타공사', '에어컨공사', '래핑공사', 
  '배관청소', '준공청소'
];

const MaterialLibrary = () => {
  const [materials, setMaterials] = useState([]);
  const [filteredMaterials, setFilteredMaterials] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('전체');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    category: '도장 공사',
    name: '',
    brand: '',
    productCode: '',
    specifications: '',
    unit: '',
    unitPrice: 0,
    defaultRemarks: '',
    image: null
  });

  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);

  const loadMaterials = async () => {
    try {
      const data = await offlineStore.getAll(STORES.MATERIAL_LIBRARY);
      setMaterials(data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
    } catch (err) {
      console.error('Failed to load materials', err);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  useEffect(() => {
    let result = materials;
    if (activeCategory !== '전체') {
      result = result.filter(m => m.category === activeCategory);
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(m => 
        m.name?.toLowerCase().includes(lower) || 
        m.brand?.toLowerCase().includes(lower) || 
        m.productCode?.toLowerCase().includes(lower)
      );
    }
    setFilteredMaterials(result);
  }, [materials, searchTerm, activeCategory]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("이미지는 2MB 이하로 업로드해주세요.");
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
    if (!formData.name) {
      alert('자재명은 필수입니다.');
      return;
    }

    try {
      const itemToSave = {
        ...formData,
        id: editingItem ? editingItem.id : undefined,
      };
      await offlineStore.save(STORES.MATERIAL_LIBRARY, itemToSave);
      await loadMaterials();
      closeModal();
    } catch (err) {
      console.error('Failed to save material', err);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      try {
        await offlineStore.delete(STORES.MATERIAL_LIBRARY, id);
        await loadMaterials();
      } catch (err) {
        console.error('Delete failed', err);
      }
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      category: item.category || '바닥재',
      name: item.name || '',
      brand: item.brand || '',
      productCode: item.productCode || '',
      specifications: item.specifications || '',
      unit: item.unit || '',
      unitPrice: item.unitPrice || 0,
      defaultRemarks: item.defaultRemarks || '',
      image: item.image || null
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({
      category: '바닥재', name: '', brand: '', productCode: '', specifications: '', unit: '', unitPrice: 0, defaultRemarks: '', image: null
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = (data, filename) => {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    handleExport(materials, 'ADELA_Material_Library_Full');
  };

  const handleExportItem = (item) => {
    handleExport([item], `ADELA_Material_${item.name.replace(/\s+/g, '_')}`);
  };

  const handleExportCategory = () => {
    const categoryData = materials.filter(m => m.category === activeCategory);
    if (categoryData.length === 0) {
      alert('해당 공종에 등록된 자재가 없습니다.');
      return;
    }
    handleExport(categoryData, `ADELA_Material_Category_${activeCategory.replace(/\s+/g, '_')}`);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedData = JSON.parse(text);
      if (Array.isArray(importedData)) {
        for (const item of importedData) {
          // ensure old IDs don't conflict, or maybe they do if we want to overwrite. For simplicity, generate new IDs or overwrite.
          // Let's use save which updates if id exists or creates new.
          await offlineStore.save(STORES.MATERIAL_LIBRARY, item);
        }
        await loadMaterials();
        alert('라이브러리를 성공적으로 가져왔습니다.');
      }
    } catch (error) {
      console.error('Import failed', error);
      alert('파일을 읽는 중 오류가 발생했습니다. 올바른 JSON 파일인지 확인해주세요.');
    }
    if (importInputRef.current) importInputRef.current.value = '';
  };

  return (
    <div className="view-container">
      <div className="view-header">
        <div className="header-left">
          <h2>마감재 라이브러리</h2>
          <p className="subtitle">공간 시방서 작성 시 활용할 마감재 마스터 데이터를 관리합니다.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={() => importInputRef.current?.click()}>
            <Upload size={16} /> 가져오기
          </button>
          <input 
            type="file" 
            ref={importInputRef} 
            onChange={handleImport} 
            style={{ display: 'none' }} 
            accept=".json" 
          />
          <button className="btn btn-outline" onClick={handleExportAll}>
            <Download size={16} /> 전체 내보내기
          </button>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> 새 마감재 등록
          </button>
        </div>
      </div>

      <div className="filters-section" style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
          <input 
            type="text" 
            placeholder="자재명, 브랜드, 품번 검색..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
          />
        </div>
        <div className="category-tabs" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {CATEGORIES.map(cat => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: activeCategory === cat ? '#2563eb' : '#e2e8f0',
                  backgroundColor: activeCategory === cat ? '#eff6ff' : 'white',
                  color: activeCategory === cat ? '#1d4ed8' : '#64748b',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: '13px',
                  fontWeight: activeCategory === cat ? '600' : '400'
                }}
              >
                {cat}
              </button>
              {activeCategory === cat && cat !== '전체' && filteredMaterials.length > 0 && (
                <button 
                  onClick={handleExportCategory}
                  title={`${cat} 공종 내보내기`}
                  style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: '#64748b' }}
                >
                  <Download size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="material-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
        gap: '12px',
        paddingBottom: '40px'
      }}>
        {filteredMaterials.map(item => (
          <div key={item.id} className="material-card" style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}>
            <div className="material-image" style={{ height: '110px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {item.image ? (
                <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <ImageIcon size={32} color="#cbd5e1" />
              )}
              <div style={{ position: 'absolute', top: '4px', right: '4px', display: 'flex', gap: '2px' }}>
                <button 
                  onClick={() => openEditModal(item)}
                  style={{ background: 'white', border: 'none', padding: '4px', borderRadius: '4px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                  title="수정"
                >
                  <Edit2 size={12} color="#475569" />
                </button>
                <button 
                  onClick={() => handleExportItem(item)}
                  style={{ background: 'white', border: 'none', padding: '4px', borderRadius: '4px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                  title="개별 내보내기"
                >
                  <Download size={12} color="#2563eb" />
                </button>
                <button 
                  onClick={() => handleDelete(item.id)}
                  style={{ background: 'white', border: 'none', padding: '4px', borderRadius: '4px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                  title="삭제"
                >
                  <Trash2 size={12} color="#ef4444" />
                </button>
              </div>
            </div>
            <div className="material-info" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: '#2563eb', fontWeight: '600', marginBottom: '2px' }}>{item.category}</div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: '2px', fontSize: '11px', color: '#475569', marginBottom: '6px' }}>
                <span style={{ color: '#94a3b8' }}>브랜드:</span>
                <span style={{ fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.brand || '-'}</span>
                
                <span style={{ color: '#94a3b8' }}>품번:</span>
                <span style={{ fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.productCode || '-'}</span>
                
                <span style={{ color: '#94a3b8' }}>규격:</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.specifications || '-'}</span>
                
                <span style={{ color: '#2563eb' }}>단가:</span>
                <span style={{ fontWeight: '700', color: '#1d4ed8' }}>
                  {item.unitPrice ? `₩${item.unitPrice.toLocaleString()}` : '-'}
                  {item.unit ? ` / ${item.unit}` : ''}
                </span>
              </div>
            </div>
          </div>
        ))}
        {filteredMaterials.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '60px', textAlign: 'center', color: '#64748b', background: 'white', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
            <Filter size={32} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p>등록된 마감재가 없거나 검색 결과가 없습니다.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="modal-content" style={{
            background: 'white', width: '90%', maxWidth: '600px',
            borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>{editingItem ? '마감재 수정' : '새 마감재 등록'}</h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <form id="material-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>분류 *</label>
                    <select 
                      name="category" 
                      value={formData.category} 
                      onChange={handleInputChange}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                      {CATEGORIES.filter(c => c !== '전체').map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>자재/제품명 *</label>
                    <input 
                      type="text" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleInputChange}
                      placeholder="예: 강마루 내추럴 오크"
                      required
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>브랜드/제조사</label>
                    <input 
                      type="text" 
                      name="brand" 
                      value={formData.brand} 
                      onChange={handleInputChange}
                      placeholder="예: LG하우시스, 동화자연마루"
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>품번 (모델명)</label>
                    <input 
                      type="text" 
                      name="productCode" 
                      value={formData.productCode} 
                      onChange={handleInputChange}
                      placeholder="예: LG-8234-11"
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>규격 (Size/Type)</label>
                    <input 
                      type="text" 
                      name="specifications" 
                      value={formData.specifications} 
                      onChange={handleInputChange}
                      placeholder="예: 115 x 800 x 7.5T"
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>단위 (Unit)</label>
                    <input 
                      type="text" 
                      name="unit" 
                      value={formData.unit} 
                      onChange={handleInputChange}
                      placeholder="예: BOX, m2, 개"
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>단가 (Price)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }}>₩</span>
                    <input 
                      type="number" 
                      name="unitPrice" 
                      value={formData.unitPrice} 
                      onChange={(e) => setFormData(prev => ({ ...prev, unitPrice: Number(e.target.value) }))}
                      placeholder="0"
                      style={{ width: '100%', padding: '10px 10px 10px 25px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>기본 현장 지침 (선택)</label>
                  <textarea 
                    name="defaultRemarks" 
                    value={formData.defaultRemarks} 
                    onChange={handleInputChange}
                    placeholder="시공 시 주의사항이나 기본 지침을 적어두면 시방서 작성 시 기본값으로 불러옵니다."
                    rows={3}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>참고 이미지 (샘플 텍스처 등)</label>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div 
                      style={{ 
                        width: '100px', height: '100px', borderRadius: '8px', 
                        border: '1px dashed #cbd5e1', background: '#f8fafc',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', position: 'relative'
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {formData.image ? (
                        <img src={formData.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <ImageIcon color="#94a3b8" />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageUpload} 
                        accept="image/*" 
                        style={{ display: 'block', marginBottom: '8px' }}
                      />
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                        권장: 800x800px 이하의 JPG/PNG 이미지 (최대 2MB)
                      </p>
                    </div>
                  </div>
                </div>

              </form>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#f8fafc', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
              <button 
                type="button" 
                onClick={closeModal}
                style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: '500' }}
              >
                취소
              </button>
              <button 
                type="submit" 
                form="material-form"
                style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={16} /> 저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialLibrary;
