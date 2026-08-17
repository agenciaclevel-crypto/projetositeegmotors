/**
 * Converte a foto para WebP no próprio celular, antes de subir.
 *
 * Por que no navegador e não no servidor: a foto do iPhone tem 3 a 5 MB.
 * Convertendo antes, sobem ~200 KB. Numa sessão de 10 carros com 8 fotos
 * cada, é a diferença entre 300 MB e 16 MB de upload — e no 4G do pátio
 * isso é o que faz o cadastro terminar ou travar no meio.
 */

export type FotoPronta = {
  grande: Blob;   // lado maior 1600px — galeria
  thumb: Blob;    // 720x480 recortado — card da vitrine
  largura: number;
  altura: number;
  original: string;
  ganho: number;  // quanto encolheu, em %
};

const LADO_MAIOR = 1600;
const THUMB = { w: 720, h: 480 };

function desenhar(bmp: ImageBitmap, w: number, h: number, recorte = false) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";

  if (recorte) {
    // cover: preenche o quadro sem distorcer, cortando o excesso
    const escala = Math.max(w / bmp.width, h / bmp.height);
    const lw = bmp.width * escala, lh = bmp.height * escala;
    ctx.drawImage(bmp, (w - lw) / 2, (h - lh) / 2, lw, lh);
  } else {
    ctx.drawImage(bmp, 0, 0, w, h);
  }
  return cv;
}

const paraBlob = (cv: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((ok, falha) =>
    cv.toBlob((b) => (b ? ok(b) : falha(new Error("Falha ao converter"))), "image/webp", q));

export function suportaWebp() {
  const cv = document.createElement("canvas");
  return cv.toDataURL("image/webp").startsWith("data:image/webp");
}

export async function prepararFoto(arquivo: File): Promise<FotoPronta> {
  // imageOrientation resolve a foto deitada do celular (EXIF)
  const bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" });

  const escala = Math.min(1, LADO_MAIOR / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * escala);
  const h = Math.round(bmp.height * escala);

  const grande = await paraBlob(desenhar(bmp, w, h), 0.82);
  const thumb = await paraBlob(desenhar(bmp, THUMB.w, THUMB.h, true), 0.78);
  bmp.close();

  return {
    grande, thumb, largura: w, altura: h,
    original: arquivo.name,
    ganho: Math.round((1 - grande.size / arquivo.size) * 100),
  };
}

/** Processa várias fotos em sequência, avisando o progresso. */
export async function prepararFotos(
  arquivos: File[],
  aoAndar?: (feitas: number, total: number) => void
) {
  const prontas: FotoPronta[] = [];
  for (let i = 0; i < arquivos.length; i++) {
    try {
      prontas.push(await prepararFoto(arquivos[i]));
    } catch {
      // HEIC que o navegador não decodifica cai aqui: sobe o original
      const f = arquivos[i];
      prontas.push({
        grande: f, thumb: f, largura: 0, altura: 0, original: f.name, ganho: 0,
      });
    }
    aoAndar?.(i + 1, arquivos.length);
  }
  return prontas;
}

export const kb = (b: number) =>
  b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
