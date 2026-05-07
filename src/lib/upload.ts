import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

function assertSafeSubdir(subdir: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(subdir)) {
    throw new Error("上传目录不合法");
  }
}

export async function saveUploadedFile(
  file: File,
  subdir: string
): Promise<{ key: string; mime: string; size: number }> {
  assertSafeSubdir(subdir);

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("凭证必须是 jpeg、png、webp 或 heic 图片");
  }

  if (file.size <= 0) {
    throw new Error("请上传凭证图片");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("凭证图片不能超过 5MB");
  }

  const uploadDir = path.join(process.cwd(), "uploads", subdir);
  await mkdir(uploadDir, { recursive: true });

  const extension = EXTENSION_BY_MIME_TYPE[file.type];
  const filename = `${randomUUID()}.${extension}`;
  const key = path.posix.join("uploads", subdir, filename);
  const bytes = Buffer.from(await file.arrayBuffer());

  await writeFile(path.join(uploadDir, filename), bytes);

  return {
    key,
    mime: file.type,
    size: file.size,
  };
}
