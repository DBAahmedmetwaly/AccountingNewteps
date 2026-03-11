

"use client";

// استيراد سياق المصادقة
import React from "react";
import { AuthProvider } from "@/contexts/auth-context";

// هذا المكون هو غلاف (wrapper) لأن نموذج تسجيل الدخول نفسه أصبح الآن جزءًا من AuthProvider.
// سيقوم AuthProvider بعرض نموذج تسجيل الدخول إذا لم يكن المستخدم مصادقًا عليه.

// مكون لعرض رسالة مؤقتة أثناء إعادة التوجيه
const LoginPageContent = () => {
    return (
        <div className="flex items-center justify-center h-screen">
            <p>جارٍ إعادة التوجيه إلى صفحة تسجيل الدخول...</p>
        </div>
    );
};

// المكون الرئيسي لصفحة تسجيل الدخول
export default function LoginPage() {
    return (
        // يحيط AuthProvider بالمحتوى ليوفر إمكانية الوصول إلى حالة المصادقة
        <AuthProvider>
            <LoginPageContent />
        </AuthProvider>
    );
}
