import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { NewEntryForm } from "@/app/(app)/entries/new/new-entry-form";
import { getMyProjects } from "@/server/projects";

type NewEntryPageProps = {
  searchParams: Promise<{
    projectId?: string;
  }>;
};

export default async function NewEntryPage({ searchParams }: NewEntryPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [{ projectId }, projects] = await Promise.all([
    searchParams,
    getMyProjects(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">录入新流水</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          所有流水都需要凭证图片，提交后由老板审核。
        </p>
      </div>

      {projects.length > 0 ? (
        <NewEntryForm projects={projects} defaultProjectId={projectId} />
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          你当前没有可录入的项目。
        </div>
      )}
    </div>
  );
}
