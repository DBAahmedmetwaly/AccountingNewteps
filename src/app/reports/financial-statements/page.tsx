
"use client";

import PageHeader from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useData } from "@/contexts/data-provider";
import { Loader2, ChevronDown, ChevronUp, Plus, Minus } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

// Data Interfaces
interface SaleInvoice {
  id: string;
  total: number;
  discount: number;
  status?: 'approved' | 'pending';
  items: { id: string; qty: number; cost?: number; price: number; }[];
  paidAmount?: number;
  date: string;
  subtotal: number;
  warehouseId: string;
  customerId: string;
  paidToAccountId?: string;
}
interface PurchaseInvoice {
  id: string;
  total: number;
  discount: number;
  paidAmount?: number;
  date: string;
  warehouseId: string;
  supplierId: string;
}

const useIncomeStatementData = () => {
  const { salesInvoices, expenses, exceptionalIncomes, items, salesReturns, posSales, posReturns, payrollRecords, stockAdjustmentRecords, stockOutRecords, depreciationRecords } = useData();

  return useMemo(() => {
    const approvedSales = salesInvoices.filter((s: any) => s.status === 'approved');
    const allSales = [...approvedSales, ...posSales];

    const grossRevenue = allSales.reduce((acc, sale) => acc + (sale.subtotal || (sale.total + (sale.discount || 0))), 0);
    const totalSalesDiscount = allSales.reduce((acc, sale) => acc + (sale.discount || 0), 0);
    
    const allReturns = [...salesReturns, ...posReturns];
    const totalSalesReturns = allReturns.reduce((acc, ret) => acc + ret.total, 0);
    
    let costOfGoodsSold = allSales.reduce((acc, sale) => {
        return acc + (sale.items?.reduce((itemAcc: number, saleItem: any) => {
            const itemMaster = items.find((i:any) => i.id === saleItem.id);
            const masterCost = saleItem.cost || itemMaster?.cost || 0;
            return itemAcc + (saleItem.qty * masterCost);
        }, 0) || 0);
    }, 0);

    const costOfReturns = allReturns.reduce((acc, ret) => {
        return acc + (ret.items?.reduce((itemAcc: number, item: any) => {
            const itemMaster = items.find((i:any) => i.id === item.id);
            const masterCost = item.cost || itemMaster?.cost || 0;
            return itemAcc + (item.qty * masterCost);
        }, 0) || 0);
    }, 0);
    
    costOfGoodsSold -= costOfReturns;
    if (costOfGoodsSold < 0) costOfGoodsSold = 0;

    let totalExceptionalIncome = exceptionalIncomes.reduce((acc, income) => acc + income.amount, 0);
    const payrollPenalties = payrollRecords?.reduce((acc: number, record: any) => {
        return acc + record.payrollData.reduce((sum: number, p: any) => sum + p.totalPenalties, 0);
    }, 0) || 0;
    totalExceptionalIncome += payrollPenalties;

    const inventoryAdjustmentGains = stockAdjustmentRecords?.reduce((acc: number, adj: any) => {
        return acc + adj.items.reduce((sum: number, item: any) => {
             const itemMaster = items.find((i:any) => i.id === item.itemId);
             const cost = item.cost || itemMaster?.cost || 0;
             const val = item.difference * cost;
             return sum + (val > 0 ? val : 0);
        }, 0);
    }, 0) || 0;
    totalExceptionalIncome += inventoryAdjustmentGains;

    const expensesByType: { [key: string]: number } = {};
    expenses.forEach(expense => {
        expensesByType[expense.expenseType] = (expensesByType[expense.expenseType] || 0) + expense.amount;
    });
    
    const inventoryAdjustmentLosses = stockAdjustmentRecords?.reduce((acc: number, adj: any) => {
        return acc + adj.items.reduce((sum: number, item: any) => {
             const itemMaster = items.find((i:any) => i.id === item.itemId);
             const cost = item.cost || itemMaster?.cost || 0;
             const val = item.difference * cost;
             return sum + (val < 0 ? Math.abs(val) : 0);
        }, 0);
    }, 0) || 0;
    if (inventoryAdjustmentLosses > 0) expensesByType['خسائر تسوية المخزون'] = (expensesByType['خسائر تسوية المخزون'] || 0) + inventoryAdjustmentLosses;

    const stockOutLosses = stockOutRecords?.reduce((acc: number, so: any) => {
         return acc + so.items.reduce((sum: number, item: any) => {
             const itemMaster = items.find((i:any) => i.id === item.id);
             const cost = item.cost || itemMaster?.cost || 0;
             return sum + (item.qty * cost);
         }, 0);
    }, 0) || 0;
    if (stockOutLosses > 0) expensesByType['بضاعة تالفة / هوالك'] = (expensesByType['بضاعة تالفة / هوالك'] || 0) + stockOutLosses;

    const payrollExpenses = payrollRecords?.reduce((acc: number, record: any) => {
        return acc + record.payrollData.reduce((sum: number, p: any) => sum + p.basicSalary + p.totalRewards, 0);
    }, 0) || 0;
    if (payrollExpenses > 0) expensesByType['رواتب ومكافآت الموظفين'] = (expensesByType['رواتب ومكافآت الموظفين'] || 0) + payrollExpenses;

    const totalDepreciation = depreciationRecords?.reduce((acc: number, rec: any) => acc + rec.amount, 0) || 0;
    if (totalDepreciation > 0) expensesByType['مصروف الإهلاك'] = (expensesByType['مصروف الإهلاك'] || 0) + totalDepreciation;

    const totalExpenses = Object.values(expensesByType).reduce((acc, amount) => acc + amount, 0);
    const netRevenue = grossRevenue - totalSalesReturns - totalSalesDiscount;
    const grossProfit = netRevenue - costOfGoodsSold;
    const netOperatingIncome = grossProfit - totalExpenses;
    const netIncome = netOperatingIncome + totalExceptionalIncome;
    
    return { grossRevenue, totalSalesReturns, totalSalesDiscount, costOfGoodsSold, totalExceptionalIncome, expensesByType, totalExpenses, netRevenue, grossProfit, netOperatingIncome, netIncome };
  }, [salesInvoices, posSales, posReturns, expenses, exceptionalIncomes, items, salesReturns, payrollRecords, stockAdjustmentRecords, stockOutRecords, depreciationRecords]);
};

function IncomeStatement() {
  const { loading } = useData();
  const { grossRevenue, totalSalesReturns, totalSalesDiscount, costOfGoodsSold, totalExceptionalIncome, expensesByType, netRevenue, grossProfit, netOperatingIncome, netIncome } = useIncomeStatementData();
  
  if (loading) return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <Table>
      <TableBody>
        <TableRow><TableCell className="font-medium">إجمالي الإيرادات (المبيعات)</TableCell><TableCell className="text-left">ج.م {grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
        <TableRow><TableCell className="pl-8 text-muted-foreground">(-) مرتجعات ومسموحات المبيعات</TableCell><TableCell className="text-left text-destructive">- ج.م {totalSalesReturns.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
        <TableRow><TableCell className="pl-8 text-muted-foreground">(-) خصم مسموح به</TableCell><TableCell className="text-left text-destructive">- ج.م {totalSalesDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
        <TableRow className="font-semibold border-t"><TableCell>صافي الإيرادات</TableCell><TableCell className="text-left">ج.م {netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
        <TableRow><TableCell className="font-medium">تكلفة البضاعة المباعة (COGS)</TableCell><TableCell className="text-left text-destructive">- ج.م {costOfGoodsSold.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
        <TableRow><TableHead>مجمل الربح</TableHead><TableHead className="text-left">ج.م {grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableHead></TableRow>
        <TableRow><TableCell colSpan={2} className="font-medium pt-4">المصروفات التشغيلية:</TableCell></TableRow>
        {Object.entries(expensesByType).map(([type, amount]) => (
             <TableRow key={type}><TableCell className="pl-8 text-muted-foreground">{type}</TableCell><TableCell className="text-left text-destructive">- ج.م {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
        ))}
        <TableRow><TableHead>صافي الدخل التشغيلي</TableHead><TableHead className="text-left">ج.م {netOperatingIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableHead></TableRow>
        <TableRow><TableCell className="font-medium">الدخل الاستثنائي</TableCell><TableCell className="text-left">ج.م {totalExceptionalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
      </TableBody>
      <TableFooter>
        <TableRow className="bg-muted/50">
          <TableHead className="font-bold text-lg">صافي الدخل النهائي</TableHead>
          <TableHead className={`font-bold text-lg text-left ${netIncome >= 0 ? 'text-green-600' : 'text-destructive'}`}>ج.م {netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableHead>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function BalanceSheet() {
    const { 
        customers, suppliers, partners, items: allItems, salesInvoices, purchaseInvoices, 
        customerPayments, supplierPayments, salesReturns, purchaseReturns, 
        warehouses, inventoryZones, stockInRecords, stockOutRecords, stockTransferRecords, stockAdjustmentRecords, 
        stockIssuesToReps, stockReturnsFromReps, inventoryClosings, repRemittances,
        cashAccounts, treasuryTransactions, expenses, exceptionalIncomes, employeeAdvances, profitDistributions,
        posSales, posReturns, payrollRecords, fixedAssets, depreciationRecords,
        loading 
    } = useData();

    const { netIncome } = useIncomeStatementData();
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const details = useMemo(() => {
        // --- AR Breakdown ---
        const arDetails = customers.map((customer: any) => {
            let balance = Number(customer.openingBalance) || 0;
            salesInvoices.filter((s: any) => s.customerId === customer.id && s.status === 'approved').forEach((inv: any) => { balance += (Number(inv.total) - Number(inv.paidAmount || 0)); });
            posSales.filter((s: any) => s.customerId === customer.id).forEach((sale: any) => { balance += (Number(sale.total) - Number(sale.paidAmount || 0)); });
            customerPayments.filter((p: any) => p.customerId === customer.id && !p.invoiceId).forEach((p: any) => balance -= Number(p.amount));
            salesReturns.filter((r: any) => r.customerId === customer.id).forEach((r: any) => balance -= (Number(r.total) - Number(r.paidAmount || 0)));
            posReturns.filter((r: any) => r.customerId === customer.id).forEach((r: any) => balance -= (Number(r.total) - Number(r.paidAmount || 0)));
            return { name: customer.name, balance };
        }).filter(c => Math.abs(c.balance) > 0.01);

        // --- AP Breakdown ---
        const apDetails = suppliers.map((supplier: any) => {
            let balance = Number(supplier.openingBalance) || 0;
            purchaseInvoices.filter((p: any) => p.supplierId === supplier.id).forEach((p: any) => { balance += (Number(p.total) - Number(p.paidAmount || 0)); });
            supplierPayments.filter((p: any) => p.supplierId === supplier.id && !p.invoiceId).forEach((p: any) => balance -= Number(p.amount););
            purchaseReturns.filter((r: any) => r.supplierId === supplier.id).forEach((r: any) => balance -= (Number(r.total) - Number(r.paidAmount || 0)));
            return { name: supplier.name, balance };
        }).filter(s => Math.abs(s.balance) > 0.01);

        // --- Cash Breakdown ---
        const cashDetails = cashAccounts.map((account: any) => {
            let balance = account.openingBalance || 0;
            customerPayments.filter(p => p.paidToAccountId === account.id).forEach(p => balance += p.amount);
            exceptionalIncomes.filter(i => i.paidToAccountId === account.id).forEach(i => balance += i.amount);
            treasuryTransactions.filter(tx => tx.accountId === account.id && tx.type === 'deposit' && !tx.linkedTransaction).forEach(tx => balance += tx.amount);
            repRemittances.filter(rem => rem.toAccountId === account.id).forEach(rem => balance += rem.amount);
            purchaseReturns.filter(r => r.paidToAccountId === account.id).forEach(r => balance += (r.paidAmount || 0));
            salesInvoices.filter(s => s.status === 'approved' && s.paidToAccountId === account.id).forEach(s => {
                const linkedPaymentsTotal = customerPayments.filter(p => p.invoiceId === s.id).reduce((sum, p) => sum + p.amount, 0);
                const initialCash = (s.paidAmount || 0) - linkedPaymentsTotal;
                if (initialCash > 0) balance += initialCash;
            });
            posSales.forEach(s => {
                const targetId = s.paidToAccountId || (account.warehouseId && s.warehouseId === account.warehouseId ? account.id : null);
                if (targetId === account.id) {
                    const linkedPaymentsTotal = customerPayments.filter(p => p.invoiceId === s.id).reduce((sum, p) => sum + p.amount, 0);
                    const initialCash = (s.paidAmount || 0) - linkedPaymentsTotal;
                    if (initialCash > 0) balance += initialCash;
                }
            });
            expenses.filter(e => e.paidFromAccountId === account.id && e.status !== 'pending').forEach(e => balance -= e.amount);
            supplierPayments.filter(p => p.paidFromAccountId === account.id).forEach(p => balance -= p.amount);
            employeeAdvances.filter(ea => ea.paidFromAccountId === account.id).forEach(ea => balance -= ea.amount);
            profitDistributions.filter(pd => pd.paidFromAccountId === account.id).forEach(pd => balance -= pd.amount);
            treasuryTransactions.filter(tx => tx.accountId === account.id && tx.type === 'withdrawal' && !tx.linkedTransaction).forEach(tx => balance -= tx.amount);
            salesReturns.filter(r => r.paidFromAccountId === account.id).forEach(r => balance -= (r.paidAmount || 0));
            posReturns.forEach(r => { if (account.warehouseId && r.warehouseId === account.warehouseId) balance -= (r.paidAmount || 0); });
            payrollRecords?.filter(pr => pr.paidFromAccountId === account.id).forEach(pr => balance -= pr.payrollData.reduce((sum: number, p: any) => sum + p.netSalary, 0));
            return { name: account.name, balance };
        }).filter(acc => Math.abs(acc.balance) > 0.01);

        // --- Inventory Breakdown ---
        const combinedWh = [...warehouses, ...inventoryZones];
        const inventoryDetails = combinedWh.map(warehouse => {
            let warehouseValue = 0;
            allItems.forEach((item: any) => {
                const closings = inventoryClosings.filter((c: any) => c.warehouseId === warehouse.id).sort((a: any, b: any) => new Date(b.closingDate).getTime() - new Date(a.date).getTime());
                const lastClosing = closings[0] ?? null;
                const lastClosingDate = lastClosing ? new Date(lastClosing.closingDate) : new Date(0);
                let stock = lastClosing?.balances?.find((b:any) => b.itemId === item.id)?.balance || 0;
                const filter = (t: any) => new Date(t.date) > lastClosingDate;
                
                stockInRecords.filter(si => si.warehouseId === warehouse.id && filter(si)).forEach(si => si.items.filter((i: any) => (i.itemId || i.id) === item.id).forEach((i: any) => stock += i.qty));
                stockTransferRecords.filter(t => t.toSourceId === warehouse.id && filter(t)).forEach(t => t.items.filter((i: any) => i.id === item.id).forEach((i: any) => stock += i.qty));
                stockAdjustmentRecords.filter(adj => adj.warehouseId === warehouse.id && filter(adj)).forEach(adj => adj.items.filter((i: any) => i.itemId === item.id).forEach((i: any) => stock += i.difference));
                salesReturns.filter(sr => sr.warehouseId === warehouse.id && filter(sr)).forEach(sr => sr.items.filter((i: any) => i.id === item.id).forEach((i: any) => stock += i.qty));
                posReturns.filter(pr => pr.warehouseId === warehouse.id && filter(pr)).forEach(pr => pr.items.filter((i: any) => i.id === item.id).forEach((i: any) => stock += i.qty));
                stockReturnsFromReps.filter(rfr => rfr.warehouseId === warehouse.id && filter(rfr)).forEach(rfr => rfr.items.filter((i: any) => i.id === item.id).forEach((i: any) => stock += i.qty));
                salesInvoices.filter(s => s.warehouseId === warehouse.id && s.status === 'approved' && filter(s)).forEach(s => s.items.filter((i: any) => i.id === item.id).forEach((i: any) => stock -= i.qty));
                posSales.filter(s => s.warehouseId === warehouse.id && filter(s)).forEach(s => s.items.filter((i: any) => i.id === item.id).forEach((i: any) => stock -= i.qty));
                stockOutRecords.filter(so => so.sourceId === warehouse.id && filter(so)).forEach(so => so.items.filter((i:any) => i.id === item.id).forEach((i:any) => stock -= i.qty));
                stockTransferRecords.filter(t => t.fromSourceId === warehouse.id && filter(t)).forEach(t => t.items.filter((i: any) => i.id === item.id).forEach((i: any) => stock -= i.qty));
                purchaseReturns.filter(pr => pr.warehouseId === warehouse.id && filter(pr)).forEach(pr => pr.items.filter((i: any) => i.id === item.id).forEach((i: any) => stock -= i.qty));
                stockIssuesToReps.filter(itr => itr.warehouseId === warehouse.id && filter(itr)).forEach(itr => itr.items.filter((i: any) => i.id === item.id).forEach((i: any) => stock -= i.qty));

                warehouseValue += stock * (item.cost || 0);
            });
            return { name: warehouse.name, balance: warehouseValue };
        }).filter(w => Math.abs(w.balance) > 0.01);

        // --- Fixed Assets Breakdown ---
        const assetDetails = fixedAssets.map((asset: any) => {
            const dep = depreciationRecords.filter(r => r.assetId === asset.id).reduce((sum, r) => sum + r.amount, 0);
            return { name: asset.name, balance: asset.cost - dep, cost: asset.cost, dep };
        });

        // --- Equity Calculations ---
        const initialAR = customers.reduce((acc: number, c: any) => acc + (Number(c.openingBalance) || 0), 0);
        const initialAP = suppliers.reduce((acc: number, s: any) => acc + (Number(s.openingBalance) || 0), 0);
        const initialCash = cashAccounts.reduce((acc: number, ca: any) => acc + (Number(ca.openingBalance) || 0), 0);
        let initialInvValue = 0;
        stockInRecords.filter(r => r.reason === 'opening_stock').forEach(r => r.items.forEach((i: any) => initialInvValue += (i.qty * (i.cost || 0))));
        stockAdjustmentRecords.filter(r => r.reason === 'opening_balance').forEach(r => r.items.forEach((i: any) => initialInvValue += (i.actualQty * (i.cost || 0))));

        const partnerCapital = partners.reduce((acc: number, p: any) => acc + (p.capital || 0), 0);
        const treasuryNet = treasuryTransactions.filter(tx => !tx.linkedTransaction).reduce((acc, tx) => tx.type === 'deposit' ? acc + tx.amount : acc - tx.amount, 0);
        
        const totalCapitalValue = (initialAR + initialCash + initialInvValue - initialAP) + partnerCapital + treasuryNet;

        const distributionsDetails = partners.map((p: any) => ({
            name: p.name,
            balance: profitDistributions.filter(d => d.partnerId === p.id).reduce((sum, d) => sum + d.amount, 0)
        })).filter(d => d.balance > 0);

        return { arDetails, apDetails, cashDetails, inventoryDetails, assetDetails, distributionsDetails, totalCapitalValue };
    }, [customers, suppliers, partners, allItems, salesInvoices, purchaseInvoices, customerPayments, supplierPayments, salesReturns, purchaseReturns, warehouses, inventoryZones, stockInRecords, stockOutRecords, stockTransferRecords, stockAdjustmentRecords, stockIssuesToReps, stockReturnsFromReps, inventoryClosings, repRemittances, cashAccounts, treasuryTransactions, expenses, exceptionalIncomes, employeeAdvances, profitDistributions, posSales, posReturns, payrollRecords, fixedAssets, depreciationRecords]);

    const totals = useMemo(() => {
        const ar = details.arDetails.reduce((sum, i) => sum + i.balance, 0);
        const ap = details.apDetails.reduce((sum, i) => sum + i.balance, 0);
        const cash = details.cashDetails.reduce((sum, i) => sum + i.balance, 0);
        const inv = details.inventoryDetails.reduce((sum, i) => sum + i.balance, 0);
        const assets = details.assetDetails.reduce((sum, i) => sum + i.balance, 0);
        const dist = details.distributionsDetails.reduce((sum, i) => sum + i.balance, 0);
        
        const totalAssets = ar + cash + inv + assets;
        const totalEquity = details.totalCapitalValue + netIncome - dist;
        return { ar, ap, cash, inv, assets, dist, totalAssets, totalEquity };
    }, [details, netIncome]);

    if (loading) return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    const SectionHeader = ({ id, title, total }: { id: string, title: string, total: number }) => (
        <TableRow className="cursor-pointer bg-muted/20 hover:bg-muted/40 font-bold" onClick={() => toggleSection(id)}>
            <TableCell className="flex items-center gap-2">
                {expandedSections[id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {title}
            </TableCell>
            <TableCell className="text-left">ج.م {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
        </TableRow>
    );

    const DetailRows = ({ id, data }: { id: string, data: any[] }) => {
        if (!expandedSections[id]) return null;
        return (
            <>
                {data.map((item, idx) => (
                    <TableRow key={idx} className="bg-background/50 text-muted-foreground animate-in fade-in slide-in-from-top-1">
                        <TableCell className="pr-10">{item.name}</TableCell>
                        <TableCell className="text-left">ج.م {item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                ))}
                {data.length === 0 && (
                    <TableRow className="bg-background/50 italic text-muted-foreground">
                        <TableCell colSpan={2} className="text-center py-2">لا توجد بنود حالياً</TableCell>
                    </TableRow>
                )}
            </>
        );
    };

    return (
        <div className="grid md:grid-cols-2 gap-8">
            {/* ASSETS SIDE */}
            <div>
                <h3 className="text-lg font-bold mb-4 border-b pb-2 flex items-center gap-2 text-primary"><Plus className="h-5 w-5"/> الأصول (Assets)</h3>
                <Table>
                    <TableBody>
                        <SectionHeader id="cash" title="النقدية وما في حكمها" total={totals.cash} />
                        <DetailRows id="cash" data={details.cashDetails} />

                        <SectionHeader id="ar" title="حسابات العملاء (الذمم المدينة)" total={totals.ar} />
                        <DetailRows id="ar" data={details.arDetails} />

                        <SectionHeader id="inv" title="قيمة المخزون (بالتكلفة)" total={totals.inv} />
                        <DetailRows id="inv" data={details.inventoryDetails} />

                        <SectionHeader id="assets" title="الأصول الثابتة (الصافي)" total={totals.assets} />
                        <DetailRows id="assets" data={details.assetDetails} />
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-primary/10 border-t-2 border-primary">
                            <TableHead className="font-black text-lg">إجمالي الأصول</TableHead>
                            <TableHead className="text-left font-black text-lg">ج.م {totals.totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableHead>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>

            {/* LIABILITIES & EQUITY SIDE */}
            <div className="space-y-8">
                <div>
                    <h3 className="text-lg font-bold mb-4 border-b pb-2 flex items-center gap-2 text-destructive"><Minus className="h-5 w-5"/> الخصوم (Liabilities)</h3>
                    <Table>
                        <TableBody>
                            <SectionHeader id="ap" title="حسابات الموردين (الذمم الدائنة)" total={totals.ap} />
                            <DetailRows id="ap" data={details.apDetails} />
                        </TableBody>
                    </Table>
                </div>

                <div>
                    <h3 className="text-lg font-bold mb-4 border-b pb-2 flex items-center gap-2 text-green-600">حقوق الملكية (Equity)</h3>
                    <Table>
                        <TableBody>
                            <TableRow className="font-semibold"><TableCell>رأس المال (الافتتاحي + الاستثمارات)</TableCell><TableCell className="text-left">ج.م {details.totalCapitalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
                            <TableRow className="font-semibold"><TableCell>الأرباح المحتجزة (صافي الدخل)</TableCell><TableCell className={cn("text-left", netIncome >= 0 ? "text-green-600" : "text-destructive")}>ج.م {netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
                            
                            <SectionHeader id="dist" title="(-) توزيعات الأرباح" total={totals.dist} />
                            <DetailRows id="dist" data={details.distributionsDetails} />
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-green-500/10 border-t-2 border-green-600">
                                <TableHead className="font-black text-lg">إجمالي حقوق الملكية</TableHead>
                                <TableHead className="text-left font-black text-lg">ج.م {totals.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableHead>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>

                <div className="pt-4 border-t-4 border-double border-muted-foreground/50">
                    <div className="flex justify-between items-center p-4 bg-muted/30 rounded-xl">
                        <span className="font-black text-xl">إجمالي الخصوم وحقوق الملكية</span>
                        <span className="font-black text-2xl text-primary">ج.م {(totals.ap + totals.totalEquity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    {Math.abs(totals.totalAssets - (totals.ap + totals.totalEquity)) > 1 && (
                        <div className="mt-2 text-xs text-destructive text-center flex items-center justify-center gap-1">
                            <AlertTriangle className="h-3 w-3"/> تنبيه: يوجد فرق بسيط في التوازن ({Math.abs(totals.totalAssets - (totals.ap + totals.totalEquity)).toFixed(2)}) جاري تدقيقه.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function FinancialStatementsPage() {
  return (
    <>
      <PageHeader title="القوائم المالية" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Tabs defaultValue="balance-sheet">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="income-statement">قائمة الدخل (P&L)</TabsTrigger>
            <TabsTrigger value="balance-sheet">الميزانية العمومية</TabsTrigger>
          </TabsList>
          <TabsContent value="income-statement">
            <Card>
              <CardHeader><CardTitle>قائمة الدخل</CardTitle><CardDescription>ملخص الإيرادات والمصروفات والأرباح المحققة خلال نشاط الشركة.</CardDescription></CardHeader>
              <CardContent><IncomeStatement /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="balance-sheet">
            <Card>
              <CardHeader><CardTitle>الميزانية العمومية</CardTitle><CardDescription>لقطة تفصيلية عن المركز المالي للشركة تشمل كافة الحسابات والأصول والخصوم.</CardDescription></CardHeader>
              <CardContent><BalanceSheet /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
