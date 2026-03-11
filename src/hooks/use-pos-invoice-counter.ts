
"use client";

import { useState, useEffect, useCallback } from 'react';
import { database } from '@/lib/firebase';
import { ref, runTransaction, onValue } from 'firebase/database';
import { useAuth } from '@/contexts/auth-context';
import { useData } from '@/contexts/data-provider';
import localforage from 'localforage';

const SYNC_QUEUE_KEY = 'firebase-sync-queue';

export const usePosInvoiceCounter = (workDayId: string | undefined, terminalId: string | undefined, terminalCode: string | undefined, warehouseCode: string | undefined) => {
  const { posSessions, warehouses, posTerminals, isOnline, allData } = useData();
  const [currentInvoiceNumber, setCurrentInvoiceNumber] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // This function ONLY increments the counter and returns the *new* number as a string
  const generateInvoiceNumber = useCallback(async (userId?: string) => {
    if (!workDayId || !terminalId || !database) {
      console.error("Cannot generate invoice number: workDayId or terminalId is missing.");
      return null;
    }
    
    const counterPath = `posCounters/${workDayId}/${terminalId}`;

    const getFormattedInvoiceNumber = (count: number | string) => {
        const openWorkDay = posSessions.find((s: any) => s.id === workDayId);
        const workDayDate = openWorkDay ? new Date(openWorkDay.startTime) : new Date();
        const datePart = `${String(workDayDate.getDate()).padStart(2, '0')}${String(workDayDate.getMonth() + 1).padStart(2, '0')}${String(workDayDate.getFullYear()).slice(-2)}`;
        
        return `${count}-${terminalCode || '0'}-${warehouseCode || '0'}-${datePart}`;
    }

    if (isOnline) {
        try {
            const counterRef = ref(database, counterPath);
            const { committed, snapshot } = await runTransaction(counterRef, (currentValue) => {
              return (currentValue || 0) + 1;
            });

            if (committed) {
                const newCount = snapshot.val();
                await localforage.setItem(counterPath, newCount);
                return getFormattedInvoiceNumber(newCount);
            }
            console.error("Firebase transaction for invoice counter failed to commit.");
            return null; // Transaction aborted

        } catch (error) {
            console.warn("Failed to generate invoice number via transaction, falling back to offline mode:", error);
            return generateOfflineNumber(userId);
        }
    } else {
        return generateOfflineNumber(userId);
    }
    
    async function generateOfflineNumber(uid?: string) {
        console.log("Offline mode detected, using local counter for POS invoice.");
        
        // Use a unique local identifier to avoid clashes
        const uniqueSuffix = `${uid ? uid.slice(-4) : 'nouser'}-${Date.now().toString().slice(-6)}`;
        
        const lastKnownRemoteValue = allData?.posCounters?.[workDayId || '']?.[terminalId || ''] || 0;
        const lastLocalValue = await localforage.getItem<number>(counterPath);

        const baseCount = Math.max(lastKnownRemoteValue, (lastLocalValue || 0));
        
        const offlineInvoiceId = `${baseCount + 1}-L-${uniqueSuffix}`;

        // We don't increment the shared local/remote counter here. 
        // We let the transaction handle it upon sync to avoid race conditions.
        // We just queue the increment operation.
        const queue = await localforage.getItem<any[]>(SYNC_QUEUE_KEY) || [];
        queue.push({ path: counterPath, action: 'transaction', timestamp: new Date().toISOString() });
        await localforage.setItem(SYNC_QUEUE_KEY, queue);
        // await updateQueueCount(); // This function does not exist on DataContext
        
        return getFormattedInvoiceNumber(offlineInvoiceId);
    }

  }, [workDayId, terminalId, terminalCode, warehouseCode, posSessions, isOnline, allData]);

  useEffect(() => {
    if (workDayId && terminalId && database) {
        const counterPath = `posCounters/${workDayId}/${terminalId}`;
        
        const updateNumber = (count: number) => {
            const openWorkDay = posSessions.find((s:any) => s.id === workDayId);
            const workDayDate = openWorkDay ? new Date(openWorkDay.startTime) : new Date();
            const datePart = `${String(workDayDate.getDate()).padStart(2, '0')}${String(workDayDate.getMonth() + 1).padStart(2, '0')}${String(workDayDate.getFullYear()).slice(-2)}`;
            
            const terminal = posTerminals.find((t: any) => t.id === terminalId);
            const warehouse = warehouses.find((w: any) => w.id === terminal?.warehouseId);

            setCurrentInvoiceNumber(`${count + 1}-${terminal?.code || '0'}-${warehouse?.code || '0'}-${datePart}`);
            setLoading(false);
        }

        if (isOnline) {
            const counterRef = ref(database, counterPath);
            const unsubscribe = onValue(counterRef, (snapshot) => {
                const currentCount = snapshot.val() || 0;
                localforage.setItem(counterPath, currentCount);
                updateNumber(currentCount);
            }, (error) => {
                console.error(error);
                setLoading(false);
            });
            return () => unsubscribe();
        } else {
            localforage.getItem<number>(counterPath).then(localCount => {
                const lastKnownRemoteValue = allData?.posCounters?.[workDayId]?.[terminalId] || 0;
                const baseCount = Math.max(lastKnownRemoteValue, localCount || 0);
                updateNumber(baseCount);
            });
        }
    } else {
        setLoading(false);
    }
  }, [workDayId, terminalId, posSessions, posTerminals, warehouses, isOnline, allData]);

  return { currentInvoiceNumber, generateInvoiceNumber, loading };
};

    