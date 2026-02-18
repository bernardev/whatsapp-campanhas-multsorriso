// types/campaign.ts

export type CampaignStatus = 
  | 'DRAFT' 
  | 'SCHEDULED' 
  | 'RUNNING' 
  | 'PAUSED' 
  | 'COMPLETED' 
  | 'CANCELLED'

export type MessageStatus = 
  | 'PENDING'
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'

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