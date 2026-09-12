// Utility for dynamic domain adaptation across any deployment platform or server
// Provides consistent hostname, URLs, and dynamic email generation for the frontend and backend

export function getSiteUrl(): string {
  // Check client and build-time environment variables first
  const metaEnv = typeof import.meta !== "undefined" ? (import.meta as any).env : {};
  const procEnv = typeof process !== "undefined" ? process.env : {};

  const configuredUrl =
    metaEnv?.VITE_SITE_URL ||
    metaEnv?.NEXT_PUBLIC_DOMAIN ||
    metaEnv?.VITE_APP_URL ||
    procEnv?.VITE_SITE_URL ||
    procEnv?.NEXT_PUBLIC_DOMAIN ||
    procEnv?.VITE_APP_URL ||
    procEnv?.APP_URL;

  if (configuredUrl && typeof configuredUrl === "string" && configuredUrl.startsWith("http")) {
    return configuredUrl.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
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
  // If running in local development or temporary preview container without custom domain set, use configured domain
  const isPreviewOrLocal =
    domain.includes("localhost") ||
    domain.includes("127.0.0.1") ||
    domain.includes("run.app") ||
    domain.includes("netlify.app");

  const metaEnv = typeof import.meta !== "undefined" ? (import.meta as any).env : {};
  const fallbackEnvDomain = metaEnv?.VITE_SITE_URL || metaEnv?.NEXT_PUBLIC_DOMAIN;
  let parsedFallback = "normajuridica.com.br";
  if (fallbackEnvDomain) {
    try {
      parsedFallback = new URL(fallbackEnvDomain).hostname;
    } catch {
      parsedFallback = fallbackEnvDomain.replace(/^https?:\/\//, "").split("/")[0];
    }
  }

  const emailDomain = isPreviewOrLocal ? parsedFallback : domain;

  return {
    domain: emailDomain,
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
export const SITE_EMAILS = getSiteEmails();
