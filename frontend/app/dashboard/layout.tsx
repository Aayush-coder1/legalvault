import { Sidebar } from "@/components/layout/sidebar";

/** Dashboard shell: sidebar on desktop, content fills the rest. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full bg-zinc-950">
      <Sidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
