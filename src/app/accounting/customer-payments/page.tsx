
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
import { PlusCircle, Loader2, MoreHorizontal, Edit, Trash2, Info, Wallet, AlertTriangle } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/auth-context';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useData } from '@/contexts/data-provider';
import { Combobox } from '@/components/ui/combobox';
import { dictionary } from '@/lib/dictionary';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// تعريف واجهات البيانات (Interfaces) لضمان تطابق أنواع البيانات
interface CustomerPayment {
    id?: string;
    date: string;
    amount: number;
    customerId: string;
    paidToAccountId: string;
    notes?: string;
    receiptNumber?: string;
    createdById?: string;
    createdByName?: string;
    invoiceId?: string;
}

interface Customer {
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
}

interface Warehouse {
    id: string;
    name: string;
}

interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  total: number;
  paidAmount?: number;
  warehouseId?: string;
  status?: 'approved' | 'pending';
}

const d = dictionary.pages.customerPayments;

const PaymentForm = ({ onSave, customers, cashAccounts, salesInvoices, warehouses, customerPayments, salesReturns, posSales, posReturns }: { 
    onSave: (data: Omit<CustomerPayment, 'id' | 'receiptNumber'>) => void, 
    customers: Customer[], 
    cashAccounts: CashAccount[], 
    salesInvoices: SaleInvoice[], 
    warehouses: Warehouse[],
    customerPayments: any[],
    salesReturns: any[],
    posSales: any[],
    posReturns: any[]
}) => {
    const [formData, setFormData] = useState<Omit<CustomerPayment, 'id' | 'receiptNumber'>>({ 
        date: new Date().toISOString().split('T')[0], 
        amount: 0, 
        customerId: "", 
        paidToAccountId: "", 
        notes: "",
        invoiceId: "",
    });
    
    const [availableCashAccounts, setAvailableCashAccounts] = useState<CashAccount[]>([]);
    
    const customerOptions = React.useMemo(() => customers.map((c: Customer) => ({ value: c.id, label: c.name })), [customers]);
    
    const cashAccountOptions = React.useMemo(() => {
        return availableCashAccounts.map((c: CashAccount) => {
            const warehouse = warehouses.find(w => w.id === c.warehouseId);
            const label = warehouse ? `${c.name} (${warehouse.name})` : c.name;
            return { value: c.id, label };
        });
    }, [availableCashAccounts, warehouses]);

    const currentCustomerBalance = useMemo(() => {
        if (!formData.customerId) return 0;
        const customer = customers.find(c => c.id === formData.customerId);
        if (!customer) return 0;

        let balance = Number(customer.openingBalance) || 0;
        
        // إضافة فواتير البيع (الجزء غير المسدد)
        salesInvoices.filter(inv => inv.customerId === formData.customerId && inv.status === 'approved')
            .forEach(inv => {
                balance += (Number(inv.total) - Number(inv.paidAmount || 0));
            });

        // إضافة فواتير الكاشير (الجزء غير المسدد)
        posSales.filter(sale => sale.customerId === formData.customerId)
            .forEach(sale => {
                balance += (Number(sale.total) - Number(sale.paidAmount || 0));
            });

        // طرح سندات القبض غير المرتبطة بفاتورة (لتجنب الخصم المزدوج)
        customerPayments.filter(p => p.customerId === formData.customerId && !p.invoiceId)
            .forEach(p => {
                balance -= Number(p.amount);
            });

        // طرح المرتجعات
        salesReturns.filter(r => r.customerId === formData.customerId)
            .forEach(r => {
                balance -= (Number(r.total) - Number(r.paidAmount || 0));
            });
            
        posReturns.filter(r => r.customerId === formData.customerId)
            .forEach(r => {
                balance -= (Number(r.total) - Number(r.paidAmount || 0));
            });

        return balance;
    }, [formData.customerId, customers, salesInvoices, posSales, customerPayments, salesReturns, posReturns]);

    const customerInvoicesWithBalance = useMemo(() => {
        if (!formData.customerId) return [];
        return salesInvoices.filter((inv: SaleInvoice) => {
            if (inv.customerId !== formData.customerId || inv.status !== 'approved') return false;
            const remaining = inv.total - (inv.paidAmount || 0);
            return remaining > 0.01;
        });
    }, [formData.customerId, salesInvoices]);

    const selectedInvoiceDetails = useMemo(() => {
        if (!formData.invoiceId) return null;
        return customerInvoicesWithBalance.find((inv: SaleInvoice) => inv.id === formData.invoiceId);
    }, [formData.invoiceId, customerInvoicesWithBalance]);
    
    const invoiceOptions = React.useMemo(() => {
        return customerInvoicesWithBalance.map((inv: SaleInvoice) => ({
            value: inv.id,
            label: `${inv.invoiceNumber} (${d.remaining}: ${(inv.total - (inv.paidAmount || 0)).toLocaleString()})`
        }));
    }, [customerInvoicesWithBalance]);
    
    // منطق فلترة الحسابات: استبعاد عهد المناديب دائماً واختيار خزينة الفرع أو العامة
    useEffect(() => {
        const nonRepAccounts = cashAccounts.filter(acc => !acc.userId && !acc.salesRepId);
        let filtered: CashAccount[] = [];

        if (selectedInvoiceDetails?.warehouseId) {
            const branchCashAccount = nonRepAccounts.find((acc: CashAccount) => acc.warehouseId === selectedInvoiceDetails.warehouseId);
            if (branchCashAccount) {
                filtered = [branchCashAccount, ...nonRepAccounts.filter(acc => acc.id !== branchCashAccount.id)];
                setFormData(prev => ({...prev, paidToAccountId: branchCashAccount.id}));
            } else {
                filtered = nonRepAccounts;
            }
        } else {
             filtered = nonRepAccounts;
        }
        
        setAvailableCashAccounts(filtered);
    }, [selectedInvoiceDetails, cashAccounts]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.paidToAccountId) return;
        onSave({ ...formData, amount: Number(formData.amount) });
        setFormData({ date: new Date().toISOString().split('T')[0], amount: 0, customerId: "", paidToAccountId: "", notes: "", invoiceId: "" });
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="payment-date">{dictionary.general.date}</Label>
                    <Input id="payment-date" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="payment-customer">{dictionary.general.customer}</Label>
                    <Combobox
                        options={customerOptions}
                        value={formData.customerId}
                        onValueChange={v => setFormData({...formData, customerId: v, invoiceId: ''})}
                        placeholder={`${dictionary.general.selectPlaceholder} ${dictionary.general.customer}...`}
                        emptyMessage={`${dictionary.general.notFound} ${dictionary.general.customer}.`}
                    />
                    {formData.customerId && (
                        <div className={cn(
                            "flex items-center gap-3 p-4 rounded-lg border animate-in fade-in slide-in-from-top-1",
                            currentCustomerBalance > 0 ? "bg-destructive/10 border-destructive/20" : "bg-green-500/10 border-green-500/20"
                        )}>
                            <Wallet className={cn("h-5 w-5", currentCustomerBalance > 0 ? "text-destructive" : "text-green-600 dark:text-green-400")} />
                            <div className="flex-1">
                                <span className={cn("text-xs font-semibold block mb-1", currentCustomerBalance > 0 ? "text-destructive/80" : "text-green-700 dark:text-green-300")}>
                                    {currentCustomerBalance >= 0 ? "المستحق على العميل:" : "المستحق للعميل (رصيد دائن):"}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className={cn("text-lg font-bold", currentCustomerBalance > 0 ? "text-destructive" : "text-green-700 dark:text-green-400")}>
                                        {Math.abs(currentCustomerBalance).toLocaleString()} ج.م 
                                    </span>
                                    <Badge variant={currentCustomerBalance > 0 ? "destructive" : "default"} className="text-[10px] py-0 h-5">
                                        {currentCustomerBalance > 0 ? "مدين" : "له رصيد"}
                                    </Badge>
                                </div>
                            </div>
                            {currentCustomerBalance < 0 && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <AlertTriangle className="h-5 w-5 text-amber-500 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="max-w-[200px] text-xs text-center">تنبيه: هذا المبلغ مستحق للعميل وليس على العميل. يرجى التأكد قبل التحصيل.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    )}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="payment-invoice">{d.linkToInvoice}</Label>
                    <Combobox
                        options={invoiceOptions}
                        value={formData.invoiceId || ''}
                        onValueChange={v => setFormData({...formData, invoiceId: v})}
                        disabled={!formData.customerId || customerInvoicesWithBalance.length === 0}
                        placeholder={!formData.customerId ? d.selectCustomerFirst : d.optionalLink}
                        emptyMessage={d.noDueInvoices}
                    />
                </div>
                 {selectedInvoiceDetails && (
                     <div className="-mt-2">
                        <p className="text-xs text-muted-foreground text-center">
                            {d.invoiceTotal}: {selectedInvoiceDetails.total.toLocaleString()} | 
                            {d.paid}: {(selectedInvoiceDetails.paidAmount || 0).toLocaleString()} | 
                            {d.remaining}: {(selectedInvoiceDetails.total - (selectedInvoiceDetails.paidAmount || 0)).toLocaleString()}
                        </p>
                    </div>
                )}
                <div className="space-y-2">
                    <Label htmlFor="paid-to">{d.receivedIn} (خزينة الفرع/العامة)</Label>
                    <Combobox
                        options={cashAccountOptions}
                        value={formData.paidToAccountId}
                        onValueChange={v => setFormData({...formData, paidToAccountId: v})}
                        placeholder={availableCashAccounts.length === 0 ? "لا توجد خزينة متاحة" : d.selectReceiveAccount}
                        emptyMessage={d.noAccountFound}
                        disabled={availableCashAccounts.length === 0}
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="payment-amount">{dictionary.general.amount}</Label>
                    <Input id="payment-amount" type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value as any})} placeholder={d.enterPaymentAmount} required/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="payment-notes">{dictionary.general.notes}</Label>
                    <Textarea id="payment-notes" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder={`${dictionary.general.notes} (${dictionary.general.optional})`} />
                </div>
            </div>
             <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertTitle>{d.journalEntry}</AlertTitle>
                <AlertDescription>
                    {d.journalEntryDescDebit.replace('{account}', cashAccounts.find((c: CashAccount) => c.id === formData.paidToAccountId)?.name || d.cash)} <br/>
                    {d.journalEntryDescCredit}
                </AlertDescription>
            </Alert>
            <div className="flex justify-end mt-4">
                <Button type="submit" disabled={!formData.paidToAccountId}>
                    <PlusCircle className="ml-2 h-4 w-4" />
                    {d.savePayment}
                </Button>
            </div>
        </form>
    );
};

export default function CustomerPaymentsPage() {
    const { 
        customerPayments: payments, 
        customers, 
        cashAccounts, 
        salesInvoices, 
        salesReturns,
        posSales,
        posReturns,
        warehouses,
        dbAction, 
        getNextId, 
        loading 
    } = useData();

    const { toast } = useToast();
    const { user } = useAuth();
    
     const getCustomerName = (customerId: string) => {
        return customers.find((c: Customer) => c.id === customerId)?.name || d.unknownCustomer;
    };

    const getCashAccountName = (accountId: string) => {
        return cashAccounts.find((acc: CashAccount) => acc.id === accountId)?.name || d.unknownUser;
    }

    const handleSave = async (data: Omit<CustomerPayment, 'id' | 'receiptNumber'>) => {
        try {
            const receiptNumber = `س-ع-${await getNextId('customerPayment')}`;
            const newPayment: CustomerPayment = {
                ...data,
                receiptNumber,
                createdById: user?.id,
                createdByName: user?.name,
            };
            await dbAction('customerPayments', 'add', newPayment);
             if (data.invoiceId) {
                const invoice = salesInvoices.find((inv: SaleInvoice) => inv.id === data.invoiceId);
                if (invoice) {
                    const newPaidAmount = (invoice.paidAmount || 0) + data.amount;
                    await dbAction('salesInvoices', 'update', { id: data.invoiceId, data: { paidAmount: newPaidAmount } });
                }
            }
            toast({ title: dictionary.general.success, description: `${dictionary.general.receiptNumber}: ${receiptNumber}` });
        } catch (error) {
            toast({ variant: "destructive", title: dictionary.general.error, description: "فشل الحفظ" });
        }
    };
    
    const handleDelete = async (payment: CustomerPayment) => {
        try {
             if (payment.invoiceId) {
                const invoice = salesInvoices.find((inv: SaleInvoice) => inv.id === payment.invoiceId);
                if (invoice) {
                    const newPaidAmount = (invoice.paidAmount || 0) - payment.amount;
                    await dbAction('salesInvoices', 'update', { id: payment.invoiceId, data: { paidAmount: Math.max(0, newPaidAmount) } });
                }
            }
            await dbAction('customerPayments', 'remove', { id: payment.id! });
            toast({ title: dictionary.general.success });
        } catch (error) {
            toast({ variant: "destructive", title: dictionary.general.error, description: "فشل الحذف" });
        }
    };


  return (
    <>
      <PageHeader title={d.title} />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-5">
            <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>{d.addNewPayment}</CardTitle>
                <CardDescription>
                {d.addNewPaymentDesc}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <Loader2 className='animate-spin' /> : (
                    <PaymentForm 
                        onSave={handleSave} 
                        customers={customers} 
                        cashAccounts={cashAccounts} 
                        salesInvoices={salesInvoices} 
                        warehouses={warehouses} 
                        customerPayments={payments}
                        salesReturns={salesReturns}
                        posSales={posSales}
                        posReturns={posReturns}
                    />
                )}
            </CardContent>
            </Card>
            
            <Card className="lg:col-span-3">
                <CardHeader>
                    <CardTitle>{d.paymentsLog}</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="w-full overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{dictionary.general.customer}</TableHead>
                                        <TableHead>{d.receivedIn}</TableHead>
                                        <TableHead className="text-center">{dictionary.general.amount}</TableHead>
                                        <TableHead className="text-center w-[100px]">{dictionary.general.actions}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payments.length > 0 ? (
                                        payments.map((payment : CustomerPayment) => (
                                            <TableRow key={payment.id}>
                                                <TableCell>
                                                    <div className="font-medium">{getCustomerName(payment.customerId)}</div>
                                                    <div className="text-sm text-muted-foreground">{new Date(payment.date).toLocaleDateString('ar-EG')}</div>
                                                    <div className="text-xs text-muted-foreground">{d.byUser.replace('{name}', payment.createdByName || d.unknownUser)}</div>
                                                </TableCell>
                                                <TableCell>{getCashAccountName(payment.paidToAccountId)}</TableCell>
                                                <TableCell className="text-center font-bold">{payment.amount.toLocaleString()}</TableCell>
                                                <TableCell className="text-center">
                                                    <AlertDialog>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                    <span className="sr-only">{d.menu}</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuLabel>{dictionary.general.actions}</DropdownMenuLabel>
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                                                        <Trash2 className="ml-2 h-4 w-4" />
                                                                        {dictionary.general.delete}
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>{dictionary.general.confirmDeleteTitle}</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                {d.deleteConfirmation}
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>{dictionary.general.cancel}</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDelete(payment)}>{dictionary.general.continue}</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">لا توجد مقبوضات مسجلة.</TableCell>
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
