/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `candidates` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "list_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "smtp_host" TEXT,
ADD COLUMN     "smtp_pass" TEXT,
ADD COLUMN     "smtp_port" INTEGER,
ADD COLUMN     "smtp_user" TEXT;

-- CreateTable
CREATE TABLE "interview_sessions" (
    "id" TEXT NOT NULL,
    "interview_id" TEXT NOT NULL,
    "otp" TEXT,
    "otp_expires_at" TIMESTAMP(3),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "browser_info" TEXT,
    "os_info" TEXT,
    "ip_address" TEXT,
    "device_fingerprint" TEXT,
    "env_checked" BOOLEAN NOT NULL DEFAULT false,
    "camera_checked" BOOLEAN NOT NULL DEFAULT false,
    "mic_checked" BOOLEAN NOT NULL DEFAULT false,
    "speaker_checked" BOOLEAN NOT NULL DEFAULT false,
    "speed_checked" BOOLEAN NOT NULL DEFAULT false,
    "fullscreen_checked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "face_registrations" (
    "id" TEXT NOT NULL,
    "interview_id" TEXT NOT NULL,
    "face_image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "face_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proctoring_violations" (
    "id" TEXT NOT NULL,
    "interview_id" TEXT NOT NULL,
    "violation_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "screenshot_url" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proctoring_violations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "interview_sessions_interview_id_key" ON "interview_sessions"("interview_id");

-- CreateIndex
CREATE UNIQUE INDEX "face_registrations_interview_id_key" ON "face_registrations"("interview_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_email_key" ON "candidates"("email");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "candidate_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_registrations" ADD CONSTRAINT "face_registrations_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proctoring_violations" ADD CONSTRAINT "proctoring_violations_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
