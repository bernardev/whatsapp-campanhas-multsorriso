// app/(dashboard)/contatos/novo/novo-contato-client.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Image from 'next/image'
import { ArrowLeft, Save, Phone, User, Building2, AlertCircle } from 'lucide-react'
import { z, ZodError } from 'zod'

const contatoSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().min(10, 'Telefone inválido'),
  company: z.string().optional(),
})

type ContatoForm = z.infer<typeof contatoSchema>

interface NovoContatoClientProps {
  user: {
    id: string
    name: string
    email: string
  }
}

interface FormErrors {
  name?: string
  phone?: string
  company?: string
}

export default function NovoContatoClient({ user }: NovoContatoClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<boolean>(false)
  const [errors, setErrors] = useState<FormErrors>({})
  
  const [formData, setFormData] = useState<ContatoForm>({
    name: '',
    phone: '',
    company: '',
  })

  const handleLogout = async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const formatarTelefone = (valor: string): string => {
    const numeros = valor.replace(/\D/g, '')
    
    if (numeros.length <= 2) {
      return numeros
    } else if (numeros.length <= 7) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`
    } else if (numeros.length <= 11) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`
    }
    
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const formatted = formatarTelefone(e.target.value)
    setFormData({ ...formData, phone: formatted })
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setFormData({ ...formData, name: e.target.value })
  }

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setFormData({ ...formData, company: e.target.value })
  }

  const handleSubmit = async (): Promise<void> => {
    setLoading(true)
    setErrors({})

    try {
      const validated = contatoSchema.parse(formData)
      
      // Converte para formato +5541999999999
      const phoneNumeros = validated.phone.replace(/\D/g, '')
      const phoneFormatado = `+55${phoneNumeros}`

      const response = await fetch('/api/contatos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validated,
          phone: phoneFormatado,
        }),
      })

      if (!response.ok) {
        const data = await response.json() as { error?: string }
        throw new Error(data.error || 'Erro ao criar contato')
      }

      router.push('/contatos')
      router.refresh()
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors: FormErrors = {}
        error.issues.forEach((issue) => {
          const fieldName = issue.path[0]
          if (fieldName && typeof fieldName === 'string') {
            fieldErrors[fieldName as keyof FormErrors] = issue.message
          }
        })
        setErrors(fieldErrors)
      } else {
        alert(error instanceof Error ? error.message : 'Erro ao salvar contato')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Image
                src="/logo-multsorriso.png"
                alt="MultSorriso"
                width={140}
                height={56}
                className="object-contain cursor-pointer"
                onClick={() => router.push('/campanhas')}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-[#1D2748]">{user.name}</span>
                <span className="text-xs text-slate-500">{user.email}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="border-slate-200 hover:bg-slate-50 text-slate-700"
                onClick={handleLogout}
              >
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/contatos')}
            className="text-slate-600 hover:text-[#1D2748] mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Contatos
          </Button>
          
          <h1 className="text-3xl font-bold text-[#1D2748] mb-2">
            Novo Contato
          </h1>
          <p className="text-slate-600">
            Adicione um novo contato manualmente
          </p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-[#1D2748]">Informações do Contato</CardTitle>
            <CardDescription>Preencha os dados do contato</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#BD8F29]" />
                Nome *
              </Label>
              <Input
                id="name"
                placeholder="Ex: João da Silva"
                value={formData.name}
                onChange={handleNameChange}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* Telefone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#BD8F29]" />
                Telefone *
              </Label>
              <Input
                id="phone"
                placeholder="(41) 99999-9999"
                value={formData.phone}
                onChange={handlePhoneChange}
                maxLength={15}
                className={errors.phone ? 'border-red-500' : ''}
              />
              {errors.phone && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.phone}
                </p>
              )}
              <p className="text-xs text-slate-500">
                Formato: (DD) 99999-9999
              </p>
            </div>

            {/* Empresa */}
            <div className="space-y-2">
              <Label htmlFor="company" className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#BD8F29]" />
                Origem do lead
              </Label>
              <Input
                id="company"
                placeholder="Ex: atendimento presencial, redes sociais, indicação..."
                value={formData.company}
                onChange={handleCompanyChange}
              />
            </div>

            {/* Botão Salvar */}
            <div className="pt-4">
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#BD8F29] to-[#BD8F29]/90 text-white shadow-lg"
                size="lg"
              >
                <Save className="w-5 h-5 mr-2" />
                {loading ? 'Salvando...' : 'Salvar Contato'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}