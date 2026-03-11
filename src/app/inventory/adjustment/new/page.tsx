

"use client";

import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Trash2, Loader2, Download, Upload, Camera } from "lucide-react";
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import * as XLSX from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { Combobox } from "@/components/ui/combobox";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-provider";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


interface AdjustmentItem {
  itemId: string;
  itemName: string;
  systemQty: number; 
  actualQty: number;
  difference: number;
  uniqueId: string;
}

interface Item {
    id: string;
    name: string;
    code?: string;
    unit: string;
    itemType?: 'standard' | 'raw_material' | 'manufactured';
}
interface Warehouse { id: string; name: string; }

export default function NewStockAdjustmentPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [items, setItems] = useState<AdjustmentItem[]>([]);
    const [newItem, setNewItem] = useState({ itemId: "", actualQty: 0, systemQty: 0 });
    const [branchFilter, setBranchFilter] = useState<string>("all");
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
    const [notes, setNotes] = useState<string>("");
    const { user } = useAuth();
    const [adjustmentType, setAdjustmentType] = useState<'periodic_count' | 'opening_balance'>('periodic_count');
    
    const { 
        items: allItems, 
        warehouses, 
        inventoryZones,
        inventory,
        dbAction, 
        getNextId, 
        loading 
    } = useData();

    const authorizedBranches = useMemo(() => {
        const b = warehouses.filter((w: any) => !w.isMain && !w.isRepWarehouse && !w.repId);
        if (user?.warehouseIds?.includes('all')) return b;
        return b.filter((w: any) => user?.warehouseIds?.includes(w.id));
    }, [warehouses, user]);
    
    useEffect(() => {
        if (authorizedBranches.length === 1) {
            setBranchFilter(authorizedBranches[0].id);
        }
    }, [authorizedBranches]);

    const warehouseOptions = useMemo(() => {
        const combined = [...warehouses, ...inventoryZones].filter((w: any) => !w.isRepWarehouse);
        
        // 1. Filter by User Authorized Branches first
        let filtered = combined;
        if (!user?.warehouseIds?.includes('all')) {
            filtered = combined.filter((w: any) => user?.warehouseIds?.includes(w.id));
        }

        // 2. Filter by Branch Filter if selected
        if (branchFilter !== 'all') {
            filtered = filtered.filter((w: any) => {
                if (w.id === branchFilter) return true;
                return (w as any).branchId === branchFilter;
            });
        }

        return filtered.map((w: any) => ({ value: w.id, label: w.name }));
    }, [warehouses, inventoryZones, user, branchFilter]);

    const branchOptions = useMemo(() => {
         return [{ value: 'all', label: 'كل الفروع المصرح بها' }, ...authorizedBranches.map(b => ({ value: b.id, label: b.name }))];
     }, [authorizedBranches]);

    const [isSaving, setIsSaving] = useState(false);
    const [duplicateItemInfo, setDuplicateItemInfo] = useState<{ item: AdjustmentItem, newQty: number } | null>(null);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const newItemQtyInputRef = useRef<HTMLInputElement>(null);

    const availableItems = useMemo(() => {
        return allItems.filter((item: Item) => item.itemType !== 'manufactured');
    }, [allItems]);


     const handleScanSuccess = useCallback((scannedCode: string) => {
        const item = availableItems.find((i: Item) => i.code === scannedCode);
        if (item) {
            const existingItem = items.find(i => i.itemId === item.id);
            if (existingItem) {
                // If item exists, just focus on its quantity field for manual update
                // Or maybe increment? For now, let's just indicate it's found.
                 toast({ title: "الصنف موجود بالفعل", description: `الصنف ${item.name} في القائمة بالفعل.` });

            } else {
                 const systemQty = adjustmentType === 'opening_balance' ? 0 : calculateSystemStock(item.id, selectedWarehouse);
                 setNewItem({ itemId: item.id, actualQty: 1, systemQty });
                 toast({ title: "تم العثور على الصنف", description: `تم تحديد الصنف: ${item.name}` });
                 setTimeout(() => newItemQtyInputRef.current?.focus(), 100);
            }
        } else {
            toast({ variant: 'destructive', title: "صنف غير موجود", description: `لم يتم العثور على صنف بالباركود: ${scannedCode}` });
        }
    }, [availableItems, items, selectedWarehouse, toast, adjustmentType]);


    useEffect(() => {
        let stream: MediaStream | null = null;
        let animationFrameId: number;
        let isProcessing = false;

        const startScan = async () => {
            if (!isScannerOpen || !videoRef.current || !("BarcodeDetector" in window)) {
                return;
            }

            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                videoRef.current.srcObject = stream;
                await videoRef.current.play();

                const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'code_128', 'qr_code'] });

                const detect = async () => {
                    if (isProcessing) {
                        animationFrameId = requestAnimationFrame(detect);
                        return;
                    }
                    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                        isProcessing = true;
                        try {
                            const barcodes = await barcodeDetector.detect(videoRef.current);
                            if (barcodes.length > 0) {
                                handleScanSuccess(barcodes[0].rawValue);
                                // Pause scanning for a moment to prevent multiple reads of the same code
                                await new Promise(resolve => setTimeout(resolve, 2000));
                            }
                        } catch (detectError) {
                            console.error("Detection error:", detectError);
                        } finally {
                            isProcessing = false;
                        }
                    }
                    if(isScannerOpen) {
                        animationFrameId = requestAnimationFrame(detect);
                    }
                };
                detect();

            } catch (err) {
                console.error("Camera/Scanner Error:", err);
                toast({ variant: 'destructive', title: 'خطأ في الكاميرا', description: 'لم يتمكن من الوصول إلى الكاميرا. تأكد من منح الإذن.' });
                setIsScannerOpen(false);
            }
        };

        if (isScannerOpen) {
            startScan();
        }

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [isScannerOpen, handleScanSuccess, toast]);

    const availableItemsForCombobox = useMemo(() => {
        return availableItems.map((item: Item) => ({ value: item.id, label: `${item.name} (${item.code || 'N/A'})` }));
    }, [availableItems]);


    const calculateSystemStock = useCallback((itemId: string, warehouseId: string): number => {
        if (!itemId || !warehouseId || !inventory.length) return 0;
        const inventoryId = `${warehouseId}-${itemId}`;
        const stockData = inventory.find((inv: any) => inv.id === inventoryId);
        return stockData?.balance || 0;
    }, [inventory]);

    const handleDownloadTemplate = () => {
        const itemsToInclude = availableItems.filter((item: Item) => item.itemType !== 'manufactured');
        const data = itemsToInclude.map((item: Item) => ({
            'Code': item.code || item.id,
            'Name': item.name,
            'Unit': item.unit,
            'ActualQuantity': ''
        }));
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "InventoryCount");
        XLSX.writeFile(workbook, `InventoryCountTemplate_${selectedWarehouse}.xlsx`);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedWarehouse) {
             toast({ variant: 'destructive', title: 'خطأ', description: 'يرجى اختيار مخزن أولاً قبل رفع الملف.' });
             return;
        };

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet);

                const newItems: AdjustmentItem[] = json.map(row => {
                    const itemCode = String(row['Code']);
                    const item = availableItems.find((i: Item) => (i.code === itemCode || i.id === itemCode) && i.itemType !== 'manufactured');
                    if (!item) return null;

                    const actualQty = Number(row['ActualQuantity']) || 0;
                    const systemQty = adjustmentType === 'opening_balance' ? 0 : calculateSystemStock(item.id, selectedWarehouse);
                    const difference = actualQty - systemQty;
                    
                    return {
                        itemId: item.id,
                        itemName: item.name,
                        systemQty,
                        actualQty,
                        difference,
                        uniqueId: `${item.id}-${Date.now()}`
                    };
                }).filter((item): item is AdjustmentItem => item !== null);
                
                setItems(newItems);
                toast({ title: 'تمت قراءة الملف', description: `تمت معالجة ${newItems.length} صنف. يرجى المراجعة قبل الحفظ.` });

            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'خطأ في الملف', description: 'لا يمكن قراءة الملف. تأكد من تطابق الأعمدة مع القالب.' });
            }
        };
        reader.readAsArrayBuffer(file);
    };


    const handleAddItem = () => {
        if (!newItem.itemId || !selectedWarehouse) {
            toast({
                variant: "destructive",
                title: "خطأ",
                description: "يرجى اختيار مخزن وصنف.",
            });
            return;
        }

        const existingItem = items.find(i => i.itemId === newItem.itemId);
        if (existingItem) {
            setDuplicateItemInfo({ item: existingItem, newQty: newItem.actualQty });
            return;
        }
        
        const selectedItemData = availableItems.find((i: Item) => i.id === newItem.itemId);
        if (!selectedItemData) return;
        
        const systemQty = adjustmentType === 'opening_balance' ? 0 : calculateSystemStock(newItem.itemId, selectedWarehouse);
        const difference = newItem.actualQty - systemQty;

        setItems([
        ...items,
        { 
            itemId: selectedItemData.id,
            itemName: selectedItemData.name,
            systemQty: systemQty,
            actualQty: newItem.actualQty,
            difference: difference,
            uniqueId: `${selectedItemData.id}-${Date.now()}`
        },
        ]);
        setNewItem({ itemId: "", actualQty: 0, systemQty: 0 });
    };

    const handleUpdateDuplicate = () => {
        if (!duplicateItemInfo) return;
        const { item, newQty } = duplicateItemInfo;
        
        setItems(prevItems => prevItems.map(i => {
            if (i.itemId === item.itemId) {
                const newDifference = adjustmentType === 'opening_balance' ? newQty : newQty - i.systemQty;
                return { ...i, actualQty: newQty, difference: newDifference };
            }
            return i;
        }));
        
        setNewItem({ itemId: "", actualQty: 0, systemQty: 0 });
        setDuplicateItemInfo(null);
        toast({title: "تم تحديث الكمية", description: `تم تحديث الكمية الفعلية للصنف ${item.itemName}.`});
    };

    const handleRemoveItem = (uniqueId: string) => {
        setItems(items.filter((item) => item.uniqueId !== uniqueId));
    };

    const resetForm = () => {
        setItems([]);
        setNewItem({ itemId: "", actualQty: 0, systemQty: 0 });
        setNotes("");
        setIsSaving(false);
    }

    const handleConfirm = async () => {
        if (!selectedWarehouse || items.length === 0) {
            toast({
                variant: "destructive",
                title: "بيانات غير مكتملة",
                description: "يرجى اختيار مخزن وإضافة صنف واحد على الأقل للتسوية.",
            });
            return;
        }
        
        const itemsWithDifference = items.filter(item => item.difference !== 0);
        if (itemsWithDifference.length === 0) {
            toast({ title: 'لا توجد فروقات', description: 'لم يتم العثور على أي فروقات ليتم حفظها.'});
            return;
        }
        
        setIsSaving(true);

        try {
            const nextId = await getNextId('stockAdjustment');
            if(!nextId) {
                throw new Error("فشل في إنشاء رقم الإيصال.");
            }

            const record = {
                warehouseId: selectedWarehouse,
                date: new Date().toISOString(),
                items: itemsWithDifference.map(item => ({
                    itemId: item.itemId,
                    name: item.itemName,
                    difference: item.difference,
                    actualQty: item.actualQty,
                    systemQty: item.systemQty
                })),
                notes,
                reason: adjustmentType,
                receiptNumber: `ت-م-${nextId}`,
                createdById: user?.id,
                createdByName: user?.name,
            };
            
            await dbAction('stockAdjustmentRecords', 'add', record);

            toast({ title: "اكتملت التسوية", description: `تم حفظ إذن التسوية بنجاح.` });
            router.push('/inventory/adjustment');
        } catch (error) {
            toast({ variant: "destructive", title: `خطأ في الحفظ`, description: "فشل في حفظ إيصال التسوية." });
            console.error(`Failed to save stock adjustment:`, error);
        } finally {
            setIsSaving(false);
        }
    };


  return (
    <>
        <AlertDialog open={!!duplicateItemInfo} onOpenChange={() => setDuplicateItemInfo(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>الصنف موجود بالفعل</AlertDialogTitle>
                <AlertDialogDescription>
                    الصنف "{duplicateItemInfo?.item.itemName}" موجود بالفعل في القائمة. هل تريد استبدال الكمية القديمة ({duplicateItemInfo?.item.actualQty}) بالكمية الجديدة ({duplicateItemInfo?.newQty})؟
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDuplicateItemInfo(null)}>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleUpdateDuplicate}>نعم، قم بالاستبدال</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
          <DialogContent className="max-w-md">
              <DialogHeader>
                  <DialogTitle>مسح باركود بالكاميرا</DialogTitle>
                  <DialogDescription>
                      وجّه الكاميرا إلى الباركود ليتم إضافته تلقائيًا.
                  </DialogDescription>
              </DialogHeader>
              <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
              </div>
          </DialogContent>
      </Dialog>


      <PageHeader title="تسوية وجرد المخزون" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6 printable-area">
        <Card>
          <CardHeader>
            <CardTitle>إيصال تسوية مخزنية</CardTitle>
            <CardDescription>
                استخدم هذه الشاشة لتصحيح كميات المخزون بناءً على الجرد الفعلي. يمكنك استخدام قالب Excel أو الإدخال اليدوي.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
                 <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                         <div className="space-y-2">
                            <Label htmlFor="adjustment-type">نوع التسوية</Label>
                            <Select value={adjustmentType} onValueChange={(v: any) => { setAdjustmentType(v); setItems([]); }}>
                                <SelectTrigger id="adjustment-type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="periodic_count">جرد دوري (تسوية عجز/زيادة)</SelectItem>
                                    <SelectItem value="opening_balance">جرد افتتاحي (رصيد أول مدة)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>الفرع</Label>
                            <Combobox
                                options={branchOptions}
                                value={branchFilter}
                                onValueChange={(v) => { setBranchFilter(v); setSelectedWarehouse(''); setItems([]); }}
                                placeholder="فلترة حسب الفرع..."
                                disabled={authorizedBranches.length === 1}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="warehouse">المخزن</Label>
                            <Combobox
                                options={warehouseOptions}
                                value={selectedWarehouse}
                                onValueChange={(v) => { setSelectedWarehouse(v); setItems([]); }}
                                placeholder="اختر المخزن..."
                                emptyMessage="لم يتم العثور على مخزن لهذا الفرع."
                            />
                        </div>
                        <div className="space-y-2">
                             <Label>باستخدام Excel</Label>
                             <div className="flex gap-2">
                                <Button onClick={handleDownloadTemplate} disabled={!selectedWarehouse} variant="outline" className="flex-1"><Download className="ml-2 h-4 w-4" /> تحميل القالب</Button>
                                <Input id="file-upload" type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                                <Label htmlFor="file-upload" className="flex-grow">
                                    <Button asChild className="w-full cursor-pointer" disabled={!selectedWarehouse}><span className='flex items-center'><Upload className="ml-2 h-4 w-4" /> رفع الملف</span></Button>
                                </Label>
                             </div>
                        </div>
                    </div>
                    
                    <div>
                      <Label>الأصناف</Label>
                      <div className="w-full overflow-auto border rounded-lg">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">الصنف</TableHead>
                                {adjustmentType === 'periodic_count' && <TableHead className="text-center">الكمية بالنظام</TableHead>}
                                <TableHead className="text-center">الكمية الفعلية</TableHead>
                                <TableHead className="text-center">الفرق</TableHead>
                                <TableHead className="text-center w-[100px] no-print">الإجراء</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {items.map((item) => (
                                <TableRow key={item.uniqueId}>
                                <TableCell>{item.itemName}</TableCell>
                                {adjustmentType === 'periodic_count' && <TableCell className="text-center">{item.systemQty}</TableCell>}
                                <TableCell className="text-center">{item.actualQty}</TableCell>
                                <TableCell className={`text-center font-bold ${item.difference > 0 ? 'text-green-500' : item.difference < 0 ? 'text-destructive' : ''}`}>
                                    {item.difference > 0 ? `+${item.difference}` : item.difference}
                                </TableCell>
                                <TableCell className="text-center no-print">
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.uniqueId)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                                </TableRow>
                            ))}
                             <TableRow className="no-print bg-muted/30">
                                <TableCell className="p-2 flex items-center gap-2">
                                    <Combobox
                                        options={availableItemsForCombobox}
                                        value={newItem.itemId}
                                        onValueChange={(value) => setNewItem({ ...newItem, itemId: value })}
                                        placeholder="ابحث عن صنف..."
                                        emptyMessage="لم يتم العثور على الصنف."
                                        className="flex-1"
                                    />
                                     <Button variant="outline" size="icon" onClick={() => setIsScannerOpen(true)} disabled={!selectedWarehouse}>
                                        <Camera className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                                {adjustmentType === 'periodic_count' && <TableCell></TableCell>}
                                <TableCell className="p-2">
                                    <Input 
                                      ref={newItemQtyInputRef}
                                      type="number" 
                                      placeholder="الكمية الفعلية" 
                                      value={newItem.actualQty} 
                                      onChange={e => setNewItem({...newItem, actualQty: parseInt(e.target.value) || 0})}
                                      onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                                    />
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-center">
                                    <Button onClick={handleAddItem} size="sm" disabled={!selectedWarehouse || !newItem.itemId}>
                                        <PlusCircle className="ml-2 h-4 w-4" />
                                        إضافة
                                    </Button>
                                </TableCell>
                            </TableRow>
                            </TableBody>
                        </Table>
                      </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="notes">ملاحظات عامة</Label>
                        <Textarea id="notes" placeholder="أضف سبب التسوية أو أي ملاحظات هنا..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                </>
            )}
            {isSaving && (
                 <div className="space-y-2 pt-4">
                    <p className="text-sm text-muted-foreground text-center">
                        جارٍ حفظ إذن التسوية...
                    </p>
                </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end no-print">
            <Button size="lg" disabled={loading || isSaving} onClick={handleConfirm}>
                 {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : 'تأكيد التسوية'}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </>
  );
}

