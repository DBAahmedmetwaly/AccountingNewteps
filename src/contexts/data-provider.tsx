"use client";

import React, { createContext, useContext, ReactNode, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { ref, onValue, set as fbSet, push as fbPush, remove as fbRemove, update as fbUpdate, runTransaction, Database, goOffline, goOnline, off } from 'firebase/database';
import { database } from '@/lib/firebase';
import localforage from 'localforage';

// --- Configuration for Partitioned Operational Data ---
export const PARTITION_CONFIG: Record<string, string> = {
    salesInvoices: 'date',
    posSales: 'date',
    salesReturns: 'date',
    posReturns: 'date',
    purchaseInvoices: 'date',
    purchaseReturns: 'date',
    purchaseOrders: 'date',
    stockInRecords: 'date',
    stockOutRecords: 'date',
    stockTransferRecords: 'date',
    stockAdjustmentRecords: 'date',
    stockIssuesToReps: 'date',
    stockReturnsFromReps: 'date',
    expenses: 'date',
    customerPayments: 'date',
    supplierPayments: 'date',
    treasuryTransactions: 'date',
    profitDistributions: 'date',
    employeeAdvances: 'date',
    employeeAdjustments: 'date',
    repRemittances: 'date',
    payrollRecords: 'date',
    priceChangeLogs: 'timestamp',
    gratuityLogs: 'date',
    gratuityDistributions: 'date',
    customerVisits: 'timestamp',
    loginHistory: 'timestamp',
    syncHistory: 'timestamp',
    posAuditLogs: 'date',
    depreciationRecords: 'date',
    inventoryClosings: 'closingDate'
};

const STATIC_NODES = [
    'users', 'roles', 'warehouses', 'settings', 'cashAccounts', 'licenses',
    'items', 'customers', 'suppliers', 'partners', 'itemGroups', 'itemSections',
    'itemCategories', 'itemSubCategories1', 'itemSubCategories2', 'inventoryZones',
    'inventorySections', 'itemColors', 'itemSizes', 'barcodeDesigns', 'posTerminals',
    'paymentMethods', 'sellers', 'restaurantTables', 'targets', 'snoozedRecommendations',
    'counters', 'inventory', 'heldInvoices', 'posCounters', 'fixedAssets'
];

interface DataContextType {
    // Master Data
    allItems: any[];
    items: any[];
    customers: any[];
    suppliers: any[];
    warehouses: any[];
    cashAccounts: any[];
    partners: any[];
    users: any[];
    deliveryStaff: any[];
    itemGroups: any[];
    itemSections: any[];
    itemCategories: any[];
    itemSubCategories1: any[];
    itemSubCategories2: any[];
    inventoryZones: any[];
    inventorySections: any[];
    itemColors: any[];
    itemSizes: any[];
    barcodeDesigns: any[];
    posTerminals: any[];
    promotions: any[];
    paymentMethods: any[];
    sellers: any[];
    roles: any; 
    settings: any;
    inventory: any[];
    restaurantTables: any[];
    targets: any;
    licenses: any[];
    snoozedRecommendations: any[];
    syncHistory: any[];
    customerVisits: any[]; 
    loginHistory: any[]; 

    // Inventory
    stockInRecords: any[];
    stockOutRecords: any[];
    stockTransferRecords: any[];
    stockAdjustmentRecords: any[];
    stockIssuesToReps: any[];
    stockReturnsFromReps: any[];
    inventoryClosings: any[];
    requisitions: any[];

    // Sales & Purchases
    salesInvoices: any[];
    salesReturns: any[];
    purchaseInvoices: any[];
    purchaseReturns: any[];
    purchaseOrders: any[];
    posSales: any[];
    posReturns: any[];
    posSessions: any[];
    posAuditLogs: any[];
    heldInvoices: any[];
    posCounters: any;

    // Accounting
    expenses: any[];
    exceptionalIncomes: any[];
    customerPayments: any[];
    supplierPayments: any[];
    treasuryTransactions: any[];
    profitDistributions: any[];
    priceChangeLogs: any[];
    gratuityLogs: any[];
    gratuityDistributions: any[];
    
    // HR
    employees: any[];
    employeeAdvances: any[];
    employeeAdjustments: any[];
    repRemittances: any[];
    payrollRecords: any[];
    
    // Assets
    fixedAssets: any[];
    depreciationRecords: any[];

    // Actions
    dbAction: (path: string, action: 'add' | 'update' | 'remove' | 'transaction', payload?: any, priority?: 'high' | 'normal' | 'low') => Promise<string | void>;
    getNextId: (counterName: string, startFrom?: number) => Promise<number | null>;

    loading: boolean;
    isOnline: boolean;
    syncQueueCount: number;
    unreconciledDeliveryCount: number; 
    processSyncQueue: () => Promise<void>;
    allData: any;
    goOffline: () => void;
    goOnline: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);
const SYNC_QUEUE_KEY = 'firebase-sync-queue';

// Helper to remove undefined properties recursively
const sanitize = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, sanitize(v)])
    );
  }
  return obj;
};

// Helper for partition path
export const getPartitionRelativePath = (collection: string, dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const day = `${yearMonth}-${String(d.getDate()).padStart(2, '0')}`;
    return `${yearMonth}/${day}`;
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [allData, setAllData] = useState<any>({});
    const [isOnline, setIsOnline] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [syncQueueCount, setSyncQueueCount] = useState(0);
    const idPathMap = useRef<Map<string, string>>(new Map());

    const updateQueueCount = useCallback(async () => {
        const queue = await localforage.getItem<any[]>(SYNC_QUEUE_KEY) || [];
        setSyncQueueCount(queue.length);
    }, []);

    const processSyncQueue = useCallback(async () => {
        if (!database || !isOnline) return;
        goOnline(database);
        let queue = await localforage.getItem<any[]>(SYNC_QUEUE_KEY) || [];
        if (queue.length === 0) return;
    
        const priorityMap: Record<string, number> = { high: 1, normal: 2, low: 3 };
        queue.sort((a, b) => {
            const pA = priorityMap[a.priority || 'normal'];
            const pB = priorityMap[b.priority || 'normal'];
            if (pA !== pB) return pA - pB;
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        });
        
        let i = 0;
        const successfullySynced: any[] = [];
        
        while(i < queue.length) {
            const queuedItem = queue[i];
            const { path, action, payload, id } = queuedItem;
            try {
                let originalId: string | undefined;
                const sanitizedPayload = sanitize(payload);

                if (action === 'add') {
                    const refToSet = id ? ref(database, `${path}/${id}`) : fbPush(ref(database, path));
                    originalId = id;
                    await fbSet(refToSet, sanitizedPayload);
                } else if (action === 'update') {
                    originalId = payload.id;
                    await fbUpdate(ref(database, `${path}/${payload.id}`), sanitizedPayload.data);
                } else if (action === 'remove') {
                    originalId = payload.id;
                    const finalPath = payload.root ? path : `${path}/${payload.id}`;
                    await fbRemove(ref(database, finalPath));
                } else if (action === 'transaction') {
                    await runTransaction(ref(database, path), (currentValue) => (currentValue || 0) + 1);
                }
    
                successfullySynced.push({ ...queuedItem, originalId, syncedAt: new Date().toISOString() });
                queue.shift(); 
                i = 0; 
            } catch (error) {
                console.error("Failed to sync item:", { path, action, payload }, error);
                if (database) goOffline(database);
                break; 
            }
        }
    
        await localforage.setItem(SYNC_QUEUE_KEY, queue);
        await updateQueueCount();

        if (successfullySynced.length > 0 && database) {
            const historyUpdates: any = {};
            successfullySynced.forEach(item => {
                if (database) {
                    const historyRef = fbPush(ref(database, 'syncHistory'));
                    if (historyRef.key) {
                        historyUpdates[historyRef.key] = item;
                    }
                }
            });
            await fbUpdate(ref(database, 'syncHistory'), historyUpdates);
        }
    
    }, [isOnline, updateQueueCount]);

    const handleGoOnline = useCallback(() => {
        if (database) {
            goOnline(database);
            setIsOnline(true);
            processSyncQueue();
        }
    }, [processSyncQueue]);

    const handleGoOffline = useCallback(() => {
        if (database) {
            goOffline(database);
            setIsOnline(false);
        }
    }, []);

    const flattenGroupedData = useCallback((node: any, collectionName: string) => {
        const records: any[] = [];
        if (!node || typeof node !== 'object') return records;

        const dateKeys = ['date', 'timestamp', 'startTime', 'heldAt', 'purchaseDate', 'closingDate'];

        const traverse = (current: any, id: string, currentPath: string) => {
            if (!current || typeof current !== 'object') return;
            
            // Check if this is a leaf node (a record)
            const dateKey = dateKeys.find(k => current[k]);
            
            if (dateKey) {
                records.push({ id: id, ...current });
                idPathMap.current.set(id, currentPath);
                return;
            }

            // Otherwise keep digging
            Object.entries(current).forEach(([key, value]) => {
                traverse(value, key, `${currentPath}/${key}`);
            });
        };

        // We start traversal from the top level children of the collection node
        Object.entries(node).forEach(([key, value]) => {
            traverse(value, key, `${collectionName}/${key}`);
        });

        return records;
    }, []);

    useEffect(() => {
        let isMounted = true;
        const listeners: any[] = [];

        const setupListeners = async () => {
             await updateQueueCount();
            try {
                const keys = await localforage.keys();
                const dataFromCache: any = {};
                for (const key of keys) {
                    if (key !== SYNC_QUEUE_KEY) {
                         dataFromCache[key] = await localforage.getItem(key);
                    }
                }

                if (isMounted && Object.keys(dataFromCache).length > 0) {
                    setAllData(dataFromCache);
                    setIsLoading(false);
                }
            } catch (error) {
                console.warn("Could not hydrate from localforage", error);
            } finally {
                 if (isMounted) setIsLoading(false);
            }
            
            if (!database) return;

            const allNodes = [...STATIC_NODES, ...Object.keys(PARTITION_CONFIG), 'counters', 'syncHistory', 'payrollRecords'];
            
            allNodes.forEach(nodePath => {
                if (!database) return;
                const dbRef = ref(database, nodePath);
                const unsubscribe = onValue(dbRef, (snapshot) => {
                    if (!isMounted) return;
                    const data = snapshot.val();
                    setAllData((prev: any) => ({ ...prev, [nodePath]: data }));
                    localforage.setItem(nodePath, data);
                }, (error) => {
                     console.error(`Firebase read failed for ${nodePath}:`, error.message);
                });
                listeners.push({ ref: dbRef, unsubscribe });
            });
        };

        setupListeners();

        return () => {
            isMounted = false;
            listeners.forEach(l => off(l.ref));
        };
    }, [updateQueueCount]); 
    
    // Master Data
    const allItems = useMemo(() => allData?.items ? Object.keys(allData.items).map(key => ({ id: key, ...allData.items[key] })) : [], [allData?.items]);
    const items = useMemo(() => allItems.filter(item => !item.isDisabled), [allItems]);
    const customers = useMemo(() => allData?.customers ? Object.keys(allData.customers).map(key => ({ id: key, ...allData.customers[key] })) : [], [allData?.customers]);
    const suppliers = useMemo(() => allData?.suppliers ? Object.keys(allData.suppliers).map(key => ({ id: key, ...allData.suppliers[key] })) : [], [allData?.suppliers]);
    const warehouses = useMemo(() => allData?.warehouses ? Object.keys(allData.warehouses).map(key => ({ id: key, ...allData.warehouses[key] })) : [], [allData?.warehouses]);
    const cashAccounts = useMemo(() => allData?.cashAccounts ? Object.keys(allData.cashAccounts).map(key => ({ id: key, ...allData.cashAccounts[key] })) : [], [allData?.cashAccounts]);
    const partners = useMemo(() => allData?.partners ? Object.keys(allData.partners).map(key => ({ id: key, ...allData.partners[key] })) : [], [allData?.partners]);
    const users = useMemo(() => allData?.users ? Object.keys(allData.users).map(key => ({ id: key, ...allData.users[key] })) : [], [allData?.users]);
    const deliveryStaff = useMemo(() => allData?.deliveryStaff ? Object.keys(allData.deliveryStaff).map(key => ({ id: key, ...allData.deliveryStaff[key] })) : [], [allData?.deliveryStaff]);
    const itemGroups = useMemo(() => allData?.itemGroups ? Object.keys(allData.itemGroups).map(key => ({ id: key, ...allData.itemGroups[key] })) : [], [allData?.itemGroups]);
    const itemSections = useMemo(() => allData?.itemSections ? Object.keys(allData.itemSections).map(key => ({ id: key, ...allData.itemSections[key] })) : [], [allData?.itemSections]);
    const itemCategories = useMemo(() => allData?.itemCategories ? Object.keys(allData.itemCategories).map(key => ({ id: key, ...allData.itemCategories[key] })) : [], [allData?.itemCategories]);
    const itemSubCategories1 = useMemo(() => allData?.itemSubCategories1 ? Object.keys(allData.itemSubCategories1).map(key => ({ id: key, ...allData.itemSubCategories1[key] })) : [], [allData?.itemSubCategories1]);
    const itemSubCategories2 = useMemo(() => allData?.itemSubCategories2 ? Object.keys(allData.itemSubCategories2).map(key => ({ id: key, ...allData.itemSubCategories2[key] })) : [], [allData?.itemSubCategories2]);
    const inventoryZones = useMemo(() => allData?.inventoryZones ? Object.keys(allData.inventoryZones).map(key => ({ id: key, ...allData.inventoryZones[key] })) : [], [allData?.inventoryZones]);
    const inventorySections = useMemo(() => allData?.inventorySections ? Object.keys(allData.inventorySections).map(key => ({ id: key, ...allData.inventorySections[key] })) : [], [allData?.inventorySections]);
    const itemColors = useMemo(() => allData?.itemColors ? Object.keys(allData.itemColors).map(key => ({ id: key, ...allData.itemColors[key] })) : [], [allData?.itemColors]);
    const itemSizes = useMemo(() => allData?.itemSizes ? Object.keys(allData.itemSizes).map(key => ({ id: key, ...allData.itemSizes[key] })) : [], [allData?.itemSizes]);
    const barcodeDesigns = useMemo(() => allData?.barcodeDesigns ? Object.keys(allData.barcodeDesigns).map(key => ({ id: key, ...allData.barcodeDesigns[key] })) : [], [allData?.barcodeDesigns]);
    const posTerminals = useMemo(() => allData?.posTerminals ? Object.keys(allData.posTerminals).map(key => ({ id: key, ...allData.posTerminals[key] })) : [], [allData?.posTerminals]);
    const promotions = useMemo(() => allData?.promotions ? Object.keys(allData.promotions).map(key => ({ id: key, ...allData.promotions[key] })) : [], [allData?.promotions]);
    const paymentMethods = useMemo(() => allData?.paymentMethods ? Object.keys(allData.paymentMethods).map(key => ({ id: key, ...allData.paymentMethods[key] })) : [], [allData?.paymentMethods]);
    const sellers = useMemo(() => allData?.sellers ? Object.keys(allData.sellers).map(key => ({ id: key, ...allData.sellers[key] })) : [], [allData?.sellers]);
    const roles = useMemo(() => allData?.roles || {}, [allData?.roles]);
    const settings = useMemo(() => allData?.settings || {}, [allData?.settings]);
    const licenses = useMemo(() => allData?.licenses ? Object.keys(allData.licenses).map(key => ({ id: key, ...allData.licenses[key] })) : [], [allData?.licenses]);
    const restaurantTables = useMemo(() => allData?.restaurantTables ? Object.keys(allData.restaurantTables).map(key => ({ id: key, ...allData.restaurantTables[key] })) : [], [allData?.restaurantTables]);
    const targets = useMemo(() => allData?.targets || {}, [allData?.targets]);
    const snoozedRecommendations = useMemo(() => allData?.snoozedRecommendations ? Object.keys(allData.snoozedRecommendations).map(key => ({ id: key, ...allData.snoozedRecommendations[key] })) : [], [allData?.snoozedRecommendations]);
    const syncHistory = useMemo(() => allData?.syncHistory ? Object.keys(allData.syncHistory).map(key => ({ id: key, ...allData.syncHistory[key] })) : [], [allData?.syncHistory]);
    const customerVisits = useMemo(() => allData?.customerVisits ? Object.keys(allData.customerVisits).map(key => ({ id: key, ...allData.customerVisits[key] })) : [], [allData?.customerVisits]);
    const loginHistory = useMemo(() => allData?.loginHistory ? Object.keys(allData.loginHistory).map(key => ({ id: key, ...allData.loginHistory[key] })) : [], [allData?.loginHistory]);
    const gratuityLogs = useMemo(() => flattenGroupedData(allData?.gratuityLogs, 'gratuityLogs'), [allData?.gratuityLogs, flattenGroupedData]);
    const gratuityDistributions = useMemo(() => flattenGroupedData(allData?.gratuityDistributions, 'gratuityDistributions'), [allData?.gratuityDistributions, flattenGroupedData]);

    const stockInRecords = useMemo(() => flattenGroupedData(allData?.stockInRecords, 'stockInRecords'), [allData?.stockInRecords, flattenGroupedData]);
    const stockOutRecords = useMemo(() => flattenGroupedData(allData?.stockOutRecords, 'stockOutRecords'), [allData?.stockOutRecords, flattenGroupedData]);
    const stockTransferRecords = useMemo(() => flattenGroupedData(allData?.stockTransferRecords, 'stockTransferRecords'), [allData?.stockTransferRecords, flattenGroupedData]);
    const stockAdjustmentRecords = useMemo(() => flattenGroupedData(allData?.stockAdjustmentRecords, 'stockAdjustmentRecords'), [allData?.stockAdjustmentRecords, flattenGroupedData]);
    const stockIssuesToReps = useMemo(() => flattenGroupedData(allData?.stockIssuesToReps, 'stockIssuesToReps'), [allData?.stockIssuesToReps, flattenGroupedData]);
    const stockReturnsFromReps = useMemo(() => flattenGroupedData(allData?.stockReturnsFromReps, 'stockReturnsFromReps'), [allData?.stockReturnsFromReps, flattenGroupedData]);
    const inventoryClosings = useMemo(() => allData?.inventoryClosings ? Object.keys(allData.inventoryClosings).map(key => ({ id: key, ...allData.inventoryClosings[key] })) : [], [allData?.inventoryClosings]);
    const requisitions = useMemo(() => allData?.requisitions ? Object.keys(allData.requisitions).map(key => ({ id: key, ...allData.requisitions[key] })) : [], [allData?.requisitions]);
    
    const salesInvoices = useMemo(() => flattenGroupedData(allData?.salesInvoices, 'salesInvoices'), [allData?.salesInvoices, flattenGroupedData]);
    const salesReturns = useMemo(() => flattenGroupedData(allData?.salesReturns, 'salesReturns'), [allData?.salesReturns, flattenGroupedData]);
    const purchaseInvoices = useMemo(() => flattenGroupedData(allData?.purchaseInvoices, 'purchaseInvoices'), [allData?.purchaseInvoices, flattenGroupedData]);
    const purchaseReturns = useMemo(() => flattenGroupedData(allData?.purchaseReturns, 'purchaseReturns'), [allData?.purchaseReturns, flattenGroupedData]);
    const purchaseOrders = useMemo(() => flattenGroupedData(allData?.purchaseOrders, 'purchaseOrders'), [allData?.purchaseOrders, flattenGroupedData]);
    const posSales = useMemo(() => flattenGroupedData(allData?.posSales, 'posSales'), [allData?.posSales, flattenGroupedData]);
    const posReturns = useMemo(() => flattenGroupedData(allData?.posReturns, 'posReturns'), [allData?.posReturns, flattenGroupedData]);
    const posSessions = useMemo(() => allData?.posSessions ? Object.keys(allData.posSessions).map(key => ({ id: key, ...allData.posSessions[key] })) : [], [allData?.posSessions]);
    const posAuditLogs = useMemo(() => flattenGroupedData(allData?.posAuditLogs, 'posAuditLogs'), [allData?.posAuditLogs, flattenGroupedData]);
    const heldInvoices = useMemo(() => allData?.heldInvoices ? Object.keys(allData.heldInvoices).map(key => ({ id: key, ...allData.heldInvoices[key] })) : [], [allData?.heldInvoices]);
    const posCounters = useMemo(() => allData?.posCounters || {}, [allData?.posCounters]);
    
    // Accounting
    const expenses = useMemo(() => flattenGroupedData(allData?.expenses, 'expenses'), [allData?.expenses, flattenGroupedData]);
    const exceptionalIncomes = useMemo(() => flattenGroupedData(allData?.exceptionalIncomes, 'exceptionalIncomes'), [allData?.exceptionalIncomes, flattenGroupedData]);
    const customerPayments = useMemo(() => flattenGroupedData(allData?.customerPayments, 'customerPayments'), [allData?.customerPayments, flattenGroupedData]);
    const supplierPayments = useMemo(() => flattenGroupedData(allData?.supplierPayments, 'supplierPayments'), [allData?.supplierPayments, flattenGroupedData]);
    const treasuryTransactions = useMemo(() => flattenGroupedData(allData?.treasuryTransactions, 'treasuryTransactions'), [allData?.treasuryTransactions, flattenGroupedData]);
    const profitDistributions = useMemo(() => flattenGroupedData(allData?.profitDistributions, 'profitDistributions'), [allData?.profitDistributions, flattenGroupedData]);
    const priceChangeLogs = useMemo(() => flattenGroupedData(allData?.priceChangeLogs, 'priceChangeLogs'), [allData?.priceChangeLogs, flattenGroupedData]);
    
    // HR
    const employees = useMemo(() => allData?.employees ? Object.keys(allData.employees).map(key => ({ id: key, ...allData.employees[key] })) : [], [allData?.employees]);
    const employeeAdvances = useMemo(() => flattenGroupedData(allData?.employeeAdvances, 'employeeAdvances'), [allData?.employeeAdvances, flattenGroupedData]);
    const employeeAdjustments = useMemo(() => flattenGroupedData(allData?.employeeAdjustments, 'employeeAdjustments'), [allData?.employeeAdjustments, flattenGroupedData]);
    const repRemittances = useMemo(() => flattenGroupedData(allData?.repRemittances, 'repRemittances'), [allData?.repRemittances, flattenGroupedData]);
    const payrollRecords = useMemo(() => flattenGroupedData(allData?.payrollRecords, 'payrollRecords'), [allData?.payrollRecords, flattenGroupedData]);
    
    // Assets
    const fixedAssets = useMemo(() => flattenGroupedData(allData?.fixedAssets, 'fixedAssets'), [allData?.fixedAssets, flattenGroupedData]);
    const depreciationRecords = useMemo(() => flattenGroupedData(allData?.depreciationRecords, 'depreciationRecords'), [allData?.depreciationRecords, flattenGroupedData]);

    const inventory = useMemo(() => {
        if (!allData?.inventory) return [];
        const result: any[] = [];
        Object.keys(allData.inventory).forEach(warehouseId => {
            Object.keys(allData.inventory[warehouseId]).forEach(sectionId => {
                const sectionData = allData.inventory[warehouseId][sectionId];
                if (sectionData && typeof sectionData === 'object') {
                    result.push({ id: `${warehouseId}-${sectionId}`, warehouseId, sectionId, items: sectionData });
                }
            });
        });
        return result;
    }, [allData?.inventory]);
    
    const unreconciledDeliveryCount = useMemo(() => {
        const allSales = [...salesInvoices, ...posSales];
        return allSales.filter(inv => (inv as any).isDelivery && !(inv as any).deliveryReconciled).length;
    }, [salesInvoices, posSales]);


    const getNextId = useCallback(async (counterName: string, startFrom = 1): Promise<number | null> => {
        const path = `counters/${counterName}`;
        if (!isOnline) {
             const queue = await localforage.getItem<any[]>(SYNC_QUEUE_KEY) || [];
             const localCounterKey = `counter_${counterName}`;
             const lastLocalValue = await localforage.getItem<number>(localCounterKey);
             const newValue = (lastLocalValue || (allData?.counters?.[counterName] || startFrom - 1)) + 1;
             await localforage.setItem(localCounterKey, newValue);
             queue.push({ path, action: 'transaction', timestamp: new Date().toISOString() });
             await localforage.setItem(SYNC_QUEUE_KEY, queue);
             await updateQueueCount();
             return newValue;
        }

        if (!database) return null;
        const counterRef = ref(database, path);
        try {
          const { committed, snapshot } = await runTransaction(counterRef, (currentValue) => {
              if (currentValue === null) return startFrom;
              return currentValue + 1;
          });
          return committed ? snapshot.val() : null;
        } catch (e: any) {
            console.error('Failed to get next ID:', e);
            return null;
        }
    }, [isOnline, allData?.counters, updateQueueCount]);

    const dbAction = useCallback(async (path: string, action: 'add' | 'update' | 'remove' | 'transaction', payload?: any, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<string | void> => {
        const sanitizedPayload = sanitize(payload);
        let finalPath = path;

        // Auto-partitioning logic for 'add'
        if (action === 'add' && PARTITION_CONFIG[path]) {
            const dateKey = PARTITION_CONFIG[path];
            const dateVal = sanitizedPayload[dateKey];
            if (dateVal) {
                const partitionRel = getPartitionRelativePath(path, dateVal);
                if (partitionRel) finalPath = `${path}/${partitionRel}`;
            }
        }

        // Resolved path logic for 'update' and 'remove'
        if ((action === 'update' || action === 'remove') && !payload.root) {
             const resolved = idPathMap.current.get(payload.id);
             if (resolved) finalPath = resolved;
             else if (action === 'update') finalPath = `${path}/${payload.id}`;
        }

        const performAction = async (db: Database | null) => {
            if (!db) throw new Error("Database not initialized");
            if (action === 'add') {
                const newRef = fbPush(ref(db, finalPath));
                await fbSet(newRef, sanitizedPayload);
                return newRef.key || undefined;
            } else if (action === 'update') {
                await fbUpdate(ref(db, finalPath), sanitizedPayload.data);
            } else if (action === 'remove') {
                const p = payload.root ? finalPath : (idPathMap.current.get(payload.id) || `${finalPath}/${payload.id}`);
                await fbRemove(ref(db, p));
            } else if (action === 'transaction') {
                await runTransaction(ref(db, payload.path), (cv) => (cv || 0) + 1);
            }
        };

        if (!isOnline) {
            const queue = await localforage.getItem<any[]>(SYNC_QUEUE_KEY) || [];
            let newId: any;
            const timestamp = new Date().toISOString();
            if (action === 'add') {
                newId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                queue.push({ path: finalPath, action, payload: sanitizedPayload, id: newId, timestamp, priority });
            } else {
                 queue.push({ path: finalPath, action, payload: sanitizedPayload, timestamp, priority });
            }
            await localforage.setItem(SYNC_QUEUE_KEY, queue);
            await updateQueueCount();
            return newId;
        } else {
            return performAction(database);
        }
    }, [isOnline, updateQueueCount]);

    const value = {
        allItems, items, customers, suppliers, warehouses, cashAccounts, partners, users, deliveryStaff, itemGroups, itemSections, itemCategories, itemSubCategories1, itemSubCategories2, inventoryZones, inventorySections, itemColors, itemSizes, barcodeDesigns, posTerminals, promotions, roles, settings, inventory, restaurantTables, paymentMethods, sellers, targets, licenses, snoozedRecommendations, syncHistory, customerVisits, loginHistory, gratuityLogs, gratuityDistributions,
        stockInRecords, stockOutRecords, stockTransferRecords, stockAdjustmentRecords, stockIssuesToReps, stockReturnsFromReps, inventoryClosings, requisitions,
        salesInvoices, salesReturns, purchaseInvoices, purchaseReturns, posSales, posReturns, posSessions, posAuditLogs, heldInvoices, posCounters,
        expenses, exceptionalIncomes, customerPayments, supplierPayments, treasuryTransactions, profitDistributions, priceChangeLogs,
        purchaseOrders,
        employees, employeeAdvances, employeeAdjustments, repRemittances, payrollRecords, fixedAssets, depreciationRecords,
        dbAction, getNextId,
        loading: isLoading,
        isOnline,
        syncQueueCount,
        unreconciledDeliveryCount,
        processSyncQueue,
        allData,
        goOffline: handleGoOffline,
        goOnline: handleGoOnline
    };
    
    if (isLoading && !Object.keys(allData).length) {
         return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /><p className="mr-2">جارٍ التحميل...</p></div>;
    }

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (context === undefined) throw new Error('useData must be used within a DataProvider');
  return context;
};