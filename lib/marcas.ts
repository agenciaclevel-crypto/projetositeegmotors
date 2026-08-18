/**
 * Logos de marca pro grid de busca da vitrine.
 *
 * A marca do veículo é texto livre (o gestor digita no painel), então aqui
 * a gente tenta casar com uma logo conhecida; quando não acha (marca rara,
 * digitação diferente), o componente cai pra um "selo" com as iniciais —
 * nunca quebra e nunca mostra ícone faltando.
 */

import {
  siAudi, siBmw, siChevrolet, siFiat, siFord, siHonda, siHyundai, siJeep,
  siMitsubishi, siNissan, siPeugeot, siRam, siRenault, siSuzuki, siToyota,
  siVolkswagen, siKia, siCitroen, siVolvo, siMazda, siMini, siPorsche,
  siSubaru, siOpel, siSkoda, siSeat, siAcura, siInfiniti, siTesla,
} from "simple-icons";

type Logo = { path: string; hex: string; titulo: string };

const ICONES: Record<string, Logo> = {
  audi: { path: siAudi.path, hex: siAudi.hex, titulo: "Audi" },
  bmw: { path: siBmw.path, hex: siBmw.hex, titulo: "BMW" },
  chevrolet: { path: siChevrolet.path, hex: siChevrolet.hex, titulo: "Chevrolet" },
  fiat: { path: siFiat.path, hex: siFiat.hex, titulo: "Fiat" },
  ford: { path: siFord.path, hex: siFord.hex, titulo: "Ford" },
  honda: { path: siHonda.path, hex: siHonda.hex, titulo: "Honda" },
  hyundai: { path: siHyundai.path, hex: siHyundai.hex, titulo: "Hyundai" },
  jeep: { path: siJeep.path, hex: siJeep.hex, titulo: "Jeep" },
  mitsubishi: { path: siMitsubishi.path, hex: siMitsubishi.hex, titulo: "Mitsubishi" },
  nissan: { path: siNissan.path, hex: siNissan.hex, titulo: "Nissan" },
  peugeot: { path: siPeugeot.path, hex: siPeugeot.hex, titulo: "Peugeot" },
  ram: { path: siRam.path, hex: siRam.hex, titulo: "RAM" },
  renault: { path: siRenault.path, hex: siRenault.hex, titulo: "Renault" },
  suzuki: { path: siSuzuki.path, hex: siSuzuki.hex, titulo: "Suzuki" },
  toyota: { path: siToyota.path, hex: siToyota.hex, titulo: "Toyota" },
  volkswagen: { path: siVolkswagen.path, hex: siVolkswagen.hex, titulo: "Volkswagen" },
  vw: { path: siVolkswagen.path, hex: siVolkswagen.hex, titulo: "Volkswagen" },
  kia: { path: siKia.path, hex: siKia.hex, titulo: "Kia" },
  citroen: { path: siCitroen.path, hex: siCitroen.hex, titulo: "Citroën" },
  volvo: { path: siVolvo.path, hex: siVolvo.hex, titulo: "Volvo" },
  mazda: { path: siMazda.path, hex: siMazda.hex, titulo: "Mazda" },
  mini: { path: siMini.path, hex: siMini.hex, titulo: "Mini" },
  porsche: { path: siPorsche.path, hex: siPorsche.hex, titulo: "Porsche" },
  subaru: { path: siSubaru.path, hex: siSubaru.hex, titulo: "Subaru" },
  opel: { path: siOpel.path, hex: siOpel.hex, titulo: "Opel" },
  skoda: { path: siSkoda.path, hex: siSkoda.hex, titulo: "Skoda" },
  seat: { path: siSeat.path, hex: siSeat.hex, titulo: "Seat" },
  acura: { path: siAcura.path, hex: siAcura.hex, titulo: "Acura" },
  infiniti: { path: siInfiniti.path, hex: siInfiniti.hex, titulo: "Infiniti" },
  tesla: { path: siTesla.path, hex: siTesla.hex, titulo: "Tesla" },
};

const normaliza = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function logoDaMarca(marca: string): Logo | null {
  return ICONES[normaliza(marca)] ?? null;
}
