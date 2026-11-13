/**
 * Seeds a demo database: the super admin, two campaign managers, a demo donor
 * account, five campaigns and ~6 weeks of donations (incl. anonymous, failed
 * and returning donors) so every dashboard has something to show.
 *
 * Run with: npx prisma db seed   (safe to re-run: it wipes and recreates demo data)
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type DonationStatus } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Deterministic pseudo-random numbers so the demo data is the same on every run.
let seedState = 42;
function rand(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
const pick = <T,>(items: T[]): T => items[Math.floor(rand() * items.length)];

const DAY = 24 * 60 * 60 * 1000;
const daysFromToday = (n: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() + n * DAY);
};

const FIRST = ["Thandi", "Sipho", "Lerato", "Johan", "Aisha", "Pieter", "Naledi", "Ravi", "Zanele", "Michael", "Fatima", "Kagiso", "Emma", "Tshepo", "Annelie", "Bongani", "Priya", "David", "Nomsa", "Ruan"];
const LAST = ["Mokoena", "Nkosi", "van der Merwe", "Naidoo", "Botha", "Dlamini", "Pillay", "Smith", "Khumalo", "Pretorius", "Ndlovu", "Jacobs"];
const AMOUNTS_RAND = [50, 100, 100, 150, 200, 250, 250, 500, 500, 750, 1000, 2000];

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@charity.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  // Wipe in dependency order.
  await db.stripeEvent.deleteMany();
  await db.donation.deleteMany();
  await db.donor.deleteMany();
  await db.campaign.deleteMany();
  await db.session.deleteMany();
  await db.emailVerificationToken.deleteMany();
  await db.user.deleteMany();

  const now = new Date();
  const admin = await db.user.create({
    data: {
      email: adminEmail,
      name: "Super Admin",
      role: "SUPER_ADMIN",
      passwordHash: await bcrypt.hash(adminPassword, 12),
      emailVerifiedAt: now,
    },
  });

  const managerHash = await bcrypt.hash("Manager123!", 12);
  const thandi = await db.user.create({
    data: { email: "thandi@charity.local", name: "Thandi Mokoena", role: "CAMPAIGN_MANAGER", passwordHash: managerHash, emailVerifiedAt: now },
  });
  const johan = await db.user.create({
    data: { email: "johan@charity.local", name: "Johan Botha", role: "CAMPAIGN_MANAGER", passwordHash: managerHash, emailVerifiedAt: now },
  });

  const campaigns = await Promise.all([
    db.campaign.create({
      data: {
        slug: "winter-food-parcels",
        name: "Winter Food Parcels",
        description: "Food parcels for families in Khayelitsha through the winter months. Each parcel feeds a family of four for a week.",
        targetCents: 150_000_00,
        startDate: daysFromToday(-45),
        endDate: daysFromToday(30),
        status: "ACTIVE",
        imagePath: "/campaigns/winter-food-parcels.jpg",
        impactAmountCents: 500_00,
        impactLabel: "family fed for a week",
        managerId: thandi.id,
      },
    }),
    db.campaign.create({
      data: {
        slug: "school-shoes",
        name: "School Shoes for Every Child",
        description: "A new pair of school shoes for learners at partner primary schools in Soweto.",
        targetCents: 60_000_00,
        startDate: daysFromToday(-40),
        endDate: daysFromToday(20),
        status: "ACTIVE",
        imagePath: "/campaigns/school-shoes.jpg",
        impactAmountCents: 350_00,
        impactLabel: "child given school shoes",
        managerId: thandi.id,
      },
    }),
    db.campaign.create({
      data: {
        slug: "clean-water-tanks",
        name: "Clean Water Tanks",
        description: "Rainwater harvesting tanks for rural households in the Eastern Cape.",
        targetCents: 200_000_00,
        startDate: daysFromToday(-30),
        endDate: daysFromToday(60),
        status: "ACTIVE",
        imagePath: "/campaigns/clean-water-tanks.jpg",
        impactAmountCents: 2_500_00,
        impactLabel: "household given a water tank",
        managerId: johan.id,
      },
    }),
    db.campaign.create({
      data: {
        slug: "library-books",
        name: "Community Library Books",
        description: "Stocking a new community library in Mamelodi. Launching soon.",
        targetCents: 40_000_00,
        startDate: daysFromToday(10),
        endDate: daysFromToday(90),
        status: "DRAFT",
        imagePath: "/campaigns/library-books.jpg",
        impactAmountCents: 150_00,
        impactLabel: "book added to the library",
        managerId: johan.id,
      },
    }),
    db.campaign.create({
      data: {
        slug: "flood-relief-2026",
        name: "KZN Flood Relief",
        description: "Emergency relief for families affected by flooding. This campaign has closed — thank you!",
        targetCents: 80_000_00,
        startDate: daysFromToday(-120),
        endDate: daysFromToday(-60),
        status: "CLOSED",
        imagePath: "/campaigns/flood-relief.jpg",
        impactAmountCents: 1_000_00,
        impactLabel: "relief pack delivered",
        managerId: johan.id,
      },
    }),
  ]);

  // Donors: 40 people with unique emails.
  const donors = [];
  for (let i = 0; i < 40; i++) {
    const first = FIRST[i % FIRST.length];
    const last = pick(LAST);
    donors.push(
      await db.donor.create({
        data: { name: `${first} ${last}`, email: `${first}.${last}.${i}`.toLowerCase().replace(/\s+/g, "") + "@example.com" },
      }),
    );
  }

  // A demo donor with an account (verified) and some history.
  const demoUser = await db.user.create({
    data: {
      email: "donor@example.com",
      name: "Lerato Dlamini",
      role: "DONOR",
      passwordHash: await bcrypt.hash("Donor123!", 12),
      emailVerifiedAt: now,
    },
  });
  const demoDonor = await db.donor.create({
    data: { name: "Lerato Dlamini", email: "donor@example.com", userId: demoUser.id },
  });
  donors.push(demoDonor);

  // Donations spread over the last 6 weeks for the active campaigns, plus history for the closed one.
  let count = 0;
  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");
  for (let daysAgo = 42; daysAgo >= 0; daysAgo--) {
    // Slightly more giving in recent weeks so the pacing chart shows a trend.
    const perDay = Math.floor(rand() * 3) + (daysAgo < 14 ? 2 : 1);
    for (let j = 0; j < perDay; j++) {
      const campaign = pick(activeCampaigns);
      if (daysFromToday(-daysAgo) < campaign.startDate) continue;
      // A small pool of regulars makes "returning donors" realistic.
      const donor = rand() < 0.35 ? pick(donors.slice(0, 8)) : pick(donors);
      const created = new Date(daysFromToday(-daysAgo).getTime() + Math.floor(rand() * 20) * 60 * 60 * 1000);
      if (created > now) continue;
      const r = rand();
      const status: DonationStatus = r < 0.08 ? "FAILED" : r < 0.11 ? "EXPIRED" : "SUCCEEDED";
      await db.donation.create({
        data: {
          donorId: donor.id,
          campaignId: campaign.id,
          amountCents: pick(AMOUNTS_RAND) * 100,
          status,
          isAnonymous: rand() < 0.2,
          receiptToken: randomBytes(32).toString("base64url"),
          failureReason: status === "FAILED" ? pick(["Your card was declined.", "Your card has insufficient funds."]) : null,
          createdAt: created,
          paidAt: status === "SUCCEEDED" ? new Date(created.getTime() + 60_000) : null,
        },
      });
      count++;
    }
  }

  const closed = campaigns.find((c) => c.status === "CLOSED")!;
  for (let i = 0; i < 30; i++) {
    const created = new Date(closed.startDate.getTime() + Math.floor(rand() * 60) * DAY);
    await db.donation.create({
      data: {
        donorId: pick(donors).id,
        campaignId: closed.id,
        amountCents: pick(AMOUNTS_RAND) * 100,
        status: "SUCCEEDED",
        isAnonymous: rand() < 0.2,
        receiptToken: randomBytes(32).toString("base64url"),
        createdAt: created,
        paidAt: created,
      },
    });
    count++;
  }

  // Make sure the demo donor has history across campaigns, including one anonymous gift.
  for (const [campaign, rands, anon] of [
    [campaigns[0], 500, false],
    [campaigns[0], 250, true],
    [campaigns[2], 1000, false],
  ] as const) {
    await db.donation.create({
      data: {
        donorId: demoDonor.id,
        campaignId: campaign.id,
        amountCents: rands * 100,
        status: "SUCCEEDED",
        isAnonymous: anon,
        receiptToken: randomBytes(32).toString("base64url"),
        createdAt: daysFromToday(-5),
        paidAt: daysFromToday(-5),
      },
    });
    count++;
  }

  console.log(`Seeded: admin ${admin.email}, managers ${thandi.email} & ${johan.email}, ${campaigns.length} campaigns, ${donors.length} donors, ${count} donations.`);
  console.log(`Logins: ${adminEmail} / ${adminPassword} · thandi@charity.local / Manager123! · donor@example.com / Donor123!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
