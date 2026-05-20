import type { ComponentType } from "react";
import { Boxes } from "lucide-react";
import {
  SiDjango,
  SiDocker,
  SiNextdotjs,
  SiNodedotjs,
  SiPython,
  SiRust,
  SiStrapi,
  SiVite,
} from "react-icons/si";

interface BrandIcon {
  Icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
}

const FALLBACK: BrandIcon = { Icon: Boxes, color: "#a1a1aa" };

export function getBrandIcon(label: string): BrandIcon {
  const l = label.toLowerCase();
  if (l.includes("next")) return { Icon: SiNextdotjs, color: "#ffffff" };
  if (l.includes("vite")) return { Icon: SiVite, color: "#bd34fe" };
  if (l.includes("strapi")) return { Icon: SiStrapi, color: "#8e75ff" };
  if (l.includes("docker")) return { Icon: SiDocker, color: "#2496ed" };
  if (l.includes("django")) return { Icon: SiDjango, color: "#44b78b" };
  if (l.includes("python")) return { Icon: SiPython, color: "#ffd43b" };
  if (l.includes("rust") || l.includes("cargo"))
    return { Icon: SiRust, color: "#dea584" };
  if (l.includes("node") || l.includes("npm"))
    return { Icon: SiNodedotjs, color: "#8bc34a" };
  return FALLBACK;
}
