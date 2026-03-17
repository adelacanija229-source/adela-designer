import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Image as ImageIcon, BookOpen, Save, CheckCircle, Search, X, Layers, AlertCircle, Printer } from 'lucide-react';
import { offlineStore, STORES } from '../db/offlineStore';
import { ADELA_LOGO_B64 } from '../assets/logo';

const getUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const ConstructionSpecs = ({ project, onPrint }) => {
  const [specRecord, setSpecRecord] = useState(null);
  const [libraryMaterials, setLibraryMaterials] = useState([]);
  const [viewMode, setViewMode] = useState('space'); // 'space' or 'trade'
  
  // Library Modal State
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [activeItemContext, setActiveItemContext] = useState(null); // { roomId, itemId }
  const [selectedPoItems, setSelectedPoItems] = useState(new Set()); // For PO generation
  const [poGroupingMode, setPoGroupingMode] = useState('brand'); // 'brand' or 'category'
  const [libSearchTerm, setLibSearchTerm] = useState('');
  const [libCategory, setLibCategory] = useState('전체');

  const fileInputRefs = useRef({}); // To store refs for multiple file inputs dynamically

  const loadSpecs = async () => {
    try {
      const records = await offlineStore.getByIndex(STORES.CONSTRUCTION_SPECS, 'projectId', project.id);
      if (records && records.length > 0) {
        let record = records[0];
        let needsMigration = false;

        // Data Migration: Ensure every item has a unique itemId with safety checks
        const migratedRooms = (record.rooms || []).map(room => {
          const migratedItems = (room.items || []).map(item => {
            if (item && !item.itemId) {
              needsMigration = true;
              return { ...item, itemId: getUUID() };
            }
            return item;
          });
          if (needsMigration) return { ...room, items: migratedItems };
          return room;
        });

        if (needsMigration) {
          record = { ...record, rooms: migratedRooms };
          await offlineStore.save(STORES.CONSTRUCTION_SPECS, record);
        }
        
        setSpecRecord(record);
      } else {
        // Create initial record
        const newRecord = {
          id: crypto.randomUUID(),
          projectId: project.id,
          rooms: [
            {
              roomId: getUUID(),
              roomName: '거실 (Living Room)',
              items: []
            }
          ]
        };
        await offlineStore.save(STORES.CONSTRUCTION_SPECS, newRecord);
        setSpecRecord(newRecord);
      }
    } catch (err) {
      console.error('Failed to load specs', err);
    }
  };

  const loadLibrary = async () => {
    try {
      const data = await offlineStore.getAll(STORES.MATERIAL_LIBRARY);
      setLibraryMaterials(data);
    } catch (err) {
      console.error('Failed to load material library', err);
    }
  };

  useEffect(() => {
    if (project?.id) {
      loadSpecs();
      loadLibrary();
    }
  }, [project?.id]);

  const saveRecord = async (updatedRecord) => {
    setSpecRecord(updatedRecord);
    try {
      await offlineStore.save(STORES.CONSTRUCTION_SPECS, updatedRecord);
    } catch (err) {
      console.error('Failed to save specs', err);
    }
  };

  const addRoom = () => {
    const updated = { ...specRecord };
    updated.rooms.push({
      roomId: getUUID(),
      roomName: '새 공간',
      items: []
    });
    saveRecord(updated);
  };

  const removeRoom = (roomId) => {
    if (window.confirm('이 공간과 포함된 모든 시방 내역을 삭제하시겠습니까?')) {
      const updated = { ...specRecord };
      updated.rooms = updated.rooms.filter(r => r.roomId !== roomId);
      saveRecord(updated);
    }
  };

  const updateRoomName = (roomId, newName) => {
    const updated = { ...specRecord };
    const room = updated.rooms.find(r => r.roomId === roomId);
    if (room) room.roomName = newName;
    saveRecord(updated);
  };

  const addItemToRoom = (roomId) => {
    const updated = { ...specRecord };
    const room = updated.rooms.find(r => r.roomId === roomId);
    if (room) {
      room.items.push({
        itemId: getUUID(),
        category: '도장 공사',
        materialId: null,
        customMaterialDetails: { name: '', brand: '', spec: '' },
        unit: '',
        quantity: '',
        spaceImage: null,
        orderImages: [],
        constructionDirectives: '',
        status: 'Pending' // 'Pending', 'Confirmed'
      });
    }
    saveRecord(updated);
  };

  const removeItem = (roomId, itemId) => {
    const updated = { ...specRecord };
    const room = updated.rooms.find(r => r.roomId === roomId);
    if (room) {
      room.items = room.items.filter(i => i.itemId !== itemId);
    }
    saveRecord(updated);
  };

  const updateItem = (roomId, itemId, field, value) => {
    if (!specRecord) return;
    
    const updatedRooms = specRecord.rooms.map(room => {
      if (room.roomId !== roomId) return room;
      
      const updatedItems = (room.items || []).map(item => {
        if (item.itemId !== itemId) return item;
        
        if (field.includes('.')) {
          const [parent, child] = field.split('.');
          const parentObj = item[parent] || {};
          return {
            ...item,
            [parent]: {
              ...parentObj,
              [child]: value
            }
          };
        }
        
        return { ...item, [field]: value };
      });
      
      return { ...room, items: updatedItems };
    });
    
    saveRecord({ ...specRecord, rooms: updatedRooms });
  };

  const handleImageUpload = (roomId, itemId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("이미지는 2MB 이하로 업로드해주세요.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      updateItem(roomId, itemId, 'spaceImage', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const openLibraryModal = (roomId, itemId) => {
    setActiveItemContext({ roomId, itemId });
    setIsLibraryModalOpen(true);
  };

  const applyLibraryMaterial = (mat) => {
    if (!activeItemContext || !specRecord) return;
    const { roomId, itemId } = activeItemContext;
    
    const updatedRooms = specRecord.rooms.map(room => {
      if (room.roomId !== roomId) return room;
      
      const updatedItems = (room.items || []).map(item => {
        if (item.itemId !== itemId) return item;
        
        return {
          ...item,
          materialId: mat.id,
          category: mat.category || item.category,
          customMaterialDetails: {
            name: mat.name,
            brand: mat.brand || '',
            spec: mat.specifications || ''
          },
          spaceImage: mat.image || item.spaceImage,
          constructionDirectives: mat.defaultRemarks 
            ? mat.defaultRemarks + '\n' + (item.constructionDirectives || '') 
            : item.constructionDirectives
        };
      });
      
      return { ...room, items: updatedItems };
    });
    
    saveRecord({ ...specRecord, rooms: updatedRooms });
    setIsLibraryModalOpen(false);
    setActiveItemContext(null);
  };

  const handlePrintSection = (elementId) => {
    const printArea = document.getElementById(elementId);
    if (!printArea) return;

    // Sync input values to DOM properties so cloneNode retains them
    const inputs = printArea.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      if (input.type === 'checkbox' || input.type === 'radio') {
        if (input.checked) input.setAttribute('checked', 'checked');
        else input.removeAttribute('checked');
      } else if (input.tagName.toLowerCase() === 'select') {
        const options = input.querySelectorAll('option');
        options.forEach(opt => {
           if (opt.selected) opt.setAttribute('selected', 'selected');
           else opt.removeAttribute('selected');
        });
      } else {
        input.setAttribute('value', input.value || '');
        if (input.tagName.toLowerCase() === 'textarea') {
          input.innerHTML = input.value || '';
        }
      }
    });

    const printNode = printArea.cloneNode(true);
    printNode.id = 'temp-print-node';
    
    const wrapper = document.createElement('div');
    wrapper.id = 'temp-print-wrapper';
    wrapper.style.position = 'absolute';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    wrapper.style.width = '100%';
    wrapper.style.background = 'white';
    wrapper.style.zIndex = '99999';
    wrapper.style.minHeight = '100vh';
    wrapper.appendChild(printNode);
    
    document.body.appendChild(wrapper);

    const style = document.createElement('style');
    style.id = 'temp-print-style';
    const cssRules = "" +
        "@media print {" +
        "    body > :not(#temp-print-wrapper) {" +
        "        display: none !important;" +
        "    }" +
        "    #temp-print-wrapper {" +
        "        display: block !important;" +
        "        visibility: visible !important;" +
        "    }" +
        "    #temp-print-node {" +
        "        padding: 20px;" +
        "        background: white;" +
        "    }" +
        "    .no-print, .btn {" +
        "        display: none !important;" +
        "    }" +
        "    .no-print-input { outline: none !important; border-bottom: 1px solid black !important; background: transparent !important; }" +
        "    @page { margin: 1cm; }" +
        "}" +
        "@media screen {" +
        "    #temp-print-wrapper { display: none !important; }" +
        "}";
        
    style.innerHTML = cssRules;
    document.head.appendChild(style);

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
        if (document.head.contains(style)) document.head.removeChild(style);
      }, 500);
    }, 100);
  };

  // Render Functions
  if (!specRecord) return <div style={{ padding: '60px', textAlign: 'center' }}>데이터를 불러오는 중...</div>;

  return (
    <div className="view-container">
      <div className="view-header no-print">
        <div className="header-left">
          <h2>공간별 특기 시방서</h2>
          <p className="subtitle">{project?.name} 현장의 공간별 자재 스펙과 시공 오더를 관리합니다.</p>
        </div>
        <div className="header-actions">
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', marginRight: '16px' }}>
            <button 
              className={viewMode === 'space' ? 'btn btn-primary' : 'btn'}
              style={{ padding: '6px 12px', background: viewMode === 'space' ? 'white' : 'transparent', color: viewMode === 'space' ? '#0f172a' : '#64748b', border: 'none', boxShadow: viewMode === 'space' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
              onClick={() => setViewMode('space')}
            >
              공간별 편성
            </button>
            <button 
              className={viewMode === 'trade' ? 'btn btn-primary' : 'btn'}
              style={{ padding: '6px 12px', background: viewMode === 'trade' ? 'white' : 'transparent', color: viewMode === 'trade' ? '#0f172a' : '#64748b', border: 'none', boxShadow: viewMode === 'trade' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
              onClick={() => setViewMode('trade')}
            >
              공종별 시방 요약
            </button>
            <button 
              className={viewMode === 'export' ? 'btn btn-primary' : 'btn'}
              style={{ padding: '6px 12px', background: viewMode === 'export' ? 'white' : 'transparent', color: viewMode === 'export' ? '#1d4ed8' : '#64748b', border: 'none', boxShadow: viewMode === 'export' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
              onClick={() => {
                // When entering export mode, pre-select all confirmed items if none are selected
                if (selectedPoItems.size === 0) {
                  const confirmedIds = new Set();
                  specRecord.rooms.forEach(r => r.items.forEach(i => {
                    if (i.status === 'Confirmed') confirmedIds.add(i.itemId);
                  }));
                  setSelectedPoItems(confirmedIds);
                }
                setViewMode('export');
              }}
            >
              발주서 및 출력
            </button>
          </div>
          <button className="btn btn-outline" onClick={onPrint}>
            <Printer size={16} /> 전쳬 시방서 출력 (통합문서)
          </button>
          {viewMode === 'space' && (
            <button className="btn btn-primary" onClick={addRoom}>
              <Plus size={16} /> 새 공간 추가
            </button>
          )}
        </div>
      </div>

      <div className="specs-content" style={{ paddingBottom: '60px' }}>
        
        {viewMode === 'space' && (
          <div className="rooms-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {specRecord.rooms.map(room => (
              <div key={room.roomId} className="room-card" style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                {/* Room Header */}
                <div style={{ background: '#f8fafc', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    value={room.roomName} 
                    onChange={(e) => updateRoomName(room.roomId, e.target.value)}
                    style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', background: 'transparent', border: 'none', outline: 'none', width: '300px' }}
                    placeholder="공간명 입력 (예: 거실)"
                  />
                  <div>
                    <button className="btn" onClick={() => addItemToRoom(room.roomId)} style={{ background: 'white', border: '1px solid #cbd5e1', color: '#334155', marginRight: '8px' }}>
                      <Plus size={14} /> 자재/시공 항목 추가
                    </button>
                    <button onClick={() => removeRoom(room.roomId)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px' }} title="공간 삭제">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Items List */}
                <div className="room-items" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {room.items.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '14px' }}>
                      항목 추가 버튼을 눌러 이 공간에 들어갈 마감재와 시공 지침을 기록하세요.
                    </div>
                  )}
                  {room.items.map(item => (
                    <div key={item.itemId} style={{ display: 'flex', gap: '20px', padding: '16px', background: '#fafaf9', borderRadius: '8px', border: '1px solid #e5e5e5', position: 'relative' }}>
                      
                      {/* Left: Image */}
                      <div style={{ width: '160px', flexShrink: 0 }}>
                        <div 
                          style={{ 
                            width: '100%', height: '160px', background: 'white', border: '1px dashed #cbd5e1', borderRadius: '6px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', position: 'relative'
                          }}
                          onClick={() => {
                            if (!fileInputRefs.current[item.itemId]) {
                               const input = document.createElement('input');
                               input.type = 'file';
                               input.accept = 'image/*';
                               input.onchange = (e) => handleImageUpload(room.roomId, item.itemId, e);
                               fileInputRefs.current[item.itemId] = input;
                            }
                            fileInputRefs.current[item.itemId].click();
                          }}
                        >
                          {item.spaceImage ? (
                            <img src={item.spaceImage} alt="Reference" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                              <ImageIcon size={24} style={{ margin: '0 auto 8px' }} />
                              <span style={{ fontSize: '12px' }}>이미지 첨부</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Middle: Material Form */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
                            <select 
                              value={item.category} 
                              onChange={(e) => updateItem(room.roomId, item.itemId, 'category', e.target.value)}
                              style={{ width: '120px', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            >
                              <option>도장 공사</option>
                              <option>도배공사</option>
                              <option>바닥공사</option>
                              <option>확장공사</option>
                              <option>창호공사</option>
                              <option>가구공사</option>
                              <option>욕실공사</option>
                              <option>목공공사</option>
                              <option>전기조명</option>
                              <option>타일공사</option>
                              <option>철거공사</option>
                              <option>설비공사</option>
                              <option>기타공사</option>
                              <option>에어컨공사</option>
                              <option>래핑공사</option>
                              <option>배관청소</option>
                              <option>준공청소</option>
                            </select>
                            
                            <input 
                              type="text" 
                              placeholder="자재명 / 제품명 (직접 입력)" 
                              value={item.customMaterialDetails.name}
                              onChange={(e) => updateItem(room.roomId, item.itemId, 'customMaterialDetails.name', e.target.value)}
                              style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                            />
                          </div>
                          <button 
                            className="btn" 
                            style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 12px' }}
                            onClick={() => openLibraryModal(room.roomId, item.itemId)}
                          >
                            <BookOpen size={14} /> 라이브러리 불러오기
                          </button>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="text" 
                            placeholder="브랜드/제조사" 
                            value={item.customMaterialDetails.brand}
                            onChange={(e) => updateItem(room.roomId, item.itemId, 'customMaterialDetails.brand', e.target.value)}
                            style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                          />
                          <input 
                            type="text" 
                            placeholder="품번/규격 상세" 
                            value={item.customMaterialDetails.spec}
                            onChange={(e) => updateItem(room.roomId, item.itemId, 'customMaterialDetails.spec', e.target.value)}
                            style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                          />
                          <input 
                            type="text" 
                            placeholder="단위 (예: BOX, 회배)" 
                            value={item.unit || ''}
                            onChange={(e) => updateItem(room.roomId, item.itemId, 'unit', e.target.value)}
                            style={{ width: '100px', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                          />
                          <input 
                            type="number" 
                            placeholder="수량" 
                            value={item.quantity || ''}
                            onChange={(e) => updateItem(room.roomId, item.itemId, 'quantity', e.target.value)}
                            style={{ width: '80px', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                          />
                        </div>

                        <div style={{ flex: 1 }}>
                          <textarea 
                            placeholder="시공 오더 및 현장 특기사항 입력 (예: 몰딩은 평몰딩, 타일은 다이아몬드 시공 등)" 
                            value={item.constructionDirectives}
                            onChange={(e) => updateItem(room.roomId, item.itemId, 'constructionDirectives', e.target.value)}
                            style={{ width: '100%', height: '100%', minHeight: '60px', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', resize: 'vertical', fontSize: '13px' }}
                          />
                        </div>
                      </div>

                      {/* Right: Status & Actions */}
                      <div style={{ width: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', borderLeft: '1px solid #e5e5e5', paddingLeft: '16px' }}>
                         <button 
                           onClick={() => updateItem(room.roomId, item.itemId, 'status', item.status === 'Confirmed' ? 'Pending' : 'Confirmed')}
                           title="확정 상태(발주 대상)로 변경"
                           style={{ 
                             display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                             background: 'none', border: 'none', cursor: 'pointer', 
                             color: item.status === 'Confirmed' ? '#10b981' : '#94a3b8' 
                           }}
                         >
                           <CheckCircle size={24} />
                           <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{item.status === 'Confirmed' ? '확정완료' : '검토중'}</span>
                         </button>
                         <div style={{ flex: 1 }}></div>
                         <button onClick={() => removeItem(room.roomId, item.itemId)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '4px' }} title="항목 삭제">
                           <Trash2 size={16} />
                         </button>
                      </div>

                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'trade' && (
          <div className="trade-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Trade Directives Section */}
            <div className="trade-directives-section" id="trade-print-area">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: '#0f172a', paddingLeft: '8px', borderLeft: '4px solid #475569' }}>공종별 전체 시방 지침</h3>
                <button className="btn btn-outline" onClick={() => handlePrintSection('trade-print-area')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Printer size={14} /> 공종별 지침 인쇄
                </button>
              </div>
              {(() => {
                const groups = {};
                specRecord.rooms.forEach(room => {
                  room.items.forEach(item => {
                    const category = item.category || '미분류';
                    if (!groups[category]) groups[category] = [];
                    groups[category].push({ ...item, roomName: room.roomName });
                  });
                });

                if (Object.keys(groups).length === 0) return <div style={{ color: '#64748b', padding: '20px' }}>기록된 시방 내역이 없습니다.</div>;

                const tradeDrawings = specRecord.tradeDrawings || {};

                return Object.entries(groups).map(([category, items]) => {
                  const drawings = tradeDrawings[category] || [];

                  const handleDrawingUpload = (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    const tooBig = files.find(f => f.size > 10 * 1024 * 1024);
                    if (tooBig) { alert('이미지는 10MB 이하로 업로드해주세요.'); return; }
                    const readers = files.map(file => new Promise(res => {
                      const r = new FileReader();
                      r.onloadend = () => res(r.result);
                      r.readAsDataURL(file);
                    }));
                    Promise.all(readers).then(results => {
                      const updated = { ...specRecord };
                      updated.tradeDrawings = { ...(updated.tradeDrawings || {}), [category]: [...drawings, ...results] };
                      saveRecord(updated);
                    });
                    e.target.value = '';
                  };

                  const removeDrawing = (idx) => {
                    const updated = { ...specRecord };
                    const existing = [...(updated.tradeDrawings?.[category] || [])];
                    existing.splice(idx, 1);
                    updated.tradeDrawings = { ...(updated.tradeDrawings || {}), [category]: existing };
                    saveRecord(updated);
                  };

                  return (
                  <div key={category} style={{ marginBottom: '20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    {/* Category Header */}
                    <div style={{ background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '15px' }}>{category} 공사 지침</span>
                    </div>

                    {/* Directives List */}
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {items.map(item => (
                        <div key={item.itemId} style={{ display: 'flex', gap: '12px', background: '#fcfcfc', padding: '12px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                          <div style={{ background: '#e2e8f0', color: '#334155', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', height: 'fit-content', whiteSpace: 'nowrap' }}>
                            {item.roomName}
                          </div>
                          <div style={{ flex: 1, fontSize: '14px' }}>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'center' }}>
                              <span style={{ fontWeight: '600', color: '#0f172a' }}>{item.customMaterialDetails.name || '품목 미지정'}</span>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>{item.customMaterialDetails.brand} {item.customMaterialDetails.spec}</span>
                            </div>
                            <div style={{ color: '#475569', whiteSpace: 'pre-line' }}>
                              {item.constructionDirectives || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>현장 지침 없음</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Drawing Attachment Zone */}
                    <div style={{ borderTop: '1px dashed #e2e8f0', padding: '12px 16px', background: '#fafbfc' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ImageIcon size={13} color="#64748b" /> 도면 및 참고 이미지 첨부 (시공팀 전달용)
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        {/* Existing drawing thumbnails */}
                        {drawings.map((img, idx) => (
                          <div key={idx} className="trade-drawing-wrap" style={{ position: 'relative', flexShrink: 0 }}>
                            <img
                              src={img}
                              alt={`drawing-${idx}`}
                              className="trade-drawing-img"
                              style={{ width: '120px', height: '90px', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: 'pointer', display: 'block' }}
                              onClick={() => window.open(img, '_blank')}
                              title="클릭하면 원본 크기로 보기"
                            />
                            <button
                              className="no-print"
                              onClick={() => removeDrawing(idx)}
                              style={{ position: 'absolute', top: '3px', right: '3px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                              title="삭제"
                            >
                              <X size={11} color="white" />
                            </button>
                          </div>
                        ))}
                        {/* Upload trigger */}
                        <label
                          className="no-print"
                          style={{ width: '120px', height: '90px', border: '1.5px dashed #94a3b8', borderRadius: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'white', gap: '6px', flexShrink: 0 }}
                          title="도면 청부"
                        >
                          <input type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handleDrawingUpload} />
                          <ImageIcon size={20} color="#94a3b8" />
                          <span style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center', lineHeight: '1.4' }}>도면 첨부<br/>(PNG / JPG)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  );
                });
              })()}
            </div>

          </div>
        )}

        {viewMode === 'export' && (
          <div className="export-view-container" style={{ display: 'flex', gap: '32px' }}>
            {/* Left: Material Selection */}
            <div style={{ width: '350px', flexShrink: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>발주 자재 선택</h3>
                <span style={{ fontSize: '12px', background: '#eff6ff', color: '#2563eb', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                  {selectedPoItems.size}개 선택됨
                </span>
              </div>
              
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: '#334155' }}>
                  <input 
                    type="checkbox" 
                    checked={poGroupingMode === 'category'} 
                    onChange={(e) => setPoGroupingMode(e.target.checked ? 'category' : 'brand')}
                    style={{ width: '16px', height: '16px' }}
                  />
                  공종(분류)별로 통합하여 발주
                </label>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', paddingLeft: '24px' }}>
                  체크 시 브랜드가 달라도 같은 공종이면 한 장에 표시됩니다.
                </div>
              </div>

              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>* 공간별 스펙에서 '확정완료' 상태인 자재만 표시됩니다.</p>
              
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(() => {
                  const confirmedItems = [];
                  specRecord.rooms.forEach(room => {
                    room.items.forEach(item => {
                      if (item.status === 'Confirmed') {
                        confirmedItems.push({ ...item, roomName: room.roomName });
                      }
                    });
                  });

                  if (confirmedItems.length === 0) {
                    return <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>확정 완료된 자재가 없습니다.</div>;
                  }

                  return confirmedItems.map(item => (
                    <label key={item.itemId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: selectedPoItems.has(item.itemId) ? '#eff6ff' : '#f8fafc', border: selectedPoItems.has(item.itemId) ? '1px solid #bfdbfe' : '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedPoItems.has(item.itemId)} 
                        onChange={(e) => {
                          const newSet = new Set(selectedPoItems);
                          if (e.target.checked) newSet.add(item.itemId);
                          else newSet.delete(item.itemId);
                          setSelectedPoItems(newSet);
                        }}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>{item.roomName} / {item.category}</div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.customMaterialDetails.name}
                        </div>
                      </div>
                    </label>
                  ));
                })()}
              </div>
            </div>

            {/* Right: PO Preview & Print */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#0f172a' }}>발주서 미리보기</h3>
                <button 
                  className="btn btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 24px' }}
                  onClick={() => handlePrintSection('po-print-area')}
                  disabled={selectedPoItems.size === 0}
                >
                  <Printer size={16} /> 선택 항목 발주서 인쇄
                </button>
              </div>

              <div id="po-print-area" style={{ background: 'white', padding: '40px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', minHeight: '500px' }}>
                {(() => {
                  if (selectedPoItems.size === 0) return <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>선택된 발주 항목이 없습니다. 좌측에서 자재를 선택해주세요.</div>;

                  const pos = {};
                  specRecord.rooms.forEach(room => {
                    room.items.forEach(item => {
                      if (selectedPoItems.has(item.itemId)) {
                         const groupKey = poGroupingMode === 'category' 
                           ? (item.category || '미분류') 
                           : (item.customMaterialDetails.brand || '미지정/기타');
                         if (!pos[groupKey]) pos[groupKey] = [];
                         pos[groupKey].push({ ...item, roomName: room.roomName });
                      }
                    });
                  });

                  return Object.entries(pos).map(([groupKey, items], index) => (
                    <div key={groupKey} style={{ marginBottom: '60px', pageBreakAfter: index < Object.entries(pos).length - 1 ? 'always' : 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '2px solid #0f172a', paddingBottom: '20px' }}>
                        <div>
                           <h1 style={{ margin: '0 0 12px 0', fontSize: '28px', letterSpacing: '2px', color: '#0f172a', fontWeight: '900' }}>자재 발주서 <span style={{fontSize: '16px', color: '#64748b', fontWeight: 'normal', letterSpacing: '0'}}>(PURCHASE ORDER)</span></h1>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                             <strong>현장명:</strong> <span style={{ fontWeight: 'bold', color: '#2563eb' }}>{project?.name}</span>
                           </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569', lineHeight: '1.6' }}>
                           <div style={{ fontSize: '16px', fontWeight: '900', color: '#C9001A', marginBottom: '4px', letterSpacing: '1px' }}>ADELA INTERIOR</div>
                           <div><strong>(주)아델라 인테리어</strong></div>
                           <div>서울시 강남구 학동로 11길 56 백송빌딩 2F</div>
                           <div>TEL: 02-2281-0456 | FAX: 02-2293-0456</div>
                           <div>E-MAIL: adela_i@naver.com</div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', fontSize: '13px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'nowrap', overflow: 'hidden' }}>
                        {/* 발주처(수신) 정보 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '45%', paddingRight: '16px', borderRight: '1px dashed #cbd5e1', minWidth: 0 }}>
                          <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '2px', fontSize: '13px' }}>[ 발주처(수신) 정보 ]</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                            <strong style={{ flexShrink: 0, width: '58px', color: '#64748b', fontSize: '12px' }}>상호명:</strong>
                            <input type="text" className="no-print-input" defaultValue={groupKey} style={{ flex: 1, minWidth: 0, border: 'none', borderBottom: '1px solid #cbd5e1', padding: '2px 4px', fontSize: '12px', background: 'transparent', maxWidth: '100%' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                            <strong style={{ flexShrink: 0, width: '58px', color: '#64748b', fontSize: '12px' }}>담당자:</strong>
                            <input type="text" className="no-print-input" placeholder="이름 입력" style={{ flex: 1, minWidth: 0, border: 'none', borderBottom: '1px solid #cbd5e1', padding: '2px 4px', fontSize: '12px', background: 'transparent' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                            <strong style={{ flexShrink: 0, width: '58px', color: '#64748b', fontSize: '12px' }}>연락처:</strong>
                            <input type="text" className="no-print-input" placeholder="전화번호 입력" style={{ flex: 1, minWidth: 0, border: 'none', borderBottom: '1px solid #cbd5e1', padding: '2px 4px', fontSize: '12px', background: 'transparent' }} />
                          </div>
                        </div>

                        {/* 발주자 정보 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '55%', paddingLeft: '16px', minWidth: 0 }}>
                          <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '2px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span>[ 발주자 정보 ]</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 'normal' }}>
                              <strong style={{ color: '#64748b' }}>발주일:</strong>
                              <input type="date" className="no-print-input" defaultValue={new Date().toISOString().split('T')[0]} style={{ border: 'none', borderBottom: '1px solid #cbd5e1', padding: '2px', fontSize: '11px', background: 'transparent', color: '#0f172a', fontWeight: 'bold' }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                            <strong style={{ flexShrink: 0, width: '58px', color: '#64748b', fontSize: '12px' }}>발주자:</strong>
                            <input type="text" className="no-print-input" placeholder="이름" style={{ width: '72px', flexShrink: 0, border: 'none', borderBottom: '1px solid #cbd5e1', padding: '2px 4px', fontSize: '12px', background: 'transparent' }} />
                            <strong style={{ flexShrink: 0, color: '#64748b', fontSize: '12px' }}>TEL:</strong>
                            <input type="text" className="no-print-input" placeholder="연락처" style={{ flex: 1, minWidth: 0, border: 'none', borderBottom: '1px solid #cbd5e1', padding: '2px 4px', fontSize: '12px', background: 'transparent' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                            <strong style={{ flexShrink: 0, width: '58px', color: '#64748b', fontSize: '12px' }}>현장소장:</strong>
                            <input type="text" className="no-print-input" placeholder="이름" style={{ width: '72px', flexShrink: 0, border: 'none', borderBottom: '1px solid #cbd5e1', padding: '2px 4px', fontSize: '12px', background: 'transparent' }} />
                            <strong style={{ flexShrink: 0, color: '#64748b', fontSize: '12px' }}>TEL:</strong>
                            <input type="text" className="no-print-input" placeholder="연락처" style={{ flex: 1, minWidth: 0, border: 'none', borderBottom: '1px solid #cbd5e1', padding: '2px 4px', fontSize: '12px', background: 'transparent' }} />
                          </div>
                        </div>
                      </div>

                      {/* 수령 정보 */}
                      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', fontSize: '13px', background: '#fffbeb', padding: '12px 16px', borderRadius: '8px', border: '1px solid #fde68a', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 'bold', color: '#92400e', fontSize: '12px', flexShrink: 0 }}>[ 납품 정보 ]</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
                          <strong style={{ flexShrink: 0, color: '#64748b', fontSize: '12px' }}>수령 일시:</strong>
                          <input
                            type="text"
                            className="no-print-input"
                            placeholder="예) 2026-03-20 오전 10:00"
                            style={{ flex: 1, minWidth: 0, border: 'none', borderBottom: '1px solid #fbbf24', padding: '3px 6px', fontSize: '12px', background: 'transparent', fontWeight: '500', color: '#0f172a' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 2, minWidth: '200px' }}>
                          <strong style={{ flexShrink: 0, color: '#64748b', fontSize: '12px' }}>수령 장소:</strong>
                          <input
                            type="text"
                            className="no-print-input"
                            placeholder="현장 주소 또는 창고 위치 입력"
                            style={{ flex: 1, minWidth: 0, border: 'none', borderBottom: '1px solid #fbbf24', padding: '3px 6px', fontSize: '12px', background: 'transparent', fontWeight: '500', color: '#0f172a' }}
                          />
                        </div>
                      </div>

                       <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', borderTop: '2px solid #2563eb', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                         <thead>
                           <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                             <th style={{ padding: '12px 10px', width: '12%', borderRight: '1px solid #e2e8f0' }}>공간</th>
                             <th style={{ padding: '12px 10px', width: '12%', borderRight: '1px solid #e2e8f0' }}>분류</th>
                             <th style={{ padding: '12px 10px', width: '25%', borderRight: '1px solid #e2e8f0' }}>제품명</th>
                             <th style={{ padding: '12px 10px', width: '15%', borderRight: '1px solid #e2e8f0' }}>규격/모델명</th>
                             <th style={{ padding: '12px 10px', width: '8%', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>단위</th>
                             <th style={{ padding: '12px 10px', width: '8%', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>수량</th>
                             <th style={{ padding: '12px 10px', width: '20%' }}>비고(지침)</th>
                           </tr>
                         </thead>
                         <tbody>
                           {items.map((item, i) => (
                             <tr key={item.itemId} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                               <td style={{ padding: '12px 10px', borderRight: '1px solid #e2e8f0', fontWeight: '500' }}>{item.roomName}</td>
                               <td style={{ padding: '12px 10px', borderRight: '1px solid #e2e8f0' }}>{item.category}</td>
                               <td style={{ padding: '12px 10px', borderRight: '1px solid #e2e8f0', color: '#0f172a', fontWeight: 'bold' }}>{item.customMaterialDetails.name}</td>
                               <td style={{ padding: '12px 10px', borderRight: '1px solid #e2e8f0' }}>{item.customMaterialDetails.spec}</td>
                               <td style={{ padding: '12px 10px', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}>{item.unit || '-'}</td>
                               <td style={{ padding: '12px 10px', borderRight: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity || '-'}</td>
                               <td style={{ padding: '12px 10px', color: '#64748b' }}>{item.constructionDirectives || '-'}</td>
                             </tr>
                           ))}
                         </tbody>
                       </table>

                      <div style={{ padding: '0 10px', marginTop: '24px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>특이사항 (MEMO):</div>
                        <textarea 
                          className="no-print-input"
                          placeholder="발주 관련 특이사항을 입력하세요..." 
                          style={{ width: '100%', minHeight: '80px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', resize: 'vertical' }}
                        />
                      </div>

                      <div style={{ padding: '0 10px', marginTop: '30px', borderTop: '1px dashed #cbd5e1', paddingTop: '20px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>이미지 첨부란:</div>
                        <div 
                          className="no-print-input"
                          style={{ width: '100%', height: '150px', border: '1px dashed #94a3b8', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', background: '#f8fafc' }}
                          onClick={(e) => {
                             const input = document.createElement('input');
                             input.type = 'file';
                             input.accept = 'image/*';
                             input.onchange = (ev) => {
                                 const file = ev.target.files[0];
                                 if (file) {
                                     const reader = new FileReader();
                                     reader.onload = (eLoad) => {
                                         e.currentTarget.style.backgroundImage = `url(${eLoad.target.result})`;
                                         e.currentTarget.style.backgroundSize = 'contain';
                                         e.currentTarget.style.backgroundPosition = 'center';
                                         e.currentTarget.style.backgroundRepeat = 'no-repeat';
                                         e.currentTarget.innerHTML = '';
                                     };
                                     reader.readAsDataURL(file);
                                 }
                             };
                             input.click();
                          }}
                        >
                          클릭하여 발주 참고용 이미지 첨부
                        </div>
                      </div>

                      <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end', gap: '40px', paddingRight: '20px' }}>
                         <div style={{ textAlign: 'center' }}>
                           <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>발주자 (서명)</div>
                           <div style={{ borderBottom: '1px solid #cbd5e1', width: '120px', height: '30px' }}></div>
                           <input type="text" className="no-print-input" placeholder="전화번호" style={{ border: 'none', borderBottom: '1px solid #cbd5e1', padding: '4px', width: '120px', fontSize: '12px', marginTop: '4px', textAlign: 'center' }} />
                         </div>
                         <div style={{ textAlign: 'center' }}>
                           <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>현장소장 확인</div>
                           <input type="text" className="no-print-input" placeholder="소장 이름" style={{ border: 'none', borderBottom: '1px solid #cbd5e1', padding: '4px', width: '120px', fontSize: '12px', textAlign: 'center' }} />
                           <input type="text" className="no-print-input" placeholder="전화번호" style={{ border: 'none', borderBottom: '1px solid #cbd5e1', padding: '4px', width: '120px', fontSize: '12px', marginTop: '4px', textAlign: 'center', display: 'block' }} />
                         </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Material Library Select Modal */}
      {isLibraryModalOpen && (
        <div className="modal-overlay no-print" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyItems: 'center', padding: '40px'
        }}>
          <div className="modal-content" style={{
            background: 'white', width: '100%', maxWidth: '800px', height: '80vh', margin: 'auto',
            borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={20} color="#2563eb" /> 마감재 라이브러리에서 불러오기
              </h3>
              <button onClick={() => setIsLibraryModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <select style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} onChange={(e) => setLibCategory(e.target.value)} value={libCategory}>
                  <option value="전체">전체 분류</option>
                  {[...new Set(libraryMaterials.map(m => m.category))].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                  <input 
                    type="text" 
                    placeholder="자재명 검색..." 
                    value={libSearchTerm}
                    onChange={(e) => setLibSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', background: '#fcfcfc' }}>
              {libraryMaterials.filter(m => {
                if (libCategory !== '전체' && m.category !== libCategory) return false;
                if (libSearchTerm && !m.name.toLowerCase().includes(libSearchTerm.toLowerCase())) return false;
                return true;
              }).map(mat => (
                <div key={mat.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer' }} onClick={() => applyLibraryMaterial(mat)}>
                  <div style={{ width: '48px', height: '48px', background: '#f1f5f9', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                     {mat.image ? <img src={mat.image} alt={mat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={20} color="#cbd5e1" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 'bold' }}>{mat.category}</div>
                    <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: '500' }}>{mat.name}</div>
                  </div>
                  <div style={{ flex: 1, fontSize: '13px', color: '#64748b' }}>
                    <div>{mat.brand}</div>
                    <div>{mat.specifications}</div>
                  </div>
                  <button className="btn btn-outline" style={{ fontSize: '12px', padding: '6px 16px' }} onClick={(e) => { e.stopPropagation(); applyLibraryMaterial(mat); }}>
                    선택
                  </button>
                </div>
              ))}
              {libraryMaterials.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  등록된 마감재가 없습니다. 좌측 메뉴의 '마감재 라이브러리'에서 먼저 등록해주세요.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ConstructionSpecs;
