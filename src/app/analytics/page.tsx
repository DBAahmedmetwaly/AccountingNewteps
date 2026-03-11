
"use client"

// استيراد المكونات اللازمة للرسم البياني من مكتبة recharts
import { Bar, CartesianGrid, LabelList, XAxis, YAxis, Pie, PieChart as RechartsPieChart, BarChart as RechartsBarChart, Cell } from "recharts"
import React, { useMemo, useState, useEffect, useCallback } from 'react';
// استيراد سياق البيانات للوصول إلى بيانات التطبيق
import { useData } from "@/contexts/data-provider";
// استيراد مكونات واجهة المستخدم من ShadCN
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import PageHeader from "@/components/page-header"
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";

// تعريف واجهات البيانات (Interfaces) لضمان تطابق أنواع البيانات مع قاعدة البيانات
interface Item { id: string; name: string; cost?: number; itemType?: 'standard' | 'raw_material' | 'manufactured'; components?: { itemId: string; quantity: number }[];}
interface SaleInvoice { id: string; date: string; warehouseId: string; total: number; paidAmount?: number; customerId: string; salesRepId?: string; status?: string; items: { id: string; qty: number; price: number; cost?: number; }[]; }
interface PurchaseInvoice { id: string; date: string; supplierId: string, warehouseId: string, total: number; paidAmount?: number; }
interface Supplier { id: string; name: string; openingBalance: number; }
interface Warehouse { id: string; name: string; }
interface Customer { id: string; name: string; openingBalance: number; }
interface Expense { id: string; date: string; amount: number; expenseType: string; warehouseId?: string; }
interface User { id: string; name: string; isSalesRep?: boolean; }
interface PosSale { id: string; date: string; total: number; items: { id: string; qty: number; price: number; cost?: number; }[]; warehouseId: string;}
interface CustomerPayment { id: string; customerId: string; amount: number; }
interface SupplierPayment { id: string; supplierId: string; amount: number; }
interface SalesReturn { id: string; customerId: string; total: number; }
interface PurchaseReturn { id: string; supplierId: string; total: number; }

// إعدادات الألوان والتسميات للرسوم البيانية
const chartConfig = {
  profit: {
    label: "أرباح",
    color: "hsl(var(--chart-2))",
  },
  loss: {
    label: "خسائر",
    color: "hsl(var(--destructive))",
  },
   receivables: {
    label: "ديون العملاء",
    color: "hsl(var(--chart-1))",
  },
  payables: {
    label: "مستحقات الموردين",
    color: "hsl(var(--chart-3))",
  },
  sales: {
    label: "مبيعات",
    color: "hsl(var(--primary))",
  },
  expenses: {
    label: "مصروفات",
    color: "hsl(var(--chart-5))",
  }
}

// مجموعة ألوان لاستخدامها في الرسوم البيانية الدائرية
const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

// المكون الرئيسي لصفحة التحليلات
export default function AnalyticsPage() {
    // استدعاء البيانات من السياق المركزي
    const { items, salesInvoices, purchaseInvoices, suppliers, warehouses, customers, expenses, users, posSales, customerPayments, supplierPayments, salesReturns, purchaseReturns, loading } = useData();
    const isMobile = useIsMobile();

    // حالة (state) لتخزين نطاق التاريخ المحدد وفلتر المخزن
    const [dateRange, setDateRange] = useState({
      from: '',
      to: ''
    });
    const [selectedWarehouse, setSelectedWarehouse] = useState('all');


    // `useEffect` لتعيين نطاق تاريخ افتراضي عند تحميل الصفحة (آخر 30 يومًا)
    useEffect(() => {
        const today = new Date();
        const fromDate = new Date();
        fromDate.setDate(today.getDate() - 30);
        setDateRange({
            from: fromDate.toISOString().split('T')[0],
            to: today.toISOString().split('T')[0]
        });
    }, []);

    // `useMemo` لتصفية فواتير البيع بناءً على الفلاتر المحددة (نطاق التاريخ والمخزن)
    const filteredSales = useMemo(() => {
        return salesInvoices.filter((sale: SaleInvoice) => {
            if (sale.status && sale.status !== 'approved') return false; // تجاهل الفواتير غير المعتمدة
            const saleDate = new Date(sale.date);
            const from = dateRange.from ? new Date(dateRange.from) : null;
            const to = dateRange.to ? new Date(dateRange.to) : null;
            if (from) from.setHours(0, 0, 0, 0);
            if (to) to.setHours(23, 59, 59, 999);
            if (from && saleDate < from) return false;
            if (to && saleDate > to) return false;
            if (selectedWarehouse !== 'all' && sale.warehouseId !== selectedWarehouse) return false;
            return true;
        });
    }, [salesInvoices, dateRange, selectedWarehouse]);
    
    // `useMemo` لتصفية مبيعات نقاط البيع (الكاشير)
    const filteredPosSales = useMemo(() => {
         return posSales.filter((sale: PosSale) => {
            const saleDate = new Date(sale.date);
            const from = dateRange.from ? new Date(dateRange.from) : null;
            const to = dateRange.to ? new Date(dateRange.to) : null;
             if (from) from.setHours(0, 0, 0, 0);
            if (to) to.setHours(23, 59, 59, 999);
            if (from && saleDate < from) return false;
            if (to && saleDate > to) return false;
            if (selectedWarehouse !== 'all' && sale.warehouseId !== selectedWarehouse) return false;
            return true;
        });
    }, [posSales, dateRange, selectedWarehouse]);


    // `useMemo` لتصفية فواتير الشراء
    const filteredPurchases = useMemo(() => {
        return purchaseInvoices.filter((purchase: PurchaseInvoice) => {
            const purchaseDate = new Date(purchase.date);
            const from = dateRange.from ? new Date(dateRange.from) : null;
            const to = dateRange.to ? new Date(dateRange.to) : null;
             if (from) from.setHours(0, 0, 0, 0);
            if (to) to.setHours(23, 59, 59, 999);
            if (from && purchaseDate < from) return false;
            if (to && purchaseDate > to) return false;
            if (selectedWarehouse !== 'all' && purchase.warehouseId !== selectedWarehouse) return false;
            return true;
        });
    }, [purchaseInvoices, dateRange, selectedWarehouse]);

    // `useMemo` لتصفية المصروفات
    const filteredExpenses = useMemo(() => {
        return expenses.filter((expense: Expense) => {
            const expenseDate = new Date(expense.date);
            const from = dateRange.from ? new Date(dateRange.from) : null;
            const to = dateRange.to ? new Date(dateRange.to) : null;
            if (from) from.setHours(0, 0, 0, 0);
            if (to) to.setHours(23, 59, 59, 999);
            if (from && expenseDate < from) return false;
            if (to && expenseDate > to) return false;
            if (selectedWarehouse !== 'all' && expense.warehouseId && expense.warehouseId !== 'none' && expense.warehouseId !== selectedWarehouse) return false;
            return true;
        });
    }, [expenses, dateRange, selectedWarehouse]);
    
    const calculateManufacturedCost = useCallback((item: any) => {
        if (!item || item.itemType !== 'manufactured' || !item.components) {
            return item?.cost || 0;
        }
        return item.components.reduce((totalCost: number, component: any) => {
            const componentItem = items.find((i:any) => i.id === component.itemId);
            return totalCost + (component.quantity * (componentItem?.cost || 0));
        }, 0);
    }, [items]);


    // `useMemo` لحساب ربحية الأصناف وعرض أفضل 5
    const itemProfitData = useMemo(() => {
        const profitMap = new Map<string, { totalRevenue: number, totalCost: number }>();
        
        // دالة مساعدة لمعالجة أصناف الفاتورة
        const processSaleItems = (saleItems: any[], itemMasterList: any[]) => {
            if (!saleItems || !Array.isArray(saleItems)) return;
            saleItems.forEach(saleItem => {
                if (!saleItem.id) return;
                const itemMaster = itemMasterList.find(i => i.id === saleItem.id);
                if (!itemMaster) return;

                const revenue = (saleItem.qty || 0) * (saleItem.price || 0);
                const cost = (saleItem.qty || 0) * (saleItem.cost || calculateManufacturedCost(itemMaster) || 0);

                const current = profitMap.get(itemMaster.id) || { totalRevenue: 0, totalCost: 0 };
                current.totalRevenue += revenue;
                current.totalCost += cost;
                profitMap.set(itemMaster.id, current);
            });
        };

        // معالجة فواتير البيع العادية ونقاط البيع
        filteredSales.forEach(sale => processSaleItems(sale.items, items));
        filteredPosSales.forEach(sale => processSaleItems(sale.items, items));

        // تحويل الخريطة إلى مصفوفة وتنسيقها للعرض في الرسم البياني
        return Array.from(profitMap.entries()).map(([itemId, data]) => {
            const itemMaster = items.find((i: Item) => i.id === itemId);
            const profit = data.totalRevenue - data.totalCost;
            return {
                name: itemMaster?.name || 'صنف غير معروف',
                profit: profit >= 0 ? profit : 0, // فصل الربح عن الخسارة
                loss: profit < 0 ? -profit : 0
            };
        }).filter(d => d.profit > 0 || d.loss > 0).sort((a,b) => b.profit - a.profit).slice(0, 5); // فرز وعرض أفضل 5

    }, [items, filteredSales, filteredPosSales, calculateManufacturedCost]);

    // `useMemo` لحساب نشاط الموردين (قيمة المشتريات)
    const supplierActivityData = useMemo(() => {
        const activity: { [key: string]: number } = {};
        filteredPurchases.forEach((purchase: PurchaseInvoice) => {
            const supplierName = suppliers.find((s: Supplier) => s.id === purchase.supplierId)?.name || "غير محدد";
            activity[supplierName] = (activity[supplierName] || 0) + purchase.total;
        });
        return Object.entries(activity).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
    }, [filteredPurchases, suppliers]);
    
    // `useMemo` لحساب نشاط الفروع (قيمة المبيعات)
    const warehouseActivityData = useMemo(() => {
         const activity: { [key: string]: number } = {};
         const allSales = [...filteredSales, ...filteredPosSales];
         allSales.forEach(sale => {
            const warehouseName = warehouses.find((w: Warehouse) => w.id === (sale as any).warehouseId)?.name || "غير محدد";
            activity[warehouseName] = (activity[warehouseName] || 0) + (sale as any).total;
        });
        return Object.entries(activity).map(([name, sales]) => ({ name, sales })).sort((a,b) => b.sales - a.sales);
    }, [filteredSales, filteredPosSales, warehouses]);

    // `useMemo` لحساب إجمالي الديون المستحقة على العملاء ومستحقات الموردين
    const receivablesPayablesData = useMemo(() => {
        let totalReceivables = customers.reduce((acc: number, c: Customer) => acc + (c.openingBalance || 0), 0);
        salesInvoices.forEach((inv: SaleInvoice) => { totalReceivables += inv.total - (inv.paidAmount || 0); });
        customerPayments.forEach((p: CustomerPayment) => { totalReceivables -= p.amount; });
        salesReturns.forEach((r: SalesReturn) => { totalReceivables -= r.total; });

        let totalPayables = suppliers.reduce((acc: number, s: Supplier) => acc + (s.openingBalance || 0), 0);
        purchaseInvoices.forEach((inv: PurchaseInvoice) => { totalPayables += inv.total - (inv.paidAmount || 0); });
        supplierPayments.forEach((p: SupplierPayment) => { totalPayables -= p.amount; });
        purchaseReturns.forEach((r: PurchaseReturn) => { totalPayables -= r.total; });

        return [
            { name: 'ديون العملاء', value: Math.max(0, totalReceivables), fill: "var(--color-receivables)" },
            { name: 'مستحقات الموردين', value: Math.max(0, totalPayables), fill: "var(--color-payables)" },
        ];
    }, [customers, suppliers, salesInvoices, purchaseInvoices, customerPayments, supplierPayments, salesReturns, purchaseReturns]);

    // `useMemo` لتجميع المصروفات حسب النوع
     const expenseByTypeData = useMemo(() => {
        const expenseTotals: { [key: string]: number } = {};
        filteredExpenses.forEach((expense: Expense) => {
            expenseTotals[expense.expenseType] = (expenseTotals[expense.expenseType] || 0) + expense.amount;
        });
        return Object.entries(expenseTotals).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
    }, [filteredExpenses]);
    
    // `useMemo` لحساب أداء مناديب المبيعات
    const salesRepPerformanceData = useMemo(() => {
        const repTotals: { [key: string]: number } = {};
        filteredSales.forEach(sale => {
            if (sale.salesRepId) {
                const repName = users.find((u: User) => u.id === sale.salesRepId)?.name || 'مندوب غير معروف';
                repTotals[repName] = (repTotals[repName] || 0) + sale.total;
            }
        });
        return Object.entries(repTotals).map(([name, sales]) => ({ name, sales })).sort((a,b) => b.sales - a.sales);
    }, [filteredSales, users]);


    // عرض شاشة تحميل أثناء جلب البيانات
    if (loading) {
        return (
            <div className="flex flex-1 justify-center items-center">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            </div>
        )
    }

  // JSX لعرض واجهة المستخدم
  return (
    <>
      <PageHeader title="التحليلات الرسومية" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        
        {/* بطاقة فلاتر التاريخ والمخزن */}
        <Card>
            <CardHeader>
                <CardTitle>فترة التحليل</CardTitle>
            </CardHeader>
            <CardContent>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                     <div className="space-y-2">
                        <Label htmlFor="from-date">من تاريخ</Label>
                        <Input type="date" value={dateRange.from} onChange={(e) => setDateRange(prev => ({...prev, from: e.target.value}))} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="to-date">إلى تاريخ</Label>
                        <Input type="date" value={dateRange.to} onChange={(e) => setDateRange(prev => ({...prev, to: e.target.value}))} />
                    </div>
                    <div className="space-y-2">
                        <Label>الفرع</Label>
                        <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر الفرع" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الفروع</SelectItem>
                                {warehouses.map((w: Warehouse) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* شبكة عرض الرسوم البيانية */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* رسم بياني لربحية الأصناف */}
            <Card>
                <CardHeader>
                    <CardTitle>أرباح وخسائر الأصناف</CardTitle>
                    <CardDescription>
                        تحليل ربحية الأصناف الأكثر مبيعًا
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <RechartsBarChart data={itemProfitData} layout="vertical" margin={{ right: 20, left: 0 }}>
                            <CartesianGrid horizontal={false} />
                            <YAxis
                                dataKey="name"
                                type="category"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                width={isMobile ? 0 : 80}
                                tick={!isMobile}
                            />
                            <XAxis type="number" hide />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent />}
                            />
                            <Bar dataKey="profit" name="أرباح" fill="var(--color-profit)" radius={5} stackId="a">
                                {!isMobile && <LabelList position="right" offset={8} className="fill-foreground" fontSize={12} formatter={(v: number) => v.toLocaleString()} />}
                            </Bar>
                             <Bar dataKey="loss" name="خسائر" fill="var(--color-loss)" radius={5} stackId="a">
                                {!isMobile && <LabelList position="right" offset={8} className="fill-foreground" fontSize={12} formatter={(v: number) => v.toLocaleString()} />}
                            </Bar>
                        </RechartsBarChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            {/* رسم بياني لنشاط الموردين */}
            <Card>
                <CardHeader>
                    <CardTitle>نشاط الموردين</CardTitle>
                    <CardDescription>
                       الموردون الأكثر تعاملاً من حيث قيمة الفواتير
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={{}} className="h-[300px] w-full">
                        <RechartsBarChart data={supplierActivityData} layout="vertical" margin={{ right: 20, left: 0 }}>
                            <CartesianGrid horizontal={false} />
                            <YAxis
                                dataKey="name"
                                type="category"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                width={isMobile ? 0 : 100}
                                tick={!isMobile}
                            />
                            <XAxis type="number" hide />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent />}
                            />
                            <Bar dataKey="value" fill="hsl(var(--primary))" radius={5}>
                                 {!isMobile && <LabelList position="right" offset={8} className="fill-foreground" fontSize={12} formatter={(v: number) => v.toLocaleString()} />}
                            </Bar>
                        </RechartsBarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
            
            {/* رسم بياني للذمم والديون */}
            <Card>
                <CardHeader>
                    <CardTitle>الذمم والديون (إجمالي)</CardTitle>
                    <CardDescription>
                        نظرة على إجمالي الأموال المستحقة للشركة وعليها
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                       <RechartsPieChart>
                            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                            <Pie data={receivablesPayablesData} dataKey="value" nameKey="name" >
                                {receivablesPayablesData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                                 <LabelList
                                    dataKey="value"
                                    className="fill-background"
                                    stroke="none"
                                    fontSize={12}
                                    formatter={(value: number) => value.toLocaleString()}
                                />
                            </Pie>
                       </RechartsPieChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            {/* رسم بياني لنشاط الفروع */}
             <Card>
                <CardHeader>
                    <CardTitle>نشاط الفروع</CardTitle>
                    <CardDescription>
                        مقارنة أداء الفروع من حيث المبيعات
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <RechartsBarChart data={warehouseActivityData}>
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="name"
                                tickLine={false}
                                tickMargin={10}
                                axisLine={false}
                                angle={isMobile ? -45 : 0}
                                textAnchor={isMobile ? "end" : "middle"}
                                height={isMobile ? 50 : 30}
                            />
                            <YAxis tickFormatter={(v) => v.toLocaleString()} />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent />}
                            />
                            <Bar dataKey="sales" fill="var(--color-sales)" radius={8}>
                                 {!isMobile && <LabelList
                                    position="top"
                                    offset={12}
                                    className="fill-foreground"
                                    fontSize={12}
                                    formatter={(v: number) => v.toLocaleString()}
                                />}
                            </Bar>
                        </RechartsBarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
            
            {/* رسم بياني لأداء المناديب */}
             <Card>
                <CardHeader>
                    <CardTitle>أداء المناديب</CardTitle>
                    <CardDescription>
                        إجمالي المبيعات المعتمدة لكل مندوب في الفترة المحددة
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <RechartsBarChart data={salesRepPerformanceData}>
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="name"
                                tickLine={false}
                                tickMargin={10}
                                axisLine={false}
                                angle={isMobile ? -45 : 0}
                                textAnchor={isMobile ? "end" : "middle"}
                                height={isMobile ? 50 : 30}
                            />
                            <YAxis tickFormatter={(v) => v.toLocaleString()} />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent />}
                            />
                            <Bar dataKey="sales" fill="var(--color-sales)" radius={8}>
                                 {!isMobile && <LabelList
                                    position="top"
                                    offset={12}
                                    className="fill-foreground"
                                    fontSize={12}
                                    formatter={(v: number) => v.toLocaleString()}
                                />}
                            </Bar>
                        </RechartsBarChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            {/* رسم بياني لتوزيع المصروفات */}
             <Card>
                <CardHeader>
                    <CardTitle>توزيع المصروفات</CardTitle>
                    <CardDescription>
                        تحليل المصروفات حسب النوع
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <RechartsBarChart data={expenseByTypeData} layout="vertical" margin={{ right: 20, left: 0 }}>
                            <CartesianGrid horizontal={false} />
                             <YAxis
                                dataKey="name"
                                type="category"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                                width={isMobile ? 0 : 80}
                                tick={!isMobile}
                            />
                            <XAxis type="number" hide />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent />}
                            />
                            <Bar dataKey="value" fill="var(--color-expenses)" radius={5}>
                                 {!isMobile && <LabelList position="right" offset={8} className="fill-foreground" fontSize={12} formatter={(v: number) => v.toLocaleString()} />}
                            </Bar>
                        </RechartsBarChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
      </main>
    </>
  )
}
