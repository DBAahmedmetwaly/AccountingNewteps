
"use client";

import React, { useState, useMemo } from "react";
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
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Supplier {
  id?: string;
  name: string;
  contact: string;
  openingBalance: number;
  items?: string[]; // Array of item IDs
}

// Interfaces for balance calculation
interface PurchaseInvoice { id: string; supplierId: string; total: number; paidAmount?: number; }
interface SupplierPayment { id: string; supplierId: string; amount: number; }
interface PurchaseReturn { id: string; supplierId: string; total: number; }

const SupplierItemsDialog = ({ supplier, allItems }: { supplier: Supplier | null, allItems: any[] }) => {
    if (!supplier) return null;

    const supplierItems = useMemo(() => {
        if (!supplier.items) return [];
        return supplier.items.map(itemId => allItems.find(item => item.id === itemId)).filter(Boolean);
    }, [supplier, allItems]);

    return (
        <UIDialogContent>
            <UIDialogHeader>
                <UIDialogTitle>الأصناف المرتبطة بالمورد: {supplier.name}</UIDialogTitle>
            </UIDialogHeader>
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
        </UIDialogContent>
    );
};


const SupplierForm = ({ supplier, onSave, onClose, hasInvoices }: { supplier?: Supplier, onSave: (supplier: Supplier) => void, onClose: () => void, hasInvoices: boolean }) => {
  const [formData, setFormData] = useState<Supplier>(
    supplier || { name: "", contact: "", openingBalance: 0 }
  );

  const handleSubmit = () => {
    onSave({
        ...formData,
        openingBalance: Number(formData.openingBalance),
    });
    onClose();
  };

  return (
    <>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="supplier-name" className={cn("text-right", hasInvoices && "text-muted-foreground")}>
            اسم المورد
          </Label>
          <Input id="supplier-name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} disabled={hasInvoices} className={cn("col-span-3", hasInvoices && "bg-muted")} />
          {hasInvoices && <div className="col-start-2 col-span-3 text-[10px] text-amber-600 font-semibold">لا يمكن تعديل الاسم لوجود فواتير مرتبطة.</div>}
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="supplier-contact" className="text-right">
            جهة الاتصال
          </Label>
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
        <Button onClick={handleSubmit}>حفظ</Button>
      </div>
    </>
  );
};

// Internal utility function for the file
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}


export default function SuppliersPage() {
  const { suppliers, purchaseInvoices, supplierPayments, purchaseReturns, items, loading, dbAction } = useData();
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const { toast } = useToast();
  
  const checkHasInvoices = (id: string) => {
    const hasPurchaseInvoices = purchaseInvoices.some((p: any) => p.supplierId === id);
    const hasReturns = purchaseReturns.some((r: any) => r.supplierId === id);
    const hasPayments = supplierPayments.some((pay: any) => pay.supplierId === id);
    return hasPurchaseInvoices || hasReturns || hasPayments;
  };

  const suppliersWithBalance = useMemo(() => {
    return suppliers.map((supplier: Supplier) => {
        const supplierPurchases: PurchaseInvoice[] = purchaseInvoices.filter((p: PurchaseInvoice) => p.supplierId === supplier.id);
        const filteredPayments: SupplierPayment[] = supplierPayments.filter((p: SupplierPayment) => p.supplierId === supplier.id);
        const filteredReturns: PurchaseReturn[] = purchaseReturns.filter((r: PurchaseReturn) => r.supplierId === supplier.id);

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
    } else {
      dbAction('suppliers', 'add', supplier);
    }
  };

  const handleDelete = (id: string) => {
    if (checkHasInvoices(id)) {
        toast({
            variant: "destructive",
            title: "لا يمكن الحذف",
            description: "لا يمكن حذف هذا المورد لوجود حركات شراء أو مديونيات مرتبطة به في النظام.",
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
            <Button size="sm" className="gap-1" disabled={loading}>
              <PlusCircle className="h-4 w-4" />
              إضافة مورد
            </Button>
          }
        >
          {({onClose}) => <SupplierForm onSave={handleSave} onClose={onClose} hasInvoices={false} />}
        </AddEntityDialog>
      </PageHeader>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Dialog open={!!selectedSupplier} onOpenChange={(open) => !open && setSelectedSupplier(null)}>
          <Card>
            <CardHeader>
              <CardTitle>الموردون</CardTitle>
              <CardDescription>
                إدارة الموردين مع معلومات الاتصال والأرصدة.
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
                                  <TableHead>اسم المورد</TableHead>
                                  <TableHead className="hidden sm:table-cell">جهة الاتصال</TableHead>
                                  <TableHead className="text-center">الأصناف</TableHead>
                                  <TableHead className="text-center hidden sm:table-cell">رصيد أول المدة</TableHead>
                                  <TableHead className="text-center">الرصيد الحالي</TableHead>
                                  <TableHead className="text-center w-[100px]">الإجراءات</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {suppliersWithBalance.map((supplier: Supplier & {currentBalance: number}) => (
                                  <TableRow key={supplier.id}>
                                      <TableCell className="font-medium">{supplier.name}</TableCell>
                                      <TableCell className="hidden sm:table-cell">{supplier.contact}</TableCell>
                                      <TableCell className="text-center">
                                          <DialogTrigger asChild>
                                              <Button variant="ghost" size="sm" onClick={() => setSelectedSupplier(supplier)}>
                                                  <List className="h-4 w-4 ml-2" />
                                                  <Badge variant="secondary">{supplier.items?.length || 0}</Badge>
                                              </Button>
                                          </DialogTrigger>
                                      </TableCell>
                                      <TableCell className="text-center hidden sm:table-cell">{supplier.openingBalance.toLocaleString()}</TableCell>
                                      <TableCell className="text-center font-bold text-primary">{supplier.currentBalance.toLocaleString()}</TableCell>
                                      <TableCell className="text-center">
                                          <AlertDialog>
                                              <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                  <Button aria-haspopup="true" size="icon" variant="ghost">
                                                      <MoreHorizontal className="h-4 w-4" />
                                                  </Button>
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent align="end">
                                                      <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                      <AddEntityDialog
                                                          title="تعديل المورد"
                                                          description="قم بتحديث تفاصيل المورد هنا."
                                                          triggerButton={
                                                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                              <Edit className="ml-2 h-4 w-4" />
                                                              تعديل
                                                              </DropdownMenuItem>
                                                          }
                                                      >
                                                      {({onClose}) => <SupplierForm supplier={supplier} onSave={handleSave} onClose={onClose} hasInvoices={checkHasInvoices(supplier.id!)} />}
                                                      </AddEntityDialog>
                                                      <AlertDialogTrigger asChild>
                                                          <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                                              <Trash2 className="ml-2 h-4 w-4" />
                                                              حذف
                                                          </DropdownMenuItem>
                                                      </AlertDialogTrigger>
                                                  </DropdownMenuContent>
                                              </DropdownMenu>
                                              <AlertDialogContent>
                                                  <AlertDialogHeader>
                                                  <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                      هذا الإجراء سيحذف المورد بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
                                                  </AlertDialogDescription>
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
          <SupplierItemsDialog supplier={selectedSupplier} allItems={items} />
        </Dialog>
      </main>
    </>
  );
}
