# Cloud Deployment Guide

## Overview

Clipity now supports dual-mode deployment:
- **Local mode**: SQLite + local filesystem (development)
- **Cloud mode**: Postgres + S3 + SQS (production)

## Supported Cloud Platforms

### 1. AWS (Recommended)
- **Web Server**: ECS Fargate, EC2, or Elastic Beanstalk
- **Worker**: ECS Fargate with spot instances or EC2 Auto Scaling
- **Database**: RDS PostgreSQL or Aurora
- **Queue**: SQS
- **Storage**: S3
- **Benefits**: Fully managed, auto-scaling, pay-per-use

### 2. Google Cloud Platform (GCP)
- **Web Server**: Cloud Run or GKE
- **Worker**: Cloud Run Jobs or GKE with node auto-scaling
- **Database**: Cloud SQL PostgreSQL
- **Queue**: Pub/Sub (requires adapter)
- **Storage**: Cloud Storage (requires adapter)
- **Benefits**: Serverless options, good free tier

### 3. Azure
- **Web Server**: Container Instances or AKS
- **Worker**: Container Instances or AKS with virtual node
- **Database**: Azure Database for PostgreSQL
- **Queue**: Service Bus or Storage Queues (requires adapter)
- **Storage**: Blob Storage (requires adapter)
- **Benefits**: Enterprise integration, hybrid cloud

### 4. DigitalOcean
- **Web Server**: App Platform or Droplets
- **Worker**: Droplets with custom scaling
- **Database**: Managed PostgreSQL
- **Queue**: Self-hosted or external service
- **Storage**: Spaces (S3-compatible)
- **Benefits**: Simple pricing, developer-friendly

### 5. Railway / Render / Fly.io
- **Web Server**: Platform-managed containers
- **Worker**: Background workers or separate service
- **Database**: Managed PostgreSQL
- **Queue**: External service or self-hosted
- **Storage**: External S3-compatible
- **Benefits**: Zero-config deployment, automatic HTTPS

## AWS Deployment Steps

### Prerequisites

1. Install AWS CLI and configure credentials
2. Install Docker
3. Have a domain name (optional but recommended)

### Step 1: Infrastructure Setup

```bash
# Create S3 bucket for artifacts
aws s3api create-bucket --bucket clipity-artifacts --region us-east-1

# Create SQS queue
aws sqs create-queue --queue-name clipity-jobs --attributes VisibilityTimeout=3600

# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier clipity-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.4 \
  --allocated-storage 20 \
  --master-username clipity \
  --master-user-password YOUR_PASSWORD \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name your-subnet-group
```

### Step 2: Environment Variables

Create a `.env.cloud` file:

```bash
# Mode
APP_MODE=cloud

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Services
DATABASE_URL=postgresql://clipity:password@clipity-db.xxx.us-east-1.rds.amazonaws.com:5432/clipity
S3_BUCKET=clipity-artifacts
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/clipity-jobs

# Required APIs
GEMINI_API_KEY=your_gemini_key

# Worker settings
WORKER_CONCURRENCY=2
WORKER_POLL_INTERVAL_MS=2000
```

### Step 3: Containerize

Create `Dockerfile`:

```dockerfile
FROM oven/bun:1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    yt-dlp \
    && rm -rf /var/lib/apt/lists/*

# Install whisper-cli (from GitHub releases or build)
RUN pip3 install openai-whisper

# Copy package files
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build if needed
RUN bun run build || true

EXPOSE 3000

# Default to web, override for worker
CMD ["bun", "run", "src/web/server.ts"]
```

### Step 4: Deploy Web Server (ECS Fargate)

```bash
# Create ECR repository
aws ecr create-repository --repository-name clipity-web

# Build and push
aws ecr get-login-password | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
docker build -t clipity-web .
docker tag clipity-web:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/clipity-web:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/clipity-web:latest

# Create ECS task definition and service
# (Use AWS Console or CloudFormation/Terraform for production)
```

### Step 5: Deploy Worker

```bash
# Create separate ECR repo for worker (same image, different command)
aws ecr create-repository --repository-name clipity-worker

# Deploy as ECS Service with desired count based on queue depth
# Or use Lambda for lightweight processing (requires adapter)
```

### Step 6: CloudFormation/Terraform (Production)

For production, use infrastructure as code:

```yaml
# Example CloudFormation resources
Resources:
  WebService:
    Type: AWS::ECS::Service
    Properties:
      Cluster: !Ref Cluster
      TaskDefinition: !Ref WebTaskDefinition
      DesiredCount: 2
      LaunchType: FARGATE

  WorkerService:
    Type: AWS::ECS::Service
    Properties:
      Cluster: !Ref Cluster
      TaskDefinition: !Ref WorkerTaskDefinition
      DesiredCount: 2
      LaunchType: FARGATE
      # Auto-scaling based on SQS queue depth
```

## Alternative: Docker Compose on EC2

For simpler deployment, use EC2 with Docker Compose:

```yaml
# docker-compose.yml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - APP_MODE=cloud
      - DATABASE_URL=${DATABASE_URL}
      - S3_BUCKET=${S3_BUCKET}
      - SQS_QUEUE_URL=${SQS_QUEUE_URL}
      - AWS_REGION=${AWS_REGION}
    command: bun run src/web/server.ts

  worker:
    build: .
    environment:
      - APP_MODE=cloud
      - DATABASE_URL=${DATABASE_URL}
      - S3_BUCKET=${S3_BUCKET}
      - SQS_QUEUE_URL=${SQS_QUEUE_URL}
      - AWS_REGION=${AWS_REGION}
      - WORKER_CONCURRENCY=2
    command: bun run src/worker.ts
    deploy:
      replicas: 2
```

Deploy:
```bash
# On EC2 instance
docker-compose up -d
docker-compose scale worker=4  # Scale workers as needed
```

## Environment-Specific Configuration

### Development (Local)

```bash
# .env.local
APP_MODE=local
GEMINI_API_KEY=xxx
```

```bash
# Terminal 1
bun run web

# Terminal 2
bun run worker
```

### Staging (Cloud)

```bash
# .env.staging
APP_MODE=cloud
DATABASE_URL=postgresql://...
S3_BUCKET=clipity-staging
SQS_QUEUE_URL=https://sqs...
```

### Production (Cloud)

```bash
# .env.production
APP_MODE=cloud
DATABASE_URL=postgresql://...
S3_BUCKET=clipity-prod
SQS_QUEUE_URL=https://sqs...
WORKER_CONCURRENCY=4
```

## Monitoring & Logging

### CloudWatch (AWS)

```bash
# View logs
aws logs tail /ecs/clipity-web --follow
aws logs tail /ecs/clipity-worker --follow
```

### Health Checks

Web server exposes health at `GET /` (returns dashboard, implicitly healthy).

For load balancer health checks, add:
```typescript
// In web/server.ts
if (url.pathname === "/health") {
  return new Response("OK", { status: 200 });
}
```

## Security Considerations

1. **IAM Roles**: Use task roles, not access keys
2. **Security Groups**: Restrict database to web/worker only
3. **Secrets**: Use AWS Secrets Manager or Parameter Store
4. **HTTPS**: Terminate at load balancer
5. **S3**: Enable bucket encryption, use signed URLs

## Cost Optimization

1. **Workers**: Use Spot instances for 70% savings
2. **S3**: Use Intelligent-Tiering
3. **Database**: Use Graviton instances (t4g)
4. **Scaling**: Scale workers to zero when queue empty

## Troubleshooting

### Worker not picking up jobs
- Check SQS queue URL is correct
- Verify IAM permissions for SQS
- Check worker logs for errors

### Database connection errors
- Verify security group allows connection
- Check DATABASE_URL format
- Ensure SSL is configured if required

### S3 upload failures
- Verify IAM permissions for S3
- Check bucket name and region
- Ensure bucket policy allows access

## Next Steps

1. Set up CI/CD pipeline (GitHub Actions, GitLab CI, etc.)
2. Configure monitoring (Datadog, New Relic, etc.)
3. Set up alerting for failed runs
4. Implement auto-scaling policies
