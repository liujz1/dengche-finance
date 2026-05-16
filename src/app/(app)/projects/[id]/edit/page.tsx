import { notFound, redirect } from "next/navigation";

import { EditProjectForm } from "@/app/(app)/projects/[id]/edit/edit-project-form";
import { auth } from "@/auth";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

type EditProjectPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== UserRole.OWNER) {
    redirect("/projects");
  }

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">编辑项目</h1>
      </div>

      <EditProjectForm project={project} />
    </div>
  );
}
