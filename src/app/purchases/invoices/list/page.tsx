
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
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusCircle, Loader2, MoreHorizontal, FileText, Undo2, Printer, FileSearch, Eye, Edit, CheckCircle, MessageCircle } from "lucide-react";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useData } from '@/contexts/data-provider';
import { Combobox } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { InvoiceTemplate } from '@/components/invoice-template';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  total: number;
  items: any[];
}

const InvoiceItemsDialog = ({ items }: { items: any[] }) => (
    <div className="max-h-96 overflow-y-auto mt-4">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>الصنف</TableHead>
                    <TableHead>الباركود</TableHead>
                    <TableHead className="text-center">الكمية</TableHead>
                    <TableHead className="text-center">سعر الشراء</TableHead>
                    <TableHead className="text-center">الإجمالي</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {items && items.map((item, idx) => (
                    <TableRow key={idx}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="font-mono text-xs">{item.code || 'N/A'}</TableCell>
                        <TableCell className="text-center font-bold">{item.qty}</TableCell>
                        <TableCell className="text-center">{item.cost?.toLocaleString() || '-'}</TableCell>
                        <TableCell className="text-center font-semibold">{item.total?.toLocaleString() || '-'}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
)

export default function PurchaseInvoicesListPage() {
  const { purchaseInvoices: invoices, suppliers, warehouses, inventoryClosings, stockInRecords, settings, loading } = useData();
  const router = useRouter();

  const [filters, setFilters] = useState({
    supplierId: "all",
    warehouseId: "all",
    fromDate: "",
    toDate: "",
    receiptStatus: 'all'
  });

  const [selectedInvoiceForItems, setSelectedInvoiceForItems] = useState<any>(null);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const supplierOptions = useMemo(() => ([{value: 'all', label: 'كل الموردين'}, ...suppliers.map((s:any) => ({ value: s.id, label: s.name }))]), [suppliers]);
  const warehouseOptions = useMemo(() => ([{value: 'all', label: 'كل الفروع'}, ...warehouses.map((w:any) => ({ value: w.id, label: w.name }))]), [warehouses]);

  const lastClosingDates = useMemo(() => {
    const dates = new Map<string, Date>();
    warehouses.forEach((wh: any) => {
        const closings = inventoryClosings.filter((c: any) => c.warehouseId === wh.id);
        if (closings.length > 0) {
            const lastDate = new Date(Math.max(...closings.map(c => new Date(c.closingDate).getTime())));
            dates.set(wh.id, lastDate);
        }
    });
    return dates;
  }, [warehouses, inventoryClosings]);

  const receivedInvoiceIds = useMemo(() => {
    return new Set(stockInRecords.filter((rec: any) => rec.purchaseInvoiceId).map((rec: any) => rec.purchaseInvoiceId));
  }, [stockInRecords]);

  const filteredInvoices = useMemo(() => {
    return invoices.map((invoice: any) => {
        const lastClosingDate = lastClosingDates.get(invoice.warehouseId);
        const isLocked = lastClosingDate && new Date(invoice.date) <= lastClosingDate;
        const isReceived = receivedInvoiceIds.has(invoice.id);
        return { ...invoice, isLocked, isReceived };
    })
    .filter((invoice:any) => {
      const invoiceDate = new Date(invoice.date);
      const from = filters.fromDate ? new Date(filters.fromDate) : null;
      const to = filters.toDate ? new Date(filters.toDate) : null;
      if (from) from.setHours(0,0,0,0);
      if (to) to.setHours(23,59,59,999);

      if (from && invoiceDate < from) return false;
      if (to && invoiceDate > to) return false;
      if (filters.supplierId !== 'all' && invoice.supplierId !== filters.supplierId) return false;
      if (filters.warehouseId !== 'all' && invoice.warehouseId !== filters.warehouseId) return false;
      if (filters.receiptStatus === 'received' && !invoice.isReceived) return false;
      if (filters.receiptStatus === 'not_received' && invoice.isReceived) return false;
      
      return true;
    }).sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, filters, lastClosingDates, receivedInvoiceIds]);

  const companySettings = useMemo(() => settings?.main?.general || {}, [settings]);

  const handlePrint = () => {
    window.print();
  };
  
  const handleShare = (invoice: PurchaseInvoice) => {
    const text = `
*فاتورة شراء رقم: ${invoice.invoiceNumber}*
------------------------------------
*المورد:* ${invoice.supplierName}
*التاريخ:* ${new Date(invoice.date).toLocaleDateString('ar-EG')}
*الإجمالي:* ${invoice.total.toLocaleString()} ج.م
------------------------------------
تم الاستلام في: ${warehouses.find(w => w.id === invoice.warehouseId)?.name || 'المستودع'}
    `;
    const encodedText = encodeURIComponent(text.trim());
    window.open(`https://wa.me/?text=${encodedText}`);
  };

  return (
    <>
      <PageHeader title="سجل فواتير الشراء" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Card className="no-print">
            <CardHeader>
                <CardTitle>فلاتر البحث</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                     <div className="space-y-2">
                        <Label>المورد</Label>
                        <Combobox
                          options={supplierOptions}
                          value={filters.supplierId}
                          onValueChange={(v) => handleFilterChange("supplierId", v)}
                          placeholder="اختر المورد..."
                          emptyMessage="لم يتم العثور على مورد."
                        />
                    </div>
                     <div className="space-y-2">
                        <Label>الفرع</Label>
                        <Combobox
                          options={warehouseOptions}
                          value={filters.warehouseId}
                          onValueChange={(v) => handleFilterChange("warehouseId", v)}
                          placeholder="اختر الفرع..."
                          emptyMessage="لم يتم العثور على فرع."
                        />
                    </div>
                     <div className="space-y-2">
                        <Label>من تاريخ</Label>
                        <Input type="date" value={filters.fromDate} onChange={(e) => handleFilterChange("fromDate", e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label>إلى تاريخ</Label>
                        <Input type="date" value={filters.toDate} onChange={(e) => handleFilterChange("toDate", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>حالة الاستلام</Label>
                        <Select value={filters.receiptStatus} onValueChange={(v) => handleFilterChange('receiptStatus', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                <SelectItem value="received">تم الاستلام</SelectItem>
                                <SelectItem value="not_received">لم تستلم</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>قائمة فواتير الشراء</CardTitle>
                <CardDescription>عرض وتتبع فواتير الشراء المسجلة.</CardDescription>
            </div>
            <Button size="sm" className="gap-1 no-print" onClick={() => router.push('/purchases/invoices')}>
                <PlusCircle className="h-4 w-4" />
                فاتورة جديدة
            </Button>
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
                    <TableRow>
                      <TableHead>رقم الفاتورة</TableHead>
                      <TableHead>المورد</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead className="text-center">الإجمالي</TableHead>
                      <TableHead className="text-center w-[100px] no-print">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices && filteredInvoices.length > 0 ? (
                      filteredInvoices.map((invoice:any) => {
                        const isEditable = !invoice.isLocked && !invoice.isReceived;
                        return (
                            <TableRow key={invoice.id} className={cn(!isEditable && 'bg-muted/30')}>
                                <TableCell className="font-mono font-bold">{invoice.invoiceNumber}</TableCell>
                                <TableCell>{invoice.supplierName}</TableCell>
                                <TableCell className="text-xs">{new Date(invoice.date).toLocaleDateString('ar-EG')}</TableCell>
                                <TableCell>
                                    {invoice.isReceived ? (
                                        <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 ml-1"/> تم الاستلام</Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-amber-600 border-amber-200"><FileText className="h-3 w-3 ml-1"/> لم تستلم</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-center font-bold">{invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-center no-print">
                                    <DropdownMenu modal={false}>
                                        <DropdownMenuTrigger asChild>
                                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56">
                                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                            
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <DropdownMenuItem onSelect={e => e.preventDefault()}>
                                                        <Eye className="ml-2 h-4 w-4 text-blue-500" /> عرض الأصناف
                                                    </DropdownMenuItem>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-3xl">
                                                    <DialogHeader>
                                                        <DialogTitle>تفاصيل فاتورة شراء رقم {invoice.invoiceNumber}</DialogTitle>
                                                    </DialogHeader>
                                                    <InvoiceItemsDialog items={invoice.items} />
                                                </DialogContent>
                                            </Dialog>

                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                        <Printer className="ml-2 h-4 w-4" /> عرض / طباعة
                                                    </DropdownMenuItem>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-4xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
                                                    <DialogHeader className="p-4 bg-muted/30">
                                                        <DialogTitle>طباعة الفاتورة {invoice.invoiceNumber}</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="flex-1 overflow-y-auto p-4 bg-white">
                                                        <div className="printable-area bg-white text-black">
                                                            <InvoiceTemplate invoice={invoice} company={companySettings} customer={suppliers.find(s => s.id === invoice.supplierId)} isPurchase={true} />
                                                        </div>
                                                    </div>
                                                    <div className="p-4 border-t flex justify-end gap-2 bg-background no-print">
                                                        <Button onClick={() => handleShare(invoice)} variant="outline" className="bg-green-500 text-white hover:bg-green-600 hover:text-white">
                                                            <MessageCircle className="ml-2 h-4 w-4" /> واتساب
                                                        </Button>
                                                        <Button onClick={handlePrint}><Printer className="ml-2 h-4 w-4" />طباعة</Button>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>

                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => router.push(`/purchases/invoices/${invoice.id}/edit`)} disabled={!isEditable}>
                                                <Edit className="ml-2 h-4 w-4" /> تعديل البيانات
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => router.push(`/reports/supplier-statement?supplierId=${invoice.supplierId}&toDate=${invoice.date}`)}>
                                                <FileSearch className="ml-2 h-4 w-4" /> كشف حساب المورد
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => router.push(`/purchases/returns/new?invoiceId=${invoice.id}`)} disabled={invoice.isLocked}>
                                                <Undo2 className="ml-2 h-4 w-4 text-amber-600" /> إجراء مرتجع
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">
                          لا توجد فواتير مسجلة تطابق الفلاتر المحددة.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
