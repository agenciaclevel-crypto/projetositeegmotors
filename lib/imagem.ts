/**
 * Converte a foto para formato leve no próprio celular, antes de subir.
 *
 * Importante: nem todo navegador sabe GERAR WebP. O Safari do iPhone exibe
 * WebP há anos, mas em várias versões o canvas.toBlob("image/webp") ignora o
 * pedido e devolve PNG silenciosamente — e PNG de foto fica MAIOR que o
 * original. Por isso aqui a gente confere o tipo do que saiu e cai para JPEG
 * quando o WebP não existe. JPEG funciona em qualquer aparelho e fica, na
 * prática, só uns 15% maior que o WebP.
 */

export type FotoPronta = {
  grande: Blob;
  thumb: Blob;
  tipo: string;   // "image/webp" ou "image/jpeg"
  ext: string;    // "webp" ou "jpg"
  largura: number;
  altura: number;
  original: string;
  ganho: number;  // % de redução; nunca negativo
};

export type ErroFoto = { arquivo: string; motivo: string };

const LADO_MAIOR = 1500;
const THUMB = { w: 720, h: 480 };

function desenhar(bmp: ImageBitmap, w: number, h: number, recorte = false) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  if (recorte) {
    const escala = Math.max(w / bmp.width, h / bmp.height);
    const lw = bmp.width * escala, lh = bmp.height * escala;
    ctx.drawImage(bmp, (w - lw) / 2, (h - lh) / 2, lw, lh);
  } else {
    ctx.drawImage(bmp, 0, 0, w, h);
  }
  return cv;
}

const toBlob = (cv: HTMLCanvasElement, tipo: string, q: number) =>
  new Promise<Blob | null>((ok) => cv.toBlob((b) => ok(b), tipo, q));

/** Tenta WebP; se o navegador devolver outra coisa, refaz em JPEG. */
async function comprimir(cv: HTMLCanvasElement, qWebp: number, qJpeg: number) {
  const webp = await toBlob(cv, "image/webp", qWebp);
  if (webp && webp.type === "image/webp") return webp;

  const jpeg = await toBlob(cv, "image/jpeg", qJpeg);
  if (jpeg && jpeg.type === "image/jpeg") return jpeg;

  throw new Error("Este navegador não conseguiu comprimir a imagem.");
}

export async function prepararFoto(arquivo: File): Promise<FotoPronta> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    bmp = await createImageBitmap(arquivo); // navegador antigo
  }

  const escala = Math.min(1, LADO_MAIOR / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * escala);
  const h = Math.round(bmp.height * escala);

  const grande = await comprimir(desenhar(bmp, w, h), 0.80, 0.76);
  const thumb = await comprimir(desenhar(bmp, THUMB.w, THUMB.h, true), 0.76, 0.72);
  bmp.close();

  // Foto que já veio comprimida (WhatsApp, por exemplo) pode sair maior
  // depois de recomprimida. Nesse caso, fica a original — desde que seja um
  // formato que o Storage aceita (migracao-seguranca.sql). HEIC e afins
  // sempre sobem convertidos.
  const formatoAceito = ["image/webp", "image/jpeg", "image/png"].includes(arquivo.type);
  const usarOriginal = formatoAceito && grande.size >= arquivo.size && arquivo.size < 1_200_000;
  const final = usarOriginal ? arquivo : grande;
  const tipo = final.type || "image/jpeg";

  return {
    grande: final, thumb, tipo,
    ext: tipo === "image/webp" ? "webp" : tipo === "image/png" ? "png" : "jpg",
    largura: w, altura: h,
    original: arquivo.name,
    ganho: Math.max(0, Math.round((1 - final.size / arquivo.size) * 100)),
  };
}

export async function prepararFotos(
  arquivos: File[],
  aoAndar?: (feitas: number, total: number) => void
): Promise<{ prontas: FotoPronta[]; erros: ErroFoto[] }> {
  const prontas: FotoPronta[] = [];
  const erros: ErroFoto[] = [];

  for (let i = 0; i < arquivos.length; i++) {
    const f = arquivos[i];
    try {
      prontas.push(await prepararFoto(f));
    } catch (e) {
      erros.push({
        arquivo: f.name,
        motivo: /heic|heif/i.test(f.name)
          ? "formato HEIC do iPhone — em Ajustes → Câmera → Formatos, escolha Mais Compatível"
          : (e as Error).message,
      });
    }
    aoAndar?.(i + 1, arquivos.length);
  }
  return { prontas, erros };
}

export const kb = (b: number) =>
  b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
