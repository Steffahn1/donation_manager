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
    <nav aria-label="Main" className="font-heading flex flex-wrap items-center gap-x-5 gap-y-2 text-lg font-bold uppercase tracking-wide">
      <Link href="/campaigns" className="underline-offset-4 hover:text-yellow hover:underline">
        Campaigns
      </Link>
      {user ? (
        <>
          <Link href="/dashboard" className="underline-offset-4 hover:text-yellow hover:underline">
            Dashboard
          </Link>
          {user.role === "SUPER_ADMIN" && (
            <>
              <Link href="/admin/campaigns" className="underline-offset-4 hover:text-yellow hover:underline">
                Manage campaigns
              </Link>
              <Link href="/admin/managers" className="underline-offset-4 hover:text-yellow hover:underline">
                Managers
              </Link>
            </>
          )}
          <span className="font-sans text-sm font-normal normal-case tracking-normal text-white/85">
            {user.name} · {ROLE_LABEL[user.role]}
          </span>
          <form action={logout}>
            <button className="btn-on-dark">Log out</button>
          </form>
        </>
      ) : (
        <>
          <Link href="/login" className="underline-offset-4 hover:text-yellow hover:underline">
            Log in
          </Link>
          <Link href="/signup" className="btn-sm">
            Create account
          </Link>
        </>
      )}
    </nav>
  );
}
