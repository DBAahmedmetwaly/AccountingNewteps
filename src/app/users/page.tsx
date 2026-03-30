
"use client";

import React, { useState, useMemo, useEffect } from "react";
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  PlusCircle,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  CheckCircle,
  UserRound,
  Ban,
  ShieldCheck,
  Search,
  Calendar,
  Phone,
  KeyRound,
  Warehouse,
  User as UserIcon
} from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/permissions-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MultiSelect } from "@/components/ui/multi-select";
import { useAuth } from "@/contexts/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface User {
  id?: string;
  uid?: string;
  name: string;
  phone?: string;
  loginName?: string;
  password?: string; 
  role?: string;
  warehouseIds?: string[];
  isSalesRep?: boolean;
  isCashier?: boolean;
  isDelivery?: boolean;
  isDisabled?: boolean;
  canDeleteFromCart?: boolean;
  canProcessReturn?: boolean;
  canCancelInvoice?: boolean;
  canBypassScannerForReturn?: boolean;
  canOpenOwnShift?: boolean;
  themeSettings?: {
    licenseKey?: string;
    [key: string]: any;
  };
}

const UserForm = ({
  user,
  onSave,
  onClose,
  warehouses,
  roles,
  licenses,
  currentLicenseKey,
}: {
  user?: User;
  onSave: (data: Omit<User, "id"> & { id?: string }) => void;
  onClose: () => void;
  warehouses: any[];
  roles: string[];
  licenses: any[];
  currentLicenseKey?: string;
}) => {
  const [formData, setFormData] = useState<Omit<User, "id" | "uid">>({
    name: user?.name || "",
    phone: user?.phone || "",
    loginName: user?.loginName || "",
    password: "",
    role: user?.role || "",
    warehouseIds: user?.warehouseIds || [],
    isSalesRep: user?.isSalesRep || false,
    isCashier: user?.isCashier || false,
    isDelivery: user?.isDelivery || false,
    isDisabled: user?.isDisabled || false,
    canDeleteFromCart: user?.canDeleteFromCart || false,
    canProcessReturn: user?.canProcessReturn || false,
    canCancelInvoice: user?.canCancelInvoice || false,
    canBypassScannerForReturn: user?.canBypassScannerForReturn || false,
    canOpenOwnShift: user?.canOpenOwnShift || false,
  });

  const warehouseOptions = React.useMemo(() => {
    const licenseKey = user?.themeSettings?.licenseKey || currentLicenseKey;
    const currentLicense = licenseKey ? licenses.find((l: any) => l.key === licenseKey) : null;

    let allowedWarehouses = warehouses;
    let allowAllOption = true;

    if (currentLicense) {
        const assignedIds = currentLicense.assignedWarehouseIds || [];
        if (assignedIds.length > 0) {
            allowedWarehouses = warehouses.filter((w: any) => assignedIds.includes(w.id));
            allowAllOption = false; 
        }
    }

    const options = allowedWarehouses.map((w) => ({ value: w.id, label: w.name }));

    if (user?.isSalesRep) {
        const repWarehouse = warehouses.find(w => w.repId === user.id);
        if (repWarehouse && !allowedWarehouses.find(w => w.id === repWarehouse.id)) {
             options.push({ value: repWarehouse.id, label: repWarehouse.name });
        }
    }

    if (allowAllOption) {
        options.unshift({ value: 'all', label: 'كل الفروع' });
    }

    return options;
  }, [warehouses, licenses, user, currentLicenseKey]);

  const roleOptions = React.useMemo(
    () => roles.map((r) => ({ value: r, label: r })),
    [roles]
  );

  const handleSubmit = () => {
    onSave({
      ...user,
      ...formData,
    });
    onClose();
  };

  const handleWarehouseChange = (selected: string[]) => {
      const hasAll = selected.includes('all');
      if (selected.length > 1 && hasAll) {
          if (formData.warehouseIds?.includes('all')) {
              setFormData({...formData, warehouseIds: selected.filter(id => id !== 'all') });
          } else {
              setFormData({...formData, warehouseIds: ['all'] });
          }
      } else {
          setFormData({...formData, warehouseIds: selected });
      }
  };

  return (
    <div className="space-y-4 py-2 pb-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="employee-name">اسم المستخدم</Label>
          <Input
            id="employee-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employee-phone">رقم الهاتف</Label>
          <Input
            id="employee-phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2 pt-4">
        <h4 className="font-medium text-sm">بيانات الدخول والصلاحيات</h4>
        <Separator />
      </div>

      <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="user-loginName">اسم الدخول</Label>
            <Input
              id="user-loginName"
              type="text"
              value={formData.loginName}
              onChange={(e) => setFormData({ ...formData, loginName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-password">كلمة المرور</Label>
            <Input
              id="user-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder={user ? "اتركه فارغاً لعدم التغيير" : ""}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
           <div className="space-y-2">
            <Label htmlFor="user-role">الوظيفة (الصلاحية)</Label>
            <Combobox
              options={roleOptions}
              value={formData.role || ""}
              onValueChange={(value) => setFormData({ ...formData, role: value })}
              placeholder="اختر وظيفة..."
              emptyMessage="لم يتم العثور على وظيفة."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-warehouse">الفروع المصرح بها</Label>
            <MultiSelect
                options={warehouseOptions}
                selected={formData.warehouseIds || []}
                onChange={handleWarehouseChange}
                placeholder="اختر فرعًا أو أكثر..."
                className="w-full"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Checkbox
              id="is-sales-rep"
              checked={formData.isSalesRep}
              onCheckedChange={(checked) => setFormData({ ...formData, isSalesRep: !!checked })}
            />
            <Label htmlFor="is-sales-rep" className="cursor-pointer">
              مندوب مبيعات
            </Label>
          </div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Checkbox
              id="is-cashier"
              checked={formData.isCashier}
              onCheckedChange={(checked) => setFormData({ ...formData, isCashier: !!checked })}
            />
            <Label htmlFor="is-cashier" className="cursor-pointer">
              كاشير
            </Label>
          </div>
           <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Checkbox
              id="is-delivery"
              checked={formData.isDelivery}
              onCheckedChange={(checked) => setFormData({ ...formData, isDelivery: !!checked })}
            />
            <Label htmlFor="is-delivery" className="cursor-pointer">
              طيار
            </Label>
          </div>
        </div>
         <div className="flex items-center justify-end space-x-2 rtl:space-x-reverse pt-4 border-t mt-4">
            <Label htmlFor="is-disabled" className="cursor-pointer text-destructive font-semibold">
                تعطيل حساب المستخدم
            </Label>
            <Switch
                id="is-disabled"
                checked={formData.isDisabled}
                onCheckedChange={(checked) => setFormData({ ...formData, isDisabled: !!checked })}
            />
        </div>
      </div>
       {formData.isCashier && (
            <div className="space-y-2 pt-4">
                 <h4 className="font-medium text-sm">صلاحيات نقاط البيع</h4>
                <Separator />
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <Checkbox id="canDeleteFromCart" checked={formData.canDeleteFromCart} onCheckedChange={(checked) => setFormData({ ...formData, canDeleteFromCart: !!checked })}/>
                        <Label htmlFor="canDeleteFromCart" className="cursor-pointer">يمكنه حذف صنف من السلة</Label>
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <Checkbox id="canProcessReturn" checked={formData.canProcessReturn} onCheckedChange={(checked) => setFormData({ ...formData, canProcessReturn: !!checked })}/>
                        <Label htmlFor="canProcessReturn" className="cursor-pointer">يمكنه إجراء مرتجع</Label>
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <Checkbox id="canCancelInvoice" checked={formData.canCancelInvoice} onCheckedChange={(checked) => setFormData({ ...formData, canCancelInvoice: !!checked })}/>
                        <Label htmlFor="canCancelInvoice" className="cursor-pointer">يمكنه إلغاء فاتورة بالكامل</Label>
                    </div>
                     <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <Checkbox id="canBypassScannerForReturn" checked={formData.canBypassScannerForReturn} onCheckedChange={(checked) => setFormData({ ...formData, canBypassScannerForReturn: !!checked })}/>
                        <Label htmlFor="canBypassScannerForReturn" className="cursor-pointer">يمكنه إرجاع فاتورة كاملة (وضع المدير)</Label>
                    </div>
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <Checkbox id="canOpenOwnShift" checked={!!formData.canOpenOwnShift} onCheckedChange={(checked) => setFormData({ ...formData, canOpenOwnShift: !!checked })}/>
                        <Label htmlFor="canOpenOwnShift" className="cursor-pointer">يمكنه فتح وردية لنفسه</Label>
                    </div>
                </div>
            </div>
        )}

      <div className="flex justify-end pt-4">
        <Button onClick={handleSubmit}>حفظ المستخدم</Button>
      </div>
    </div>
  );
};

export default function UsersPage() {
  const { users, warehouses, roles: rolesData, cashAccounts: cashAccountsData, loading, dbAction, licenses } = useData();
  const { user } = useAuth();
  const { toast } = useToast();
  const { can } = usePermissions();
  const isMobile = useIsMobile();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    
    let filtered = users;
    if (user?.id !== 'superadmin') {
      const userLicense = user?.themeSettings?.licenseKey;
      filtered = users.filter((u: any) => u.themeSettings?.licenseKey === userLicense);
    }

    if (!searchTerm) return filtered;
    
    return filtered.filter((u: any) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.phone?.includes(searchTerm) ||
      u.loginName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, user, searchTerm]);

  const moduleName = "settings_users";
  const roleNames = rolesData ? Object.keys(rolesData) : [];

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setTimeout(() => setIsEditOpen(true), 150);
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setTimeout(() => setIsDeleteAlertOpen(true), 150);
  };

  const handleSave = async (userData: User) => {
    try {
        const userToUpdate = userData.id ? users.find((u: any) => u.id === userData.id) : null;
        const isCurrentlyRep = userToUpdate?.isSalesRep || false;
        const willBeRep = userData.isSalesRep || false;

        const activeLicenses = (licenses || []).filter((l: any) => 
            l.status !== 'expired' && (!l.endDate || new Date(l.endDate) > new Date())
        );

        const targetWarehouses = userData.warehouseIds || [];
        
        if (targetWarehouses.includes('all')) {
             const globalLicense = activeLicenses.find((l: any) => !l.assignedWarehouseIds || l.assignedWarehouseIds.length === 0);
             if (!globalLicense) {
                 return toast({ variant: "destructive", title: "خطأ في الترخيص", description: "لا توجد رخصة عامة (Global) سارية لتغطية خيار 'كل الفروع'." });
             }
             
             const totalUsers = users.filter((u: any) => !u.isDisabled && u.id !== userData.id).length;
             if (totalUsers + 1 > (globalLicense.maxUsers || 5)) {
                 return toast({ variant: "destructive", title: "تجاوز الحد المسموح", description: `عفواً، تم تجاوز الحد الأقصى للمستخدمين (${globalLicense.maxUsers}) المسموح به في الرخصة العامة.` });
             }
        } else {
            for (const warehouseId of targetWarehouses) {
                let license = activeLicenses.find((l: any) => l.assignedWarehouseIds?.includes(warehouseId));
                if (!license) {
                    license = activeLicenses.find((l: any) => !l.assignedWarehouseIds || l.assignedWarehouseIds.length === 0);
                }

                if (!license) {
                     const warehouseName = warehouses.find((w: any) => w.id === warehouseId)?.name || warehouseId;
                     return toast({ variant: "destructive", title: "خطأ في الترخيص", description: `لا توجد رخصة سارية تغطي الفرع: ${warehouseName}` });
                }

                const coveredWarehouses = license.assignedWarehouseIds || []; 
                
                const usersConsumingLicense = users.filter((u: any) => {
                    if (u.isDisabled) return false;
                    if (u.id === userData.id) return false;
                    const uWarehouses = u.warehouseIds || [];
                    if (coveredWarehouses.length === 0) return true;
                    if (uWarehouses.includes('all')) return true;
                    return uWarehouses.some((id: string) => coveredWarehouses.includes(id));
                });

                if (usersConsumingLicense.length + 1 > (license.maxUsers || 5)) {
                     const warehouseName = warehouses.find((w: any) => w.id === warehouseId)?.name || warehouseId;
                     return toast({ variant: "destructive", title: "تجاوز الحد المسموح", description: `لا يمكن إضافة المستخدم للفرع (${warehouseName}). تم الوصول للحد الأقصى (${license.maxUsers}) للرخصة المطبقة.` });
                }
            }
        }

        if (userData.id) { 
            if (!can("edit", moduleName)) return toast({ variant: "destructive", title: "غير مصرح به" });

            const { id, ...dataToUpdate } = userData;
            
            if (willBeRep && !isCurrentlyRep) {
                const warehouseName = `عهدة المندوب: ${dataToUpdate.name}`;
                const newWarehouseId = await dbAction('warehouses', 'add', { name: warehouseName, isRepWarehouse: true, repId: id });
                await dbAction('cashAccounts', 'add', { name: `عهدة: ${dataToUpdate.name}`, type: 'cash', openingBalance: 0, userId: id });
                const currentIds = dataToUpdate.warehouseIds || [];
                dataToUpdate.warehouseIds = newWarehouseId ? [...currentIds, newWarehouseId as string] : currentIds;
            } else if (!willBeRep && isCurrentlyRep) {
                const repWarehouse = warehouses.find((w: any) => w.repId === id);
                if (repWarehouse) await dbAction('warehouses', 'remove', { id: repWarehouse.id });
                const repCashAccount = cashAccountsData.find((acc: any) => acc.userId === id);
                if (repCashAccount) await dbAction('cashAccounts', 'remove', { id: repCashAccount.id });
                dataToUpdate.warehouseIds = [];
            }

            if (willBeRep && id) {
                 const repWarehouse = warehouses.find((w: any) => w.repId === id);
                 if (repWarehouse) {
                     const currentIds = dataToUpdate.warehouseIds || [];
                     if (!currentIds.includes(repWarehouse.id)) {
                         dataToUpdate.warehouseIds = [...currentIds, repWarehouse.id];
                     }
                 }
            }

            const userRecord: any = { ...dataToUpdate };
            if (!dataToUpdate.password) delete userRecord.password;

            await dbAction("users", "update", { id, data: userRecord });
            toast({ title: "تم تحديث بيانات المستخدم بنجاح" });

        } else { 
            if (!can("add", moduleName)) return toast({ variant: "destructive", title: "غير مصرح به" });
            if (!userData.password || !userData.loginName) return toast({ variant: "destructive", title: "خطأ", description: "اسم الدخول وكلمة المرور مطلوبان." });
            
            const creatorLicenseKey = user?.themeSettings?.licenseKey;
            let userRecord: any = { 
                ...userData, 
                uid: `db_${Date.now()}`,
                themeSettings: userData.themeSettings || (creatorLicenseKey ? { licenseKey: creatorLicenseKey, licenseStatus: 'active' } : undefined)
            };

            const newUserId = await dbAction("users", "add", userRecord) as string;
            
            if (willBeRep && newUserId) {
                 const warehouseName = `عهدة المندوب: ${userData.name}`;
                 const newWarehouseId = await dbAction('warehouses', 'add', { name: warehouseName, isRepWarehouse: true, repId: newUserId }) as string;
                 await dbAction('cashAccounts', 'add', { name: `عهدة: ${userData.name}`, type: 'cash', openingBalance: 0, userId: newUserId });
                 const currentSelected = userData.warehouseIds || [];
                 const newIds = [...currentSelected, newWarehouseId];
                 await dbAction('users', 'update', {id: newUserId, data: { warehouseIds: newIds }});
            }

            toast({ title: "تمت إضافة المستخدم بنجاح" });
        }
    } catch (error: any) {
        toast({ variant: "destructive", title: "خطأ في الحفظ", description: "فشل حفظ بيانات المستخدم." });
    }
  };

  const handleDelete = async (targetUser: any) => {
    if (!can("delete", moduleName) || !targetUser.id)
      return toast({ variant: "destructive", title: "غير مصرح به" });

    try {
      if (targetUser.isSalesRep) {
        const repWarehouse = warehouses.find((w: any) => w.repId === targetUser.id);
        if (repWarehouse) await dbAction('warehouses', 'remove', { id: repWarehouse.id });
        const repCashAccount = cashAccountsData.find((acc: any) => acc.userId === targetUser.id);
        if (repCashAccount) await dbAction('cashAccounts', 'remove', { id: repCashAccount.id });
      }
      await dbAction("users", "remove", { id: targetUser.id });
      toast({ title: "تم الحذف", description: "تم حذف المستخدم وبياناته المرتبطة." });
    } catch (error) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل حذف المستخدم." });
    }
  };

  const getWarehouseNames = (u: any) => {
    let ids = u.warehouseIds || [];
    if (ids.length === 0 && u.themeSettings?.licenseKey && licenses) {
        const license = licenses.find((l: any) => l.key === u.themeSettings.licenseKey);
        if (license) ids = license.assignedWarehouseIds || [];
        if (ids.length === 0) return "كل الفروع (ترخيص عام)";
    }
    if (!ids || ids.length === 0) return 'غير محدد';
    if (ids.includes('all')) return "كل الفروع";
    return ids.map((id: string) => warehouses.find((w: any) => w.id === id)?.name || id).join(', ');
  };

  const getUsedLicenseKey = (u: any) => {
      if (u.themeSettings?.licenseKey) return u.themeSettings.licenseKey;
      if (!licenses) return '-';
      const userWarehouses = u.warehouseIds || [];
      if (userWarehouses.length === 0) return '-';
      const activeLicenses = licenses.filter((l: any) => l.status !== 'expired');
      const specificLicense = activeLicenses.find((l: any) => (l.assignedWarehouseIds || []).some((id: string) => userWarehouses.includes(id)));
      if (specificLicense) return specificLicense.key;
      const globalLicense = activeLicenses.find((l: any) => !l.assignedWarehouseIds || l.assignedWarehouseIds.length === 0);
      return globalLicense ? globalLicense.key : '-';
  };

  return (
    <>
      <PageHeader title="إدارة المستخدمين">
        {can("add", moduleName) && (
          <AddEntityDialog
            title="إضافة مستخدم جديد"
            description="أدخل بيانات المستخدم وصلاحياته."
            triggerButton={
              <Button size="sm" className="gap-1">
                <PlusCircle className="h-4 w-4" />
                إضافة مستخدم
              </Button>
            }
          >
            {({ onClose }) => (
                <UserForm
                onSave={handleSave}
                onClose={onClose}
                warehouses={warehouses}
                roles={roleNames}
                licenses={licenses}
                currentLicenseKey={user?.themeSettings?.licenseKey}
                />
            )}
          </AddEntityDialog>
        )}
      </PageHeader>
      <main className="flex flex-1 flex-col gap-4 p-2 md:p-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div>
                <CardTitle className="text-xl">قائمة المستخدمين والمناديب</CardTitle>
                <CardDescription>عرض وتعديل بيانات المستخدمين وصلاحياتهم الفنية والبيعية.</CardDescription>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم أو الهاتف..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-9 h-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="w-full">
                {isMobile ? (
                  <div className="space-y-3 p-3">
                    {filteredUsers.length > 0 ? filteredUsers.map((u: any) => (
                      <Card key={u.id} className={cn("overflow-hidden border-r-4 shadow-sm", u.isDisabled ? "border-r-destructive opacity-80" : "border-r-primary")}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="space-y-1">
                              <div className="font-bold text-base leading-tight flex items-center gap-2">
                                {u.name}
                                {u.isDisabled && <Badge variant="destructive" className="text-[9px] h-4">معطل</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                                <UserRound className="h-3 w-3"/>
                                {u.loginName}
                                {u.phone && <><span className="mx-1">•</span><Phone className="h-3 w-3"/>{u.phone}</>}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 py-3 border-t border-b border-muted">
                             <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">الفروع</span>
                                <p className="text-xs font-medium line-clamp-1 flex items-center gap-1"><Warehouse className="h-3 w-3 shrink-0"/>{getWarehouseNames(u)}</p>
                             </div>
                             <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">الترخيص</span>
                                <p className="text-[10px] font-mono line-clamp-1 flex items-center gap-1"><KeyRound className="h-3 w-3 shrink-0"/>{getUsedLicenseKey(u)}</p>
                             </div>
                          </div>

                          <div className="flex justify-between items-center pt-3">
                            <div className="flex gap-1">
                               {u.isSalesRep && <TooltipProvider><Tooltip><TooltipTrigger asChild><Badge variant="secondary" className="h-5 px-1.5"><UserIcon className="h-3 w-3"/></Badge></TooltipTrigger><TooltipContent>مندوب</TooltipContent></Tooltip></TooltipProvider>}
                               {u.isCashier && <TooltipProvider><Tooltip><TooltipTrigger asChild><Badge variant="secondary" className="h-5 px-1.5"><ShieldCheck className="h-3 w-3"/></Badge></TooltipTrigger><TooltipContent>كاشير</TooltipContent></Tooltip></TooltipProvider>}
                               {u.isDelivery && <TooltipProvider><Tooltip><TooltipTrigger asChild><Badge variant="secondary" className="h-5 px-1.5"><Truck className="h-3 w-3"/></Badge></TooltipTrigger><TooltipContent>طيار</TooltipContent></Tooltip></TooltipProvider>}
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEditClick(u)}><Edit className="h-4 w-4"/></Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDeleteClick(u)}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )) : <div className="text-center py-20 text-muted-foreground italic">لا يوجد مستخدمون يطابقون البحث.</div>}
                  </div>
                ) : (
                  <div className="w-full overflow-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>اسم المستخدم</TableHead>
                          <TableHead className="hidden md:table-cell">اسم الدخول</TableHead>
                          <TableHead className="text-center">مندوب</TableHead>
                          <TableHead className="text-center">كاشير</TableHead>
                          <TableHead className="text-center">طيار</TableHead>
                          <TableHead className="text-center">الوظيفة</TableHead>
                          <TableHead className="hidden md:table-cell">الفرع</TableHead>
                          <TableHead className="hidden lg:table-cell text-center">الترخيص</TableHead>
                          <TableHead className="text-center">الحالة</TableHead>
                          <TableHead className="text-center w-[100px]">الإجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((u: any) => {
                          return (
                            <TableRow key={u.id} className={cn(u.isDisabled && "bg-muted/30 opacity-70")}>
                              <TableCell className="font-medium">{u.name}</TableCell>
                              <TableCell className="font-mono hidden md:table-cell">{u.loginName}</TableCell>
                              <TableCell className="text-center">
                                {u.isSalesRep && (
                                  <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {u.isCashier && (
                                  <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                                )}
                              </TableCell>
                               <TableCell className="text-center">
                                {u.isDelivery && (
                                  <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">{u.role}</Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {getWarehouseNames(u)}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-center font-mono text-[10px]">
                                  {getUsedLicenseKey(u)}
                              </TableCell>
                               <TableCell className="text-center">
                                <Badge variant={u.isDisabled ? "destructive" : "default"} className="text-[10px] h-5">
                                    {u.isDisabled ? 'معطل' : 'نشط'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button aria-haspopup="true" size="icon" variant="ghost">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>إجراءات المستخدم</DropdownMenuLabel>
                                    {can("edit", moduleName) && (
                                      <DropdownMenuItem onSelect={() => handleEditClick(u)}>
                                        <Edit className="ml-2 h-4 w-4" />
                                        تعديل البيانات
                                      </DropdownMenuItem>
                                    )}
                                    {can("delete", moduleName) && (
                                      <DropdownMenuItem
                                        className="text-destructive font-semibold"
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            handleDeleteClick(u);
                                        }}
                                      >
                                        <Trash2 className="ml-2 h-4 w-4" />
                                        حذف نهائي
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات المستخدم</DialogTitle>
            <DialogDescription>قم بتحديث تفاصيل الحساب والصلاحيات.</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <UserForm
              user={editingUser}
              onSave={handleSave}
              onClose={() => setIsEditOpen(false)}
              warehouses={warehouses}
              roles={roleNames}
              licenses={licenses}
              currentLicenseKey={user?.themeSettings?.licenseKey}
            />
          )}
        </DialogContent>
      </Dialog>

      {userToDelete && (
        <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive"/> تأكيد حذف المستخدم</AlertDialogTitle>
              <AlertDialogDescription>
                أنت على وشك حذف المستخدم <span className="font-bold">"{userToDelete.name}"</span> بشكل نهائي. 
                إذا كان هذا المستخدم مندوب مبيعات، سيتم أيضاً حذف مخزن وخزينة عهدته.
                <br/><br/>
                <span className="text-destructive font-bold">تحذير: لا يمكن التراجع عن هذا الإجراء.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete(userToDelete)} className="bg-destructive hover:bg-destructive/90">
                نعم، قم بالحذف الآن
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
