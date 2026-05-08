-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('PRODUCTION', 'STAGING', 'DEVELOPMENT');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('RUNTIME_ERROR', 'API_LATENCY', 'PLAYBACK_ERROR', 'DEPLOYMENT', 'DATABASE', 'NETWORK', 'AUTH');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'MUTED', 'IGNORED');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'HEALTHY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuntimeEvent" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "category" "EventCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "stackTrace" TEXT,
    "metadata" JSONB,
    "fingerprint" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issueId" TEXT,

    CONSTRAINT "RuntimeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'TRIGGERED',
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateIndex
CREATE INDEX "RuntimeEvent_serviceId_createdAt_idx" ON "RuntimeEvent"("serviceId", "createdAt");

-- CreateIndex
CREATE INDEX "RuntimeEvent_fingerprint_idx" ON "RuntimeEvent"("fingerprint");

-- CreateIndex
CREATE INDEX "RuntimeEvent_category_createdAt_idx" ON "RuntimeEvent"("category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_fingerprint_key" ON "Issue"("fingerprint");

-- CreateIndex
CREATE INDEX "Issue_status_lastSeenAt_idx" ON "Issue"("status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "Alert_serviceId_status_idx" ON "Alert"("serviceId", "status");

-- CreateIndex
CREATE INDEX "Alert_status_triggeredAt_idx" ON "Alert"("status", "triggeredAt");

-- CreateIndex
CREATE INDEX "Deployment_serviceId_deployedAt_idx" ON "Deployment"("serviceId", "deployedAt");

-- AddForeignKey
ALTER TABLE "RuntimeEvent" ADD CONSTRAINT "RuntimeEvent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuntimeEvent" ADD CONSTRAINT "RuntimeEvent_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
