import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "../auth/authOptions";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 });
  }

  // Pobierz wszystkie ćwiczenia użytkownika
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { exercises: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'Użytkownik nie znaleziony.' }, { status: 404 });
  }

  return NextResponse.json(user.exercises);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 });
  }

  const { name, description } = await req.json();

  if (!name) {
    return NextResponse.json({ error: 'Nazwa ćwiczenia jest wymagana.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: 'Użytkownik nie znaleziony.' }, { status: 404 });
  }

  const exercise = await prisma.exercise.create({
    data: {
      name,
      description,
      userId: user.id,
    }
  });

  return NextResponse.json(exercise, { status: 201 });
}