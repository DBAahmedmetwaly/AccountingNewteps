
"use client";

// استيراد المكونات والأدوات اللازمة
import React, { useState, useMemo } from 'react';
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
import { PlusCircle, Loader2, ArrowUpCircle, ArrowDownCircle, Wallet, Landmark, User } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/contexts/auth-context';
import { useData } from '@/contexts/data-provider';


// تعريف واجهات البيانات (Interfaces) لضمان تطابق أنواع البيانات لضمان تطابق أنواع البيانات
interface CashAccount {
    id: string;
    name: string;
    type: 'cash' | 'bank';
    openingBalance: number;
    salesRepId?: string;
    userId?: string;
    warehouseId?: string;
}

interface TreasuryTransaction {
    id?: string;
    date: string;
    amount: number;
    description: string;
    accountId: string;
    type: 'deposit' | 'withdrawal';
    receiptNumber?: string;
    createdById?: string;
    createdByName?: string;
    linkedTransaction?: boolean;
    isPayroll?: boolean;
}

interface Expense { id: string; amount: number; paidFromAccountId: string; expenseType: string; }
interface SupplierPayment { id: string; amount: number; paidFromAccountId: string; invoiceId?: string; }
interface EmployeeAdvance { id: string; amount: number; paidFromAccountId: string; date: string; }
interface CustomerPayment { id: string; amount: number; paidToAccountId: string; invoiceId?: string; }
interface SaleInvoice { id: string; paidAmount?: number; paidToAccountId?: string; status?: 'approved'|'pending' }
interface PosSale { id: string; warehouseId: string; date: string; payments: { method: string, amount: number }[]; paidAmount?: number; total: number; paidToAccountId?: string; }
interface PayrollRecord { id: string; date: string; paidFromAccountId: string; payrollData: { netSalary: number }[] }
interface PurchaseInvoice { id: string; paidAmount?: number; paidFromAccountId?: string; }
interface SalesReturn { id: string; paidAmount?: number; paidFromAccountId?: string; }
interface PurchaseReturn { id: string; paidAmount?: number; paidToAccountId?: string; }
interface PosReturn { id: string; warehouseId: string; paidAmount?: number; }


/**
 * مكون `TransactionForm`
 */
const TransactionForm = ({ onSave, cashAccounts, onClose }: { onSave: (data: Omit<TreasuryTransaction, 'id' | 'receiptNumber'>) => void, cashAccounts: CashAccount[], onClose: () => void }) => {
    const [formData, setFormData] = useState<Omit<TreasuryTransaction, 'id' | 'receiptNumber'>>({
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        description: "",
        accountId: "",
        type: "deposit",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave({ ...formData, amount: Number(formData.amount) });
        setFormData({
            date: new Date().toISOString().split('T')[0],
            amount: 0,
            description: "",
            accountId: "",
            type: "deposit",
        });
        onClose();
    };
    
    const filteredAccounts = cashAccounts.filter((acc: CashAccount) => !acc.salesRepId && !acc.userId);

    return (
        <form onSubmit={handleSubmit}>
            <Tabs defaultValue="deposit" className="w-full" onValueChange={(v) => setFormData({...formData, type: v as any})}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="deposit"><ArrowDownCircle className="ml-2 h-4 w-4" />إيداع (زيادة رأس مال)</TabsTrigger>
                    <TabsTrigger value="withdrawal"><ArrowUpCircle className="ml-2 h-4 w-4" />سحب (مسحوبات شخصية)</TabsTrigger>
                </TabsList>
                 <div className="grid gap-4 py-4 mt-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="tx-date" className="text-right">التاريخ</Label>
                        <Input id="tx-date" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="col-span-3" required/>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="tx-account" className="text-right">الحساب</Label>
                        <Select value={formData.accountId} onValueChange={v => setFormData({...formData, accountId: v})} required>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="اختر الحساب" />
                            </SelectTrigger>
                            <SelectContent>
                            {filteredAccounts.map((acc: CashAccount) => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="tx-amount" className="text-right">المبلغ</Label>
                        <Input id="tx-amount" type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} className="col-span-3" placeholder="أدخل المبلغ" required/>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="tx-description" className="text-right">الوصف</Label>
                        <Textarea id="tx-description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="col-span-3" placeholder="أدخل وصفًا للعملية" required/>
                    </div>
                </div>
                <div className="flex justify-end">
                    <Button type="submit">
                        <PlusCircle className="ml-2 h-4 w-4" />
                        حفظ الحركة
                    </Button>
                </div>
            </Tabs>
        </form>
    );
};

export default function TreasuryPage() {
    const { 
        treasuryTransactions: transactions, 
        cashAccounts: rawCashAccounts,
        expenses, 
        supplierPayments,
        employeeAdvances,
        customerPayments,
        salesInvoices,
        exceptionalIncomes,
        posSales,
        payrollRecords,
        purchaseInvoices,
        profitDistributions,
        salesReturns,
        purchaseReturns,
        posReturns,
        dbAction, 
        getNextId,
        loading
    } = useData();

    const { toast } = useToast();
    const { user } = useAuth();
    
    const getAccountName = (accountId: string) => rawCashAccounts.find((acc: CashAccount) => acc.id === accountId)?.name || 'غير معروف';
    
    const getAccountTypeIcon = (accountId: string) => {
        const account = rawCashAccounts.find((acc: CashAccount) => acc.id === accountId);
        if (!account) return null;
        if (account.salesRepId || account.userId) return <User className="h-4 w-4 text-muted-foreground" />;
        if (account.type === 'bank') return <Landmark className="h-4 w-4 text-muted-foreground" />;
        return <Wallet className="h-4 w-4 text-muted-foreground" />;
    };

    const handleSave = async (data: Omit<TreasuryTransaction, 'id' | 'receiptNumber'>) => {
        try {
            const receiptNumber = `ح-خ-${await getNextId('treasuryTransaction')}`;
            
            // Fix: Include current time
            const now = new Date();
            const selectedDate = new Date(data.date);
            const finalDate = new Date(
                selectedDate.getFullYear(),
                selectedDate.getMonth(),
                selectedDate.getDate(),
                now.getHours(),
                now.getMinutes(),
                now.getSeconds()
            );

            const newTransaction: TreasuryTransaction = {
                ...data,
                date: finalDate.toISOString(),
                receiptNumber,
                createdById: user?.id,
                createdByName: user?.name,
            };
            await dbAction('treasuryTransactions', 'add', newTransaction);
            toast({ title: "تمت إضافة الحركة بنجاح" });
        } catch (error) {
            toast({ variant: "destructive", title: "حدث خطأ", description: "فشل حفظ الحركة" });
        }
    };

    // Corrected Balance Calculation logic to avoid double counting
    const cashAccounts = useMemo(() => {
        return rawCashAccounts.map((account: CashAccount) => {
            let balance = account.openingBalance || 0;

            // --- INFLOWS ---
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
            transactions.filter((tx: any) => tx.accountId === account.id && tx.type === 'deposit' && !tx.linkedTransaction).forEach((tx: any) => balance += tx.amount);
            purchaseReturns.filter((r:any) => r.paidToAccountId === account.id).forEach((r:any) => balance += (r.paidAmount || 0));

            // --- OUTFLOWS ---
            supplierPayments.filter((sp: any) => sp.paidFromAccountId === account.id).forEach((sp: any) => balance -= sp.amount);

            purchaseInvoices.filter((p: any) => p.paidFromAccountId === account.id).forEach((p: any) => {
                const linkedPaymentsTotal = supplierPayments.filter(sp => sp.invoiceId === p.id).reduce((sum, sp) => sum + sp.amount, 0);
                const initialPaid = (p.paidAmount || 0) - linkedPaymentsTotal;
                if (initialPaid > 0) balance -= initialPaid;
            });

            expenses.filter((ex: any) => ex.paidFromAccountId === account.id).forEach((ex: any) => balance -= ex.amount);
            employeeAdvances.filter((ea: any) => ea.paidFromAccountId === account.id).forEach((ea: any) => balance -= ea.amount);
            profitDistributions.filter((pd: any) => pd.paidFromAccountId === account.id).forEach((pd: any) => balance -= pd.amount);
            transactions.filter((tx: any) => tx.accountId === account.id && tx.type === 'withdrawal' && !tx.linkedTransaction).forEach((tx: any) => balance -= tx.amount);
            (payrollRecords || []).filter((pr: any) => pr.paidFromAccountId === account.id).forEach((pr: any) => {
                balance -= pr.payrollData.reduce((sum: number, p: any) => sum + p.netSalary, 0);
            });
            salesReturns.filter((r:any) => r.paidFromAccountId === account.id).forEach((r:any) => balance -= (r.paidAmount || 0));
            posReturns.forEach((r:any) => {
                if (account.warehouseId && r.warehouseId === account.warehouseId) {
                    balance -= (r.paidAmount || 0);
                }
            });

            return { ...account, currentBalance: balance };
        });
    }, [rawCashAccounts, transactions, expenses, supplierPayments, employeeAdvances, customerPayments, salesInvoices, posSales, exceptionalIncomes, payrollRecords, purchaseInvoices, profitDistributions, salesReturns, purchaseReturns, posReturns]);
    
    const sortedTransactions = useMemo(() => {
        return [...transactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions]);


    return (
    <>
      <PageHeader title="إدارة حركة الخزينة" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        
         <Card>
            <CardHeader>
                <CardTitle>أرصدة الحسابات</CardTitle>
                <CardDescription>نظرة سريعة على الأرصدة الحالية في الخزائن والبنوك وعهدات المناديب.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {cashAccounts.map((acc: any) => (
                             <Card key={acc.id} className={(acc.salesRepId || acc.userId) ? 'bg-muted/50' : ''}>
                                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                     <CardTitle className="text-sm font-medium">{acc.name}</CardTitle>
                                     {getAccountTypeIcon(acc.id)}
                                 </CardHeader>
                                 <CardContent>
                                     <div className="text-2xl font-bold">{acc.currentBalance.toLocaleString()} ج.م</div>
                                     <p className="text-xs text-muted-foreground">
                                         رصيد افتتاحي: {acc.openingBalance.toLocaleString()} ج.م
                                     </p>
                                 </CardContent>
                             </Card>
                        ))}
                    </div>
                )}
            </CardContent>
         </Card>

        <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>إضافة حركة جديدة (رأس مال/مسحوبات)</CardTitle>
                <CardDescription>
                سجل عمليات إيداع رأس المال أو سحب الشركاء من الخزائن الرئيسية فقط.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <div className="flex justify-center items-center"><Loader2 className="animate-spin" /></div> : <TransactionForm onSave={handleSave} cashAccounts={rawCashAccounts} onClose={()=>{}} />}
            </CardContent>
            </Card>
            
            <Card className="lg:col-span-3">
                <CardHeader>
                    <CardTitle>سجل حركات رأس المال والمسحوبات</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                         <div className="w-full overflow-auto max-h-96">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>الحساب</TableHead>
                                        <TableHead>البيان</TableHead>
                                        <TableHead className="text-center">النوع</TableHead>
                                        <TableHead className="text-center">المبلغ</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedTransactions.map((tx: any) => (
                                        <TableRow key={tx.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2 font-medium">
                                                    {getAccountTypeIcon(tx.accountId)}
                                                    <span>{getAccountName(tx.accountId)}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString('ar-EG')}</div>
                                            </TableCell>
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={tx.type === 'deposit' ? 'default' : 'destructive'}>
                                                    {tx.type === 'deposit' ? 'إيداع' : 'سحب'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className={`text-center font-semibold ${tx.type === 'deposit' ? 'text-green-600' : 'text-destructive'}`}>
                                                {tx.amount.toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {sortedTransactions.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                                لا توجد حركات مسجلة.
                                            </TableCell>
                                        </TableRow>
                                    )}
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
