

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

interface User {
  id?: string;
  uid?: string;
  name: string;
  phone?: string;
  loginName?: string;
  password?: string; // Password can be optional as we might not want to expose it everywhere
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
    // 1. Identify the active license for this user (if any)
    const licenseKey = user?.themeSettings?.licenseKey || currentLicenseKey;
    const currentLicense = licenseKey ? licenses.find((l: any) => l.key === licenseKey) : null;

    // 2. Determine allowed warehouses based on license
    let allowedWarehouses = warehouses;
    let allowAllOption = true;

    if (currentLicense) {
        const assignedIds = currentLicense.assignedWarehouseIds || [];
        if (assignedIds.length > 0) {
            // Specific license: Filter warehouses
            allowedWarehouses = warehouses.filter((w: any) => assignedIds.includes(w.id));
            allowAllOption = false; // Specific license users shouldn't select "All Branches" (Global)
        }
    }

    // 3. Build options
    const options = allowedWarehouses.map((w) => ({ value: w.id, label: w.name }));

    // 4. Add "Delegate Warehouse" if user is a rep (to ensure it shows nicely if selected)
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
  }, [warehouses, licenses, user]);
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
        <div className="flex items-center space-x-4 pt-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-sales-rep"
              checked={formData.isSalesRep}
              onCheckedChange={(checked) => setFormData({ ...formData, isSalesRep: !!checked })}
            />
            <Label htmlFor="is-sales-rep" className="cursor-pointer">
              مندوب مبيعات
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-cashier"
              checked={formData.isCashier}
              onCheckedChange={(checked) => setFormData({ ...formData, isCashier: !!checked })}
            />
            <Label htmlFor="is-cashier" className="cursor-pointer">
              كاشير (لنقاط البيع)
            </Label>
          </div>
           <div className="flex items-center space-x-2">
            <Checkbox
              id="is-delivery"
              checked={formData.isDelivery}
              onCheckedChange={(checked) => setFormData({ ...formData, isDelivery: !!checked })}
            />
            <Label htmlFor="is-delivery" className="cursor-pointer">
              موظف توصيل (طيار)
            </Label>
          </div>
        </div>
         <div className="flex items-center justify-end space-x-2 pt-4">
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
                    <div className="flex items-center space-x-2">
                        <Checkbox id="canDeleteFromCart" checked={formData.canDeleteFromCart} onCheckedChange={(checked) => setFormData({ ...formData, canDeleteFromCart: !!checked })}/>
                        <Label htmlFor="canDeleteFromCart" className="cursor-pointer">يمكنه حذف صنف من السلة</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="canProcessReturn" checked={formData.canProcessReturn} onCheckedChange={(checked) => setFormData({ ...formData, canProcessReturn: !!checked })}/>
                        <Label htmlFor="canProcessReturn" className="cursor-pointer">يمكنه إجراء مرتجع</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="canCancelInvoice" checked={formData.canCancelInvoice} onCheckedChange={(checked) => setFormData({ ...formData, canCancelInvoice: !!checked })}/>
                        <Label htmlFor="canCancelInvoice" className="cursor-pointer">يمكنه إلغاء فاتورة بالكامل</Label>
                    </div>
                     <div className="flex items-center space-x-2">
                        <Checkbox id="canBypassScannerForReturn" checked={formData.canBypassScannerForReturn} onCheckedChange={(checked) => setFormData({ ...formData, canBypassScannerForReturn: !!checked })}/>
                        <Label htmlFor="canBypassScannerForReturn" className="cursor-pointer">يمكنه إرجاع فاتورة كاملة (وضع المدير)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
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
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    
    // 1. First, filter by license (if current user is not a super-admin)
    let filtered = users;
    if (user?.id !== 'superadmin') {
      const userLicense = user?.themeSettings?.licenseKey;
      filtered = users.filter((u: any) => u.themeSettings?.licenseKey === userLicense);
    }

    // 2. Then filter by search term
    if (!searchTerm) return filtered;
    
    return filtered.filter((u: any) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.phone?.includes(searchTerm) ||
      u.loginName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, user, searchTerm]);

  useEffect(() => {
    if (!isEditOpen && !isDeleteAlertOpen) {
        document.body.style.pointerEvents = 'auto';
    }
  }, [isEditOpen, isDeleteAlertOpen]);

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

        // --- License Validation Logic ---
        // 1. Identify active licenses
        const activeLicenses = (licenses || []).filter((l: any) => 
            l.status !== 'expired' && (!l.endDate || new Date(l.endDate) > new Date())
        );

        const targetWarehouses = userData.warehouseIds || [];
        
        // We need to check if adding this user to these warehouses violates any license limits.
        // Strategy: For each target warehouse, find the controlling license. 
        // Then check that license's utilization.

        // If target is 'all', we look for a global license.
        if (targetWarehouses.includes('all')) {
             const globalLicense = activeLicenses.find((l: any) => !l.assignedWarehouseIds || l.assignedWarehouseIds.length === 0);
             if (!globalLicense) {
                 return toast({ variant: "destructive", title: "خطأ في الترخيص", description: "لا توجد رخصة عامة (Global) سارية لتغطية خيار 'كل الفروع'." });
             }
             
             // Count total users in system (active)
             const totalUsers = users.filter((u: any) => !u.isDisabled && u.id !== userData.id).length;
             if (totalUsers + 1 > (globalLicense.maxUsers || 5)) {
                 return toast({ variant: "destructive", title: "تجاوز الحد المسموح", description: `عفواً، تم تجاوز الحد الأقصى للمستخدمين (${globalLicense.maxUsers}) المسموح به في الرخصة العامة.` });
             }
        } else {
            // Specific warehouses
            for (const warehouseId of targetWarehouses) {
                // Find license for this warehouse. 
                // Priority: Specific License > Global License
                let license = activeLicenses.find((l: any) => l.assignedWarehouseIds?.includes(warehouseId));
                if (!license) {
                    license = activeLicenses.find((l: any) => !l.assignedWarehouseIds || l.assignedWarehouseIds.length === 0);
                }

                if (!license) {
                     const warehouseName = warehouses.find((w: any) => w.id === warehouseId)?.name || warehouseId;
                     return toast({ variant: "destructive", title: "خطأ في الترخيص", description: `لا توجد رخصة سارية تغطي الفرع: ${warehouseName}` });
                }

                // Calculate utilization for this license
                // Users consume this license if they are assigned to ANY warehouse covered by this license.
                const coveredWarehouses = license.assignedWarehouseIds || []; // Empty means all
                
                const usersConsumingLicense = users.filter((u: any) => {
                    if (u.isDisabled) return false;
                    if (u.id === userData.id) return false;
                    
                    const uWarehouses = u.warehouseIds || [];
                    
                    // If license is global, ALL users consume it
                    if (coveredWarehouses.length === 0) return true;

                    // If user has 'all', they consume this license (since they access this branch)
                    if (uWarehouses.includes('all')) return true;

                    // Intersection
                    return uWarehouses.some((id: string) => coveredWarehouses.includes(id));
                });

                if (usersConsumingLicense.length + 1 > (license.maxUsers || 5)) {
                     const warehouseName = warehouses.find((w: any) => w.id === warehouseId)?.name || warehouseId;
                     return toast({ variant: "destructive", title: "تجاوز الحد المسموح", description: `لا يمكن إضافة المستخدم للفرع (${warehouseName}). تم الوصول للحد الأقصى (${license.maxUsers}) للرخصة المطبقة.` });
                }
            }
        }
        // --- End License Validation ---

        if (userData.id) { // This is an update
            if (!can("edit", moduleName)) return toast({ variant: "destructive", title: "غير مصرح به" });

            const { id, ...dataToUpdate } = userData;
            
            // Check if Sales Rep status changed
            if (willBeRep && !isCurrentlyRep) {
                // Toggled ON: Create custody accounts if they don't exist
                const warehouseName = `عهدة المندوب: ${dataToUpdate.name}`;
                const newWarehouseId = await dbAction('warehouses', 'add', { name: warehouseName, isRepWarehouse: true, repId: id });
                await dbAction('cashAccounts', 'add', { name: `عهدة: ${dataToUpdate.name}`, type: 'cash', openingBalance: 0, userId: id });
                // Merge new warehouse with existing selections
                const currentIds = dataToUpdate.warehouseIds || [];
                dataToUpdate.warehouseIds = newWarehouseId ? [...currentIds, newWarehouseId as string] : currentIds;
            } else if (!willBeRep && isCurrentlyRep) {
                // Toggled OFF: Delete custody accounts
                const repWarehouse = warehouses.find((w: any) => w.repId === id);
                if (repWarehouse) await dbAction('warehouses', 'remove', { id: repWarehouse.id });
                
                const repCashAccount = cashAccountsData.find((acc: any) => acc.userId === id);
                if (repCashAccount) await dbAction('cashAccounts', 'remove', { id: repCashAccount.id });
                
                dataToUpdate.warehouseIds = [];
            }

            // Ensure Rep Warehouse is preserved if user is a Sales Rep
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
            if (!dataToUpdate.password) {
                delete userRecord.password;
            }

            await dbAction("users", "update", { id, data: userRecord });
            toast({ title: "تم تحديث بيانات المستخدم بنجاح" });

        } else { // This is a new user
            if (!can("add", moduleName)) return toast({ variant: "destructive", title: "غير مصرح به" });
            if (!userData.password || !userData.loginName) return toast({ variant: "destructive", title: "خطأ", description: "اسم الدخول وكلمة المرور مطلوبان." });
            
            // --- Auto-assign license from creator ---
            const creatorLicenseKey = user?.themeSettings?.licenseKey;
            let userRecord: any = { 
                ...userData, 
                uid: `db_${Date.now()}`,
                themeSettings: userData.themeSettings || (creatorLicenseKey ? { licenseKey: creatorLicenseKey, licenseStatus: 'active' } : undefined)
            };
            // --- End Auto-assign ---

            const newUserId = await dbAction("users", "add", userRecord) as string;
            
            if (willBeRep && newUserId) {
                 const warehouseName = `عهدة المندوب: ${userData.name}`;
                 const newWarehouseId = await dbAction('warehouses', 'add', { name: warehouseName, isRepWarehouse: true, repId: newUserId }) as string;
                 await dbAction('cashAccounts', 'add', { name: `عهدة: ${userData.name}`, type: 'cash', openingBalance: 0, userId: newUserId });
                 
                 // Update the newly created user with their dedicated warehouse ID (merged with selection)
                 const currentSelected = userData.warehouseIds || [];
                 const newIds = [...currentSelected, newWarehouseId];
                 await dbAction('users', 'update', {id: newUserId, data: { warehouseIds: newIds }});
            }

            toast({ title: "تمت إضافة المستخدم بنجاح" });
        }
    } catch (error: any) {
        toast({ variant: "destructive", title: "خطأ في الحفظ", description: "فشل حفظ بيانات المستخدم." });
        console.error("User save failed:", error);
    }
  };

  const handleDelete = async (user: any) => {
    if (!can("delete", moduleName) || !user.id)
      return toast({ variant: "destructive", title: "غير مصرح به" });

    try {
      // 1. Find and delete the rep's warehouse if it exists
      if (user.isSalesRep) {
        const repWarehouse = warehouses.find((w: any) => w.repId === user.id);
        if (repWarehouse) {
          await dbAction('warehouses', 'remove', { id: repWarehouse.id });
        }
        
        // 2. Find and delete the rep's cash account if it exists
        const repCashAccount = cashAccountsData.find((acc: any) => acc.userId === user.id);
        if (repCashAccount) {
          await dbAction('cashAccounts', 'remove', { id: repCashAccount.id });
        }
      }

      // 3. Delete the user record itself
      await dbAction("users", "remove", { id: user.id });
      
      toast({
        title: "تم الحذف",
        description: "تم حذف المستخدم وبياناته المرتبطة من قاعدة البيانات.",
      });
    } catch (error) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل حذف المستخدم." });
      console.error(error);
    }
  };

  const getWarehouseName = (user: any) => {
    let ids = user.warehouseIds || [];

    // Fallback to license if no ids directly assigned
    if (ids.length === 0 && user.themeSettings?.licenseKey && licenses) {
        const license = licenses.find((l: any) => l.key === user.themeSettings.licenseKey);
        if (license) {
            ids = license.assignedWarehouseIds || [];
            // If license has no assigned warehouses, it might be global (all)
            if (ids.length === 0) return "كل الفروع (ترخيص عام)";
        }
    }

    if (!ids || ids.length === 0) return 'غير محدد';
    if (ids.includes('all')) return "كل الفروع";
    return ids.map((id: string) => warehouses.find((w: any) => w.id === id)?.name || id).join(', ');
  };

  const getUsedLicense = (user: any) => {
      if (user.themeSettings?.licenseKey) return user.themeSettings.licenseKey;
      if (!licenses) return '-';

      const userWarehouses = user.warehouseIds || [];
      if (userWarehouses.length === 0) return '-';

      const activeLicenses = licenses.filter((l: any) => l.status !== 'expired');

      // 1. Check for specific license match
      const specificLicense = activeLicenses.find((l: any) => {
          const licWarehouses = l.assignedWarehouseIds || [];
          if (licWarehouses.length === 0) return false; // Skip global
          return userWarehouses.some((id: string) => licWarehouses.includes(id));
      });
      
      if (specificLicense) return specificLicense.key;

      // 2. Check for global license
      const globalLicense = activeLicenses.find((l: any) => !l.assignedWarehouseIds || l.assignedWarehouseIds.length === 0);
      if (globalLicense) return globalLicense.key;

      return '-';
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
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div>
                <CardTitle>قائمة المستخدمين</CardTitle>
                <CardDescription>
                  عرض وتعديل بيانات المستخدمين وصلاحياتهم.
                </CardDescription>
              </div>
              <div className="w-full md:w-1/3">
                <Input
                  placeholder="بحث بالاسم..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
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
                    {filteredUsers.map((user: any) => {
                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell className="font-mono hidden md:table-cell">{user.loginName}</TableCell>
                          <TableCell className="text-center">
                            {user.isSalesRep && (
                              <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {user.isCashier && (
                              <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                            )}
                          </TableCell>
                           <TableCell className="text-center">
                            {user.isDelivery && (
                              <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{user.role}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {getWarehouseName(user)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-center font-mono text-xs">
                              {getUsedLicense(user)}
                          </TableCell>
                           <TableCell className="text-center">
                            <Badge variant={user.isDisabled ? "destructive" : "default"}>
                                {user.isDisabled ? 'معطل' : 'نشط'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">قائمة الإجراءات</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                {can("edit", moduleName) && (
                                  <DropdownMenuItem onSelect={() => handleEditClick(user)}>
                                    <Edit className="ml-2 h-4 w-4" />
                                    تعديل
                                  </DropdownMenuItem>
                                )}
                                {can("delete", moduleName) && (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onSelect={(e) => {
                                        e.preventDefault();
                                        handleDeleteClick(user);
                                    }}
                                  >
                                    <Trash2 className="ml-2 h-4 w-4" />
                                    حذف
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
          </CardContent>
        </Card>
      </main>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent 
            className="sm:max-w-4xl"
        >
          <DialogHeader>
            <DialogTitle>تعديل بيانات المستخدم</DialogTitle>
            <DialogDescription>قم بتحديث بيانات المستخدم هنا.</DialogDescription>
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
              <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
              <AlertDialogDescription>
                هذا الإجراء سيحذف المستخدم بشكل دائم. إذا كان مندوبًا، سيتم حذف مخزن وخزينة عهدته أيضًا. لا يمكن
                التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete(userToDelete)}>
                متابعة
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
