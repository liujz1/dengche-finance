import { notFound, redirect } from "next/navigation";

import { AllocationPlanForm } from "@/app/(app)/allocations/new/allocation-plan-form";
import { auth } from "@/auth";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

type NewAllocationPageProps = {
  searchParams: Promise<{
    projectId?: string;
  }>;
};

export default async function NewAllocationPage({
  searchParams,
}: NewAllocationPageProps) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== UserRole.OWNER) {
    redirect("/projects");
  }

  const { projectId } = await searchParams;

  if (!projectId) {
    redirect("/allocations");
  }

  const [project, users] = await Promise.all([
    prisma.project.findFirst({
      where: {
        id: projectId,
        active: true,
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.user.findMany({
      where: {
        OR: [
          {
            id: session.user.id,
            role: UserRole.OWNER,
          },
          {
            role: UserRole.PARTNER,
          },
        ],
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: [
        {
          role: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    }),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">新方案</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          为 {project.name} 录入一套新的项目分配方案。
        </p>
      </div>

      <AllocationPlanForm project={project} users={users} />
    </div>
  );
}

