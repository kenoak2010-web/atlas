import { describe, expect, it } from "vitest";
import { htmlToText, safeUrl, tokenize, decodeEntities } from "@/lib/text";

describe("text utils", () => {
  it("strips html and scripts", () => {
    expect(htmlToText('<p>Hello <b>world</b><script>alert(1)</script></p><img src=x onerror="x">')).toBe("Hello world");
  });
  it("decodes entities", () => {
    expect(decodeEntities("Fish &amp; Chips &#8211; &#x27;ok&#x27; &uuml;")).toBe("Fish & Chips – 'ok' ü");
  });
  it("truncates on word boundary", () => {
    const t = htmlToText("word ".repeat(200), 50);
    expect(t.length).toBeLessThanOrEqual(50);
    expect(t.endsWith("…")).toBe(true);
  });
  it("only allows http(s) urls", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("data:text/html,x")).toBeUndefined();
    expect(safeUrl("https://example.org/a")).toBe("https://example.org/a");
    expect(safeUrl(42)).toBeUndefined();
  });
  it("tokenizes without stopwords", () => {
    expect(tokenize("The earthquake hits Japan")).toEqual(["earthq", "hits", "japan"]);
  });
});
