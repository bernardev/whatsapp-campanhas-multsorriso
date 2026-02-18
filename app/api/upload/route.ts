// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { getUser } from '@/lib/auth'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File
    
    if (!file) {
      return NextResponse.json({ error: 'Nenhuma imagem enviada' }, { status: 400 })
    }

    // Valida tipo de arquivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Tipo de arquivo inválido. Use JPG, PNG, GIF ou WebP' 
      }, { status: 400 })
    }

    // Valida tamanho (máximo 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'Arquivo muito grande. Máximo 5MB' 
      }, { status: 400 })
    }

    // Gera nome único
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const ext = file.name.split('.').pop()
    const filename = `${timestamp}-${randomStr}.${ext}`

    // Converte para buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Salva no servidor
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'campanhas')
    const filepath = join(uploadDir, filename)
    
    await writeFile(filepath, buffer)

    // URL pública
    const imageUrl = `/uploads/campanhas/${filename}`

    console.log(`✅ [Upload] Imagem salva: ${imageUrl}`)

    return NextResponse.json({ 
      success: true,
      imageUrl 
    })
  } catch (error) {
    console.error('❌ [Upload] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao fazer upload da imagem' },
      { status: 500 }
    )
  }
}