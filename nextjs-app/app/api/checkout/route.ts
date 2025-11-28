import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/authOptions";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-09-30.clover",
});

export async function POST(req: Request) {
  const serverSession = await getServerSession(authOptions);
  if (!serverSession || !serverSession.user?.email) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  const { priceId } = await req.json();
  
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: 'adam@niepodam.pl',
    success_url: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
    cancel_url: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  });

  return NextResponse.json({ url: session.url });
}