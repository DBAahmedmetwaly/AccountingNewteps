

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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from "@/components/ui/switch";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";


interface Customer {
  id?: string;
  name: string;
  openingBalance: number;
  creditLimit: number;
  phone?: string;
  address?: string;
  allowCredit?: boolean;
}

// Interfaces for balance calculation
interface SaleInvoice { id: string; customerId: string; total: number; paidAmount?: number; status?: 'pending' | 'approved'; }
interface PosSale { id: string; customerId?: string; total: number; paidAmount?: number; }
interface CustomerPayment { id: string; customerId: string; amount: number; }
interface SalesReturn { id: string; customerId: string; total: number; }


const CustomerForm = ({ customer, onSave, onClose, allCustomers }: { customer?: Customer, onSave: (customer: Customer) => void, onClose: () => void, allCustomers: Customer[] }) => {
  const [formData, setFormData] = useState<Customer>(
    customer || { name: "", openingBalance: 0, creditLimit: 0, phone: "", address: "", allowCredit: false }
  );
  const { toast } = useToast();

  const handleSubmit = () => {
     if (!formData.name || !formData.phone?.trim()) {
        toast({
            variant: "destructive",
            title: "بيانات ناقصة",
            description: "يرجى إدخال اسم العميل ورقم الهاتف.",
        });
        return;
    }
    // Check for duplicate phone number
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
    <>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="customer-name">اسم العميل</Label>
          <Input id="customer-name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
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
          <Label htmlFor="opening-balance">رصيد أول المدة</Label>
          <Input id="opening-balance" type="number" value={formData.openingBalance} onChange={(e) => setFormData({...formData, openingBalance: Number(e.target.value)})} />
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
        <Button onClick={handleSubmit}>حفظ</Button>
      </div>
    </>
  );
};


export default function CustomersPage() {
  const { customers, salesInvoices, posSales, customerPayments, salesReturns, loading, dbAction } = useData();
  const router = useRouter();
  
  const customersWithBalance = useMemo(() => {
    return customers.map((customer: Customer) => {
        const approvedSalesInvoices = salesInvoices.filter((s: SaleInvoice) => s.customerId === customer.id && s.status === 'approved');
        const customerPosSales = posSales.filter((s: PosSale) => s.customerId === customer.id);
        const filteredPayments = customerPayments.filter((p: CustomerPayment) => p.customerId === customer.id);
        const filteredReturns = salesReturns.filter((r: SalesReturn) => r.customerId === customer.id);

        let balance = customer.openingBalance || 0;
        
        // Add invoice totals
        approvedSalesInvoices.forEach((inv: SaleInvoice) => { balance += inv.total; });
        customerPosSales.forEach((sale: PosSale) => { balance += sale.total; });

        // Subtract payments
        approvedSalesInvoices.forEach((inv: SaleInvoice) => { balance -= (inv.paidAmount || 0); });
        customerPosSales.forEach((sale: PosSale) => { balance -= (sale.paidAmount || 0); });
        filteredPayments.forEach((payment: CustomerPayment) => { balance -= payment.amount; });

        // Subtract returns
        filteredReturns.forEach((ret: SalesReturn) => { balance -= ret.total; });
        
        return { ...customer, currentBalance: balance };
    });
  }, [customers, salesInvoices, posSales, customerPayments, salesReturns]);


  const handleSave = (customer: Customer) => {
    if (customer.id) {
      dbAction('customers', 'update', { id: customer.id, data: customer });
    } else {
      dbAction('customers', 'add', customer);
    }
  };

  const handleDelete = (id: string) => {
    dbAction('customers', 'remove', { id });
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
          <CustomerForm onSave={handleSave} onClose={() => {}} allCustomers={customers} />
        </AddEntityDialog>
      </PageHeader>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>العملاء</CardTitle>
            <CardDescription>
              إدارة العملاء مع حدود الائتمان والأرصدة الافتتاحية والحالية.
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
                                <TableHead>اسم العميل</TableHead>
                                <TableHead className="hidden md:table-cell">الهاتف</TableHead>
                                <TableHead className="text-center">حد الائتمان</TableHead>
                                <TableHead className="text-center">الرصيد الحالي</TableHead>
                                <TableHead className="text-center">الإجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {customersWithBalance.map((customer: any) => (
                                <TableRow key={customer.id}>
                                    <TableCell className="font-medium">{customer.name}</TableCell>
                                    <TableCell className="hidden md:table-cell">{customer.phone || '-'}</TableCell>
                                    <TableCell className="text-center">{customer.creditLimit?.toLocaleString() || '0'}</TableCell>
                                    <TableCell className={`text-center font-bold ${customer.currentBalance > customer.creditLimit && customer.creditLimit > 0 ? 'text-destructive' : 'text-primary'}`}>
                                        {customer.currentBalance.toLocaleString()}
                                    </TableCell>
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
                                                    <DropdownMenuItem onSelect={() => router.push(`/reports/customer-statement?customerId=${customer.id}`)}>
                                                        <List className="ml-2 h-4 w-4" />
                                                        كشف حساب
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <AddEntityDialog
                                                        title="تعديل العميل"
                                                        description="قم بتحديث تفاصيل العميل هنا."
                                                        triggerButton={
                                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                            <Edit className="ml-2 h-4 w-4" />
                                                            تعديل
                                                            </DropdownMenuItem>
                                                        }
                                                    >
                                                    <CustomerForm customer={customer} onSave={handleSave} onClose={() => {}} allCustomers={customers}/>
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
                                                    هذا الإجراء سيحذف العميل بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
                                                </AlertDialogDescription>
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
    </>
  );
}

    
