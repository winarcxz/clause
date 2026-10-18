import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const authenticatedProxy = clerkMiddleware(async (authentication, request) => {
  const pathname = request.nextUrl.pathname;
  const productPaths = [
    "/dashboard",
    "/chat",
    "/mandates",
    "/audit",
    "/settings",
  ];
  const isProductDocument = productPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isProductDocument) {
    const { isAuthenticated, redirectToSignIn } = await authentication();
    if (!isAuthenticated) return redirectToSignIn();
  }
});

const authConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
);

export default authConfigured
  ? authenticatedProxy
  : () => NextResponse.next();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
