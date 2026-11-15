# CareOrbit (Guardian Oasis) — Production Deployment & Cloud Hardening Guide

This guide details deployment options for **CareOrbit (Guardian Oasis)** on **Google Cloud Run** and **Vercel**, including container builds, environment configuration, Secret Manager bindings, Cloud Scheduler setup, IAM security permissions, and operational smoke tests.

---

## 1. Architecture & Deployment Targets

CareOrbit is a Next.js 14 App Router application with standalone output mode. It is designed to run in both serverless and containerized environments:

* **Primary Container Target:** Google Cloud Run (Fully managed serverless container runtime)
* **Autonomous Watchdog Engine:** Google Cloud Scheduler (Cron service invoking `/api/care/cron-watchdog`)
* **Relational Database:** PostgreSQL / Supabase with Row Level Security (RLS)
* **Secret Storage:** Google Secret Manager (Zero hardcoded credentials)
* **Preview / Jamstack Target:** Vercel (Edge network & preview deployments)

---

## 2. Google Cloud Run Deployment

### A. Prerequisites
* [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed and initialized.
* Active GCP project with billing enabled.
* Required Google Cloud APIs enabled:
  ```bash
  gcloud services enable run.googleapis.com \
                         cloudbuild.googleapis.com \
                         secretmanager.googleapis.com \
                         cloudscheduler.googleapis.com \
                         containerregistry.googleapis.com
  ```

### B. Secret Manager Configuration (Never commit secrets!)
Store production secrets securely in Google Secret Manager:
```bash
# 1. Iron Session Secret (min 32 characters)
echo -n "$(openssl rand -base64 32)" | gcloud secrets create iron-session-secret --data-file=-

# 2. CareLoop Cron Watchdog Secret (prevents unauthorized execution)
echo -n "$(openssl rand -hex 24)" | gcloud secrets create cron-secret --data-file=-

# 3. Google Gemini API Key
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-

# 4. Resend Email API Key
echo -n "YOUR_RESEND_API_KEY" | gcloud secrets create resend-api-key --data-file=-

# 5. PostgreSQL Database URL (Supabase / Cloud SQL)
echo -n "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" | gcloud secrets create database-url --data-file=-
```

### C. Build & Deploy via Cloud Build
Run the automated build and deployment pipeline:
```bash
gcloud builds submit --config=cloudbuild.yaml .
```

Alternatively, deploy directly to Cloud Run:
```bash
gcloud run deploy careorbit \
  --image gcr.io/$PROJECT_ID/careorbit:latest \
  --region us-central1 \
  --platform managed \
  --port 8080 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,PORT=8080,EMAIL_FROM=notifications@yourdomain.com" \
  --set-secrets="IRON_SESSION_SECRET=iron-session-secret:latest,CRON_SECRET=cron-secret:latest,GEMINI_API_KEY=gemini-api-key:latest,RESEND_API_KEY=resend-api-key:latest,DATABASE_URL=database-url:latest"
```

---

## 3. Google Cloud Scheduler (CareLoop Watchdog Setup)

To execute the CareLoop autonomous watchdog every 15 minutes, configure a Google Cloud Scheduler job that passes the secure `CRON_SECRET`:

```bash
# 1. Retrieve the deployed Cloud Run URL
SERVICE_URL=$(gcloud run services describe careorbit --region us-central1 --format='value(status.url)')

# 2. Retrieve CRON_SECRET value from Secret Manager
CRON_SECRET_VAL=$(gcloud secrets versions access latest --secret="cron-secret")

# 3. Create Cloud Scheduler recurring job (runs every 15 minutes)
gcloud scheduler jobs create http careloop-watchdog-trigger \
  --schedule="*/15 * * * *" \
  --uri="${SERVICE_URL}/api/care/cron-watchdog" \
  --http-method=POST \
  --headers="x-cron-secret=${CRON_SECRET_VAL}" \
  --time-zone="America/New_York" \
  --description="Autonomous watchdog for upcoming doses and overdue escalation"
```

---

## 4. Google Cloud Service Permissions & IAM

The Cloud Run execution service account requires minimal, least-privilege IAM roles:

| Role | Name | Purpose |
|---|---|---|
| `roles/secretmanager.secretAccessor` | Secret Manager Secret Accessor | Allows Cloud Run to read session keys and API secrets at startup. |
| `roles/logging.logWriter` | Logs Writer | Enables Cloud Logging for structured error monitoring and audit events. |
| `roles/monitoring.metricWriter` | Monitoring Metric Writer | Enables Cloud Monitoring for latency, memory, and container metrics. |

Grant Secret Accessor role to the Cloud Run service identity:
```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 5. Evaluation of Google Cloud Storage (GCS) for Prescriptions

* **Current Architecture:** MedSutra AI processes prescriptions in memory (`multipart/form-data` $\to$ ephemeral binary buffer $\to$ Gemini Vision API). No medical images are written to persistent disk, preventing accidental PHI leakage.
* **When to Adopt GCS:** If clinical regulations require multi-year patient archive retention:
  1. Store image in a private GCS bucket with uniform bucket-level access and CMEK encryption.
  2. Generate short-lived (15-minute) signed download URLs only for authorized family managers.
  3. Deny all public read access via IAM policies.

---

## 6. Health Check & Monitoring

* **Liveness & Startup Probe:** Endpoint `/api/health` reports uptime, service status, database connectivity, and configuration health:
  ```json
  {
    "status": "healthy",
    "service": "guardian-oasis",
    "version": "1.0.0",
    "checks": {
      "sessionEngine": "active",
      "database": { "connected": true, "engine": "postgresql" },
      "resendEmail": "configured",
      "geminiAi": "configured",
      "cronWatchdog": "configured"
    }
  }
  ```
