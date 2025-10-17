import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "../../auth/authOptions";

const prisma = new PrismaClient();

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  const { name, description } = await req.json();

  const exercise = await prisma.exercise.updateMany({
    where: {
      id: params.id,
      user: { email: session.user.email },
    },
    data: { name, description },
  });

  if (exercise.count === 0) {
    return NextResponse.json({ error: "Nie znaleziono ćwiczenia lub brak uprawnień." }, { status: 404 });
  }

  return NextResponse.json({ message: "Zaktualizowano ćwiczenie." });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  const exercise = await prisma.exercise.deleteMany({
    where: {
      id: params.id,
      user: { email: session.user.email },
    },
  });

  if (exercise.count === 0) {
    return NextResponse.json({ error: "Nie znaleziono ćwiczenia lub brak uprawnień." }, { status: 404 });
  }

  return NextResponse.json({ message: "Usunięto ćwiczenie." });
}