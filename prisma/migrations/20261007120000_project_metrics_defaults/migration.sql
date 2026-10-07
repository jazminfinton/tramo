-- What Metrics opens with for each project: its period and the metric that
-- goes first. Every project that exists starts with what the app did until
-- now (four weeks, the hours over time first), so nothing changes until an
-- admin picks something else.
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "metricsLead" TEXT NOT NULL DEFAULT 'evolution',
ADD COLUMN     "metricsRange" TEXT NOT NULL DEFAULT '4w';
