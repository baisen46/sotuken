import { ReactNode } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect("/login?from=/admin");
  if (!isAdminUser(user)) notFound();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4 border-b pb-3">
        <Link href="/admin" className="font-bold hover:underline">
          Admin
        </Link>
        <Link href="/admin/combos" className="hover:underline">
          Combos
        </Link>
        <Link href="/admin/comments" className="hover:underline">
          Comments
        </Link>
        <div className="ml-auto text-sm text-gray-600">{user.email}</div>
      </div>

      {children}
    </div>
  );
}
