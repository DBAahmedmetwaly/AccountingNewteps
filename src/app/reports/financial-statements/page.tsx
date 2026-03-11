

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
}
interface SupplierPayment {
    id: string;
    amount: number;
    supplierId: string;
    paidFromAccountId: string;
    date: string;
}
interface SalesReturn {
    id: string;
    total: number;
    customerId: string;
    date: string;
    warehouseId: string;
    items: { id: string; qty: number; }[];
}
interface PurchaseReturn {
    id: string;
    total: number;
    supplierId: string;
    date: string;
    warehouseId: string;
    items: { id: string; qty: number; }[];
}
interface StockInRecord { id: string; warehouseId: string; items: { itemId: string; name: string; qty: number; cost?: number; }[]; date: string;}
interface StockOutRecord { id: string; sourceId: string; items: { id: string; qty: number; }[]; date: string;}
interface StockTransferRecord { id: string; fromSourceId: string; toSourceId: string; items: { id: string; qty: number; }[]; date: string; }
interface StockAdjustmentRecord { id: string; warehouseId: string; items: { itemId: string; difference: number; }[]; date: string; }
interface IssueToRep { id: string; warehouseId: string; items: { id: string; qty: number; }[]; date: string; }
interface ReturnFromRep { id: string; warehouseId: string; items: { id: string; qty: number; }[]; date: string; }
interface WarehouseData { id: string; name: string; autoStockUpdate?: boolean; }
interface InventoryClosing { id: string; warehouseId: string; closingDate: string; balances: { itemId: string, balance: number }[] }
interface CashAccount {
    id: string;
    name: string;
    openingBalance: number;
}
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
interface PosSale { id: string; warehouseId: string; items: { id: string; qty: number; cost?: number; price: number; }[]; date: string; total: number; discount: number; subtotal: number; }
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

// --- Financial Statement Components ---

const useJournalData = (allData: any) => {
    const {
        salesInvoices, purchaseInvoices, expenses, exceptionalIncomes, warehouses,
        stockTransferRecords: transfers, items: itemsData, cashAccounts, treasuryTransactions: treasuryTxs,
        employeeAdvances, employees, employeeAdjustments, salesReturns, purchaseReturns,
        customers, suppliers, supplierPayments, customerPayments, stockOutRecords: stockOuts,
        profitDistributions, partners, stockInRecords, payrollRecords, fixedAssets, depreciationRecords, stockAdjustmentRecords
    } = allData;
    
     const itemsMap = useMemo(() => {
        const map = new Map<string, Item>();
        itemsData.forEach((item:Item) => map.set(item.id, item));
        return map;
    }, [itemsData]);
    
    const journalEntries = useMemo(() => {
        const entries: any[] = [];
        const getWarehouseName = (id?: string) => warehouses.find((w:any) => w.id === id)?.name || 'غير معروف';
        const getCashAccountName = (id?: string) => cashAccounts.find((c:any) => c.id === id)?.name || 'النقدية/البنك';
        const getEmployeeName = (id?: string) => employees.find((e:any) => e.id === id)?.name || 'موظف غير معروف';
        const getCustomerName = (id?: string) => customers.find((c:any) => c.id === id)?.name || 'عميل غير معروف';
        const getSupplierName = (id?: string) => suppliers.find((s:any) => s.id === id)?.name || 'مورد غير معروف';
        const getPartnerName = (id?: string) => partners.find((p:any) => p.id === id)?.name || 'شريك غير معروف';
        
        // --- OPENING BALANCES ---
        customers.forEach((c:any) => { if(c.openingBalance > 0) entries.push({ account: 'حسابات العملاء', debit: c.openingBalance, credit: 0 }) });
        suppliers.forEach((s:any) => { if(s.openingBalance > 0) entries.push({ account: 'حسابات الموردين', credit: s.openingBalance, debit: 0 }) });
        cashAccounts.forEach((ca:any) => { if(ca.openingBalance > 0) entries.push({ account: ca.name, debit: ca.openingBalance, credit: 0 }) });
        partners.forEach((p:any) => { if(p.capital > 0) entries.push({ account: 'رأس المال', credit: p.capital, debit: 0 }) });

        // --- TRANSACTIONS ---
        
        // Sales Invoices
        salesInvoices.filter((s: SaleInvoice) => s.status === 'approved').forEach((sale:SaleInvoice) => {
            const totalBeforeDiscount = sale.subtotal || (sale.total + (sale.discount || 0));
            if(sale.discount > 0) entries.push({ account: 'خصم مسموح به', debit: sale.discount, credit: 0 });
            entries.push({ account: 'إيرادات المبيعات', credit: totalBeforeDiscount, debit: 0 });
            entries.push({ account: 'حسابات العملاء', debit: sale.total, credit: 0 });
            
            const cogs = sale.items.reduce((acc, saleItem) => {
                 if (typeof saleItem.cost === 'number') {
                    return acc + (saleItem.qty * saleItem.cost);
                }
                const itemMaster = itemsMap.get(saleItem.id);
                const masterCost = itemMaster?.cost || 0;
                return acc + (saleItem.qty * masterCost);
            }, 0);

            if(cogs > 0) {
                entries.push({ account: 'تكلفة البضاعة المباعة', debit: cogs, credit: 0 });
                entries.push({ account: `مخزون - ${getWarehouseName(sale.warehouseId)}`, credit: cogs, debit: 0 });
            }
             if (sale.paidAmount && sale.paidAmount > 0) {
                entries.push({ account: getCashAccountName((sale as any).paidToAccountId), debit: sale.paidAmount, credit: 0 });
                entries.push({ account: 'حسابات العملاء', credit: sale.paidAmount, debit: 0 });
            }
        });

        // Customer Payments (Separate)
        customerPayments.forEach((p:any) => {
            entries.push({ account: getCashAccountName(p.paidToAccountId), debit: p.amount, credit: 0 });
            entries.push({ account: 'حسابات العملاء', credit: p.amount, debit: 0 });
        });

        // Sales Returns
        salesReturns.forEach((sr:any) => {
            entries.push({ account: 'مرتجعات ومسموحات المبيعات', debit: sr.total, credit: 0 });
            entries.push({ account: 'حسابات العملاء', credit: sr.total, debit: 0 });
             const costOfGoodsReturned = sr.items.reduce((acc: number, item: any) => acc + (item.qty * (itemsMap.get(item.id)?.cost || 0)), 0);
             if (costOfGoodsReturned > 0) {
                 entries.push({ account: `مخزون - ${getWarehouseName(sr.warehouseId)}`, debit: costOfGoodsReturned, credit: 0 });
                 entries.push({ account: 'تكلفة البضاعة المباعة', credit: costOfGoodsReturned, debit: 0 });
             }
        });
        
        // Purchase Invoices
        purchaseInvoices.forEach((p:any) => {
            const totalBeforeDiscount = p.subtotal || (p.total + (p.discount || 0));
            entries.push({ account: 'المشتريات', debit: totalBeforeDiscount, credit: 0 });
            if(p.discount > 0) entries.push({ account: 'خصم مكتسب', credit: p.discount, debit: 0 });
            entries.push({ account: 'حسابات الموردين', credit: p.total, debit: 0 });

            if (p.paidAmount && p.paidAmount > 0) {
                entries.push({ account: 'حسابات الموردين', debit: p.paidAmount, credit: 0 });
                entries.push({ account: getCashAccountName(p.paidFromAccountId), credit: p.paidAmount, debit: 0 });
            }
        });
        
        // Stock In (for inventory accounting - filtering out those linked to Purchase Invoices)
        stockInRecords.filter((si:any) => !si.purchaseInvoiceId).forEach((si:any) => {
             const stockInValue = si.items.reduce((acc:number, item:any) => acc + (item.qty * (item.cost || 0)), 0);
             if (stockInValue > 0) {
                 entries.push({ account: `مخزون - ${getWarehouseName(si.warehouseId)}`, debit: stockInValue, credit: 0 });
                 entries.push({ account: 'رأس المال', credit: stockInValue, debit: 0 });
             }
        });
        
        // Stock Adjustments (Surplus/Deficit)
        stockAdjustmentRecords?.forEach((adj: any) => {
             const warehouse = getWarehouseName(adj.warehouseId);
             let totalSurplusValue = 0;
             let totalDeficitValue = 0;

             adj.items.forEach((item:any) => {
                 const itemMaster = itemsData.find((i:any) => i.id === item.itemId);
                 const cost = item.cost || itemMaster?.cost || 0;
                 const value = item.difference * cost;
                 if (value > 0) totalSurplusValue += value;
                 else totalDeficitValue += Math.abs(value);
             });

             if (totalSurplusValue > 0) {
                 entries.push({ account: `مخزون - ${warehouse}`, debit: totalSurplusValue, credit: 0 });
                 entries.push({ account: 'أرباح تسوية المخزون', credit: totalSurplusValue, debit: 0 });
             }

             if (totalDeficitValue > 0) {
                 entries.push({ account: 'خسائر تسوية المخزون', debit: totalDeficitValue, credit: 0 });
                 entries.push({ account: `مخزون - ${warehouse}`, credit: totalDeficitValue, debit: 0 });
             }
        });

        // Supplier Payments (Separate)
        supplierPayments.forEach((p:any) => {
            entries.push({ account: 'حسابات الموردين', debit: p.amount, credit: 0 });
            entries.push({ account: getCashAccountName(p.paidFromAccountId), credit: p.amount, debit: 0 });
        });
        
         // Expenses
        expenses.forEach((e:any) => {
             entries.push({ account: e.expenseType, debit: e.amount, credit: 0 });
             entries.push({ account: getCashAccountName(e.paidFromAccountId), credit: e.amount, debit: 0 });
        });
        
        // Incomes
        exceptionalIncomes.forEach((i:any) => {
            entries.push({ account: 'دخل استثنائي', credit: i.amount, debit: 0 });
            entries.push({ account: getCashAccountName(i.paidToAccountId), debit: i.amount, credit: 0 });
        });
        
        // Treasury Transactions
        treasuryTxs.forEach((tx:TreasuryTransaction) => {
            if (tx.type === 'deposit' && !tx.linkedTransaction) {
                entries.push({ account: getCashAccountName(tx.accountId), debit: tx.amount, credit: 0 });
                entries.push({ account: 'رأس المال', credit: tx.amount, debit: 0 });
            } else if (tx.type === 'withdrawal' && !tx.linkedTransaction) {
                entries.push({ account: 'مسحوبات الشركاء', debit: tx.amount, credit: 0 });
                entries.push({ account: getCashAccountName(tx.accountId), credit: tx.amount, debit: 0 });
            }
        });

        // Stock Out (Damaged / Spoilage / Usage)
        stockOuts.forEach((so:any) => {
             const stockOutValue = so.items.reduce((acc:number, item:any) => {
                 const itemMaster = itemsMap.get(item.id);
                 const cost = item.cost || itemMaster?.cost || 0;
                 return acc + (item.qty * cost);
             }, 0);

             if (stockOutValue > 0) {
                 entries.push({ account: 'بضاعة تالفة / هوالك', debit: stockOutValue, credit: 0 });
                 entries.push({ account: `مخزون - ${getWarehouseName(so.sourceId)}`, credit: stockOutValue, debit: 0 });
             }
        });

        // Profit Distribution
        profitDistributions.forEach((d:any) => {
             entries.push({ account: 'توزيعات أرباح', debit: d.amount, credit: 0 });
             entries.push({ account: getCashAccountName(d.paidFromAccountId), credit: d.amount, debit: 0 });
        });

        // Payroll
        payrollRecords?.forEach((pr: PayrollRecord) => {
            const totalBasicSalary = pr.payrollData.reduce((sum, p) => sum + p.basicSalary, 0);
            const totalRewards = pr.payrollData.reduce((sum, p) => sum + p.totalRewards, 0);
            const totalAdvances = pr.payrollData.reduce((sum, p) => sum + p.totalAdvances, 0);
            const totalPenalties = pr.payrollData.reduce((sum, p) => sum + p.totalPenalties, 0);
            const totalNetSalary = pr.payrollData.reduce((sum, p) => sum + p.netSalary, 0);

            // Debit Salary Expense (Gross)
            entries.push({ account: 'مصروف الرواتب', debit: totalBasicSalary + totalRewards, credit: 0 });
            
            // Credit Advances (Recovered)
            if (totalAdvances > 0) {
                entries.push({ account: 'سلف الموظفين', debit: 0, credit: totalAdvances });
            }
            
            // Credit Penalties (Revenue)
            if (totalPenalties > 0) {
                entries.push({ account: 'إيرادات أخرى - جزاءات', debit: 0, credit: totalPenalties });
            }

            // Credit Cash (Net Salary Paid)
            if (totalNetSalary > 0) {
                 entries.push({ account: getCashAccountName(pr.paidFromAccountId), debit: 0, credit: totalNetSalary });
            }
        });

        // Employee Advances (Given)
        employeeAdvances.forEach((ea: any) => {
            entries.push({ account: 'سلف الموظفين', debit: ea.amount, credit: 0 });
            entries.push({ account: getCashAccountName(ea.paidFromAccountId), debit: 0, credit: ea.amount });
        });

        // Depreciation
        depreciationRecords?.forEach((rec: DepreciationRecord) => {
             const asset = fixedAssets?.find((a: FixedAsset) => a.id === rec.assetId);
             const assetName = asset?.name || 'أصل غير معروف';
             entries.push({ account: 'مصروف الإهلاك', debit: rec.amount, credit: 0 });
             entries.push({ account: 'مجمع الإهلاك', debit: 0, credit: rec.amount });
        });

        return entries;
    }, [
        salesInvoices, purchaseInvoices, expenses, exceptionalIncomes, warehouses,
        transfers, itemsData, cashAccounts, treasuryTxs, employeeAdvances, 
        employees, employeeAdjustments, salesReturns, purchaseReturns, customers, 
        suppliers, supplierPayments, customerPayments, stockOuts, profitDistributions, 
        partners, stockInRecords, payrollRecords, fixedAssets, depreciationRecords
    ]);

    return { journalEntries };
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
            // Prioritize cost from the invoice item itself (historical cost)
            if (typeof saleItem.cost === 'number') {
                return itemAcc + (saleItem.qty * saleItem.cost);
            }
            // Fallback to item master data if historical cost is not available
            const itemMaster = items.find((i:Item) => i.id === saleItem.id);
            const masterCost = itemMaster?.cost || 0;
            return itemAcc + (saleItem.qty * masterCost);
        }, 0) || 0);
    }, 0);

    // Subtract Cost of Returns from COGS
    const costOfReturns = salesReturns.reduce((acc, ret) => {
        return acc + (ret.items?.reduce((itemAcc: number, item: any) => {
            const itemMaster = items.find((i:Item) => i.id === item.id);
            const masterCost = itemMaster?.cost || 0;
            return itemAcc + (item.qty * masterCost);
        }, 0) || 0);
    }, 0);
    
    costOfGoodsSold -= costOfReturns;
    if (costOfGoodsSold < 0) costOfGoodsSold = 0; // Safety check

    let totalExceptionalIncome = exceptionalIncomes.reduce((acc, income) => acc + income.amount, 0);

    // Calculate Payroll Revenues (Penalties)
    const payrollPenalties = payrollRecords?.reduce((acc: number, record: PayrollRecord) => {
        return acc + record.payrollData.reduce((sum, p) => sum + p.totalPenalties, 0);
    }, 0) || 0;
    
    totalExceptionalIncome += payrollPenalties;

    // Calculate Inventory Adjustment Gains (Surplus)
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
    
    // Calculate Inventory Adjustment Losses (Deficit)
    const inventoryAdjustmentLosses = stockAdjustmentRecords?.reduce((acc: number, adj: any) => {
        return acc + adj.items.reduce((sum: number, item: any) => {
             const itemMaster = items.find((i:any) => i.id === item.itemId);
             const cost = item.cost || itemMaster?.cost || 0;
             const val = item.difference * cost;
             return sum + (val < 0 ? Math.abs(val) : 0);
        }, 0);
    }, 0) || 0;

    if (inventoryAdjustmentLosses > 0) {
        expensesByType['خسائر تسوية المخزون'] = (expensesByType['خسائر تسوية المخزون'] || 0) + inventoryAdjustmentLosses;
    }

    // Calculate Stock Out Losses (Damaged / Spoilage)
    const stockOutLosses = stockOutRecords?.reduce((acc: number, so: any) => {
         return acc + so.items.reduce((sum: number, item: any) => {
             const itemMaster = items.find((i:any) => i.id === item.id);
             const cost = item.cost || itemMaster?.cost || 0;
             return sum + (item.qty * cost);
         }, 0);
    }, 0) || 0;

    if (stockOutLosses > 0) {
        expensesByType['بضاعة تالفة / هوالك'] = (expensesByType['بضاعة تالفة / هوالك'] || 0) + stockOutLosses;
    }

    // Calculate Payroll Expenses (Basic + Rewards)
    const payrollExpenses = payrollRecords?.reduce((acc: number, record: PayrollRecord) => {
        return acc + record.payrollData.reduce((sum, p) => sum + p.basicSalary + p.totalRewards, 0);
    }, 0) || 0;

    if (payrollExpenses > 0) {
        expensesByType['رواتب ومكافآت الموظفين'] = (expensesByType['رواتب ومكافآت الموظفين'] || 0) + payrollExpenses;
    }

    // Calculate Depreciation Expense
    const totalDepreciation = depreciationRecords?.reduce((acc: number, rec: DepreciationRecord) => acc + rec.amount, 0) || 0;
    if (totalDepreciation > 0) {
        expensesByType['مصروف الإهلاك'] = (expensesByType['مصروف الإهلاك'] || 0) + totalDepreciation;
    }

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
  const {
      grossRevenue,
      totalSalesReturns,
      totalSalesDiscount,
      costOfGoodsSold,
      totalExceptionalIncome,
      expensesByType,
      netRevenue,
      grossProfit,
      netOperatingIncome,
      netIncome
  } = useIncomeStatementData();
  

  if (loading) {
    return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Table>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">إجمالي الإيرادات (المبيعات)</TableCell>
          <TableCell className="text-left">ج.م {grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="pl-8 text-muted-foreground">(-) مرتجعات ومسموحات المبيعات</TableCell>
          <TableCell className="text-left text-destructive">- ج.م {totalSalesReturns.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="pl-8 text-muted-foreground">(-) خصم مسموح به</TableCell>
          <TableCell className="text-left text-destructive">- ج.م {totalSalesDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
        </TableRow>
         <TableRow className="font-semibold border-t">
          <TableCell>صافي الإيرادات</TableCell>
          <TableCell className="text-left">ج.م {netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">تكلفة البضاعة المباعة (COGS)</TableCell>
          <TableCell className="text-left text-destructive">- ج.م {costOfGoodsSold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
        </TableRow>
        <TableRow>
          <TableHead>مجمل الربح</TableHead>
          <TableHead className="text-left">ج.م {grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableHead>
        </TableRow>
        <TableRow>
            <TableCell colSpan={2} className="font-medium pt-4">المصروفات التشغيلية:</TableCell>
        </TableRow>
        {Object.entries(expensesByType).map(([type, amount]) => (
             <TableRow key={type}>
                <TableCell className="pl-8 text-muted-foreground">{type}</TableCell>
                <TableCell className="text-left text-destructive">- ج.م {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
            </TableRow>
        ))}
         <TableRow>
          <TableHead>صافي الدخل التشغيلي</TableHead>
          <TableHead className="text-left">ج.م {netOperatingIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableHead>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">الدخل الاستثنائي</TableCell>
          <TableCell className="text-left">ج.م {totalExceptionalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow className="bg-muted/50">
          <TableHead className="font-bold text-lg">صافي الدخل النهائي</TableHead>
          <TableHead className={`font-bold text-lg text-left ${netIncome >= 0 ? 'text-green-600' : 'text-destructive'}`}>
            ج.م {netIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </TableHead>
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
        posSales, payrollRecords, fixedAssets, depreciationRecords,
        loading 
    } = useData();

    const { netIncome } = useIncomeStatementData();

    const { accountsReceivable, accountsPayable, cashAndEquivalents, inventoryValue, employeeAdvancesBalance, fixedAssetsGross, accumulatedDepreciation, fixedAssetsNet } = useMemo(() => {
        let ar = customers.reduce((acc: number, cust: any) => acc + (cust.openingBalance || 0), 0);
        salesInvoices.filter((s:any) => s.status === 'approved').forEach((s:any) => {
            ar += s.total;
            ar -= s.paidAmount || 0;
        });
        customerPayments.forEach((p:any) => ar -= p.amount);
        salesReturns.forEach((sr:any) => ar -= sr.total);

        let ap = suppliers.reduce((acc: number, sup: any) => acc + (sup.openingBalance || 0), 0);
        purchaseInvoices.forEach((p:any) => {
            ap += p.total;
            ap -= p.paidAmount || 0;
        });
        supplierPayments.forEach((p:any) => ap -= p.amount);
        purchaseReturns.forEach((pr:any) => ap -= pr.total);
        
        // Cash calculation
        let cash = cashAccounts.reduce((acc: number, ca: any) => acc + (ca.openingBalance || 0), 0);
        customerPayments.forEach((p:any) => cash += p.amount);
        salesInvoices.filter((s:any) => s.status === 'approved').forEach((s:any) => cash += s.paidAmount || 0);
        exceptionalIncomes.forEach((i:any) => cash += i.amount);
        treasuryTransactions.filter((tx:any) => tx.type === 'deposit' && !tx.linkedTransaction).forEach((tx:any) => cash += tx.amount);

        expenses.forEach((e:any) => cash -= e.amount);
        supplierPayments.forEach((p:any) => cash -= p.amount);
        purchaseInvoices.forEach((p:any) => cash -= p.paidAmount || 0);
        employeeAdvances.forEach((ea:any) => cash -= ea.amount);
        profitDistributions.forEach((pd:any) => cash -= pd.amount);
        treasuryTransactions.filter((tx:any) => tx.type === 'withdrawal' && !tx.linkedTransaction).forEach((tx:any) => cash -= tx.amount);
        
        // Deduct Payroll Payments from Cash
        payrollRecords?.forEach((pr: PayrollRecord) => {
            const totalNetSalary = pr.payrollData.reduce((sum, p) => sum + p.netSalary, 0);
            cash -= totalNetSalary;
        });

        // Calculate Employee Advances Balance (Asset)
        let totalAdvancesGiven = employeeAdvances.reduce((acc, ea) => acc + ea.amount, 0);
        let totalAdvancesRecovered = payrollRecords?.reduce((acc: number, pr: PayrollRecord) => {
            return acc + pr.payrollData.reduce((sum, p) => sum + p.totalAdvances, 0);
        }, 0) || 0;
        
        let empAdvances = totalAdvancesGiven - totalAdvancesRecovered;

        // --- Inventory Value Calculation ---
        let totalInventoryValue = 0;
        
        allItems.forEach((item: any) => {
          let stock = 0;
           warehouses.forEach((warehouse: WarehouseData) => {
                const closingsForWarehouse = inventoryClosings.filter((c: InventoryClosing) => c.warehouseId === warehouse.id)
                    .sort((a: any,b: any) => new Date(b.closingDate).getTime() - new Date(a.closingDate).getTime());
                const lastClosing = closingsForWarehouse[0] ?? null;
                const lastClosingDate = lastClosing ? new Date(lastClosing.closingDate) : new Date(0);
                
                let warehouseStock = lastClosing?.balances?.find((b:any) => b.itemId === item.id)?.balance || 0;
                const filterTransactions = (t: any) => new Date(t.date) > lastClosingDate;

                stockInRecords.filter((si: any) => si.warehouseId === warehouse.id && filterTransactions(si)).forEach((si: any) => si.items.forEach((i: any) => { if (i.itemId === item.id) warehouseStock += i.qty; }));
                stockTransferRecords.filter((t: any) => t.toSourceId === warehouse.id && filterTransactions(t)).forEach((t: any) => t.items.forEach((i: any) => { if (i.id === item.id) warehouseStock += i.qty; }));
                stockAdjustmentRecords.filter((adj: any) => adj.warehouseId === warehouse.id && filterTransactions(adj)).forEach((adj: any) => adj.items.forEach((i: any) => { if (i.itemId === item.id && i.difference > 0) warehouseStock += i.difference; }));
                salesReturns.filter((sr: any) => sr.warehouseId === warehouse.id && filterTransactions(sr)).forEach((sr: any) => sr.items.forEach((i: any) => { if (i.id === item.id) warehouseStock += i.qty; }));
                stockReturnsFromReps.filter((rfr: any) => rfr.warehouseId === warehouse.id && filterTransactions(rfr)).forEach((rfr: any) => rfr.items.forEach((i: any) => { if (i.id === item.id) warehouseStock += i.qty; }));
                
                stockOutRecords.filter((so: any) => so.sourceId === warehouse.id && filterTransactions(so)).forEach((so: any) => { so.items.forEach((i: any) => { if (i.id === item.id) warehouseStock -= i.qty; }); });
                salesInvoices.filter((s: any) => s.warehouseId === warehouse.id && s.status === 'approved' && filterTransactions(s)).forEach((s: any) => s.items.filter((i: any) => i.id === item.id).forEach((i: any) => warehouseStock -= i.qty));
                posSales.filter((s: any) => s.warehouseId === warehouse.id && filterTransactions(s)).forEach((s: any) => s.items.filter((i: any) => i.id === item.id).forEach((i: any) => warehouseStock -= i.qty));
                stockTransferRecords.filter((t: any) => t.fromSourceId === warehouse.id && filterTransactions(t)).forEach((t: any) => { t.items.forEach((i: any) => { if (i.id === item.id) warehouseStock -= i.qty; }); });
                stockAdjustmentRecords.filter((adj: any) => adj.warehouseId === warehouse.id && filterTransactions(adj)).forEach((adj: any) => { adj.items.forEach((i: any) => { if (i.itemId === item.id && i.difference < 0) warehouseStock += i.difference; }); });
                purchaseReturns.filter((pr: any) => pr.warehouseId === warehouse.id && filterTransactions(pr)).forEach((pr: any) => { pr.items.forEach((i: any) => { if (i.id === item.id) warehouseStock -= i.qty; }); });
                stockIssuesToReps.filter((itr: any) => itr.warehouseId === warehouse.id && filterTransactions(itr)).forEach((itr: any) => itr.items.filter((i: any) => i.id === item.id).forEach((i: any) => warehouseStock -= i.qty));
                
                stock += warehouseStock;
           });

           if(stock > 0){
             totalInventoryValue += stock * (item.cost || 0);
           }
        });

        // Fixed Assets Calculation
        const fixedAssetsGross = fixedAssets?.reduce((acc: number, asset: FixedAsset) => {
            if (asset.status === 'active' || asset.status === 'fully_depreciated') {
                return acc + (asset.cost || 0);
            }
            return acc;
        }, 0) || 0;

        const accumulatedDepreciation = depreciationRecords?.reduce((acc: number, rec: DepreciationRecord) => acc + rec.amount, 0) || 0;
        const fixedAssetsNet = fixedAssetsGross - accumulatedDepreciation;

        return { accountsReceivable: ar, accountsPayable: ap, cashAndEquivalents: cash, inventoryValue: totalInventoryValue, employeeAdvancesBalance: empAdvances, fixedAssetsGross, accumulatedDepreciation, fixedAssetsNet };
    }, [
        customers, suppliers, salesInvoices, purchaseInvoices, customerPayments, supplierPayments, salesReturns, purchaseReturns, 
        cashAccounts, treasuryTransactions, expenses, exceptionalIncomes, employeeAdvances, profitDistributions, 
        allItems, warehouses, inventoryClosings, stockInRecords, stockOutRecords, stockTransferRecords, 
        stockAdjustmentRecords, stockIssuesToReps, stockReturnsFromReps, posSales, payrollRecords, fixedAssets, depreciationRecords
    ]);

    const totalCapital = partners.reduce((acc:number, p:any) => acc + (p.capital || 0), 0);
    const totalDistributions = profitDistributions.reduce((acc, d) => acc + d.amount, 0);
    
    const totalAssets = cashAndEquivalents + accountsReceivable + inventoryValue + employeeAdvancesBalance + fixedAssetsNet;
    const totalLiabilities = accountsPayable;
    const totalEquity = totalCapital + netIncome - totalDistributions;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    if (loading) {
        return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="grid md:grid-cols-2 gap-8">
            {/* Assets */}
            <div>
                <h3 className="text-lg font-semibold mb-2 border-b pb-2">الأصول</h3>
                <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell>النقدية وما في حكمها</TableCell>
                            <TableCell className="text-left">ج.م {cashAndEquivalents.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>حسابات العملاء (الذمم المدينة)</TableCell>
                            <TableCell className="text-left">ج.م {accountsReceivable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>سلف الموظفين (أرصدة مدينة)</TableCell>
                            <TableCell className="text-left">ج.م {employeeAdvancesBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                         <TableRow>
                            <TableCell>قيمة المخزون الحالية (بالتكلفة)</TableCell>
                            <TableCell className="text-left">ج.م {inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                         <TableRow>
                            <TableCell>الأصول الثابتة (بالصافي)</TableCell>
                            <TableCell className="text-left font-semibold">ج.م {fixedAssetsNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="pl-8 text-muted-foreground text-sm">-- إجمالي الأصول الثابتة (التكلفة)</TableCell>
                            <TableCell className="text-left text-muted-foreground text-sm">ج.م {fixedAssetsGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="pl-8 text-muted-foreground text-sm">-- مجمع الإهلاك</TableCell>
                            <TableCell className="text-left text-destructive text-sm">- ج.م {accumulatedDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-muted/50">
                            <TableHead>إجمالي الأصول</TableHead>
                            <TableHead className="text-left">ج.م {totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableHead>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>

            {/* Liabilities & Equity */}
            <div>
                <h3 className="text-lg font-semibold mb-2 border-b pb-2">الخصوم وحقوق الملكية</h3>
                 <Table>
                    <TableHeader><TableRow><TableHead>الخصوم</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell>حسابات الموردين (الذمم الدائنة)</TableCell>
                            <TableCell className="text-left">ج.م {accountsPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                    </TableBody>
                    <TableFooter>
                         <TableRow className="bg-muted/50">
                            <TableHead>إجمالي الخصوم</TableHead>
                            <TableHead className="text-left">ج.م {totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableHead>
                        </TableRow>
                    </TableFooter>
                </Table>
                 <Table className="mt-4">
                    <TableHeader><TableRow><TableHead>حقوق الملكية</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                         <TableRow>
                            <TableCell>رأس المال</TableCell>
                            <TableCell className="text-left">ج.م {totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                         <TableRow>
                            <TableCell>الأرباح المحتجزة (صافي الدخل)</TableCell>
                            <TableCell className="text-left">ج.م {netIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="pl-8 text-muted-foreground">(-) توزيعات الأرباح</TableCell>
                            <TableCell className="text-left text-destructive">- ج.م {totalDistributions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                    </TableBody>
                     <TableFooter>
                        <TableRow className="bg-muted/50">
                            <TableHead>إجمالي حقوق الملكية</TableHead>
                            <TableHead className="text-left">ج.م {totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableHead>
                        </TableRow>
                    </TableFooter>
                </Table>
                 <Table className="mt-4">
                    <TableFooter>
                        <TableRow className="bg-muted/50">
                            <TableHead>إجمالي الخصوم وحقوق الملكية</TableHead>
                            <TableHead className="text-left">ج.م {totalLiabilitiesAndEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableHead>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
        </div>
    )
}

function TrialBalance() {
    const allData = useData();
    const { journalEntries } = useJournalData(allData);

    const accountBalances = useMemo(() => {
        const balances: { [key: string]: { debit: number, credit: number } } = {};

        journalEntries.forEach(entry => {
            if (!balances[entry.account]) {
                balances[entry.account] = { debit: 0, credit: 0 };
            }
            balances[entry.account].debit += entry.debit;
            balances[entry.account].credit += entry.credit;
        });

        return Object.entries(balances).map(([account, { debit, credit }]) => {
            const balance = debit - credit;
            return {
                account,
                debit: balance > 0 ? balance : 0,
                credit: balance < 0 ? -balance : 0,
            };
        }).filter(item => item.debit !== 0 || item.credit !== 0);
    }, [journalEntries]);
    
    const totalDebits = accountBalances.reduce((sum, acc) => sum + acc.debit, 0);
    const totalCredits = accountBalances.reduce((sum, acc) => sum + acc.credit, 0);


    if (allData.loading) {
        return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>الحساب</TableHead>
                    <TableHead className="text-center">مدين</TableHead>
                    <TableHead className="text-center">دائن</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {accountBalances.map(acc => (
                    <TableRow key={acc.account}>
                        <TableCell>{acc.account}</TableCell>
                        <TableCell className="text-center">{acc.debit > 0 ? acc.debit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</TableCell>
                        <TableCell className="text-center">{acc.credit > 0 ? acc.credit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
            <TableFooter>
                 <TableRow className="bg-muted/50">
                    <TableHead>الإجمالي</TableHead>
                    <TableHead className="text-center font-bold">ج.م {totalDebits.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableHead>
                    <TableHead className="text-center font-bold">ج.م {totalCredits.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableHead>
                </TableRow>
                 <TableRow>
                    <TableCell colSpan={3} className={`text-center font-bold ${Math.abs(totalDebits - totalCredits) < 0.01 ? 'text-green-600' : 'text-destructive'}`}>
                       {Math.abs(totalDebits - totalCredits) < 0.01 ? 'ميزان المراجعة متوازن' : 'ميزان المراجعة غير متوازن'}
                    </TableCell>
                </TableRow>
            </TableFooter>
        </Table>
    )
}

// --- Main Page Component ---

export default function FinancialStatementsPage() {
  return (
    <>
      <PageHeader title="القوائم المالية" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Tabs defaultValue="income-statement">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="income-statement">قائمة الدخل</TabsTrigger>
            <TabsTrigger value="balance-sheet">الميزانية العمومية</TabsTrigger>
            <TabsTrigger value="trial-balance">ميزان المراجعة</TabsTrigger>
          </TabsList>
          <TabsContent value="income-statement">
            <Card>
              <CardHeader>
                <CardTitle>قائمة الدخل</CardTitle>
                <CardDescription>
                  ملخص الإيرادات والمصروفات والأرباح لفترة معينة.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <IncomeStatement />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="balance-sheet">
            <Card>
              <CardHeader>
                <CardTitle>الميزانية العمومية</CardTitle>
                <CardDescription>
                  لقطة عن الوضع المالي للشركة في تاريخ محدد.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BalanceSheet />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="trial-balance">
            <Card>
              <CardHeader>
                <CardTitle>ميزان المراجعة</CardTitle>
                <CardDescription>
                  ورقة عمل لجميع أرصدة دفتر الأستاذ للتحقق من التوازن الحسابي.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrialBalance />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

    
