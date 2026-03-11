

"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useData } from '@/contexts/data-provider';
import PageHeader from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Printer, ArrowDown, ArrowUp } from 'lucide-react';

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

export default function StockAdjustmentDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [record, setRecord] = useState<StockAdjustmentRecord | null>(null);
  
  const { stockAdjustmentRecords, warehouses, loading } = useData();
  
  useEffect(() => {
    if (stockAdjustmentRecords.length > 0 && id) {
      const foundRecord = stockAdjustmentRecords.find((r:any) => r.id === id);
      setRecord(foundRecord || null);
    }
  }, [stockAdjustmentRecords, id]);
  
  const getWarehouseName = (warehouseId: string) => warehouses.find((w:any) => w.id === warehouseId)?.name || 'غير معروف';

  const handlePrint = () => {
    window.print();
  };
  
  if (loading) {
    return <div className="flex flex-1 justify-center items-center"><Loader2 className="h-10 w-10 animate-spin" /></div>;
  }
  
  if (!record) {
    return <div className="flex flex-1 justify-center items-center"><p>لم يتم العثور على إيصال التسوية.</p></div>;
  }

  const isOpeningBalance = record.reason === 'opening_balance';

  return (
    <>
      <PageHeader title={`إيصال تسوية: ${record.receiptNumber}`}>
        <div className="flex gap-2 no-print">
            <Button onClick={handlePrint} variant="outline">
                <Printer className="ml-2 h-4 w-4" />
                طباعة
            </Button>
             <Button onClick={() => router.back()}>الرجوع</Button>
        </div>
      </PageHeader>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6 printable-area">
        <Card>
          <CardHeader>
            <CardTitle>تفاصيل إيصال تسوية مخزنية</CardTitle>
             <div className="grid md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                <div>رقم الإيصال: {record.receiptNumber}</div>
                <div>تاريخ التسوية: {new Date(record.date).toLocaleDateString('ar-EG')}</div>
                <div>في مخزن: {getWarehouseName(record.warehouseId)}</div>
                <div className="font-semibold">نوع التسوية: {isOpeningBalance ? 'جرد افتتاحي' : 'جرد دوري'}</div>
                <div className="md:col-span-2">بواسطة: {record.createdByName || 'غير معروف'}</div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-auto">
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>الصنف</TableHead>
                          {!isOpeningBalance && <TableHead className="text-center">الرصيد الدفتري</TableHead>}
                          <TableHead className="text-center">الرصيد الفعلي</TableHead>
                          <TableHead className="text-center">الفرق (التسوية)</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {record.items.map((item, index) => (
                          <TableRow key={index}>
                              <TableCell>{item.name}</TableCell>
                              {!isOpeningBalance && <TableCell className="text-center">{item.systemQty}</TableCell>}
                              <TableCell className="text-center">{item.actualQty}</TableCell>
                              <TableCell className={`text-center font-bold ${item.difference > 0 ? 'text-green-500' : 'text-destructive'}`}>
                                <span className="flex items-center justify-center gap-1">
                                    {item.difference > 0 ? <ArrowUp /> : <ArrowDown />}
                                    {item.difference > 0 ? `+${item.difference}` : item.difference}
                                </span>
                              </TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
            </div>
            {record.notes && (
                <div className="mt-4 border-t pt-4">
                    <h4 className="font-semibold">ملاحظات:</h4>
                    <p className="text-muted-foreground">{record.notes}</p>
                </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
