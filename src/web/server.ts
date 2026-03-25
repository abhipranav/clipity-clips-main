import { basename, join } from "path";
import { loadConfig } from "../config";
import { createProviders } from "../providers/factory";
import { createLogger } from "../utils/logger";
import * as api from "./api";
import { AuthService } from "../auth/service";
import { createAuthRoutes } from "../auth/routes";

const log = createLogger("web-server");

const config = loadConfig();
const appUrl = config.appUrl;
const port = config.port;

const providers = await createProviders(config);
api.setProviders(providers);

// Initialize auth components
const authService = new AuthService(config, providers.userStore);
const authRoutes = createAuthRoutes(authService, providers.userStore);

async function serveArtifact(pathname: string): Promise<Response> {
  const artifactRef = decodeURIComponent(pathname.replace("/artifacts/", ""));
  
  if (!artifactRef) {
    return new Response("Missing artifact reference", { status: 400 });
  }

  try {
    // Use artifact provider to resolve the reference
    const { url, redirect } = await providers.artifact.resolve(artifactRef);
    
    if (redirect) {
      // For cloud storage (S3), redirect to signed URL
      return new Response(null, {
        status: 302,
        headers: { location: url },
      });
    }
    
    // For local files, serve directly
    const file = Bun.file(url);
    const exists = await file.exists();
    
    if (!exists) {
      return new Response("Artifact not found", { status: 404 });
    }
    
    return new Response(file, {
      headers: {
        "content-type": file.type || "application/octet-stream",
        "content-disposition": `inline; filename="${basename(url)}"`,
      },
    });
  } catch (err) {
    log.error(`Failed to serve artifact: ${err}`);
    return new Response("Failed to serve artifact", { status: 500 });
  }
}

async function serveStaticFile(pathname: string): Promise<Response> {
  // Remove leading slash and default to index.html
  let filePath = pathname.slice(1) || "index.html";
  
  // Security: prevent directory traversal
  if (filePath.includes("..") || filePath.startsWith("/")) {
    filePath = "index.html";
  }

  const fullPath = join(process.cwd(), "frontend", "dist", filePath);
  
  try {
    const file = Bun.file(fullPath);
    const exists = await file.exists();
    
    if (!exists) {
      // Return index.html for client-side routing
      const indexFile = Bun.file(join(process.cwd(), "frontend", "dist", "index.html"));
      return new Response(indexFile, {
        headers: { "content-type": "text/html" },
      });
    }

    // Determine content type based on extension
    const ext = filePath.split(".").pop()?.toLowerCase();
    const contentType = getContentType(ext);

    return new Response(file, {
      headers: { "content-type": contentType },
    });
  } catch (err) {
    log.error(`Failed to serve static file: ${err}`);
    return new Response("Not found", { status: 404 });
  }
}

function getContentType(ext: string | undefined): string {
  switch (ext) {
    case "html": return "text/html";
    case "js": return "application/javascript";
    case "mjs": return "application/javascript";
    case "css": return "text/css";
    case "json": return "application/json";
    case "svg": return "image/svg+xml";
    case "png": return "image/png";
    case "jpg": return "image/jpeg";
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "ico": return "image/x-icon";
    default: return "application/octet-stream";
  }
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // API Routes
    if (pathname.startsWith("/api/")) {
      const cors = corsHeaders();
      let response: Response;
      
      // Auth routes
      if (pathname === "/api/auth/signup" && request.method === "POST") {
        response = await authRoutes.signup(request);
      } else if (pathname === "/api/auth/login" && request.method === "POST") {
        response = await authRoutes.login(request);
      } else if (pathname === "/api/auth/logout" && request.method === "POST") {
        response = await authRoutes.logout(request);
      } else if (pathname === "/api/auth/me" && request.method === "GET") {
        response = await authRoutes.me(request);
      } else if (pathname === "/api/auth/refresh" && request.method === "POST") {
        response = await authRoutes.refresh(request);
      } else if (pathname === "/api/auth/api-keys" && request.method === "GET") {
        response = await authRoutes.listApiKeys(request);
      } else if (pathname === "/api/auth/api-keys" && request.method === "POST") {
        response = await authRoutes.createApiKey(request);
      } else if (pathname.startsWith("/api/auth/api-keys/") && request.method === "DELETE") {
        const keyId = pathname.replace("/api/auth/api-keys/", "");
        response = await authRoutes.revokeApiKey(request, keyId);
      } else if (pathname === "/api/app-summary" && request.method === "GET") {
        response = await api.getAppSummary();
      } else if (pathname === "/api/jobs" && request.method === "POST") {
        response = await api.createJob(request);
      } else if (pathname === "/api/runs" && request.method === "GET") {
        response = await api.listRuns();
      } else if (pathname.startsWith("/api/runs/") && request.method === "GET") {
        const runId = pathname.replace("/api/runs/", "");
        response = await api.getRun(runId);
      } else if (pathname.startsWith("/api/library/") && pathname.endsWith("/download") && request.method === "GET") {
        const videoId = decodeURIComponent(
          pathname.replace("/api/library/", "").replace("/download", "").replace(/\/$/, ""),
        );
        response = await api.downloadLibraryGroup(videoId);
      } else if (pathname === "/api/library" && request.method === "GET") {
        response = await api.getLibrary();
      } else if (pathname === "/api/queue" && request.method === "GET") {
        response = await api.getQueue();
      } else if (pathname === "/api/settings" && request.method === "GET") {
        response = await api.getSettings();
      } else if (pathname === "/api/settings" && request.method === "PUT") {
        response = await api.updateSettings(request);
      } else if (pathname === "/api/system/health" && request.method === "GET") {
        response = await api.getSystemHealth();
      } else {
        response = new Response(JSON.stringify({ error: "API endpoint not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Add CORS headers
      Object.entries(cors).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    // Artifact serving
    if (pathname.startsWith("/artifacts/")) {
      return await serveArtifact(pathname);
    }

    // Asset serving (thumbnails, preview videos)
    if (pathname.startsWith("/assets/")) {
      const assetPath = pathname.replace("/assets/", "");
      // Security check
      if (assetPath.includes("..") || assetPath.startsWith("/")) {
        return new Response("Not found", { status: 404 });
      }
      const fullPath = join(process.cwd(), "assets", assetPath);
      try {
        const file = Bun.file(fullPath);
        if (await file.exists()) {
          const ext = assetPath.split(".").pop()?.toLowerCase();
          return new Response(file, {
            headers: {
              "content-type": getContentType(ext),
              "cache-control": "public, max-age=86400",
            },
          });
        }
      } catch (err) {
        log.error(`Failed to serve asset: ${err}`);
      }
      return new Response("Not found", { status: 404 });
    }

    // Legacy form endpoint for backwards compatibility
    if (pathname === "/jobs" && request.method === "POST") {
      const formData = await request.formData();
      const videoUrlValue = formData.get("videoUrl");
      const videoUrl = typeof videoUrlValue === "string" ? videoUrlValue.trim() : "";

      if (!videoUrl) {
        return new Response("Missing videoUrl", { status: 400 });
      }

      const videoIdMatch = videoUrl.match(/(?:v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      const videoId = videoIdMatch?.[1] ?? "";

      const run = await providers.checkpoint.createQueuedRun(videoUrl, videoId, "");
      await providers.queue.enqueue(run.id);

      log.info(`Created queued run: ${run.id} for ${videoUrl}`);

      return new Response(null, {
        status: 303,
        headers: { location: "/" },
      });
    }

    // Serve static files from React build
    return await serveStaticFile(pathname);
  },
});

log.info(`Clipity web server listening on ${appUrl} (port ${server.port})`);

// Handle graceful shutdown
process.on("SIGINT", async () => {
  log.info("Shutting down web server...");
  await providers.checkpoint.close();
  await providers.queue.close();
  await providers.settings.close();
  await providers.userStore.close();
  process.exit(0);
});
