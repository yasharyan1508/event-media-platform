import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// ─── Route Matchers ─────────────────────────────────────────────────────────

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

const isWebhookRoute = createRouteMatcher(["/api/webhooks(.*)"]);

// ─── Middleware ─────────────────────────────────────────────────────────────

export default clerkMiddleware(async (auth, req) => {
  // 1. Skip webhook routes — they use svix verification, not Clerk
  if (isWebhookRoute(req)) {
    return NextResponse.next();
  }

  // 2. Public routes — redirect authenticated users away from auth pages
  if (isPublicRoute(req)) {
    const { userId } = await auth();
    if (userId && (req.nextUrl.pathname.startsWith("/sign-in") || req.nextUrl.pathname.startsWith("/sign-up"))) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // 3. All other routes require authentication
  await auth.protect();

  // 4. Admin routes require ADMIN role from session claims
  if (isAdminRoute(req)) {
    const { sessionClaims } = await auth();
    const role = sessionClaims?.metadata?.role;

    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

// ─── Matcher Config ─────────────────────────────────────────────────────────

export const config = {
  matcher: [
    // Match all routes except static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always match API and TRPC routes
    "/(api|trpc)(.*)",
  ],
};
