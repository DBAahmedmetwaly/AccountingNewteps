"use client";

import React, { useState, useMemo } from 'react';
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useData, PARTITION_CONFIG, getPartitionRelativePath } from "@/contexts/data-provider";
import { Loader2, RefreshCw, AlertTriangle, Trash2, Database } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ref, get, set, remove } from 'firebase/database';
import { database } from '@/lib/firebase';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function DatabaseReEngineeringPage() {
    const { allData, isOnline, dbAction } = useData();
    const { toast } = useToast();
    const [status, setStatus] = useState<'idle' | 'scanning' | 'migrating' | 'completed' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [currentCollection, setCurrentCollection] = useState('');
    const [logs, setLogs] = useState<string[]>([]);

    const collectionsToProcess = useMemo(() => Object.keys(PARTITION_CONFIG), []);

    const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 50));

    const handleReEngineer = async () => {
        if (!isOnline || !database) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'يجب أن تكون متصلاً بالإنترنت لإجراء هذه العملية.' });
            return;
        }

        setStatus('scanning');
        setLogs([]);
        addLog("بدء عملية فحص قاعدة البيانات...");
        setProgress(0);

        try {
            for (let i = 0; i < collectionsToProcess.length; i++) {
                const collectionName = collectionsToProcess[i];
                setCurrentCollection(collectionName);
                const dateKey = PARTITION_CONFIG[collectionName];
                
                addLog(`فحص المجموعة: ${collectionName}...`);
                
                const collRef = ref(database, collectionName);
                const snapshot = await get(collRef);
                
                if (!snapshot.exists()) {
                    addLog(`تجاوز ${collectionName}: لا توجد بيانات.`);
                    continue;
                }

                const data = snapshot.val();
                const entries = Object.entries(data);
                
                // Filter entries that are NOT already in the new structure (they have a date field at top level)
                const flatEntries = entries.filter(([, val]: [string, any]) => val && val[dateKey]);

                if (flatEntries.length === 0) {
                    addLog(`${collectionName} منظمة بالفعل.`);
                } else {
                    addLog(`تم العثور على ${flatEntries.length} سجل غير منظم في ${collectionName}.`);
                    setStatus('migrating');

                    const batchSize = 20;
                    for (let j = 0; j < flatEntries.length; j += batchSize) {
                        const batch = flatEntries.slice(j, j + batchSize);
                        const updates: any = {};

                        batch.forEach(([id, val]: [string, any]) => {
                            const dateVal = val[dateKey];
                            const relativePath = getPartitionRelativePath(collectionName, dateVal);
                            if (relativePath) {
                                updates[`${collectionName}/${relativePath}/${id}`] = val;
                            }
                        });

                        // 1. Copy to new structure
                        for (const [path, content] of Object.entries(updates)) {
                            await set(ref(database, path), content);
                        }
                        
                        addLog(`تم نقل الدفعة ${Math.floor(j/batchSize) + 1} من ${collectionName}.`);
                    }
                }
                
                setProgress(((i + 1) / collectionsToProcess.length) * 100);
            }

            setStatus('completed');
            addLog("اكتملت عملية إعادة هندسة قاعدة البيانات بنجاح.");
            toast({ title: 'نجاح', description: 'تم تنظيم البيانات في الهيكل الزمني الجديد.' });
        } catch (error: any) {
            console.error(error);
            setStatus('error');
            addLog(`خطأ: ${error.message}`);
            toast({ variant: 'destructive', title: 'خطأ في العملية', description: error.message });
        }
    };

    const cleanupOldData = async () => {
        if (!confirm('سيتم حذف البيانات من المسارات القديمة (المسطحة). تأكد من اكتمال عملية النقل أولاً. هل تريد المتابعة؟')) return;
        
        setStatus('migrating');
        addLog("بدء عملية تنظيف المسارات القديمة...");
        
        try {
            if (!database) return;
            for (const collectionName of collectionsToProcess) {
                const dateKey = PARTITION_CONFIG[collectionName];
                const collRef = ref(database, collectionName);
                const snapshot = await get(collRef);
                
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const flatEntries = Object.entries(data).filter(([, val]: [string, any]) => val && val[dateKey]);
                    
                    for (const [id] of flatEntries) {
                        await remove(ref(database, `${collectionName}/${id}`));
                    }
                    if (flatEntries.length > 0) addLog(`تم تنظيف ${flatEntries.length} سجل من ${collectionName}.`);
                }
            }
            addLog("تم الانتهاء من التنظيف.");
            setStatus('completed');
        } catch (e: any) {
            addLog(`خطأ في التنظيف: ${e.message}`);
            setStatus('error');
        }
    };

    return (
        <>
            <PageHeader title="إعادة هندسة قاعدة البيانات" />
            <main className="flex-1 p-4 md:p-6 space-y-6">
                <Card className="border-primary/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Database className="text-primary"/> تنظيم البيانات التشغيلية</CardTitle>
                        <CardDescription>
                            تقوم هذه الأداة بإعادة تنظيم الفواتير، الحركات، والعمليات المالية في هيكل زمني (سنة-شهر/يوم) لتحسين سرعة البحث والتقارير.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 text-amber-900 dark:text-amber-100">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>تنبيه هام</AlertTitle>
                            <AlertDescription>
                                هذه العملية تقوم بتعديل هيكلية البيانات في قاعدة البيانات السحابية. يرجى التأكد من استقرار الاتصال بالإنترنت قبل البدء. لن يتم حذف أي بيانات قديمة إلا بعد اكتمال النقل بنجاح.
                            </AlertDescription>
                        </Alert>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm mb-1">
                                <span>التقدم العام</span>
                                <span className="font-bold">{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                            {currentCollection && <p className="text-xs text-muted-foreground text-center">جاري معالجة: {currentCollection}</p>}
                        </div>

                        <ScrollArea className="h-48 border rounded-md p-3 bg-muted/30">
                            {logs.map((log, i) => (
                                <div key={i} className="text-xs font-mono py-0.5 border-b border-muted last:border-0">
                                    {log}
                                </div>
                            ))}
                            {logs.length === 0 && <p className="text-center text-muted-foreground py-10 italic">سجل العمليات سيظهر هنا...</p>}
                        </ScrollArea>
                    </CardContent>
                    <CardFooter className="flex justify-between border-t p-4 gap-4">
                        <Button 
                            variant="destructive" 
                            onClick={cleanupOldData} 
                            disabled={status !== 'completed'}
                        >
                            <Trash2 className="ml-2 h-4 w-4"/> حذف المسارات القديمة (تنظيف)
                        </Button>
                        <Button 
                            size="lg" 
                            onClick={handleReEngineer} 
                            disabled={status === 'migrating' || status === 'scanning' || !isOnline}
                            className="min-w-[200px]"
                        >
                            {status === 'migrating' || status === 'scanning' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ml-2 h-4 w-4" />}
                            {status === 'migrating' ? 'جاري النقل...' : 'بدء إعادة الهندسة'}
                        </Button>
                    </CardFooter>
                </Card>
            </main>
        </>
    );
}