"""Pack the built game (dist/) into ONE self-contained index.html (fonts, images, code inlined).
Usage: python3 scripts/singlefile.py dist out/index.html"""
import base64, re, sys, os, mimetypes
src, out = sys.argv[1], sys.argv[2]
html = open(os.path.join(src, 'index.html'), encoding='utf-8').read()
def data_uri(path):
    mt = {'.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml'}.get(os.path.splitext(path)[1], mimetypes.guess_type(path)[0] or 'application/octet-stream')
    return 'data:%s;base64,%s' % (mt, base64.b64encode(open(path, 'rb').read()).decode())
# CSS: inline, keep only woff2 fonts
def inline_css(m):
    href = m.group(1); css = open(os.path.join(src, href.lstrip('./')), encoding='utf-8').read()
    css = re.sub(r',\s*url\(([^)]+?\.woff)\)\s*format\(["\']woff["\']\)', '', css)
    css = re.sub(r'url\(([^)]+?\.woff2)\)', lambda u: 'url(%s)' % data_uri(os.path.join(src, 'assets', os.path.basename(u.group(1).strip('"\'')))), css)
    return '<style>%s</style>' % css
html = re.sub(r'<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>', inline_css, html)
# brand images used by the page and the code
brand = {f: data_uri(os.path.join(src, 'brand', f)) for f in os.listdir(os.path.join(src, 'brand'))}
def inline_js(m):
    js = open(os.path.join(src, m.group(1).lstrip('./')), encoding='utf-8').read()
    for f, d in brand.items(): js = js.replace('brand/' + f, d)
    return '<script type="module">%s</script>' % js.replace('</script', '<\\/script')
html = re.sub(r'<script type="module"[^>]*src="([^"]+)"[^>]*></script>', inline_js, html)
for f, d in brand.items(): html = html.replace('brand/' + f, d)
html = re.sub(r'\s*<link rel="manifest"[^>]*>', '', html)
os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
open(out, 'w', encoding='utf-8').write(html)
print('wrote', out, round(len(html) / 1e6, 2), 'MB')
