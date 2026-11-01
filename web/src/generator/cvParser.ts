import { PDFParse } from 'pdf-parse'

/**
 * Extracts raw textual content from an uploaded PDF resume buffer.
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  try {
    const res = await parser.getText()
    return (res.text || '').trim()
  } finally {
    await parser.destroy().catch(() => {})
  }
}
