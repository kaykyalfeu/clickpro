-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'SENT', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "ProposalDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileData" TEXT,
    "leadId" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProposalDocument" ADD CONSTRAINT "ProposalDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
