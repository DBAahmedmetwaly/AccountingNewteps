
"use client";

import React, { useMemo, useState } from 'react';
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
import { PlusCircle, Loader2, MoreHorizontal, FileText, Search, Eye, Printer } from "lucide-react";
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useData } from '@/contexts/data-provider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';

export default function SalesReturnsListPage() {
  const { salesReturns: returns, customers, warehouses, loading } = useData();
  const router = useRouter();

  const [filters, setFilters] = useState({
    customerId: "all",
    warehouseId: "all",
    fromDate: "",
    toDate: "",
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const customerOptions = useMemo(() => ([{value: 'all', label: 'كل العملاء'}, ...customers.map((c:any) => ({ value: c.id, label: c.name }))]), [customers]);
  const warehouseOptions = useMemo(() => ([{value: 'all', label: 'كل الفروع'}, ...warehouses.map((w:any) => ({ value: w.id, label: w.name }))]), [warehouses]);

  const filteredReturns = useMemo(() => {
    return returns.filter((ret: any) => {
      const retDate = new Date(ret.date);
      const from = filters.fromDate ? new Date(filters.fromDate) : null;
      const to = filters.toDate ? new Date(filters.toDate) : null;

      if (from) from.setHours(0,0,0,0);
      if (to) to.setHours(23,59,59,999);

      if (from && retDate < from) return false;
      if (to && retDate > to) return false;
      if (filters.customerId !== 'all' && ret.customerId !== filters.customerId) return false;
      if (filters.warehouseId !== 'all' && ret.warehouseId !== filters.warehouseId) return false;
      
      return true;
    }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [returns, filters]);

  const getCustomerName = (customerId: string) => {
    return customers.find((c: any) => c.id === customerId)?.name || 'غير معروف';
  }

  const getWarehouseName = (warehouseId: string) => {
    return warehouses.find((w: any) => w.id === warehouseId)?.name || 'غير معروف';
  }

  return (
    <>
      <PageHeader title="سجل مرتجعات المبيعات">
        <Button size="sm" className="gap-1" onClick={() => router.push('/sales/returns/new')}>
          <PlusCircle className="h-4 w-4" />
          إضافة مرتجع جديد
        </Button>
      </PageHeader>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6 printable-area">
        <Card className="no-print">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Search className="h-4 w-4"/> فلاتر البحث</CardTitle></CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label className="text-xs">العميل</Label>
                        <Combobox options={customerOptions} value={filters.customerId} onValueChange={(v) => handleFilterChange("customerId", v)} placeholder="كل العملاء" emptyMessage="لا يوجد عملاء."/>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs">الفرع</Label>
                        <Combobox options={warehouseOptions} value={filters.warehouseId} onValueChange={(v) => handleFilterChange("warehouseId", v)} placeholder="كل الفروع" emptyMessage="لا توجد فروع."/>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs">من تاريخ</Label>
                        <Input type="date" value={filters.fromDate} onChange={(e) => handleFilterChange("fromDate", e.target.value)} className="h-9"/>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs">إلى تاريخ</Label>
                        <Input type="date" value={filters.toDate} onChange={(e) => handleFilterChange("toDate", e.target.value)} className="h-9" />
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>قائمة المرتجعات المسجلة</CardTitle>
            <CardDescription>
              عرض وتتبع جميع عمليات إرجاع البضاعة من العملاء.
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
                    <TableRow className="bg-muted/50">
                      <TableHead>رقم المرتجع</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>الفرع</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead className="text-center">إجمالي القيمة</TableHead>
                      <TableHead className="text-center w-[100px]">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReturns.length > 0 ? (
                      filteredReturns.map((sreturn: any) => (
                        <TableRow key={sreturn.id}>
                          <TableCell className="font-mono font-bold text-destructive">{sreturn.receiptNumber || sreturn.id.slice(-6).toUpperCase()}</TableCell>
                          <TableCell className="font-medium">{getCustomerName(sreturn.customerId)}</TableCell>
                          <TableCell className="text-xs">{getWarehouseName(sreturn.warehouseId)}</TableCell>
                          <TableCell className="text-xs">{new Date(sreturn.date).toLocaleDateString('ar-EG')}</TableCell>
                          <TableCell className="text-center font-bold">{sreturn.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-center">
                             <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button aria-haspopup="true" size="icon" variant="ghost">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                    <DropdownMenuItem>
                                        <Eye className="ml-2 h-4 w-4 text-blue-500"/> عرض التفاصيل
                                    </DropdownMenuItem>
                                     <DropdownMenuItem>
                                        <Printer className="ml-2 h-4 w-4"/> طباعة
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                          لا توجد مرتجعات مسجلة تطابق الفلاتر.
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
