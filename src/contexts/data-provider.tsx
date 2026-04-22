
"use client";

import React, { createContext, useContext, ReactNode, useEffect, useMemo, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { ref, onValue, set as fbSet, push as fbPush, remove as fbRemove, update as fbUpdate, runTransaction, Database, goOffline, goOnline } from 'firebase/database';
import { database } from '@/lib/firebase';
import localforage from 'localforage';


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
    customerVisits: any[]; // New
    loginHistory: any[]; // New

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
    unreconciledDeliveryCount: number; // New
    processSyncQueue: () => Promise<void>;
    allData: any;
    goOffline: () => void;
    goOnline: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);
const SYNC_QUEUE_KEY = 'firebase-sync-queue';

// Helper to remove undefined properties recursively to prevent Firebase errors
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

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [allData, setAllData] = useState<any>({});
    const [isOnline, setIsOnline] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [syncQueueCount, setSyncQueueCount] = useState(0);

    const updateQueueCount = useCallback(async () => {
        const queue = await localforage.getItem<any[]>(SYNC_QUEUE_KEY) || [];
        setSyncQueueCount(queue.length);
    }, []);

    const processSyncQueue = useCallback(async () => {
        if (!database || !isOnline) return;
        goOnline(database);
        let queue = await localforage.getItem<any[]>(SYNC_QUEUE_KEY) || [];
        if (queue.length === 0) return;
    
        console.log(`Processing ${queue.length} items from sync queue.`);

        // Sort queue by priority and timestamp
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
    
                console.log(`Successfully synced item ${i + 1}/${queue.length}.`);
                successfullySynced.push({ ...queuedItem, originalId, syncedAt: new Date().toISOString() });
                queue.shift(); 
                i = 0; // Reset index
            } catch (error) {
                console.error("Failed to sync item, it will be retried later:", { path, action, payload }, error);
                if (database) goOffline(database);
                break; 
            }
        }
    
        // Update localforage with the remaining (failed) items
        await localforage.setItem(SYNC_QUEUE_KEY, queue);
        await updateQueueCount();

        // If any items were synced, add them to the syncHistory in Firebase
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
            console.log("Database connection manually set to online.");
            processSyncQueue();
        }
    }, [processSyncQueue]);

    const handleGoOffline = useCallback(() => {
        if (database) {
            goOffline(database);
            setIsOnline(false);
            console.log("Database connection manually set to offline.");
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        const handleOnlineStatus = () => {
            if (isMounted) {
                console.log("App is online. Processing sync queue...");
                setIsOnline(true);
                if (database) goOnline(database);
                processSyncQueue();
            }
        };
        const handleOfflineStatus = () => {
             if (isMounted) {
                console.log("App is offline.");
                setIsOnline(false);
                 if (database) goOffline(database);
             }
        };
        
        if (typeof window !== 'undefined') {
            const initialOnlineStatus = navigator.onLine;
            setIsOnline(initialOnlineStatus);
            window.addEventListener('online', handleOnlineStatus);
            window.addEventListener('offline', handleOfflineStatus);
            
            if (initialOnlineStatus) {
                handleOnlineStatus();
            } else {
                handleOfflineStatus();
            }
        }
        
        return () => {
            isMounted = false;
            if (typeof window !== 'undefined') {
                window.removeEventListener('online', handleOnlineStatus);
                window.removeEventListener('offline', handleOfflineStatus);
            }
        };
    }, [processSyncQueue]);


    useEffect(() => {
        if (!isOnline) return;
        const interval = setInterval(() => {
            if (syncQueueCount > 0) {
                console.log("Periodic sync check...");
                processSyncQueue();
            }
        }, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [isOnline, syncQueueCount, processSyncQueue]);


    useEffect(() => {
        let isMounted = true;
        let unsubscribe: (() => void) | undefined;
        let initialLoadComplete = false;

        const hydrateAndListen = async () => {
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
                    if (!initialLoadComplete) {
                        setIsLoading(false);
                        initialLoadComplete = true;
                    }
                }
            } catch (error) {
                console.warn("Could not hydrate from localforage", error);
            } finally {
                 if (isMounted && !initialLoadComplete) {
                    setIsLoading(false);
                    initialLoadComplete = true;
                }
            }
            
            if (!database) {
                console.warn("Firebase database is not available. App is in offline-only mode.");
                return;
            }

            const dbRef = ref(database, '/');
            unsubscribe = onValue(dbRef, (snapshot) => {
                if (!isMounted) return;
                const firebaseData = snapshot.val() || {};
                
                setAllData(firebaseData); // Always update with fresh data from firebase
                
                // Asynchronously update local cache without blocking UI
                Object.keys(firebaseData).forEach(key => {
                    localforage.setItem(key, firebaseData[key]);
                });
                
            }, (error) => {
                 if (isMounted) {
                    console.error("Firebase read failed (likely offline):", error.message);
                 }
            });
        };

        hydrateAndListen();

        return () => {
            isMounted = false;
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [updateQueueCount]); // Removed allData from dependencies
    
    // Base memoized states from allData
    const allItems = useMemo(() => allData?.items ? Object.keys(allData.items).map(key => ({ id: key, ...allData.items[key] })) : [], [allData?.items]);
    const items = useMemo(() => allItems.filter(item => !item.isDisabled), [allItems]);
    const customers = useMemo(() => allData?.customers ? Object.keys(allData.customers).map(key => ({ id: key, ...allData.customers[key] })) : [], [allData?.customers]);
    const suppliers = useMemo(() => allData?.suppliers ? Object.keys(allData.suppliers).map(key => ({ id: key, ...allData.suppliers[key] })) : [], [allData?.suppliers]);
    const allWarehouses = useMemo(() => allData?.warehouses ? Object.keys(allData.warehouses).map(key => ({ id: key, ...allData.warehouses[key] })) : [], [allData?.warehouses]);
    const cashAccounts = useMemo(() => allData?.cashAccounts ? Object.keys(allData.cashAccounts).map(key => ({ id: key, ...allData.cashAccounts[key] })) : [], [allData?.cashAccounts]);
    const partners = useMemo(() => allData?.partners ? Object.keys(allData.partners).map(key => ({ id: key, ...allData.partners[key] })) : [], [allData?.partners]);
    const users = useMemo(() => allData?.users ? Object.keys(allData.users).map(key => ({ id: key, ...allData.users[key] })) : [], [allData?.users]);
    const deliveryStaff = useMemo(() => allData?.deliveryStaff ? Object.keys(allData.deliveryStaff).map(key => ({ id: key, ...allData.deliveryStaff[key] })) : [], [allData?.deliveryStaff]);
    const itemGroups = useMemo(() => allData?.itemGroups ? Object.keys(allData.itemGroups).map(key => ({ id: key, ...allData.itemGroups[key] })) : [], [allData?.itemGroups]);
    const itemSections = useMemo(() => allData?.itemSections ? Object.keys(allData.itemSections).map(key => ({ id: key, ...allData.itemSections[key] })) : [], [allData?.itemSections]);
    const itemCategories = useMemo(() => allData?.itemCategories ? Object.keys(allData.itemCategories).map(key => ({ id: key, ...allData.itemCategories[key] })) : [], [allData?.itemCategories]);
    const itemSubCategories1 = useMemo(() => allData?.itemSubCategories1 ? Object.keys(allData.itemSubCategories1).map(key => ({ id: key, ...allData.itemSubCategories1[key] })) : [], [allData?.itemSubCategories1]);
    const itemSubCategories2 = useMemo(() => allData?.itemSubCategories2 ? Object.keys(allData.itemSubCategories2).map(key => ({ id: key, ...allData.itemSubCategories2[key] })) : [], [allData?.itemSubCategories2]);
    const allInventoryZones = useMemo(() => allData?.inventoryZones ? Object.keys(allData.inventoryZones).map(key => ({ id: key, ...allData.inventoryZones[key] })) : [], [allData?.inventoryZones]);
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

    const warehouses = useMemo(() => allWarehouses, [allWarehouses]);
    
    const inventoryZones = useMemo(() => allInventoryZones, [allInventoryZones]);


    // Inventory (Flatten date-grouped structures)
    const flattenGroupedData = (dataNode: any) => {
        const records: any[] = [];
        if (dataNode) {
            Object.entries(dataNode).forEach(([key, value]: [string, any]) => {
                if (value && typeof value === 'object') {
                    if (value.date) { // Old structure (direct child)
                        records.push({ id: key, ...value });
                    } else { // New date-grouped structure
                        Object.entries(value).forEach(([subKey, subValue]: [string, any]) => {
                            records.push({ id: subKey, ...subValue });
                        });
                    }
                }
            });
        }
        return records;
    }

    const stockInRecords = useMemo(() => flattenGroupedData(allData?.stockInRecords), [allData?.stockInRecords]);
    const stockOutRecords = useMemo(() => flattenGroupedData(allData?.stockOutRecords), [allData?.stockOutRecords]);
    const stockTransferRecords = useMemo(() => flattenGroupedData(allData?.stockTransferRecords), [allData?.stockTransferRecords]);
    const stockAdjustmentRecords = useMemo(() => flattenGroupedData(allData?.stockAdjustmentRecords), [allData?.stockAdjustmentRecords]);
    const stockIssuesToReps = useMemo(() => flattenGroupedData(allData?.stockIssuesToReps), [allData?.stockIssuesToReps]);
    const stockReturnsFromReps = useMemo(() => flattenGroupedData(allData?.stockReturnsFromReps), [allData?.stockReturnsFromReps]);
    const inventoryClosings = useMemo(() => allData?.inventoryClosings ? Object.keys(allData.inventoryClosings).map(key => ({ id: key, ...allData.inventoryClosings[key] })) : [], [allData?.inventoryClosings]);
    const requisitions = useMemo(() => allData?.requisitions ? Object.keys(allData.requisitions).map(key => ({ id: key, ...allData.requisitions[key] })) : [], [allData?.requisitions]);
    
    // Sales & Purchases
    const salesInvoices = useMemo(() => flattenGroupedData(allData?.salesInvoices), [allData?.salesInvoices]);
    const salesReturns = useMemo(() => allData?.salesReturns ? Object.keys(allData.salesReturns).map(key => ({ id: key, ...allData.salesReturns[key] })) : [], [allData?.salesReturns]);
    const purchaseInvoices = useMemo(() => flattenGroupedData(allData?.purchaseInvoices), [allData?.purchaseInvoices]);
    const purchaseReturns = useMemo(() => allData?.purchaseReturns ? Object.keys(allData.purchaseReturns).map(key => ({ id: key, ...allData.purchaseReturns[key] })) : [], [allData?.purchaseReturns]);
    const purchaseOrders = useMemo(() => allData?.purchaseOrders ? Object.keys(allData.purchaseOrders).map(key => ({ id: key, ...allData.purchaseOrders[key] })) : [], [allData?.purchaseOrders]);
    const posSales = useMemo(() => flattenGroupedData(allData?.posSales), [allData?.posSales]);
    const posReturns = useMemo(() => {
        if (!allData?.posReturns) return [];
        const returns: any[] = [];
        Object.entries(allData.posReturns).forEach(([key, value]: [string, any]) => {
            if (value && typeof value === 'object' && value.date) {
                returns.push({ id: key, ...value });
            } else if (value && typeof value === 'object') {
                Object.entries(value).forEach(([subKey, subValue]: [string, any]) => {
                     if (subValue && typeof subValue === 'object') {
                        returns.push({ id: subKey, ...subValue });
                    }
                });
            }
        });
        return returns;
    }, [allData?.posReturns]);
    const posSessions = useMemo(() => allData?.posSessions ? Object.keys(allData.posSessions).map(key => ({ id: key, ...allData.posSessions[key] })) : [], [allData?.posSessions]);
    const posAuditLogs = useMemo(() => allData?.posAuditLogs ? Object.keys(allData.posAuditLogs).map(key => ({ id: key, ...allData.posAuditLogs[key] })) : [], [allData?.posAuditLogs]);
    const heldInvoices = useMemo(() => allData?.heldInvoices ? Object.keys(allData.heldInvoices).map(key => ({ id: key, ...allData.heldInvoices[key] })) : [], [allData?.heldInvoices]);
    const posCounters = useMemo(() => allData?.posCounters || {}, [allData?.posCounters]);
    
    // Accounting
    const expenses = useMemo(() => allData?.expenses ? Object.keys(allData.expenses).map(key => ({ id: key, ...allData.expenses[key] })) : [], [allData?.expenses]);
    const exceptionalIncomes = useMemo(() => allData?.exceptionalIncomes ? Object.keys(allData.exceptionalIncomes).map(key => ({ id: key, ...allData.exceptionalIncomes[key] })) : [], [allData?.exceptionalIncomes]);
    const customerPayments = useMemo(() => allData?.customerPayments ? Object.keys(allData.customerPayments).map(key => ({ id: key, ...allData.customerPayments[key] })) : [], [allData?.customerPayments]);
    const supplierPayments = useMemo(() => allData?.supplierPayments ? Object.keys(allData.supplierPayments).map(key => ({ id: key, ...allData.supplierPayments[key] })) : [], [allData?.supplierPayments]);
    const treasuryTransactions = useMemo(() => allData?.treasuryTransactions ? Object.keys(allData.treasuryTransactions).map(key => ({ id: key, ...allData.treasuryTransactions[key] })) : [], [allData?.treasuryTransactions]);
    const profitDistributions = useMemo(() => allData?.profitDistributions ? Object.keys(allData.profitDistributions).map(key => ({ id: key, ...allData.profitDistributions[key] })) : [], [allData?.profitDistributions]);
    const priceChangeLogs = useMemo(() => allData?.priceChangeLogs ? Object.keys(allData.priceChangeLogs).map(key => ({ id: key, ...allData.priceChangeLogs[key] })) : [], [allData?.priceChangeLogs]);
    
    // HR
    const employees = useMemo(() => allData?.employees ? Object.keys(allData.employees).map(key => ({ id: key, ...allData.employees[key] })) : [], [allData?.employees]);
    const employeeAdvances = useMemo(() => allData?.employeeAdvances ? Object.keys(allData.employeeAdvances).map(key => ({ id: key, ...allData.employeeAdvances[key] })) : [], [allData?.employeeAdvances]);
    const employeeAdjustments = useMemo(() => allData?.employeeAdjustments ? Object.keys(allData.employeeAdjustments).map(key => ({ id: key, ...allData.employeeAdjustments[key] })) : [], [allData?.employeeAdjustments]);
    const repRemittances = useMemo(() => allData?.repRemittances ? Object.keys(allData.repRemittances).map(key => ({ id: key, ...allData.repRemittances[key] })) : [], [allData?.repRemittances]);
    const payrollRecords = useMemo(() => allData?.payrollRecords ? Object.keys(allData.payrollRecords).map(key => ({ id: key, ...allData.payrollRecords[key] })) : [], [allData?.payrollRecords]);
    
    // Assets
    const fixedAssets = useMemo(() => allData?.fixedAssets ? Object.keys(allData.fixedAssets).map(key => ({ id: key, ...allData.fixedAssets[key] })) : [], [allData?.fixedAssets]);
    const depreciationRecords = useMemo(() => allData?.depreciationRecords ? Object.keys(allData.depreciationRecords).map(key => ({ id: key, ...allData.depreciationRecords[key] })) : [], [allData?.depreciationRecords]);

    const inventory = useMemo(() => {
        if (!allData?.inventory) return [];
        const result: any[] = [];
        Object.keys(allData.inventory).forEach(warehouseId => {
            Object.keys(allData.inventory[warehouseId]).forEach(sectionId => {
                const sectionData = allData.inventory[warehouseId][sectionId];
                if (sectionData && typeof sectionData === 'object') {
                    result.push({
                        id: `${warehouseId}-${sectionId}`,
                        warehouseId: warehouseId,
                        sectionId: sectionId,
                        items: sectionData
                    });
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
            console.error('Failed to get next ID from Firebase:', e);
            return null;
        }
    }, [isOnline, allData?.counters, updateQueueCount]);

    const dbAction = useCallback(async (path: string, action: 'add' | 'update' | 'remove' | 'transaction', payload?: any, priority: 'high' | 'normal' | 'low' = 'normal'): Promise<string | void> => {
        const sanitizedPayload = sanitize(payload);

        const performAction = async (db: Database | null) => {
            if (!db) {
                throw new Error("Database not initialized");
            }
    
            if (action === 'add') {
                const newRef = fbPush(ref(db, path));
                await fbSet(newRef, sanitizedPayload);
                return newRef.key || undefined;
            } else if (action === 'update') {
                const updatePath = `${path}/${payload.id}`;
                await fbUpdate(ref(db, updatePath), sanitizedPayload.data);
            } else if (action === 'remove') {
                const finalPath = payload.root ? path : `${path}/${payload.id}`;
                await fbRemove(ref(db, finalPath));
            } else if (action === 'transaction') {
                const counterRef = ref(db, payload.path);
                await runTransaction(counterRef, (currentValue) => (currentValue || 0) + 1);
            }
        };

        if (!isOnline) {
            console.log(`Action queued for offline sync: ${action} on ${path}`);
            const queue = await localforage.getItem<any[]>(SYNC_QUEUE_KEY) || [];
            let newId: any;
            const timestamp = new Date().toISOString();
            if (action === 'add') {
                newId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                queue.push({ path, action, payload: sanitizedPayload, id: newId, timestamp, priority });
            } else {
                 queue.push({ path, action, payload: sanitizedPayload, timestamp, priority });
            }
            await localforage.setItem(SYNC_QUEUE_KEY, queue);
            await updateQueueCount();
            
            // Optimistic UI update
            setAllData((prev: any) => {
                const newData = JSON.parse(JSON.stringify(prev));
                if (action === 'add' && newId) {
                    if (!newData[path]) newData[path] = {};
                    newData[path][newId] = sanitizedPayload;
                } else if (action === 'update') {
                    if (newData[path] && newData[path][payload.id]) {
                        newData[path][payload.id] = { ...newData[path][payload.id], ...sanitizedPayload.data };
                    }
                } else if (action === 'remove') {
                    if (payload.root) {
                        delete newData[path];
                    } else if (newData[path] && newData[path][payload.id]) {
                        delete newData[path][payload.id];
                    }
                }

                if (newData[path]) {
                     localforage.setItem(path, newData[path]).catch(console.error);
                } else {
                     localforage.removeItem(path).catch(console.error);
                }

                return newData;
            });

            return newId;
        } else {
            const result = await performAction(database);

            setAllData((prev: any) => {
                const newData = { ...prev };
                if ((action === 'add' || action === 'update') && !newData[path]) {
                    newData[path] = {};
                }
                if (newData[path]) {
                    newData[path] = { ...newData[path] };
                }

                const effectiveId = action === 'add' ? (result as string) : payload?.id;

                if (action === 'add' && effectiveId) {
                    newData[path][effectiveId] = sanitizedPayload;
                } else if (action === 'update' && effectiveId) {
                    if (newData[path][effectiveId]) {
                        newData[path][effectiveId] = { ...newData[path][effectiveId], ...sanitizedPayload.data };
                    }
                } else if (action === 'remove') {
                    if (payload.root) {
                        delete newData[path];
                    } else if (effectiveId && newData[path] && newData[path][effectiveId]) {
                        delete newData[path][effectiveId];
                    }
                }
                
                return newData;
            });

            return result;
        }
    }, [isOnline, updateQueueCount, database]);

    const value = {
        allItems, items, customers, suppliers, warehouses, cashAccounts, partners, users, deliveryStaff, itemGroups, itemSections, itemCategories, itemSubCategories1, itemSubCategories2, inventoryZones, inventorySections, itemColors, itemSizes, barcodeDesigns, posTerminals, promotions, roles, settings, inventory, restaurantTables, paymentMethods, sellers, targets, licenses, snoozedRecommendations, syncHistory, customerVisits, loginHistory,
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
         return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="mr-2">جارٍ تحميل البيانات الأولية للتطبيق...</p>
            </div>
        );
    }

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
