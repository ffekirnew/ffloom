import { Marked } from "marked";

// Descriptions and comments come from agents too, so raw HTML is shown as text
// and only http(s)/mailto links become links.
const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const md = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }) {
      return escape(text);
    },
    link({ href, tokens }) {
      const label = this.parser.parseInline(tokens);
      if (!/^(https?:|mailto:)/i.test(href)) return label;
      return `<a href="${escape(href)}" target="_blank" rel="noreferrer noopener">${label}</a>`;
    },
    image({ text }) {
      return escape(text);
    },
  },
});

export function renderMarkdown(src: string): string {
  return md.parse(src, { async: false }) as string;
}
