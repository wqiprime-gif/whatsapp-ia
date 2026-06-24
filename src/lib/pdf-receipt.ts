import { PDFParse } from "pdf-parse";
import { validateReceiptFromImage, validateReceiptFromText, type ReceiptVerdict } from "./receipt-validator.js";

async function renderPdfPageToPngDataUrl(buffer: Buffer): Promise<string | null> {
  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { createCanvas } = await import("@napi-rs/canvas");
    const pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport
    }).promise;
    const png = canvas.toBuffer("image/png");
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch (err) {
    console.warn("[pdf-receipt] render pdfjs:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function renderPdfViaPoppler(buffer: Buffer): Promise<string | null> {
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");
    const exec = promisify(execFile);
    const id = `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tmpPdf = path.join(os.tmpdir(), `${id}.pdf`);
    const outPrefix = path.join(os.tmpdir(), id);
    await fs.writeFile(tmpPdf, buffer);
    await exec("pdftoppm", ["-png", "-f", "1", "-l", "1", "-r", "200", tmpPdf, outPrefix]);
    const pngPath = `${outPrefix}-1.png`;
    const png = await fs.readFile(pngPath);
    await fs.unlink(tmpPdf).catch(() => {});
    await fs.unlink(pngPath).catch(() => {});
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function validateReceiptFromPdf(input: {
  buffer: Buffer;
  pixKey: string;
  recipientName: string;
  expectedAmountCents?: number;
  userId: string;
}): Promise<ReceiptVerdict> {
  let text = "";
  try {
    const parser = new PDFParse({ data: input.buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    text = parsed.text.trim();
  } catch {
    text = "";
  }

  if (text.length >= 20) {
    return validateReceiptFromText({
      text,
      pixKey: input.pixKey,
      recipientName: input.recipientName,
      expectedAmountCents: input.expectedAmountCents,
      userId: input.userId
    });
  }

  let dataUrl = await renderPdfPageToPngDataUrl(input.buffer);
  if (!dataUrl) dataUrl = await renderPdfViaPoppler(input.buffer);
  if (!dataUrl) {
    return {
      paid: false,
      confidence: 0,
      reason: "Nao foi possivel extrair texto ou imagem do PDF."
    };
  }

  return validateReceiptFromImage({
    imageUrl: dataUrl,
    pixKey: input.pixKey,
    recipientName: input.recipientName,
    expectedAmountCents: input.expectedAmountCents,
    userId: input.userId
  });
}
