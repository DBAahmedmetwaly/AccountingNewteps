
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
import { PlusCircle, Loader2, MoreHorizontal, FileText, Undo2, Printer, Eye, Truck, FileCheck, MessageCircle } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { InvoiceTemplate } from '@/components/invoice-template';
import { PosReceipt } from '@/components/pos-receipt';
import { Combobox } from '@/components/ui/combobox';


interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId: string;
  customerName: string;
  warehouseId: string;
  total: number;
  paidAmount?: number;
  items: any[];
  isDelivery?: boolean;
  deliveryPersonName?: string;
  subtotal: number;
  discount: number;
  tax?: number;
}
interface Customer { id: string; name: string; openingBalance?: number; }
interface Warehouse { id: string; name: string; }
interface InventoryClosing { id: string; warehouseId: string; closingDate: string; }
interface StockInRecord { id: string; purchaseInvoiceId?: string; }

const InvoiceItemsDialog = ({ items }: { items: any[] }) => (
    <DialogContent>
        <DialogHeader>
            <DialogTitle>تفاصيل أصناف الفاتورة</DialogTitle>
        </DialogHeader>
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>الصنف</TableHead>
                    <TableHead className="text-center">الكمية</TableHead>
                    <TableHead className="text-center">سعر الوحدة</TableHead>
                    <TableHead className="text-center">الإجمالي</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {items && items.map((item, idx) => (
                    <TableRow key={idx}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-center">{item.qty}</TableCell>
                        <TableCell className="text-center">{item.price?.toLocaleString() || '-'}</TableCell>
                        <TableCell className="text-center">{item.total?.toLocaleString() || '-'}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </DialogContent>
)


export default function SalesInvoicesListPage() {
  const { salesInvoices: invoices, customers, warehouses, inventoryClosings, customerPayments, salesReturns, posSales, posReturns, settings, loading } = useData();
  const router = useRouter();
  
  const [filters, setFilters] = useState({
    customerId: "all",
    warehouseId: "all",
    fromDate: new Date().toISOString().split('T')[0],
    toDate: new Date().toISOString().split('T')[0],
  });

  const [printModal, setPrintModal] = useState<{ open: boolean, type: 'A4' | 'Thermal', invoice: SaleInvoice | null }>({
    open: false,
    type: 'A4',
    invoice: null
  });

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const lastClosingDates = useMemo(() => {
    const dates = new Map<string, Date>();
    warehouses.forEach((wh: Warehouse) => {
        const closings = inventoryClosings.filter((c: InventoryClosing) => c.warehouseId === wh.id);
        if (closings.length > 0) {
            const lastDate = new Date(Math.max(...closings.map(c => new Date(c.closingDate).getTime())));
            dates.set(wh.id, lastDate);
        }
    });
    return dates;
  }, [warehouses, inventoryClosings]);
  
  const customerOptions = useMemo(() => ([{value: 'all', label: 'كل العملاء'}, ...customers.map((c:any) => ({ value: c.id, label: c.name }))]), [customers]);
  const warehouseOptions = useMemo(() => ([{value: 'all', label: 'كل الفروع'}, ...warehouses.map((w:any) => ({ value: w.id, label: w.name }))]), [warehouses]);


  const filteredInvoices = useMemo(() => {
    return invoices
      .map((invoice: SaleInvoice) => {
        const lastClosingDate = lastClosingDates.get(invoice.warehouseId);
        const isLocked = lastClosingDate && new Date(invoice.date) <= lastClosingDate;
        return { ...invoice, isLocked };
      })
      .filter((invoice: any) => {
        const invoiceDate = new Date(invoice.date);
        const from = filters.fromDate ? new Date(filters.fromDate) : null;
        const to = filters.toDate ? new Date(filters.toDate) : null;

        if (from && invoiceDate < from) return false;
        if (to && invoiceDate > to) return false;
        if (filters.customerId && filters.customerId !== 'all' && invoice.customerId !== filters.customerId) return false;
        if (filters.warehouseId && filters.warehouseId !== 'all' && invoice.warehouseId !== filters.warehouseId) return false;
        
        return true;
      }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, filters, lastClosingDates]);

  const companySettings = useMemo(() => settings?.main?.general || {}, [settings]);
  const posReceiptDesign = useMemo(() => settings?.main?.posReceipts?.defaultReceiptDesign || {}, [settings]);

  const calculateCustomerBalance = (customerId: string) => {
    const customer = customers.find((c: any) => c.id === customerId);
    if (!customer) return 0;

    let balance = Number(customer.openingBalance) || 0;
    
    // 1. إضافة المبالغ المتبقية من فواتير البيع المعتمدة
    invoices.filter((inv: any) => inv.customerId === customerId && inv.status === 'approved')
        .forEach((inv: any) => {
            balance += (Number(inv.total) - Number(inv.paidAmount || 0));
        });

    // 2. إضافة المبالغ المتبقية من فواتير الكاشير
    posSales.filter((sale: any) => sale.customerId === customerId)
        .forEach((sale: any) => {
            balance += (Number(sale.total) - Number(sale.paidAmount || 0));
        });

    // 3. طرح المدفوعات التي لم يتم ربطها بفاتورة (لأن المرتبطة تم طرحها بالفعل في الخطوات السابقة)
    customerPayments.filter((p: any) => p.customerId === customerId && !p.invoiceId)
        .forEach((p: any) => {
            balance -= Number(p.amount);
        });

    // 4. طرح المرتجعات
    salesReturns.filter((r: any) => r.customerId === customerId)
        .forEach((r: any) => {
            balance -= Number(r.total);
        });
    
    posReturns.filter((r: any) => r.customerId === customerId)
        .forEach((r: any) => {
            balance -= Number(r.total);
        });

    return balance;
  };

  const handlePrint = () => {
    setTimeout(() => window.print(), 100);
  };

  const handleShare = (invoice: SaleInvoice) => {
    const text = `
*فاتورة بيع*
---------------------
*رقم الفاتورة:* ${invoice.invoiceNumber}
*التاريخ:* ${new Date(invoice.date).toLocaleDateString('ar-EG')}
*العميل:* ${invoice.customerName}
*إجمالي الفاتورة:* ${invoice.total.toLocaleString()} ج.م
*المدفوع:* ${invoice.paidAmount?.toLocaleString() || 0} ج.م
*المتبقي من الفاتورة:* ${(invoice.total - (invoice.paidAmount || 0)).toLocaleString()} ج.م
*إجمالي مديونية الحساب:* ${calculateCustomerBalance(invoice.customerId).toLocaleString()} ج.م

شكراً لتعاملكم معنا!
    `;
    const encodedText = encodeURIComponent(text.trim());
    window.open(`https://wa.me/?text=${encodedText}`);
  };


  return (
    <>
      <PageHeader title="سجل فواتير البيع">
        <Button size="sm" className="gap-1" onClick={() => router.push('/sales/invoices')}>
          <PlusCircle className="h-4 w-4" />
          إضافة فاتورة جديدة
        </Button>
      </PageHeader>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Card className="no-print">
            <CardHeader>
                <CardTitle>فلاتر البحث</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                     <div className="space-y-2">
                        <Label>العميل</Label>
                        <Combobox options={customerOptions} value={filters.customerId} onValueChange={(v) => handleFilterChange("customerId", v)} placeholder="اختر عميلاً..." emptyMessage="لم يتم العثور على عميل."/>
                    </div>
                     <div className="space-y-2">
                        <Label>الفرع</Label>
                        <Combobox options={warehouseOptions} value={filters.warehouseId} onValueChange={(v) => handleFilterChange("warehouseId", v)} placeholder="اختر فرعًا..." emptyMessage="لم يتم العثور على فرع."/>
                    </div>
                     <div className="space-y-2">
                        <Label>من تاريخ</Label>
                        <Input type="date" value={filters.fromDate} onChange={(e) => handleFilterChange("fromDate", e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label>إلى تاريخ</Label>
                        <Input type="date" value={filters.toDate} onChange={(e) => handleFilterChange("toDate", e.target.value)} />
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>قائمة فواتير المبيعات</CardTitle>
            <CardDescription>
              عرض وتعديل جميع فواتير المبيعات الصادرة.
            </CardDescription>
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
                      <TableHead>العميل</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>ملاحظات</TableHead>
                      <TableHead className="text-center">الإجمالي</TableHead>
                      <TableHead className="text-center">المدفوع</TableHead>
                      <TableHead className="text-center">المتبقي</TableHead>
                      <TableHead className="text-center w-[100px]">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.length > 0 ? (
                      filteredInvoices.map((invoice:any) => {
                        const paid = invoice.paidAmount || 0;
                        const remaining = invoice.total - paid;
                        const customer = customers.find((c:any) => c.id === invoice.customerId);
                        return (
                           <Dialog key={invoice.id}>
                            <TableRow className={invoice.isLocked ? 'bg-muted/30' : ''}>
                            <TableCell className="font-mono">{invoice.invoiceNumber}</TableCell>
                            <TableCell>{invoice.customerName}</TableCell>
                            <TableCell>{new Date(invoice.date).toLocaleDateString('ar-EG')}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    {invoice.isDelivery ? (
                                        <span className="flex items-center gap-1 text-blue-600"><Truck className="h-4 w-4"/> {invoice.deliveryPersonName || 'دليفري'}</span>
                                    ) : (
                                        <span className="flex items-center gap-1"><FileText className="h-4 w-4"/> {`${invoice.items?.length || 0} أصناف`}</span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold">{invoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-center text-green-600">{paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className={`text-center font-bold ${remaining > 0 ? 'text-destructive' : ''}`}>{remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-center">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">قائمة</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                         <DialogTrigger asChild>
                                            <DropdownMenuItem>
                                                <Eye className="ml-2 h-4 w-4"/>
                                                عرض الأصناف
                                            </DropdownMenuItem>
                                        </DialogTrigger>
                                        
                                        <DropdownMenuItem onSelect={() => setPrintModal({ open: true, type: 'A4', invoice })}>
                                            <Printer className="ml-2 h-4 w-4" /> طباعة A4
                                        </DropdownMenuItem>
                                        
                                        <DropdownMenuItem onSelect={() => setPrintModal({ open: true, type: 'Thermal', invoice })}>
                                            <Printer className="ml-2 h-4 w-4" /> طباعة إيصال (Thermal)
                                        </DropdownMenuItem>

                                        <DropdownMenuItem onClick={() => handleShare(invoice)}>
                                            <MessageCircle className="ml-2 h-4 w-4 text-green-600" /> مشاركة واتساب
                                        </DropdownMenuItem>

                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => router.push(`/sales/returns/new?invoiceId=${invoice.id}`)} disabled={invoice.isLocked}>
                                            <Undo2 className="ml-2 h-4 w-4" />
                                            مرتجع
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                            </TableRow>
                             <InvoiceItemsDialog items={invoice.items} />
                           </Dialog>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                          لا توجد فواتير تطابق الفلاتر المحددة.
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

      {/* حوار الطباعة الموحد */}
      <Dialog open={printModal.open} onOpenChange={(open) => !open && setPrintModal({ ...printModal, open: false })}>
        <DialogContent className={printModal.type === 'A4' ? "max-w-4xl p-0" : "max-w-md p-0"}>
            <DialogHeader className="p-4">
                <DialogTitle>طباعة الفاتورة {printModal.invoice?.invoiceNumber}</DialogTitle>
                <DialogDescription>معاينة الفاتورة بصيغة {printModal.type}.</DialogDescription>
            </DialogHeader>
            <div className="printable-area bg-white text-black max-h-[70vh] overflow-y-auto flex justify-center">
                {printModal.invoice && (
                    printModal.type === 'A4' ? (
                        <InvoiceTemplate 
                            invoice={printModal.invoice} 
                            company={companySettings} 
                            customer={customers.find(c => c.id === printModal.invoice!.customerId)} 
                            customerBalance={calculateCustomerBalance(printModal.invoice!.customerId)}
                        />
                    ) : (
                        <div className="p-4">
                            <PosReceipt 
                                invoice={printModal.invoice} 
                                company={companySettings} 
                                design={posReceiptDesign}
                                warehouse={warehouses.find(w => w.id === printModal.invoice!.warehouseId)}
                                customer={customers.find(c => c.id === printModal.invoice!.customerId)}
                                customerBalance={calculateCustomerBalance(printModal.invoice!.customerId)}
                            />
                        </div>
                    )
                )}
            </div>
            <div className="p-4 border-t flex justify-end no-print">
                <Button onClick={handlePrint}><Printer className="ml-2 h-4 w-4" />طباعة</Button>
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
