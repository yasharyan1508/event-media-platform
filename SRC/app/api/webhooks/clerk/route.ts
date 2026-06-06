import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { prisma } from '@/src/Library/prisma'

export async function POST(req: Request) {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get("svix-id")
  const svix_timestamp = headerPayload.get("svix-timestamp")
  const svix_signature = headerPayload.get("svix-signature")

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occured', {
      status: 400
    })
  }

  const eventType = evt.type

  // 🔴 DEBUG ONLY: You can delete this console.log after testing
  console.log(`\n✅ WEBHOOK RECEIVED: ${eventType}`);

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data

    const email = email_addresses?.[0]?.email_address

    if (!email) {
      return new Response('Error: No email address provided in payload', { status: 400 })
    }

    // 🔴 DEBUG ONLY: You can delete this console.log after testing
    console.log("Attempting database upsert for user:", id);

    try {
      await prisma.user.upsert({
        where: { clerkId: id },
        update: {
          email,
          avatarUrl: image_url,
          // ⚠️ NOTE: I commented out 'name' because it was not in your Prisma Studio screenshot.
          // If you update your schema.prisma later to include 'name', you can uncomment this.
          // name: [first_name, last_name].filter(Boolean).join(' ') || null,
        },
        create: {
          clerkId: id,
          email,
          avatarUrl: image_url,
          isActive: true, // Assuming default active based on your schema
          // name: [first_name, last_name].filter(Boolean).join(' ') || null,
        },
      })

      // 🔴 DEBUG ONLY: You can delete this console.log after testing
      console.log("✅ USER SUCCESSFULLY SAVED TO DATABASE:", id);

    } catch (error) {
      // 🟢 KEEP THIS FOREVER: It is best practice to log DB errors and return a 500 status 
      // so Clerk knows the webhook failed and can retry it.
      console.error('❌ PRISMA DATABASE ERROR:', error)
      return new Response('Error', { status: 500 })
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data

    if (!id) {
      return new Response('Error: No user ID provided in payload', { status: 400 })
    }

    try {
      await prisma.user.delete({
        where: { clerkId: id },
      })
    } catch (error) {
      // 🟢 KEEP THIS FOREVER
      console.error('❌ Error deleting user:', error)
      return new Response('Error', { status: 500 })
    }
  }

  return new Response('', { status: 200 })
}