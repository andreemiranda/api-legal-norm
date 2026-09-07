// Date and text helpers in Brazilian Portuguese

export function formatDatePtBR(dateString?: string): string {
  if (!dateString) return "Recente";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Recente";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo"
    }).format(d);
  } catch {
    return "Recente";
  }
}

export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return "Hoje";
  try {
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Agora há pouco";
    if (diffHours === 1) return "Há 1 hora";
    if (diffHours < 24) return `Há ${diffHours} horas`;
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `Há ${diffDays} dias`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "Hoje";
  }
}

export function calculateReadingTime(text?: string): number {
  if (!text) return 3;
  const words = text.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  return Math.max(2, minutes);
}

export function stripHtml(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8217;/g, "’")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
