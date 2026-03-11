"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { database } from '@/lib/firebase';
import { ref, onChildAdded, query, limitToLast, orderByChild, startAt } from 'firebase/database';
import { useAuth } from './auth-context';
import { useToast } from '@/hooks/use-toast';

interface NotificationContextType {
    notificationsEnabled: boolean;
    toggleNotifications: (enable: boolean) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
    notificationsEnabled: false,
    toggleNotifications: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const { user } = useAuth();
    const { toast } = useToast();
    const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);

    useEffect(() => {
        // Load preference from local storage
        const savedPref = localStorage.getItem('notifications_enabled');
        if (savedPref === 'true') {
            setNotificationsEnabled(true);
        }
    }, []);

    const toggleNotifications = async (enable: boolean) => {
        setNotificationsEnabled(enable);
        localStorage.setItem('notifications_enabled', String(enable));
        toast({ title: enable ? "تم تفعيل إشعارات المبيعات" : "تم إيقاف إشعارات المبيعات" });
    };

    useEffect(() => {
        if (!notificationsEnabled || !database || !user) return;

        // Listen for NEW notifications
        // We use a timestamp based query or just listen to the node if it's transient
        // Ideally, we listen to `notifications` node.
        
        // To avoid fetching old notifications, we can query by timestamp
        const now = new Date().toISOString();
        const notificationsRef = ref(database, 'notifications');
        const q = query(notificationsRef, orderByChild('timestamp'), startAt(now));

        // Note: startAt with ISO string might be tricky if not indexed, but Firebase handles strings well.
        // Better to use limitToLast(1) and ignore the first initial load if it's old.
        // But onChildAdded triggers for existing items too if we don't filter.
        
        // Strategy: Listen to child_added, but check if the event timestamp is recent (within last 10 seconds of reception)
        // or just rely on startAt(Date.now()) if we used numeric timestamps.
        // Since we used ISO string in pos/page.tsx, let's use limitToLast(1) and a simple client-side filter for "freshness"
        // Or simpler: Just listen to the stream.
        
        const unsubscribe = onChildAdded(q, (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            // Prevent duplicate toasts for the same ID if re-renders happen
            if (snapshot.key === lastNotificationId) return;
            setLastNotificationId(snapshot.key);

            // Optional: Don't notify if the user is the one who created it (if we track creatorId)
            // But manager might want to see their own sales too for confirmation.
            // Let's assume we show everything.

            toast({
                title: data.title || "إشعار جديد",
                description: data.body,
                duration: 5000,
            });
        });

        return () => unsubscribe();
    }, [notificationsEnabled, user, toast, lastNotificationId]);

    return (
        <NotificationContext.Provider value={{ notificationsEnabled, toggleNotifications }}>
            {children}
        </NotificationContext.Provider>
    );
};
