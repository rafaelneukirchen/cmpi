import { useEffect } from "react";
import { useAppSettings } from "./useAppSettings";

/**
 * Aplica branding dinâmico do app_settings ao runtime:
 * - <title> da aba
 * - Favicon
 * - CSS vars de cor primária (--primary, --ring, --sidebar-ring)
 *
 * Usado uma única vez no nível do App.
 */
export function useApplyBranding() {
  const { data: settings } = useAppSettings();

  // Nome do app -> document.title
  useEffect(() => {
    const name = settings?.app_name?.trim();
    if (name) document.title = name;
  }, [settings?.app_name]);

  // Favicon
  useEffect(() => {
    const href = settings?.app_favicon?.trim();
    if (!href) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [settings?.app_favicon]);

  // Cor primária — espera string HSL no formato "215 70% 28%"
  useEffect(() => {
    const hsl = settings?.primary_color?.trim();
    if (!hsl || !/^\d+\s+\d+%\s+\d+%$/.test(hsl)) return;
    const root = document.documentElement;
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--ring", hsl);
    root.style.setProperty("--sidebar-ring", hsl);
  }, [settings?.primary_color]);
}
