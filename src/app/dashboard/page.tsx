
"use client";

import React, { useMemo, useState, useEffect } from "react";
import PageHeader from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { Loader2, DollarSign, Users, Building, Package, TrendingUp, TrendingDown, AlertTriangle, Clock, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, CartesianGrid, XAxis, YAxis, Legend, Bar, ResponsiveContainer, LabelList } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/auth-context";
import { calculateStockForItemInWarehouse } from "@/lib/inventory-utils";

// Data Interfaces
interface Item { id: string; name: string; cost?: number; reorderPoint?: number; }
interface Sale { date: string; warehouseId?: string; total: number; items: { id: string; qty: number; cost?: number; }[]; discount: number; subtotal: number; }
interface Purchase { date: string; warehouseId: string; total: number; paidAmount?: number; }
interface Customer { openingBalance: number; }
interface Supplier { openingBalance: number; }
interface CustomerPayment { amount: number; }
interface SupplierPayment { amount: number; }
interface SalesReturn { total: number; }
interface PurchaseReturn { total: number; }
interface CashAccount { openingBalance: number; }
interface Expense { amount: number; }
interface ExceptionalIncome { amount: number; }
interface TreasuryTransaction { type: 'deposit' | 'withdrawal'; amount: number; linkedTransaction?: boolean; }
interface EmployeeAdvance { amount: number; }
interface ProfitDistribution { amount: number; }

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
        posReturns, stockIssuesToReps, stockReturnsFromReps
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
            
        return { sales, purchases, salesReturnsFiltered, purchaseReturnsFiltered };

    }, [filters, salesInvoices, posSales, purchaseInvoices, salesReturns, purchaseReturns, user]);

    const kpiData = useMemo(() => {
        const userWarehouseIds = user?.warehouseIds || [];
        const isSuperAdmin = userWarehouseIds.includes('all');
        const activeWarehouseId = filters.warehouseId;
        
        const isWarehouseAllowed = (wId?: string) => {
            if (activeWarehouseId !== 'all') return wId === activeWarehouseId;
            if (isSuperAdmin) return true;
            return userWarehouseIds.includes(wId || '');
        };

        // Filter Cash Accounts
        const filteredCashAccounts = cashAccounts.filter((acc: any) => isWarehouseAllowed(acc.warehouseId));
        const filteredCashAccountIds = new Set(filteredCashAccounts.map((acc: any) => acc.id));

        let totalCash = filteredCashAccounts.reduce((sum: number, acc: CashAccount) => sum + (acc.openingBalance || 0), 0);
        
        customerPayments.forEach((p: CustomerPayment) => {
            if (filteredCashAccountIds.has((p as any).paidToAccountId)) totalCash += p.amount;
        });
        
        exceptionalIncomes.forEach((i: ExceptionalIncome) => {
            if (filteredCashAccountIds.has((i as any).paidToAccountId)) totalCash += i.amount;
        });
        
        treasuryTransactions.filter((tx: TreasuryTransaction) => tx.type === 'deposit' && !tx.linkedTransaction).forEach((tx: TreasuryTransaction) => {
            if (filteredCashAccountIds.has((tx as any).accountId)) totalCash += tx.amount;
        });
        
        salesInvoices.filter((s:any) => s.status === 'approved' && isWarehouseAllowed(s.warehouseId)).forEach((s: any) => {
            totalCash += s.paidAmount || 0;
        });
        
        posSales.filter((s: any) => isWarehouseAllowed(s.warehouseId)).forEach((s: any) => {
            if (s.payments && s.payments.length > 0) {
                 s.payments.forEach((p:any) => totalCash += p.amount);
            } else {
                totalCash += s.paidAmount || 0
            }
        });
        
        expenses.forEach((e: Expense) => {
            if (filteredCashAccountIds.has((e as any).paidFromAccountId)) totalCash -= e.amount;
        });
        
        supplierPayments.forEach((p: SupplierPayment) => {
            if (filteredCashAccountIds.has((p as any).paidFromAccountId)) totalCash -= p.amount;
        });
        
        purchaseInvoices.filter((p: Purchase) => isWarehouseAllowed(p.warehouseId)).forEach((p: Purchase) => {
            totalCash -= (p.paidAmount || 0);
        });
        
        employeeAdvances.forEach((ea: EmployeeAdvance) => {
            if (filteredCashAccountIds.has((ea as any).paidFromAccountId)) totalCash -= ea.amount;
        });
        
        profitDistributions.forEach((pd: ProfitDistribution) => {
            if (filteredCashAccountIds.has((pd as any).paidFromAccountId)) totalCash -= pd.amount;
        });
        
        treasuryTransactions.filter((tx: TreasuryTransaction) => tx.type === 'withdrawal' && !tx.linkedTransaction).forEach((tx: TreasuryTransaction) => {
            if (filteredCashAccountIds.has((tx as any).accountId)) totalCash -= tx.amount;
        });

        const warehousesToConsider = warehouses.filter((w: any) => isWarehouseAllowed(w.id));

        const inventoryValue = items.reduce((sum: number, item: any) => {
            let itemTotalBalance = 0;
            
            warehousesToConsider.forEach((warehouse: any) => {
                // Find all inventory records for this warehouse
                const warehouseInventory = inventory.filter((inv: any) => inv.warehouseId === warehouse.id);
                
                // For each section in the warehouse, look for the item
                warehouseInventory.forEach((sectionRecord: any) => {
                    if (sectionRecord.items && sectionRecord.items[item.id]) {
                        const itemData = sectionRecord.items[item.id];
                        itemTotalBalance += (itemData.balance || 0);
                    }
                });
            });

            const itemCost = item.cost || 0;
            return sum + (itemTotalBalance * itemCost);
        }, 0);

        // --- Recalculate AR and AP correctly including opening balances ---
        let ar = 0;
        customers.forEach((c: any) => {
            let balance = Number(c.openingBalance) || 0;
            
            // Add approved sales
            salesInvoices.filter((s:any) => s.status === 'approved' && s.customerId === c.id && isWarehouseAllowed(s.warehouseId))
                .forEach((s: any) => balance += (Number(s.total) - Number(s.paidAmount || 0)));
                
            // Add POS sales
            posSales.filter((s:any) => s.customerId === c.id && isWarehouseAllowed(s.warehouseId))
                .forEach((s: any) => balance += (Number(s.total) - Number(s.paidAmount || 0)));
            
            // Subtract payments
            customerPayments.filter((p: any) => p.customerId === c.id)
                .forEach((p: any) => {
                    if (filteredCashAccountIds.has(p.paidToAccountId)) balance -= Number(p.amount);
                });
            
            // Subtract returns
            salesReturns.filter((r: any) => r.customerId === c.id && isWarehouseAllowed(r.warehouseId))
                .forEach((r: any) => balance -= Number(r.total));
                
            ar += balance;
        });

        let ap = 0;
        suppliers.forEach((s: any) => {
            let balance = Number(s.openingBalance) || 0;
            
            // Add purchases
            purchaseInvoices.filter((p: any) => p.supplierId === s.id && isWarehouseAllowed(p.warehouseId))
                .forEach((p: any) => balance += (Number(p.total) - Number(p.paidAmount || 0)));
                
            // Subtract payments
            supplierPayments.filter((p: any) => p.supplierId === s.id)
                .forEach((p: any) => {
                    if (filteredCashAccountIds.has(p.paidFromAccountId)) balance -= Number(p.amount);
                });
                
            // Subtract returns
            purchaseReturns.filter((r: any) => r.supplierId === s.id && isWarehouseAllowed(r.warehouseId))
                .forEach((r: any) => balance -= Number(r.total));
                
            ap += balance;
        });

        // Aggregates for new KPIs
        const totalExpenses = expenses.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
        const totalPurchases = filteredData.purchases.reduce((sum: number, p: any) => sum + Number(p.total || 0), 0);
        const totalSalesReturns = filteredData.salesReturnsFiltered.reduce((sum: number, r: any) => sum + Number(r.total || 0), 0);
        const totalPurchaseReturns = filteredData.purchaseReturnsFiltered.reduce((sum: number, r: any) => sum + Number(r.total || 0), 0);
        const totalReturns = totalSalesReturns + totalPurchaseReturns;
        let totalCOGS = 0;
        let netProfit = 0;
        filteredData.sales.forEach((sale: any) => {
            const saleCost = sale.items.reduce((acc: number, item: any) => {
                const master = items.find((i:any) => i.id === item.id);
                const unitCost = Number(item.cost ?? master?.cost ?? 0);
                return acc + (Number(item.qty || 0) * unitCost);
            }, 0);
            totalCOGS += saleCost;
            netProfit += (Number(sale.subtotal || sale.total || 0) - saleCost - Number(sale.discount || 0));
        });

        return { 
            totalCash, 
            accountsReceivable: ar, 
            accountsPayable: ap, 
            inventoryValue,
            totalExpenses,
            totalReturns,
            totalPurchases,
            totalCOGS,
            netProfit,
            customersCount: customers.length,
            suppliersCount: suppliers.length,
            productsCount: items.length,
            // Explanation of total balances
            balanceExplanation: `إجمالي السيولة النقدية في ${filteredCashAccounts.length} حساب/خزينة تابعة للفروع المختارة.`
        };
    }, [
        cashAccounts, customerPayments, exceptionalIncomes, treasuryTransactions, expenses, 
        supplierPayments, purchaseInvoices, employeeAdvances, profitDistributions, customers, 
        salesInvoices, posSales, salesReturns, suppliers, purchaseReturns, inventory, items, warehouses, filters.warehouseId, user, filteredData
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
        filteredData.sales.forEach((sale: Sale) => {
            const date = new Date(sale.date).toISOString().split('T')[0];
            if (!dailyData[date]) dailyData[date] = { sales: 0, profit: 0 };
            
            const saleCost = sale.items.reduce((acc: number, item: any) => {
                return acc + (item.qty * (item.cost || 0));
            }, 0);
            
            dailyData[date].sales += sale.total;
            dailyData[date].profit += (sale.subtotal - saleCost - sale.discount);
        });
        
        return Object.entries(dailyData).map(([date, data]) => ({ date: new Date(date).toLocaleDateString('ar-EG', {month: 'short', day: 'numeric'}), ...data }))
          .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [filteredData.sales]);
    
    const topBranchesChartData = useMemo(() => {
        const branchSales: {[id: string]: number} = {};
        filteredData.sales.forEach((s: Sale) => {
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
                              // If value is empty (unselected in Combobox logic), reset to 'all'
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
                    <div className="text-2xl font-bold">{(recomputedInventoryValue ?? kpiData.inventoryValue).toLocaleString()} ج.م</div>
                    <div className="mt-3 flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleRecomputeInventoryValue}>
                            احتساب الآن
                        </Button>
                        {invLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                </CardContent>
            </Card>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">إجمالي المصروفات</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{kpiData.totalExpenses.toLocaleString()} ج.م</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">إجمالي المرتجعات</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{kpiData.totalReturns.toLocaleString()} ج.م</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">إجمالي المشتريات</CardTitle><ShoppingCart className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{kpiData.totalPurchases.toLocaleString()} ج.م</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium"> تكلفة البضاعة المباعة</CardTitle><Package className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{kpiData.totalCOGS.toLocaleString()} ج.م</div></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium"> صافي الربح</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{kpiData.netProfit.toLocaleString()} ج.م</div></CardContent></Card>
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
