import { supabase } from '@/lib/supabase'

/**
 * Sube un PDF firmado a Supabase Storage
 * @returns La URL firmada del archivo subido, o null si falla
 */
export async function uploadSignedPDF(
  pdfBlob: Blob,
  folder: string,
  fileName: string
): Promise<string | null> {
  const filePath = `${folder}/${fileName}`

  try {
    const { error } = await supabase.storage
      .from('signed-pdfs')
      .upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (error) {
      console.error('Error uploading signed PDF:', error)
      return null
    }

    // Obtener URL firmada (válida por 1 año)
    const { data: urlData } = await supabase.storage
      .from('signed-pdfs')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365)

    return urlData?.signedUrl || null
  } catch (err) {
    console.error('Error in uploadSignedPDF:', err)
    return null
  }
}
