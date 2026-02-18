// types/message.ts

export type MessageStatus = 
  | 'PENDING'
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'

export interface Message {
  id: string
  campaignId: string
  contactId: string
  instanceId: string
  text: string
  status: MessageStatus
  sentAt?: Date | null
  deliveredAt?: Date | null
  readAt?: Date | null
  errorMsg?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface MessageWithContact extends Message {
  contact: {
    phone: string
    name?: string | null
  }
}