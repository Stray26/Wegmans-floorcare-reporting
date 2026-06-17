/**
 * Tiny, dependency-free image header reader. Works in both Node (email render)
 * and the browser (PDF export) because it only touches a Uint8Array. We need
 * the pixel format jsPDF expects ("JPEG"/"PNG") and the intrinsic dimensions so
 * embedded photos keep their aspect ratio. Only JPEG and PNG are recognized —
 * anything else returns null and the caller renders a "photo unavailable" box.
 */
export interface ImageMeta {
  format: "JPEG" | "PNG";
  /** Intrinsic pixel width (0 if it couldn't be parsed but the format is known). */
  width: number;
  height: number;
}

function u32be(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

export function decodeImageMeta(bytes: Uint8Array): ImageMeta | null {
  // PNG: 8-byte signature, then IHDR with width@16 height@20 (big-endian).
  if (
    bytes.length > 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { format: "PNG", width: u32be(bytes, 16), height: u32be(bytes, 20) };
  }

  // JPEG: starts FF D8; scan segment markers for a Start-Of-Frame (SOFn).
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let off = 2;
    while (off + 9 < bytes.length) {
      if (bytes[off] !== 0xff) {
        off++;
        continue;
      }
      const marker = bytes[off + 1];
      // SOF0–SOF15 carry dimensions; exclude DHT(C4)/JPG(C8)/DAC(CC) and
      // markers without a length payload (D0–D9 restart/SOI/EOI).
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        const height = (bytes[off + 5] << 8) | bytes[off + 6];
        const width = (bytes[off + 7] << 8) | bytes[off + 8];
        return { format: "JPEG", width, height };
      }
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        off += 2;
        continue;
      }
      const len = (bytes[off + 2] << 8) | bytes[off + 3];
      if (len <= 0) break;
      off += 2 + len;
    }
    // Format is JPEG even if we couldn't find the SOF; caller uses a default box.
    return { format: "JPEG", width: 0, height: 0 };
  }

  return null;
}
