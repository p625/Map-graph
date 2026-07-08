import { toPng } from 'html-to-image'
import type { ExportQuality } from './exportPresets'
import { getExportPixelRatio } from './exportPresets'

export interface ExportMapImageOptions {
  node: HTMLElement
  width: number
  height: number
  quality: ExportQuality
  filename: string
}

export async function exportMapImage(options: ExportMapImageOptions): Promise<void> {
  const { node, width, height, quality, filename } = options
  const pixelRatio = getExportPixelRatio(quality)

  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio,
    backgroundColor: '#ffffff',
    width,
    height,
    style: {
      transform: 'none',
      transformOrigin: 'top left',
    },
  })

  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}

export function getExportErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('SecurityError') || error.message.includes('tainted')) {
      return 'Export selhal kvůli bezpečnostním omezením prohlížeče. Zkuste obnovit stránku.'
    }
    return error.message
  }
  return 'Export mapy se nezdařil. Zkuste to prosím znovu.'
}
