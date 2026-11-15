# CareOrbit (Guardian Oasis) — Production Deployment Guide

This guide details deployment options for **CareOrbit (Guardian Oasis)** on **Google Cloud Run** and **Vercel**, including container builds, environment configuration, IAM security permissions, and operational smoke tests.

---

## 1. Architecture & Deployment Targets

CareOrbit is a Next.js 14 App Router application with standalone output mode. It is designed to run in both serverless and containerized environments:

* **Primary Container Target:** Google Cloud Run (Fully managed serverless container runtime)
* **Preview / Jamstack Target:** Vercel (Edge network & serverless functions)

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
                         containerregistry.googleapis.com
  ```

### B. Secret Manager Configuration (Never commit secrets!)
Store production secrets securely in Google Secret Manager:
```bash
# 1. Iron Session Secret (min 32 characters)
echo -n "$(openssl rand -base64 32)" | gcloud secrets create iron-session-secret --data-file=-

# 2. Google Gemini API Key
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-

# 3. Resend Email API Key
echo -n "YOUR_RESEND_API_KEY" | gcloud secrets create resend-api-key --data-file=-
```

### C. Build & Deploy via Cloud Build
Run the automated build and deployment pipeline:
```bash
gcloud builds submit --config=cloudbuild.yaml .
```

Alternatively, build and deploy manually:
```bash
# 1. Build and push container image
gcloud builds submit --tag gcr.io/$PROJECT_ID/careorbit:latest

# 2. Deploy to Cloud Run with Port 8080 and Secrets
gcloud run deploy careorbit \
  --image gcr.io/$PROJECT_ID/careorbit:latest \
  --region us-central1 \
  --platform managed \
  --port 8080 \
  --allow-unauthenticated \
  --set-secrets="IRON_SESSION_SECRET=iron-session-secret:latest,GEMINI_API_KEY=gemini-api-key:latest,RESEND_API_KEY=resend-api-key:latest" \
  --set-env-vars="NODE_ENV=production,RESEND_FROM_EMAIL=careorbit@yourdomain.com"
```

---

## 3. Google Cloud Service Permissions & IAM

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

## 4. Evaluation of Google Cloud Storage (GCS) for Prescriptions

* **Current Architecture:** MedSutra AI processes prescriptions in memory (`multipart/form-data` $\to$ ephemeral base64 buffer $\to$ Gemini Vision API). No medical images are written to persistent disk, preventing accidental PHI leakage.
* **When to Adopt GCS:** If clinical regulations require multi-year patient archive retention:
  1. Store image in a private GCS bucket with uniform bucket-level access and CMEK encryption.
  2. Generate short-lived (15-minute) signed download URLs only for authorized family managers.
  3. Deny all public read access via IAM policies.

---

## 5. Health Check & Monitoring

* **Liveness & Startup Probe:** Endpoint `/api/health` reports uptime, service status, and configuration health:
  ```json
  {
    "status": "healthy",
    "service": "guardian-oasis",
    "version": "1.0.0",
    "uptimeSeconds": 1420,
    "checks": {
      "sessionEngine": "active",
      "resendEmail": "configured",
      "geminiAi": "configured"
    }
  }
  ```
* **Cloud Logging:** Structured logs are emitted for CareLoop escalations, task claim handoffs, and watchdog scans.

---

## 6. Post-Deployment Smoke Verification

Run automated smoke tests locally or in CI:
```bash
npm run test
```

Verify the live endpoints:
```bash
# Health check probe
curl -f https://YOUR_DEPLOYED_URL/api/health

# Initial data retrieval (sanitized profile without raw PIN)
curl -f https://YOUR_DEPLOYED_URL/api/care/today

# Watchdog routine scan
curl -X POST https://YOUR_DEPLOYED_URL/api/care/cron-watchdog
```
