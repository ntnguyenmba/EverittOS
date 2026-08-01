diff --git a/components/authenticated-section.tsx b/components/authenticated-section.tsx
index d841c016ceb9bdf16b001b60e4f4d6cc5865a904..34f053bcdff6fa2648290d47e42b18cb3f7273e5 100644
--- a/components/authenticated-section.tsx
+++ b/components/authenticated-section.tsx
@@ -1,123 +1,20 @@
 'use client';
 
-import { AppNavigationTracker } from '@/components/app-navigation-tracker';
-import { AppPageTop } from '@/components/app-page-top';
+import { AppShell } from '@/components/app-shell';
 
 type AuthenticatedSectionProps = {
   role?: string | null;
   children: React.ReactNode;
   className?: string;
 };
 
-/** Shared authenticated portal surface using the same Everitt background as the main app. */
+/** Compatibility wrapper for authenticated routes that now delegates all chrome to AppShell. */
 export function AuthenticatedSection({ role, children, className }: AuthenticatedSectionProps) {
   return (
-    <main className={className ? `section authenticated-portal ${className}` : 'section authenticated-portal'}>
-      <div className="authenticated-portal-background" aria-hidden="true" />
-      <div className="authenticated-portal-overlay" aria-hidden="true" />
-      <AppNavigationTracker />
-      <div className="container authenticated-portal-container">
-        <AppPageTop role={role} />
+    <AppShell role={role}>
+      <div className={className}>
         {children}
       </div>
-
-      <style jsx>{`
-        .authenticated-portal {
-          position: relative;
-          isolation: isolate;
-          min-height: 100svh;
-          padding: clamp(18px, 3vw, 38px) 0;
-          overflow-x: hidden;
-          background: #dfe8ee;
-        }
-
-        .authenticated-portal-background {
-          position: fixed;
-          inset: 0;
-          z-index: 0;
-          pointer-events: none;
-          background-color: #dfe8ee;
-          background-image: url('/hero.jpg');
-          background-repeat: no-repeat;
-          background-size: cover;
-          background-position: center;
-          opacity: 0.58;
-          filter: saturate(0.74) contrast(0.98) brightness(0.86);
-          transform: scale(1.015);
-        }
-
-        .authenticated-portal-overlay {
-          position: fixed;
-          inset: 0;
-          z-index: 1;
-          pointer-events: none;
-          background:
-            linear-gradient(90deg, rgba(221, 231, 238, 0.18), rgba(237, 242, 246, 0.5) 21%, rgba(237, 242, 246, 0.5) 79%, rgba(221, 231, 238, 0.18)),
-            linear-gradient(180deg, rgba(238, 243, 247, 0.22), rgba(221, 231, 238, 0.4));
-        }
-
-        .authenticated-portal-container {
-          position: relative;
-          z-index: 2;
-          width: min(1200px, calc(100% - 48px));
-          padding: clamp(18px, 3vw, 34px);
-          background: transparent;
-        }
-
-        .authenticated-portal-container :global(.card),
-        .authenticated-portal-container :global(.panel),
-        .authenticated-portal-container :global(.stat),
-        .authenticated-portal-container :global(.contractor-job-card),
-        .authenticated-portal-container :global(.client-job-card) {
-          background: rgba(255, 255, 255, 0.97);
-          border-color: rgba(37, 54, 74, 0.13);
-          box-shadow: 0 1px 3px rgba(37, 54, 74, 0.08), 0 8px 24px rgba(37, 54, 74, 0.055);
-          backdrop-filter: blur(8px);
-          -webkit-backdrop-filter: blur(8px);
-        }
-
-        .authenticated-portal-container :global(h1),
-        .authenticated-portal-container :global(h2),
-        .authenticated-portal-container :global(h3),
-        .authenticated-portal-container :global(h4),
-        .authenticated-portal-container :global(strong),
-        .authenticated-portal-container :global(label) {
-          text-shadow: none;
-        }
-
-        @media (max-width: 720px) {
-          .authenticated-portal {
-            padding: 10px 0 20px;
-          }
-
-          .authenticated-portal-background {
-            background-position: 56% center;
-            opacity: 0.44;
-          }
-
-          .authenticated-portal-overlay {
-            background: rgba(231, 238, 243, 0.61);
-          }
-
-          .authenticated-portal-container {
-            width: min(100% - 20px, 1200px);
-            padding: 14px;
-            background: transparent;
-          }
-        }
-
-        @media (prefers-reduced-transparency: reduce) {
-          .authenticated-portal-container :global(.card),
-          .authenticated-portal-container :global(.panel),
-          .authenticated-portal-container :global(.stat),
-          .authenticated-portal-container :global(.contractor-job-card),
-          .authenticated-portal-container :global(.client-job-card) {
-            background: rgba(247, 250, 252, 0.985);
-            backdrop-filter: none;
-            -webkit-backdrop-filter: none;
-          }
-        }
-      `}</style>
-    </main>
+    </AppShell>
   );
 }
