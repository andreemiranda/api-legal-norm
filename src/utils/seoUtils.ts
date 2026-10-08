export function updateClientSEO(
  title: string,
  description: string,
  url: string,
  imageUrl: string,
  jsonLd: any
) {
  document.title = title;

  const setMeta = (nameOrProperty: string, attribute: string, content: string) => {
    let el = document.querySelector(`meta[${attribute}="${nameOrProperty}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attribute, nameOrProperty);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };

  // Open Graph and Twitter Cards require direct absolute image URLs as an exception
  let directImageUrl = imageUrl;
  try {
    if (directImageUrl && directImageUrl.includes("/_next/image?url=")) {
      const parsed = new URL(directImageUrl, "http://localhost");
      directImageUrl = parsed.searchParams.get("url") || directImageUrl;
    }
  } catch {}

  setMeta("description", "name", description);
  setMeta("og:title", "property", title);
  setMeta("og:description", "property", description);
  setMeta("og:url", "property", url);
  setMeta("og:image", "property", directImageUrl);
  setMeta("twitter:title", "name", title);
  setMeta("twitter:description", "name", description);
  setMeta("twitter:image", "name", directImageUrl);

  // Set canonical URL
  let canonicalEl = document.querySelector('link[rel="canonical"]');
  if (!canonicalEl) {
    canonicalEl = document.createElement("link");
    canonicalEl.setAttribute("rel", "canonical");
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute("href", url);

  let scriptEl = document.querySelector('script[type="application/ld+json"]#client-json-ld');
  if (!scriptEl) {
    scriptEl = document.createElement("script");
    scriptEl.setAttribute("type", "application/ld+json");
    scriptEl.setAttribute("id", "client-json-ld");
    document.head.appendChild(scriptEl);
  }
  scriptEl.textContent = JSON.stringify(jsonLd);
}
