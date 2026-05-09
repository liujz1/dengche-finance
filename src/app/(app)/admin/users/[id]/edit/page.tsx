import { notFound, redirect } from "next/navigation";

import { EditUserForm } from "@/app/(app)/admin/users/[id]/edit/edit-user-form";
import { auth } from "@/auth";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

type EditAdminUserPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditAdminUserPage({
  params,
}: EditAdminUserPageProps) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== UserRole.OWNER) {
    redirect("/projects");
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  if (!user) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">编辑用户</h1>
      </div>

      <EditUserForm user={user} />
    </div>
  );
}
