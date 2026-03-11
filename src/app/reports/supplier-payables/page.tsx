
"use client";

import React, { useMemo, useState } from "react";
import Link from 'next/link';
import PageHeader from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Loader2, Building2, Search } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, LabelList } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";

// Data Interfaces
interface Supplier {
  id: string;
  name: string;
  contact?: string;
  openingBalance?: number;
  currentBalance?: number;
}
interface PurchaseInvoice { id: string; supplierId: string; total: number; paidAmount?: number; }
interface SupplierPayment { id: string; supplierId: string; amount: number; invoiceId?: string; }
interface PurchaseReturn { id: string; supplierId: string; total: number; paidAmount?: number; }
interface CashAccount { id: string; name: string; }

const QuickPaymentDialog = ({ supplier, onSave }: { supplier: any, onSave: () => void }) => {
    const { cashAccounts, dbAction, getNextId } = useData();
    const { user } = useAuth();
    const { toast } = useToast();
    const [amount, setAmount] = useState(supplier.currentBalance);
    const [paidFromAccountId, setPaidFromAccountId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const cashAccountOptions = useMemo(() => {
        return cashAccounts.filter((acc: CashAccount) => !(acc as any).warehouseId).map((acc: CashAccount) => ({ value: acc.id, label: acc.name }));
    }, [cashAccounts]);

    const handleSavePayment = async () => {
        if (!amount || amount <= 0 || !paidFromAccountId) {
            toast({ variant: 'destructive', title: 'بيانات غير كاملة', description: 'الرجاء إدخال مبلغ صحيح واختيار حساب الدفع.' });
            return;
        }
        setIsSaving(true);
        try {
            const receiptNumber = `س-م-${await getNextId('supplierPayment')}`;
            const newPayment = {
                date: new Date().toISOString(),
                amount: Number(amount),
                supplierId: supplier.id,
                paidFromAccountId,
                notes: `دفعة سريعة من تقرير المستحقات`,
                receiptNumber,
                createdById: user?.id,
                createdByName: user?.name,
            };
            await dbAction('supplierPayments', 'add', newPayment);
            toast({ title: 'تم الحفظ بنجاح', description: `تم سداد دفعة للمورد ${supplier.name}` });
            onSave();
            setIsOpen(false);
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الدفعة.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">سداد دفعة</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>تسجيل دفعة سريعة للمورد: {supplier.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="amount">المبلغ المدفوع</Label>
                        <Input id="amount" type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="text-lg font-bold" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="account">دفع من حساب</Label>
                        <Combobox
                            options={cashAccountOptions}
                            value={paidFromAccountId}
                            onValueChange={setPaidFromAccountId}
                            placeholder="اختر حساب الدفع..."
                            emptyMessage="لم يتم العثور على حساب."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSavePayment} disabled={isSaving}>
                        {isSaving && <Loader2 className="animate-spin ml-2 h-4 w-4" />}
                        حفظ الدفعة
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default function SupplierPayablesReport() {
    const { suppliers, purchaseInvoices, supplierPayments, purchaseReturns, loading, dbAction } = useData();
    const isMobile = useIsMobile();
    const [searchTerm, setSearchTerm] = useState("");
    
    const suppliersWithBalance = useMemo(() => {
        if (loading) return [];
        
        return suppliers.map((supplier: Supplier) => {
            let balance = Number(supplier.openingBalance) || 0;

            // 1. إضافة المبالغ المتبقية من فواتير الشراء
            const supplierPurchases = purchaseInvoices.filter((p: PurchaseInvoice) => p.supplierId === supplier.id);
            supplierPurchases.forEach((p: any) => {
                balance += (Number(p.total) - Number(p.paidAmount || 0));
            });

            // 2. طرح المدفوعات المنفصلة (التي لم تربط بفاتورة شراء محددة)
            const filteredPayments = supplierPayments.filter((p: SupplierPayment) => p.supplierId === supplier.id && !p.invoiceId);
            filteredPayments.forEach((p: any) => {
                balance -= Number(p.amount);
            });

            // 3. طرح المرتجعات (المبالغ التي لم تُسترد نقداً من المورد)
            const filteredReturns = purchaseReturns.filter((r: PurchaseReturn) => r.supplierId === supplier.id);
            filteredReturns.forEach((r: any) => {
                balance -= (Number(r.total) - Number(r.paidAmount || 0));
            });
            
            const invoiceCount = supplierPurchases.length;
            
            return { ...supplier, currentBalance: balance, invoiceCount };
        }).filter((s: any) => s.currentBalance > 0.01);
    }, [suppliers, purchaseInvoices, supplierPayments, purchaseReturns, loading]);

    const filteredSuppliers = useMemo(() => {
        if (!searchTerm) {
            return suppliersWithBalance;
        }
        return suppliersWithBalance.filter((supplier: Supplier) => 
            supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (supplier.contact && supplier.contact.includes(searchTerm))
        );
    }, [suppliersWithBalance, searchTerm]);

    const totalPayables = useMemo(() => {
        return filteredSuppliers.reduce((acc: number, supplier: any) => acc + supplier.currentBalance, 0);
    }, [filteredSuppliers]);

    const topSuppliers = useMemo(() => {
        return [...filteredSuppliers]
            .sort((a: any, b: any) => b.currentBalance - a.currentBalance)
            .slice(0, 10);
    }, [filteredSuppliers]);
    
    const handlePaymentSaved = () => {
       // DataProvider will auto-update
    };

  return (
    <>
      <PageHeader title="مستحقات الموردين" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 flex flex-col gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">إجمالي المستحقات</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                    {loading ? <Loader2 className="h-6 w-6 animate-spin"/> : (
                        <>
                        <div className="text-2xl font-bold">{totalPayables.toLocaleString(undefined, { minimumFractionDigits: 2 })} ج.م</div>
                        <p className="text-xs text-muted-foreground">
                            إجمالي المبالغ المستحقة لجميع الموردين
                        </p>
                        </>
                    )}
                    </CardContent>
                </Card>

                <Card className="flex-1">
                    <CardHeader>
                        <CardTitle>أعلى 10 موردين لهم مستحقات</CardTitle>
                    </CardHeader>
                    <CardContent className="w-full">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto"/> : (
                        <div className="w-full h-[300px]">
                            <ChartContainer config={{}} className="w-full h-full">
                                <BarChart data={topSuppliers} layout="vertical" margin={{ right: 20 }}>
                                    <CartesianGrid horizontal={false} />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={10}
                                        width={isMobile ? 0 : 120}
                                        tick={!isMobile}
                                    />
                                    <XAxis type="number" hide />
                                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                    <Bar dataKey="currentBalance" name="المستحق" fill="hsl(var(--primary))" radius={5}>
                                        <LabelList position="right" offset={8} className="fill-foreground" fontSize={12} formatter={(v: number) => v.toLocaleString()} />
                                    </Bar>
                                </BarChart>
                            </ChartContainer>
                        </div>
                    )}
                    </CardContent>
                </Card>
            </div>

            <Card className="flex-1 lg:flex-[2]">
                <CardHeader>
                    <CardTitle>كشف الذمم الدائنة</CardTitle>
                    <CardDescription>
                         <div className="relative mt-2">
                          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="بحث بالاسم أو جهة الاتصال..." className="pr-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto"/> : (
                        <div className="w-full overflow-auto">
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead>اسم المورد</TableHead>
                                    <TableHead className="hidden sm:table-cell">جهة الاتصال</TableHead>
                                    <TableHead className="text-center">عدد الفواتير</TableHead>
                                    <TableHead className="text-center">المبلغ المستحق</TableHead>
                                    <TableHead className="text-center">الإجراء</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {filteredSuppliers.map((supplier: any) => (
                                    <TableRow key={supplier.id}>
                                    <TableCell>
                                        <Link href={`/reports/supplier-statement?supplierId=${supplier.id}`} className="font-medium text-primary hover:underline">
                                            {supplier.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">{supplier.contact || 'غير مسجل'}</TableCell>
                                    <TableCell className="text-center">{supplier.invoiceCount}</TableCell>
                                    <TableCell className="text-center font-bold text-destructive">{supplier.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-center">
                                       <QuickPaymentDialog supplier={supplier} onSave={handlePaymentSaved} />
                                    </TableCell>
                                    </TableRow>
                                ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </main>
    </>
  );
}
