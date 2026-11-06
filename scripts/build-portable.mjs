import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
const release = new URL('../release/', import.meta.url);
const html = await readFile(new URL('index.html', dist), 'utf8');
const script = html.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/);
const sheet = html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
if (!script || !sheet) throw new Error('Production script or stylesheet could not be located.');

const artDir = new URL('art/', dist);
const names = (await readdir(artDir)).filter(name => name.endsWith('.webp'));
const illustrations = Object.fromEntries(await Promise.all(names.map(async name => {
  const contents = await readFile(new URL(name, artDir));
  return [name.slice(0, -5), 'data:image/webp;base64,' + contents.toString('base64')];
})));
const js = await readFile(new URL(script[1], dist), 'utf8');
const css = await readFile(new URL(sheet[1], dist), 'utf8');
const favicon = (await readFile(new URL('mark.svg', dist))).toString('base64');
const portable = html
  .replace(script[0], () => '<script>globalThis.HOLLOW_ART=' + JSON.stringify(illustrations) +
    '</script><script type="module">' + js.replaceAll('</script', '<\\/script') + '</script>')
  .replace(sheet[0], () => '<style>' + css + '</style>')
  .replace(/<link rel="(?:manifest|apple-touch-icon)"[^>]*>/g, '')
  .replace('./mark.svg', 'data:image/svg+xml;base64,' + favicon);
await mkdir(release, {recursive: true});
await writeFile(new URL('Hollow-Oath.html', release), portable);
