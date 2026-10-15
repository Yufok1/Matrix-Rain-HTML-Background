"""Canvas5 font/coverage adaptation. See assets/Canvas5-NOTICE.md.

Build dependencies: Pillow, fontTools, Brotli. No runtime dependencies or downloads.
Reads Canvas5; never writes to that project. Reuses its embedded font, and checks
the original generator's output and all 256 serialized masks before rasterizing.
"""
import argparse, base64, hashlib, importlib.util, io, json, math, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--canvas5-root', type=Path, required=True, help='Canvas5 source checkout (read only)')
SOURCE = parser.parse_args().canvas5_root.resolve()
TILE, PAD, COLS, ROWS = 96, 2, 16, 18
INNER = TILE - PAD * 2
SHADE_BOUNDS = (-.05, -.85, .65, .25)
RAMP = " .·,:;'-_=+*~^!|/\\()[]{}<>%&#@"

css = (SOURCE/'capture-studio.css').read_text(encoding='utf8')
block = css.split('/* BEGIN CANVAS5 FINE DOTS FONT')[1].split('/* END CANVAS5 FINE DOTS FONT')[0]
font_bytes = base64.b64decode(re.search(r'base64,([^)]*)', block)[1])
font = TTFont(io.BytesIO(font_bytes))
cmap = font.getBestCmap()
assert set(cmap) == set(range(0x2800, 0x2900))
for mask in range(256):
    glyph = font['glyf'][cmap[0x2800+mask]]
    assert glyph.numberOfContours == mask.bit_count()*4
    assert font['hmtx'][cmap[0x2800+mask]][0] == 600
spec = importlib.util.spec_from_file_location('canvas5_fine_dots', SOURCE/'scripts/build_fine_dots.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)
regenerated = generator.build_font()

# PIL's FreeType rasterizer accepts TTF, not WOFF2. Convert only in memory.
font.flavor = None
ttf = io.BytesIO(); font.save(ttf)
fine = ImageFont.truetype(io.BytesIO(ttf.getvalue()), 320)
atlas = Image.new('RGBA', (COLS*TILE, ROWS*TILE))
for mask in range(256):
    high = Image.new('L', (192, 256))
    ImageDraw.Draw(high).text((0,256), chr(0x2800+mask), font=fine, fill=255, anchor='ls')
    alpha = high.resize((INNER, INNER), Image.Resampling.LANCZOS)
    cell = Image.new('RGBA', alpha.size, 'white'); cell.putalpha(alpha)
    atlas.paste(cell, ((mask%COLS)*TILE+PAD, (mask//COLS)*TILE+PAD))

# Reconstruct our existing bundled JetBrains/Noto MSDF outlines into one fixed
# character cell, then rank measured alpha coverage as Canvas5's measureInk does.
metadata = json.loads((ROOT/'assets/rain-font-msdf.json').read_text())
glyphs = {g['unicode']:g for v in metadata['variants'] for g in v['glyphs']}
source = Image.open(ROOT/'assets/rain-font-msdf.png').convert('RGB')
pixels = source.load()
def median(a,b,c): return sorted((a,b,c))[1]
def sample(x,y):
    x=max(0,min(source.width-1,x)); y=max(0,min(source.height-1,y))
    x0,y0=int(x),int(y); fx,fy=x-x0,y-y0
    vals=[0.,0.,0.]
    for dx in (0,1):
        for dy in (0,1):
            weight=(fx if dx else 1-fx)*(fy if dy else 1-fy)
            rgb=pixels[min(x0+dx,source.width-1),min(y0+dy,source.height-1)]
            for c in range(3): vals[c]+=weight*rgb[c]/255
    return median(*vals)
def shade(char):
    alpha=Image.new('L',(INNER,INNER)); g=glyphs[ord(char)]
    if 'planeBounds' not in g: return alpha
    p,a=g['planeBounds'],g['atlasBounds']; data=[]
    left,top,right,bottom=SHADE_BOUNDS
    scale=metadata['atlas']['distanceRange']*.5*(INNER/(right-left)+INNER/(bottom-top))/metadata['atlas']['size']
    for y in range(INNER):
        py=-(top+(y+.5)/INNER*(bottom-top))
        for x in range(INNER):
            px=left+(x+.5)/INNER*(right-left)
            if px<p['left'] or px>p['right'] or py<p['bottom'] or py>p['top']:
                data.append(0); continue
            ax=a['left']+(px-p['left'])/(p['right']-p['left'])*(a['right']-a['left'])
            ay=a['bottom']+(py-p['bottom'])/(p['top']-p['bottom'])*(a['top']-a['bottom'])
            distance=sample(ax-.5,source.height-ay-.5)
            data.append(round(max(0,min(1,(distance-.5)*scale+.5))*255))
    alpha.putdata(data); return alpha

shades=[]
for char in RAMP:
    alpha=shade(char)
    ink=sum(alpha.getdata())/(INNER*INNER*255)
    shades.append((ink,char,alpha))
shades.sort(key=lambda item:item[0])
for rank,(ink,char,alpha) in enumerate(shades):
    index=256+rank; cell=Image.new('RGBA',alpha.size,'white');cell.putalpha(alpha)
    atlas.paste(cell,((index%COLS)*TILE+PAD,(index//COLS)*TILE+PAD))
assert len(shades)<=32 and shades[0][0]==0 and shades[-1][0]>.15
output=ROOT/'assets/media-characters.png';atlas.save(output,optimize=True)
(ROOT/'assets/canvas5-fine-dots.woff2').write_bytes(font_bytes)
(ROOT/'assets/Canvas5-PolyForm-Noncommercial.txt').write_bytes((SOURCE/'LICENSE').read_bytes())
record={'tile':TILE,'pad':PAD,'cols':COLS,'rows':ROWS,'shadeOffset':256,
        'shadeBounds':SHADE_BOUNDS,'brailleBounds':[0,-.8,.6,0],
        'shades':[{'char':char,'ink':ink} for ink,char,_ in shades],
        'fontSha256':hashlib.sha256(font_bytes).hexdigest(),
        'regeneratedFontMatchesEmbedded':regenerated==font_bytes,
        'generatorSha256':hashlib.sha256((SOURCE/'scripts/build_fine_dots.py').read_bytes()).hexdigest(),
        'atlasSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
        'verifiedMasks':256,'sourceBitsPerBrailleCell':8,'circlesPerBit':4}
(ROOT/'assets/media-characters.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf8')
(ROOT/'assets/media-characters.js').write_text('window.RainMediaGlyphAtlas='+json.dumps(record,separators=(',',':'))+';\n',encoding='utf8')
print(json.dumps(record,ensure_ascii=True))
