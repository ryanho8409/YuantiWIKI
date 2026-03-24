-- CreateTable
CREATE TABLE "SpacePermission" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpacePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpacePermission_spaceId_idx" ON "SpacePermission"("spaceId");

-- CreateIndex
CREATE INDEX "SpacePermission_subjectType_subjectId_idx" ON "SpacePermission"("subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SpacePermission_spaceId_subjectType_subjectId_key" ON "SpacePermission"("spaceId", "subjectType", "subjectId");

-- AddForeignKey
ALTER TABLE "SpacePermission" ADD CONSTRAINT "SpacePermission_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpacePermission" ADD CONSTRAINT "SpacePermission_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
