

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
import { PlusCircle, Loader2, MoreHorizontal, FileText, ArrowLeftRight } from "lucide-react";
import useFirebase from "@/hooks/use-firebase";
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StockTransferRecord {
  id: string;
  receiptNumber: string;
  date: string;
  fromSourceId: string;
  toSourceId: string;
  items: { name: string; qty: number }[];
}

interface Warehouse {
    id: string;
    name: string;
}

export default function StockTransferListPage() {
  const { data: stockTransferRecords, loading: loadingStockTransfer } = useFirebase<StockTransferRecord>("stockTransferRecords");
  const { data: warehouses, loading: loadingWarehouses } = useFirebase<Warehouse>("warehouses");
  const router = useRouter();

  const loading = loadingStockTransfer || loadingWarehouses;

  const getWarehouseName = (warehouseId: string) => {
    return warehouses.find((w: any) => w.id === warehouseId)?.name || 'غير معروف';
  };

  return (
    <>
      <PageHeader title="سجل تحويلات المخزون">
        <Button size="sm" className="gap-1" onClick={() => router.push('/inventory/transfer/new')}>
          <PlusCircle className="h-4 w-4" />
          إضافة إذن تحويل
        </Button>
      </PageHeader>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>قائمة إيصالات التحويل</CardTitle>
            <CardDescription>
              عرض جميع عمليات تحويل المخزون التي تمت بين المخازن.
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
                      <TableHead>من مخزن</TableHead>
                      <TableHead>إلى مخزن</TableHead>
                      <TableHead className="text-center w-[100px]">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockTransferRecords.length > 0 ? (
                      stockTransferRecords.map((record: any) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-mono">{record.receiptNumber}</TableCell>
                          <TableCell>{new Date(record.date).toLocaleDateString('ar-EG')}</TableCell>
                          <TableCell>{getWarehouseName(record.fromSourceId)}</TableCell>
                          <TableCell>{getWarehouseName(record.toSourceId)}</TableCell>
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
                                    <DropdownMenuItem onClick={() => router.push(`/inventory/transfer/${record.id}`)}>
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
                          لا توجد إيصالات تحويل مسجلة.
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
