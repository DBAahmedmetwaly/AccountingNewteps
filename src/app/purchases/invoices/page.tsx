

"use client";

import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Trash2, Save, Loader2, Info } from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import { useData } from "@/contexts/data-provider";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams } from 'next/navigation';
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";
import { Combobox } from "@/components/ui/combobox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


interface InvoiceItem {
  itemId: string; // The original item ID
  name: string;
  qty: number;
  cost: number;
  sellingPrice: number;
  total: number;
  unit: string;
  code?: string;
  expiryDate?: string;
  uniqueId: string; // A unique ID for the list key
  conversionFactor: number;
  originalUnit: string;
}

interface SecondaryUnitOption {
    value: string;
    label: string;
    factor: number;
    price?: number;
    barcode?: string;
}

interface Item {
    id: string;
    name: string;
    baseUnit: string;
    price?: number;
    cost?: number;
    code?: string;
    secondaryUnits?: { name: string; conversionFactor: number; price: number; barcode?: string; }[];
}

interface Supplier {
    id: string;
    name: string;
    openingBalance?: number;
    items?: string[];
}

interface Customer {
    id: string;
    name: string;
    openingBalance?: number;
}

interface Warehouse {
    id: string;
    name: string;
    isMain?: boolean; // To distinguish main warehouses
}

interface CashAccount {
    id: string;
    name: string;
    openingBalance: number;
    warehouseId?: string;
}


const QuickAddDialog = ({ open, onOpenChange, onConfirm, title, label }: { open: boolean, onOpenChange: (open: boolean) => void, onConfirm: (name: string) => void, title: string, label: string }) => {
    const [name, setName] = useState('');

    const handleConfirm = () => {
        if (name) {
            onConfirm(name);
            setName('');
            onOpenChange(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                </AlertDialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="quick-add-name">{label}</Label>
                    <Input id="quick-add-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => onOpenChange(false)}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirm}>حفظ</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export default function PurchaseInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<InvoiceItem[]>([]);
  
  const [newItem, setNewItem] = useState({ id: "", name: "", qty: 1, cost: 0, sellingPrice: 0, unit: "قطعة", code: "", expiryDate: "" });
  const [selectedUnit, setSelectedUnit] = useState('base');
  const [availableUnits, setAvailableUnits] = useState<SecondaryUnitOption[]>([]);
  
  // State for dialogs
  const [isQuickSupplierOpen, setIsQuickSupplierOpen] = useState(false);
  
  const [subtotal, setSubtotal] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [total, setTotal] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [applyTax, setApplyTax] = useState(true);
  const [isTaxIncluded, setIsTaxIncluded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [paidFromAccountId, setPaidFromAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [originalPoId, setOriginalPoId] = useState<string | null>(null);


  const { 
    items: allItems, 
    suppliers, 
    warehouses,
    inventoryZones, 
    cashAccounts, 
    purchaseOrders,
    purchaseInvoices,
    dbAction, 
    getNextId, 
    loading,
    customerPayments,
    salesInvoices,
    exceptionalIncomes,
    treasuryTransactions,
    expenses,
    supplierPayments,
    employeeAdvances,
    profitDistributions,
    settings,
  } = useData();

  const purchaseWorkflow = useMemo(() => settings?.main?.financial?.purchaseWorkflow || 'direct', [settings]);

  useEffect(() => {
    const fromPO = searchParams.get('from_po');
    if (fromPO && purchaseOrders.length > 0) {
        const order = purchaseOrders.find((o: any) => o.id === fromPO);
        if (order) {
            setOriginalPoId(fromPO);
            setSupplierId(order.supplierId);
            setWarehouseId(order.warehouseId || '');
            setNotes(`بناءً على أمر الشراء رقم ${order.orderNumber}`);

            const orderItems = order.items.map((item: any) => ({
                itemId: item.id,
                name: item.name,
                qty: item.qty,
                cost: item.cost,
                sellingPrice: allItems.find((i:any) => i.id === item.id)?.price || item.cost * 1.25,
                total: item.qty * item.cost,
                unit: allItems.find((i:any) => i.id === item.id)?.unit || 'قطعة',
                code: allItems.find((i:any) => i.id === item.id)?.code || '',
                expiryDate: '',
                uniqueId: `${item.id}-${Date.now()}-${Math.random()}`,
                conversionFactor: 1, // Assume base unit when converting from PO
                originalUnit: allItems.find((i:any) => i.id === item.id)?.baseUnit || 'قطعة',
            }));
            setItems(orderItems);
        }
    }
  }, [searchParams, purchaseOrders, allItems]);


  const suppliersForCombobox = React.useMemo(() => {
    return suppliers.map((s: Supplier) => ({ 
        value: s.id, 
        label: `${s.name} (المستحقات: ${((s.openingBalance || 0) + (purchaseInvoices.filter((p:any) => p.supplierId === s.id).reduce((acc:number, p:any) => acc + (p.total - (p.paidAmount || 0)), 0)) - (supplierPayments.filter((p:any) => p.supplierId === s.id).reduce((acc:number, p:any) => acc + p.amount, 0))).toLocaleString()} ج.م)` 
    }));
  }, [suppliers, purchaseInvoices, supplierPayments]);
  
   const allWarehouses = useMemo(() => [...warehouses, ...inventoryZones], [warehouses, inventoryZones]);
   const warehouseOptions = useMemo(() => allWarehouses.map((w: Warehouse) => ({ value: w.id, label: w.name })), [allWarehouses]);

   const itemsForCombobox = useMemo(() => {
    return allItems.map((item: Item) => ({ 
      value: item.id, 
      label: `${item.name} (${item.code || 'N/A'})` 
    }));
  }, [allItems]);

   const accountBalances = useMemo(() => {
        const balances = new Map<string, number>();
        cashAccounts.forEach((account:any) => {
            let balance = account.openingBalance || 0;
            // Add other transactions to calculate current balance
             customerPayments.forEach((p: any) => { if(p.paidToAccountId === account.id) balance += p.amount });
             salesInvoices.filter((s:any) => s.status === 'approved').forEach((s: any) => { if (s.paidToAccountId === account.id) balance += (s.paidAmount || 0) });
             exceptionalIncomes.forEach((i: any) => { if (i.paidToAccountId === account.id) balance += i.amount });
             treasuryTransactions.filter((tx:any) => tx.accountId === account.id && tx.type === 'deposit').forEach((tx:any) => balance += tx.amount);
             expenses.forEach((ex: any) => { if (ex.paidFromAccountId === account.id) balance -= ex.amount });
             supplierPayments.forEach((sp: any) => { if (sp.paidFromAccountId === account.id) balance -= sp.amount });
             employeeAdvances.forEach((ea: any) => { if (ea.paidFromAccountId === account.id) balance -= ea.amount });
             profitDistributions.forEach((pd: any) => { if (pd.paidFromAccountId === account.id) balance -= pd.amount });
             treasuryTransactions.filter((tx:any) => tx.accountId === account.id && tx.type === 'withdrawal').forEach((tx:any) => balance -= tx.amount);
            balances.set(account.id, balance);
        });
        return balances;
    }, [cashAccounts, customerPayments, salesInvoices, exceptionalIncomes, treasuryTransactions, expenses, supplierPayments, employeeAdvances, profitDistributions]);
    
    const availableCashAccounts = useMemo(() => {
        if (warehouseId && warehouseId !== 'all') {
            const branchAccount = cashAccounts.find((acc: CashAccount) => acc.warehouseId === warehouseId);
            if (branchAccount) return [branchAccount];
        }
        return cashAccounts.filter((acc: CashAccount) => !acc.warehouseId);
    }, [warehouseId, cashAccounts]);

    const cashAccountOptions = React.useMemo(() => {
        return availableCashAccounts.map((acc: CashAccount) => ({
            value: acc.id,
            label: `${acc.name} (الرصيد: ${(accountBalances.get(acc.id) || 0).toLocaleString()})`
        }))
    }, [availableCashAccounts, accountBalances]);

    useEffect(() => {
        if (availableCashAccounts.length === 1) {
            setPaidFromAccountId(availableCashAccounts[0].id);
        } else {
             setPaidFromAccountId("");
        }
    }, [availableCashAccounts]);
    
    const isBalanceSufficient = useMemo(() => {
        if (paidAmount <= 0) return true;
        if (!paidFromAccountId) return false;
        const balance = accountBalances.get(paidFromAccountId) || 0;
        return balance >= paidAmount;
    }, [paidAmount, paidFromAccountId, accountBalances]);


  useEffect(() => {
    const newSubtotal = items.reduce((acc, item) => acc + item.total, 0);
    let newTax = 0;
    let newTotal = 0;

    if (applyTax) {
         if (isTaxIncluded) {
             const finalAmount = Math.max(0, newSubtotal - discount);
             newTax = finalAmount - (finalAmount / 1.14);
             newTotal = finalAmount;
         } else {
             const taxableBase = Math.max(0, newSubtotal - discount);
             newTax = taxableBase * 0.14;
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
  }, [items, discount, applyTax, isTaxIncluded]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setInvoiceDate(today);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    setDueDate(futureDate.toISOString().split('T')[0]);
  }, []);

  const handleAddItem = () => {
    if (!newItem.id || newItem.qty <= 0 || newItem.cost < 0) {
        toast({ variant: "destructive", title: "خطأ", description: "يرجى اختيار صنف وإدخال كمية وتكلفة صالحة."});
        return;
    }
    
    const selectedItem = allItems.find((i: Item) => i.id === newItem.id);
    if(!selectedItem) return;
    
    const selectedUnitInfo = availableUnits.find(u => u.value === selectedUnit);
    if (!selectedUnitInfo) return;
    
    const itemToAdd: InvoiceItem = {
        itemId: newItem.id,
        name: selectedItem.name,
        qty: newItem.qty,
        cost: newItem.cost,
        sellingPrice: newItem.sellingPrice,
        unit: selectedItem.baseUnit || 'قطعة',
        code: newItem.code,
        expiryDate: newItem.expiryDate,
        total: newItem.qty * newItem.cost, // Total is based on the purchase unit
        uniqueId: `${newItem.id}-${Date.now()}`,
        conversionFactor: selectedUnitInfo.factor,
        originalUnit: selectedUnitInfo.label
    };

    setItems(prev => [...prev, itemToAdd]);
    
    setNewItem({ id: "", name: "", qty: 1, cost: 0, sellingPrice: 0, unit: "قطعة", code: "", expiryDate: "" });
    setSelectedUnit('base');
    setAvailableUnits([]);
};


  const handleRemoveItem = (uniqueId: string) => {
    setItems(items.filter((item) => item.uniqueId !== uniqueId));
  };
  
  const handleUpdateItem = (uniqueId: string, field: keyof InvoiceItem, value: any) => {
    setItems(prevItems => prevItems.map(item => {
        if (item.uniqueId === uniqueId) {
            const updatedItem = { ...item, [field]: value };
            if (field === 'qty' || field === 'cost') {
                updatedItem.total = updatedItem.qty * updatedItem.cost;
            }
            return updatedItem;
        }
        return item;
    }));
  };

  const handleQuickAddSupplier = async (name: string) => {
      if (!name) return;
      try {
        const newSupplierId = await dbAction('suppliers', 'add', { name: name, openingBalance: 0, contact: ''});
        if(newSupplierId) setSupplierId(newSupplierId as string);
        toast({ title: "تمت إضافة المورد بنجاح"});
      } catch (e) {
          toast({ variant: 'destructive', title: 'فشل الحفظ'});
      }
  }

  const handleSaveInvoice = (updatePrices: boolean) => {
       if (!supplierId || !warehouseId || items.length === 0) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى اختيار المورد والمخزن وإضافة صنف واحد على الأقل.' });
            return;
        }
       if (paidAmount > 0 && !paidFromAccountId) {
            toast({ variant: "destructive", title: "بيانات غير مكتملة", description: "يرجى تحديد الحساب الذي تم الدفع منه." });
            return;
        }
        if (!isBalanceSufficient) {
             toast({ variant: "destructive", title: "رصيد غير كافٍ", description: "رصيد الخزينة المحدد لا يكفي لتغطية المبلغ المدفوع." });
            return;
        }

        setIsSaving(true);
        // No await here, let it run in the background
        saveInvoiceAsync(updatePrices);
        toast({ title: 'جاري الحفظ...', description: `سيتم حفظ فاتورة الشراء في الخلفية.` });
        router.push('/purchases/invoices/list');
  }

  const saveInvoiceAsync = async (updatePrices: boolean) => {
    try {
        const invoiceNumber = await getNextId('purchaseInvoice');
        if (!invoiceNumber) throw new Error("Failed to generate invoice number.");

        const supplier = suppliers.find((s: Supplier) => s.id === supplierId);
        if (!supplier) throw new Error("Supplier not found");
        
        const invoiceItems = items.map(item => {
            const baseUnitCost = item.cost / item.conversionFactor;
            return {
                id: item.itemId, name: item.name, code: item.code,
                qty: item.qty * item.conversionFactor, cost: baseUnitCost,
                sellingPrice: item.sellingPrice, total: item.total,
                originalUnit: item.originalUnit, originalQty: item.qty,
                conversionFactor: item.conversionFactor, expiryDate: item.expiryDate || null,
            }
        });
        
        const now = new Date();
        const selectedDate = new Date(invoiceDate);
        const finalInvoiceDate = new Date(
            selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(),
            now.getHours(), now.getMinutes(), now.getSeconds()
        );

        const batchNumberToSave = batchNumber || await getNextId('batch'); 

        const invoiceData = {
            invoiceNumber: `ف-ش-${invoiceNumber}`,
            date: finalInvoiceDate.toISOString(), dueDate: new Date(dueDate).toISOString(),
            supplierId, supplierName: supplier.name, warehouseId,
            items: invoiceItems, subtotal, discount, tax, total, paidAmount,
            paidFromAccountId, notes, createdById: user?.id, createdByName: user?.name,
            batchNumber: batchNumberToSave, fromPoId: originalPoId, isTaxIncluded,
        };

        const dateString = finalInvoiceDate.toISOString().split('T')[0];
        const path = `purchaseInvoices`;

        const newInvoiceId = await dbAction(path, 'add', invoiceData);
        if (!newInvoiceId) throw new Error("Failed to create purchase invoice.");

        if(originalPoId) {
            await dbAction('purchaseOrders', 'update', {id: originalPoId, data: { status: 'fulfilled', purchaseInvoiceId: newInvoiceId }});
        }
        
        const currentSupplierItems = new Set(supplier.items || []);
        invoiceItems.forEach(item => currentSupplierItems.add(item.id));
        await dbAction('suppliers', 'update', { id: supplierId, data: { items: Array.from(currentSupplierItems) } });

        if (updatePrices) {
            for (const item of invoiceItems) {
                const baseSellingPrice = item.sellingPrice > 0 ? item.sellingPrice : allItems.find((i:Item) => i.id === item.id)?.price || 0;
                await dbAction('items', 'update', {
                    id: item.id,
                    data: { cost: item.cost, price: baseSellingPrice }
                });
            }
        }
        
        const targetWarehouse = allWarehouses.find((w: any) => w.id === warehouseId);
        const isMainWarehouse = targetWarehouse?.isMain || false;

        // Determine stock-in record creation and status based on purchase workflow
        if (purchaseWorkflow === 'direct') {
            await dbAction('stockInRecords', 'add', {
                warehouseId: warehouseId, date: finalInvoiceDate.toISOString(),
                items: invoiceItems.map(item => ({ itemId: item.id, name: item.name, qty: item.qty, cost: item.cost, expiryDate: item.expiryDate })),
                reason: 'purchase', notes: `استلام مباشر من فاتورة شراء رقم ${invoiceData.invoiceNumber}`,
                receiptNumber: `إذ-د-${await getNextId('stockIn')}`,
                purchaseInvoiceId: newInvoiceId, batchNumber: batchNumberToSave,
                status: 'completed', // Direct receipt is always completed to avoid GIT screen
            });
        } else {
            // In 'manual' workflow, we don't create a stockInRecord here.
            // This will make the invoice appear in the "Goods in Transit" screen.
            console.log("Manual workflow: skipping immediate stock-in creation.");
        }
        
    } catch (error) {
        console.error("Failed to save purchase invoice in background:", error);
    }
  }
  
  const handleItemSelect = (itemId: string) => {
    const selectedItem = allItems.find((i: Item) => i.id === itemId);
    if (selectedItem) {
        const baseUnitOption: SecondaryUnitOption = { value: 'base', label: selectedItem.baseUnit || 'قطعة', factor: 1, price: selectedItem.price || 0, barcode: selectedItem.code || '' };
        const secondaryUnitsOptions: SecondaryUnitOption[] = (selectedItem.secondaryUnits || []).map((u: any) => ({
            value: u.name,
            label: u.name,
            factor: u.conversionFactor,
            price: u.price || 0,
            barcode: u.barcode || '',
        }));
        const allUnits = [baseUnitOption, ...secondaryUnitsOptions];
        setAvailableUnits(allUnits);
        setSelectedUnit('base');

        setNewItem({
            id: itemId,
            name: selectedItem.name,
            qty: 1,
            cost: selectedItem.cost || 0,
            sellingPrice: selectedItem.price || 0,
            unit: selectedItem.baseUnit || 'قطعة',
            code: selectedItem.code || '',
            expiryDate: ""
        });
    }
};
    
     const handleUnitChange = (unitName: string) => {
        setSelectedUnit(unitName);
        const unit = availableUnits.find(u => u.value === unitName);
        const item = allItems.find((i: Item) => i.id === newItem.id);
        if (unit && item) {
             const cost = (item.cost || 0) * unit.factor;
             setNewItem(prev => ({
                 ...prev, 
                 cost: cost,
                 code: unit.barcode || item.code || ''
            }));
        }
    }


  return (
    <>
      <PageHeader title="فاتورة شراء جديدة" />
      <QuickAddDialog open={isQuickSupplierOpen} onOpenChange={setIsQuickSupplierOpen} onConfirm={handleQuickAddSupplier} title="إضافة مورد جديد" label="اسم المورد"/>
      
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6 printable-area">
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                    <CardTitle>فاتورة شراء</CardTitle>
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
                 <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : (
            <>
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="supplier">المورد (المستحقات الحالية تظهر بجانب الاسم)</Label>
                        <div className="flex gap-2">
                             <Combobox
                              options={suppliersForCombobox}
                              value={supplierId}
                              onValueChange={setSupplierId}
                              placeholder="اختر موردًا..."
                              emptyMessage="لم يتم العثور على المورد."
                              className="w-full"
                            />
                            <Button type="button" variant="outline" size="icon" onClick={() => setIsQuickSupplierOpen(true)}><PlusCircle className="h-4 w-4"/></Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="warehouse">المخزن المستلم</Label>
                         <Combobox
                          options={warehouseOptions}
                          value={warehouseId}
                          onValueChange={setWarehouseId}
                          placeholder="اختر مخزنًا..."
                          emptyMessage="لم يتم العثور على المخزن."
                        />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="batch-number">رقم التشغيلة (Batch)</Label>
                        <Input id="batch-number" value={batchNumber} onChange={e => setBatchNumber(e.target.value)} placeholder="اختياري، سيتم إنشاؤه تلقائياً" />
                    </div>
                </div>

                
                <div>
                <Label>بنود الفاتورة</Label>
                <div className="w-full overflow-auto border rounded-lg">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead className="w-[30%]">الصنف</TableHead>
                            <TableHead>الباركود</TableHead>
                            <TableHead className="text-center w-36">الوحدة</TableHead>
                            <TableHead className="text-center w-24">الكمية</TableHead>
                            <TableHead className="text-center w-32">سعر الشراء (التكلفة)</TableHead>
                            <TableHead className="text-center w-32">سعر البيع المقترح</TableHead>
                            <TableHead className="text-center w-40">تاريخ الصلاحية</TableHead>
                            <TableHead className="text-center">الإجمالي</TableHead>
                            <TableHead className="text-center w-[100px] no-print">الإجراء</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {items.map((item, index) => (
                            <TableRow key={item.uniqueId}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell className="font-mono text-xs">{item.code}</TableCell>
                                <TableCell className="text-center">{item.originalUnit}</TableCell>
                                <TableCell className="w-24 p-1"><Input type="number" value={item.qty} className="text-center" onChange={e => handleUpdateItem(item.uniqueId, 'qty', Number(e.target.value))} /></TableCell>
                                <TableCell className="w-32 p-1"><Input type="number" value={item.cost} className="text-center" onChange={e => handleUpdateItem(item.uniqueId, 'cost', Number(e.target.value))} /></TableCell>
                                <TableCell className="w-32 p-1 bg-green-50 dark:bg-green-900/20"><Input type="number" value={item.sellingPrice} className="text-center" onChange={e => handleUpdateItem(item.uniqueId, 'sellingPrice', Number(e.target.value))} /></TableCell>
                                <TableCell className="w-40 p-1"><Input type="date" value={item.expiryDate || ''} className="text-center" onChange={e => handleUpdateItem(item.uniqueId, 'expiryDate', e.target.value)} /></TableCell>
                                <TableCell className="text-center">ج.م {item.total.toFixed(2)}</TableCell>
                                <TableCell className="text-center no-print">
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.uniqueId)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        <TableRow className="no-print bg-muted/20">
                            <TableCell className="p-2">
                                 <Combobox
                                    options={itemsForCombobox}
                                    value={newItem.id}
                                    onValueChange={handleItemSelect}
                                    placeholder="اختر صنفًا..."
                                    emptyMessage="لا توجد أصناف."
                                />
                            </TableCell>
                             <TableCell className="p-2 font-mono text-xs">{newItem.code}</TableCell>
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
                                <Input type="number" placeholder="الكمية" value={newItem.qty} onChange={e => setNewItem({...newItem, qty: parseInt(e.target.value) || 1})} className="text-center" onFocus={e => e.target.select()} />
                            </TableCell>
                            <TableCell className="p-2 w-32">
                                <Input type="number" placeholder="التكلفة" value={newItem.cost || ''} onChange={e => setNewItem({...newItem, cost: parseFloat(e.target.value) || 0})} className="text-center" onFocus={e => e.target.select()} />
                            </TableCell>
                             <TableCell className="p-2 w-32">
                                <Input type="number" placeholder="البيع" value={newItem.sellingPrice || ''} onChange={e => setNewItem({...newItem, sellingPrice: parseFloat(e.target.value) || 0})} className="text-center" onFocus={e => e.target.select()} />
                            </TableCell>
                             <TableCell className="p-2 w-40">
                                <Input type="date" value={newItem.expiryDate} onChange={e => setNewItem({...newItem, expiryDate: e.target.value})} className="text-center" />
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-center p-2">
                                <Button onClick={handleAddItem} size="sm" disabled={!newItem.id}>
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
                                    <li>من ح/ المشتريات (مدين بقيمة المشتريات الصافية)</li>
                                    <li>من ح/ ضريبة القيمة المضافة (مدين بقيمة الضريبة)</li>
                                    <li>إلى ح/ حسابات الموردين (دائن)</li>
                                    {paidAmount > 0 && 
                                    <>
                                        <hr className="my-1" />
                                        <li>من ح/ حسابات الموردين (مدين)</li>
                                        <li>إلى ح/ الخزينة/البنك (دائن)</li>
                                    </>
                                    }
                                </ul>
                            </AlertDescription>
                        </Alert>
                    </div>
                    <div className="w-full md:max-w-sm space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between"><span>الإجمالي الفرعي</span><span>ج.م {subtotal.toFixed(2)}</span></div>
                            <div className="flex justify-between items-center"><span>الخصم</span><Input type="number" value={discount} onFocus={e => e.target.select()} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} className="h-8 max-w-[120px] text-left" placeholder="0.00"/></div>
                            <div className="flex justify-between items-center"><span>تطبيق ضريبة القيمة المضافة (14%)</span><Switch checked={applyTax} onCheckedChange={setApplyTax} /></div>
                            {applyTax && (
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">الأسعار شاملة الضريبة</span>
                                    <Switch checked={isTaxIncluded} onCheckedChange={setIsTaxIncluded} />
                                </div>
                            )}
                            <div className="flex justify-between"><span>ضريبة القيمة المضافة (14%)</span><span>ج.م {tax.toFixed(2)}</span></div>
                            <div className="flex justify-between font-bold text-base border-t pt-2"><span>الإجمالي الكلي</span><span>ج.م {total.toFixed(2)}</span></div>
                        </div>
                        <div className="space-y-2 border-t pt-4">
                            <div className="flex justify-between items-center"><Label htmlFor="paidAmount" className="font-semibold">المبلغ المدفوع</Label><Input id="paidAmount" type="number" value={paidAmount} onFocus={e => e.target.select()} onChange={e => setPaidAmount(parseFloat(e.target.value) || 0)} className="h-8 max-w-[120px] text-left" placeholder="0.00"/></div>
                             {paidAmount > 0 && <div className="space-y-2">
                                <Label htmlFor="paidFromAccount">الدفع من</Label>
                                <Combobox options={cashAccountOptions} value={paidFromAccountId} onValueChange={setPaidFromAccountId} placeholder="اختر حساب الدفع..." emptyMessage="لم يتم العثور على حساب." />
                                {!isBalanceSufficient && paidFromAccountId && <p className="text-xs text-destructive">رصيد هذا الحساب غير كافٍ.</p>}
                            </div>}
                            <div className="flex justify-between font-bold text-base text-destructive"><span>المبلغ المتبقي</span><span>ج.م {(total - paidAmount).toFixed(2)}</span></div>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="notes">ملاحظات</Label>
                    <Textarea id="notes" placeholder="أضف أي ملاحظات هنا..." value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
            </>
            )}
          </CardContent>
          <CardFooter className="flex justify-end no-print">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button size="lg" disabled={loading || isSaving || !isBalanceSufficient}>
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                        تسجيل الفاتورة
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد تحديث أسعار البيع والتكلفة</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل تريد تحديث أسعار البيع والتكاليف الأساسية للأصناف في النظام بناءً على الأسعار في هذه الفاتورة؟
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <Button variant="outline" onClick={() => { handleSaveInvoice(false); const trigger = document.querySelector('[data-state="open"]'); if (trigger) (trigger as HTMLElement).click(); }}>لا، الحفظ بدون تحديث الأسعار</Button>
                        <AlertDialogAction onClick={() => handleSaveInvoice(true)}>نعم، تحديث الأسعار والحفظ</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      </main>
    </>
  );
}
    






