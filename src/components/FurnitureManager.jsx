import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Camera, Upload, ExternalLink, FileText, Printer } from 'lucide-react';
import { offlineStore, STORES } from '../db/offlineStore';

const FurnitureManager = ({ project, onSaved, onPrint }) => {
    const [furniture, setFurniture] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadFurniture = async () => {
        if (!project?.id) return;
        setLoading(true);
        try {
            const list = await offlineStore.getByIndex(STORES.FURNITURE, 'projectId', project.id);
            setFurniture(Array.isArray(list) ? list : []);
        } catch (error) {
            console.error('Failed to load furniture:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (project?.id) {
            loadFurniture();
        }
    }, [project]);

    const addFurniture = async () => {
        const newItem = {
            projectId: project.id,
            name: '',
            spec: '',
            price: 0,
            image: null,
            remarks: '',
            link: ''
        };
        const saved = await offlineStore.save(STORES.FURNITURE, newItem);
        setFurniture([...furniture, saved]);
        window.dispatchEvent(new Event('db-updated'));
    };

    const updateItem = async (id, field, value) => {
        const updated = furniture.map(item => {
            if (item.id === id) {
                const newItem = { ...item, [field]: value };
                offlineStore.save(STORES.FURNITURE, newItem);
                return newItem;
            }
            return item;
        });
        setFurniture(updated);
        window.dispatchEvent(new Event('db-updated'));
    };

    const handleImageChange = (id, e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                updateItem(id, 'image', reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const deleteItem = async (id) => {
        if (window.confirm('가구 항목을 삭제하시겠습니까?')) {
            await offlineStore.delete(STORES.FURNITURE, id);
            setFurniture(furniture.filter(item => item.id !== id));
            window.dispatchEvent(new Event('db-updated'));
        }
    };

    const totalFurniture = Array.isArray(furniture) ? furniture.reduce((acc, item) => acc + item.price, 0) : 0;

    const handleImageUploads = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const promises = files.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        });

        const newImages = await Promise.all(promises);
        const currentImages = Array.isArray(project?.furnitureEstimateImages) ? project.furnitureEstimateImages :
            (project?.furnitureEstimateImage ? [project.furnitureEstimateImage] : []);

        const updatedProject = { ...project, furnitureEstimateImages: [...currentImages, ...newImages], furnitureEstimateImage: null };
        await offlineStore.save(STORES.PROJECTS, updatedProject);
        if (onSaved) onSaved();
        window.dispatchEvent(new Event('db-updated'));
    };

    const handleRemoveImage = async (index) => {
        if (window.confirm('선택한 이미지를 삭제하시겠습니까?')) {
            const currentImages = Array.isArray(project?.furnitureEstimateImages) ? project.furnitureEstimateImages :
                (project?.furnitureEstimateImage ? [project.furnitureEstimateImage] : []);
            const newImages = currentImages.filter((_, i) => i !== index);
            const updatedProject = { ...project, furnitureEstimateImages: newImages, furnitureEstimateImage: null };
            await offlineStore.save(STORES.PROJECTS, updatedProject);
            if (onSaved) onSaved();
            window.dispatchEvent(new Event('db-updated'));
        }
    };

    const handlePdfUpload = (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const updatedProject = { ...project, furnitureEstimatePdf: reader.result };
                await offlineStore.save(STORES.PROJECTS, updatedProject);
                if (onSaved) onSaved();
                window.dispatchEvent(new Event('db-updated'));
            };
            reader.readAsDataURL(file);
        } else if (file) {
            alert('PDF 파일만 업로드 가능합니다.');
        }
    };

    const handlePdfRemove = async () => {
        if (window.confirm('PDF 견적서를 삭제하시겠습니까?')) {
            const updatedProject = { ...project, furnitureEstimatePdf: null };
            await offlineStore.save(STORES.PROJECTS, updatedProject);
            if (onSaved) onSaved();
            window.dispatchEvent(new Event('db-updated'));
        }
    };

    const estimateImages = Array.isArray(project?.furnitureEstimateImages) ? project.furnitureEstimateImages :
        (project?.furnitureEstimateImage ? [project.furnitureEstimateImage] : []);

    if (loading) return <div className="empty-state">데이터를 불러오는 중...</div>;

    return (
        <div className="furniture-manager" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h2 className="page-title" style={{ fontSize: '28px', color: 'var(--accent-deep)' }}>Furniture & Special Contract</h2>
                    <p className="page-desc" style={{ color: 'var(--text-muted)', fontSize: '15px' }}>가구 품목의 사양과 이미지, 별도 계약 정보를 관리합니다.</p>
                </div>
                <button className="btn btn-outline no-print" onClick={onPrint}>
                    <Printer size={16} /> 인쇄하기
                </button>
            </div>

            <div className="" style={{ marginBottom: '40px', padding: '0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent-deep)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={20} style={{ color: 'var(--accent-soft)' }} /> 통합 가구 견적서
                    </h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ position: 'relative' }}>
                            <button className="btn btn-outline" style={{ pointerEvents: 'none' }}>
                                <Upload size={16} /> PDF 첨부
                            </button>
                            <input
                                type="file"
                                accept="application/pdf"
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                onChange={handlePdfUpload}
                            />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <button className="btn btn-outline" style={{ pointerEvents: 'none' }}>
                                <Upload size={16} /> 이미지 첨부
                            </button>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                onChange={handleImageUploads}
                            />
                        </div>
                    </div>
                </div>

                {project.furnitureEstimatePdf && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '20px',
                        borderRadius: 'var(--radius-lg)',
                        marginBottom: '20px',
                        background: 'rgba(255,255,255,0.5)',
                        border: '1px solid var(--border-color)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#FFF5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FileText size={20} color="#E53E3E" />
                            </div>
                            <div>
                                <div style={{ fontWeight: '700', color: 'var(--accent-deep)' }}>첨부된 PDF 견적서</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>통합 가구 견적서 파일이 등록되었습니다.</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn btn-outline" onClick={() => {
                                try {
                                    const base64Data = project.furnitureEstimatePdf.split(',')[1];
                                    const byteCharacters = atob(base64Data);
                                    const byteNumbers = new Array(byteCharacters.length);
                                    for (let i = 0; i < byteCharacters.length; i++) {
                                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                                    }
                                    const byteArray = new Uint8Array(byteNumbers);
                                    const blob = new Blob([byteArray], { type: 'application/pdf' });
                                    const blobUrl = URL.createObjectURL(blob);
                                    window.open(blobUrl, '_blank');
                                } catch (error) {
                                    console.error("PDF 열기 오류:", error);
                                    alert('PDF를 여는 중 오류가 발생했습니다.');
                                }
                            }}>
                                <ExternalLink size={16} /> 열기 / 인쇄
                            </button>
                            <button className="btn btn-outline" style={{ color: '#E53E3E', borderColor: 'rgba(229, 62, 62, 0.2)' }} onClick={handlePdfRemove}>
                                <Trash2 size={16} /> 삭제
                            </button>
                        </div>
                    </div>
                )}

                {estimateImages.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                        {estimateImages.map((img, idx) => (
                            <div key={idx} className="furniture-image-card">
                                <img src={img} alt={`견적서 ${idx + 1}`} />
                                <button className="remove-image-btn" onClick={() => handleRemoveImage(idx)}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    !project.furnitureEstimatePdf && (
                        <div className="empty-state" style={{ padding: '40px', borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.3)', border: '1px dashed var(--border-color)' }}>
                            <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px', opacity: 0.5 }} />
                            <p>등록된 통합 견적서가 없습니다.</p>
                        </div>
                    )
                )}
            </div>

            <div className="" style={{ padding: '0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div className="summary-dashboard">
                        <div className="summary-item">
                            <span className="label">가구 합계 (별도)</span>
                            <span className="value">₩ {totalFurniture.toLocaleString()}</span>
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={addFurniture} style={{ borderRadius: 'var(--radius-max)' }}>
                        <Plus size={18} /> 개별 가구 추가
                    </button>
                </div>

                <div className="furniture-grid">
                    {!furniture || furniture.length === 0 ? (
                        <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '60px' }}>
                            <Camera size={40} style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.3 }} />
                            <p>등록된 개별 가구 정보가 없습니다.</p>
                        </div>
                    ) : (
                        furniture.map(item => (
                            <div key={item.id} className="furniture-premium-card">
                                <div className="card-image-area">
                                    {item.image ? (
                                        <img src={item.image} alt={item.name} />
                                    ) : (
                                        <div className="image-placeholder">
                                            <Camera size={32} />
                                            <span>이미지 업로드</span>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="image-upload-overlay"
                                        onChange={(e) => handleImageChange(item.id, e)}
                                    />
                                </div>
                                <div className="card-content">
                                    <input
                                        className="item-name-input"
                                        placeholder="가구 명칭 입력"
                                        value={item.name}
                                        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                    />
                                    <textarea
                                        className="item-spec-input"
                                        placeholder="상세 사양 (자재, 하드웨어 등)"
                                        value={item.spec}
                                        onChange={(e) => updateItem(item.id, 'spec', e.target.value)}
                                    />
                                    <div className="item-footer">
                                        <div className="price-box">
                                            <span className="unit">₩</span>
                                            <input
                                                type="number"
                                                className="price-input"
                                                value={item.price}
                                                onChange={(e) => updateItem(item.id, 'price', Number(e.target.value))}
                                                onFocus={(e) => e.target.select()}
                                            />
                                        </div>
                                        <button className="delete-icon-btn" onClick={() => deleteItem(item.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <style>{`
                .furniture-image-card {
                    position: relative;
                    border-radius: var(--radius-md);
                    overflow: hidden;
                    aspect-ratio: 16/10;
                    border: 1px solid var(--border-color);
                    background: white;
                }
                .furniture-image-card img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }
                .remove-image-btn {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.9);
                    border: 1px solid var(--border-color);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #E53E3E;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .remove-image-btn:hover {
                    background: #E53E3E;
                    color: white;
                    transform: scale(1.1);
                }

                .summary-dashboard {
                    background: var(--accent-deep);
                    padding: 16px 32px;
                    border-radius: var(--radius-max);
                    color: white;
                    box-shadow: 0 10px 25px -5px rgba(125, 110, 102, 0.3);
                }
                .summary-item {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                .summary-item .label {
                    font-size: 13px;
                    color: rgba(255, 255, 255, 0.7);
                    font-weight: 500;
                }
                .summary-item .value {
                    font-size: 24px;
                    font-weight: 800;
                    font-family: 'Outfit', sans-serif;
                }

                .furniture-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 28px;
                }
                .furniture-premium-card {
                    background: white;
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    border: 1px solid var(--border-color);
                    transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
                    display: flex;
                    flex-direction: column;
                }
                .furniture-premium-card:hover {
                    transform: translateY(-8px);
                    box-shadow: var(--shadow-soft);
                    border-color: var(--accent-soft);
                }
                .card-image-area {
                    height: 220px;
                    background: #FDFCFB;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-bottom: 1px solid var(--border-color);
                }
                .card-image-area img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .image-placeholder {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    color: var(--text-muted);
                    font-size: 13px;
                }
                .image-upload-overlay {
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    opacity: 0;
                    cursor: pointer;
                }
                .card-content {
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }
                .item-name-input {
                    font-size: 18px;
                    font-weight: 800;
                    color: var(--accent-deep);
                    border: none;
                    background: transparent;
                    padding: 0;
                    width: 100%;
                }
                .item-name-input:focus { outline: none; }
                .item-spec-input {
                    min-height: 90px;
                    font-size: 14px;
                    line-height: 1.6;
                    color: var(--accent-deep);
                    background: var(--bg-base);
                    border: none;
                    border-radius: var(--radius-md);
                    padding: 12px;
                    resize: none;
                }
                .item-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 4px;
                }
                .price-box {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--accent-deep);
                }
                .price-box .unit { font-weight: 700; color: var(--accent-soft); }
                .price-box .price-input {
                    font-size: 20px;
                    font-weight: 800;
                    font-family: 'Outfit', sans-serif;
                    border: none;
                    background: transparent;
                    width: 140px;
                    text-align: right;
                }
                .price-box .price-input:focus { outline: none; }
                .delete-icon-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    border: 1px solid var(--border-color);
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .delete-icon-btn:hover {
                    background: #FFF5F5;
                    color: #E53E3E;
                    border-color: #FED7D7;
                }
            `}</style>
        </div>
    );
};

export default FurnitureManager;
