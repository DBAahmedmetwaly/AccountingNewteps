
"use client";

// استيراد المكونات والأدوات اللازمة
import React, { useState, useMemo, useEffect } from 'react';
import PageHeader from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useData } from '@/contexts/data-provider';
import { Combobox } from '@/components/ui/combobox';
import { getLinkForReceipt } from "@/lib/utils";
import { useAuth } from '@/contexts/auth-context';


// تعريف واجهات البيانات (Interfaces) لكل نوع من أنواع البيانات المستخدمة في الصفحة
// هذا يضمن تطابق البيانات مع قاعدة البيانات ويساعد في تجنب الأخطاء
interface SaleInvoice {
  id: string; date: string; customerName: string; total: number; warehouseId: string; discount: number; invoiceNumber?: string;
  items: { id: string; qty: number; cost?: number; price: number }[];
  status?: 'pending' | 'approved';
  paidAmount?: number;
  salesRepId?: string;
  subtotal?: number;
}
interface PurchaseInvoice { id: string; date: string; supplierName: string; total: number; warehouseId: string; discount: number; invoiceNumber?: string; paidAmount?: number; items: { id: string, name: string; qty: number, cost?:number }[]; subtotal?: number;}
interface Expense { id: string; date: string; description: string; amount: number; warehouseId?: string; expenseType: string; paidFromAccountId: string; receiptNumber?: string;}
interface ExceptionalIncome { id: string; date: string; description: string; amount: number; paidToAccountId: string; receiptNumber?: string; }
interface Warehouse { id: string; name: string; }
interface CashAccount { id: string; name: string; }
interface StockInRecord {
    id: string; date: string; warehouseId: string; receiptNumber?: string; purchaseInvoiceId?: string;
    items: { id: string, name: string; qty: number, cost?:number }[];
}
interface StockTransferRecord {
    id: string; date: string; fromSourceId: string; toSourceId: string; receiptNumber?: string;
    items: { id: string, name: string; qty: number, cost?:number }[];
}
interface StockOutRecord {
    id: string; date: string; sourceId: string; receiptNumber?: string; reason?: string; saleInvoiceId?: string; saleInvoiceNumber?: string;
    items: { id: string; name: string; qty: number, cost?:number }[];
}
interface Item {
    id: string;
    cost?: number;
    price: number;
}
interface TreasuryTransaction {
    id: string;
    date: string;
    type: 'deposit' | 'withdrawal';
    amount: number;
    accountId: string;
    description: string;
    receiptNumber?: string;
    linkedTransaction?: boolean;
    isPayroll?: boolean; // New flag for payroll
    isDeliveryReconciliation?: boolean; // New flag for delivery collection
    deliveryPersonId?: string;
}
interface EmployeeAdvance {
    id: string;
    date: string;
    employeeId: string;
    amount: number;
    paidFromAccountId: string;
    receiptNumber?: string;
}
interface EmployeeAdjustment {
    id: string;
    date: string;
    employeeId: string;
    type: 'reward' | 'penalty';
    amount: number;
    description: string;
    receiptNumber?: string;
}
interface Employee {
    id: string;
    name: string;
}
interface SalesReturn {
    id: string;
    date: string;
    customerId: string;
    warehouseId: string;
    total: number;
    receiptNumber?: string;
    items: { id: string; name: string; qty: number; price: number; cost?: number; }[];
    paidAmount?: number;
    paidFromAccountId?: string;
}
interface PurchaseReturn {
    id: string;
    date: string;
    supplierId: string;
    warehouseId: string;
    total: number;
    discount?: number;
    receiptNumber?: string;
    items: { id: string; name: string; qty: number; price: number; cost?: number }[];
    paidAmount?: number;
    paidToAccountId?: string;
}
interface Customer {
    id: string;
    name: string;
}
interface Supplier {
    id: string;
    name: string;
}
interface SupplierPayment {
    id: string;
    date: string;
    amount: number;
    supplierId: string;
    paidFromAccountId: string;
    receiptNumber?: string;
}
interface CustomerPayment {
    id: string;
    date: string;
    amount: number;
    customerId: string;
    paidToAccountId: string;
    receiptNumber?: string;
}
interface ProfitDistribution {
    id: string;
    date: string;
    amount: number;
    partnerId: string;
    paidFromAccountId: string;
    receiptNumber?: string;
}
interface Partner {
    id: string;
    name: string;
}
interface PayrollRecord {
    id: string;
    date: string;
    receiptNumber?: string;
    paidFromAccountId: string;
    month: string;
    payrollData: {
        employeeId: string;
        basicSalary: number;
        totalAdvances: number;
        totalRewards: number;
        totalPenalties: number;
        netSalary: number;
    }[];
}

interface StockAdjustmentRecord {
    id: string;
    date: string;
    warehouseId: string;
    receiptNumber?: string;
    items: { itemId: string; name: string; systemQty: number; actualQty: number; difference: number; cost?: number }[];
}

interface FixedAsset {
    id: string;
    name: string;
    purchaseDate: string;
    cost: number;
    usefulLifeYears: number;
    salvageValue: number;
    warehouseId: string;
    status: 'active' | 'disposed' | 'fully_depreciated';
}

interface DepreciationRecord {
    id: string;
    assetId: string;
    date: string;
    amount: number;
    note?: string;
}


interface JournalEntry {
  id: string;
  date: string;
  warehouseId?: string;
  number: string;
  description: string;
  debit: number;
  credit: number;
  account: string;
}

interface GroupedJournalEntry {
    number: string;
    date: string;
    description: string;
    debits: { account: string; amount: number }[];
    credits: { account: string; amount: number }[];
    total: number;
}


/**
 * المكون الرئيسي لصفحة قيود اليومية `JournalPage`.
 * هذا المكون هو قلب النظام المحاسبي، حيث يقوم بتجميع جميع الحركات المالية والمخزنية من كل أنحاء التطبيق
 * ويقوم بترجمتها إلى قيود محاسبية مزدوجة (مدين ودائن).
 * @returns {JSX.Element} واجهة مستخدم لعرض قيود اليومية مع فلاتر مختلفة.
 */
export default function JournalPage() {
    const { user } = useAuth();
    // حالة (state) لتخزين فلاتر البحث
    const [filters, setFilters] = useState({
        warehouseId: user?.warehouseIds?.length === 1 ? user.warehouseIds[0] : 'all',
        fromDate: new Date().toISOString().split('T')[0],
        toDate: new Date().toISOString().split('T')[0]
    });

    // استدعاء جميع البيانات اللازمة من السياق المركزي `useData`
    const {
        salesInvoices,
        purchaseInvoices,
        expenses,
        exceptionalIncomes,
        warehouses,
        stockTransferRecords: transfers,
        items: itemsData,
        cashAccounts,
        treasuryTransactions: treasuryTxs,
        employeeAdvances,
        employees,
        employeeAdjustments,
        salesReturns,
        purchaseReturns,
        customers,
        suppliers,
        supplierPayments,
        customerPayments,
        stockOutRecords: stockOuts,
        profitDistributions,
        partners,
        payrollRecords,
        stockInRecords,
        stockIssuesToReps,
        stockReturnsFromReps,
        stockAdjustmentRecords,
        deliveryStaff,
        fixedAssets,
        depreciationRecords,
        loading
    } = useData();

    
    // `useMemo` لإنشاء خريطة (Map) للأصناف لتحسين أداء البحث عن تفاصيل الصنف.
    const itemsMap = useMemo(() => {
        const map = new Map<string, Item>();
        itemsData.forEach((item:Item) => map.set(item.id, item));
        return map;
    }, [itemsData]);

    // `useMemo` هو الجزء الأساسي في هذا المكون. يقوم بحساب وتوليد جميع قيود اليومية.
    // يتم إعادة الحساب فقط عند تغير أي من البيانات المدخلة، مما يحسن الأداء بشكل كبير.
    const journalEntries = useMemo(() => {
        const entries: JournalEntry[] = [];
        // دوال مساعدة للحصول على الأسماء من المعرفات لتضمينها في وصف القيد
        const getWarehouse = (id?: string) => warehouses.find((w:Warehouse) => w.id === id);
        const getCashAccountName = (id?: string) => cashAccounts.find((c:CashAccount) => c.id === id)?.name || 'النقدية/البنك';
        const getEmployeeName = (id?: string) => employees.find((e:Employee) => e.id === id)?.name || 'موظف غير معروف';
        const getCustomerName = (id?: string) => customers.find((c:Customer) => c.id === id)?.name || 'عميل غير معروف';
        const getSupplierName = (id?: string) => suppliers.find((s:Supplier) => s.id === id)?.name || 'مورد غير معروف';
        const getPartnerName = (id?: string) => partners.find((p:Partner) => p.id === id)?.name || 'شريك غير معروف';
        
        // --- توليد القيود لكل نوع من أنواع الحركات ---
        // لكل حركة (فاتورة بيع، شراء، مصروف، ...)، يتم إنشاء قيد محاسبي مزدوج (مدين ودائن)
        // وتضاف إلى مصفوفة `entries`.
        
        // قيد فواتير البيع (المعتمدة فقط)
        salesInvoices.filter((s: SaleInvoice) => s.status === 'approved').forEach((sale:SaleInvoice) => {
            const totalBeforeDiscount = sale.subtotal || (sale.total + (sale.discount || 0));
            const number = sale.invoiceNumber || `ف-ب-${sale.id.slice(-4)}`;
            const amountDue = sale.total - (sale.paidAmount || 0);

            // الطرف المدين
            if (sale.paidAmount && sale.paidAmount > 0) {
                 entries.push({ id: `sale-cash-${sale.id}`, date: sale.date, warehouseId: sale.warehouseId, number: number, description: `فاتورة بيع للعميل ${sale.customerName}`, debit: sale.paidAmount, credit: 0, account: 'النقدية' });
            }
             if (amountDue > 0) {
                 entries.push({ id: `sale-ar-${sale.id}`, date: sale.date, warehouseId: sale.warehouseId, number: number, description: `فاتورة بيع للعميل ${sale.customerName}`, debit: amountDue, credit: 0, account: 'حسابات العملاء' });
            }
            if (sale.discount > 0) {
                 entries.push({ id: `sale-discount-${sale.id}`, date: sale.date, warehouseId: sale.warehouseId, number: number, description: `خصم مسموح به على فاتورة بيع`, debit: sale.discount, credit: 0, account: 'خصم مسموح به' });
            }
            
            // الطرف الدائن (الإيرادات)
            entries.push({ id: `sale-rev-${sale.id}`, date: sale.date, warehouseId: sale.warehouseId, number: number, description: `إيرادات من فاتورة بيع`, debit: 0, credit: totalBeforeDiscount, account: 'إيرادات المبيعات' });
            
            // قيد تكلفة البضاعة المباعة (COGS) والمخزون
            const cogs = sale.items.reduce((acc, i) => acc + (i.qty * (i.cost || 0)), 0);
            const inventoryAccount = sale.salesRepId ? 'مخزون بعهدة المندوب' : `مخزون - ${getWarehouse(sale.warehouseId)?.name}`;
            if (cogs > 0) {
                 entries.push({ id: `sale-cogs-${sale.id}`, date: sale.date, warehouseId: sale.warehouseId, number: number, description: `تكلفة بضاعة مباعة`, debit: cogs, credit: 0, account: 'تكلفة البضاعة المباعة' });
                 entries.push({ id: `sale-inv-credit-${sale.id}`, date: sale.date, warehouseId: sale.warehouseId, number: number, description: `صرف من المخزون`, debit: 0, credit: cogs, account: inventoryAccount });
            }
        });

        // قيد فواتير الشراء
        purchaseInvoices.forEach((p:PurchaseInvoice) => {
             const number = p.invoiceNumber || `ف-ش-${p.id.slice(-4)}`;
             const warehouse = getWarehouse(p.warehouseId);
             const amountDue = p.total - (p.paidAmount || 0);
             const purchaseCost = p.items.reduce((acc, item) => acc + (item.qty * (item.cost || 0)), 0);

             // الطرف المدين (زيادة المخزون)
             entries.push({ id: `pur-inv-debit-${p.id}`, date: p.date, warehouseId: p.warehouseId, number: number, description: `مشتريات لصالح مخزن ${warehouse?.name}`, debit: purchaseCost, credit: 0, account: `مخزون - ${warehouse?.name}` });

            // الطرف الدائن
            if (p.paidAmount && p.paidAmount > 0) {
                 entries.push({ id: `pur-cash-${p.id}`, date: p.date, warehouseId: p.warehouseId, number: number, description: `دفع للمورد ${p.supplierName}`, debit: 0, credit: p.paidAmount, account: 'النقدية' });
            }
            if (amountDue > 0) {
                 entries.push({ id: `pur-ap-${p.id}`, date: p.date, warehouseId: p.warehouseId, number: number, description: `مستحقات للمورد ${p.supplierName}`, debit: 0, credit: amountDue, account: 'حسابات الموردين' });
            }
            if (p.discount > 0) {
                 entries.push({ id: `pur-discount-${p.id}`, date: p.date, warehouseId: p.warehouseId, number: number, description: `خصم مكتسب على فاتورة شراء`, debit: 0, credit: p.discount, account: 'خصم مكتسب' });
            }
        });
        
        // مرتجعات المبيعات
        salesReturns.forEach((sr:SalesReturn) => {
            const number = sr.receiptNumber || `م-ب-${sr.id.slice(-4)}`;
            const warehouse = getWarehouse(sr.warehouseId);
            const costOfGoodsReturned = sr.items.reduce((acc, item) => {
                 const itemCost = item.cost || itemsMap.get(item.id)?.cost || item.price * 0.8;
                 return acc + (item.qty * itemCost);
            }, 0);
            
            // Debit: Sales Returns (Gross Value)
            entries.push({ id: `sal-ret-debit-${sr.id}`, date: sr.date, warehouseId: sr.warehouseId, number: number, description: `مرتجع مبيعات من ${getCustomerName(sr.customerId)}`, debit: sr.total, credit: 0, account: 'مرتجعات ومسموحات المبيعات' });
            
            // Credit Logic: How was it handled?
            const amountToCreditCustomer = sr.total - (sr.paidAmount || 0);
            
            if (amountToCreditCustomer > 0) {
                entries.push({ id: `sal-ret-credit-ar-${sr.id}`, date: sr.date, warehouseId: sr.warehouseId, number: number, description: `تخفيض مديونية العميل ${getCustomerName(sr.customerId)}`, debit: 0, credit: amountToCreditCustomer, account: 'حسابات العملاء' });
            }
            
            if (sr.paidAmount && sr.paidAmount > 0) {
                const cashAccountName = getCashAccountName(sr.paidFromAccountId);
                entries.push({ id: `sal-ret-credit-cash-${sr.id}`, date: sr.date, warehouseId: sr.warehouseId, number: number, description: `رد نقدي للعميل من ${cashAccountName}`, debit: 0, credit: sr.paidAmount, account: cashAccountName });
            }
            
            if (costOfGoodsReturned > 0) {
                entries.push({ id: `sal-ret-inv-debit-${sr.id}`, date: sr.date, warehouseId: sr.warehouseId, number: number, description: `إعادة بضاعة إلى مخزن ${warehouse?.name}`, debit: costOfGoodsReturned, credit: 0, account: `مخزون - ${warehouse?.name}` });
                entries.push({ id: `sal-ret-inv-credit-${sr.id}`, date: sr.date, warehouseId: sr.warehouseId, number: number, description: `عكس تكلفة البضاعة المباعة`, debit: 0, credit: costOfGoodsReturned, account: 'تكلفة البضاعة المباعة' });
            }
        });

        // مرتجعات الشراء
        purchaseReturns.forEach((pr:PurchaseReturn) => {
            const number = pr.receiptNumber || `م-ش-${pr.id.slice(-4)}`;
            const warehouse = getWarehouse(pr.warehouseId);
            const costOfGoodsReturned = pr.items.reduce((acc, item) => acc + (item.qty * (item.cost || item.price || 0)), 0);
            
            // Debit Logic: Supplier AP Reduction or Cash Receipt
            const amountToDebitSupplier = pr.total - (pr.paidAmount || 0);
            
            if (amountToDebitSupplier > 0) {
                entries.push({ id: `pur-ret-debit-ap-${pr.id}`, date: pr.date, warehouseId: pr.warehouseId, number, description: `تخفيض مستحقات المورد ${getSupplierName(pr.supplierId)}`, debit: amountToDebitSupplier, credit: 0, account: 'حسابات الموردين' });
            }
            
            if (pr.paidAmount && pr.paidAmount > 0) {
                const cashAccountName = getCashAccountName(pr.paidToAccountId);
                entries.push({ id: `pur-ret-debit-cash-${pr.id}`, date: pr.date, warehouseId: pr.warehouseId, number, description: `استلام نقدي من المورد في ${cashAccountName}`, debit: pr.paidAmount, credit: 0, account: cashAccountName });
            }
            
            if (pr.discount && pr.discount > 0) {
                 entries.push({ id: `pur-ret-debit-disc-${pr.id}`, date: pr.date, warehouseId: pr.warehouseId, number, description: `عكس خصم مكتسب على مرتجع`, debit: pr.discount, credit: 0, account: 'خصم مكتسب' });
            }
            
            // Credit: Inventory Reduction
            entries.push({ id: `pur-ret-credit-inv-${pr.id}`, date: pr.date, warehouseId: pr.warehouseId, number, description: `مرتجع مشتريات إلى ${getSupplierName(pr.supplierId)}`, debit: 0, credit: costOfGoodsReturned, account: `مخزون - ${warehouse?.name}` });
        });

        // صرف بضاعة لعهدة المندوب
        stockIssuesToReps?.forEach((itr: any) => {
            const number = itr.receiptNumber || `ص-م-${itr.id.slice(-4)}`;
            const issueCost = itr.items.reduce((acc: number, item: any) => acc + (item.qty * (item.cost || 0)), 0);
            if (issueCost > 0) {
                 entries.push({ id: `itr-debit-${itr.id}`, date: itr.date, number: number, description: `صرف بضاعة لعهدة المندوب ${getEmployeeName(itr.salesRepId)}`, debit: issueCost, credit: 0, account: 'مخزون بعهدة المندوب' });
                 entries.push({ id: `itr-credit-${itr.id}`, date: itr.date, number: number, description: `صرف من المخزن الرئيسي`, debit: 0, credit: issueCost, account: `مخزون - ${getWarehouse(itr.warehouseId)?.name}` });
            }
        });
        
        // استلام مرتجع من المندوب
        stockReturnsFromReps?.forEach((rfr: any) => {
            const number = rfr.receiptNumber || `م-ع-${rfr.id.slice(-4)}`;
            const returnCost = rfr.items.reduce((acc: number, item: any) => acc + (item.qty * (itemsMap.get(item.id)?.cost || 0)), 0);
             if (returnCost > 0) {
                 entries.push({ id: `rfr-debit-${rfr.id}`, date: rfr.date, number: number, description: `مرتجع من عهدة المندوب ${getEmployeeName(rfr.salesRepId)}`, debit: returnCost, credit: 0, account: `مخزون - ${getWarehouse(rfr.warehouseId)?.name}` });
                 entries.push({ id: `rfr-credit-${rfr.id}`, date: rfr.date, number: number, description: `تخفيض عهدة المندوب`, debit: 0, credit: returnCost, account: 'مخزون بعهدة المندوب' });
            }
        });

        // المصروفات
        expenses.forEach((e:Expense) => {
            const number = e.receiptNumber || `م-${e.id.slice(-4)}`;
            const warehouse = getWarehouse(e.warehouseId);
            const expenseAccount = e.expenseType;
            const cashAccountName = getCashAccountName(e.paidFromAccountId)
            entries.push({ id: `exp-debit-${e.id}`, date: e.date, warehouseId: e.warehouseId, number: number, description: e.description, debit: e.amount, credit: 0, account: expenseAccount });
            entries.push({ id: `exp-credit-${e.id}`, date: e.date, warehouseId: e.warehouseId, number: number, description: `دفع من ${cashAccountName}`, debit: 0, credit: e.amount, account: cashAccountName });
        });
        
        // الدخل الاستثنائي
        exceptionalIncomes.forEach((i:ExceptionalIncome) => {
            const number = i.receiptNumber || `إ-س-${i.id.slice(-4)}`;
            const cashAccountName = getCashAccountName(i.paidToAccountId);
            entries.push({ id: `ex-inc-debit-${i.id}`, date: i.date, number: number, description: i.description, debit: i.amount, credit: 0, account: cashAccountName });
            entries.push({ id: `ex-inc-credit-${i.id}`, date: i.date, number: number, description: i.description, debit: 0, credit: i.amount, account: 'دخل استثنائي' });
        });

        // التحويلات المخزنية
        transfers.forEach((t:StockTransferRecord) => {
            const number = t.receiptNumber || `إذ-ت-${t.id.slice(-4)}`;
            const transferCost = t.items.reduce((acc, transferItem) => {
                const itemMaster = itemsMap.get(transferItem.id);
                const itemCost = transferItem.cost || itemMaster?.cost || 0;
                return acc + (transferItem.qty * itemCost);
            }, 0);
            const fromWarehouseName = getWarehouse(t.fromSourceId)?.name || 'مخزن غير معروف';
            const toWarehouseName = getWarehouse(t.toSourceId)?.name || 'مخزن غير معروف';

            entries.push({ id: `trn-debit-${t.id}`, date: t.date, warehouseId: t.toSourceId, number: number, description: `تحويل من ${fromWarehouseName}`, debit: transferCost, credit: 0, account: `مخزون - ${toWarehouseName}` });
            entries.push({ id: `trn-credit-${t.id}`, date: t.date, warehouseId: t.fromSourceId, number: number, description: `تحويل إلى ${toWarehouseName}`, debit: 0, credit: transferCost, account: `مخزون - ${fromWarehouseName}` });
        });

        // تسويات الجرد (العجز والزيادة)
        stockAdjustmentRecords?.forEach((adj: StockAdjustmentRecord) => {
             const number = adj.receiptNumber || `ت-ج-${adj.id.slice(-4)}`;
             const warehouse = getWarehouse(adj.warehouseId);
             
             // حساب قيمة الزيادة وقيمة العجز
             let totalSurplusValue = 0;
             let totalDeficitValue = 0;

             adj.items.forEach(item => {
                 const itemMaster = itemsMap.get(item.itemId);
                 const cost = item.cost || itemMaster?.cost || 0;
                 const value = item.difference * cost;
                 if (value > 0) totalSurplusValue += value;
                 else totalDeficitValue += Math.abs(value);
             });

             if (totalSurplusValue > 0) {
                 entries.push({ id: `adj-surplus-debit-${adj.id}`, date: adj.date, warehouseId: adj.warehouseId, number, description: `تسوية جرد (زيادة)`, debit: totalSurplusValue, credit: 0, account: `مخزون - ${warehouse?.name}` });
                 entries.push({ id: `adj-surplus-credit-${adj.id}`, date: adj.date, warehouseId: adj.warehouseId, number, description: `أرباح تسوية المخزون`, debit: 0, credit: totalSurplusValue, account: 'أرباح تسوية المخزون' });
             }

             if (totalDeficitValue > 0) {
                 entries.push({ id: `adj-deficit-debit-${adj.id}`, date: adj.date, warehouseId: adj.warehouseId, number, description: `خسائر تسوية المخزون`, debit: totalDeficitValue, credit: 0, account: 'خسائر تسوية المخزون' });
                 entries.push({ id: `adj-deficit-credit-${adj.id}`, date: adj.date, warehouseId: adj.warehouseId, number, description: `تسوية جرد (عجز)`, debit: 0, credit: totalDeficitValue, account: `مخزون - ${warehouse?.name}` });
             }
        });

        // أذونات الإضافة (غير المرتبطة بفواتير شراء) - مثل بضاعة أول المدة
        stockInRecords?.filter((si:any) => !si.purchaseInvoiceId).forEach((si:any) => {
            const number = si.receiptNumber || `إذ-إ-${si.id.slice(-4)}`;
            const warehouse = getWarehouse(si.warehouseId);
            const totalValue = si.items.reduce((acc:number, item:any) => {
                 const itemMaster = itemsMap.get(item.id || item.itemId);
                 const cost = item.cost || itemMaster?.cost || 0;
                 return acc + (item.qty * cost);
            }, 0);

            if (totalValue > 0) {
                entries.push({ id: `si-debit-${si.id}`, date: si.date, warehouseId: si.warehouseId, number, description: `إضافة مخزنية (أرصدة افتتاحية/تسوية)`, debit: totalValue, credit: 0, account: `مخزون - ${warehouse?.name}` });
                entries.push({ id: `si-credit-${si.id}`, date: si.date, warehouseId: si.warehouseId, number, description: `رأس المال / حقوق الملكية`, debit: 0, credit: totalValue, account: 'رأس المال' });
            }
        });
        
        // أذونات الصرف اليدوية
        stockOuts.filter(so => so.reason !== 'sales_invoice').forEach((so:StockOutRecord) => {
            const number = so.receiptNumber || `إذ-خ-${so.id.slice(-4)}`;
            const warehouse = getWarehouse(so.sourceId);
            const costOfGoods = so.items.reduce((acc, stockOutItem) => {
                 const itemMaster = itemsMap.get(stockOutItem.id);
                 const itemCost = stockOutItem.cost || itemMaster?.cost || 0;
                 return acc + (stockOutItem.qty * itemCost);
            }, 0);

            if (costOfGoods > 0 && warehouse) {
                 const reasonLabel = so.reason === 'damaged' ? 'بضاعة تالفة' : `مصروف ${so.reason}`;
                 entries.push({ id: `so-debit-${so.id}`, date: so.date, warehouseId: so.sourceId, number: number, description: `${reasonLabel} من مخزن ${warehouse.name}`, debit: costOfGoods, credit: 0, account: `مصروف ${reasonLabel}` });
                 entries.push({ id: `so-credit-${so.id}`, date: so.date, warehouseId: so.sourceId, number: number, description: `تخفيض مخزون`, debit: 0, credit: costOfGoods, account: `مخزون - ${warehouse.name}` });
            }
        });
        
        // حركات الخزينة
        treasuryTxs.forEach((tx:TreasuryTransaction) => {
            const number = tx.receiptNumber || `ح-خ-${tx.id.slice(-4)}`;
            const accountName = getCashAccountName(tx.accountId);
            
            if (tx.isDeliveryReconciliation) {
                const deliveryPersonName = deliveryStaff.find((d: any) => d.id === tx.deliveryPersonId)?.name || 'طيار غير معروف';
                entries.push({ id: `trx-delivery-${tx.id}`, date: tx.date, number, description: `تحصيل دليفري من ${deliveryPersonName}`, debit: tx.amount, credit: 0, account: accountName });
                entries.push({ id: `trx-delivery-credit-${tx.id}`, date: tx.date, number, description: `تخفيض عهدة الطيارين`, debit: 0, credit: tx.amount, account: 'جاري الطيارين' });
            } else if (tx.linkedTransaction) {
                if (tx.type === 'deposit') {
                    entries.push({ id: `trx-linked-dep-debit-${tx.id}`, date: tx.date, warehouseId: undefined, number: number, description: tx.description, debit: tx.amount, credit: 0, account: accountName });
                } else {
                    entries.push({ id: `trx-linked-wit-credit-${tx.id}`, date: tx.date, warehouseId: undefined, number: number, description: tx.description, debit: 0, credit: tx.amount, account: accountName });
                }
            } else {
                if (tx.type === 'deposit') {
                    entries.push({ id: `trx-dep-debit-${tx.id}`, date: tx.date, warehouseId: undefined, number: number, description: `إيداع: ${tx.description}`, debit: tx.amount, credit: 0, account: accountName });
                    entries.push({ id: `trx-dep-credit-${tx.id}`, date: tx.date, warehouseId: undefined, number: number, description: `إيداع: ${tx.description}`, debit: 0, credit: tx.amount, account: 'رأس المال' });
                } else {
                     entries.push({ id: `trx-wit-debit-${tx.id}`, date: tx.date, warehouseId: undefined, number: number, description: `سحب: ${tx.description}`, debit: tx.amount, credit: 0, account: 'مسحوبات الشركاء' });
                     entries.push({ id: `trx-wit-credit-${tx.id}`, date: tx.date, warehouseId: undefined, number: number, description: `سحب: ${tx.description}`, debit: 0, credit: tx.amount, account: accountName });
                }
            }
        });
        
         // قيد الرواتب
        payrollRecords?.forEach((pr: PayrollRecord) => {
            const totalBasicSalary = pr.payrollData.reduce((sum, p) => sum + p.basicSalary, 0);
            const totalRewards = pr.payrollData.reduce((sum, p) => sum + p.totalRewards, 0);
            const totalAdvances = pr.payrollData.reduce((sum, p) => sum + p.totalAdvances, 0);
            const totalPenalties = pr.payrollData.reduce((sum, p) => sum + p.totalPenalties, 0);
            const totalNetSalary = pr.payrollData.reduce((sum, p) => sum + p.netSalary, 0);
            const cashAccountName = getCashAccountName(pr.paidFromAccountId);

            // الطرف المدين (المصروفات)
            entries.push({ id: `payroll-expense-${pr.id}`, date: pr.date, number: pr.receiptNumber || `رواتب-${pr.id.slice(-4)}`, description: `مصروف رواتب شهر ${pr.month}`, debit: totalBasicSalary + totalRewards, credit: 0, account: 'مصروف الرواتب' });

            // الطرف الدائن (التسويات والصرف)
            if (totalNetSalary > 0) {
                entries.push({ id: `payroll-cash-${pr.id}`, date: pr.date, number: pr.receiptNumber || `رواتب-${pr.id.slice(-4)}`, description: `صرف من ${cashAccountName}`, debit: 0, credit: totalNetSalary, account: cashAccountName });
            }
            if (totalAdvances > 0) {
                entries.push({ id: `payroll-advances-${pr.id}`, date: pr.date, number: pr.receiptNumber || `رواتب-${pr.id.slice(-4)}`, description: `تسوية سلف شهر ${pr.month}`, debit: 0, credit: totalAdvances, account: 'سلف الموظفين' });
            }
            if (totalPenalties > 0) {
                entries.push({ id: `payroll-penalties-${pr.id}`, date: pr.date, number: pr.receiptNumber || `رواتب-${pr.id.slice(-4)}`, description: `إيراد جزاءات شهر ${pr.month}`, debit: 0, credit: totalPenalties, account: 'إيرادات أخرى - جزاءات' });
            }
        });


        // سلف الموظفين
        employeeAdvances.forEach((adv:EmployeeAdvance) => {
            const number = adv.receiptNumber || `س-م-${adv.id.slice(-4)}`;
            const employeeName = getEmployeeName(adv.employeeId);
            const cashAccountName = getCashAccountName(adv.paidFromAccountId);
            entries.push({ id: `adv-debit-${adv.id}`, date: adv.date, number: number, description: `سلفة للموظف ${employeeName}`, debit: adv.amount, credit: 0, account: 'سلف الموظفين' });
            entries.push({ id: `adv-credit-${adv.id}`, date: adv.date, number: number, description: `دفع من ${cashAccountName}`, debit: 0, credit: adv.amount, account: cashAccountName });
        });
        
        // المكافآت والجزاءات
        employeeAdjustments.forEach((adj:EmployeeAdjustment) => {
             const number = adj.receiptNumber || `ت-م-${adj.id.slice(-4)}`;
             const employeeName = getEmployeeName(adj.employeeId);
             if (adj.type === 'reward') {
                 entries.push({ id: `adj-rew-debit-${adj.id}`, date: adj.date, number: number, description: `مكافأة لـ ${employeeName}: ${adj.description}`, debit: adj.amount, credit: 0, account: 'مصروف مكافآت' });
                 entries.push({ id: `adj-rew-credit-${adj.id}`, date: adj.date, number: number, description: `استحقاق مكافأة لـ ${employeeName}`, debit: 0, credit: adj.amount, account: 'رواتب مستحقة' });
             } else {
                 entries.push({ id: `adj-pen-debit-${adj.id}`, date: adj.date, number: number, description: `خصم من ${employeeName}: ${adj.description}`, debit: adj.amount, credit: 0, account: 'رواتب مستحقة' });
                 entries.push({ id: `adj-pen-credit-${adj.id}`, date: adj.date, number: number, description: `إيراد جزاءات من ${employeeName}`, debit: 0, credit: adj.amount, account: 'إيرادات أخرى - جزاءات' });
             }
        });

        // مدفوعات الموردين
        supplierPayments.forEach((p:SupplierPayment) => {
            const number = p.receiptNumber || `س-م-${p.id.slice(-4)}`;
            entries.push({ id: `supp-pay-debit-${p.id}`, date: p.date, number: number, description: `سداد للمورد ${getSupplierName(p.supplierId)}`, debit: p.amount, credit: 0, account: 'حسابات الموردين' });
            entries.push({ id: `supp-pay-credit-${p.id}`, date: p.date, number: number, description: `دفع من ${getCashAccountName(p.paidFromAccountId)}`, debit: 0, credit: p.amount, account: getCashAccountName(p.paidFromAccountId) });
        });

        // مقبوضات العملاء
        customerPayments.forEach((p:CustomerPayment) => {
            const number = p.receiptNumber || `س-ع-${p.id.slice(-4)}`;
            entries.push({ id: `cust-pay-debit-${p.id}`, date: p.date, number: number, description: `تحصيل من العميل ${getCustomerName(p.customerId)}`, debit: p.amount, credit: 0, account: getCashAccountName(p.paidToAccountId) });
            entries.push({ id: `cust-pay-credit-${p.id}`, date: p.date, number: number, description: `تخفيض مديونية العميل`, debit: 0, credit: p.amount, account: 'حسابات العملاء' });
        });

        // توزيعات الأرباح
        profitDistributions.forEach((d:ProfitDistribution) => {
            const number = d.receiptNumber || `ت-أ-${d.id.slice(-4)}`;
            const partnerName = getPartnerName(d.partnerId);
            const cashAccountName = getCashAccountName(d.paidFromAccountId);
            entries.push({ id: `dist-debit-${d.id}`, date: d.date, number: number, description: `توزيع أرباح للشريك ${partnerName}`, debit: d.amount, credit: 0, account: `توزيعات أرباح - ${partnerName}` });
            entries.push({ id: `dist-credit-${d.id}`, date: d.date, number: number, description: `دفع من ${cashAccountName}`, debit: 0, credit: d.amount, account: cashAccountName });
        });

        // إهلاك الأصول الثابتة
        depreciationRecords?.forEach((rec: DepreciationRecord) => {
            const asset = fixedAssets?.find((a: FixedAsset) => a.id === rec.assetId);
            const assetName = asset?.name || 'أصل غير معروف';
            const number = `إهلاك-${rec.id.slice(-4)}`;

            entries.push({ 
                id: `dep-debit-${rec.id}`, 
                date: rec.date, 
                number, 
                description: rec.note || `إهلاك ${assetName}`, 
                debit: rec.amount, 
                credit: 0, 
                account: 'مصروف الإهلاك' 
            });

            entries.push({ 
                id: `dep-credit-${rec.id}`, 
                date: rec.date, 
                number, 
                description: `تراكم إهلاك ${assetName}`, 
                debit: 0, 
                credit: rec.amount, 
                account: 'مجمع الإهلاك' 
            });
        });


        // ترتيب القيود حسب التاريخ من الأحدث للأقدم
        return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [salesInvoices, purchaseInvoices, expenses, exceptionalIncomes, transfers, warehouses, itemsMap, cashAccounts, treasuryTxs, employeeAdvances, employees, employeeAdjustments, salesReturns, purchaseReturns, customers, suppliers, supplierPayments, customerPayments, stockOuts, profitDistributions, partners, payrollRecords, stockInRecords, stockIssuesToReps, stockReturnsFromReps, deliveryStaff, fixedAssets, depreciationRecords]);

    // `useMemo` لترشيح القيود بناءً على الفلاتر المحددة من المستخدم
    const filteredEntries = useMemo(() => journalEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        const from = filters.fromDate ? new Date(filters.fromDate) : null;
        const to = filters.toDate ? new Date(filters.toDate) : null;

        if (from) from.setHours(0,0,0,0);
        if (to) to.setHours(23,59,59,999);

        if (from && entryDate < from) return false;
        if (to && entryDate > to) return false;
        if (filters.warehouseId && filters.warehouseId !== 'all' && entry.warehouseId !== filters.warehouseId && entry.warehouseId !== undefined) return false;

        return true;
    }), [journalEntries, filters]);

    // `useMemo` لتجميع قيود اليومية حسب رقم القيد لعرضها بالشكل التقليدي (من ح/ ... إلى ح/ ...)
    const groupedEntries = useMemo((): GroupedJournalEntry[] => {
        const groups: { [key: string]: GroupedJournalEntry } = {};

        filteredEntries.forEach(entry => {
            if (!groups[entry.number]) {
                groups[entry.number] = {
                    number: entry.number,
                    date: entry.date,
                    description: entry.description,
                    debits: [],
                    credits: [],
                    total: 0
                };
            }
            if (entry.debit > 0) {
                groups[entry.number].debits.push({ account: entry.account, amount: entry.debit });
                groups[entry.number].total += entry.debit;
            }
            if (entry.credit > 0) {
                groups[entry.number].credits.push({ account: entry.account, amount: entry.credit });
            }
        });
        
        return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [filteredEntries]);
    
    /**
     * دالة `handleFilterChange`
     * @param {keyof typeof filters} key - اسم حقل الفلتر المراد تغييره.
     * @param {string} value - القيمة الجديدة للفلتر.
     * تقوم بتحديث حالة الفلاتر بناءً على إدخال المستخدم.
     */
     const handleFilterChange = (key: keyof typeof filters, value: string) => {
        setFilters(prev => ({...prev, [key]: value}));
    }
    
    // `useMemo` لتجهيز خيارات المخازن (الفروع) لعرضها في قائمة الاختيار
    const warehouseOptions = React.useMemo(() => {
        const options = [
            { value: 'all', label: 'كل المخازن' },
            ...warehouses.map((w:Warehouse) => ({ value: w.id, label: w.name }))
        ];
        if (user?.warehouseIds?.includes('all')) return options;
        return options.filter(w => w.value !== 'all' && user?.warehouseIds?.includes(w.value));
    }, [warehouses, user]);


  return (
    <TooltipProvider>
    <>
      <PageHeader title="قيود اليومية" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        {/* بطاقة الفلاتر */}
        <Card>
            <CardHeader>
                <CardTitle>فلاتر البحث</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                     <div className="space-y-2">
                        <Label>المخزن</Label>
                        <Combobox
                            options={warehouseOptions}
                            value={filters.warehouseId}
                            onValueChange={(v) => handleFilterChange("warehouseId", v)}
                            placeholder="اختر المخزن"
                            emptyMessage="لم يتم العثور على مخزن."
                            disabled={user?.warehouseIds?.length === 1 && !user.warehouseIds.includes('all')}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label>من تاريخ</Label>
                        <Input type="date" value={filters.fromDate} onChange={(e) => handleFilterChange("fromDate", e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label>إلى تاريخ</Label>
                        <Input type="date" value={filters.toDate} onChange={(e) => handleFilterChange("toDate", e.target.value)} />
                    </div>
                </div>
            </CardContent>
        </Card>
        
        {/* التبويبات لعرض القيود بطريقتين */}
        <Tabs defaultValue="detailed-view">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="detailed-view">عرض تفصيلي</TabsTrigger>
                <TabsTrigger value="journal-view">عرض القيد المزدوج</TabsTrigger>
            </TabsList>
            
            {/* تبويب العرض التفصيلي (كل حساب في سطر) */}
            <TabsContent value="detailed-view">
                <Card>
                <CardHeader>
                    <CardTitle>سجل قيود اليومية</CardTitle>
                    <CardDescription>
                    عرض لجميع قيود اليومية التي تم إنشاؤها تلقائيًا.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* عرض مؤشر التحميل */}
                    {loading ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="w-full overflow-auto border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[120px]">التاريخ</TableHead>
                                        <TableHead className="w-[120px] hidden sm:table-cell">رقم القيد</TableHead>
                                        <TableHead>البيان</TableHead>
                                        <TableHead className="hidden sm:table-cell">الحساب</TableHead>
                                        <TableHead className="text-center w-[120px]">مدين</TableHead>
                                        <TableHead className="text-center w-[120px]">دائن</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredEntries.map((entry) => (
                                        <TableRow key={entry.id}>
                                            <TableCell>{new Date(entry.date).toLocaleDateString('ar-EG')}</TableCell>
                                            <TableCell className="font-mono hidden sm:table-cell">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span>{entry.number}</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{getLinkForReceipt(entry.number, entry.id, (entry as any).type)}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell>{entry.description}</TableCell>
                                            <TableCell className="hidden sm:table-cell">{entry.account}</TableCell>
                                            <TableCell className="text-center font-mono">{entry.debit > 0 ? entry.debit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</TableCell>
                                            <TableCell className="text-center font-mono">{entry.credit > 0 ? entry.credit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredEntries.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                                                لا توجد قيود يومية تطابق الفلاتر المحددة.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
                </Card>
            </TabsContent>
            
            {/* تبويب عرض القيد المزدوج (شكل دفتر اليومية التقليدي) */}
            <TabsContent value="journal-view">
                 <Card>
                <CardHeader className="text-center">
                    <CardTitle>عرض القيد المزدوج</CardTitle>
                    <CardDescription>
                    عرض تقليدي لقيود اليومية (من ح/ ... إلى ح/ ...).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                         <div className="space-y-4 max-w-4xl mx-auto">
                            {groupedEntries.map(entry => (
                                <Card key={entry.number} className="w-full">
                                    <CardHeader className='pb-4'>
                                        <div className="flex justify-between items-baseline">
                                            <CardTitle className="text-base">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className='font-mono'>قيد رقم: #{entry.number}</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{getLinkForReceipt(entry.number)}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </CardTitle>
                                            <span className='text-sm text-muted-foreground'>
                                                التاريخ: {new Date(entry.date).toLocaleDateString('ar-EG')}
                                            </span>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="w-full overflow-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>الحساب</TableHead>
                                                        <TableHead className="w-[150px] text-center">مدين</TableHead>
                                                        <TableHead className="w-[150px] text-center">دائن</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {entry.debits.map((d, i) => (
                                                        <TableRow key={`d-${i}`}>
                                                            <TableCell className="font-medium pr-6">{d.account}</TableCell>
                                                            <TableCell className="text-center font-mono">{d.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                                            <TableCell className="text-center">-</TableCell>
                                                        </TableRow>
                                                    ))}
                                                        {entry.credits.map((c, i) => (
                                                        <TableRow key={`c-${i}`}>
                                                            <TableCell className="text-muted-foreground pr-10">{c.account}</TableCell>
                                                            <TableCell className="text-center">-</TableCell>
                                                            <TableCell className="text-center font-mono text-muted-foreground">{c.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                    <CardFooter className='pt-4'>
                                        <p className="text-xs text-muted-foreground">البيان: {entry.description}</p>
                                    </CardFooter>
                                </Card>
                            ))}
                             {groupedEntries.length === 0 && (
                                <div className="text-center text-muted-foreground py-10">
                                    لا توجد قيود يومية تطابق الفلاتر المحددة.
                                </div>
                            )}
                         </div>
                    )}
                </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </main>
    </>
    </TooltipProvider>
  );
}
