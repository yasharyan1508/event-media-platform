import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest } from "next/server";
import { prisma } from "@/src/Library/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req);

    const eventType = evt.type;

    // ─── user.created ─────────────────────────────────────────────────
    if (eventType === "user.created") {
      const { id, email_addresses, first_name, last_name, image_url } =
        evt.data;

      const email = email_addresses[0]?.email_address;
      if (!email) {
        return new Response("No email address found", { status: 400 });
      }

      const name = [first_name, last_name].filter(Boolean).join(" ") || null;

      // Determine role: ADMIN if email matches ADMIN_EMAIL env var
      const adminEmail = process.env.ADMIN_EMAIL;
      const role: Role =
        adminEmail && email.toLowerCase() === adminEmail.toLowerCase()
          ? Role.ADMIN
          : Role.MEMBER;

      // Create user in database
      const user = await prisma.user.create({
        data: {
          clerkId: id,
          email,
          name,
          avatarUrl: image_url || null,
          role,
        },
      });

      // Sync role back to Clerk publicMetadata so it's available in session claims
      const client = await clerkClient();
      await client.users.updateUserMetadata(id, {
        publicMetadata: { role: user.role },
      });

      console.log(
        `[webhook] user.created: ${email} → role: ${user.role}`
      );

      return new Response("User created", { status: 200 });
    }

    // ─── user.updated ─────────────────────────────────────────────────
    if (eventType === "user.updated") {
      const { id, email_addresses, first_name, last_name, image_url } =
        evt.data;

      const email = email_addresses[0]?.email_address;
      if (!email) {
        return new Response("No email address found", { status: 400 });
      }

      const name = [first_name, last_name].filter(Boolean).join(" ") || null;

      await prisma.user.upsert({
        where: { clerkId: id },
        update: {
          email,
          name,
          avatarUrl: image_url || null,
        },
        create: {
          clerkId: id,
          email,
          name,
          avatarUrl: image_url || null,
          role: Role.MEMBER,
        },
      });

      console.log(`[webhook] user.updated: ${email}`);

      return new Response("User updated", { status: 200 });
    }

    // ─── user.deleted ─────────────────────────────────────────────────
    if (eventType === "user.deleted") {
      const { id } = evt.data;

      if (!id) {
        return new Response("No user ID found", { status: 400 });
      }

      // Soft delete — preserve relational data
      await prisma.user.update({
        where: { clerkId: id },
        data: { isActive: false },
      });

      console.log(`[webhook] user.deleted (soft): clerkId=${id}`);

      return new Response("User soft-deleted", { status: 200 });
    }

    // ─── Unhandled event ──────────────────────────────────────────────
    console.log(`[webhook] unhandled event: ${eventType}`);
    return new Response("Event received", { status: 200 });
  } catch (err) {
    console.error("[webhook] Error processing webhook:", err);
    return new Response("Webhook processing failed", { status: 400 });
  }
}
