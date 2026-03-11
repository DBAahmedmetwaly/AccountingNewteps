
"use client";

// This file contains utility functions related to inventory calculation
// to be shared across different components and pages.

export const calculateStockForItemInWarehouse = (itemId: string, warehouseId: string, allData: any): number => {
    const {
        inventoryClosings, stockInRecords, stockOutRecords, stockTransferRecords, stockAdjustmentRecords,
        salesInvoices, salesReturns, posSales, posReturns, purchaseReturns,
        stockIssuesToReps, stockReturnsFromReps
    } = allData;

    if (!warehouseId) return 0;
    
    const closingsForWarehouse = (inventoryClosings || []).filter((c: any) => c.warehouseId === warehouseId)
        .sort((a: any,b: any) => new Date(b.closingDate).getTime() - new Date(a.date).getTime());
    
    const lastClosing = closingsForWarehouse[0] ?? null;
    let lastClosingDate = lastClosing ? new Date(lastClosing.closingDate) : new Date(0);
    let stock = lastClosing?.balances?.find((b: any) => b.itemId === itemId)?.balance || 0;

    if (lastClosing) {
        lastClosingDate.setDate(lastClosingDate.getDate() + 1);
        lastClosingDate.setHours(0, 0, 0, 0);
    }
    
    const filterTransactions = (t: any) => new Date(t.date) >= lastClosingDate;

    // INCOMING
    (stockInRecords || []).filter((si:any) => si.warehouseId === warehouseId && filterTransactions(si)).forEach((si: any) => si.items.forEach((i: any) => { if ((i.id || i.itemId) === itemId) stock += i.qty; }));
    (stockTransferRecords || []).filter((t:any) => t.toSourceId === warehouseId && filterTransactions(t)).forEach((t: any) => t.items.forEach((i: any) => { if (i.id === itemId) stock += i.qty; }));
    (stockAdjustmentRecords || []).filter((adj:any) => adj.warehouseId === warehouseId && filterTransactions(adj)).forEach((adj: any) => adj.items.forEach((i: any) => { if (i.itemId === itemId && i.difference > 0) stock += i.difference; }));
    (salesReturns || []).filter((sr:any) => sr.warehouseId === warehouseId && filterTransactions(sr)).forEach((sr: any) => sr.items.forEach((i: any) => { if ((i.id || i.itemId) === itemId) stock += i.qty; }));
    (posReturns || []).filter((pr:any) => (pr as any).warehouseId === warehouseId && filterTransactions(pr)).forEach((pr: any) => pr.items.forEach((i: any) => { if ((i.id || i.itemId) === itemId) stock += i.qty; }));
    (stockReturnsFromReps || []).filter((rfr:any) => rfr.warehouseId === warehouseId && filterTransactions(rfr)).forEach((rfr: any) => rfr.items.forEach((i: any) => { if ((i.id || i.itemId) === itemId) stock += i.qty; }));
    
    // OUTGOING
    (salesInvoices || []).filter((s:any) => s.warehouseId === warehouseId && s.status === 'approved' && filterTransactions(s)).forEach((s: any) => s.items.forEach((i: any) => { if (i.id === itemId) stock -= i.qty; }));
    (posSales || []).filter((s: any) => s.warehouseId === warehouseId && filterTransactions(s)).forEach((s: any) => s.items.forEach((i: any) => { if (i.id === itemId) stock -= i.qty; }));
    (stockOutRecords || []).filter((so:any) => so.sourceId === warehouseId && filterTransactions(so)).forEach((so: any) => so.items.forEach((i:any) => { if (i.id === itemId) stock -= i.qty; }));
    (stockTransferRecords || []).filter((t:any) => t.fromSourceId === warehouseId && filterTransactions(t)).forEach((t: any) => t.items.forEach((i: any) => { if (i.id === itemId) stock -= i.qty; }));
    (stockAdjustmentRecords || []).filter((adj:any) => adj.warehouseId === warehouseId && filterTransactions(adj)).forEach((adj: any) => adj.items.forEach((i: any) => { if (i.itemId === itemId && i.difference < 0) stock += i.difference; }));
    (purchaseReturns || []).filter((pr:any) => pr.warehouseId === warehouseId && filterTransactions(pr)).forEach((pr: any) => pr.items.forEach((i: any) => { if (i.id === itemId) stock -= i.qty; }));
    (stockIssuesToReps || []).filter((itr:any) => itr.warehouseId === warehouseId && filterTransactions(itr)).forEach((itr: any) => itr.items.filter((i: any) => { if (i.id === itemId) stock -= i.qty; }));
    
    return stock;
};
