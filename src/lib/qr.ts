/**
 * Ein QR-Code – ohne Bibliothek.
 *
 * Gebraucht wird er für genau einen Zweck: Auf dem ausgedruckten Putzplan
 * führt er zur Seite des Plans (`services/cleaningPdf`). Dafür genügt ein
 * kleiner Ausschnitt der Norm (ISO/IEC 18004): Text als Bytes, Fehlerkorrektur
 * «M» (15 %, der übliche Wert für Gedrucktes) und die Versionen 1 bis 6 –
 * bis 106 Bytes, für eine Adresse mehr als genug. Eine Bibliothek dafür käme
 * jedem Aufruf der App als Paket hinzu, für einen Haken, der selten gesetzt
 * wird; die PDF-Datei entsteht aus demselben Grund ohne (`lib/pdf`).
 *
 * Der Aufbau folgt der Norm Schritt für Schritt:
 *
 *  1. **Daten** – Modus «Byte», Länge, die Bytes, Abschluss und Füllbytes.
 *  2. **Fehlerkorrektur** – Reed-Solomon über GF(256), je Block; die Blöcke
 *     werden verschränkt, damit ein Fleck nicht einen Block allein trifft.
 *  3. **Muster** – Suchmuster in drei Ecken, Taktlinien, Ausrichtungsmuster.
 *  4. **Platzieren** – die Bits im Zickzack von unten rechts nach oben.
 *  5. **Maske** – von acht die mit der geringsten Strafe nach Norm, damit
 *     keine Flächen oder Muster entstehen, die einen Leser verwirren.
 *
 * Bewusst ohne Abhängigkeiten, damit sich der Code mit `node --test` prüfen
 * lässt (`tests/qr.test.ts`).
 */

/** Je Version (Index) für die Stufe «M»: Fehlerkorrektur-Bytes je Block. */
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16]
/** Je Version: Anzahl Blöcke – bei «M» bis Version 6 alle gleich lang. */
const BLOCKS = [0, 1, 1, 1, 2, 2, 4]
/** Je Version: alle Bytes zusammen, Daten und Fehlerkorrektur. */
const TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172]
/** Je Version: Mittelpunkte der Ausrichtungsmuster (Zeilen und Spalten). */
const ALIGNMENT = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]]

const MAX_VERSION = 6

/** Wie viele Datenbytes eine Version fasst. */
function dataCodewords(version: number): number {
  return TOTAL_CODEWORDS[version] - ECC_PER_BLOCK[version] * BLOCKS[version]
}

/**
 * Der QR-Code für einen Text – Zeile für Zeile, `true` ist ein dunkles Modul.
 *
 * Die Ruhezone (vier Module rundherum) gehört nicht dazu: Sie ist bloss
 * Platz, der frei bleiben muss, und den hält der Aufrufer frei.
 */
export function qrCode(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text)
  let version = 1
  // Modus (4 Bit) und Länge (8 Bit) kommen zu den Daten hinzu.
  while (version <= MAX_VERSION && dataCodewords(version) * 8 < 12 + bytes.length * 8) version++
  if (version > MAX_VERSION) {
    throw new RangeError(`Zu lang für einen QR-Code der Version ${MAX_VERSION}: ${text}`)
  }

  const codewords = withErrorCorrection(encodeData(bytes, version), version)
  const symbol = new QrSymbol(version)
  symbol.place(codewords)

  let best = 0
  let lowest = Infinity
  for (let mask = 0; mask < 8; mask++) {
    symbol.applyMask(mask)
    symbol.drawFormat(mask)
    const score = penalty(symbol.modules)
    if (score < lowest) {
      lowest = score
      best = mask
    }
    // Die Maske ist ihre eigene Umkehrung: ein zweites Mal hebt sie auf.
    symbol.applyMask(mask)
  }
  symbol.applyMask(best)
  symbol.drawFormat(best)
  return symbol.modules
}

/* ------------------------------------------------------------------ */
/* 1. Daten                                                            */
/* ------------------------------------------------------------------ */

function encodeData(bytes: Uint8Array, version: number): number[] {
  const capacity = dataCodewords(version) * 8
  const bits: number[] = []
  const put = (value: number, length: number) => {
    for (let index = length - 1; index >= 0; index--) bits.push((value >>> index) & 1)
  }

  put(0b0100, 4) // Modus «Byte»
  put(bytes.length, 8) // Länge – acht Bit bis Version 9
  for (const byte of bytes) put(byte, 8)
  put(0, Math.min(4, capacity - bits.length)) // Abschluss
  put(0, (8 - (bits.length % 8)) % 8) // auf ganze Bytes auffüllen

  const codewords: number[] = []
  for (let index = 0; index < bits.length; index += 8) {
    codewords.push(bits.slice(index, index + 8).reduce((byte, bit) => (byte << 1) | bit, 0))
  }
  // Der Rest wird abwechselnd mit 0xEC und 0x11 gefüllt – so will es die Norm.
  for (let pad = 0xec; codewords.length < capacity / 8; pad ^= 0xec ^ 0x11) codewords.push(pad)
  return codewords
}

/* ------------------------------------------------------------------ */
/* 2. Fehlerkorrektur                                                  */
/* ------------------------------------------------------------------ */

/** Multiplikation in GF(256) mit dem Polynom x⁸ + x⁴ + x³ + x² + 1. */
function gfMultiply(left: number, right: number): number {
  let product = 0
  for (let bit = 7; bit >= 0; bit--) {
    product = (product << 1) ^ ((product >>> 7) * 0x11d)
    product ^= ((right >>> bit) & 1) * left
  }
  return product
}

/** Das Generatorpolynom vom Grad `degree` – ohne den führenden Koeffizienten 1. */
function generator(degree: number): number[] {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let step = 0; step < degree; step++) {
    for (let index = 0; index < degree; index++) {
      result[index] = gfMultiply(result[index], root)
      if (index + 1 < degree) result[index] ^= result[index + 1]
    }
    root = gfMultiply(root, 0x02)
  }
  return result
}

/** Der Rest der Polynomdivision – die Fehlerkorrektur-Bytes eines Blocks. */
function remainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0)
  for (const byte of data) {
    const factor = byte ^ (result.shift() ?? 0)
    result.push(0)
    divisor.forEach((coefficient, index) => {
      result[index] ^= gfMultiply(coefficient, factor)
    })
  }
  return result
}

function withErrorCorrection(data: number[], version: number): number[] {
  const blocks = BLOCKS[version]
  const length = data.length / blocks
  const divisor = generator(ECC_PER_BLOCK[version])

  const dataBlocks: number[][] = []
  const eccBlocks: number[][] = []
  for (let block = 0; block < blocks; block++) {
    const part = data.slice(block * length, (block + 1) * length)
    dataBlocks.push(part)
    eccBlocks.push(remainder(part, divisor))
  }

  // Verschränkt: erst je Block das erste Byte, dann je Block das zweite …
  const result: number[] = []
  for (let index = 0; index < length; index++)
    for (const part of dataBlocks) result.push(part[index])
  for (let index = 0; index < divisor.length; index++) {
    for (const part of eccBlocks) result.push(part[index])
  }
  return result
}

/* ------------------------------------------------------------------ */
/* 3. bis 5. Das Symbol                                                */
/* ------------------------------------------------------------------ */

class QrSymbol {
  readonly size: number
  readonly modules: boolean[][]
  /** Was zu den festen Mustern gehört – dort kommen keine Daten hin. */
  private readonly fixed: boolean[][]

  constructor(version: number) {
    this.size = version * 4 + 17
    this.modules = Array.from({ length: this.size }, () =>
      new Array<boolean>(this.size).fill(false),
    )
    this.fixed = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))

    // Taktlinien: abwechselnd dunkel und hell, in Zeile und Spalte 6.
    for (let index = 0; index < this.size; index++) {
      this.set(6, index, index % 2 === 0)
      this.set(index, 6, index % 2 === 0)
    }

    // Suchmuster in drei Ecken – samt dem hellen Rand, der sie freistellt.
    const far = this.size - 4
    for (const [x, y] of [
      [3, 3],
      [far, 3],
      [3, far],
    ]) {
      this.square(x, y, 4, (distance) => distance !== 2 && distance !== 4)
    }

    // Ausrichtungsmuster – ausser dort, wo ein Suchmuster steht.
    const positions = ALIGNMENT[version]
    const last = positions.length - 1
    positions.forEach((y, row) =>
      positions.forEach((x, column) => {
        const onFinder =
          (row === 0 && column === 0) ||
          (row === 0 && column === last) ||
          (row === last && column === 0)
        if (!onFinder) this.square(x, y, 2, (distance) => distance !== 1)
      }),
    )

    // Platz für die Formatangaben – gesetzt werden sie nach der Maske.
    this.drawFormat(0)
  }

  private set(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark
    this.fixed[y][x] = true
  }

  /** Ein Quadrat um (x, y), Modul für Modul nach seinem Abstand zur Mitte. */
  private square(x: number, y: number, radius: number, dark: (distance: number) => boolean) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const column = x + dx
        const row = y + dy
        if (column < 0 || row < 0 || column >= this.size || row >= this.size) continue
        this.set(column, row, dark(Math.max(Math.abs(dx), Math.abs(dy))))
      }
    }
  }

  /**
   * Die Formatangaben: Stufe der Fehlerkorrektur und Maske, 15 Bit mit
   * eigener Fehlerkorrektur – zweimal, damit eine beschädigte Ecke nicht
   * den ganzen Code kostet.
   */
  drawFormat(mask: number) {
    const data = (0b00 << 3) | mask // Stufe «M» ist 00
    let rest = data
    for (let step = 0; step < 10; step++) rest = (rest << 1) ^ ((rest >>> 9) * 0x537)
    const bits = ((data << 10) | rest) ^ 0x5412
    const bit = (index: number) => ((bits >>> index) & 1) === 1

    for (let index = 0; index <= 5; index++) this.set(8, index, bit(index))
    this.set(8, 7, bit(6))
    this.set(8, 8, bit(7))
    this.set(7, 8, bit(8))
    for (let index = 9; index < 15; index++) this.set(14 - index, 8, bit(index))

    for (let index = 0; index < 8; index++) this.set(this.size - 1 - index, 8, bit(index))
    for (let index = 8; index < 15; index++) this.set(8, this.size - 15 + index, bit(index))
    this.set(8, this.size - 8, true) // das eine Modul, das immer dunkel ist
  }

  /** Die Bytes im Zickzack: je zwei Spalten, abwechselnd hinauf und hinunter. */
  place(codewords: number[]) {
    const total = codewords.length * 8
    let index = 0
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5 // die senkrechte Taktlinie wird übersprungen
      const upward = ((right + 1) & 2) === 0
      for (let step = 0; step < this.size; step++) {
        const y = upward ? this.size - 1 - step : step
        for (const x of [right, right - 1]) {
          if (this.fixed[y][x] || index >= total) continue
          this.modules[y][x] = ((codewords[index >>> 3] >>> (7 - (index & 7))) & 1) === 1
          index++
        }
      }
    }
  }

  /** Kehrt die Datenmodule nach einer der acht Masken um. */
  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (!this.fixed[y][x] && masked(mask, x, y)) this.modules[y][x] = !this.modules[y][x]
      }
    }
  }
}

function masked(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0
    case 1:
      return y % 2 === 0
    case 2:
      return x % 3 === 0
    case 3:
      return (x + y) % 3 === 0
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
  }
}

/** Ein Suchmuster samt hellem Vorfeld – 1:1:3:1:1 und vier helle Module. */
const FINDER_LIKE = [
  [true, false, true, true, true, false, true, false, false, false, false],
  [false, false, false, false, true, false, true, true, true, false, true],
]

/**
 * Die Strafe nach Norm: lange gleichfarbige Läufe, 2×2-Flächen, Stellen,
 * die wie ein Suchmuster aussehen, und ein Ungleichgewicht zwischen hell und
 * dunkel. Die Maske mit der kleinsten Strafe liest sich am sichersten.
 */
function penalty(modules: boolean[][]): number {
  const size = modules.length
  const at = (x: number, y: number, vertical: boolean) => (vertical ? modules[x][y] : modules[y][x])
  let score = 0

  for (const vertical of [false, true]) {
    for (let line = 0; line < size; line++) {
      let run = 1
      for (let index = 1; index <= size; index++) {
        if (index < size && at(index, line, vertical) === at(index - 1, line, vertical)) {
          run++
          continue
        }
        if (run >= 5) score += 3 + (run - 5)
        run = 1
      }
      for (let index = 0; index + 11 <= size; index++) {
        for (const pattern of FINDER_LIKE) {
          if (pattern.every((dark, offset) => at(index + offset, line, vertical) === dark)) {
            score += 40
          }
        }
      }
    }
  }

  for (let y = 0; y + 1 < size; y++) {
    for (let x = 0; x + 1 < size; x++) {
      const color = modules[y][x]
      if (
        modules[y][x + 1] === color &&
        modules[y + 1][x] === color &&
        modules[y + 1][x + 1] === color
      ) {
        score += 3
      }
    }
  }

  const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0)
  const share = (dark * 100) / (size * size)
  score += Math.floor(Math.abs(share - 50) / 5) * 10

  return score
}
