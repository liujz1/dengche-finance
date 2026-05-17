"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function withRetryParam(src: string, retryNonce: number) {
  if (retryNonce === 0) {
    return src;
  }

  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}retry=${retryNonce}`;
}

export function EvidenceImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const retrySrc = withRetryParam(src, retryNonce);

  if (failed) {
    return (
      <div className="flex min-h-40 items-center justify-center bg-muted p-4 text-center">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setFailed(false);
            setRetryNonce((current) => current + 1);
          }}
        >
          凭证加载失败 · 点击重试
        </Button>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={retrySrc}
      src={retrySrc}
      alt={alt}
      className={cn("bg-muted", className)}
      onError={() => setFailed(true)}
    />
  );
}
