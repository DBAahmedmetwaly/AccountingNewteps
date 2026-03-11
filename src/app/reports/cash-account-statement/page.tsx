

"use client";

import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useData } from "@/contexts/data-provider";
import { Loader2, Printer } from "lucide-react";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Combobox } from "@/components/ui/combobox";
import { useSearchParams } from "next/navigation";
import Link from 'next/link';
import { getLinkForReceipt } from "@/lib/utils";

// Data Interfaces
interface CashAccount { id: string; name: string; openingBalance: number; warehouseId?: string; }
interface SaleInvoice { id: string; invoiceNumber?: string; date: string; paidToAccountId: string; paidAmount: number; createdByName?: string; customerName: string; }
interface PosSale { id: string; invoiceNumber?: string; date: string; payments: { method: string, amount: number }[]; createdByName?: string; customerName: string; warehouseId: string; paidAmount?: number; total: number; }
interface CustomerPayment { id: string; receiptNumber?: string; date: string; paidToAccountId: string; amount: number; notes?: string; customerId: string; createdByName?: string; }
interface ExceptionalIncome { id: string; receiptNumber?: string; date: string; paidToAccountId: string; amount: number; description: string; createdByName?: string; }
interface Expense { id: string; receiptNumber?: string; date: string; paidFromAccountId: string; amount: number; expenseType: string; description: string; createdByName?: string; }
interface SupplierPayment { id: string; receiptNumber?: string; date: string; paidFromAccountId: string; amount: number; notes?: string; supplierId: string; createdByName?: string; }
interface EmployeeAdvance { id: string; receiptNumber?: string; date: string; paidFromAccountId: string; amount: number; employeeId: string; createdByName?: string; }
interface ProfitDistribution { id: string; receiptNumber?: string; date: string; paidFromAccountId: string; amount: number; partnerId: string; createdByName?: string; }
interface TreasuryTransaction { id: string; receiptNumber?: string; date: string; accountId: string; type: 'deposit' | 'withdrawal'; amount: number; description: string; createdByName?: string; linkedTransaction?: boolean; }
interface RepRemittance { id: string; receiptNumber?: string; date: string; toAccountId: string; amount: number; userId: string; createdByName?: string; }
interface Customer { id: string, name: string }
interface Supplier { id: string, name: string }
interface Employee { id: string, name: string }
interface Partner { id: string, name: string }
interface User { id: string, name: string }

export default function CashAccountStatementPage() {
    const searchParams = useSearchParams();
    const [filters, setFilters] = useState({ accountId: "", fromDate: "", toDate: "" });
    const [reportData, setReportData] = useState<any[] | null>(null);
    const [openingBalance, setOpeningBalance] = useState(0);

    const { 
        cashAccounts, salesInvoices, posSales, customerPayments, exceptionalIncomes, expenses, 
        supplierPayments, employeeAdvances, profitDistributions, treasuryTransactions,
        repRemittances,
        users,
        customers, suppliers, employees, partners,
        paymentMethods,
        loading 
    } = useData();

    useEffect(() => {
        const accountIdFromQuery = searchParams.get('accountId');
        if (accountIdFromQuery) {
            setFilters(prev => ({...prev, accountId: accountIdFromQuery}));
        }
    }, [searchParams]);

    const handleGenerateReport = useCallback(() => {
        if (!filters.accountId) return;

        const account = cashAccounts.find((acc: CashAccount) => acc.id === filters.accountId);
        if (!account) return;
        
        let ob = account.openingBalance || 0;
        
        const allTransactions: any[] = [];

        const collectTransactionsBeforeDate = (endDate: Date) => {
            let balance = 0;
            const filter = (t: { date: string }) => new Date(t.date) < endDate;
            
            // Deposits
            salesInvoices.filter((t:any) => t.paidToAccountId === filters.accountId && t.paidAmount > 0 && filter(t)).forEach((t:any) => balance += t.paidAmount);
            posSales.filter((t: any) => filter(t)).forEach((t: any) => {
                if (account.warehouseId && t.warehouseId === account.warehouseId) {
                    const totalPaidOnSale = t.paidAmount ?? t.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) ?? t.total;
                    balance += totalPaidOnSale;
                }
            });
            customerPayments.filter(t => t.paidToAccountId === filters.accountId && filter(t)).forEach(t => balance += t.amount);
            exceptionalIncomes.filter(t => t.paidToAccountId === filters.accountId && filter(t)).forEach(t => balance += t.amount);
            treasuryTransactions.filter(t => t.accountId === filters.accountId && t.type === 'deposit' && filter(t)).forEach(t => balance += t.amount);
            repRemittances.filter(t => t.toAccountId === filters.accountId && filter(t)).forEach(t => balance += t.amount);
            
            // Withdrawals
            expenses.filter(t => t.paidFromAccountId === filters.accountId && filter(t)).forEach(t => balance -= t.amount);
            supplierPayments.filter(t => t.paidFromAccountId === filters.accountId && filter(t)).forEach(t => balance -= t.amount);
            employeeAdvances.filter(t => t.paidFromAccountId === filters.accountId && filter(t)).forEach(t => balance -= t.amount);
            profitDistributions.filter(t => t.paidFromAccountId === filters.accountId && filter(t)).forEach(t => balance -= t.amount);
            treasuryTransactions.filter(t => t.accountId === filters.accountId && t.type === 'withdrawal' && filter(t)).forEach(t => balance -= t.amount);

            return balance;
        };

        if (filters.fromDate) {
            ob += collectTransactionsBeforeDate(new Date(filters.fromDate));
        }
        setOpeningBalance(ob);

        // Collect transactions for the selected period
        const filterPeriod = (t: { date: string }) => {
            const itemDate = new Date(t.date);
            const from = filters.fromDate ? new Date(filters.fromDate) : null;
            const to = filters.toDate ? new Date(filters.toDate) : null;
            if(from) from.setHours(0,0,0,0);
            if(to) to.setHours(23,59,59,999);
            if (from && itemDate < from) return false;
            if (to && itemDate > to) return false;
            return true;
        };

        // Collect transactions for the selected period
        salesInvoices.filter((t: any) => t.paidToAccountId === filters.accountId && t.paidAmount > 0 && filterPeriod(t)).forEach(t => allTransactions.push({ date: t.date, ref: t.invoiceNumber, type: `دفعة من فاتورة بيع للعميل ${t.customerName}`, user: t.createdByName, incoming: t.paidAmount, outgoing: 0 }));
        
        posSales.filter((t: any) => filterPeriod(t)).forEach((t: any) => {
             if (account.warehouseId && t.warehouseId === account.warehouseId) {
                const totalPaidOnSale = t.paidAmount ?? t.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) ?? t.total;
                if(totalPaidOnSale > 0) {
                    allTransactions.push({ date: t.date, ref: t.invoiceNumber, type: `مبيعات نقاط البيع - ${t.customerName || 'عميل نقدي'}`, user: t.cashierName, incoming: totalPaidOnSale, outgoing: 0 });
                }
            }
        });

        customerPayments.filter(t => t.paidToAccountId === filters.accountId && filterPeriod(t)).forEach(t => {
            const customerName = customers.find((c:Customer) => c.id === t.customerId)?.name || '';
            allTransactions.push({ date: t.date, ref: t.receiptNumber, type: `سند قبض من ${customerName}`, user: t.createdByName, incoming: t.amount, outgoing: 0 });
        });
        exceptionalIncomes.filter(t => t.paidToAccountId === filters.accountId && filterPeriod(t)).forEach(t => allTransactions.push({ date: t.date, ref: t.receiptNumber, type: `دخل استثنائي: ${t.description}`, user: t.createdByName, incoming: t.amount, outgoing: 0 }));
        treasuryTransactions.filter(t => t.accountId === filters.accountId && t.type === 'deposit' && filterPeriod(t)).forEach(t => allTransactions.push({ date: t.date, ref: t.receiptNumber, type: `إيداع: ${t.description}`, user: t.createdByName, incoming: t.amount, outgoing: 0 }));
        repRemittances.filter(t => t.toAccountId === filters.accountId && filterPeriod(t)).forEach(t => {
            const repName = users.find((u:User) => u.id === t.userId)?.name || '';
            allTransactions.push({ date: t.date, ref: t.receiptNumber, type: `توريد من المندوب ${repName}`, user: t.createdByName, incoming: t.amount, outgoing: 0 });
        });

        expenses.filter(t => t.paidFromAccountId === filters.accountId && filterPeriod(t)).forEach(t => allTransactions.push({ date: t.date, ref: t.receiptNumber, type: `مصروف: ${t.expenseType} (${t.description})`, user: t.createdByName, incoming: 0, outgoing: t.amount }));
        supplierPayments.filter(t => t.paidFromAccountId === filters.accountId && filterPeriod(t)).forEach(t => {
            const supplierName = suppliers.find((s:Supplier) => s.id === t.supplierId)?.name || '';
            allTransactions.push({ date: t.date, ref: t.receiptNumber, type: `سند صرف للمورد ${supplierName}`, user: t.createdByName, incoming: 0, outgoing: t.amount });
        });
        employeeAdvances.filter(t => t.paidFromAccountId === filters.accountId && filterPeriod(t)).forEach(t => {
            const employeeName = employees.find((e:Employee) => e.id === t.employeeId)?.name || '';
            allTransactions.push({ date: t.date, ref: t.receiptNumber, type: `سلفة للموظف ${employeeName}`, user: t.createdByName, incoming: 0, outgoing: t.amount });
        });
        profitDistributions.filter(t => t.paidFromAccountId === filters.accountId && filterPeriod(t)).forEach(t => {
            const partnerName = partners.find((p:Partner) => p.id === t.partnerId)?.name || '';
            allTransactions.push({ date: t.date, ref: t.receiptNumber, type: `توزيع أرباح للشريك ${partnerName}`, user: t.createdByName, incoming: 0, outgoing: t.amount });
        });
        treasuryTransactions.filter(t => t.accountId === filters.accountId && t.type === 'withdrawal' && filterPeriod(t)).forEach(t => allTransactions.push({ date: t.date, ref: t.receiptNumber, type: `سحب: ${t.description}`, user: t.createdByName, incoming: 0, outgoing: t.amount }));
        
        allTransactions.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let runningBalance = ob;
        const finalReport = allTransactions.map(tx => {
            runningBalance = runningBalance + tx.incoming - tx.outgoing;
            return { ...tx, balance: runningBalance };
        });

        setReportData(finalReport);
    }, [filters, cashAccounts, salesInvoices, posSales, customerPayments, exceptionalIncomes, expenses, supplierPayments, employeeAdvances, profitDistributions, treasuryTransactions, repRemittances, customers, suppliers, employees, partners, users, paymentMethods]);
    
    useEffect(() => {
        if (filters.accountId) {
            handleGenerateReport();
        }
    }, [filters, handleGenerateReport]);

    const accountOptions = useMemo(() => cashAccounts.map((acc: CashAccount) => ({ value: acc.id, label: acc.name })), [cashAccounts]);

    return (
        <>
            <PageHeader title="كشف حساب الخزينة" />
            <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
                <Card className="no-print">
                    <CardHeader>
                        <CardTitle>فلاتر البحث</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>الخزينة / الحساب البنكي</Label>
                                <Combobox options={accountOptions} value={filters.accountId} onValueChange={(v) => setFilters(prev => ({...prev, accountId: v}))} placeholder="اختر حسابًا..." emptyMessage="لم يتم العثور على حساب." />
                            </div>
                            <div className="space-y-2">
                                <Label>من تاريخ</Label>
                                <Input type="date" value={filters.fromDate} onChange={(e) => setFilters(prev => ({...prev, fromDate: e.target.value}))} />
                            </div>
                            <div className="space-y-2">
                                <Label>إلى تاريخ</Label>
                                <Input type="date" value={filters.toDate} onChange={(e) => setFilters(prev => ({...prev, toDate: e.target.value}))} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {loading && !reportData && (
                     <div className="flex justify-center items-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}


                {reportData && (
                    <Card className="printable-area">
                        <CardHeader className="flex flex-row items-center justify-between border-b mb-4 pb-4">
                            <div>
                                <CardTitle>كشف حساب: {cashAccounts.find((acc: CashAccount) => acc.id === filters.accountId)?.name}</CardTitle>
                                <CardDescription>الفترة من {filters.fromDate || 'البداية'} إلى {filters.toDate || 'اليوم'}</CardDescription>
                            </div>
                            <Button variant="outline" size="icon" onClick={() => window.print()} className="no-print">
                                <Printer className="h-4 w-4" />
                                <span className="sr-only">طباعة</span>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="w-full overflow-auto border rounded-lg">
                                <Table>
                                    <TableHeader><TableRow><TableHead className="min-w-[150px]">التاريخ والوقت</TableHead><TableHead className="min-w-[250px]">البيان</TableHead><TableHead className="min-w-[120px]">بواسطة</TableHead><TableHead className="text-center min-w-[100px]">الوارد</TableHead><TableHead className="text-center min-w-[100px]">الصادر</TableHead><TableHead className="text-center min-w-[120px]">الرصيد</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        <TableRow className="bg-muted/50 font-medium">
                                            <TableCell colSpan={5}>رصيد أول الفترة</TableCell>
                                            <TableCell className="text-center">{openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                        </TableRow>
                                        {reportData.map((tx, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{new Date(tx.date).toLocaleString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                                                <TableCell>
                                                    <Link href={getLinkForReceipt(tx.ref) || '#'} className="hover:underline hover:text-primary">
                                                        {tx.type}
                                                    </Link>
                                                </TableCell>
                                                <TableCell>{tx.user || 'النظام'}</TableCell>
                                                <TableCell className="text-center text-green-600">{tx.incoming > 0 ? tx.incoming.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</TableCell>
                                                <TableCell className="text-center text-destructive">{tx.outgoing > 0 ? tx.outgoing.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}</TableCell>
                                                <TableCell className="text-center font-semibold">{tx.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow className="bg-muted font-bold text-base">
                                            <TableCell colSpan={5}>الرصيد النهائي</TableCell>
                                            <TableCell className="text-center">{reportData.at(-1)?.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </main>
        </>
    );
}
