

"use client";

import React from 'react';
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
import { PlusCircle, Loader2, MoreHorizontal, FileText } from "lucide-react";
import useFirebase from "@/hooks/use-firebase";
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StockOutRecord {
  id: string;
  receiptNumber: string;
  date: string;
  sourceId: string;
  reason: string;
  items: { name: string; qty: number }[];
}

interface Warehouse {
    id: string;
    name: string;
}

export default function StockOutListPage() {
  const { data: stockOutRecords, loading: loadingStockOut } = useFirebase<StockOutRecord>("stockOutRecords");
  const { data: warehouses, loading: loadingWarehouses } = useFirebase<Warehouse>("warehouses");
  const router = useRouter();

  const loading = loadingStockOut || loadingWarehouses;

  const getWarehouseName = (warehouseId: string) => {
    return warehouses.find((w: any) => w.id === warehouseId)?.name || 'غير معروف';
  };
  
  const getReasonLabel = (reason: string) => {
      const reasons: { [key: string]: string } = {
          damaged: 'تالف',
          samples: 'عينات',
          return: 'مرتجع لمورد',
          other: 'أخرى'
      };
      return reasons[reason] || reason;
  }

  return (
    <>
      <PageHeader title="سجل صرف المخزون">
        <Button size="sm" className="gap-1" onClick={() => router.push('/inventory/stock-out/new')}>
          <PlusCircle className="h-4 w-4" />
          إضافة إذن صرف
        </Button>
      </PageHeader>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>قائمة إيصالات الصرف</CardTitle>
            <CardDescription>
              عرض جميع عمليات صرف المخزون التي تمت.
            </CardDescription>
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
                      <TableHead>رقم الإيصال</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>المخزن</TableHead>
                      <TableHead>السبب</TableHead>
                      <TableHead className="text-center w-[100px]">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockOutRecords.length > 0 ? (
                      stockOutRecords.map((record: any) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-mono">{record.receiptNumber}</TableCell>
                          <TableCell>{new Date(record.date).toLocaleDateString('ar-EG')}</TableCell>
                          <TableCell>{getWarehouseName(record.sourceId)}</TableCell>
                          <TableCell>{getReasonLabel(record.reason)}</TableCell>
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
                                    <DropdownMenuItem onClick={() => router.push(`/inventory/stock-out/${record.id}`)}>
                                        عرض / طباعة
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          لا توجد إيصالات صرف مسجلة.
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
