// types/whatsapp.ts

export interface WhatsAppInstance {
  id: string
  name: string
  instanceKey: string
  phone: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface InstanceStatus {
  instance: string
  state: 'open' | 'close' | 'connecting'
}