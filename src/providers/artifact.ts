import type { ArtifactMetadata, ArtifactReference } from "../pipeline/types";

export interface ArtifactStore {
  publish(localPath: string, options?: { contentType?: string; key?: string }): Promise<ArtifactMetadata>;
  publishText(content: string, options?: { contentType?: string; key?: string }): Promise<ArtifactMetadata>;
  publishJson(data: unknown, options?: { key?: string }): Promise<ArtifactMetadata>;
  resolve(ref: ArtifactReference): Promise<{ url: string; redirect?: boolean }>;
  download(ref: ArtifactReference, localPath: string): Promise<void>;
}
