// app/(dashboard)/campanhas/nova/nova-campanha-client.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Image from 'next/image'
import { 
  ArrowLeft, 
  Send, 
  Save, 
  Eye, 
  Calendar,
  AlertCircle,
  Sparkles,
  Users,
  CheckSquare,
  Square,
  ImagePlus,  // ✅ NOVO
  X,          // ✅ NOVO
  Upload      // ✅ NOVO
} from 'lucide-react'
import { z, ZodError } from 'zod'

const campanhaSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  message: z.string().min(10, 'Mensagem deve ter pelo menos 10 caracteres'),
  scheduledAt: z.string().optional(),
  contactIds: z.array(z.string()).min(1, 'Selecione pelo menos um contato'),
  imageUrl: z.string().optional(),  // ✅ NOVO
})

type CampanhaForm = z.infer<typeof campanhaSchema>
type CampanhaStatus = 'DRAFT' | 'SCHEDULED'

interface Contact {
  id: string
  name: string | null
  phone: string
  company: string | null
}

interface NovaCampanhaClientProps {
  user: {
    id: string
    name: string
    email: string
  }
  contatos: Contact[]
}

interface FormErrors {
  name?: string
  message?: string
  scheduledAt?: string
  contactIds?: string
  imageUrl?: string  // ✅ NOVO
}

export default function NovaCampanhaClient({ user, contatos }: NovaCampanhaClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<boolean>(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  
  // ✅ NOVOS ESTADOS PARA IMAGEM
  const [imageUrl, setImageUrl] = useState<string>('')
  const [uploadingImage, setUploadingImage] = useState<boolean>(false)
  const [imagePreview, setImagePreview] = useState<string>('')
  
  const [formData, setFormData] = useState({
    name: '',
    message: '',
    scheduledAt: '',
  })

  // ✅ NOVA FUNÇÃO: Upload de imagem
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return

    // Valida tipo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      alert('Tipo de arquivo inválido. Use JPG, PNG, GIF ou WebP')
      return
    }

    // Valida tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo 5MB')
      return
    }

    try {
      setUploadingImage(true)

      // Preview local
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Upload para o servidor
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Erro ao fazer upload')
      }

      const data = await response.json()
      setImageUrl(data.imageUrl)
      
      console.log('✅ Imagem carregada:', data.imageUrl)
    } catch (error) {
      console.error('Erro ao upload:', error)
      alert('Erro ao fazer upload da imagem')
      setImagePreview('')
    } finally {
      setUploadingImage(false)
    }
  }

  // ✅ NOVA FUNÇÃO: Remover imagem
  const handleRemoveImage = (): void => {
    setImageUrl('')
    setImagePreview('')
  }

  const getPreviewMessage = (): string => {
    let preview = formData.message
    preview = preview.replace(/{nome}/gi, user.name)
    preview = preview.replace(/{empresa}/gi, 'MultSorriso')
    return preview
  }

  const handleSubmit = async (status: CampanhaStatus): Promise<void> => {
    setLoading(true)
    setErrors({})

    try {
      const validated = campanhaSchema.parse({
        ...formData,
        contactIds: selectedContacts,
        imageUrl: imageUrl || undefined,  // ✅ NOVO
      })

      const response = await fetch('/api/campanhas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validated,
          status,
          scheduledAt: validated.scheduledAt || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json() as { error?: string }
        throw new Error(data.error || 'Erro ao criar campanha')
      }

      router.push('/campanhas')
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
        alert(error instanceof Error ? error.message : 'Erro ao salvar campanha')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setFormData({ ...formData, name: e.target.value })
  }

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setFormData({ ...formData, message: e.target.value })
  }

  const handleScheduleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setFormData({ ...formData, scheduledAt: e.target.value })
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value)
  }

  const toggleContact = (contactId: string): void => {
    setSelectedContacts(prev => 
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    )
  }

  const toggleAll = (): void => {
    if (selectedContacts.length === contatosFiltrados.length) {
      setSelectedContacts([])
    } else {
      setSelectedContacts(contatosFiltrados.map(c => c.id))
    }
  }

  const formatPhone = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 13) {
      return `(${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`
    }
    return phone
  }

  const contatosFiltrados = contatos.filter((contato) => {
    const search = searchTerm.toLowerCase()
    return (
      contato.phone.includes(search) ||
      contato.name?.toLowerCase().includes(search) ||
      contato.company?.toLowerCase().includes(search)
    )
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => router.push('/campanhas')}
              className="text-slate-600 hover:text-[#1D2748]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => handleSubmit('DRAFT')}
                disabled={loading}
                className="border-slate-300"
              >
                <Save className="w-4 h-4 mr-2" />
                Salvar Rascunho
              </Button>
              <Button
                onClick={() => handleSubmit('SCHEDULED')}
                disabled={loading}
                className="bg-gradient-to-r from-[#BD8F29] to-[#BD8F29]/90 text-white shadow-lg"
              >
                <Send className="w-4 h-4 mr-2" />
                {formData.scheduledAt ? 'Agendar Campanha' : 'Criar Campanha'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1D2748] mb-2">Nova Campanha</h1>
          <p className="text-slate-600">Configure sua campanha de WhatsApp</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações Básicas */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-[#1D2748]">Informações Básicas</CardTitle>
                <CardDescription>Defina o nome e mensagem da campanha</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Campanha *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Promoção Black Friday 2024"
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

                {/* ✅ NOVO: Upload de Imagem */}
                <div className="space-y-2">
                  <Label htmlFor="image">Imagem da Campanha (Opcional)</Label>
                  
                  {!imagePreview ? (
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-[#BD8F29] transition-colors">
                      <input
                        type="file"
                        id="image"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                      <label
                        htmlFor="image"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        {uploadingImage ? (
                          <>
                            <Upload className="w-12 h-12 text-slate-400 animate-bounce" />
                            <p className="text-sm text-slate-600 font-medium">Enviando imagem...</p>
                          </>
                        ) : (
                          <>
                            <ImagePlus className="w-12 h-12 text-slate-400" />
                            <p className="text-sm text-slate-600 font-medium">Clique para fazer upload</p>
                            <p className="text-xs text-slate-500">JPG, PNG, GIF ou WebP até 5MB</p>
                          </>
                        )}
                      </label>
                    </div>
                  ) : (
                    <div className="relative border border-slate-300 rounded-lg p-4">
                      <button
                        onClick={handleRemoveImage}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <Image
                        src={imagePreview}
                        alt="Preview da imagem"
                        width={400}
                        height={300}
                        className="w-full h-auto rounded-lg"
                      />
                      <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                        <CheckSquare className="w-3 h-3" />
                        Imagem carregada com sucesso!
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem *</Label>
                  <Textarea
                    id="message"
                    placeholder="Digite sua mensagem aqui..."
                    rows={8}
                    value={formData.message}
                    onChange={handleMessageChange}
                    className={errors.message ? 'border-red-500' : ''}
                  />
                  {errors.message && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.message}
                    </p>
                  )}
                  <p className="text-xs text-slate-500">{formData.message.length} caracteres</p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">Variáveis Disponíveis</p>
                      <p className="text-xs text-blue-700 mb-2">Use estas variáveis na sua mensagem para personalizar:</p>
                      <div className="flex flex-wrap gap-2">
                        <code className="px-2 py-1 bg-white border border-blue-300 rounded text-xs text-blue-900">{'{nome}'}</code>
                        <code className="px-2 py-1 bg-white border border-blue-300 rounded text-xs text-blue-900">{'{empresa}'}</code>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Seleção de Contatos */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-[#1D2748] flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Selecionar Contatos *
                </CardTitle>
                <CardDescription>
                  {selectedContacts.length} de {contatos.length} contatos selecionados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {errors.contactIds && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.contactIds}
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <Input
                    placeholder="Buscar contatos..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                  <Button
                    variant="outline"
                    onClick={toggleAll}
                    className="whitespace-nowrap"
                  >
                    {selectedContacts.length === contatosFiltrados.length ? 'Desmarcar' : 'Selecionar'} Todos
                  </Button>
                </div>

                <div className="border border-slate-200 rounded-lg max-h-96 overflow-y-auto">
                  {contatosFiltrados.length > 0 ? (
                    <div className="divide-y divide-slate-200">
                      {contatosFiltrados.map((contato) => (
                        <div
                          key={contato.id}
                          className="p-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-3"
                          onClick={() => toggleContact(contato.id)}
                        >
                          <div className="flex-shrink-0">
                            {selectedContacts.includes(contato.id) ? (
                              <CheckSquare className="w-5 h-5 text-[#BD8F29]" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[#1D2748] truncate">
                              {contato.name || 'Sem nome'}
                            </p>
                            <p className="text-sm text-slate-600">{formatPhone(contato.phone)}</p>
                            {contato.company && (
                              <p className="text-xs text-slate-500">{contato.company}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500">
                      <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p>Nenhum contato encontrado</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Agendamento */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-[#1D2748] flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Agendamento (Opcional)
                </CardTitle>
                <CardDescription>Escolha quando enviar a campanha</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="scheduledAt">Data e Hora</Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    value={formData.scheduledAt}
                    onChange={handleScheduleChange}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                  <p className="text-xs text-slate-500">Deixe em branco para enviar manualmente</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-lg sticky top-24">
              <CardHeader>
                <CardTitle className="text-[#1D2748] flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Preview
                </CardTitle>
                <CardDescription>Como a mensagem ficará</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-2xl p-4 border border-green-200">
                  <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
                    {/* ✅ NOVO: Preview da Imagem */}
                    {imagePreview && (
                      <Image
                        src={imagePreview}
                        alt="Preview"
                        width={300}
                        height={200}
                        className="w-full h-auto rounded-lg"
                      />
                    )}
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {formData.message ? getPreviewMessage() : 'Digite uma mensagem para ver o preview...'}
                    </p>
                  </div>
                  <p className="text-xs text-green-700 mt-2 text-center">Exemplo de mensagem no WhatsApp</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}