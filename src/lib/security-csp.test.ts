import fs from 'fs';
import path from 'path';

function scriptSources(html: string): string {
  return html.match(/script-src ([^;]+)/)?.[1] ?? '';
}

describe('production CSP', () => {
  it.each(['index.html'])('does not allow arbitrary inline/eval scripts in %s', (name) => {
    const html = fs.readFileSync(path.join(process.cwd(), name), 'utf8');
    const sources = scriptSources(html);

    expect(sources).not.toContain("'unsafe-inline'");
    expect(sources).not.toContain("'unsafe-eval'");
  });

  it('does not load remote font stylesheets in the application shell', () => {
    const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

    expect(html).not.toContain('fonts.googleapis');
    expect(html).not.toContain('fonts.gstatic');
    expect(html).not.toMatch(/\sonload=/i);
  });
});
