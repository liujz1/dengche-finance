import { redirect } from "next/navigation";

import { AddPartnerForm } from "@/app/(app)/admin/users/new/add-partner-form";
import { auth } from "@/auth";
import { UserRole } from "@/generated/prisma/enums";

export default async function NewAdminUserPage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== UserRole.OWNER) {
    redirect("/projects");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">添加合伙人</h1>
      </div>

      <AddPartnerForm />
    </div>
  );
}
