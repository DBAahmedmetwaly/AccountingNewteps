
"use client";

import React, { useState, useMemo, useEffect } from "react";
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal, Edit, Trash2, Loader2, List } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AddEntityDialog } from "@/components/add-entity-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useData } from "@/contexts/data-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Customer {
  id?: string;
  name: string;
  openingBalance: number;
  creditLimit: number;
  phone?: string;
  address?: string;
  allowCredit?: boolean;
}

const CustomerForm = ({ customer, onSave, onClose, allCustomers, hasInvoices }: { customer?: Customer, onSave: (customer: Customer) => void, onClose: () => void, allCustomers: Customer[], hasInvoices: boolean }) => {
  const [formData, setFormData] = useState<Customer>(
    customer || { name: "", openingBalance: 0, creditLimit: 0, phone: "", address: "", allowCredit: false }
  );
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
     if (!formData.name || !formData.phone?.trim()) {
        toast({
            variant: "destructive",
            title: "بيانات ناقصة",
            description: "يرجى إدخال اسم العميل ورقم الهاتف.",
        });
        return;
    }
    const isPhoneDuplicate = allCustomers.some((c: Customer) => c.phone?.trim() === formData.phone?.trim() && c.id !== customer?.id);
    if (isPhoneDuplicate) {
        toast({
            variant: "destructive",
            title: "رقم هاتف مكرر",
            description: "هذا الرقم مسجل لعميل آخر. يرجى إدخال رقم مختلف.",
        });
        return;
    }

    onSave({
      ...formData,
      openingBalance: Number(formData.openingBalance),
      creditLimit: Number(formData.creditLimit),
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="customer-name" className={hasInvoices ? "text-muted-foreground" : ""}>اسم العميل</Label>
          <Input id="customer-name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} disabled={hasInvoices} className={hasInvoices ? "bg-muted" : ""} />
          {hasInvoices && <p className="text-[10px] text-amber-600 font-semibold">لا يمكن تعديل الاسم لوجود فواتير مرتبطة.</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer-phone">رقم الهاتف</Label>
          <Input id="customer-phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
        </div>
         <div className="space-y-2">
          <Label htmlFor="customer-address">العنوان</Label>
          <Input id="customer-address" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="opening-balance" className={hasInvoices ? "text-muted-foreground" : ""}>رصيد أول المدة</Label>
          <Input id="opening-balance" type="number" value={formData.openingBalance} onChange={(e) => setFormData({...formData, openingBalance: Number(e.target.value)})} disabled={hasInvoices} className={hasInvoices ? "bg-muted" : ""} />
        </div>
         <div className="space-y-2">
          <Label htmlFor="credit-limit">حد الائتمان</Label>
          <Input id="credit-limit" type="number" value={formData.creditLimit} onChange={(e) => setFormData({...formData, creditLimit: Number(e.target.value)})} />
        </div>
        <div className="flex items-center space-x-2 rtl:space-x-reverse pt-2">
            <Switch id="allow-credit" checked={formData.allowCredit} onCheckedChange={(checked: boolean) => setFormData({...formData, allowCredit: checked})} />
            <Label htmlFor="allow-credit" className="cursor-pointer">
                السماح بالبيع الآجل (التقسيط)
            </Label>
        </div>
      </div>
      <div className="flex justify-end pt-4">
        <Button type="submit">حفظ</Button>
      </div>
    </form>
  );
};

export default function CustomersPage() {
  const { customers, salesInvoices, posSales, posReturns, customerPayments, salesReturns, loading, dbAction } = useData();
  const router = useRouter();
  const { toast } = useToast();
  
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Manual cleanup for pointer-events bug
  useEffect(() => {
    if (!isEditOpen) {
        document.body.style.pointerEvents = 'auto';
        document.body.style.overflow = 'auto';
    }
  }, [isEditOpen]);

  const checkHasInvoices = (id: string) => {
    const hasSalesInvoices = (salesInvoices || []).some((inv: any) => inv.customerId === id);
    const hasPosSales = (posSales || []).some((sale: any) => sale.customerId === id);
    const hasReturns = (salesReturns || []).some((ret: any) => ret.customerId === id);
    const hasPosReturns = (posReturns || []).some((ret: any) => ret.customerId === id);
    const hasPayments = (customerPayments || []).some((pay: any) => pay.customerId === id);
    return hasSalesInvoices || hasPosSales || hasReturns || hasPosReturns || hasPayments;
  };

  const customersWithBalance = useMemo(() => {
    return customers.map((customer: Customer) => {
        const approvedSalesInvoices = (salesInvoices || []).filter((s: any) => s.customerId === customer.id && s.status === 'approved');
        const customerPosSales = (posSales || []).filter((s: any) => s.customerId === customer.id);
        const filteredPayments = (customerPayments || []).filter((p: any) => p.customerId === customer.id);
        const filteredReturns = (salesReturns || []).filter((r: any) => r.customerId === customer.id);

        let balance = customer.openingBalance || 0;
        approvedSalesInvoices.forEach((inv: any) => { balance += inv.total; });
        customerPosSales.forEach((sale: any) => { balance += sale.total; });
        approvedSalesInvoices.forEach((inv: any) => { balance -= (inv.paidAmount || 0); });
        customerPosSales.forEach((sale: any) => { balance -= (sale.paidAmount || 0); });
        filteredPayments.forEach((payment: any) => { balance -= payment.amount; });
        filteredReturns.forEach((ret: any) => { balance -= ret.total; });
        
        return { ...customer, currentBalance: balance };
    });
  }, [customers, salesInvoices, posSales, customerPayments, salesReturns]);

  const handleSave = (customer: Customer) => {
    if (customer.id) {
      dbAction('customers', 'update', { id: customer.id, data: customer });
      toast({ title: "تم التحديث بنجاح" });
    } else {
      dbAction('customers', 'add', customer);
      toast({ title: "تمت إضافة العميل بنجاح" });
    }
  };

  const handleDelete = (id: string) => {
    if (checkHasInvoices(id)) {
        toast({
            variant: "destructive",
            title: "لا يمكن الحذف",
            description: "لا يمكن حذف هذا العميل لوجود حركات مالية مرتبطة به. يمكنك تعطيله بدلاً من حذفه.",
        });
        return;
    }
    dbAction('customers', 'remove', { id });
    toast({ title: "تم الحذف بنجاح" });
  };

  return (
    <>
      <PageHeader title="إدارة العملاء">
        <AddEntityDialog
          title="إضافة عميل جديد"
          description="أدخل تفاصيل العميل الجديد هنا."
          triggerButton={
            <Button size="sm" className="gap-1">
              <PlusCircle className="h-4 w-4" />
              إضافة عميل
            </Button>
          }
        >
          {({onClose}) => <CustomerForm onSave={handleSave} onClose={onClose} allCustomers={customers} hasInvoices={false} />}
        </AddEntityDialog>
      </PageHeader>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>العملاء</CardTitle>
            <CardDescription>إدارة العملاء مع حدود الائتمان والأرصدة الحالية.</CardDescription>
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
                                <TableHead>اسم العميل</TableHead>
                                <TableHead className="hidden md:table-cell">الهاتف</TableHead>
                                <TableHead className="text-center">حد الائتمان</TableHead>
                                <TableHead className="text-center">الرصيد الحالي</TableHead>
                                <TableHead className="text-center w-[100px]">الإجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {customersWithBalance.map((customer: any) => (
                                <TableRow key={customer.id}>
                                    <TableCell className="font-medium">{customer.name}</TableCell>
                                    <TableCell className="hidden md:table-cell">{customer.phone || '-'}</TableCell>
                                    <TableCell className="text-center">{customer.creditLimit?.toLocaleString() || '0'}</TableCell>
                                    <TableCell className={cn("text-center font-bold", customer.currentBalance > 0 ? "text-destructive" : "text-primary")}>
                                        {customer.currentBalance.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-center">
                                         <AlertDialog>
                                            <DropdownMenu modal={false}>
                                                <DropdownMenuTrigger asChild>
                                                <Button size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                    <DropdownMenuItem onSelect={() => router.push(`/reports/customer-statement?customerId=${customer.id}`)}>
                                                        <List className="ml-2 h-4 w-4" /> كشف حساب
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onSelect={() => {
                                                        setEditingCustomer(customer);
                                                        setTimeout(() => setIsEditOpen(true), 150);
                                                    }}>
                                                        <Edit className="ml-2 h-4 w-4" /> تعديل
                                                    </DropdownMenuItem>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem className="text-destructive">
                                                            <Trash2 className="ml-2 h-4 w-4" /> حذف
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                                <AlertDialogDescription>هل أنت متأكد من حذف العميل؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(customer.id!)}>متابعة</AlertDialogAction>
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
      </main>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات العميل</DialogTitle>
            <DialogDescription>قم بتحديث بيانات العميل هنا.</DialogDescription>
          </DialogHeader>
          {editingCustomer && (
            <CustomerForm 
                customer={editingCustomer} 
                onSave={handleSave} 
                onClose={() => setIsEditOpen(false)} 
                allCustomers={customers} 
                hasInvoices={checkHasInvoices(editingCustomer.id!)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
