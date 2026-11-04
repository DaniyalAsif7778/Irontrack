import { beforeEach, describe, expect, it } from "vitest";
import { setPageMetadata } from "./seo";

describe("app page indexing metadata", () => {
  beforeEach(() => {
    document.head.innerHTML = '<title>Old title</title><meta name="description" content="Private app"><meta name="robots" content="index"><link rel="canonical" href="https://irontrack-nu.vercel.app/">';
  });

  it("marks private pages noindex and removes public canonical metadata", () => {
    setPageMetadata({ title: "Account settings · IronTrack", robots: "noindex,nofollow" });
    expect(document.title).toBe("Account settings · IronTrack");
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex,nofollow");
    expect(document.querySelector('meta[name="description"]')).toBeNull();
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it("writes one self-canonical when a page provides a path", () => {
    setPageMetadata({ title: "Public page · IronTrack", description: "A public description.", robots: "index,follow", canonicalPath: "/public" });
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(`${window.location.origin}/public`);
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("A public description.");
  });
});
