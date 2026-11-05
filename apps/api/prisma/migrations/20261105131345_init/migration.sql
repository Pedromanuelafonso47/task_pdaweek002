-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('INDIVIDUAL', 'COOPERATIVE', 'COMPANY', 'NGO');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FARMER', 'TECHNICIAN', 'ADMIN');

-- CreateEnum
CREATE TYPE "FarmerType" AS ENUM ('FAMILY', 'COMMERCIAL', 'COOPERATIVE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "TerrainType" AS ENUM ('FLAT', 'GENTLE_SLOPE', 'STEEP_SLOPE', 'VALLEY', 'MIXED');

-- CreateEnum
CREATE TYPE "SoilType" AS ENUM ('CLAY', 'SANDY', 'LOAM', 'SILT', 'CLAY_LOAM', 'SANDY_LOAM', 'LATERITIC', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WaterAvailability" AS ENUM ('SCARCE', 'SEASONAL', 'MODERATE', 'ABUNDANT');

-- CreateEnum
CREATE TYPE "WaterSource" AS ENUM ('WELL', 'BOREHOLE', 'RIVER', 'LAKE', 'RAINWATER', 'MUNICIPAL', 'DAM', 'NONE');

-- CreateEnum
CREATE TYPE "IrrigationSystem" AS ENUM ('NONE', 'MANUAL', 'FURROW', 'SPRINKLER', 'DRIP', 'PIVOT');

-- CreateEnum
CREATE TYPE "Connectivity" AS ENUM ('NONE', 'LIMITED', 'GOOD');

-- CreateEnum
CREATE TYPE "TechLevel" AS ENUM ('NONE', 'BASIC', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "WaterNeed" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "PlantingStatus" AS ENUM ('PLANNED', 'GROWING', 'HARVESTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('SOWING', 'FERTILIZER', 'TREATMENT', 'IRRIGATION', 'WEEDING', 'OBSERVATION', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EXPENSE', 'INCOME');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('SEEDS', 'FERTILIZER', 'PESTICIDE', 'LABOR', 'IRRIGATION', 'EQUIPMENT', 'IOT', 'FUEL', 'TRANSPORT', 'RENT', 'SALES', 'SUBSIDY', 'OTHER');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('CONTROLLER', 'SENSOR_NODE', 'GATEWAY', 'WEATHER_STATION');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('PENDING', 'ONLINE', 'OFFLINE', 'DISABLED');

-- CreateEnum
CREATE TYPE "OperationMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "SensorKind" AS ENUM ('SOIL_MOISTURE', 'SOIL_TEMPERATURE', 'SOIL_PH', 'SOIL_EC', 'AIR_TEMPERATURE', 'AIR_HUMIDITY', 'LIGHT', 'RAIN', 'WATER_LEVEL', 'WATER_FLOW', 'ENERGY');

-- CreateEnum
CREATE TYPE "ActuatorKind" AS ENUM ('PUMP', 'VALVE', 'FAN', 'LIGHT', 'OTHER');

-- CreateEnum
CREATE TYPE "ComparisonOperator" AS ENUM ('LT', 'GT');

-- CreateEnum
CREATE TYPE "CommandAction" AS ENUM ('ON', 'OFF');

-- CreateEnum
CREATE TYPE "CommandStatus" AS ENUM ('PENDING', 'SENT', 'ACKED', 'REJECTED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProjectCategory" AS ENUM ('SMART_IRRIGATION', 'SOIL_MONITORING', 'ENVIRONMENTAL_MONITORING', 'SMART_FARMING', 'RESOURCE_MANAGEMENT');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "QuantityRule" AS ENUM ('FIXED', 'PER_HECTARE', 'PER_ZONE');

-- CreateEnum
CREATE TYPE "RecommendationSource" AS ENUM ('ENGINE', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED', 'IMPLEMENTED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FarmProjectStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'INDIVIDUAL',
    "country" TEXT NOT NULL DEFAULT 'AO',
    "currency" TEXT NOT NULL DEFAULT 'AOA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'FARMER',
    "farmerType" "FarmerType",
    "province" TEXT,
    "municipality" TEXT,
    "locality" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingDraft" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedBy" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianAssignment" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "TechnicianAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "municipality" TEXT,
    "locality" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "boundary" JSONB,
    "totalAreaHa" DECIMAL(10,2) NOT NULL,
    "cultivatedAreaHa" DECIMAL(10,2) NOT NULL,
    "terrainType" "TerrainType" NOT NULL DEFAULT 'FLAT',
    "soilType" "SoilType" NOT NULL DEFAULT 'UNKNOWN',
    "waterAvailability" "WaterAvailability" NOT NULL DEFAULT 'MODERATE',
    "waterSource" "WaterSource" NOT NULL DEFAULT 'NONE',
    "irrigationSystem" "IrrigationSystem" NOT NULL DEFAULT 'NONE',
    "hasElectricity" BOOLEAN NOT NULL DEFAULT false,
    "internet" "Connectivity" NOT NULL DEFAULT 'NONE',
    "hasSensors" BOOLEAN NOT NULL DEFAULT false,
    "hasPumps" BOOLEAN NOT NULL DEFAULT false,
    "hasMachinery" BOOLEAN NOT NULL DEFAULT false,
    "techLevel" "TechLevel" NOT NULL DEFAULT 'NONE',
    "budgetKz" DECIMAL(14,2),
    "goals" TEXT[],
    "problems" TEXT[],
    "otherGoal" TEXT,
    "photos" TEXT[],
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Field" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaHa" DECIMAL(10,2) NOT NULL,
    "boundary" JSONB,
    "soilType" "SoilType",
    "isIrrigationZone" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmEvent" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scientificName" TEXT,
    "category" TEXT NOT NULL,
    "cycleDays" INTEGER NOT NULL,
    "waterNeed" "WaterNeed" NOT NULL,
    "soilMoistureMin" DOUBLE PRECISION NOT NULL,
    "soilMoistureMax" DOUBLE PRECISION NOT NULL,
    "tempMin" DOUBLE PRECISION NOT NULL,
    "tempMax" DOUBLE PRECISION NOT NULL,
    "stages" JSONB NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Crop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planting" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldId" TEXT,
    "cropId" TEXT NOT NULL,
    "areaHa" DECIMAL(10,2) NOT NULL,
    "seedVariety" TEXT,
    "seedQuantityKg" DECIMAL(10,2),
    "season" TEXT,
    "harvestFrequency" TEXT,
    "plantedAt" TIMESTAMP(3),
    "expectedHarvestAt" TIMESTAMP(3),
    "status" "PlantingStatus" NOT NULL DEFAULT 'PLANNED',
    "estimatedYieldKg" DECIMAL(12,2),
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Planting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropActivity" (
    "id" TEXT NOT NULL,
    "plantingId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "product" TEXT,
    "quantity" DECIMAL(12,3),
    "unit" TEXT,
    "notes" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CropActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Harvest" (
    "id" TEXT NOT NULL,
    "plantingId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantityKg" DECIMAL(12,2) NOT NULL,
    "quality" TEXT,
    "notes" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Harvest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT,
    "plantingId" TEXT,
    "type" "TransactionType" NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AOA',
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldId" TEXT,
    "name" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "hardware" TEXT NOT NULL DEFAULT 'ESP32',
    "serial" TEXT,
    "mqttUsername" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'PENDING',
    "mode" "OperationMode" NOT NULL DEFAULT 'AUTO',
    "localRules" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "firmwareVersion" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sensor" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "fieldId" TEXT,
    "key" TEXT NOT NULL,
    "kind" "SensorKind" NOT NULL,
    "unit" TEXT NOT NULL,
    "minThreshold" DOUBLE PRECISION,
    "maxThreshold" DOUBLE PRECISION,
    "calibration" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sensor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorReading" (
    "id" BIGSERIAL NOT NULL,
    "sensorId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actuator" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "ActuatorKind" NOT NULL,
    "name" TEXT NOT NULL,
    "isOn" BOOLEAN NOT NULL DEFAULT false,
    "maxRuntimeSec" INTEGER NOT NULL DEFAULT 1800,
    "lastChangedAt" TIMESTAMP(3),

    CONSTRAINT "Actuator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sensorId" TEXT NOT NULL,
    "operator" "ComparisonOperator" NOT NULL DEFAULT 'LT',
    "threshold" DOUBLE PRECISION NOT NULL,
    "stopThreshold" DOUBLE PRECISION NOT NULL,
    "actuatorId" TEXT NOT NULL,
    "maxDurationSec" INTEGER NOT NULL DEFAULT 900,
    "cooldownSec" INTEGER NOT NULL DEFAULT 1800,
    "waterLevelSensorId" TEXT,
    "minWaterLevel" DOUBLE PRECISION,
    "activeFrom" TEXT,
    "activeTo" TEXT,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Command" (
    "id" TEXT NOT NULL,
    "actuatorId" TEXT NOT NULL,
    "issuedById" TEXT,
    "ruleId" TEXT,
    "action" "CommandAction" NOT NULL,
    "durationSec" INTEGER,
    "status" "CommandStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ackAt" TIMESTAMP(3),

    CONSTRAINT "Command_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "category" "ProjectCategory" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "implementationDays" INTEGER NOT NULL,
    "solves" TEXT[],
    "supportsGoals" TEXT[],
    "requiresElectricity" BOOLEAN NOT NULL DEFAULT false,
    "worksOffline" BOOLEAN NOT NULL DEFAULT true,
    "requires" TEXT[],
    "controlsIrrigation" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "howItWorks" TEXT[],
    "architecture" JSONB NOT NULL,
    "wiring" JSONB NOT NULL,
    "firmware" TEXT,
    "assemblySteps" TEXT[],
    "maintenance" TEXT[],
    "benefits" TEXT[],
    "limitations" TEXT[],
    "useCases" TEXT[],
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectComponent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "quantityRule" "QuantityRule" NOT NULL DEFAULT 'FIXED',
    "maxQuantity" INTEGER,
    "unitPriceKz" DECIMAL(12,2) NOT NULL,
    "priceSource" TEXT NOT NULL DEFAULT 'Estimativa de referência AGROGENIUS (2026) — confirmar com fornecedores locais',
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "condition" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId","projectId")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" "RecommendationSource" NOT NULL DEFAULT 'ENGINE',
    "engineVersion" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "priority" "Priority" NOT NULL,
    "problem" TEXT NOT NULL,
    "reasons" JSONB NOT NULL,
    "bom" JSONB NOT NULL,
    "estimatedCostKz" DECIMAL(14,2) NOT NULL,
    "withinBudget" BOOLEAN NOT NULL,
    "roi" JSONB,
    "phases" JSONB,
    "warnings" TEXT[],
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "authorId" TEXT,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmProject" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "status" "FarmProjectStatus" NOT NULL DEFAULT 'PLANNED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "actualCostKz" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "farmId" TEXT,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "engine" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "farmId" TEXT,
    "type" TEXT NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicianAssignment_technicianId_farmId_key" ON "TechnicianAssignment"("technicianId", "farmId");

-- CreateIndex
CREATE INDEX "Farm_organizationId_idx" ON "Farm"("organizationId");

-- CreateIndex
CREATE INDEX "Farm_ownerId_idx" ON "Farm"("ownerId");

-- CreateIndex
CREATE INDEX "Field_farmId_idx" ON "Field"("farmId");

-- CreateIndex
CREATE INDEX "FarmEvent_farmId_createdAt_idx" ON "FarmEvent"("farmId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Crop_slug_key" ON "Crop"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Planting_clientId_key" ON "Planting"("clientId");

-- CreateIndex
CREATE INDEX "Planting_farmId_idx" ON "Planting"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "CropActivity_clientId_key" ON "CropActivity"("clientId");

-- CreateIndex
CREATE INDEX "CropActivity_plantingId_date_idx" ON "CropActivity"("plantingId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Harvest_clientId_key" ON "Harvest"("clientId");

-- CreateIndex
CREATE INDEX "Harvest_plantingId_idx" ON "Harvest"("plantingId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_clientId_key" ON "Transaction"("clientId");

-- CreateIndex
CREATE INDEX "Transaction_organizationId_date_idx" ON "Transaction"("organizationId", "date");

-- CreateIndex
CREATE INDEX "Transaction_farmId_date_idx" ON "Transaction"("farmId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Device_mqttUsername_key" ON "Device"("mqttUsername");

-- CreateIndex
CREATE INDEX "Device_farmId_idx" ON "Device"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "Sensor_deviceId_key_key" ON "Sensor"("deviceId", "key");

-- CreateIndex
CREATE INDEX "SensorReading_sensorId_recordedAt_idx" ON "SensorReading"("sensorId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Actuator_deviceId_key_key" ON "Actuator"("deviceId", "key");

-- CreateIndex
CREATE INDEX "Command_actuatorId_createdAt_idx" ON "Command"("actuatorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Recommendation_farmId_status_idx" ON "Recommendation"("farmId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_farmId_projectId_source_key" ON "Recommendation"("farmId", "projectId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "FarmProject_recommendationId_key" ON "FarmProject"("recommendationId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianAssignment" ADD CONSTRAINT "TechnicianAssignment_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianAssignment" ADD CONSTRAINT "TechnicianAssignment_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Field" ADD CONSTRAINT "Field_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmEvent" ADD CONSTRAINT "FarmEvent_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planting" ADD CONSTRAINT "Planting_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planting" ADD CONSTRAINT "Planting_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planting" ADD CONSTRAINT "Planting_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropActivity" ADD CONSTRAINT "CropActivity_plantingId_fkey" FOREIGN KEY ("plantingId") REFERENCES "Planting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_plantingId_fkey" FOREIGN KEY ("plantingId") REFERENCES "Planting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_plantingId_fkey" FOREIGN KEY ("plantingId") REFERENCES "Planting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actuator" ADD CONSTRAINT "Actuator_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_actuatorId_fkey" FOREIGN KEY ("actuatorId") REFERENCES "Actuator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_waterLevelSensorId_fkey" FOREIGN KEY ("waterLevelSensorId") REFERENCES "Sensor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Command" ADD CONSTRAINT "Command_actuatorId_fkey" FOREIGN KEY ("actuatorId") REFERENCES "Actuator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Command" ADD CONSTRAINT "Command_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Command" ADD CONSTRAINT "Command_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectComponent" ADD CONSTRAINT "ProjectComponent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmProject" ADD CONSTRAINT "FarmProject_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmProject" ADD CONSTRAINT "FarmProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmProject" ADD CONSTRAINT "FarmProject_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
