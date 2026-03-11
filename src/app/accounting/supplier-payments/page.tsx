
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
import { PlusCircle, Loader2, MoreHorizontal, Edit, Trash2, Info } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/auth-context';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useData } from '@/contexts/data-provider';
import { Combobox } from '@/components/ui/combobox';

// تعريف واجهات البيانات (Interfaces) لضمان تطابق أنواع البيانات
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
}

interface CashAccount {
    id: string;
    name: string;
    warehouseId?: string;
    openingBalance?: number;
    currentBalance?: number; // Added to check balance
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
 * مكون `PaymentForm`
 * @param {object} props - الخصائص المستلمة.
 * @param {Function} props.onSave - دالة يتم استدعاؤها لحفظ بيانات الدفعة.
 * @param {Supplier[]} props.suppliers - قائمة الموردين.
 * @param {CashAccount[]} props.cashAccounts - قائمة الحسابات النقدية.
 * @param {PurchaseInvoice[]} props.purchaseInvoices - قائمة فواتير الشراء.
 * @returns {JSX.Element} نموذج لإضافة أو تعديل دفعة مورد.
 * هذا المكون مسؤول عن عرض نموذج لإدخال دفعة جديدة لمورد،
 * ويشمل حقول التاريخ، المورد، المبلغ، الحساب المدفوع منه، والملاحظات، مع إمكانية ربط الدفعة بفاتورة شراء.
 */
const PaymentForm = ({ onSave, suppliers, cashAccounts, purchaseInvoices }: { onSave: (data: Omit<SupplierPayment, 'id' | 'receiptNumber'>) => void, suppliers: Supplier[], cashAccounts: CashAccount[], purchaseInvoices: PurchaseInvoice[] }) => {
    // حالة (state) لتخزين بيانات النموذج
    const [formData, setFormData] = useState<Omit<SupplierPayment, 'id' | 'receiptNumber'>>({ 
        date: new Date().toISOString().split('T')[0], 
        amount: 0, 
        supplierId: "", 
        paidFromAccountId: "", 
        notes: "",
        invoiceId: "" 
    });
    
    // `useMemo` لتحسين الأداء عن طريق حساب خيارات الموردين مرة واحدة فقط.
    const supplierOptions = React.useMemo(() => suppliers.map((s: Supplier) => ({ value: s.id, label: s.name })), [suppliers]);
    const [availableCashAccounts, setAvailableCashAccounts] = useState(cashAccounts);
    
    // `useMemo` لحساب خيارات الحسابات النقدية.
    const cashAccountOptions = React.useMemo(() => availableCashAccounts.map((c: CashAccount) => ({ value: c.id, label: `${c.name} (المتاح: ${c.currentBalance?.toLocaleString() || 0})` })), [availableCashAccounts]);

    // `useMemo` لترشيح فواتير المورد المحدد التي لها رصيد متبقي.
    const supplierInvoicesWithBalance = useMemo(() => {
        if (!formData.supplierId) return [];
        return purchaseInvoices.filter((inv: PurchaseInvoice) => {
            if (inv.supplierId !== formData.supplierId) return false;
            const remaining = inv.total - (inv.paidAmount || 0);
            return remaining > 0;
        });
    }, [formData.supplierId, purchaseInvoices]);

    // `useMemo` للعثور على تفاصيل الفاتورة المحددة.
    const selectedInvoiceDetails = useMemo(() => {
        if (!formData.invoiceId) return null;
        return supplierInvoicesWithBalance.find((inv: PurchaseInvoice) => inv.id === formData.invoiceId);
    }, [formData.invoiceId, supplierInvoicesWithBalance]);
    
    // `useMemo` لتجهيز خيارات الفواتير لعرضها في الكومبوبوكس.
    const invoiceOptions = React.useMemo(() => {
        return supplierInvoicesWithBalance.map((inv: PurchaseInvoice) => ({
            value: inv.id,
            label: `${inv.invoiceNumber} (المتبقي: ${(inv.total - (inv.paidAmount || 0)).toLocaleString()})`
        }));
    }, [supplierInvoicesWithBalance]);
    
    // `useEffect` لتحديث الحسابات النقدية المتاحة بناءً على الفاتورة المحددة.
    useEffect(() => {
        if (selectedInvoiceDetails?.warehouseId) {
            const branchCashAccount = cashAccounts.find((acc: CashAccount) => acc.warehouseId === selectedInvoiceDetails.warehouseId);
            if (branchCashAccount) {
                setAvailableCashAccounts([branchCashAccount]);
                setFormData(prev => ({...prev, paidFromAccountId: branchCashAccount.id}));
            } else {
                setAvailableCashAccounts(cashAccounts.filter((acc: CashAccount) => !acc.warehouseId)); // Fallback to general accounts
                 setFormData(prev => ({...prev, paidFromAccountId: ''}));
            }
        } else {
             // الدفعات العامة يمكن أن تكون من أي حساب غير مرتبط بفرع
             setAvailableCashAccounts(cashAccounts.filter((acc: CashAccount) => !acc.warehouseId));
             setFormData(prev => ({...prev, paidFromAccountId: ''}));
        }
    }, [selectedInvoiceDetails, cashAccounts]);


    /**
     * دالة `handleSubmit`
     * @param {React.FormEvent} e - كائن الحدث.
     * يتم استدعاؤها عند إرسال النموذج. تقوم بمنع السلوك الافتراضي، واستدعاء دالة الحفظ `onSave`
     * مع تمرير بيانات النموذج، ثم إعادة تعيين النموذج.
     */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        let notesToSave = formData.notes;
        if(selectedInvoiceDetails) {
            notesToSave = `دفعة لفاتورة شراء رقم ${selectedInvoiceDetails.invoiceNumber}`;
        }
        
        onSave({ ...formData, amount: Number(formData.amount), notes: notesToSave });
        
        setFormData({ date: new Date().toISOString().split('T')[0], amount: 0, supplierId: "", paidFromAccountId: "", notes: "", invoiceId: "" });
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
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="payment-invoice">ربط بفاتورة</Label>
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
                    <Label htmlFor="paid-from">مدفوع من</Label>
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
                    <Label htmlFor="payment-amount">المبلغ</Label>
                    <Input id="payment-amount" type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value as any})} placeholder="أدخل مبلغ الدفعة" required/>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="payment-notes">ملاحظات</Label>
                    <Textarea id="payment-notes" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="أدخل أي ملاحظات (اختياري)" disabled={!!formData.invoiceId} />
                </div>
            </div>
             {/* تنبيه يوضح القيد المحاسبي المتوقع */}
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

/**
 * المكون الرئيسي لصفحة مدفوعات الموردين `SupplierPaymentsPage`.
 * هذا المكون يدير حالة الصفحة ويعرض نموذج لإضافة دفعة جديدة وجدول بالدفعات المسجلة.
 * @returns {JSX.Element} واجهة مستخدم كاملة لإدارة مدفوعات الموردين.
 */
export default function SupplierPaymentsPage() {
    // استدعاء السياقات للحصول على البيانات والدوال اللازمة
    const { 
        supplierPayments: payments, 
        suppliers, 
        cashAccounts: rawCashAccounts,
        purchaseInvoices, 
        dbAction, 
        getNextId,
        // Data for balance calculation
        customerPayments, salesInvoices, exceptionalIncomes, treasuryTransactions,
        expenses, employeeAdvances,
        loading 
    } = useData();
    const { toast } = useToast();
    const { user } = useAuth();
    
    // Calculate current balances for cash accounts
    const cashAccounts: CashAccount[] = useMemo(() => {
        if (loading) return [];
        return rawCashAccounts.map((account: CashAccount) => {
            let balance = account.openingBalance || 0;

            customerPayments.forEach((p:any) => { if(p.paidToAccountId === account.id) balance += p.amount });
            salesInvoices.forEach((s: any) => { if (s.status === 'approved' && s.paidToAccountId === account.id) balance += (s.paidAmount || 0) });
            exceptionalIncomes.forEach((i:any) => { if (i.paidToAccountId === account.id) balance += i.amount });
            treasuryTransactions.forEach((tx: any) => { if (tx.accountId === account.id && tx.type === 'deposit') balance += tx.amount });

            expenses.forEach((ex: any) => { if (ex.paidFromAccountId === account.id) balance -= ex.amount });
            payments.forEach((sp: any) => { if (sp.paidFromAccountId === account.id) balance -= sp.amount });
            employeeAdvances.forEach((ea: any) => { if (ea.paidFromAccountId === account.id) balance -= ea.amount });
            treasuryTransactions.forEach((tx: any) => { if (tx.accountId === account.id && tx.type === 'withdrawal') balance -= tx.amount });
            
            return { ...account, currentBalance: balance };
        });
    }, [loading, rawCashAccounts, customerPayments, salesInvoices, exceptionalIncomes, treasuryTransactions, expenses, payments, employeeAdvances]);
    
    /**
     * دالة `getSupplierName`
     * @param {string} supplierId - معرف المورد.
     * @returns {string} اسم المورد أو 'غير معروف'.
     */
     const getSupplierName = (supplierId: string) => {
        return suppliers.find((s: Supplier) => s.id === supplierId)?.name || 'غير معروف';
    };

    /**
     * دالة `getCashAccountName`
     * @param {string} accountId - معرف الحساب النقدي.
     * @returns {string} اسم الحساب أو 'غير معروف'.
     */
    const getCashAccountName = (accountId: string) => {
        return cashAccounts.find((acc: CashAccount) => acc.id === accountId)?.name || 'غير معروف';
    }

    /**
     * دالة `handleSave`
     * @param {Omit<SupplierPayment, 'id' | 'receiptNumber'>} data - بيانات الدفعة الجديدة.
     * دالة غير متزامنة لحفظ دفعة جديدة في قاعدة البيانات.
     * تقوم بإنشاء رقم إيصال فريد، إضافة بيانات المستخدم، ثم حفظ الدفعة.
     * إذا كانت الدفعة مرتبطة بفاتورة، تقوم بتحديث المبلغ المدفوع في الفاتورة.
     */
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
            const newPayment: SupplierPayment = {
                ...data,
                receiptNumber,
                createdById: user?.id,
                createdByName: user?.name,
            };
            await dbAction('supplierPayments', 'add', newPayment);
            
            // تحديث الفاتورة إذا كانت الدفعة مرتبطة بها
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
    
    /**
     * دالة `handleDelete`
     * @param {SupplierPayment} payment - كائن الدفعة المراد حذفها.
     * دالة غير متزامنة لحذف دفعة من قاعدة البيانات.
     * تقوم بعكس تأثير الدفعة على الفاتورة المرتبطة (إن وجدت) ثم تحذف سجل الدفعة.
     */
    const handleDelete = async (payment: SupplierPayment) => {
        try {
             // عكس قيمة الدفعة من الفاتورة المرتبطة
            if (payment.invoiceId) {
                const invoice = purchaseInvoices.find((inv: PurchaseInvoice) => inv.id === payment.invoiceId);
                if (invoice) {
                    const newPaidAmount = (invoice.paidAmount || 0) - payment.amount;
                    await dbAction('purchaseInvoices', 'update', { id: payment.invoiceId, data: { paidAmount: Math.max(0, newPaidAmount) } });
                }
            }
            await dbAction('supplierPayments', 'remove', { id: payment.id! });
            toast({ title: "تم الحذف بنجاح" });
        } catch (error) {
            toast({ variant: "destructive", title: "حدث خطأ", description: "فشل الحذف" });
        }
    };

  return (
    <>
      <PageHeader title="مدفوعات الموردين" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-5">
            {/* بطاقة نموذج الإضافة */}
            <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>إضافة دفعة جديدة</CardTitle>
                <CardDescription>
                سجل الدفعات التي تمت للموردين لتسوية حساباتهم.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <PaymentForm onSave={handleSave} suppliers={suppliers} cashAccounts={cashAccounts} purchaseInvoices={purchaseInvoices} />
            </CardContent>
            </Card>
            
            {/* بطاقة جدول السجلات */}
            <Card className="lg:col-span-3">
                <CardHeader>
                    <CardTitle>سجل المدفوعات</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* عرض مؤشر تحميل أثناء جلب البيانات */}
                    {loading ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="w-full overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>المورد</TableHead>
                                        <TableHead>البيان / المرجع</TableHead>
                                        <TableHead>مدفوعة من</TableHead>
                                        <TableHead className="text-center">المبلغ</TableHead>
                                        <TableHead className="text-center w-[100px]">الإجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {/* عرض كل دفعة في صف بالجدول */}
                                    {payments.map((payment: SupplierPayment) => (
                                        <TableRow key={payment.id}>
                                            <TableCell>
                                                <div className="font-medium">{getSupplierName(payment.supplierId)}</div>
                                                <div className="text-sm text-muted-foreground">{new Date(payment.date).toLocaleDateString('ar-EG')}</div>
                                                <div className="text-xs text-muted-foreground">بواسطة: {payment.createdByName || 'غير معروف'}</div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{payment.notes || 'دفعة عامة'}</TableCell>
                                            <TableCell>{getCashAccountName(payment.paidFromAccountId)}</TableCell>
                                            <TableCell className="text-center">{payment.amount.toLocaleString()}</TableCell>
                                            <TableCell className="text-center">
                                                {/* قائمة منسدلة تحتوي على إجراءات (حذف) */}
                                                <AlertDialog>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                                <span className="sr-only">قائمة</span>
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                                                    <Trash2 className="ml-2 h-4 w-4" />
                                                                    حذف
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    {/* مربع حوار تأكيد الحذف */}
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                هذا الإجراء سيحذف الدفعة بشكل دائم. إذا كانت الدفعة مرتبطة بفاتورة، فسيتم عكس قيمتها من المبلغ المدفوع في الفاتورة. لا يمكن التراجع عن هذا الإجراء.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(payment)}>متابعة</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
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

    

    