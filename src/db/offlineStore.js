import { openDB } from 'idb';

const DB_NAME = 'adela_workspace_db';
const DB_VERSION = 4;

export const STORES = {
    PROJECTS: 'projects',
    MEETING_LOGS: 'meetingLogs',
    ESTIMATES: 'estimates',
    FURNITURE: 'furniture',
    PRICE_LIBRARY: 'price_library',
    SETTINGS: 'settings',
    DESIGNER_MEMOS: 'designer_memos',
    MATERIAL_LIBRARY: 'material_library',
    CONSTRUCTION_SPECS: 'construction_specs'
};

let dbPromise = null;

export const initDB = async () => {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION + 2, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
                    db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.MEETING_LOGS)) {
                    const store = db.createObjectStore(STORES.MEETING_LOGS, { keyPath: 'id' });
                    store.createIndex('projectId', 'projectId');
                }
                if (!db.objectStoreNames.contains(STORES.ESTIMATES)) {
                    const store = db.createObjectStore(STORES.ESTIMATES, { keyPath: 'id' });
                    store.createIndex('projectId', 'projectId');
                }
                if (!db.objectStoreNames.contains(STORES.FURNITURE)) {
                    const store = db.createObjectStore(STORES.FURNITURE, { keyPath: 'id' });
                    store.createIndex('projectId', 'projectId');
                }
                if (!db.objectStoreNames.contains(STORES.PRICE_LIBRARY)) {
                    const store = db.createObjectStore(STORES.PRICE_LIBRARY, { keyPath: 'id' });
                    store.createIndex('category', 'category');
                }
                if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                    db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.DESIGNER_MEMOS)) {
                    const store = db.createObjectStore(STORES.DESIGNER_MEMOS, { keyPath: 'id' });
                    store.createIndex('projectId', 'projectId');
                }
                if (!db.objectStoreNames.contains(STORES.MATERIAL_LIBRARY)) {
                    const store = db.createObjectStore(STORES.MATERIAL_LIBRARY, { keyPath: 'id' });
                    store.createIndex('category', 'category');
                }
                if (!db.objectStoreNames.contains(STORES.CONSTRUCTION_SPECS)) {
                    const store = db.createObjectStore(STORES.CONSTRUCTION_SPECS, { keyPath: 'id' });
                    store.createIndex('projectId', 'projectId');
                }
            },
        });
    }
    return dbPromise;
};

export const offlineStore = {
    async getAll(storeName) {
        const db = await initDB();
        return db.getAll(storeName);
    },

    async getById(storeName, id) {
        const db = await initDB();
        return db.get(storeName, id);
    },

    async getByIndex(storeName, indexName, key) {
        const db = await initDB();
        return db.getAllFromIndex(storeName, indexName, key);
    },

    async save(storeName, item) {
        const db = await initDB();
        if (!item.id) {
            item.id = crypto.randomUUID();
        }
        item.updatedAt = new Date().toISOString();
        await db.put(storeName, item);
        return item;
    },

    async delete(storeName, id) {
        const db = await initDB();
        await db.delete(storeName, id);
        return true;
    },

    async exportProject(projectId) {
        const project = await this.getById(STORES.PROJECTS, projectId);
        if (!project) return null;

        const data = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            project,
            meetingLogs: await this.getByIndex(STORES.MEETING_LOGS, 'projectId', projectId),
            estimates: await this.getByIndex(STORES.ESTIMATES, 'projectId', projectId),
            furniture: await this.getByIndex(STORES.FURNITURE, 'projectId', projectId),
            designerMemos: await this.getByIndex(STORES.DESIGNER_MEMOS, 'projectId', projectId),
            constructionSpecs: await this.getByIndex(STORES.CONSTRUCTION_SPECS, 'projectId', projectId)
        };
        return data;
    },

    async importProject(data) {
        if (!data || !data.project || !data.project.id) throw new Error('올바르지 않은 프로젝트 파일입니다.');
        
        const { project, meetingLogs, estimates, furniture, designerMemos, constructionSpecs } = data;
        const db = await initDB();

        // Save project main record
        await db.put(STORES.PROJECTS, project);
        
        // Save related records
        for (const item of (meetingLogs || [])) await db.put(STORES.MEETING_LOGS, item);
        for (const item of (estimates || [])) await db.put(STORES.ESTIMATES, item);
        for (const item of (furniture || [])) await db.put(STORES.FURNITURE, item);
        for (const item of (designerMemos || [])) await db.put(STORES.DESIGNER_MEMOS, item);
        for (const item of (constructionSpecs || [])) await db.put(STORES.CONSTRUCTION_SPECS, item);
        
        return project.id;
    }
};
