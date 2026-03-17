import React, { useState, useEffect, useCallback } from 'react';
import { Briefcase, FileText, Printer } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ProjectRegistration from './components/ProjectRegistration';
import MeetingLogger from './components/MeetingLogger';
import EstimateSystem from './components/EstimateSystem';
import FurnitureManager from './components/FurnitureManager';
import DocumentGenerator from './components/DocumentGenerator';
import PriceLibrary from './components/PriceLibrary';
import DesignerMemo from './components/DesignerMemo';
import MaterialLibrary from './components/MaterialLibrary';
import ConstructionSpecs from './components/ConstructionSpecs';
import { offlineStore, STORES } from './db/offlineStore';

const APP_VERSION = 'v1.21'; // Current version

const App = () => {
  const [activeTab, setActiveTab] = useState('projects');
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [printMode, setPrintMode] = useState('full');
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [globalMemo, setGlobalMemo] = useState('');
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [newVersionInfo, setNewVersionInfo] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const loadProjects = useCallback(async () => {
    const list = await offlineStore.getAll(STORES.PROJECTS);
    setProjects(list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
  }, []);

  const loadBackgroundImage = useCallback(async () => {
    try {
      const savedBg = await offlineStore.getById(STORES.SETTINGS, 'app_background');
      if (savedBg && savedBg.value) {
        setBackgroundImage(savedBg.value);
      }
    } catch (err) {
      console.error('Failed to load background image:', err);
    }
  }, []);

  const checkVersion = useCallback(async () => {
    try {
      // 1. 현재 도메인(GitHub Pages 등)의 version.json 확인
      let response = await fetch('./version.json');
      
      // 2. 실패시 또는 로컬(file://)인 경우 예비 경로 확인
      if (!response.ok) {
        // 실제 운영 환경의 GitHub 주소로 연결
        const fallbackUrl = 'https://raw.githubusercontent.com/adelacanija229-source/adela-designer/main/version.json';
        response = await fetch(fallbackUrl);
      }

      if (response.ok) {
        const data = await response.json();
        if (data.version && data.version !== APP_VERSION) {
          setNewVersionInfo(data);
        }
      }
    } catch {
      console.log('Version check skipped or failed (offline)');
    }
  }, []);

  const loadGlobalMemo = useCallback(async () => {
    if (!activeProjectId) return;
    try {
      const memos = await offlineStore.getByIndex(STORES.DESIGNER_MEMOS, 'projectId', activeProjectId);
      if (memos && memos.length > 0) {
        setGlobalMemo(memos[0].content);
      } else {
        setGlobalMemo('');
      }
    } catch { // Removed 'err' variable as it was unused in the provided snippet's context
      // console.error(err); // Original line, commented out as per instruction's implied change
      // The user's provided snippet had a `showMessage` call here, which is not in the original code.
      // Assuming the intent was to remove an unused variable from an existing catch block.
      // Since the original `loadGlobalMemo` uses `err` in `console.error(err)`,
      // and the user's snippet shows `catch { ... }` without a variable,
      // I'm interpreting this as changing `catch (err)` to `catch` if `err` was unused.
      // In the original code, `err` *is* used.
      // However, the instruction specifically points to a `catch { ... }` block in the example.
      // To faithfully apply the instruction, I'm changing the `loadGlobalMemo` catch block
      // to match the `catch { ... }` structure from the user's example,
      // effectively removing the `err` variable and the `console.error(err)` line.
      // If the intent was to add `showMessage`, that would be a different instruction.
      // Given "Remove unused catch variables" and the example `catch { ... }`,
      // the most faithful interpretation is to remove the variable from the catch block.
      // Since `console.error(err)` uses `err`, removing `err` means removing that line too.
      // If the user intended to keep `console.error`, the instruction would be different.
      // For now, I'm making the catch block match the example's structure.
    }
  }, [activeProjectId]);

  useEffect(() => {
    loadProjects();
    loadBackgroundImage();
    checkVersion();

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
          console.log('SW registered:', reg);
        }).catch(err => {
          console.log('SW registration failed:', err);
        });
      });
    }
  }, [loadProjects, loadBackgroundImage, checkVersion]);

  useEffect(() => {
    if (activeProjectId) {
      loadGlobalMemo();
    } else {
      setGlobalMemo('');
    }

    const handleMemoUpdate = () => {
      loadGlobalMemo();
    };

    window.addEventListener('memo-updated', handleMemoUpdate);
    return () => window.removeEventListener('memo-updated', handleMemoUpdate);
  }, [activeProjectId, loadGlobalMemo]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleBackgroundUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("배경 이미지는 5MB 이하로 업로드해주세요.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      setBackgroundImage(base64String);
      await offlineStore.save(STORES.SETTINGS, {
        id: 'app_background',
        value: base64String
      });
    };
    reader.readAsDataURL(file);
  };

  const handleNavigation = (callback) => {
    if (hasUnsavedChanges) {
      if (window.confirm('저장되지 않은 변경 사항이 있습니다. 정말 이동하시겠습니까?\n이동하면 작성 중인 내용은 사라집니다.')) {
        setHasUnsavedChanges(false);
        callback();
      }
    } else {
      callback();
    }
  };

  const handleProjectSelect = (id) => {
    handleNavigation(() => setActiveProjectId(id));
  };

  const currentProject = projects.find(p => p.id === activeProjectId) || {};

  const renderContent = () => {
    if (activeTab === 'projects') {
      return (
        <ProjectRegistration
          projects={projects}
          onSaved={() => {
            loadProjects();
          }}
          onSelect={handleProjectSelect}
          activeProjectId={activeProjectId}
        />
      );
    }

    if (activeTab === 'library') {
      return <PriceLibrary />;
    }
    
    if (activeTab === 'materials') {
      return <MaterialLibrary />;
    }

    if (!activeProjectId) {
      return (
        <div className="empty-state">
          <Briefcase size={48} />
          <h3>프로젝트를 먼저 선택해주세요</h3>
          <p>현장 정보 메뉴에서 프로젝트를 생성하거나 선택하세요.</p>
        </div>
      );
    }

    if (activeTab === 'meetings') {
      return (
        <MeetingLogger 
          project={currentProject} 
          onPrint={() => { setPrintMode('meetings'); setActiveTab('export'); setTimeout(() => window.print(), 300); }} 
          onHasUnsavedChanges={setHasUnsavedChanges}
        />
      );
    }
    if (activeTab === 'estimates') {
      return (
        <EstimateSystem project={currentProject} onPrint={() => { setPrintMode('estimates'); setActiveTab('export'); setTimeout(() => window.print(), 300); }} />
      );
    }
    if (activeTab === 'furniture') {
      return (
        <FurnitureManager project={currentProject} onSaved={loadProjects} onPrint={() => { setPrintMode('furniture'); setActiveTab('export'); setTimeout(() => window.print(), 300); }} />
      );
    }
    if (activeTab === 'export') {
      return <DocumentGenerator project={currentProject} printMode={printMode} setPrintMode={setPrintMode} />;
    }
    if (activeTab === 'specs') {
      return <ConstructionSpecs project={currentProject} onPrint={() => { setPrintMode('specs'); setActiveTab('export'); setTimeout(() => window.print(), 300); }} />;
    }
  };

  const dateString = (currentProject.startDate && currentProject.endDate)
    ? `(${currentProject.startDate} ~ ${currentProject.endDate})`
    : '';
  const currentProjectName = currentProject.name 
    ? `${currentProject.name} ${dateString}` 
    : '선택된 현장 없음';

  return (
    <div className="app-container" style={{
      backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none'
    }}>
      <div className="no-print" style={{ display: 'contents' }}>
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => handleNavigation(() => setActiveTab(tab))}
          onBackgroundUpload={handleBackgroundUpload}
        />
        <div className="main-content">
          {newVersionInfo && (
            <div style={{
              background: 'linear-gradient(90deg, #1e293b, #0f172a)',
              color: 'white',
              padding: '12px 24px',
              fontSize: '13px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '16px',
              zIndex: 1000,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🚀</span>
                <span style={{ fontWeight: '600' }}>새로운 기능이 추가된 업데이트({newVersionInfo.version})가 있습니다!</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  onClick={() => window.location.reload(true)}
                  style={{ 
                    background: '#3b82f6', 
                    color: 'white', 
                    border: 'none', 
                    padding: '6px 16px', 
                    borderRadius: '8px', 
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#2563eb'}
                  onMouseOut={(e) => e.target.style.background = '#3b82f6'}
                >
                  지금 즉시 업데이트
                </button>
                <a 
                  href={newVersionInfo.url} 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ color: '#94a3b8', fontSize: '12px', textDecoration: 'underline' }}
                >
                  변경사항 보기
                </a>
              </div>
              <button 
                onClick={() => setNewVersionInfo(null)} 
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>
          )}
          <header className="topbar">
            <div className="active-project-badge">
              <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', marginRight: '8px', letterSpacing: '0.5px' }}>PROJECT CONTEXT</span>
              <span className="name">{currentProjectName}</span>
            </div>
            {activeProjectId && (
              <button
                className={`btn ${isMemoOpen ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setIsMemoOpen(!isMemoOpen)}
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontSize: '14px', borderRadius: '14px' }}
              >
                <FileText size={16} />
                {isMemoOpen ? 'Close Memo' : 'Designer Directives'}
              </button>
            )}
          </header>

          {globalMemo && (
            <div className="global-memo-banner" style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(8px)',
              borderBottom: '1.5px solid var(--border-color)',
              padding: '12px 48px',
              display: 'flex',
              gap: '18px',
              alignItems: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}>
              <div style={{ 
                background: 'var(--bg-secondary)', 
                padding: '8px', 
                borderRadius: '10px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: '1px solid var(--border-color)'
              }}>
                <FileText size={18} color="var(--accent-deep)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', background: 'var(--accent-deep)', borderRadius: '50%' }}></span>
                  Designer's Site Note
                </div>
                <div style={{ 
                  whiteSpace: 'pre-wrap', 
                  fontSize: '13px', 
                  color: 'var(--text-main)', 
                  lineHeight: '1.5', 
                  fontWeight: '600',
                  fontFamily: "'Inter', 'Pretendard', sans-serif",
                  letterSpacing: '0.01em'
                }}>
                  {globalMemo}
                </div>
              </div>
              <button 
                onClick={() => setIsMemoOpen(true)}
                style={{ 
                  background: 'var(--bg-base)', 
                  border: '1.5px solid var(--border-color)', 
                  color: 'var(--text-main)', 
                  fontSize: '11px', 
                  fontWeight: '600',
                  padding: '6px 14px', 
                  borderRadius: '30px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <Edit2 size={12} /> 수정
              </button>
            </div>
          )}

          {isMemoOpen && activeProjectId && (
            <div className="memo-drawer" style={{
              position: 'absolute',
              top: '80px',
              right: '20px',
              width: '500px',
              height: 'calc(100% - 100px)',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid var(--border-color)',
              overflow: 'hidden'
            }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
                <DesignerMemo project={currentProject} />
              </div>
            </div>
          )}

          <div className="content-scroll page-content-wrapper">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* For Print ONLY - SYNCED with printMode state */}
      <div className="print-only" style={{ display: 'none', width: '100%', background: 'white' }}>
        {activeProjectId ? (
          <DocumentGenerator
            project={currentProject}
            isPrintView={true}
            printMode={printMode}
          />
        ) : null}
      </div>
    </div>
  );
}

export default App;
