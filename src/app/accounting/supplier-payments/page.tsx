
"use client";

// استيراد المكونات والأدوات اللازمة
import React, { useState, useMemo, useEffect } from 'react';
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Loader2, MoreHorizontal, Edit, Trash2, Info, Wallet } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/auth-context';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useData } from '@/contexts/data-provider';
import { Combobox } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// تعريف واجهات البيانات (Interfaces) لضمان تطابق أنواع البيانات لضمان تطابق أنواع البيانات
interface SupplierPayment {
    id?: string;
    date: string;
    amount: number;
    supplierId: string;
    paidFromAccountId: string;
    notes?: string;
    receiptNumber?: string;
    createdById?: string;
    createdByName?: string;
    invoiceId?: string;
}

interface Supplier {
    id: string;
    name: string;
    openingBalance?: number;
}

interface CashAccount {
    id: string;
    name: string;
    warehouseId?: string;
    userId?: string;
    salesRepId?: string;
    openingBalance?: number;
    currentBalance?: number;
}

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  total: number;
  paidAmount?: number;
  warehouseId?: string;
}

/**
 * مكون `PaymentForm` المسئول عن نموذج إضافة دفعة
 */
const PaymentForm = ({ onSave, suppliers, cashAccounts, purchaseInvoices, supplierPayments, purchaseReturns }: { onSave: (data: Omit<SupplierPayment, 'id' | 'receiptNumber'>) => void, suppliers: Supplier[], cashAccounts: CashAccount[], purchaseInvoices: PurchaseInvoice[], supplierPayments: any[], purchaseReturns: any[] }) => {
    const [formData, setFormData] = useState<Omit<SupplierPayment, 'id' | 'receiptNumber'>>({ 
        date: new Date().toISOString().split('T')[0], 
        amount: 0, 
        supplierId: "", 
        paidFromAccountId: "", 
        notes: "",
        invoiceId: "" 
    });
    
    // فلترة الخزائن لاستبعاد عهد المناديب (التي تمتلك userId أو salesRepId)
    const branchAndGeneralAccounts = useMemo(() => {
        return cashAccounts.filter(acc => !acc.userId && !acc.salesRepId);
    }, [cashAccounts]);

    const currentSupplierBalance = useMemo(() => {
        if (!formData.supplierId) return 0;
        const supplier = suppliers.find(s => s.id === formData.supplierId);
        if (!supplier) return 0;

        let balance = Number(supplier.openingBalance) || 0;
        
        // إضافة فواتير الشراء (مديونية للمورد)
        purchaseInvoices.filter(inv => inv.supplierId === formData.supplierId)
            .forEach(inv => {
                balance += (Number(inv.total) - Number(inv.paidAmount || 0));
            });

        // طرح المدفوعات غير المرتبطة بفواتير (التي سجلت كسندات صرف عامة)
        supplierPayments.filter(p => p.supplierId === formData.supplierId && !p.invoiceId)
            .forEach(p => {
                balance -= Number(p.amount);
            });

        // طرح المرتجعات (تخفض المديونية)
        purchaseReturns.filter(r => r.supplierId === formData.supplierId)
            .forEach(r => {
                balance -= (Number(r.total) - Number(r.paidAmount || 0));
            });

        return balance;
    }, [formData.supplierId, suppliers, purchaseInvoices, supplierPayments, purchaseReturns]);

    const supplierOptions = React.useMemo(() => suppliers.map((s: Supplier) => ({ 
        value: s.id, 
        label: s.name 
    })), [suppliers]);
    
    const [availableCashAccounts, setAvailableCashAccounts] = useState(branchAndGeneralAccounts);
    
    const cashAccountOptions = React.useMemo(() => availableCashAccounts.map((c: CashAccount) => ({ 
        value: c.id, 
        label: `${c.name} (المتاح: ${c.currentBalance?.toLocaleString() || 0})` 
    })), [availableCashAccounts]);

    const supplierInvoicesWithBalance = useMemo(() => {
        if (!formData.supplierId) return [];
        return purchaseInvoices.filter((inv: PurchaseInvoice) => {
            if (inv.supplierId !== formData.supplierId) return false;
            const remaining = inv.total - (inv.paidAmount || 0);
            return remaining > 0;
        });
    }, [formData.supplierId, purchaseInvoices]);

    const selectedInvoiceDetails = useMemo(() => {
        if (!formData.invoiceId) return null;
        return supplierInvoicesWithBalance.find((inv: PurchaseInvoice) => inv.id === formData.invoiceId);
    }, [formData.invoiceId, supplierInvoicesWithBalance]);
    
    const invoiceOptions = React.useMemo(() => {
        return supplierInvoicesWithBalance.map((inv: PurchaseInvoice) => ({
            value: inv.id,
            label: `${inv.invoiceNumber} (المتبقي: ${(inv.total - (inv.paidAmount || 0)).toLocaleString()})`
        }));
    }, [supplierInvoicesWithBalance]);
    
    useEffect(() => {
        if (selectedInvoiceDetails?.warehouseId) {
            // إذا تم اختيار فاتورة، نبحث عن خزينة الفرع المرتبط بها أولاً
            const branchCashAccount = branchAndGeneralAccounts.find((acc: CashAccount) => acc.warehouseId === selectedInvoiceDetails.warehouseId);
            if (branchCashAccount) {
                // نظهر خزينة الفرع كخيار أول ونبقي باقي الخزائن متاحة
                setAvailableCashAccounts([branchCashAccount, ...branchAndGeneralAccounts.filter(acc => acc.id !== branchCashAccount.id)]);
                setFormData(prev => ({...prev, paidFromAccountId: branchCashAccount.id}));
            } else {
                // إذا لم يوجد خزينة للفرع، نظهر كافة الخزائن المتاحة
                setAvailableCashAccounts(branchAndGeneralAccounts);
                setFormData(prev => ({...prev, paidFromAccountId: ''}));
            }
        } else {
             // في حال الدفع العام بدون فاتورة، نظهر كافة الخزائن المتاحة
             setAvailableCashAccounts(branchAndGeneralAccounts);
             setFormData(prev => ({...prev, paidFromAccountId: ''}));
        }
    }, [selectedInvoiceDetails, branchAndGeneralAccounts]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        let notesToSave = formData.notes;
        if(selectedInvoiceDetails) {
            notesToSave = `دفعة لفاتورة شراء رقم ${selectedInvoiceDetails.invoiceNumber}`;
        }
        
        onSave({ ...formData, amount: Number(formData.amount), notes: notesToSave });
        
        setFormData({ 
            date: new Date().toISOString().split('T')[0], 
            amount: 0, 
            supplierId: "", 
            paidFromAccountId: "", 
            notes: "", 
            invoiceId: "" 
        });
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="payment-date">التاريخ</Label>
                    <Input id="payment-date" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="payment-supplier">المورد</Label>
                    <Combobox
                        options={supplierOptions}
                        value={formData.supplierId}
                        onValueChange={v => setFormData({...formData, supplierId: v, invoiceId: ""})}
                        placeholder="اختر موردًا..."
                        emptyMessage="لم يتم العثور على مورد."
                    />
                    {formData.supplierId && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-primary/20 animate-in fade-in slide-in-from-top-1">
                            <Wallet className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">المستحقات الحالية:</span>
                            <Badge variant={currentSupplierBalance > 0 ? "default" : "destructive"} className="text-sm">
                                {Math.abs(currentSupplierBalance).toLocaleString()} ج.م 
                                {currentSupplierBalance > 0 ? " (له)" : currentSupplierBalance < 0 ? " (عليه)" : ""}
                            </Badge>
                        </div>
                    )}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="payment-invoice">ربط بفاتورة شراء (اختياري)</Label>
                    <Combobox
                        options={invoiceOptions}
                        value={formData.invoiceId || ''}
                        onValueChange={v => setFormData({...formData, invoiceId: v})}
                        disabled={!formData.supplierId || supplierInvoicesWithBalance.length === 0}
                        placeholder={!formData.supplierId ? "اختر موردًا أولاً" : "اختياري: اختر فاتورة"}
                        emptyMessage="لا توجد فواتير مستحقة لهذا المورد."
                    />
                </div>
                {selectedInvoiceDetails && (
                     <div className="-mt-2">
                        <p className="text-xs text-muted-foreground text-center">
                            إجمالي الفاتورة: {selectedInvoiceDetails.total.toLocaleString()} | 
                            المدفوع: {(selectedInvoiceDetails.paidAmount || 0).toLocaleString()} | 
                            المتبقي: {(selectedInvoiceDetails.total - (selectedInvoiceDetails.paidAmount || 0)).toLocaleString()}
                        </p>
                    </div>
                )}
                <div className="space-y-2">
                    <Label htmlFor="paid-from">مدفوع من حساب (خزينة/بنك)</Label>
                    <Combobox
                        options={cashAccountOptions}
                        value={formData.paidFromAccountId}
                        onValueChange={v => setFormData({...formData, paidFromAccountId: v})}
                        placeholder="اختر حساب الدفع..."
                        emptyMessage="لا توجد حسابات متاحة."
                        disabled={!availableCashAccounts.length}
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="payment-amount">المبلغ المدفوع</Label>
                    <Input id="payment-amount" type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value as any})} placeholder="أدخل مبلغ الدفعة" required/>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="payment-notes">ملاحظات</Label>
                    <Textarea id="notes" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="أدخل أي ملاحظات (اختياري)" disabled={!!formData.invoiceId} />
                </div>
            </div>
             <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertTitle>القيد المحاسبي المتوقع</AlertTitle>
                <AlertDescription>
                    من ح/ حسابات الموردين (مدين) <br/>
                    إلى ح/ {cashAccounts.find((c: CashAccount) => c.id === formData.paidFromAccountId)?.name || "النقدية"} (دائن)
                </AlertDescription>
            </Alert>
            <div className="flex justify-end mt-4">
                <Button type="submit">
                    <PlusCircle className="ml-2 h-4 w-4" />
                    حفظ الدفعة
                </Button>
            </div>
        </form>
    );
};

export default function SupplierPaymentsPage() {
    const { 
        supplierPayments: payments, 
        suppliers, 
        cashAccounts: rawCashAccounts,
        purchaseInvoices, 
        purchaseReturns,
        dbAction, 
        getNextId,
        customerPayments, salesInvoices, exceptionalIncomes, treasuryTransactions,
        expenses, employeeAdvances, posSales, profitDistributions, payrollRecords,
        loading 
    } = useData();
    const { toast } = useToast();
    const { user } = useAuth();

    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState<SupplierPayment | null>(null);

    // Aggressive Cleanup for Pointer Events
    useEffect(() => {
        const cleanup = () => {
            if (!isDeleteOpen) {
                document.body.style.pointerEvents = 'auto';
                document.body.style.overflow = 'auto';
            }
        };
        cleanup();
        const timer = setTimeout(cleanup, 500);
        return () => clearTimeout(timer);
    }, [isDeleteOpen]);
    
    // حساب الأرصدة الحالية للخزائن
    const cashAccounts: CashAccount[] = useMemo(() => {
        if (loading) return [];
        return rawCashAccounts.map((account: CashAccount) => {
            let balance = account.openingBalance || 0;

            customerPayments.filter((p:any) => p.paidToAccountId === account.id).forEach((p:any) => balance += p.amount);
            salesInvoices.filter((s:any) => s.status === 'approved' && s.paidToAccountId === account.id).forEach((s: any) => {
                const linkedPaymentsTotal = customerPayments.filter(p => p.invoiceId === s.id).reduce((sum, p) => sum + p.amount, 0);
                const initialCash = (s.paidAmount || 0) - linkedPaymentsTotal;
                if (initialCash > 0) balance += initialCash;
            });
            posSales.forEach((s: any) => {
                const targetId = s.paidToAccountId || (account.warehouseId && s.warehouseId === account.warehouseId ? account.id : null);
                if (targetId === account.id) {
                    const linkedPaymentsTotal = customerPayments.filter(p => p.invoiceId === s.id).reduce((sum, p) => sum + p.amount, 0);
                    const initialCash = (s.paidAmount || 0) - linkedPaymentsTotal;
                    if (initialCash > 0) balance += initialCash;
                }
            });
            exceptionalIncomes.filter((i:any) => i.paidToAccountId === account.id).forEach((i:any) => balance += i.amount);
            treasuryTransactions.filter((tx: any) => tx.accountId === account.id && tx.type === 'deposit' && !tx.linkedTransaction).forEach((tx: any) => balance += tx.amount);

            payments.filter((sp: any) => sp.paidFromAccountId === account.id).forEach((sp: any) => balance -= sp.amount);
            purchaseInvoices.filter((p: any) => p.paidFromAccountId === account.id).forEach((p: any) => {
                const linkedPaymentsTotal = payments.filter(sp => sp.invoiceId === p.id).reduce((sum, sp) => sum + sp.amount, 0);
                const initialPaid = (p.paidAmount || 0) - linkedPaymentsTotal;
                if (initialPaid > 0) balance -= initialPaid;
            });
            expenses.filter((ex: any) => ex.paidFromAccountId === account.id).forEach((ex: any) => balance -= ex.amount);
            employeeAdvances.filter((ea: any) => ea.paidFromAccountId === account.id).forEach((ea: any) => balance -= ea.amount);
            profitDistributions.filter((pd: any) => pd.paidFromAccountId === account.id).forEach((pd: any) => balance -= pd.amount);
            treasuryTransactions.filter((tx: any) => tx.accountId === account.id && tx.type === 'withdrawal' && !tx.linkedTransaction).forEach((tx: any) => balance -= tx.amount);
            (payrollRecords || []).filter((pr: any) => pr.paidFromAccountId === account.id).forEach((pr: any) => {
                balance -= pr.payrollData.reduce((sum: number, p: any) => sum + p.netSalary, 0);
            });
            
            return { ...account, currentBalance: balance };
        });
    }, [loading, rawCashAccounts, customerPayments, salesInvoices, exceptionalIncomes, treasuryTransactions, expenses, payments, employeeAdvances, posSales, purchaseInvoices, profitDistributions, payrollRecords]);
    
     const getSupplierName = (supplierId: string) => {
        return suppliers.find((s: Supplier) => s.id === supplierId)?.name || 'غير معروف';
    };

    const getCashAccountName = (accountId: string) => {
        return cashAccounts.find((acc: CashAccount) => acc.id === accountId)?.name || 'غير معروف';
    }

    const handleSave = async (data: Omit<SupplierPayment, 'id' | 'receiptNumber'>) => {
        const account = cashAccounts.find((acc: CashAccount) => acc.id === data.paidFromAccountId);
        if (!account) {
            toast({ variant: "destructive", title: "حدث خطأ", description: "لم يتم العثور على حساب الدفع." });
            return;
        }

        if ((account.currentBalance || 0) < data.amount) {
             toast({ variant: "destructive", title: "رصيد غير كافٍ", description: `رصيد الخزينة "${account.name}" لا يكفي لإتمام هذه العملية.` });
             return;
        }

        try {
            const receiptNumber = `س-م-${await getNextId('supplierPayment')}`;
            
            // Fix: Include current time
            const now = new Date();
            const [year, month, day] = data.date.split('-').map(Number);
            const finalDate = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());

            const newPayment: SupplierPayment = {
                ...data,
                date: finalDate.toISOString(),
                receiptNumber,
                createdById: user?.id,
                createdByName: user?.name,
            };
            await dbAction('supplierPayments', 'add', newPayment);
            
            if (data.invoiceId) {
                const invoice = purchaseInvoices.find((inv: PurchaseInvoice) => inv.id === data.invoiceId);
                if (invoice) {
                    const newPaidAmount = (invoice.paidAmount || 0) + data.amount;
                    await dbAction('purchaseInvoices', 'update', { id: data.invoiceId, data: { paidAmount: newPaidAmount } });
                }
            }

            toast({ title: "تمت الإضافة بنجاح", description: `تم حفظ الدفعة برقم إيصال: ${receiptNumber}` });
        } catch (error) {
            toast({ variant: "destructive", title: "حدث خطأ", description: "فشل الحفظ" });
        }
    };
    
    const handleDelete = async () => {
        if (!paymentToDelete) return;
        try {
            if (paymentToDelete.invoiceId) {
                const invoice = purchaseInvoices.find((inv: PurchaseInvoice) => inv.id === paymentToDelete.invoiceId);
                if (invoice) {
                    const newPaidAmount = (invoice.paidAmount || 0) - paymentToDelete.amount;
                    await dbAction('purchaseInvoices', 'update', { id: paymentToDelete.invoiceId, data: { paidAmount: Math.max(0, newPaidAmount) } });
                }
            }
            await dbAction('supplierPayments', 'remove', { id: paymentToDelete.id! });
            toast({ title: "تم الحذف بنجاح" });
            setIsDeleteOpen(false);
            setPaymentToDelete(null);
        } catch (error) {
            toast({ variant: "destructive", title: "حدث خطأ", description: "فشل الحذف" });
        }
    };

  return (
    <>
      <PageHeader title="مدفوعات الموردين" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-5">
            <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>إضافة دفعة جديدة</CardTitle>
                <CardDescription>سجل الدفعات التي تمت للموردين لتسوية حساباتهم.</CardDescription>
            </CardHeader>
            <CardContent>
                <PaymentForm 
                    onSave={handleSave} 
                    suppliers={suppliers} 
                    cashAccounts={cashAccounts} 
                    purchaseInvoices={purchaseInvoices} 
                    supplierPayments={payments}
                    purchaseReturns={purchaseReturns}
                />
            </CardContent>
            </Card>
            
            <Card className="lg:col-span-3">
                <CardHeader>
                    <CardTitle>سجل المدفوعات</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="w-full overflow-auto border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>المورد</TableHead>
                                        <TableHead>البيان / المرجع</TableHead>
                                        <TableHead>مدفوعة من</TableHead>
                                        <TableHead className="text-center">المبلغ</TableHead>
                                        <TableHead className="text-center w-[100px]">الإجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payments.length > 0 ? payments.map((payment: SupplierPayment) => (
                                        <TableRow key={payment.id}>
                                            <TableCell>
                                                <div className="font-medium">{getSupplierName(payment.supplierId)}</div>
                                                <div className="text-xs text-muted-foreground">{new Date(payment.date).toLocaleDateString('ar-EG')}</div>
                                                <div className="text-[10px] text-muted-foreground">بواسطة: {payment.createdByName || 'غير معروف'}</div>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{payment.notes || 'دفعة عامة'}</TableCell>
                                            <TableCell className="text-xs">{getCashAccountName(payment.paidFromAccountId)}</TableCell>
                                            <TableCell className="text-center font-bold">{payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                            <TableCell className="text-center">
                                                <DropdownMenu modal={false}>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                        <DropdownMenuItem className="text-destructive" onSelect={(e) => {
                                                            e.preventDefault();
                                                            setPaymentToDelete(payment);
                                                            setTimeout(() => setIsDeleteOpen(true), 150);
                                                        }}>
                                                            <Trash2 className="ml-2 h-4 w-4" />
                                                            حذف
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">لا توجد مدفوعات مسجلة.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
                    <AlertDialogDescription>هذا الإجراء سيحذف الدفعة بشكل دائم وسيعيد المديونية لحساب المورد. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsDeleteOpen(false)}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">متابعة الحذف</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </main>
    </>
  );
}
