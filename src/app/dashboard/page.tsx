"use client";

import React, { useMemo, useState, useEffect } from "react";
import PageHeader from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useData } from "@/contexts/data-provider";
import { Loader2, DollarSign, Users, Building, Package, TrendingUp, TrendingDown, AlertTriangle, Clock, ShoppingCart, Calculator, Info, Banknote, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, CartesianGrid, XAxis, YAxis, Legend, Bar, ResponsiveContainer, LabelList } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/auth-context";
import { calculateStockForItemInWarehouse } from "@/lib/inventory-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Data Interfaces
interface Item { id: string; name: string; cost?: number; reorderPoint?: number; }
interface Sale { id: string; date: string; warehouseId?: string; total: number; items: { id: string; qty: number; cost?: number; }[]; discount: number; subtotal: number; paidAmount?: number; }
interface Purchase { id: string; date: string; warehouseId: string; total: number; paidAmount?: number; }
interface Customer { openingBalance: number; }
interface Supplier { openingBalance: number; }
interface CustomerPayment { amount: number; paidToAccountId: string; invoiceId?: string; }
interface SupplierPayment { amount: number; paidFromAccountId: string; invoiceId?: string; }
interface SalesReturn { total: number; paidAmount?: number; paidFromAccountId?: string; warehouseId: string; }
interface PurchaseReturn { total: number; paidAmount?: number; paidToAccountId?: string; warehouseId: string; }
interface CashAccount { id: string; openingBalance: number; warehouseId?: string; }
interface Expense { amount: number; paidFromAccountId: string; date: string; warehouseId?: string; }
interface ExceptionalIncome { amount: number; paidToAccountId: string; date: string; }
interface TreasuryTransaction { type: 'deposit' | 'withdrawal'; amount: number; accountId: string; linkedTransaction?: boolean; }
interface EmployeeAdvance { amount: number; paidFromAccountId: string; }
interface ProfitDistribution { amount: number; paidFromAccountId: string; }
interface PayrollRecord { payrollData: { netSalary: number }[]; paidFromAccountId: string; }

const chartConfig = {
  sales: { label: "المبيعات", color: "hsl(var(--chart-1))" },
  profit: { label: "الأرباح", color: "hsl(var(--chart-2))" },
  visits: { label: "عدد الفواتير", color: "hsl(var(--chart-4))" },
};

export default function DashboardPage() {
    const { 
        items, salesInvoices, posSales, purchaseInvoices, customers, suppliers,
        customerPayments, supplierPayments, salesReturns, purchaseReturns,
        cashAccounts, expenses, exceptionalIncomes, treasuryTransactions,
        employeeAdvances, profitDistributions, inventory, warehouses, loading, stockOutRecords,
        inventoryClosings, stockInRecords, stockTransferRecords, stockAdjustmentRecords,
        posReturns, stockIssuesToReps, stockReturnsFromReps, payrollRecords
    } = useData();
    const { user } = useAuth();
    const isMobile = useIsMobile();
    const [filters, setFilters] = useState({
        warehouseId: "all",
        fromDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
        toDate: new Date().toISOString().split('T')[0]
    });
    const [recomputedInventoryValue, setRecomputedInventoryValue] = useState<number | null>(null);
    const [invLoading, setInvLoading] = useState(false);
    const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
    
    useEffect(() => {
        if (user?.warehouseIds?.length === 1 && user.warehouseIds[0] !== 'all') {
            setFilters(prev => ({...prev, warehouseId: user.warehouseIds[0]}));
        }
    }, [user]);

    const handleFilterChange = (key: keyof typeof filters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };
    
    const warehouseOptions = useMemo(() => {
        const options: { value: string; label: string }[] = [];
        if (user?.warehouseIds?.includes('all')) {
            options.push({ value: 'all', label: 'كل الفروع' });
            warehouses.forEach((w: any) => options.push({ value: w.id, label: w.name }));
        } else {
            if (user?.warehouseIds && user.warehouseIds.length > 1) {
                options.push({ value: 'all', label: 'كل الفروع المصرح بها' });
            }
            warehouses
                .filter((w: any) => user?.warehouseIds?.includes(w.id))
                .forEach((w: any) => options.push({ value: w.id, label: w.name }));
        }
        return options;
    }, [warehouses, user]);


    const filteredData = useMemo(() => {
        const filterByDate = (date: string) => {
            if (!filters.fromDate && !filters.toDate) return true;
            const itemDate = new Date(date);
            const from = filters.fromDate ? new Date(filters.fromDate) : null;
            const to = filters.toDate ? new Date(filters.toDate) : null;
            if(from) from.setHours(0,0,0,0);
            if(to) to.setHours(23,59,59,999);
            if (from && itemDate < from) return false;
            if (to && itemDate > to) return false;
            return true;
        };

        const filterByWarehouse = (warehouseId?: string) => {
            if (filters.warehouseId === 'all') {
                if (user?.warehouseIds?.includes('all')) return true;
                return user?.warehouseIds?.includes(warehouseId || '');
            }
            return warehouseId === filters.warehouseId;
        };
        
        const sales = [...salesInvoices.filter((s:any) => s.status === 'approved'), ...posSales]
            .filter((s: any) => filterByDate(s.date) && filterByWarehouse(s.warehouseId));
        const purchases = purchaseInvoices.filter((p: any) => filterByDate(p.date) && filterByWarehouse(p.warehouseId));
        const salesReturnsFiltered = salesReturns.filter((r: any) => filterByDate(r.date) && filterByWarehouse(r.warehouseId));
        const purchaseReturnsFiltered = purchaseReturns.filter((r: any) => filterByDate(r.date) && filterByWarehouse(r.warehouseId));
        const filteredExpenses = expenses.filter((e: any) => filterByDate(e.date) && (filters.warehouseId === 'all' || e.warehouseId === filters.warehouseId || !e.warehouseId));
        const filteredIncome = exceptionalIncomes.filter((i: any) => filterByDate(i.date));
            
        return { sales, purchases, salesReturnsFiltered, purchaseReturnsFiltered, filteredExpenses, filteredIncome };

    }, [filters, salesInvoices, posSales, purchaseInvoices, salesReturns, purchaseReturns, expenses, exceptionalIncomes, user]);

    const kpiData = useMemo(() => {
        const userWarehouseIds = user?.warehouseIds || [];
        const isSuperAdmin = userWarehouseIds.includes('all');
        const activeWarehouseId = filters.warehouseId;
        
        const isWarehouseAllowed = (wId?: string) => {
            if (activeWarehouseId !== 'all') return wId === activeWarehouseId;
            if (isSuperAdmin) return true;
            return userWarehouseIds.includes(wId || '');
        };

        const filteredCashAccounts = cashAccounts.filter((acc: any) => isWarehouseAllowed(acc.warehouseId));
        const filteredCashAccountIds = new Set(filteredCashAccounts.map((acc: any) => acc.id));

        let totalCash = filteredCashAccounts.reduce((sum: number, acc: CashAccount) => sum + (acc.openingBalance || 0), 0);
        
        // Deposits
        customerPayments.forEach((p: CustomerPayment) => {
            if (filteredCashAccountIds.has(p.paidToAccountId)) totalCash += p.amount;
        });
        
        exceptionalIncomes.forEach((i: ExceptionalIncome) => {
            if (filteredCashAccountIds.has(i.paidToAccountId)) totalCash += i.amount;
        });
        
        treasuryTransactions.filter((tx: TreasuryTransaction) => tx.type === 'deposit' && !tx.linkedTransaction).forEach((tx: TreasuryTransaction) => {
            if (filteredCashAccountIds.has(tx.accountId)) totalCash += tx.amount;
        });

        purchaseReturns.forEach((r: any) => {
            if (filteredCashAccountIds.has(r.paidToAccountId)) totalCash += (r.paidAmount || 0);
        });
        
        const approvedSales = salesInvoices.filter((s:any) => s.status === 'approved' && isWarehouseAllowed(s.warehouseId));
        approvedSales.forEach((s: any) => {
            if (filteredCashAccountIds.has(s.paidToAccountId)) {
                const linkedPaymentsTotal = customerPayments.filter((p: CustomerPayment) => p.invoiceId === s.id).reduce((sum, p) => sum + p.amount, 0);
                const initialCash = (s.paidAmount || 0) - linkedPaymentsTotal;
                if (initialCash > 0) totalCash += initialCash;
            }
        });
        
        posSales.filter((s: any) => isWarehouseAllowed(s.warehouseId)).forEach((s: any) => {
            const targetId = s.paidToAccountId || (filteredCashAccounts.find(acc => acc.warehouseId === s.warehouseId)?.id);
            if (targetId && filteredCashAccountIds.has(targetId)) {
                const linkedPaymentsTotal = customerPayments.filter((p: CustomerPayment) => p.invoiceId === s.id).reduce((sum, p) => sum + p.amount, 0);
                const initialCash = (s.paidAmount || 0) - linkedPaymentsTotal;
                if (initialCash > 0) totalCash += initialCash;
            }
        });
        
        // Withdrawals
        expenses.forEach((e: Expense) => {
            if (filteredCashAccountIds.has(e.paidFromAccountId)) totalCash -= e.amount;
        });
        
        supplierPayments.forEach((p: SupplierPayment) => {
            if (filteredCashAccountIds.has(p.paidFromAccountId)) totalCash -= p.amount;
        });
        
        purchaseInvoices.filter((p: any) => isWarehouseAllowed(p.warehouseId)).forEach((p: any) => {
            if (filteredCashAccountIds.has(p.paidFromAccountId)) {
                const linkedPaymentsTotal = supplierPayments.filter((sp: SupplierPayment) => sp.invoiceId === p.id).reduce((sum, sp) => sum + sp.amount, 0);
                const initialPaid = (p.paidAmount || 0) - linkedPaymentsTotal;
                if (initialPaid > 0) totalCash -= initialPaid;
            }
        });
        
        employeeAdvances.forEach((ea: EmployeeAdvance) => {
            if (filteredCashAccountIds.has(ea.paidFromAccountId)) totalCash -= ea.amount;
        });
        
        profitDistributions.forEach((pd: ProfitDistribution) => {
            if (filteredCashAccountIds.has(pd.paidFromAccountId)) totalCash -= pd.amount;
        });
        
        treasuryTransactions.filter((tx: TreasuryTransaction) => tx.type === 'withdrawal' && !tx.linkedTransaction).forEach((tx: TreasuryTransaction) => {
            if (filteredCashAccountIds.has(tx.accountId)) totalCash -= tx.amount;
        });

        payrollRecords?.forEach((pr: any) => {
            if (filteredCashAccountIds.has(pr.paidFromAccountId)) {
                totalCash -= pr.payrollData.reduce((sum: number, p: any) => sum + p.netSalary, 0);
            }
        });

        salesReturns.forEach((r: any) => {
            if (filteredCashAccountIds.has(r.paidFromAccountId)) totalCash -= (r.paidAmount || 0);
        });

        posReturns.filter((r:any) => isWarehouseAllowed(r.warehouseId)).forEach((r: any) => {
            if ((r.paidAmount || 0) > 0) {
                const targetId = filteredCashAccounts.find(acc => acc.warehouseId === r.warehouseId)?.id;
                if (targetId && filteredCashAccountIds.has(targetId)) {
                    totalCash -= r.paidAmount;
                }
            }
        });

        const warehousesToConsider = warehouses.filter((w: any) => isWarehouseAllowed(w.id));

        const inventoryValue = items.reduce((sum: number, item: any) => {
            let itemTotalBalance = 0;
            warehousesToConsider.forEach((warehouse: any) => {
                const warehouseInventory = inventory.filter((inv: any) => inv.warehouseId === warehouse.id);
                warehouseInventory.forEach((sectionRecord: any) => {
                    if (sectionRecord.items && sectionRecord.items[item.id]) {
                        itemTotalBalance += (sectionRecord.items[item.id].balance || 0);
                    }
                });
            });
            return sum + (itemTotalBalance * (item.cost || 0));
        }, 0);

        let ar = 0;
        customers.forEach((c: any) => {
            let balance = Number(c.openingBalance) || 0;
            salesInvoices.filter((s:any) => s.status === 'approved' && s.customerId === c.id && isWarehouseAllowed(s.warehouseId))
                .forEach((s: any) => balance += (Number(s.total) - Number(s.paidAmount || 0)));
            posSales.filter((s:any) => s.customerId === c.id && isWarehouseAllowed(s.warehouseId))
                .forEach((s:any) => balance += (Number(s.total) - Number(s.paidAmount || 0)));
            customerPayments.filter((p: any) => p.customerId === c.id && !p.invoiceId)
                .forEach((p: any) => balance -= Number(p.amount));
            salesReturns.filter((r: any) => r.customerId === c.id && isWarehouseAllowed(r.warehouseId))
                .forEach((r: any) => balance -= (Number(r.total) - Number(r.paidAmount || 0)));
            posReturns.filter((r: any) => r.customerId === c.id && isWarehouseAllowed(r.warehouseId))
                .forEach((r: any) => balance -= (Number(r.total) - Number(r.paidAmount || 0)));
            ar += balance;
        });

        let ap = 0;
        suppliers.forEach((s: any) => {
            let balance = Number(s.openingBalance) || 0;
            purchaseInvoices.filter((p: any) => p.supplierId === s.id && isWarehouseAllowed(p.warehouseId))
                .forEach((p: any) => balance += (Number(p.total) - Number(p.paidAmount || 0)));
            supplierPayments.filter((p: any) => p.supplierId === s.id && !p.invoiceId)
                .forEach((p: any) => balance -= Number(p.amount));
            purchaseReturns.filter((r: any) => r.supplierId === s.id && isWarehouseAllowed(r.warehouseId))
                .forEach((r: any) => balance -= (Number(r.total) - Number(r.paidAmount || 0)));
            ap += balance;
        });

        const totalExpenses = filteredData.filteredExpenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
        const totalPurchases = filteredData.purchases.reduce((sum: number, p: any) => sum + Number(p.total || 0), 0);
        const totalSalesReturns = filteredData.salesReturnsFiltered.reduce((sum: number, r: any) => sum + Number(r.total || 0), 0);
        const totalPurchaseReturns = filteredData.purchaseReturnsFiltered.reduce((sum: number, r: any) => sum + Number(r.total || 0), 0);
        const totalReturns = totalSalesReturns + totalPurchaseReturns;
        const totalExtraIncome = filteredData.filteredIncome.reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0);
        
        let totalCOGS = 0;
        let totalRevenue = 0;
        let totalCashFromSales = 0;
        filteredData.sales.forEach((sale: any) => {
            const saleCost = sale.items.reduce((acc: number, item: any) => {
                const master = items.find((i:any) => i.id === item.id);
                const unitCost = Number(item.cost ?? master?.cost ?? 0);
                return acc + (Number(item.qty || 0) * unitCost);
            }, 0);
            totalCOGS += saleCost;
            totalRevenue += Number(sale.total);
            totalCashFromSales += Number(sale.paidAmount || 0);
        });

        const grossProfit = totalRevenue - totalCOGS;
        const netProfitValue = grossProfit - totalSalesReturns - totalExpenses + totalExtraIncome;

        return { 
            totalCash, 
            accountsReceivable: ar, 
            accountsPayable: ap, 
            inventoryValue,
            totalRevenue,
            totalCashFromSales,
            totalExpenses,
            totalReturns,
            totalSalesReturns,
            totalPurchases,
            totalCOGS,
            totalExtraIncome,
            grossProfit,
            netProfit: netProfitValue,
            customersCount: customers.length,
            suppliersCount: suppliers.length,
            productsCount: items.length,
            balanceExplanation: `إجمالي السيولة النقدية في ${filteredCashAccounts.length} حساب/خزينة تابعة للفروع المختارة.`
        };
    }, [
        cashAccounts, customerPayments, exceptionalIncomes, treasuryTransactions, expenses, 
        supplierPayments, purchaseInvoices, employeeAdvances, profitDistributions, customers, 
        salesInvoices, posSales, salesReturns, suppliers, purchaseReturns, inventory, items, warehouses, filters.warehouseId, user, filteredData, posReturns, payrollRecords
    ]);

    const handleRecomputeInventoryValue = () => {
        setInvLoading(true);
        setTimeout(() => {
            const userWarehouseIds = user?.warehouseIds || [];
            const isSuperAdmin = userWarehouseIds.includes('all');
            const activeWarehouseId = filters.warehouseId;
            const isWarehouseAllowed = (wId?: string) => {
                if (activeWarehouseId !== 'all') return wId === activeWarehouseId;
                if (isSuperAdmin) return true;
                return userWarehouseIds.includes(wId || '');
            };
            const warehousesToConsider = warehouses.filter((w: any) => isWarehouseAllowed(w.id));
            let total = 0;
            items.forEach((item: any) => {
                const itemCost = item.cost || 0;
                let totalQty = 0;
                warehousesToConsider.forEach((w: any) => {
                    const qty = calculateStockForItemInWarehouse(item.id, w.id, {
                        inventoryClosings,
                        stockInRecords,
                        stockOutRecords,
                        stockTransferRecords,
                        stockAdjustmentRecords,
                        salesInvoices,
                        salesReturns,
                        posSales,
                        posReturns,
                        purchaseReturns,
                        stockIssuesToReps,
                        stockReturnsFromReps,
                    });
                    totalQty += qty || 0;
                });
                total += totalQty * itemCost;
            });
            setRecomputedInventoryValue(total);
            setInvLoading(false);
        }, 50);
    };

    const salesAndProfitChartData = useMemo(() => {
        const dailyData: { [date: string]: { sales: number; profit: number } } = {};
        filteredData.sales.forEach((sale: any) => {
            const date = new Date(sale.date).toISOString().split('T')[0];
            if (!dailyData[date]) dailyData[date] = { sales: 0, profit: 0 };
            
            const saleCost = sale.items.reduce((acc: number, item: any) => {
                const master = items.find((i:any) => i.id === item.id);
                return acc + (item.qty * (item.cost || master?.cost || 0));
            }, 0);
            
            dailyData[date].sales += sale.total;
            dailyData[date].profit += (sale.total - saleCost);
        });
        
        return Object.entries(dailyData).map(([date, data]) => ({ date: new Date(date).toLocaleDateString('ar-EG', {month: 'short', day: 'numeric'}), ...data }))
          .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [filteredData.sales, items]);
    
    const topBranchesChartData = useMemo(() => {
        const branchSales: {[id: string]: number} = {};
        filteredData.sales.forEach((s: any) => {
            if(s.warehouseId) {
                branchSales[s.warehouseId] = (branchSales[s.warehouseId] || 0) + s.total;
            }
        });
        return Object.entries(branchSales)
            .map(([id, total]) => ({ name: warehouses.find((w:any) => w.id === id)?.name || 'غير معروف', total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    }, [filteredData.sales, warehouses]);

    const peakHoursChartData = useMemo(() => {
        const hours = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            label: `${(i % 12 === 0 ? 12 : i % 12)} ${i < 12 ? 'ص' : 'م'}`,
            visits: 0,
        }));

        filteredData.sales.forEach(sale => {
            const saleHour = new Date(sale.date).getHours();
            if (hours[saleHour]) {
                hours[saleHour].visits += 1;
            }
        });
        return hours;
    }, [filteredData.sales]);


    const topSellingItems = useMemo(() => {
        const itemSales = new Map<string, {name: string, qty: number, value: number}>();
        filteredData.sales.forEach(sale => {
            sale.items.forEach((item: any) => {
                const itemMaster = items.find((i:any) => i.id === item.id);
                if (!itemMaster) return;
                const current = itemSales.get(item.id) || { name: itemMaster.name, qty: 0, value: 0 };
                current.qty += item.qty;
                current.value += item.qty * (item.price || itemMaster.price || 0);
                itemSales.set(item.id, current);
            });
        });
        return Array.from(itemSales.values()).sort((a, b) => b.value - a.value).slice(0, 20);
    }, [filteredData.sales, items]);

    const reorderItems = useMemo(() => {
        const userWarehouseIds = user?.warehouseIds || [];
        const isSuperAdmin = userWarehouseIds.includes('all');
        const activeWarehouseId = filters.warehouseId;
        
        const isWarehouseAllowed = (wId?: string) => {
            if (activeWarehouseId !== 'all') return wId === activeWarehouseId;
            if (isSuperAdmin) return true;
            return userWarehouseIds.includes(wId || '');
        };

        return inventory
            .filter((inv: any) => isWarehouseAllowed(inv.id.split('-')[0]))
            .map((inv: any) => {
                const itemId = inv.id.split('-')[1];
                const itemMaster = items.find((i: Item) => i.id === itemId);
                if (!itemMaster || !itemMaster.reorderPoint || inv.balance > itemMaster.reorderPoint) return null;
                
                return {
                    name: itemMaster.name,
                    stock: inv.balance,
                    reorderPoint: itemMaster.reorderPoint,
                    warehouseName: warehouses.find((w: any) => w.id === inv.id.split('-')[0])?.name || ''
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .slice(0, 20);
    }, [inventory, items, warehouses, user, filters.warehouseId]);

    if (loading) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

  return (
    <>
      <PageHeader title="المعلومات الرئيسية" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Card>
            <CardContent className="pt-6">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                     <div className="space-y-2">
                        <Label>من تاريخ</Label>
                        <Input type="date" value={filters.fromDate} onChange={(e) => handleFilterChange("fromDate", e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label>إلى تاريخ</Label>
                        <Input type="date" value={filters.toDate} onChange={(e) => handleFilterChange("toDate", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>الفرع</Label>
                        <Combobox
                          options={warehouseOptions}
                          value={filters.warehouseId}
                          onValueChange={(v) => {
                              handleFilterChange("warehouseId", v || "all");
                          }}
                          placeholder="كل الفروع"
                          emptyMessage="لم يتم العثور على فرع."
                          disabled={user?.warehouseIds?.length === 1 && !user.warehouseIds.includes('all')}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">إجمالي الأرصدة (السيولة)</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{kpiData.totalCash.toLocaleString()} ج.م</div>
                    <p className="text-[10px] text-muted-foreground mt-1">{kpiData.balanceExplanation}</p>
                </CardContent>
            </Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">مستحقات العملاء (مديونيات)</CardTitle><Users className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{kpiData.accountsReceivable.toLocaleString()} ج.م</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">مستحقات الموردين</CardTitle><Building className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{kpiData.accountsPayable.toLocaleString()} ج.م</div></CardContent></Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">قيمة المخزون (بالتكلفة)</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{ (recomputedInventoryValue ?? kpiData.inventoryValue).toLocaleString() } ج.م</div>
                    <div className="mt-3 flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleRecomputeInventoryValue}>
                            احتساب الآن
                        </Button>
                        {invLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                </CardContent>
            </Card>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">إجمالي المبيعات</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-primary"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{kpiData.totalRevenue.toLocaleString()} ج.م</div>
                    <p className="text-[10px] text-muted-foreground mt-1">إجمالي الفواتير الصادرة</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">المحصل نقداً</CardTitle>
                    <Banknote className="h-4 w-4 text-green-500"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{kpiData.totalCashFromSales.toLocaleString()} ج.م</div>
                    <p className="text-[10px] text-muted-foreground mt-1">المبالغ المستلمة فعلياً</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">تكلفة البضاعة المباعة</CardTitle>
                    <Tag className="h-4 w-4 text-amber-600"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-amber-600">{kpiData.totalCOGS.toLocaleString()} ج.م</div>
                    <p className="text-[10px] text-muted-foreground mt-1">COGS للفترة المحددة</p>
                </CardContent>
            </Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">إجمالي المصروفات</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{kpiData.totalExpenses.toLocaleString()} ج.م</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">إجمالي المرتجعات</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{kpiData.totalReturns.toLocaleString()} ج.م</div></CardContent></Card>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Dialog open={isBreakdownOpen} onOpenChange={setIsBreakdownOpen}>
                <DialogTrigger asChild>
                    <Card className="cursor-pointer hover:bg-muted/50 transition-colors border-primary/50 shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                صافي الربح
                                <Info className="h-3 w-3 text-muted-foreground"/>
                            </CardTitle>
                            <TrendingUp className="h-4 w-4 text-green-500"/>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${kpiData.netProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                {kpiData.netProfit.toLocaleString()} ج.م
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">انقر لعرض تفاصيل الاحتساب</p>
                        </CardContent>
                    </Card>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Calculator className="h-5 w-5 text-primary"/>
                            تفاصيل احتساب صافي الربح
                        </DialogTitle>
                        <DialogDescription>
                            المعادلة المحاسبية المستخدمة للفترة المختارة
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="text-muted-foreground">إجمالي المبيعات (الصافي):</div>
                            <div className="text-left font-semibold">{kpiData.totalRevenue.toLocaleString()} ج.م</div>
                            
                            <div className="text-muted-foreground">(-) تكلفة البضاعة المباعة:</div>
                            <div className="text-left font-semibold text-destructive">-{kpiData.totalCOGS.toLocaleString()} ج.م</div>
                            
                            <div className="col-span-2 border-t pt-2 flex justify-between font-bold text-md">
                                <span>(=) مجمل الربح:</span>
                                <span>{kpiData.grossProfit.toLocaleString()} ج.م</span>
                            </div>

                            <div className="text-muted-foreground">(-) مرتجعات المبيعات:</div>
                            <div className="text-left font-semibold text-destructive">-{kpiData.totalSalesReturns.toLocaleString()} ج.م</div>

                            <div className="text-muted-foreground">(-) إجمالي المصروفات:</div>
                            <div className="text-left font-semibold text-destructive">-{kpiData.totalExpenses.toLocaleString()} ج.م</div>

                            <div className="text-muted-foreground">(+) الدخل الإضافي:</div>
                            <div className="text-left font-semibold text-green-600">+{kpiData.totalExtraIncome.toLocaleString()} ج.م</div>
                        </div>
                        <div className="p-4 bg-muted rounded-lg flex justify-between items-center border-2 border-primary/20">
                            <span className="font-bold text-lg">صافي الربح النهائي:</span>
                            <span className={cn("font-black text-2xl", kpiData.netProfit >= 0 ? "text-green-600" : "text-destructive")}>
                                {kpiData.netProfit.toLocaleString()} ج.م
                            </span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">عدد العملاء</CardTitle><Users className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{kpiData.customersCount.toLocaleString()}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">إجمالي الموردين</CardTitle><Building className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{kpiData.suppliersCount.toLocaleString()}</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium"> عدد المنتجات</CardTitle><Package className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{kpiData.productsCount.toLocaleString()}</div></CardContent></Card>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
                <CardHeader><CardTitle>المبيعات والأرباح</CardTitle></CardHeader>
                <CardContent className="h-[300px]">
                     <ChartContainer config={chartConfig} className="h-full w-full">
                         <BarChart data={salesAndProfitChartData}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value/1000}k`} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Bar dataKey="sales" fill="var(--color-sales)" name="المبيعات" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="profit" fill="var(--color-profit)" name="الأرباح" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
             <Card>
                <CardHeader><CardTitle>أعلى 5 فروع مبيعًا</CardTitle></CardHeader>
                <CardContent className="h-[300px]">
                     <ChartContainer config={chartConfig} className="w-full h-full">
                        <BarChart data={topBranchesChartData} layout="vertical">
                            <CartesianGrid horizontal={false} />
                            <YAxis dataKey="name" type="category" width={isMobile ? 0 : 80} tick={!isMobile} tickLine={false} axisLine={false} />
                            <XAxis type="number" hide />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="total" name="إجمالي المبيعات" fill="hsl(var(--chart-3))" radius={5}>
                                <LabelList position="right" offset={8} className="fill-foreground" fontSize={12} formatter={(v: number) => v.toLocaleString()} />
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
             <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Clock /> أوقات الذروة (عدد الفواتير)</CardTitle></CardHeader>
                <CardContent className="h-[300px]">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <BarChart data={peakHoursChartData}>
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="label"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                angle={isMobile ? -45 : 0}
                                textAnchor={isMobile ? "end" : "middle"}
                                height={isMobile ? 50 : 30}
                            />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="visits" fill="var(--color-visits)" name="عدد الفواتير" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
                <CardHeader><CardTitle>أفضل 20 صنف مبيعًا</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>الصنف</TableHead><TableHead className="text-center">الكمية</TableHead><TableHead className="text-center">القيمة</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {topSellingItems.map(item => (
                                <TableRow key={item.name}><TableCell>{item.name}</TableCell><TableCell className="text-center">{item.qty}</TableCell><TableCell className="text-center">{item.value.toLocaleString()}</TableCell></TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="text-amber-500" />أصناف وصلت لحد الطلب</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>الصنف</TableHead><TableHead>الفرع</TableHead><TableHead className="text-center">الرصيد</TableHead><TableHead className="text-center">حد الطلب</TableHead></TableRow></TableHeader>
                        <TableBody>
                             {reorderItems.map(item => (
                                <TableRow key={`${item.name}-${item.warehouseName}`} className="bg-amber-500/10">
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.warehouseName}</TableCell>
                                    <TableCell className="text-center font-bold text-destructive">{item.stock}</TableCell>
                                    <TableCell className="text-center">{item.reorderPoint}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </main>
    </>
  );
}
