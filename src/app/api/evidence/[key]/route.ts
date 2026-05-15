import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

type EvidenceRouteContext = {
  params: Promise<{
    key: string;
  }>;
};

function notFound() {
  return new Response(null, { status: 404 });
}

function unauthorized() {
  return new Response(null, { status: 401 });
}

function decodeEvidenceKeyParam(rawKey: string) {
  try {
    return decodeURIComponent(rawKey);
  } catch {
    return null;
  }
}

function assertEvidenceKey(decodedKey: string) {
  const normalizedKey = path.posix.normalize(decodedKey);

  if (
    decodedKey !== normalizedKey ||
    !normalizedKey.startsWith("uploads/evidences/") ||
    normalizedKey.includes("..")
  ) {
    return null;
  }

  const filename = path.posix.basename(normalizedKey);

  if (!filename || filename === "." || filename === "..") {
    return null;
  }

  return {
    key: normalizedKey,
    filename,
  };
}

export async function GET(_request: Request, { params }: EvidenceRouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const { key: rawKey } = await params;
  const decodedKey = decodeEvidenceKeyParam(rawKey);
  const safeKey = decodedKey ? assertEvidenceKey(decodedKey) : null;

  if (!safeKey) {
    return notFound();
  }

  const evidence = await prisma.evidence.findFirst({
    where: {
      r2Key: safeKey.key,
      ...(session.user.role === "OWNER"
        ? {}
        : {
            entry: {
              createdById: session.user.id,
            },
          }),
    },
    select: {
      mimeType: true,
      sizeBytes: true,
    },
  });

  if (!evidence) {
    return notFound();
  }

  const filePath = path.join(process.cwd(), "uploads", "evidences", safeKey.filename);

  try {
    await stat(filePath);
  } catch {
    return notFound();
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

  return new Response(stream, {
    headers: {
      "Content-Type": evidence.mimeType,
      "Content-Length": String(evidence.sizeBytes),
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
