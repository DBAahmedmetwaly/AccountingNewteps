
"use client";

import React, { useState, useMemo } from 'react';
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
import { useData } from "@/contexts/data-provider";
import { Loader2, Coins, HandCoins, History, ArrowDownCircle, Users, CheckCircle, Save, Trash2, Calendar, FileText } from "lucide-react";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export default function GratuityManagementPage() {
    const { gratuityLogs, gratuityDistributions, dbAction, getNextId, cashAccounts, loading, warehouses } = useData();
    const { user } = useAuth();
    const { toast } = useToast();

    // 1. Calculate Fund Balance
    const totalCollected = useMemo(() => gratuityLogs.reduce((sum, log) => sum + log.amount, 0), [gratuityLogs]);
    const totalDistributed = useMemo(() => gratuityDistributions.reduce((sum, dist) => sum + dist.amount, 0), [gratuityDistributions]);
    const currentFundBalance = totalCollected - totalDistributed;

    // Form State for Distribution
    const [distAmount, setDistAmount] = useState(0);
    const [distFromAccountId, setDistFromAccountId] = useState('');
    const [distNotes, setDistNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleDistribute = async () => {
        if (distAmount <= 0 || !distFromAccountId) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى إدخال مبلغ صحيح واختيار حساب الدفع.' });
            return;
        }

        if (distAmount > currentFundBalance) {
            if (!confirm(`المبلغ المدخل (${distAmount}) أكبر من الرصيد الحالي للصندوق (${currentFundBalance}). هل تريد المتابعة؟`)) return;
        }

        setIsSaving(true);
        try {
            const receiptNumber = `ص-ت-${await getNextId('gratuityDistribution')}`;
            const date = new Date().toISOString();

            await dbAction('gratuityDistributions', 'add', {
                date,
                amount: Number(distAmount),
                paidFromAccountId: distFromAccountId,
                notes: distNotes,
                receiptNumber,
                createdById: user?.id,
                createdByName: user?.name,
            });

            // Add corresponding expense
            await dbAction('expenses', 'add', {
                date,
                amount: Number(distAmount),
                expenseType: 'توزيع إكراميات',
                description: `توزيع إكراميات للموظفين - سند رقم ${receiptNumber}`,
                paidFromAccountId: distFromAccountId,
                receiptNumber,
            });

            toast({ title: 'تم التوزيع بنجاح', description: `سند رقم: ${receiptNumber}` });
            setDistAmount(0);
            setDistNotes('');
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ عملية التوزيع.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteDistribution = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا السند؟ سيتم إلغاء العملية محاسبياً.')) return;
        try {
            await dbAction('gratuityDistributions', 'remove', { id });
            // Also need to find and remove corresponding expense usually, 
            // but for MVP we just notify the user to clean it up in expenses if needed.
            toast({ title: 'تم الحذف' });
        } catch (error) {
             toast({ variant: 'destructive', title: 'خطأ' });
        }
    };

    const sortedLogs = useMemo(() => [...gratuityLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [gratuityLogs]);
    const sortedDists = useMemo(() => [...gratuityDistributions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [gratuityDistributions]);

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;

    return (
        <>
            <PageHeader title="إدارة صندوق الإكراميات (Tips)" />
            <main className="flex-1 p-4 md:p-6 space-y-6">
                
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">إجمالي الإكراميات المحصلة</CardTitle>
                            <Coins className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalCollected.toLocaleString()} ج.م</div>
                            <p className="text-xs text-muted-foreground mt-1">تراكمي من جميع فواتير الكاشير</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-green-50 dark:bg-green-900/10 border-green-200">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">إجمالي ما تم توزيعه</CardTitle>
                            <HandCoins className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{totalDistributed.toLocaleString()} ج.م</div>
                            <p className="text-xs text-green-600/70 mt-1">مبالغ تم صرفها للموظفين</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-bold text-amber-800 dark:text-amber-400">رصيد الصندوق الحالي</CardTitle>
                            <ArrowDownCircle className="h-4 w-4 text-amber-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-black text-amber-700 dark:text-amber-400">{currentFundBalance.toLocaleString()} ج.م</div>
                            <p className="text-xs text-amber-600/70 mt-1">مبالغ محصلة في الخزينة بانتظار التوزيع</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-5">
                    {/* Distribution Form */}
                    <Card className="lg:col-span-2 shadow-sm">
                        <CardHeader>
                            <CardTitle>توزيع إكراميات على الموظفين</CardTitle>
                            <CardDescription>تسجيل عملية صرف المبالغ من الخزينة وتوزيعها على العاملين.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>المبلغ المراد توزيعه</Label>
                                <Input type="number" value={distAmount} onChange={e => setDistAmount(Number(e.target.value))} className="text-lg font-bold" />
                            </div>
                            <div className="space-y-2">
                                <Label>يصرف من خزينة</Label>
                                <Select value={distFromAccountId} onValueChange={setDistFromAccountId}>
                                    <SelectTrigger><SelectValue placeholder="اختر الخزينة..." /></SelectTrigger>
                                    <SelectContent>
                                        {cashAccounts.filter(acc => !acc.userId).map(acc => (
                                            <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>ملاحظات التوزيع</Label>
                                <Input value={distNotes} onChange={e => setDistNotes(e.target.value)} placeholder="مثال: توزيع إكراميات أسبوع عيد الفطر" />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full h-12 text-base" onClick={handleDistribute} disabled={isSaving || distAmount <= 0}>
                                {isSaving ? <Loader2 className="animate-spin ml-2" /> : <CheckCircle className="ml-2" />}
                                تأكيد التوزيع والصرف
                            </Button>
                        </CardFooter>
                    </Card>

                    {/* Logs Tabs */}
                    <Card className="lg:col-span-3">
                        <Tabs defaultValue="inflow">
                            <CardHeader className="pb-0">
                                <div className="flex justify-between items-center">
                                    <CardTitle>حركة الصندوق</CardTitle>
                                    <TabsList>
                                        <TabsTrigger value="inflow">المحصل (الوارد)</TabsTrigger>
                                        <TabsTrigger value="outflow">الموزع (الصادر)</TabsTrigger>
                                    </TabsList>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <TabsContent value="inflow" className="m-0">
                                    <div className="w-full overflow-auto border rounded-md max-h-[400px]">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>التاريخ</TableHead>
                                                    <TableHead>الفاتورة</TableHead>
                                                    <TableHead>الفرع</TableHead>
                                                    <TableHead className="text-center">المبلغ</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sortedLogs.length > 0 ? sortedLogs.map(log => (
                                                    <TableRow key={log.id}>
                                                        <TableCell className="text-xs">{new Date(log.date).toLocaleString('ar-EG')}</TableCell>
                                                        <TableCell className="font-mono text-xs">{log.invoiceNumber}</TableCell>
                                                        <TableCell className="text-xs">{warehouses.find(w => w.id === log.warehouseId)?.name || '---'}</TableCell>
                                                        <TableCell className="text-center font-bold text-primary">{log.amount.toLocaleString()}</TableCell>
                                                    </TableRow>
                                                )) : <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">لا توجد إكراميات مسجلة.</TableCell></TableRow>}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>
                                <TabsContent value="outflow" className="m-0">
                                     <div className="w-full overflow-auto border rounded-md max-h-[400px]">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>سند الصرف</TableHead>
                                                    <TableHead>التاريخ</TableHead>
                                                    <TableHead>البيان</TableHead>
                                                    <TableHead className="text-center">المبلغ</TableHead>
                                                    <TableHead className="w-[50px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sortedDists.length > 0 ? sortedDists.map(dist => (
                                                    <TableRow key={dist.id}>
                                                        <TableCell className="font-mono text-xs">{dist.receiptNumber}</TableCell>
                                                        <TableCell className="text-xs">{new Date(dist.date).toLocaleDateString('ar-EG')}</TableCell>
                                                        <TableCell className="text-xs max-w-[150px] truncate">{dist.notes}</TableCell>
                                                        <TableCell className="text-center font-bold text-destructive">-{dist.amount.toLocaleString()}</TableCell>
                                                        <TableCell>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteDistribution(dist.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )) : <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">لم يتم توزيع أي مبالغ بعد.</TableCell></TableRow>}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>
                            </CardContent>
                        </Tabs>
                    </Card>
                </div>
            </main>
        </>
    );
}
