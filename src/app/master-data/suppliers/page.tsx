
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Supplier {
  id?: string;
  name: string;
  contact: string;
  openingBalance: number;
  items?: string[];
}

const SupplierItemsDialog = ({ supplier, allItems }: { supplier: Supplier | null, allItems: any[] }) => {
    if (!supplier) return null;

    const supplierItems = useMemo(() => {
        if (!supplier.items) return [];
        return supplier.items.map(itemId => allItems.find(item => item.id === itemId)).filter(Boolean);
    }, [supplier, allItems]);

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>الأصناف المرتبطة بالمورد: {supplier.name}</DialogTitle>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>اسم الصنف</TableHead>
                            <TableHead>كود الصنف</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {supplierItems.length > 0 ? (
                            supplierItems.map((item: any) => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell className="font-mono">{item.code || 'N/A'}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                                    لا توجد أصناف مرتبطة بهذا المورد بعد.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </DialogContent>
    );
};

const SupplierForm = ({ supplier, onSave, onClose, hasInvoices }: { supplier?: Supplier, onSave: (supplier: Supplier) => void, onClose: () => void, hasInvoices: boolean }) => {
  const [formData, setFormData] = useState<Supplier>(
    supplier || { name: "", contact: "", openingBalance: 0 }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
        ...formData,
        openingBalance: Number(formData.openingBalance),
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="supplier-name" className={cn("text-right", hasInvoices && "text-muted-foreground")}>
            اسم المورد
          </Label>
          <Input id="supplier-name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} disabled={hasInvoices} className={cn("col-span-3", hasInvoices && "bg-muted")} />
          {hasInvoices && <div className="col-start-2 col-span-3 text-[10px] text-amber-600 font-semibold">لا يمكن تعديل الاسم لوجود فواتير مرتبطة.</div>}
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="supplier-contact" className="text-right">جهة الاتصال</Label>
          <Input id="supplier-contact" value={formData.contact} onChange={(e) => setFormData({...formData, contact: e.target.value})} className="col-span-3" />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="opening-balance" className={cn("text-right", hasInvoices && "text-muted-foreground")}>
            رصيد أول المدة
          </Label>
          <Input id="opening-balance" type="number" value={formData.openingBalance} onChange={(e) => setFormData({...formData, openingBalance: e.target.value as any})} disabled={hasInvoices} className={cn("col-span-3", hasInvoices && "bg-muted")} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit">حفظ</Button>
      </div>
    </form>
  );
};

export default function SuppliersPage() {
  const { suppliers, purchaseInvoices, supplierPayments, purchaseReturns, items, loading, dbAction } = useData();
  const { toast } = useToast();
  
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [viewItemsSupplier, setViewItemsSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    if (!isEditOpen) {
        document.body.style.pointerEvents = 'auto';
        document.body.style.overflow = 'auto';
    }
  }, [isEditOpen]);

  const checkHasInvoices = (id: string) => {
    const hasPurchaseInvoices = (purchaseInvoices || []).some((p: any) => p.supplierId === id);
    const hasReturns = (purchaseReturns || []).some((r: any) => r.supplierId === id);
    const hasPayments = (supplierPayments || []).some((pay: any) => pay.supplierId === id);
    return hasPurchaseInvoices || hasReturns || hasPayments;
  };

  const suppliersWithBalance = useMemo(() => {
    return suppliers.map((supplier: Supplier) => {
        const supplierPurchases = (purchaseInvoices || []).filter((p: any) => p.supplierId === supplier.id);
        const filteredPayments = (supplierPayments || []).filter((p: any) => p.supplierId === supplier.id);
        const filteredReturns = (purchaseReturns || []).filter((r: any) => r.supplierId === supplier.id);

        const totalPurchases = supplierPurchases.reduce((acc, p) => acc + p.total, 0);
        const totalPaidOnInvoice = supplierPurchases.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
        const totalSeparatePayments = filteredPayments.reduce((acc, p) => acc + p.amount, 0);
        const totalReturns = filteredReturns.reduce((acc, r) => acc + r.total, 0);

        const currentBalance = (supplier.openingBalance || 0) + totalPurchases - totalPaidOnInvoice - totalSeparatePayments - totalReturns;
        return { ...supplier, currentBalance };
    });
  }, [suppliers, purchaseInvoices, supplierPayments, purchaseReturns]);

  const handleSave = (supplier: Supplier) => {
    if (supplier.id) {
      dbAction('suppliers', 'update', { id: supplier.id, data: supplier });
      toast({ title: "تم التحديث بنجاح" });
    } else {
      dbAction('suppliers', 'add', supplier);
      toast({ title: "تمت إضافة المورد بنجاح" });
    }
  };

  const handleDelete = (id: string) => {
    if (checkHasInvoices(id)) {
        toast({
            variant: "destructive",
            title: "لا يمكن الحذف",
            description: "لا يمكن حذف هذا المورد لوجود حركات شراء مرتبطة به.",
        });
        return;
    }
    dbAction('suppliers', 'remove', { id });
    toast({ title: "تم الحذف بنجاح" });
  };

  return (
    <>
      <PageHeader title="إدارة الموردين">
        <AddEntityDialog
          title="إضافة مورد جديد"
          description="أدخل تفاصيل المورد الجديد هنا."
          triggerButton={
            <Button size="sm" className="gap-1">
              <PlusCircle className="h-4 w-4" />
              إضافة مورد
            </Button>
          }
        >
          {({onClose}) => <SupplierForm onSave={handleSave} onClose={onClose} hasInvoices={false} />}
        </AddEntityDialog>
      </PageHeader>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
          <Card>
            <CardHeader>
              <CardTitle>الموردون</CardTitle>
              <CardDescription>إدارة الموردين والأرصدة المستحقة.</CardDescription>
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
                                  <TableHead>اسم المورد</TableHead>
                                  <TableHead className="hidden sm:table-cell">جهة الاتصال</TableHead>
                                  <TableHead className="text-center">الأصناف</TableHead>
                                  <TableHead className="text-center">الرصيد الحالي</TableHead>
                                  <TableHead className="text-center w-[100px]">الإجراءات</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {suppliersWithBalance.map((supplier: any) => (
                                  <TableRow key={supplier.id}>
                                      <TableCell className="font-medium">{supplier.name}</TableCell>
                                      <TableCell className="hidden sm:table-cell">{supplier.contact}</TableCell>
                                      <TableCell className="text-center">
                                          <Button variant="ghost" size="sm" onClick={() => setViewItemsSupplier(supplier)}>
                                              <List className="h-4 w-4 ml-2" />
                                              <Badge variant="secondary">{supplier.items?.length || 0}</Badge>
                                          </Button>
                                      </TableCell>
                                      <TableCell className="text-center font-bold text-primary">{supplier.currentBalance.toLocaleString()}</TableCell>
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
                                                      <DropdownMenuItem onSelect={() => {
                                                          setEditingSupplier(supplier);
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
                                                  <AlertDialogDescription>هل أنت متأكد من حذف المورد؟</AlertDialogDescription>
                                                  </AlertDialogHeader>
                                                  <AlertDialogFooter>
                                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                                  <AlertDialogAction onClick={() => handleDelete(supplier.id!)}>متابعة</AlertDialogAction>
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
            <DialogTitle>تعديل بيانات المورد</DialogTitle>
            <DialogDescription>قم بتحديث تفاصيل المورد هنا.</DialogDescription>
          </DialogHeader>
          {editingSupplier && (
            <SupplierForm 
                supplier={editingSupplier} 
                onSave={handleSave} 
                onClose={() => setIsEditOpen(false)} 
                hasInvoices={checkHasInvoices(editingSupplier.id!)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewItemsSupplier} onOpenChange={(open) => !open && setViewItemsSupplier(null)}>
          <SupplierItemsDialog supplier={viewItemsSupplier} allItems={items} />
      </Dialog>
    </>
  );
}
