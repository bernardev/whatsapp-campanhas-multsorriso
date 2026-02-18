// types/campaign.ts
import { MessageStatus as PrismaMessageStatus, CampaignStatus as PrismaCampaignStatus } from '@prisma/client'

// Usa os tipos do Prisma diretamente
export type MessageStatus = PrismaMessageStatus
export type CampaignStatus = PrismaCampaignStatus

export interface Campaign {
  id: string
  name: string
  message: string
  scheduledAt?: Date | null
  status: CampaignStatus
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateCampaignInput {
  name: string
  message: string
  scheduledAt?: Date
  contactIds: string[]
}

export interface CampaignStats {
  total: number
  sent: number
  delivered: number
  read: number
  failed: number
  pending: number
}