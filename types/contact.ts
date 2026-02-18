// types/contact.ts

export interface Contact {
  id: string
  phone: string
  name?: string | null
  company?: string | null
  customData?: Record<string, unknown> | null
  blacklisted: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ImportContactInput {
  phone: string
  name?: string
  company?: string
  [key: string]: unknown // Campos customizados
}

export interface ContactWithStats extends Contact {
  totalCampaigns: number
  lastMessageAt?: Date
}