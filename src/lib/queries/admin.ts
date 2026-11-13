import "server-only";
import { db } from "@/lib/db";
import { dateIso } from "@/lib/campaigns";
import type { CampaignFormValues } from "@/components/forms/CampaignForm";

export function listManagers() {
  return db.user.findMany({
    where: { role: "CAMPAIGN_MANAGER" },
    select: { id: true, name: true, email: true, createdAt: true, _count: { select: { managedCampaigns: true } } },
    orderBy: { name: "asc" },
  });
}

export function listAllCampaigns() {
  return db.campaign.findMany({
    include: { manager: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
}

const rand = (cents: number) => (cents / 100).toFixed(2);

export async function getCampaignFormValues(id: string): Promise<CampaignFormValues | null> {
  const c = await db.campaign.findUnique({ where: { id } });
  if (!c) return null;
  return {
    name: c.name,
    description: c.description,
    target: rand(c.targetCents),
    startDate: dateIso(c.startDate),
    endDate: dateIso(c.endDate),
    status: c.status,
    imagePath: c.imagePath ?? "",
    impactAmount: rand(c.impactAmountCents),
    impactLabel: c.impactLabel,
    managerId: c.managerId,
  };
}
