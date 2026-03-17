
import * as QRCode from 'qrcode'
import { DATAMatrix } from 'datamatrix-svg-ts'
import Code128Generator from 'code-128-encoder'

export const encodeQRCodeToDataURL = (text: string) => QRCode.toDataURL(text, {
  type: 'image/png',
  margin: 0, scale: 1,
})

export const encodeDataMatrixToDataURL = (text: string) => {
  const el = DATAMatrix({ message: text, dimension: 1, padding: 0 })
  const { width, height } = el.viewBox.baseVal
  el.setAttribute('width', `${width}`)
  el.setAttribute('height', `${height}`)
  return `data:image/svg+xml,${encodeURIComponent(el.outerHTML)}`
}

let code128: Code128Generator
let code128Options: Code128Generator.StringOutputOptions
export const encodeCode128ToDataURL = (text: string) => {
  code128 ??= new Code128Generator()
  code128Options ??= { output: 'weights' as Code128Generator.OutputMode.WEIGHTS }
  let result: string[] = [], width = 0, isBlack = true
  for (const i of code128.encode(text, code128Options)) {
    if (isBlack) {
      result[result.length] = `<rect x="${width}" width="${i}" height="20"/>`
    }
    const j = +i
    if (j !== j) { result.length = 0; width = 20; break }
    width += j; isBlack = !isBlack
  }
  const svg = `\
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" viewBox="0 0 ${width} 20" fill="#000">
${result.join('\n')}
</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
