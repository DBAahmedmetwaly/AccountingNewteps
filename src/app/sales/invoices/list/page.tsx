"use client";

import React, { useState, useMemo, useRef } from 'react';
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
import { PlusCircle, Loader2, MoreHorizontal, FileText, Undo2, Printer, Eye, Truck, CheckCircle, MessageCircle, Image as ImageIcon } from "lucide-react";
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
import { toPng } from 'html-to-image';


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
  const shareRef = useRef<HTMLDivElement>(null);
  
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

  const [isSharing, setIsSharing] = useState(false);
  const [sharingData, setSharingData] = useState<{ invoice: SaleInvoice, type: 'A4' | 'Thermal' } | null>(null);

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
    
    invoices.filter((inv: any) => inv.customerId === customerId && inv.status === 'approved')
        .forEach((inv: any) => {
            balance += (Number(inv.total) - Number(inv.paidAmount || 0));
        });

    posSales.filter((sale: any) => sale.customerId === customerId)
        .forEach((sale: any) => {
            balance += (Number(sale.total) - Number(sale.paidAmount || 0));
        });

    customerPayments.filter((p: any) => p.customerId === customerId && !p.invoiceId)
        .forEach((p: any) => {
            balance -= Number(p.amount);
        });

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

  const handleShareAsImage = async (invoice: SaleInvoice, type: 'A4' | 'Thermal') => {
    setSharingData({ invoice, type });
    setIsSharing(true);

    // Wait for the hidden component to render
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!shareRef.current) {
        setIsSharing(false);
        setSharingData(null);
        return;
    }

    try {
        const dataUrl = await toPng(shareRef.current, { cacheBust: true, quality: 0.95 });
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `${invoice.invoiceNumber}.png`, { type: blob.type });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: `فاتورة ${invoice.invoiceNumber}`,
                text: `فاتورة مبيعات من ${companySettings.companyName}`,
            });
        } else {
            // Fallback: Download
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `${invoice.invoiceNumber}.png`;
            link.click();
            toast({ title: 'تم التحميل', description: 'تم تحميل صورة الفاتورة لعدم دعم المشاركة المباشرة.' });
        }
    } catch (err) {
        console.error('Sharing failed', err);
        toast({ variant: 'destructive', title: 'فشلت المشاركة', description: 'حدث خطأ أثناء محاولة إنشاء صورة الفاتورة.' });
    } finally {
        setIsSharing(false);
        setSharingData(null);
    }
  };


  return (
    <>
      <PageHeader title="سجل فواتير البيع" />
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
            {loading || isSharing ? (
              <div className="flex flex-col justify-center items-center py-10 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                {isSharing && <p className="text-sm font-semibold animate-pulse">جاري تجهيز صورة الفاتورة للمشاركة...</p>}
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

                                        <DropdownMenuSeparator />
                                        
                                        <DropdownMenuItem onClick={() => handleShareAsImage(invoice, 'A4')}>
                                            <ImageIcon className="ml-2 h-4 w-4 text-primary" /> مشاركة كصورة (A4)
                                        </DropdownMenuItem>
                                        
                                        <DropdownMenuItem onClick={() => handleShareAsImage(invoice, 'Thermal')}>
                                            <ImageIcon className="ml-2 h-4 w-4 text-green-600" /> مشاركة كصورة (إيصال)
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

      {/* عنصر مخفي لتوليد الصور للمشاركة */}
      <div style={{ position: 'fixed', top: '200vh', left: 0, zIndex: -100 }}>
          <div ref={shareRef} className="bg-white">
              {sharingData && (
                  sharingData.type === 'A4' ? (
                      <InvoiceTemplate 
                          invoice={sharingData.invoice} 
                          company={companySettings} 
                          customer={customers.find(c => c.id === sharingData.invoice.customerId)} 
                          customerBalance={calculateCustomerBalance(sharingData.invoice.customerId)}
                      />
                  ) : (
                      <div className="p-4">
                          <PosReceipt 
                              invoice={sharingData.invoice} 
                              company={companySettings} 
                              design={posReceiptDesign}
                              warehouse={warehouses.find(w => w.id === sharingData.invoice.warehouseId)}
                              customer={customers.find(c => c.id === sharingData.invoice.customerId)}
                              customerBalance={calculateCustomerBalance(sharingData.invoice.customerId)}
                          />
                      </div>
                  )
              )}
          </div>
      </div>
    </>
  );
}
