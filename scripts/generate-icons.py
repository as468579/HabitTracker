"""Render the existing slowday feather mark as app icons; no external assets."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / 'assets'
S = 4
def mark(size, color, background, scale=1):
    im = Image.new('RGBA', (size*S, size*S), background)
    d = ImageDraw.Draw(im)
    def pt(p):
        return ((.5+(p[0]-.5)*scale)*size*S, (.5+(p[1]-.5)*scale)*size*S)
    # Rounded outline based on the in-app feather identity.
    points = []
    segments = [((.30,.67),(.29,.40),(.57,.17),(.72,.29)), ((.72,.29),(.88,.45),(.61,.69),(.34,.68))]
    for a,b,c,e in segments:
        for i in range(81):
            t=i/80; u=1-t
            points.append(pt((u**3*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t**3*e[0],u**3*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t**3*e[1])))
    d.line(points, fill=color, width=int(size*S*.034), joint='curve')
    for a,b in [((.25,.77),(.64,.38)),((.37,.65),(.55,.65)),((.46,.56),(.46,.42))]:
        d.line([pt(a),pt(b)],fill=color,width=int(size*S*.034))
    return im.resize((size,size),Image.Resampling.LANCZOS)

mark(1024,'#FFFFFF','#377A57',1.1).convert('RGB').save(OUT/'icon.png')
mark(1024,'#377A57',(0,0,0,0),.85).save(OUT/'android-icon-foreground.png')
mark(1024,'#FFFFFF',(0,0,0,0),.85).save(OUT/'android-icon-monochrome.png')
mark(64,'#FFFFFF','#377A57',1.1).save(OUT/'favicon.png')
print('Generated slowday icons.')
web_icons = OUT.parent / 'public' / 'icons'
web_icons.mkdir(parents=True, exist_ok=True)
for size in [192, 512]:
    mark(size, '#FFFFFF', '#377A57', 1.0).convert('RGB').save(web_icons / f'icon-{size}.png')
mark(512, '#FFFFFF', '#377A57', .75).convert('RGB').save(web_icons / 'maskable-512.png')
mark(180, '#FFFFFF', '#377A57', 1.0).convert('RGB').save(web_icons / 'apple-touch-icon.png')
print('Generated PWA icons.')
