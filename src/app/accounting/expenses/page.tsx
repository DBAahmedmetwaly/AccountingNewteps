

"use client";

// استيراد المكونات والأدوات اللازمة
import React, { useState, useEffect, useMemo } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/auth-context';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useData } from '@/contexts/data-provider';
import { Combobox } from '@/components/ui/combobox';


// تعريف قائمة ثابتة بأنواع المصروفات
const EXPENSE_TYPES = [
    "إيجار", "رواتب", "كهرباء ومياه", "مواصلات", "تسويق وإعلان", "صيانة", "مستلزمات مكتبية", "مصروفات حكومية", "أخرى"
];

// تعريف واجهات البيانات (Interfaces) لضمان تطابق أنواع البيانات
interface Expense {
    id?: string;
    date: string;
    amount: number;
    description: string;
    warehouseId?: string;
    expenseType: string;
    paidFromAccountId: string;
    receiptNumber?: string;
    createdById?: string;
    createdByName?: string;
    taxAmount?: number;
    status?: 'paid' | 'pending';
}

interface Warehouse {
    id: string;
    name: string;
}

interface CashAccount {
    id: string;
    name: string;
    warehouseId?: string;
    openingBalance?: number;
    currentBalance?: number;
}
interface PosSale { id: string; warehouseId: string; date: string; payments: { method: string, amount: number }[]; paidAmount?: number; total: number; }

/**
 * مكون `ExpenseForm`
 * @param {object} props - الخصائص المستلمة.
 * @param {Expense} [props.expense] - بيانات المصروف الحالية (للتعديل).
 * @param {Function} props.onSave - دالة يتم استدعاؤها لحفظ بيانات المصروف.
 * @param {Function} props.onClose - دالة لإغلاق الحوار بعد الحفظ.
 * @param {Warehouse[]} props.warehouses - قائمة الفروع (المخازن).
 * @param {CashAccount[]} props.cashAccounts - قائمة الحسابات النقدية مع الرصيد الحالي.
 * @returns {JSX.Element} نموذج لإضافة أو تعديل مصروف.
 * هذا المكون مسؤول عن عرض نموذج لإدخال مصروف جديد، ويشمل حقول التاريخ، النوع، المبلغ، الوصف، وإمكانية تحميله على فرع معين.
 */
const ExpenseForm = ({ expense, onSave, onClose, warehouses, cashAccounts }: { expense?: Expense, onSave: (data: Omit<Expense, 'id'|'receiptNumber'>) => void, onClose: () => void, warehouses: Warehouse[], cashAccounts: CashAccount[] }) => {
    // حالة (state) لتخزين بيانات النموذج
    const [formData, setFormData] = useState<Omit<Expense, 'id'|'receiptNumber'>>(
        expense || { date: new Date().toISOString().split('T')[0], amount: 0, description: "", expenseType: "", paidFromAccountId: "", taxAmount: 0, status: 'paid' }
    );
    
    const [includesTax, setIncludesTax] = useState(!!(expense?.taxAmount && expense.taxAmount > 0));
    const [isPending, setIsPending] = useState(expense?.status === 'pending');

    // حالة لتخزين الحسابات النقدية المتاحة بناءً على الفرع المحدد
    const [availableCashAccounts, setAvailableCashAccounts] = useState(cashAccounts);
    const { toast } = useToast();
    const { user } = useAuth();


    // `useEffect` لتحديث الحسابات النقدية المتاحة عند تغيير الفرع المحدد.
    // إذا تم تحديد فرع، يتم عرض خزينة الفرع فقط (إن وجدت). وإلا، يتم عرض الخزائن العامة.
    useEffect(() => {
        if (formData.warehouseId && formData.warehouseId !== 'none') {
            const branchCashAccount = cashAccounts.find((acc: CashAccount) => acc.warehouseId === formData.warehouseId);
            if (branchCashAccount) {
                setAvailableCashAccounts([branchCashAccount]);
                setFormData(prev => ({...prev, paidFromAccountId: branchCashAccount.id}));
            } else {
                 setAvailableCashAccounts([]);
                 setFormData(prev => ({...prev, paidFromAccountId: ''}));
                 toast({variant: 'destructive', title: 'لا توجد خزينة', description: 'هذا الفرع لا يملك خزينة خاصة به.'});
            }
        } else {
            // المصروفات العامة يمكن دفعها من أي حساب غير مرتبط بفرع
            setAvailableCashAccounts(cashAccounts.filter((acc: CashAccount) => !acc.warehouseId));
             setFormData(prev => ({...prev, paidFromAccountId: ''}));
        }
    }, [formData.warehouseId, cashAccounts, toast]);

    useEffect(() => {
        if (includesTax && formData.amount) {
            const tax = formData.amount - (formData.amount / 1.14);
            setFormData(prev => ({ ...prev, taxAmount: tax }));
        } else {
            setFormData(prev => ({ ...prev, taxAmount: 0 }));
        }
    }, [formData.amount, includesTax]);


    /**
     * دالة `handleSubmit`
     * @param {React.FormEvent} e - كائن الحدث.
     * يتم استدعاؤها عند إرسال النموذج. تقوم بمنع السلوك الافتراضي، واستدعاء دالة الحفظ `onSave`
     * مع تمرير بيانات النموذج، ثم إعادة تعيين النموذج وإغلاق الحوار.
     */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ ...formData, amount: Number(formData.amount), status: isPending ? 'pending' : 'paid' });
        if (!expense) { // مسح النموذج فقط عند إضافة جديد
            setFormData({ date: new Date().toISOString().split('T')[0], amount: 0, description: "", expenseType: "", paidFromAccountId: "", taxAmount: 0, status: 'paid' });
            setIncludesTax(false);
            setIsPending(false);
        }
        onClose();
    }
    
    const cashAccountOptions = useMemo(() => {
        return availableCashAccounts.map((acc: CashAccount) => ({
            value: acc.id,
            label: `${acc.name} (المتاح: ${acc.currentBalance?.toLocaleString() || 0})`
        }))
    }, [availableCashAccounts]);
    
     const warehouseOptions = useMemo(() => warehouses.map((w) => ({ value: w.id, label: w.name })), [warehouses]);


    return (
        <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
                 {/* حقول النموذج المختلفة لإدخال البيانات */}
                 <div className="space-y-2">
                    <Label htmlFor="expense-date">التاريخ</Label>
                    <Input id="expense-date" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="expense-type">نوع المصروف</Label>
                    <Select value={formData.expenseType} onValueChange={v => setFormData({...formData, expenseType: v})} required>
                        <SelectTrigger>
                            <SelectValue placeholder="اختر نوع المصروف" />
                        </SelectTrigger>
                        <SelectContent>
                            {EXPENSE_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="expense-amount">المبلغ</Label>
                    <Input id="expense-amount" type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value as any})} placeholder="أدخل مبلغ المصروف" required/>
                </div>
                
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <Switch id="tax-included" checked={includesTax} onCheckedChange={setIncludesTax} />
                    <Label htmlFor="tax-included">شامل ضريبة القيمة المضافة (14%)</Label>
                </div>
                {includesTax && (
                    <div className="text-sm text-muted-foreground">
                        قيمة الضريبة: {formData.taxAmount?.toFixed(2)} ج.م
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="expense-description">الوصف</Label>
                    <Textarea id="expense-description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="أدخل وصفًا للمصروف" required/>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="expense-warehouse">تحميل على</Label>
                    <Combobox
                        options={[{value: 'none', label: 'بدون (عام)'}, ...warehouseOptions]}
                        value={formData.warehouseId || 'none'}
                        onValueChange={v => setFormData({...formData, warehouseId: v})}
                        placeholder="اختياري: اختر فرعًا"
                        emptyMessage="لا يوجد فروع."
                        disabled={user?.warehouseIds?.length === 1 && !user.warehouseIds.includes('all')}
                    />
                </div>
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <Switch id="pay-later" checked={isPending} onCheckedChange={(checked) => {
                        setIsPending(checked);
                        setFormData(prev => ({ ...prev, status: checked ? 'pending' : 'paid' }));
                    }} />
                    <Label htmlFor="pay-later">دفع لاحق (مصروف مستحق)</Label>
                </div>

                 <div className="space-y-2">
                    <Label htmlFor="paid-from">مدفوع من</Label>
                    <Combobox
                        options={cashAccountOptions}
                        value={formData.paidFromAccountId}
                        onValueChange={v => setFormData({...formData, paidFromAccountId: v})}
                        placeholder="اختر حساب الدفع..."
                        emptyMessage="لا توجد حسابات متاحة."
                        disabled={!availableCashAccounts.length || isPending}
                    />
                </div>
            </div>
            <div className="flex justify-end mt-4">
                <Button type="submit">
                    <PlusCircle className="ml-2 h-4 w-4" />
                    حفظ المصروف
                </Button>
            </div>
        </form>
    );
};

const PayExpenseDialog = ({ expense, onConfirm, onClose, cashAccounts }: { expense: Expense, onConfirm: (accountId: string) => void, onClose: () => void, cashAccounts: CashAccount[] }) => {
    const [selectedAccount, setSelectedAccount] = useState('');

    const handleSubmit = () => {
        if (selectedAccount) {
            onConfirm(selectedAccount);
        }
    };

    return (
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>دفع مصروف مستحق</AlertDialogTitle>
                <AlertDialogDescription>
                    اختر الخزينة التي سيتم دفع المصروف منها.
                    <br/>
                    المبلغ: {expense.amount.toLocaleString()} ج.م
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
                <Label>اختر الخزينة</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger>
                        <SelectValue placeholder="اختر الخزينة" />
                    </SelectTrigger>
                    <SelectContent>
                        {cashAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>
                                {acc.name} (الرصيد: {acc.currentBalance?.toLocaleString()})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={onClose}>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleSubmit} disabled={!selectedAccount}>تأكيد الدفع</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    );
};

/**
 * المكون الرئيسي لصفحة المصروفات `ExpensesPage`.
 * هذا المكون يدير حالة الصفحة ويعرض نموذج لإضافة مصروف جديد وجدول بالمصروفات المسجلة.
 * @returns {JSX.Element} واجهة مستخدم كاملة لإدارة المصروفات.
 */
export default function ExpensesPage() {
    const { 
        expenses, warehouses, cashAccounts: rawCashAccounts, 
        customerPayments, salesInvoices, exceptionalIncomes, treasuryTransactions,
        supplierPayments, employeeAdvances, posSales,
        dbAction, getNextId, loading: dataLoading 
    } = useData();

    const { toast } = useToast();
    const { user } = useAuth();
    
    const [payingExpense, setPayingExpense] = useState<Expense | null>(null);

    // Calculate current balances for cash accounts
    const cashAccounts: CashAccount[] = useMemo(() => {
        if (dataLoading) return [];
        return rawCashAccounts.map((account: CashAccount) => {
            let balance = account.openingBalance || 0;

            customerPayments.forEach((p:any) => { if(p.paidToAccountId === account.id) balance += p.amount });
            salesInvoices.forEach((s: any) => { if (s.status === 'approved' && s.paidToAccountId === account.id) balance += (s.paidAmount || 0) });
            exceptionalIncomes.forEach((i:any) => { if (i.paidToAccountId === account.id) balance += i.amount });
            treasuryTransactions.forEach((tx: any) => { if (tx.accountId === account.id && tx.type === 'deposit') balance += tx.amount });
             posSales.forEach((sale: PosSale) => {
                if (account.warehouseId && sale.warehouseId === account.warehouseId) {
                    const totalPaidOnSale = sale.paidAmount ?? sale.payments?.reduce((sum, p) => sum + p.amount, 0) ?? sale.total;
                    balance += totalPaidOnSale;
                }
            });

            expenses.forEach((ex: any) => { if (ex.paidFromAccountId === account.id && ex.status !== 'pending') balance -= ex.amount });
            supplierPayments.forEach((sp: any) => { if (sp.paidFromAccountId === account.id) balance -= sp.amount });
            employeeAdvances.forEach((ea: any) => { if (ea.paidFromAccountId === account.id) balance -= ea.amount });
            treasuryTransactions.forEach((tx: any) => { if (tx.accountId === account.id && tx.type === 'withdrawal') balance -= tx.amount });
            
            return { ...account, currentBalance: balance };
        });
    }, [dataLoading, rawCashAccounts, customerPayments, salesInvoices, exceptionalIncomes, treasuryTransactions, expenses, supplierPayments, employeeAdvances, posSales]);

    const loading = dataLoading;

    /**
     * دالة `getWarehouseName`
     * @param {string} [warehouseId] - معرف الفرع (اختياري).
     * @returns {string} اسم الفرع أو 'عام' أو 'غير معروف'.
     * تبحث عن اسم الفرع في قائمة الفروع باستخدام المعرف.
     */
     const getWarehouseName = (warehouseId?: string) => {
        if (!warehouseId || warehouseId === 'none') return 'عام';
        return warehouses.find((w: Warehouse) => w.id === warehouseId)?.name || 'غير معروف';
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
     * @param {Omit<Expense, 'id' | 'receiptNumber'>} data - بيانات المصروف الجديد.
     * دالة غير متزامنة (async) لحفظ مصروف جديد في قاعدة البيانات.
     * تقوم بإنشاء رقم إيصال فريد، إضافة بيانات المستخدم، ثم استدعاء `dbAction` للحفظ.
     */
    const handleSave = async (data: Omit<Expense, 'id' | 'receiptNumber'>) => {
        
        // Balance Check
        if (data.status !== 'pending') {
            const account = cashAccounts.find((acc: CashAccount) => acc.id === data.paidFromAccountId);
            if (!account) {
                toast({ variant: "destructive", title: "حدث خطأ", description: "لم يتم العثور على حساب الدفع." });
                return;
            }

            if ((account.currentBalance || 0) < data.amount) {
                 toast({ variant: "destructive", title: "رصيد غير كافٍ", description: `رصيد الخزينة "${account.name}" لا يكفي لإتمام هذه العملية.` });
                 return;
            }
        }

        try {
            const receiptNumber = `م-${await getNextId('expense')}`;
            const newExpense: Expense = {
                ...data,
                receiptNumber,
                createdById: user?.id,
                createdByName: user?.name,
            };
            await dbAction('expenses', 'add', newExpense);
            toast({ title: "تمت الإضافة بنجاح", description: `تم تسجيل المصروف برقم إيصال: ${receiptNumber}` });
        } catch (error) {
            toast({ variant: "destructive", title: "حدث خطأ", description: "فشل الحفظ" });
        }
    };
    
    /**
     * دالة `handleDelete`
     * @param {string} id - معرف المصروف المراد حذفه.
     * دالة غير متزامنة (async) لحذف مصروف من قاعدة البيانات.
     */
    const handleDelete = async (id: string) => {
        try {
            await dbAction('expenses', 'remove', { id });
            toast({ title: "تم الحذف بنجاح" });
        } catch (error) {
            toast({ variant: "destructive", title: "حدث خطأ", description: "فشل الحذف" });
        }
    };

    const handlePay = async (accountId: string) => {
        if (!payingExpense) return;
        
        const account = cashAccounts.find(a => a.id === accountId);
        if (!account || (account.currentBalance || 0) < payingExpense.amount) {
             toast({ variant: "destructive", title: "رصيد غير كافٍ" });
             return;
        }
    
        try {
            await dbAction('expenses', 'update', { 
                id: payingExpense.id, 
                data: { status: 'paid', paidFromAccountId: accountId } 
            });
            toast({ title: "تم دفع المصروف بنجاح" });
            setPayingExpense(null);
        } catch (e) {
            toast({ variant: "destructive", title: "حدث خطأ" });
        }
    };

  return (
    <>
      <PageHeader title="إدارة المصروفات" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <div className="grid gap-6 md:grid-cols-5">
            {/* بطاقة نموذج الإضافة */}
            <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle>إضافة مصروف جديد</CardTitle>
                <CardDescription>
                سجل المصروفات وصنفها وقم بتحميلها على الفروع إن أمكن.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <Loader2 className='animate-spin' /> : <ExpenseForm onSave={handleSave} onClose={()=>{}} warehouses={warehouses} cashAccounts={cashAccounts} />}
                 {/* تنبيه يوضح القيد المحاسبي المتوقع */}
                 <Alert className="mt-4">
                    <Info className="h-4 w-4" />
                    <AlertTitle>القيد المحاسبي المتوقع</AlertTitle>
                    <AlertDescription>
                        من ح/ المصروفات (مدين) <br/>
                        إلى ح/ النقدية أو البنك (دائن)
                    </AlertDescription>
                </Alert>
            </CardContent>
            </Card>
            
            {/* بطاقة جدول السجلات */}
            <Card className="md:col-span-3">
                <CardHeader>
                    <CardTitle>سجل المصروفات</CardTitle>
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
                                        <TableHead>النوع</TableHead>
                                        <TableHead>الوصف</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead>مدفوع من</TableHead>
                                        <TableHead className="text-center">المبلغ</TableHead>
                                        <TableHead className="text-center w-[100px]">الإجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {/* عرض كل مصروف في صف بالجدول */}
                                    {expenses.map((expense: Expense) => (
                                        <TableRow key={expense.id}>
                                            <TableCell>
                                                <div className="font-medium">{expense.expenseType}</div>
                                                <div className="text-sm text-muted-foreground">{new Date(expense.date).toLocaleDateString('ar-EG')}</div>
                                                <div className="text-xs text-muted-foreground">بواسطة: {expense.createdByName || 'غير معروف'}</div>
                                            </TableCell>
                                            <TableCell>{expense.description}</TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                    expense.status === 'pending' 
                                                    ? 'bg-yellow-100 text-yellow-800' 
                                                    : 'bg-green-100 text-green-800'
                                                }`}>
                                                    {expense.status === 'pending' ? 'مستحق (غير مدفوع)' : 'مدفوع'}
                                                </span>
                                            </TableCell>
                                            <TableCell>{getCashAccountName(expense.paidFromAccountId)}</TableCell>
                                            <TableCell className="text-center">{expense.amount.toLocaleString()}</TableCell>
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
                                                            {expense.status === 'pending' && (
                                                                <DropdownMenuItem onSelect={() => setPayingExpense(expense)}>
                                                                    <PlusCircle className="ml-2 h-4 w-4" />
                                                                    دفع المصروف
                                                                </DropdownMenuItem>
                                                            )}
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
                                                                هذا الإجراء سيحذف السجل بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(expense.id!)}>متابعة</AlertDialogAction>
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
        
        {payingExpense && (
            <AlertDialog open={!!payingExpense} onOpenChange={(open) => !open && setPayingExpense(null)}>
                <PayExpenseDialog 
                    expense={payingExpense} 
                    onConfirm={handlePay} 
                    onClose={() => setPayingExpense(null)} 
                    cashAccounts={cashAccounts} 
                />
            </AlertDialog>
        )}
      </main>
    </>
  );
}

    
