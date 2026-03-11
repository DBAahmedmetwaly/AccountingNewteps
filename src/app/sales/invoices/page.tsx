
"use client";

import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Trash2, Printer, Save, Loader2, Info, Truck, MapPin, Wallet } from "lucide-react";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useData } from "@/contexts/data-provider";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from 'next/navigation';
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/contexts/permissions-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";
import { Combobox } from "@/components/ui/combobox";
import { calculateStockForItemInWarehouse } from '@/lib/inventory-utils';
import { Badge } from "@/components/ui/badge";


interface InvoiceItem {
  id: string; // Will be a composite ID for local state management, e.g., 'itemId-uniqueId'
  itemId: string; // The original item ID from the database
  name: string;
  qty: number;
  price: number;
  cost: number;
  total: number;
  unit: string; // Display name of the unit being sold (e.g., 'كرتونة')
  baseUnit: string; // The smallest unit (e.g., 'قطعة')
  conversionFactor: number;
  code?: string;
  uniqueId: string;
}

interface SecondaryUnitOption {
    value: string;
    label: string;
    factor: number;
    price?: number;
}

interface Item {
    id: string;
    name: string;
    baseUnit: string;
    price?: number;
    cost?: number;
    stock?: number;
    code?: string;
    secondaryUnits?: { name: string; conversionFactor: number; price: number; barcode?: string }[];
}

interface Customer {
    id: string;
    name: string;
}

interface Warehouse {
    id: string;
    name: string;
    autoStockUpdate?: boolean;
}

interface CashAccount {
    id: string;
    name: string;
    salesRepId?: string;
    warehouseId?: string;
}


export default function SalesInvoicePage() {
    const { toast } = useToast();
    const router = useRouter();
    const { can } = usePermissions();
    const { user } = useAuth();

    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [newItem, setNewItem] = useState({ id: "", name: "", qty: 1, price: 0, cost: 0, unit: "" });
    const [selectedUnit, setSelectedUnit] = useState('base');
    const [availableUnits, setAvailableUnits] = useState<{ value: string; label: string; factor: number; price?: number }[]>([]);

    const [subtotal, setSubtotal] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [tax, setTax] = useState(0);
    const [total, setTotal] = useState(0);
    const [paidAmount, setPaidAmount] = useState(0);
    const [applyTax, setApplyTax] = useState(true);
    const [isTaxIncluded, setIsTaxIncluded] = useState(false);
    const [customerId, setCustomerId] = useState("");
    const [warehouseId, setWarehouseId] = useState("");
    const [paidToAccountId, setPaidToAccountId] = useState("");
    const [notes, setNotes] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    
    const [isDelivery, setIsDelivery] = useState(false);
    const [deliveryPersonId, setDeliveryPersonId] = useState("");
    
    const [invoiceDate, setInvoiceDate] = useState<string>('');
    const [dueDate, setDueDate] = useState<string>('');


    const allDataContext = useData();
    const { 
        items: allItems, 
        customers, 
        warehouses, 
        cashAccounts, 
        salesInvoices, 
        customerPayments,
        salesReturns,
        posSales,
        posReturns,
        settings, 
        dbAction,
        getNextId,
        loading,
        users 
    } = allDataContext;
    
    const deliveryStaff = useMemo(() => users.filter((u: any) => u.isDelivery), [users]);


    useEffect(() => {
        if (user?.warehouseIds && user.warehouseIds.length === 1 && user.warehouseIds[0] !== 'all') {
            setWarehouseId(user.warehouseIds[0]);
        }
    }, [user]);

    const availableItemsForWarehouse = useMemo(() => {
        if (!warehouseId || warehouseId === "all" || !allItems.length) return [];
        const allowNegativeStock = settings?.main?.financial?.allowNegativeStock || false;

        return allItems
            .map((item:any) => ({ ...item, stock: calculateStockForItemInWarehouse(item.id, warehouseId, allDataContext) }))
            .filter((item:any) => item.stock > 0 || allowNegativeStock);
    }, [warehouseId, allItems, settings, allDataContext]);


    useEffect(() => {
        const newSubtotal = items.reduce((acc, item) => acc + item.total, 0);
        let newTax = 0;
        let newTotal = 0;

        if (applyTax) {
             if (isTaxIncluded) {
                const finalAmount = Math.max(0, newSubtotal - discount);
                newTax = finalAmount - (finalAmount / (1 + (settings?.main?.financial?.vatRate || 14) / 100));
                newTotal = finalAmount;
            } else {
                 const taxableBase = Math.max(0, newSubtotal - discount);
                 newTax = taxableBase * ((settings?.main?.financial?.vatRate || 14) / 100);
                 newTotal = taxableBase + newTax;
            }
        } else {
            newTotal = Math.max(0, newSubtotal - discount);
            newTax = 0;
        }

        setSubtotal(newSubtotal);
        setTax(newTax);
        setTotal(newTotal);
        setPaidAmount(newTotal);
    }, [items, discount, applyTax, isTaxIncluded, settings?.main?.financial?.vatRate]);

    useEffect(() => {
        setInvoiceDate(new Date().toISOString().split('T')[0]);
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        setDueDate(futureDate.toISOString().split('T')[0]);
    }, []);

    const handleAddItem = () => {
        if (!newItem.id || newItem.qty <= 0 || newItem.price < 0) return;
        const selectedItem = availableItemsForWarehouse.find((i: Item) => i.id === newItem.id);
        if (!selectedItem) return;
        
        const selectedUnitInfo = availableUnits.find(u => u.value === selectedUnit);
        if (!selectedUnitInfo) return;

        const requiredBaseQty = newItem.qty * selectedUnitInfo.factor;

        const mainSettings = settings?.main;
        if(requiredBaseQty > (selectedItem.stock || 0) && !mainSettings?.financial?.allowNegativeStock) {
            toast({
                variant: 'destructive',
                title: 'كمية غير متوفرة',
                description: `الرصيد المتاح من ${selectedItem.name} هو ${selectedItem.stock} فقط.`
            });
            return;
        }

        setItems(prev => [
            ...prev,
            { 
                id: `${selectedItem.id}-${Date.now()}`,
                itemId: selectedItem.id,
                name: selectedItem.name,
                qty: newItem.qty,
                price: newItem.price,
                cost: (selectedItem.cost || 0) * selectedUnitInfo.factor,
                total: newItem.qty * newItem.price,
                unit: selectedUnitInfo.label,
                baseUnit: selectedItem.baseUnit,
                conversionFactor: selectedUnitInfo.factor,
                code: selectedItem.code,
                uniqueId: `${selectedItem.id}-${Date.now()}-${Math.random()}`
            },
        ]);
        setNewItem({ id: "", name: "", qty: 1, price: 0, cost: 0, unit: "" });
        setSelectedUnit('base');
        setAvailableUnits([]);
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter((item) => item.uniqueId !== id));
    };

    const handleItemSelect = (itemId: string) => {
        const selectedItem = availableItemsForWarehouse.find((i: Item) => i.id === itemId);
        if (selectedItem) {
            const baseUnitOption = { value: 'base', label: selectedItem.baseUnit || 'قطعة', factor: 1, price: selectedItem.price || 0 };
            const secondaryUnitsOptions = (selectedItem.secondaryUnits || []).map((u: any) => ({
                value: u.name,
                label: u.name,
                factor: u.conversionFactor,
                price: u.price || 0
            }));

            const allUnits = [baseUnitOption, ...secondaryUnitsOptions];
            setAvailableUnits(allUnits);
            setSelectedUnit('base');

            setNewItem({
                id: itemId,
                name: selectedItem.name,
                qty: 1,
                price: selectedItem.price || 0,
                cost: selectedItem.cost || 0,
                unit: selectedItem.baseUnit,
            });
        }
    }

     const handleUnitChange = (unitName: string) => {
        setSelectedUnit(unitName);
        const unit = availableUnits.find(u => u.value === unitName);
        const item = allItems.find((i: Item) => i.id === newItem.id);
        if (unit && item) {
             setNewItem(prev => ({...prev, price: unit.price || (item.price || 0) * unit.factor}));
        }
    }
        
    const handleSaveInvoice = async () => {
        if (!customerId || !warehouseId || items.length === 0) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى اختيار العميل والمخزن وإضافة صنف واحد على الأقل.' });
            return;
        }
        if (isDelivery && !deliveryPersonId) {
             toast({ variant: "destructive", title: "بيانات غير مكتملة", description: "يرجى تحديد موظف التوصيل." });
            return;
        }
        if (paidAmount > 0 && !paidToAccountId) {
            toast({ variant: "destructive", title: "بيانات غير مكتملة", description: "يرجى تحديد حساب الخزينة/البنك لاستلام الدفعة." });
            return;
        }

        setIsSaving(true);
        try {
            const invoiceNumber = `ف-ب-${await getNextId('salesInvoice')}`;
            const customerName = customers.find((c:any) => c.id === customerId)?.name || '';
            
            const invoiceItems = items.map(item => {
                return {
                    id: item.itemId,
                    name: item.name,
                    qty: item.qty * item.conversionFactor, // Store in base units
                    price: item.price / item.conversionFactor, // Store price per base unit
                    total: item.total,
                    cost: item.cost / item.conversionFactor,
                }
            });
            
            const date = new Date();
            const dateString = date.toISOString().split('T')[0];

            const invoiceData: any = {
                invoiceNumber,
                date: new Date(invoiceDate).toISOString(),
                customerId,
                customerName,
                warehouseId,
                status: 'approved',
                items: invoiceItems,
                subtotal,
                discount,
                tax,
                total,
                isTaxIncluded,
                paidAmount,
                paidToAccountId, 
                notes,
                isDelivery,
                deliveryPersonId: isDelivery ? deliveryPersonId : null,
                deliveryPersonName: isDelivery ? deliveryStaff.find((d:any) => d.id === deliveryPersonId)?.name : null,
            };
            
            await dbAction(`salesInvoices`, 'add', invoiceData);

            toast({
                title: 'تم الحفظ بنجاح',
                description: `تم حفظ الفاتورة رقم ${invoiceNumber}`
            });
            router.push('/sales/invoices/list');
        } catch (error) {
            console.error("Failed to save invoice:", error);
            toast({
                variant: 'destructive',
                title: 'خطأ',
                description: 'فشل حفظ الفاتورة. الرجاء المحاولة مرة أخرى.'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const itemsForCombobox = useMemo(() => {
        return availableItemsForWarehouse.map((item: any) => ({
            value: item.id,
            label: `${item.name} (${item.code || 'N/A'}) (المتاح: ${item.stock})`
        }));
    }, [availableItemsForWarehouse]);
    
    // حساب الرصيد الحالي للعميل المختار
    const selectedCustomerBalance = useMemo(() => {
        if (!customerId) return 0;
        const c = customers.find((cust: any) => cust.id === customerId);
        if (!c) return 0;

        let balance = Number(c.openingBalance) || 0;
        
        // 1. إضافة المبالغ المتبقية من فواتير البيع المعتمدة
        salesInvoices.filter((inv: any) => inv.customerId === customerId && inv.status === 'approved')
            .forEach((inv: any) => {
                balance += (Number(inv.total) - Number(inv.paidAmount || 0));
            });

        // 2. إضافة المبالغ المتبقية من فواتير الكاشير
        posSales.filter((sale: any) => sale.customerId === customerId)
            .forEach((sale: any) => {
                balance += (Number(sale.total) - Number(sale.paidAmount || 0));
            });

        // 3. طرح المدفوعات غير المرتبطة بفواتير
        customerPayments.filter((p: any) => p.customerId === customerId && !p.invoiceId)
            .forEach((p: any) => {
                balance -= Number(p.amount);
            });

        // 4. طرح المرتجعات (المبالغ التي لم تُرد نقداً للعميل)
        salesReturns.filter((r: any) => r.customerId === customerId)
            .forEach((r: any) => {
                balance -= (Number(r.total) - Number(r.paidAmount || 0));
            });
        
        posReturns.filter((r: any) => r.customerId === customerId)
            .forEach((r: any) => {
                balance -= (Number(r.total) - Number(r.paidAmount || 0));
            });

        return balance;
    }, [customerId, customers, salesInvoices, posSales, posReturns, customerPayments, salesReturns]);

    const customerOptions = useMemo(() => {
        return customers.map((c: any) => ({ 
            value: c.id, 
            label: c.name
        }));
    }, [customers]);
    
    const warehouseOptions = useMemo(() => {
        const allowedWarehouses = user?.warehouseIds?.includes('all') 
            ? warehouses 
            : warehouses.filter((w: any) => user?.warehouseIds?.includes(w.id));
        return allowedWarehouses.map((w: any) => ({ value: w.id, label: w.name }));
    }, [warehouses, user]);
    
    const availableCashAccounts = useMemo(() => {
        if (warehouseId && warehouseId !== 'all') {
            const branchAccount = cashAccounts.find((acc: CashAccount) => acc.warehouseId === warehouseId);
            if (branchAccount) return [branchAccount];
        }
        return cashAccounts.filter((acc: CashAccount) => !acc.warehouseId && !acc.salesRepId);
    }, [warehouseId, cashAccounts]);

    const cashAccountOptions = useMemo(() => availableCashAccounts.map((c: any) => ({ value: c.id, label: c.name })), [availableCashAccounts]);
    
    const deliveryStaffOptions = useMemo(() => deliveryStaff.map((d: any) => ({ value: d.id, label: d.name })), [deliveryStaff]);


    useEffect(() => {
        if (availableCashAccounts.length === 1) {
            setPaidToAccountId(availableCashAccounts[0].id);
        } else {
             setPaidToAccountId("");
        }
    }, [availableCashAccounts]);

  return (
    <>
      <PageHeader title="فاتورة بيع جديدة" />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6 printable-area">
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                    <CardTitle>فاتورة بيع</CardTitle>
                    <CardDescription>
                        {settings?.main?.general?.companyName || 'اسم شركتك'}
                    </CardDescription>
                </div>
                <div className="text-left text-sm md:text-base grid grid-cols-2 gap-x-4 gap-y-1">
                    <Label className="font-bold">رقم الفاتورة:</Label>
                    <span>(سيتم إنشاؤه)</span>
                    <Label htmlFor="invoiceDate" className="font-bold">تاريخ الفاتورة:</Label>
                    <Input id="invoiceDate" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="h-8"/>
                    <Label htmlFor="dueDate" className="font-bold">تاريخ الاستحقاق:</Label>
                    <Input id="dueDate" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-8"/>
                </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
                <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="customer">العميل</Label>
                            <div className="flex flex-col gap-2">
                                <Combobox
                                    options={customerOptions}
                                    value={customerId}
                                    onValueChange={setCustomerId}
                                    placeholder="اختر عميلاً..."
                                    emptyMessage="لم يتم العثور على عميل."
                                />
                                {customerId && (
                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-primary/20">
                                        <Wallet className="h-4 w-4 text-primary" />
                                        <span className="text-sm font-medium">المديونية الحالية المستحقة:</span>
                                        <Badge variant={selectedCustomerBalance > 0 ? "destructive" : "outline"} className="text-sm">
                                            {selectedCustomerBalance.toLocaleString()} ج.م
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="warehouse">من فرع</Label>
                             <Combobox
                                options={warehouseOptions}
                                value={warehouseId}
                                onValueChange={setWarehouseId}
                                placeholder="اختر مخزنًا..."
                                emptyMessage="لم يتم العثور على المخزن."
                                disabled={!!(user?.warehouseIds && user.warehouseIds.length === 1 && user.warehouseIds[0] !== 'all')}
                            />
                        </div>
                    </div>
                     <div className="space-y-4 pt-2">
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                            <Switch id="is-delivery" checked={isDelivery} onCheckedChange={setIsDelivery} />
                            <Label htmlFor="is-delivery" className="flex items-center gap-2 text-base cursor-pointer">
                                <Truck className="h-5 w-5" />
                                فاتورة توصيل (دليفري)
                            </Label>
                        </div>
                        {isDelivery && warehouseId !== 'all' && (
                            <div className="grid md:grid-cols-2 gap-6 pl-8 rtl:pr-8">
                                <div className="space-y-2">
                                    <Label htmlFor="delivery-person">موظف التوصيل (الطيار)</Label>
                                    <Combobox
                                        options={deliveryStaffOptions}
                                        value={deliveryPersonId}
                                        onValueChange={setDeliveryPersonId}
                                        placeholder="اختر الطيار..."
                                        emptyMessage="لا يوجد طيارون."
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div>
                    <Label>بنود الفاتورة</Label>
                    <div className="w-full overflow-auto border rounded-lg">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">الصنف</TableHead>
                                <TableHead>الباركود</TableHead>
                                <TableHead className="text-center w-40">الوحدة</TableHead>
                                <TableHead className="text-center w-24">الكمية</TableHead>
                                <TableHead className="text-center w-32">سعر الوحدة</TableHead>
                                <TableHead className="text-center">الإجمالي</TableHead>
                                <TableHead className="text-center w-[100px] no-print">الإجراء</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {items.map((item) => (
                                <TableRow key={item.uniqueId}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell className="font-mono text-xs">{item.code}</TableCell>
                                <TableCell className="text-center">{item.unit}</TableCell>
                                <TableCell className="text-center">{item.qty}</TableCell>
                                <TableCell className="text-center">ج.م {item.price.toFixed(2)}</TableCell>
                                <TableCell className="text-center">ج.م {item.total.toFixed(2)}</TableCell>
                                <TableCell className="text-center no-print">
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.uniqueId)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="no-print bg-muted/20">
                                <TableCell className="p-2" colSpan={2}>
                                     <Combobox
                                        options={itemsForCombobox}
                                        value={newItem.id}
                                        onValueChange={handleItemSelect}
                                        placeholder={!warehouseId ? "اختر مخزنًا أولاً" : "اختر صنفًا..."}
                                        emptyMessage="لا توجد أصناف."
                                        className="w-full"
                                        disabled={!warehouseId}
                                    />
                                </TableCell>
                                <TableCell className="p-2 w-40">
                                     <Combobox
                                        options={availableUnits}
                                        value={selectedUnit}
                                        onValueChange={handleUnitChange}
                                        placeholder="اختر وحدة..."
                                        emptyMessage="اختر صنفًا أولاً"
                                        disabled={!newItem.id}
                                    />
                                </TableCell>
                                <TableCell className="p-2 w-24">
                                    <Input type="number" placeholder="الكمية" value={newItem.qty} onChange={e => setNewItem({...newItem, qty: parseInt(e.target.value) || 1})} onFocus={e => e.target.select()} className="text-center" />
                                </TableCell>
                                <TableCell className="p-2 w-32">
                                    <Input type="number" placeholder="السعر" value={newItem.price} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value) || 0})} onFocus={e => e.target.select()} className="text-center" readOnly={!can('edit', 'sales_invoices')} />
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-center">
                                    <Button onClick={handleAddItem} disabled={!warehouseId || !newItem.id}>
                                        <PlusCircle className="ml-2 h-4 w-4" />
                                        إضافة
                                    </Button>
                                </TableCell>
                            </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    </div>
                    
                    <div className="flex flex-col-reverse md:flex-row justify-between items-start gap-8">
                        <div className="w-full md:max-w-sm space-y-2 text-sm mt-4 md:mt-0">
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle>القيد المحاسبي المتوقع</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc pr-4 text-xs">
                                        <li>من ح/ حسابات العملاء (مدين بقيمة الفاتورة الإجمالية)</li>
                                        <li>من ح/ خصم مسموح به (مدين بقيمة الخصم إن وجد)</li>
                                        <li>إلى ح/ إيرادات المبيعات (دائن بقيمة المبيعات الصافية)</li>
                                        <li>إلى ح/ ضريبة القيمة المضافة (دائن بقيمة الضريبة)</li>
                                        <hr className="my-1"/>
                                        <li>من ح/ تكلفة البضاعة المباعة (مدين بتكلفة الأصناف)</li>
                                        <li>إلى ح/ المخزون (دائن بتكلفة الأصناف)</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        </div>
                        <div className="w-full md:max-w-sm space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span>الإجمالي الفرعي</span>
                                    <span>ج.م {subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>الخصم</span>
                                    <Input type="number" value={discount} onFocus={e => e.target.select()} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} className="h-8 max-w-[120px] text-left" placeholder="0.00"/>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span>تطبيق ضريبة القيمة المضافة ({settings?.main?.financial?.vatRate || 14}%)</span>
                                    <Switch checked={applyTax} onCheckedChange={setApplyTax} />
                                </div>
                                {applyTax && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">الأسعار شاملة الضريبة</span>
                                        <Switch checked={isTaxIncluded} onCheckedChange={setIsTaxIncluded} />
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span>ضريبة القيمة المضافة</span>
                                    <span>ج.م {tax.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-base border-t pt-2">
                                    <span>الإجمالي الكلي</span>
                                    <span>ج.م {total.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="space-y-2 border-t pt-4">
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="paidAmount" className="font-semibold">المبلغ المستلم</Label>
                                    <Input id="paidAmount" type="number" value={paidAmount} onFocus={e => e.target.select()} onChange={e => setPaidAmount(parseFloat(e.target.value) || 0)} className="h-8 max-w-[120px] text-left" placeholder="0.00"/>
                                </div>
                                {paidAmount > 0 && <div className="space-y-2">
                                    <Label htmlFor="paidToAccount">استلام في</Label>
                                     <Combobox
                                        options={cashAccountOptions}
                                        value={paidToAccountId}
                                        onValueChange={setPaidToAccountId}
                                        placeholder="اختر حساب الاستلام..."
                                        emptyMessage="لم يتم العثور على حساب."
                                    />
                                </div>}
                                <div className="flex justify-between font-bold text-base text-destructive">
                                    <span>المبلغ المتبقي</span>
                                    <span>ج.م {(total - paidAmount).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">ملاحظات</Label>
                        <Textarea id="notes" placeholder="أضف أي ملاحظات هنا..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                </>
            )}
          </CardContent>
          <CardFooter className="flex justify-end no-print">
            <Button size="lg" disabled={loading || isSaving} onClick={handleSaveInvoice}>
                {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                {isSaving ? 'جارٍ الحفظ...' : 'حفظ وإصدار الفاتورة'}
            </Button>
          </CardFooter>
        </Card>
      </main>
    </>
  );
}
