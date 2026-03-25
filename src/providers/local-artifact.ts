import { resolve, dirname } from "path";
import type { ArtifactStore } from "./artifact";
import type { ArtifactMetadata, ArtifactReference } from "../pipeline/types";
import { ensureDir } from "../utils/fs";

export class LocalArtifactStore implements ArtifactStore {
  async publish(
    localPath: string,
    options?: { contentType?: string; key?: string }
  ): Promise<ArtifactMetadata> {
    // In local mode, the artifact reference is just the absolute path
    // If a key is provided, we copy to that location
    if (options?.key) {
      const targetPath = resolve(options.key);
      ensureDir(dirname(targetPath));
      await Bun.write(targetPath, Bun.file(localPath));
      const file = Bun.file(targetPath);
      return {
        ref: targetPath,
        contentType: options.contentType ?? file.type,
        size: file.size,
      };
    }

    // Otherwise use the original path as the reference
    const absolutePath = resolve(localPath);
    const file = Bun.file(absolutePath);
    return {
      ref: absolutePath,
      contentType: options?.contentType ?? file.type,
      size: file.size,
    };
  }

  async publishText(
    content: string,
    options?: { contentType?: string; key?: string }
  ): Promise<ArtifactMetadata> {
    const key = options?.key ?? `text-${Date.now()}.txt`;
    const targetPath = resolve(key);
    ensureDir(dirname(targetPath));
    await Bun.write(targetPath, content);

    return {
      ref: targetPath,
      contentType: options?.contentType ?? "text/plain",
      size: content.length,
    };
  }

  async publishJson(
    data: unknown,
    options?: { key?: string }
  ): Promise<ArtifactMetadata> {
    const content = JSON.stringify(data, null, 2);
    const key = options?.key ?? `data-${Date.now()}.json`;
    return this.publishText(content, { contentType: "application/json", key });
  }

  async resolve(ref: ArtifactReference): Promise<{ url: string; redirect?: boolean }> {
    // Local artifact - serve directly via file path
    return { url: ref };
  }

  async download(ref: ArtifactReference, localPath: string): Promise<void> {
    // For local mode, ref is already a path - just ensure it's accessible
    const sourcePath = resolve(ref);
    const targetPath = resolve(localPath);
    ensureDir(dirname(targetPath));
    await Bun.write(targetPath, Bun.file(sourcePath));
  }
}
