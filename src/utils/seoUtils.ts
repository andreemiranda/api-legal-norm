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

  setMeta("description", "name", description);
  setMeta("og:title", "property", title);
  setMeta("og:description", "property", description);
  setMeta("og:url", "property", url);
  setMeta("og:image", "property", imageUrl);
  setMeta("twitter:title", "name", title);
  setMeta("twitter:description", "name", description);
  setMeta("twitter:image", "name", imageUrl);

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
