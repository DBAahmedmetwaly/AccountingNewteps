

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
import { useRouter } from 'next/navigation';
import { useData } from '@/contexts/data-provider';
import { Badge } from '@/components/ui/badge';


interface StockAdjustmentRecord {
  id: string;
  receiptNumber: string;
  date: string;
  warehouseId: string;
  notes?: string;
  createdByName?: string;
  reason?: 'periodic_count' | 'opening_balance';
  items: { 
    itemId: string; 
    name: string; 
    actualQty: number; 
    systemQty: number;
    difference: number;
  }[];
}

interface Warehouse {
    id: string;
    name: string;
}

export default function StockAdjustmentListPage() {
  const { stockAdjustmentRecords, warehouses, loading } = useData();
  const router = useRouter();

  const getWarehouseName = (warehouseId: string) => {
    return warehouses.find((w: Warehouse) => w.id === warehouseId)?.name || 'غير معروف';
  };
  
  const getReasonLabel = (reason?: string) => {
      if (reason === 'opening_balance') return <Badge variant="secondary">جرد افتتاحي</Badge>;
      if (reason === 'periodic_count') return <Badge>جرد دوري</Badge>;
      return <Badge variant="outline">غير محدد</Badge>;
  }

  return (
    <>
      <PageHeader title="سجل تسويات المخزون">
        <Button size="sm" className="gap-1" onClick={() => router.push('/inventory/adjustment/new')}>
          <PlusCircle className="h-4 w-4" />
          إضافة تسوية جديدة
        </Button>
      </PageHeader>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>قائمة إيصالات التسوية</CardTitle>
            <CardDescription>
              عرض جميع عمليات جرد وتسوية المخزون التي تمت.
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
                      <TableHead>رقم الإيصال</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>المخزن</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>المستخدم</TableHead>
                      <TableHead className="text-center w-[100px]">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockAdjustmentRecords.length > 0 ? (
                      stockAdjustmentRecords.map((record: StockAdjustmentRecord) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-mono">{record.receiptNumber}</TableCell>
                          <TableCell>{new Date(record.date).toLocaleDateString('ar-EG')}</TableCell>
                          <TableCell>{getWarehouseName(record.warehouseId)}</TableCell>
                          <TableCell>{getReasonLabel(record.reason)}</TableCell>
                          <TableCell>{record.createdByName || 'غير معروف'}</TableCell>
                           <TableCell className="text-center">
                             <Button aria-haspopup="true" size="icon" variant="ghost" onClick={() => router.push(`/inventory/adjustment/${record.id}`)}>
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">عرض التفاصيل</span>
                             </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          لا توجد تسويات مسجلة بعد.
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
