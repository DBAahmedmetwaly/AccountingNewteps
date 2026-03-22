
"use client"

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { 
  Bar, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Pie, 
  PieChart as RechartsPieChart, 
  BarChart as RechartsBarChart, 
  Cell, 
  Area, 
  AreaChart, 
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList
} from "recharts";
import { useData } from "@/contexts/data-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import PageHeader from "@/components/page-header";
import { Loader2, TrendingUp, DollarSign, ShoppingBag, Percent, Filter, Calendar } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Chart configuration for colors and labels
const chartConfig = {
  sales: {
    label: "المبيعات",
    color: "hsl(var(--primary))",
  },
  profit: {
    label: "الأرباح",
    color: "hsl(var(--chart-2))",
  },
  expenses: {
    label: "المصروفات",
    color: "hsl(var(--destructive))",
  }
};

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function AnalyticsPage() {
    const allDataContext = useData();
    const { 
        items, salesInvoices, purchaseInvoices, suppliers, warehouses, 
        customers, expenses, users, posSales, customerPayments, 
        supplierPayments, salesReturns, purchaseReturns, posReturns, 
        exceptionalIncomes, loading 
    } = allDataContext;
    
    const isMobile = useIsMobile();

    const [dateRange, setDateRange] = useState({
      from: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0]
    });
    const [selectedWarehouse, setSelectedWarehouse] = useState('all');

    // Helper to calculate manufactured item cost
    const calculateItemCost = useCallback((itemMaster: any, saleItem?: any) => {
        if (saleItem?.cost) return saleItem.cost;
        if (!itemMaster) return 0;
        if (itemMaster.itemType === 'manufactured' && itemMaster.components) {
            return itemMaster.components.reduce((total: number, comp: any) => {
                const compMaster = items.find(i => i.id === comp.itemId);
                return total + (comp.quantity * (compMaster?.cost || 0));
            }, 0);
        }
        return itemMaster.cost || 0;
    }, [items]);

    // Main processed data for analytics
    const analytics = useMemo(() => {
        if (loading) return null;

        const start = dateRange.from ? new Date(dateRange.from) : new Date(0);
        const end = dateRange.to ? new Date(dateRange.to) : new Date();
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);

        const filterByBase = (record: any) => {
            const d = new Date(record.date);
            const inDate = d >= start && d <= end;
            const inWarehouse = selectedWarehouse === 'all' || record.warehouseId === selectedWarehouse;
            return inDate && inWarehouse;
        };

        // 1. Filtered Sets
        const filteredSales = [...salesInvoices.filter(s => s.status === 'approved'), ...posSales].filter(filterByBase);
        const filteredReturns = [...salesReturns, ...posReturns].filter(filterByBase);
        const filteredExpenses = expenses.filter(e => {
            const d = new Date(e.date);
            const inDate = d >= start && d <= end;
            const inWarehouse = selectedWarehouse === 'all' || !e.warehouseId || e.warehouseId === 'none' || e.warehouseId === selectedWarehouse;
            return inDate && inWarehouse;
        });
        const filteredIncome = exceptionalIncomes.filter(filterByBase);

        // 2. Calculations for Trend Chart & KPIs
        const dailyDataMap = new Map<string, { date: string, sales: number, profit: number, expenses: number }>();
        let totalRevenue = 0;
        let totalCOGS = 0;
        let totalSalesDiscount = 0;

        filteredSales.forEach(sale => {
            const dateKey = new Date(sale.date).toISOString().split('T')[0];
            const current = dailyDataMap.get(dateKey) || { date: dateKey, sales: 0, profit: 0, expenses: 0 };
            
            const saleRevenue = sale.total;
            const saleDiscount = sale.discount || 0;
            const saleCOGS = sale.items?.reduce((sum: number, si: any) => {
                const master = items.find(i => i.id === si.id);
                return sum + (si.qty * calculateItemCost(master, si));
            }, 0) || 0;

            const saleProfit = saleRevenue - saleCOGS;

            current.sales += saleRevenue;
            current.profit += saleProfit;
            totalRevenue += saleRevenue;
            totalCOGS += saleCOGS;
            totalSalesDiscount += saleDiscount;
            
            dailyDataMap.set(dateKey, current);
        });

        // Subtract Returns from Trend
        filteredReturns.forEach(ret => {
            const dateKey = new Date(ret.date).toISOString().split('T')[0];
            const current = dailyDataMap.get(dateKey) || { date: dateKey, sales: 0, profit: 0, expenses: 0 };
            
            const retValue = ret.total;
            const retCOGS = ret.items?.reduce((sum: number, ri: any) => {
                const master = items.find(i => i.id === ri.id);
                return sum + (ri.qty * calculateItemCost(master, ri));
            }, 0) || 0;

            current.sales -= retValue;
            current.profit -= (retValue - retCOGS);
            totalRevenue -= retValue;
            totalCOGS -= retCOGS;

            dailyDataMap.set(dateKey, current);
        });

        // Add Expenses to Trend
        let totalExpAmount = 0;
        filteredExpenses.forEach(exp => {
            const dateKey = new Date(exp.date).toISOString().split('T')[0];
            const current = dailyDataMap.get(dateKey) || { date: dateKey, sales: 0, profit: 0, expenses: 0 };
            current.expenses += exp.amount;
            totalExpAmount += exp.amount;
            dailyDataMap.set(dateKey, current);
        });

        const totalExtraIncome = filteredIncome.reduce((sum, i) => sum + i.amount, 0);
        const netProfit = (totalRevenue - totalCOGS) - totalExpAmount + totalExtraIncome;
        const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCOGS) / totalRevenue) * 100 : 0;

        // 3. Item Profitability Analysis
        const itemStats = new Map<string, { name: string, qty: number, revenue: number, profit: number }>();
        filteredSales.forEach(sale => {
            sale.items?.forEach((si: any) => {
                const master = items.find(i => i.id === si.id);
                if (!master) return;
                const stats = itemStats.get(si.id) || { name: master.name, qty: 0, revenue: 0, profit: 0 };
                const cost = calculateItemCost(master, si);
                stats.qty += si.qty;
                stats.revenue += si.qty * si.price;
                stats.profit += (si.qty * si.price) - (si.qty * cost);
                itemStats.set(si.id, stats);
            });
        });

        // 4. Payment Methods Analysis
        const paymentStats = new Map<string, number>();
        filteredSales.forEach(sale => {
            if (sale.payments && sale.payments.length > 0) {
                sale.payments.forEach((p: any) => {
                    paymentStats.set(p.method, (paymentStats.get(p.method) || 0) + p.amount);
                });
            } else {
                const method = "نقدي";
                paymentStats.set(method, (paymentStats.get(method) || 0) + (sale.paidAmount || sale.total));
            }
        });

        return {
            kpis: {
                totalRevenue,
                netProfit,
                grossMargin,
                avgInvoice: filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0,
                invoiceCount: filteredSales.length
            },
            trendData: Array.from(dailyDataMap.values()).sort((a,b) => a.date.localeCompare(b.date)).map(d => ({
                ...d,
                date: new Date(d.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })
            })),
            topItems: Array.from(itemStats.values()).sort((a,b) => b.revenue - a.revenue).slice(0, 10),
            paymentData: Array.from(paymentStats.entries()).map(([name, value]) => ({ name, value })),
            warehouseData: warehouses.map(w => ({
                name: w.name,
                sales: filteredSales.filter(s => s.warehouseId === w.id).reduce((sum, s) => sum + s.total, 0)
            })).sort((a,b) => b.sales - a.sales)
        };
    }, [loading, dateRange, selectedWarehouse, salesInvoices, posSales, salesReturns, posReturns, expenses, exceptionalIncomes, items, warehouses, calculateItemCost]);

    if (loading || !analytics) {
        return (
            <div className="flex h-[80vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse font-bold text-lg">جاري تحليل البيانات...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <PageHeader title="التحليلات الرسومية المتقدمة" />
            <main className="flex flex-1 flex-col gap-6 p-4 md:p-6 bg-muted/10">
                
                {/* Filters Section */}
                <Card className="shadow-sm border-primary/10">
                    <CardContent className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2"><Calendar className="h-4 w-4"/> من تاريخ</Label>
                                <Input type="date" value={dateRange.from} onChange={(e) => setDateRange(prev => ({...prev, from: e.target.value}))} />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2"><Calendar className="h-4 w-4"/> إلى تاريخ</Label>
                                <Input type="date" value={dateRange.to} onChange={(e) => setDateRange(prev => ({...prev, to: e.target.value}))} />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2"><Filter className="h-4 w-4"/> الفرع</Label>
                                <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                                    <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">كل الفروع</SelectItem>
                                        {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => {}}>تحديث البيانات</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* KPIs Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-bold">إجمالي المبيعات</CardTitle>
                            <DollarSign className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black">{analytics.kpis.totalRevenue.toLocaleString()} ج.م</div>
                            <p className="text-[10px] text-muted-foreground mt-1">إجمالي الفواتير الصافية (بعد المرتجعات)</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-green-500/5 border-green-500/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-bold">صافي الربح التقديري</CardTitle>
                            <TrendingUp className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className={cn("text-2xl font-black", analytics.kpis.netProfit >= 0 ? "text-green-600" : "text-destructive")}>
                                {analytics.kpis.netProfit.toLocaleString()} ج.م
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">بعد خصم التكلفة والمصروفات الإدارية</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-500/5 border-amber-500/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-bold">هامش الربح الإجمالي</CardTitle>
                            <Percent className="h-4 w-4 text-amber-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black text-amber-600">{analytics.kpis.grossMargin.toFixed(1)}%</div>
                            <p className="text-[10px] text-muted-foreground mt-1">نسبة الربح من إجمالي قيمة المبيعات</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-500/5 border-blue-500/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-bold">متوسط الفاتورة</CardTitle>
                            <ShoppingBag className="h-4 w-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black text-blue-600">{analytics.kpis.avgInvoice.toLocaleString(undefined, {maximumFractionDigits: 0})} ج.م</div>
                            <p className="text-[10px] text-muted-foreground mt-1">من إجمالي {analytics.kpis.invoiceCount} فاتورة</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Trend Chart */}
                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><TrendingUp className="text-primary"/> اتجاهات المبيعات والأرباح</CardTitle>
                        <CardDescription>يوضح الرسم البياني حجم النشاط اليومي مقارنة بالمصروفات والأرباح.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={analytics.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} fontSize={12} />
                                    <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(val) => val.toLocaleString()} />
                                    <Tooltip content={<ChartTooltipContent />} />
                                    <Legend verticalAlign="top" height={36}/>
                                    <Area type="monotone" dataKey="sales" name="المبيعات" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                                    <Area type="monotone" dataKey="profit" name="الأرباح" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                                    <Area type="monotone" dataKey="expenses" name="المصروفات" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Items Chart */}
                    <Card className="shadow-md">
                        <CardHeader>
                            <CardTitle>الأصناف الأكثر تحقيقاً للإيراد</CardTitle>
                            <CardDescription>أعلى 10 أصناف مبيعاً من حيث القيمة المالية.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsBarChart data={analytics.topItems} layout="vertical" margin={{ left: -20, right: 40 }}>
                                        <CartesianGrid horizontal={false} opacity={0.2} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={120} tickLine={false} axisLine={false} fontSize={11} />
                                        <Tooltip content={<ChartTooltipContent />} />
                                        <Bar dataKey="revenue" name="الإيراد" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                                            <LabelList dataKey="revenue" position="right" fontSize={10} formatter={(v: number) => v.toLocaleString()} />
                                        </Bar>
                                    </RechartsBarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payment Methods & Distribution */}
                    <div className="flex flex-col gap-6">
                        <Card className="flex-1 shadow-md">
                            <CardHeader>
                                <CardTitle>توزيع طرق الدفع</CardTitle>
                                <CardDescription>تحليل التدفق النقدي حسب قنوات الاستلام.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex items-center justify-center">
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RechartsPieChart>
                                            <Pie
                                                data={analytics.paymentData}
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {analytics.paymentData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(val: number) => val.toLocaleString() + " ج.م"} />
                                            <Legend layout="vertical" align="right" verticalAlign="middle" />
                                        </RechartsPieChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="flex-1 shadow-md">
                            <CardHeader>
                                <CardTitle>أداء الفروع</CardTitle>
                                <CardDescription>مقارنة حجم المبيعات بين الفروع المختلفة.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {analytics.warehouseData.map((w, idx) => (
                                        <div key={idx} className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-semibold">{w.name}</span>
                                                <span className="font-mono">{w.sales.toLocaleString()} ج.م</span>
                                            </div>
                                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-primary" 
                                                    style={{ width: `${(w.sales / (analytics.kpis.totalRevenue || 1)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {analytics.warehouseData.length === 0 && <p className="text-center text-muted-foreground py-4">لا توجد بيانات فروع.</p>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </>
    );
}
