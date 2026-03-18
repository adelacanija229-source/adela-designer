import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Briefcase, FileText, Calculator, Printer, ShoppingBag, Book, Image, Upload, Layers, ClipboardList, X } from 'lucide-react';
import { ADELA_LOGO_B64 } from '../assets/logo';
import { STORES, offlineStore } from '../db/offlineStore';

const Sidebar = ({ activeTab, setActiveTab, onBackgroundUpload, hasPriceUpdate, isOpen, onClose }) => {
    const fileInputRef = useRef(null);
    const logoInputRef = useRef(null);
    const [customLogo, setCustomLogo] = useState(null);

  const updateFavicon = useCallback((logoB64) => {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = logoB64;
  }, []);

  const loadSavedLogo = useCallback(async () => {
    try {
      const savedLogo = await offlineStore.getById(STORES.SETTINGS, 'custom_logo');
      if (savedLogo && savedLogo.value) {
        setCustomLogo(savedLogo.value);
        updateFavicon(savedLogo.value);
      } else {
        updateFavicon(ADELA_LOGO_B64);
      }
    } catch (err) {
      console.error('Failed to load saved logo:', err);
      updateFavicon(ADELA_LOGO_B64);
    }
  }, [updateFavicon]);

  useEffect(() => {
    loadSavedLogo();
  }, [loadSavedLogo]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("로고 이미지는 2MB 이하로 업로드해주세요.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      setCustomLogo(base64String);
      updateFavicon(base64String);
      await offlineStore.save(STORES.SETTINGS, {
        id: 'custom_logo',
        value: base64String
      });
    };
    reader.readAsDataURL(file);
  };

    const menuGroups = [
        {
            title: 'PROJECT MANAGEMENT',
            items: [
                { id: 'projects', icon: <Briefcase size={20} />, label: '현장 정보 (기본설정)' },
                { id: 'meetings', icon: <FileText size={20} />, label: '디자인 미팅 회의록' },
                { id: 'estimates', icon: <Calculator size={20} />, label: '견적 / 변경 관리' },
                { id: 'furniture', icon: <ShoppingBag size={20} />, label: '가구 / 별도 계약' },
            ]
        },
        {
            title: 'CONSTRUCTION SPECS',
            items: [
                { id: 'specs', icon: <ClipboardList size={20} />, label: '공간별 스펙' },
            ]
        },
        {
            title: 'LIBRARIES',
            items: [
                { id: 'materials', icon: <Layers size={20} />, label: '마감재 라이브러리' },
                { id: 'library', icon: <Book size={20} />, label: '단가 라이브러리' },
            ]
        },
        {
            title: 'EXPORT',
            items: [
                { id: 'export', icon: <Printer size={20} />, label: '최종 문서 출력' },
            ]
        }
    ];

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <nav className={`sidebar ${isOpen ? 'open' : ''}`}>
            {/* Mobile close button */}
            <button 
                className="no-print"
                onClick={onClose}
                style={{
                    display: 'none', /* Shown only via media query effectively, or just handle via float */
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    zIndex: 20
                }}
                id="sidebar-close-btn"
            >
                <X size={24} />
            </button>

            <div className="sidebar-header">
                <div 
                    className="logo-container" 
                    style={{ padding: '0 12px', cursor: 'pointer', position: 'relative' }}
                    onClick={() => {
                        setActiveTab('projects');
                        if (onClose) onClose();
                    }}
                >
                    <img 
                        src={customLogo || ADELA_LOGO_B64} 
                        alt="ADELA DESIGN TEAM" 
                        style={{ width: '100%', maxWidth: '160px', height: 'auto', display: 'block', margin: '0', filter: 'drop-shadow(0 0 4px rgba(255, 255, 255, 0.2))' }} 
                    />
                    <div 
                        onClick={(e) => { e.stopPropagation(); logoInputRef.current?.click(); }}
                        style={{ position: 'absolute', right: '0', bottom: '0', background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '4px', display: 'flex' }}
                        title="로고 변경"
                    >
                        <Upload size={10} color="white" />
                    </div>
                    <input 
                        type="file" 
                        ref={logoInputRef} 
                        style={{ display: 'none' }} 
                        accept="image/*" 
                        onChange={handleLogoUpload} 
                    />
                </div>
            </div>

            <div className="sidebar-menu">
                {menuGroups.map((group, groupIndex) => (
                    <div key={groupIndex} style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: 'rgba(255, 255, 255, 0.7)', letterSpacing: '0.05em', padding: '0 24px', marginBottom: '8px' }}>
                            {group.title}
                        </div>
                        {group.items.map(menu => (
                            <div
                                key={menu.id}
                                className={`nav-item ${activeTab === menu.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(menu.id)}
                            >
                                <div className="nav-icon-box">
                                    {menu.icon}
                                </div>
                                <span className="nav-label">{menu.label}</span>
                                {menu.id === 'library' && hasPriceUpdate && (
                                    <div style={{
                                        width: '8px', 
                                        height: '8px', 
                                        marginLeft: 'auto', 
                                        marginRight: '8px',
                                        backgroundColor: '#ef4444', 
                                        borderRadius: '50%',
                                        boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)'
                                    }} />
                                )}
                                {activeTab === menu.id && <div className="active-glow" />}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div className="sidebar-footer">
                <div className="footer-status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="status-dot green" />
                        <span>System Online</span>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={onBackgroundUpload}
                    />
                    <button
                        className="bg-upload-btn"
                        onClick={handleUploadClick}
                        title="배경화면 설정"
                    >
                        <Image size={16} />
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default Sidebar;
