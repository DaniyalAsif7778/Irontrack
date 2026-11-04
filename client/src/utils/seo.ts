export type PageMetadata = {
  title: string;
  robots: string;
  description?: string;
  canonicalPath?: string;
};

export function setPageMetadata({ title, robots, description, canonicalPath }: PageMetadata) {
  document.title = title;
  setMeta("robots", robots);
  if (description) setMeta("description", description);
  else document.querySelector('meta[name="description"]')?.remove();

  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonicalPath) {
    const link = canonical ?? document.createElement("link");
    link.rel = "canonical";
    link.href = new URL(canonicalPath, window.location.origin).href;
    if (!canonical) document.head.append(link);
  } else {
    canonical?.remove();
  }
}

function setMeta(name: string, content: string) {
  const existing = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  const meta = existing ?? document.createElement("meta");
  meta.name = name;
  meta.content = content;
  if (!existing) document.head.append(meta);
}
