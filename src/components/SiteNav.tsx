import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/app/actions/auth";

const ROLE_LABEL = {
  SUPER_ADMIN: "Super admin",
  CAMPAIGN_MANAGER: "Campaign manager",
  DONOR: "Donor",
} as const;

export async function SiteNav() {
  const user = await getCurrentUser();

  return (
    <nav className="flex flex-wrap items-center gap-4 text-sm">
      <Link href="/campaigns" className="hover:underline">
        Campaigns
      </Link>
      {user ? (
        <>
          <Link href="/dashboard" className="hover:underline">
            Dashboard
          </Link>
          {user.role === "SUPER_ADMIN" && (
            <>
              <Link href="/admin/campaigns" className="hover:underline">
                Manage campaigns
              </Link>
              <Link href="/admin/managers" className="hover:underline">
                Managers
              </Link>
            </>
          )}
          <span className="text-slate-500">
            {user.name} · {ROLE_LABEL[user.role]}
          </span>
          <form action={logout}>
            <button className="btn-secondary py-1">Log out</button>
          </form>
        </>
      ) : (
        <>
          <Link href="/login" className="hover:underline">
            Log in
          </Link>
          <Link href="/signup" className="btn py-1">
            Create account
          </Link>
        </>
      )}
    </nav>
  );
}
