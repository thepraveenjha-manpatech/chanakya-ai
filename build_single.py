#!/usr/bin/env python3
"""Build ONE standalone HTML file (double-click / Netlify Drop). It uses the on-device editor,
or the AI editor of a hosted site if you pass its address:  python3 build_single.py https://your-site.netlify.app"""
import base64, mimetypes, pathlib, re, sys, json
R = pathlib.Path(__file__).parent
api = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else ""
b64 = lambda p: "data:%s;base64,%s" % (mimetypes.guess_type(p)[0] or "application/octet-stream", base64.b64encode((R / p).read_bytes()).decode())
html = (R / "index.html").read_text()
html = re.sub(r'url\((fonts/[^)]+)\)', lambda m: 'url(%s)' % b64(m.group(1)), html)
html = re.sub(r'<link rel="(manifest|icon|apple-touch-icon)"[^>]*>', '', html)
html = html.replace('src="assets/logo.png"', 'src="%s"' % b64("assets/logo.png"))
emb = {p: b64(p) for p in ["assets/logo.png", "assets/avatar.jpg"] + ["voice/%s.mp3" % n for n in ("hook_en", "hook_hi", "cta_en", "cta_hi")]}
js = "window.API_BASE=%s;window.EMBED=%s;\n%s" % (json.dumps(api), json.dumps(emb), (R / "app.js").read_text())
html = html.replace('<script src="app.js"></script>', "<script>%s</script>" % js.replace("</script>", "<\\/script>"))
out = R / "dist" / ("Chanakya_AI_Director.html"); out.parent.mkdir(exist_ok=True); out.write_text(html)
print(out, round(out.stat().st_size / 1e6, 2), "MB")
