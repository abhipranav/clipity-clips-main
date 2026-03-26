# Deploying Clipity on EC2 Ubuntu (Local Mode)

## Overview
This guide deploys Clipity on a single EC2 instance using **local mode**:
- SQLite database (stored on EBS volume)
- Local file system for videos and outputs
- Local SQLite-backed queue with a single worker service (no SQS needed)
- Self-contained on one server

## Prerequisites

### EC2 Instance Requirements
- **Instance Type**: t3.large or larger (recommend t3.xlarge for production)
- **OS**: Ubuntu 22.04 LTS
- **Storage**: 50GB+ EBS volume (gp3 recommended)
- **Security Group**: Ports 22 (SSH) and 3000 (HTTP) open

### Domain Setup (Optional but Recommended)
Point your domain to the EC2 public IP or use an Elastic IP.

---

## Step 1: Launch EC2 Instance

1. Launch Ubuntu 22.04 instance
2. Configure security group:
   - SSH (port 22): Your IP only
   - HTTP (port 3000): 0.0.0.0/0 (or your IP for testing)
3. Create or select an SSH key pair
4. Launch and note the public IP

---

## Step 2: Run Setup Script

SSH into your instance and run:

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP

# Download and run setup script
curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/scripts/setup-ec2.sh | sudo bash
```

Or manually copy the setup script:
```bash
scp -i your-key.pem scripts/setup-ec2.sh ubuntu@YOUR_EC2_IP:/tmp/
ssh -i your-key.pem ubuntu@YOUR_EC2_IP "sudo bash /tmp/setup-ec2.sh"
```

---

## Step 3: Configure Environment

Edit the environment file:

```bash
sudo nano /opt/clipity/.env
```

Minimum required:
```env
GEMINI_API_KEY=your_actual_gemini_api_key
APP_URL=http://YOUR_EC2_PUBLIC_IP:3000
```

Optional settings:
```env
WHISPER_MODEL=base          # tiny/base/small/medium/large
MAX_PARALLEL_CLIPS=3        # 1-10
WORKER_CONCURRENCY=1
WORKER_POLL_INTERVAL_MS=2000
WHISPER_CACHE_DIR=/opt/clipity/models/whisper
YTDLP_RETRY_ATTEMPTS=6
YTDLP_RETRY_BASE_DELAY_MS=1500
YTDLP_USE_IPV4=true
# Strongly recommended on EC2 when YouTube bot checks appear:
# comma-separated rotating proxies (residential/mobile generally more reliable)
# YTDLP_PROXY_URLS=http://user:pass@proxy1:8080,http://user:pass@proxy2:8080
OUTPUT_WIDTH=1080
OUTPUT_HEIGHT=1920
PORT=3000
```

If yt-dlp shows "Sign in to confirm you're not a bot" or "Precondition check failed", this app now automatically retries with multiple YouTube player client profiles and backoff. If all attempts still fail, configure `YTDLP_PROXY_URLS` to enable automatic per-attempt proxy rotation without needing frequent cookies refresh.

---

## Step 4: Deploy Application Code

From your local machine:

```bash
# Copy your code to EC2
scp -i your-key.pem -r . ubuntu@YOUR_EC2_IP:/opt/clipity/

# SSH in and install dependencies
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
cd /opt/clipity
bun install
bun run build
```

The production web server serves the built frontend from `frontend/dist`, so `bun run build` is required before starting `clipity-web`.

---

## Step 5: Install Systemd Services

```bash
# Copy service files
sudo cp scripts/clipity-web.service /etc/systemd/system/
sudo cp scripts/clipity-worker.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable services to start on boot
sudo systemctl enable clipity-web
sudo systemctl enable clipity-worker

# Start services
sudo systemctl start clipity-web
sudo systemctl start clipity-worker

# Check status
sudo systemctl status clipity-web
sudo systemctl status clipity-worker
```

When updating to the latest downloader resilience logic, run:
```bash
cd /opt/clipity
bun install --frozen-lockfile
bun run build
sudo systemctl restart clipity-worker
sudo systemctl restart clipity-web
```

Recommended order:
```bash
sudo systemctl start clipity-worker
sudo systemctl start clipity-web
```

---

## Step 6: Verify Deployment

Check logs:
```bash
# Web server logs
sudo journalctl -u clipity-web -f

# Worker logs
sudo journalctl -u clipity-worker -f
```

Test the web interface:
```bash
curl http://YOUR_EC2_IP:3000
```

Open in browser:
```
http://YOUR_EC2_PUBLIC_IP:3000
```

---

## Step 7: (Optional) Setup Reverse Proxy with Nginx

For production, add a domain and HTTPS:

```bash
sudo apt install nginx certbot python3-certbot-nginx

# Create nginx config
sudo tee /etc/nginx/sites-available/clipity << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    client_max_body_size 500M;
}
EOF

sudo ln -s /etc/nginx/sites-available/clipity /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

Update `.env`:
```env
APP_URL=https://your-domain.com
```

---

## Step 8: Security Hardening

### 1. Firewall (UFW)
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'  # or port 3000 if not using nginx
sudo ufw enable
```

### 2. Disable Password Authentication
Edit `/etc/ssh/sshd_config`:
```
PasswordAuthentication no
PermitRootLogin no
```

```bash
sudo systemctl restart ssh
```

### 3. Create Limited User (Optional)
The setup already runs as `ubuntu` user. For extra security:
```bash
sudo adduser clipity
sudo usermod -aG sudo clipity
# Update service files to use User=clipity
```

### 4. Enable Automatic Updates
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

---

## Monitoring & Maintenance

### View Logs
```bash
# Real-time logs
sudo journalctl -u clipity-web -f
sudo journalctl -u clipity-worker -f

# Recent logs
sudo journalctl -u clipity-web --since "1 hour ago"
```

### Restart Services
```bash
sudo systemctl restart clipity-web
sudo systemctl restart clipity-worker
```

### Check Disk Space
```bash
df -h
# Videos and outputs are in /opt/clipity/output/
```

### Check Frontend Build
```bash
ls -lah /opt/clipity/frontend/dist
```

### Database Backup
```bash
# SQLite is at /opt/clipity/data/checkpoints.db
# Backup to S3 (optional):
aws s3 cp /opt/clipity/data/checkpoints.db s3://your-backup-bucket/clipity-$(date +%Y%m%d).db
```

### Important Operational Notes
- Run only one `clipity-worker` service when using the local SQLite queue. The current queue implementation is intended for a single worker process on one machine.
- The server also needs `zip`, `ffmpeg`, `yt-dlp`, `youtube-transcript-api`, and `openai-whisper` installed for all web and pipeline features to work.
- Whisper model downloads should be cached on disk. The setup script uses `WHISPER_CACHE_DIR=/opt/clipity/models/whisper` so the model survives restarts.

---

## Troubleshooting

### Web server won't start
```bash
# Check for port conflicts
sudo lsof -i :3000

# Check logs
sudo journalctl -u clipity-web -n 50

# Verify .env exists and is readable
cat /opt/clipity/.env
```

### Worker won't start
```bash
# Check binary dependencies
which ffmpeg yt-dlp whisper-cli python3
ffmpeg -version
yt-dlp --version
whisper-cli -h

# Test preflight checks
cd /opt/clipity && bun run src/worker.ts
```

### YouTube bot-check failures on EC2
Symptoms in logs:
- `Precondition check failed`
- `Sign in to confirm you're not a bot`

Actions:
```bash
# verify latest yt-dlp binary
yt-dlp --version

# force update immediately (setup script also installs a 4-hour cron update)
sudo /usr/local/bin/clipity-update-ytdlp

# restart worker after env or yt-dlp updates
sudo systemctl restart clipity-worker
sudo journalctl -u clipity-worker -f
```

If failures persist, set `YTDLP_PROXY_URLS` in `/opt/clipity/.env` and restart `clipity-worker`.

### Out of disk space
```bash
# Check usage
du -sh /opt/clipity/*

# Clean old outputs
find /opt/clipity/output -name "*.mp4" -mtime +7 -delete

# Resize EBS volume (AWS console or CLI)
```

### High memory usage
```bash
# Monitor
htop

# Reduce parallelism in .env
MAX_PARALLEL_CLIPS=1
sudo systemctl restart clipity-worker
```

---

## Cost Optimization

### For development/testing:
- Use **t3.medium** (2 vCPU, 4GB RAM)
- Schedule instance start/stop
- Use Spot instances

### For production:
- **t3.xlarge** (4 vCPU, 16GB RAM) recommended
- Consider larger for batch processing
- gp3 EBS with 3000 IOPS

### Estimated Monthly Costs (us-east-1):
| Component | Spec | Cost/Month |
|-----------|------|-----------|
| EC2 | t3.xlarge | ~$125 |
| EBS | 100GB gp3 | ~$8 |
| Data Transfer | 100GB | ~$9 |
| **Total** | | **~$142/month** |

---

## Migrating to Cloud Mode Later

When you're ready to scale:

1. **Database**: Switch to RDS PostgreSQL
   ```env
   APP_MODE=cloud
   CHECKPOINT_BACKEND=postgres
   DATABASE_URL=postgresql://...
   ```

2. **Storage**: Switch to S3
   ```env
   ARTIFACT_BACKEND=s3
   S3_BUCKET=your-bucket
   AWS_REGION=us-east-1
   ```

3. **Queue**: Switch to SQS
   ```env
   QUEUE_BACKEND=sqs
   SQS_QUEUE_URL=https://...
   ```

4. **Architecture**: Split into:
   - Web server (ALB + ECS/Fargate)
   - Worker instances (Auto Scaling Group)

See `AWS-CLOUD-DEPLOY.md` for full cloud deployment guide.
