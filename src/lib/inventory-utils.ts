
"use client";

// This file contains utility functions related to inventory calculation
// to be shared across different components and pages.

export const calculateStockForItemInWarehouse = (itemId: string, warehouseId: string, allData: any): number => {
    const {
        inventoryClosings, stockInRecords, stockOutRecords, stockTransferRecords, stockAdjustmentRecords,
        salesInvoices, salesReturns, posSales, posReturns, purchaseReturns,
        stockIssuesToReps, stockReturnsFromReps
    } = allData;

    if (!warehouseId || warehouseId === 'all') return 0;
    
    // Find all closings for this warehouse and sort them by closingDate descending
    const closingsForWarehouse = (inventoryClosings || [])
        .filter((c: any) => c.warehouseId === warehouseId)
        .sort((a: any, b: any) => new Date(b.closingDate).getTime() - new Date(a.closingDate).getTime());
    
    const lastClosing = closingsForWarehouse[0] ?? null;
    let lastClosingDate = lastClosing ? new Date(lastClosing.closingDate) : new Date(0);
    let stock = lastClosing?.balances?.find((b: any) => b.itemId === itemId)?.balance || 0;

    // We only consider transactions that happened AFTER the last closing
    if (lastClosing) {
        lastClosingDate.setDate(lastClosingDate.getDate() + 1);
        lastClosingDate.setHours(0, 0, 0, 0);
    }
    
    const filterTransactions = (t: any) => t && t.date && new Date(t.date) >= lastClosingDate;

    // --- INCOMING (+) ---
    
    // 1. Stock In (Purchases, Openings, etc.)
    (stockInRecords || [])
        .filter((si: any) => si.warehouseId === warehouseId && filterTransactions(si))
        .forEach((si: any) => {
            (si.items || []).forEach((i: any) => {
                if ((i.id || i.itemId) === itemId) stock += (Number(i.qty) || 0);
            });
        });

    // 2. Transfers In
    (stockTransferRecords || [])
        .filter((t: any) => t.toSourceId === warehouseId && filterTransactions(t))
        .forEach((t: any) => {
            (t.items || []).forEach((i: any) => {
                if ((i.id || i.itemId) === itemId) stock += (Number(i.qty) || 0);
            });
        });

    // 3. Adjustment Surplus
    (stockAdjustmentRecords || [])
        .filter((adj: any) => adj.warehouseId === warehouseId && filterTransactions(adj))
        .forEach((adj: any) => {
            (adj.items || []).forEach((i: any) => {
                if ((i.itemId || i.id) === itemId && i.difference > 0) stock += (Number(i.difference) || 0);
            });
        });

    // 4. Sales Returns (Standard)
    (salesReturns || [])
        .filter((sr: any) => sr.warehouseId === warehouseId && filterTransactions(sr))
        .forEach((sr: any) => {
            (sr.items || []).forEach((i: any) => {
                if ((i.id || i.itemId) === itemId) stock += (Number(i.qty) || 0);
            });
        });

    // 5. POS Returns
    (posReturns || [])
        .filter((pr: any) => (pr.warehouseId === warehouseId || pr.source === 'POS') && filterTransactions(pr))
        .forEach((pr: any) => {
            (pr.items || []).forEach((i: any) => {
                if ((i.id || i.itemId) === itemId) stock += (Number(i.qty) || 0);
            });
        });

    // 6. Returns from Sales Reps
    (stockReturnsFromReps || [])
        .filter((rfr: any) => rfr.warehouseId === warehouseId && filterTransactions(rfr))
        .forEach((rfr: any) => {
            (rfr.items || []).forEach((i: any) => {
                if ((i.id || i.itemId) === itemId) stock += (Number(i.qty) || 0);
            });
        });
    
    // --- OUTGOING (-) ---

    // 7. Sales Invoices (Approved)
    (salesInvoices || [])
        .filter((s: any) => s.warehouseId === warehouseId && s.status === 'approved' && filterTransactions(s))
        .forEach((s: any) => {
            (s.items || []).forEach((i: any) => {
                if ((i.id || i.itemId) === itemId) stock -= (Number(i.qty) || 0);
            });
        });

    // 8. POS Sales
    (posSales || [])
        .filter((s: any) => s.warehouseId === warehouseId && filterTransactions(s))
        .forEach((s: any) => {
            (s.items || []).forEach((i: any) => {
                if ((i.id || i.itemId) === itemId) stock -= (Number(i.qty) || 0);
            });
        });

    // 9. Manual Stock Out (Damaged, internal use, etc.)
    (stockOutRecords || [])
        .filter((so: any) => so.sourceId === warehouseId && filterTransactions(so))
        .forEach((so: any) => {
            (so.items || []).forEach((i: any) => {
                if ((i.id || i.itemId) === itemId) stock -= (Number(i.qty) || 0);
            });
        });

    // 10. Transfers Out
    (stockTransferRecords || [])
        .filter((t: any) => t.fromSourceId === warehouseId && filterTransactions(t))
        .forEach((t: any) => {
            (t.items || []).forEach((i: any) => {
                if ((i.id || i.itemId) === itemId) stock -= (Number(i.qty) || 0);
            });
        });

    // 11. Adjustment Deficit
    (stockAdjustmentRecords || [])
        .filter((adj: any) => adj.warehouseId === warehouseId && filterTransactions(adj))
        .forEach((adj: any) => {
            (adj.items || []).forEach((i: any) => {
                if ((i.itemId || i.id) === itemId && i.difference < 0) stock += (Number(i.difference) || 0);
            });
        });

    // 12. Purchase Returns
    (purchaseReturns || [])
        .filter((pr: any) => pr.warehouseId === warehouseId && filterTransactions(pr))
        .forEach((pr: any) => {
            (pr.items || []).forEach((i: any) => {
                if ((i.id || i.itemId) === itemId) stock -= (Number(i.qty) || 0);
            });
        });

    // 13. Issues to Sales Reps
    (stockIssuesToReps || [])
        .filter((itr: any) => itr.warehouseId === warehouseId && filterTransactions(itr))
        .forEach((itr: any) => {
            (itr.items || []).forEach((i: any) => {
                if ((i.id || i.itemId) === itemId) stock -= (Number(i.qty) || 0);
            });
        });
    
    return stock;
};
