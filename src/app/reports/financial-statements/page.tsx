
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
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

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
}
interface PurchaseInvoice {
  id: string;
  total: number;
  discount: number;
  paidAmount?: number;
  date: string;
  warehouseId: string;
  items: { id: string; qty: number; cost?: number }[];
}
interface Expense {
  id: string;
  amount: number;
  expenseType: string;
  date: string;
  paidFromAccountId: string;
}
interface ExceptionalIncome {
    id: string;
    amount: number;
    date: string;
    paidToAccountId: string;
}
interface Customer {
  id: string;
  openingBalance: number;
}
interface Supplier {
  id: string;
  openingBalance: number;
}
interface Partner {
  id: string;
  capital: number;
}
interface Item {
    id: string;
    openingStock: number;
    price: number;
    cost?: number;
}
interface CustomerPayment {
    id: string;
    amount: number;
    customerId: string;
    paidToAccountId: string;
    date: string;
    invoiceId?: string;
}
interface SupplierPayment {
    id: string;
    amount: number;
    supplierId: string;
    paidFromAccountId: string;
    date: string;
    invoiceId?: string;
}
interface SalesReturn {
    id: string;
    total: number;
    paidAmount?: number;
    customerId: string;
    date: string;
    warehouseId: string;
    items: { id: string; qty: number; }[];
}
interface PurchaseReturn {
    id: string;
    total: number;
    paidAmount?: number;
    supplierId: string;
    date: string;
    warehouseId: string;
    items: { id: string; qty: number; }[];
}
interface StockInRecord { id: string; warehouseId: string; items: { itemId: string; name: string; qty: number; cost?: number; }[]; date: string;}
interface StockOutRecord { id: string; sourceId: string; items: { id: string; qty: number; }[]; date: string;}
interface StockTransferRecord { id: string; fromSourceId: string; toSourceId: string; items: { id: string; qty: number; }[]; date: string; }
interface StockAdjustmentRecord { id: string; warehouseId: string; items: { itemId: string; difference: number; }[]; date: string; }
interface InventoryClosing { id: string; warehouseId: string; closingDate: string; balances: { itemId: string, balance: number }[] }
interface TreasuryTransaction {
    id: string;
    type: 'deposit' | 'withdrawal';
    amount: number;
    accountId: string;
    date: string;
    linkedTransaction?: boolean;
}
interface EmployeeAdvance {
    id: string;
    amount: number;
    paidFromAccountId: string;
    date: string;
}
interface ProfitDistribution {
    id: string;
    amount: number;
    paidFromAccountId: string;
    date: string;
}
interface PosSale { id: string; warehouseId: string; items: { id: string; qty: number; cost?: number; price: number; }[]; date: string; total: number; discount: number; subtotal: number; paidAmount?: number; }
interface PayrollRecord {
    id: string;
    date: string;
    paidFromAccountId: string;
    payrollData: {
        basicSalary: number;
        totalRewards: number;
        totalPenalties: number;
        totalAdvances: number;
        netSalary: number;
    }[];
}

interface FixedAsset {
    id: string;
    name: string;
    cost: number;
    status: 'active' | 'disposed' | 'fully_depreciated';
}

interface DepreciationRecord {
    id: string;
    assetId: string;
    date: string;
    amount: number;
    note?: string;
}

const useIncomeStatementData = () => {
  const { salesInvoices, expenses, exceptionalIncomes, items, salesReturns, posSales, payrollRecords, stockAdjustmentRecords, stockOutRecords, depreciationRecords } = useData();

  return useMemo(() => {
    const approvedSales = salesInvoices.filter((s: SaleInvoice) => s.status === 'approved');
    const allSales = [...approvedSales, ...posSales];

    const grossRevenue = allSales.reduce((acc, sale) => acc + (sale.subtotal || (sale.total + (sale.discount || 0))), 0);
    const totalSalesDiscount = allSales.reduce((acc, sale) => acc + (sale.discount || 0), 0);
    const totalSalesReturns = salesReturns.reduce((acc, ret) => acc + ret.total, 0);
    
    let costOfGoodsSold = allSales.reduce((acc, sale) => {
        return acc + (sale.items?.reduce((itemAcc: number, saleItem: any) => {
            if (typeof saleItem.cost === 'number') {
                return itemAcc + (saleItem.qty * saleItem.cost);
            }
            const itemMaster = items.find((i:any) => i.id === saleItem.id);
            const masterCost = itemMaster?.cost || 0;
            return itemAcc + (saleItem.qty * masterCost);
        }, 0) || 0);
    }, 0);

    const costOfReturns = salesReturns.reduce((acc, ret) => {
        return acc + (ret.items?.reduce((itemAcc: number, item: any) => {
            const itemMaster = items.find((i:any) => i.id === item.id);
            const masterCost = itemMaster?.cost || 0;
            return itemAcc + (item.qty * masterCost);
        }, 0) || 0);
    }, 0);
    
    costOfGoodsSold -= costOfReturns;
    if (costOfGoodsSold < 0) costOfGoodsSold = 0;

    let totalExceptionalIncome = exceptionalIncomes.reduce((acc, income) => acc + income.amount, 0);
    const payrollPenalties = payrollRecords?.reduce((acc: number, record: PayrollRecord) => {
        return acc + record.payrollData.reduce((sum, p) => sum + p.totalPenalties, 0);
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

    const payrollExpenses = payrollRecords?.reduce((acc: number, record: PayrollRecord) => {
        return acc + record.payrollData.reduce((sum, p) => sum + p.basicSalary + p.totalRewards, 0);
    }, 0) || 0;

    if (payrollExpenses > 0) expensesByType['رواتب ومكافآت الموظفين'] = (expensesByType['رواتب ومكافآت الموظفين'] || 0) + payrollExpenses;

    const totalDepreciation = depreciationRecords?.reduce((acc: number, rec: DepreciationRecord) => acc + rec.amount, 0) || 0;
    if (totalDepreciation > 0) expensesByType['مصروف الإهلاك'] = (expensesByType['مصروف الإهلاك'] || 0) + totalDepreciation;

    const totalExpenses = Object.values(expensesByType).reduce((acc, amount) => acc + amount, 0);
    const netRevenue = grossRevenue - totalSalesReturns - totalSalesDiscount;
    const grossProfit = netRevenue - costOfGoodsSold;
    const netOperatingIncome = grossProfit - totalExpenses;
    const netIncome = netOperatingIncome + totalExceptionalIncome;
    
    return { grossRevenue, totalSalesReturns, totalSalesDiscount, costOfGoodsSold, totalExceptionalIncome, expensesByType, totalExpenses, netRevenue, grossProfit, netOperatingIncome, netIncome };
  }, [salesInvoices, posSales, expenses, exceptionalIncomes, items, salesReturns, payrollRecords, stockAdjustmentRecords, stockOutRecords, depreciationRecords]);
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
        warehouses, stockInRecords, stockOutRecords, stockTransferRecords, stockAdjustmentRecords, 
        stockIssuesToReps, stockReturnsFromReps, inventoryClosings,
        cashAccounts, treasuryTransactions, expenses, exceptionalIncomes, employeeAdvances, profitDistributions,
        posSales, posReturns, payrollRecords, fixedAssets, depreciationRecords,
        loading 
    } = useData();

    const { netIncome } = useIncomeStatementData();

    const stats = useMemo(() => {
        // --- AR Calculation ---
        let ar = customers.reduce((acc: number, cust: any) => acc + (cust.openingBalance || 0), 0);
        salesInvoices.filter((s:any) => s.status === 'approved').forEach((inv:any) => { ar += (inv.total - (inv.paidAmount || 0)); });
        posSales.forEach((sale:any) => { ar += (sale.total - (sale.paidAmount || 0)); });
        customerPayments.filter((p:any) => !p.invoiceId).forEach((p:any) => ar -= p.amount);
        salesReturns.forEach((r:any) => ar -= (r.total - (r.paidAmount || 0)));
        posReturns.forEach((r:any) => ar -= (r.total - (r.paidAmount || 0)));

        // --- AP Calculation ---
        let ap = suppliers.reduce((acc: number, sup: any) => acc + (sup.openingBalance || 0), 0);
        purchaseInvoices.forEach((p:any) => { ap += (p.total - (p.paidAmount || 0)); });
        supplierPayments.filter((p:any) => !p.invoiceId).forEach((p:any) => ap -= p.amount);
        purchaseReturns.forEach((r:any) => ap -= (r.total - (r.paidAmount || 0)));
        
        // --- Cash Calculation ---
        let cash = cashAccounts.reduce((acc: number, ca: any) => acc + (ca.openingBalance || 0), 0);
        customerPayments.forEach((p:any) => cash += p.amount);
        salesInvoices.filter((s:any) => s.status === 'approved').forEach((s:any) => cash += (s.paidAmount || 0) - (customerPayments.filter(p => p.invoiceId === s.id).reduce((sum, p) => sum + p.amount, 0)));
        posSales.forEach((s:any) => cash += (s.paidAmount || 0) - (customerPayments.filter(p => p.invoiceId === s.id).reduce((sum, p) => sum + p.amount, 0)));
        exceptionalIncomes.forEach((i:any) => cash += i.amount);
        treasuryTransactions.filter((tx:any) => tx.type === 'deposit' && !tx.linkedTransaction).forEach((tx:any) => cash += tx.amount);
        expenses.forEach((e:any) => cash -= e.amount);
        supplierPayments.forEach((p:any) => cash -= p.amount);
        purchaseInvoices.forEach((p:any) => cash -= (p.paidAmount || 0) - (supplierPayments.filter(sp => sp.invoiceId === p.id).reduce((sum, sp) => sum + sp.amount, 0)));
        employeeAdvances.forEach((ea:any) => cash -= ea.amount);
        profitDistributions.forEach((pd:any) => cash -= pd.amount);
        treasuryTransactions.filter((tx:any) => tx.type === 'withdrawal' && !tx.linkedTransaction).forEach((tx:any) => cash -= tx.amount);
        payrollRecords?.forEach((pr: any) => { cash -= pr.payrollData.reduce((sum: number, p: any) => sum + p.netSalary, 0); });

        // --- Other Assets ---
        let totalAdvancesGiven = employeeAdvances.reduce((acc, ea) => acc + ea.amount, 0);
        let totalAdvancesRecovered = payrollRecords?.reduce((acc: number, pr: any) => acc + pr.payrollData.reduce((sum: number, p: any) => sum + p.totalAdvances, 0), 0) || 0;
        let empAdvances = totalAdvancesGiven - totalAdvancesRecovered;

        const fixedAssetsGross = fixedAssets?.reduce((acc: number, asset: any) => (asset.status === 'active' || asset.status === 'fully_depreciated' ? acc + (asset.cost || 0) : acc), 0) || 0;
        const accDepreciation = depreciationRecords?.reduce((acc: number, rec: any) => acc + rec.amount, 0) || 0;

        return { accountsReceivable: ar, accountsPayable: ap, cashAndEquivalents: cash, employeeAdvancesBalance: empAdvances, fixedAssetsGross, accumulatedDepreciation: accDepreciation, fixedAssetsNet: fixedAssetsGross - accDepreciation };
    }, [customers, suppliers, salesInvoices, purchaseInvoices, customerPayments, supplierPayments, salesReturns, purchaseReturns, cashAccounts, treasuryTransactions, expenses, exceptionalIncomes, employeeAdvances, profitDistributions, posSales, posReturns, payrollRecords, fixedAssets, depreciationRecords]);

    const inventoryValue = useMemo(() => {
        let total = 0;
        allItems.forEach((item: any) => {
            let stock = 0;
            warehouses.forEach((warehouse: any) => {
                const closings = inventoryClosings.filter((c: any) => c.warehouseId === warehouse.id).sort((a: any, b: any) => new Date(b.closingDate).getTime() - new Date(a.date).getTime());
                const lastClosing = closings[0] ?? null;
                const lastClosingDate = lastClosing ? new Date(lastClosing.closingDate) : new Date(0);
                let warehouseStock = lastClosing?.balances?.find((b:any) => b.itemId === item.id)?.balance || 0;
                const filter = (t: any) => new Date(t.date) > lastClosingDate;
                stockInRecords.filter(si => si.warehouseId === warehouse.id && filter(si)).forEach(si => si.items.forEach((i: any) => { if (i.itemId === item.id) warehouseStock += i.qty; }));
                salesInvoices.filter(s => s.warehouseId === warehouse.id && s.status === 'approved' && filter(s)).forEach(s => s.items.filter((i: any) => i.id === item.id).forEach((i: any) => warehouseStock -= i.qty));
                stock += warehouseStock;
            });
            if(stock > 0) total += stock * (item.cost || 0);
        });
        return total;
    }, [allItems, warehouses, inventoryClosings, stockInRecords, salesInvoices]);

    const totalCapital = partners.reduce((acc:number, p:any) => acc + (p.capital || 0), 0);
    const totalDistributions = profitDistributions.reduce((acc, d) => acc + d.amount, 0);
    const totalAssets = stats.cashAndEquivalents + stats.accountsReceivable + inventoryValue + stats.employeeAdvancesBalance + stats.fixedAssetsNet;
    const totalEquity = totalCapital + netIncome - totalDistributions;

    if (loading) return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    return (
        <div className="grid md:grid-cols-2 gap-8">
            <div>
                <h3 className="text-lg font-semibold mb-2 border-b pb-2">الأصول</h3>
                <Table>
                    <TableBody>
                        <TableRow><TableCell>النقدية وما في حكمها</TableCell><TableCell className="text-left">ج.م {stats.cashAndEquivalents.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
                        <TableRow><TableCell>حسابات العملاء (الذمم المدينة)</TableCell><TableCell className="text-left">ج.م {stats.accountsReceivable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
                        <TableRow><TableCell>سلف الموظفين (أرصدة مدينة)</TableCell><TableCell className="text-left">ج.م {stats.employeeAdvancesBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
                        <TableRow><TableCell>قيمة المخزون الحالية (بالتكلفة)</TableCell><TableCell className="text-left">ج.م {inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
                        <TableRow><TableCell>الأصول الثابتة (بالصافي)</TableCell><TableCell className="text-left font-semibold">ج.م {stats.fixedAssetsNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
                    </TableBody>
                    <TableFooter><TableRow className="bg-muted/50"><TableHead>إجمالي الأصول</TableHead><TableHead className="text-left">ج.م {totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableHead></TableRow></TableFooter>
                </Table>
            </div>
            <div>
                <h3 className="text-lg font-semibold mb-2 border-b pb-2">الخصوم وحقوق الملكية</h3>
                 <Table>
                    <TableBody><TableRow><TableCell>حسابات الموردين (الذمم الدائنة)</TableCell><TableCell className="text-left">ج.م {stats.accountsPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow></TableBody>
                    <TableFooter><TableRow className="bg-muted/50"><TableHead>إجمالي الخصوم</TableHead><TableHead className="text-left">ج.م {stats.accountsPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableHead></TableRow></TableFooter>
                </Table>
                 <Table className="mt-4">
                    <TableBody>
                         <TableRow><TableCell>رأس المال</TableCell><TableCell className="text-left">ج.م {totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
                         <TableRow><TableCell>الأرباح المحتجزة (صافي الدخل)</TableCell><TableCell className="text-left">ج.م {netIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
                        <TableRow><TableCell className="pl-8 text-muted-foreground">(-) توزيعات الأرباح</TableCell><TableCell className="text-left text-destructive">- ج.م {totalDistributions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
                    </TableBody>
                     <TableFooter><TableRow className="bg-muted/50"><TableHead>إجمالي حقوق الملكية</TableHead><TableHead className="text-left">ج.م {totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableHead></TableRow></TableFooter>
                </Table>
                 <Table className="mt-4">
                    <TableFooter><TableRow className="bg-muted/50"><TableHead>إجمالي الخصوم وحقوق الملكية</TableHead><TableHead className="text-left">ج.م {(stats.accountsPayable + totalEquity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableHead></TableRow></TableFooter>
                </Table>
            </div>
        </div>
    )
}

export default function FinancialStatementsPage() {
  return (
    <>
      <PageHeader title="القوائم المالية" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Tabs defaultValue="income-statement">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="income-statement">قائمة الدخل</TabsTrigger>
            <TabsTrigger value="balance-sheet">الميزانية العمومية</TabsTrigger>
          </TabsList>
          <TabsContent value="income-statement">
            <Card>
              <CardHeader><CardTitle>قائمة الدخل</CardTitle><CardDescription>ملخص الإيرادات والمصروفات والأرباح لفترة معينة.</CardDescription></CardHeader>
              <CardContent><IncomeStatement /></CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="balance-sheet">
            <Card>
              <CardHeader><CardTitle>الميزانية العمومية</CardTitle><CardDescription>لقطة عن الوضع المالي للشركة في تاريخ محدد.</CardDescription></CardHeader>
              <CardContent><BalanceSheet /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
