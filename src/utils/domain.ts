// Utility for dynamic domain adaptation across any deployment platform or server
// Provides consistent hostname, URLs, and dynamic email generation for the frontend and backend

export function getSiteUrl(): string {
  if (typeof window !== "undefined") {
    // Check client environment variables first
    const envUrl = (import.meta as any).env?.VITE_SITE_URL || (import.meta as any).env?.VITE_APP_URL;
    if (envUrl && typeof envUrl === "string" && envUrl.startsWith("http")) {
      return envUrl.replace(/\/+$/, "");
    }
    return window.location.origin;
  }
  return "https://normajuridica.com.br";
}

export function getSiteDomain(): string {
  const url = getSiteUrl();
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  }
}

export function getSiteEmails() {
  const domain = getSiteDomain();
  // If running in local development or temporary preview container, maintain the portal branding domain
  const isPreviewOrLocal =
    domain.includes("localhost") ||
    domain.includes("127.0.0.1") ||
    domain.includes("run.app") ||
    domain.includes("netlify.app");

  const emailDomain = isPreviewOrLocal ? "normajuridica.com.br" : domain;

  return {
    contact: `contato@${emailDomain}`,
    editorial: `redacao@${emailDomain}`,
    dpo: `dpo@${emailDomain}`,
    privacy: `privacidade@${emailDomain}`,
    ouvidoria: `ouvidoria@${emailDomain}`,
    commercial: `comercial@${emailDomain}`,
  };
}

export const SITE_DOMAIN = getSiteDomain();
export const SITE_URL = getSiteUrl();
