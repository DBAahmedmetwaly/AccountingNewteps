

"use client";

import React, { useState, useMemo, useEffect } from "react";
import { AppLayoutContent } from "@/components/app-layout";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-provider";
import { Loader2 } from "lucide-react";
import { ModernNavHub } from "@/components/modern-nav-hub";
import { navStructure } from '@/components/app-layout';
import { usePathname } from 'next/navigation';
import { LicenseActivationForm } from "@/components/license-activation-form";


export function AppLayout({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const { settings, loading: dataLoading } = useData();
    const pathname = usePathname();

     // Effect to apply the zoom level from settings on initial load and when it changes
    useEffect(() => {
        if (user?.themeSettings?.zoomLevel) {
            const zoom = user.themeSettings.zoomLevel;
            document.documentElement.style.setProperty('--zoom-level', String(zoom));
        } else {
             // Reset to default if not set
            document.documentElement.style.removeProperty('--zoom-level');
        }
    }, [user?.themeSettings?.zoomLevel]);

    useEffect(() => {
        const reset = () => {
            const body = document.body;
            const html = document.documentElement;
            if (body) {
                body.style.pointerEvents = 'auto';
                if (getComputedStyle(body).overflow === 'hidden') {
                    body.style.overflow = '';
                }
            }
            if (html && getComputedStyle(html).pointerEvents === 'none') {
                html.style.pointerEvents = 'auto';
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setTimeout(reset, 50);
            }
        };
        const onClick = () => setTimeout(reset, 50);
        const obs = new MutationObserver(() => setTimeout(reset, 50));
        obs.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
        document.addEventListener('keydown', onKey, true);
        document.addEventListener('click', onClick, true);
        return () => {
            obs.disconnect();
            document.removeEventListener('keydown', onKey, true);
            document.removeEventListener('click', onClick, true);
        };
    }, []);

    if (authLoading || dataLoading) {
      return (
         <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (!user) {
        return <>{children}</>;
    }
    
    // Check if license needs activation
    if (user && user.id !== 'superadmin' && (!user.themeSettings?.licenseKey || user.themeSettings.licenseStatus !== 'active')) {
        return <LicenseActivationForm />;
    }
    
    // If the layout is modern_hub and the user is on the root page, show the hub instead of the children.
    if (settings?.main?.general?.desktopLayout === 'modern_hub' && pathname === '/') {
        return <ModernNavHub navStructure={navStructure} />;
    }
    
    return (
        <SidebarProvider>
            <AppLayoutContent>{children}</AppLayoutContent>
        </SidebarProvider>
    );
}
