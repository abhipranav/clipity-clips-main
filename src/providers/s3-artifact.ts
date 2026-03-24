import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ArtifactStore } from "./artifact";
import type { ArtifactMetadata, ArtifactReference } from "../pipeline/types";

export class S3ArtifactStore implements ArtifactStore {
  private client: S3Client;
  private bucket: string;

  constructor(region: string, bucket: string) {
    this.client = new S3Client({ region });
    this.bucket = bucket;
  }

  async publish(
    localPath: string,
    options?: { contentType?: string; key?: string }
  ): Promise<ArtifactMetadata> {
    const file = Bun.file(localPath);
    const key = options?.key ?? this.generateKey(localPath);
    const contentType = options?.contentType ?? this.inferContentType(localPath);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: contentType,
    });

    await this.client.send(command);

    return {
      ref: `s3://${this.bucket}/${key}`,
      contentType,
      size: file.size,
    };
  }

  async publishText(
    content: string,
    options?: { contentType?: string; key?: string }
  ): Promise<ArtifactMetadata> {
    const key = options?.key ?? `text-${Date.now()}.txt`;
    const contentType = options?.contentType ?? "text/plain";

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: content,
      ContentType: contentType,
    });

    await this.client.send(command);

    return {
      ref: `s3://${this.bucket}/${key}`,
      contentType,
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
    const parsed = this.parseS3Ref(ref);
    if (!parsed) {
      // If not an S3 ref, assume it's a local path for compatibility
      return { url: ref };
    }

    // Generate a presigned URL valid for 1 hour
    const command = new GetObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.key,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: 3600 });
    return { url, redirect: true };
  }

  async download(ref: ArtifactReference, localPath: string): Promise<void> {
    const parsed = this.parseS3Ref(ref);
    if (!parsed) {
      throw new Error(`Invalid S3 reference: ${ref}`);
    }

    const command = new GetObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.key,
    });

    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error(`Empty response body for ${ref}`);
    }

    const buffer = await response.Body.transformToByteArray();
    await Bun.write(localPath, buffer);
  }

  private generateKey(localPath: string): string {
    const timestamp = Date.now();
    const basename = localPath.split("/").pop() ?? "file";
    return `artifacts/${timestamp}-${basename}`;
  }

  private inferContentType(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase();
    const types: Record<string, string> = {
      mp4: "video/mp4",
      webm: "video/webm",
      json: "application/json",
      txt: "text/plain",
      srt: "text/plain",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
    };
    return types[ext ?? ""] ?? "application/octet-stream";
  }

  private parseS3Ref(ref: string): { bucket: string; key: string } | null {
    const match = ref.match(/^s3:\/\/([^/]+)\/(.+)$/);
    if (!match) return null;
    return { bucket: match[1], key: match[2] };
  }
}
