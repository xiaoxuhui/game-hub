"""Generate interim letter tiles for games without existing dedicated artwork.

The PNGs are committed and signed into resource packages. Dedicated upstream
art may replace a tile in a later resource release; this script is not run at
package build time.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
lock = json.loads((root / 'dynamic-sources.lock.json').read_text(encoding='utf-8'))
target = root / 'assets' / 'game-icons'
target.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 72)
bundled = root / 'android/app/src/main/res/drawable-nodpi'
names = {'memory-demo':'memory_demo','abelian-sandpile':'abelian_sandpile',
         'lambda-diagram-game':'lambda_diagram_game','red-green-puzzle':'red_green_puzzle',
         'mini-scratch':'mini_scratch','logic-circuit':'logic_circuit','traffic-planner':'traffic_planner'}
labels = {'hex-cell-lab':'HEX','langtons-ant':'ANT','turbowarp-neural-network':'NN',
          'turbowarp-logic-lab':'TL','lights-out-matrix':'OUT','learning-machine':'ML',
          'compass-polygon-studio':'POL','fourier-drawing-studio':'FFT','ai-racing-lab':'AI',
          'turbowarp-life-lab':'LIFE','turbowarp-turing-lab':'TM','snake-speed':'SNA',
          'turbowarp-graph-lab':'GR','fixed-point-workshop':'FIX','sokoban-ai-lab':'BOX',
          'tape-language-lab':'TAPE','pixel-frame':'PIX','territory-conquest':'WAR','cube-step-solver':'CUBE'}
for game in lock['sources']:
    game_id = game['id']; out = target / (game_id + '.png')
    if game_id in names:
        out.write_bytes((bundled / ('game_icon_' + names[game_id] + '.png')).read_bytes())
        continue
    label = labels[game_id]; digest = hashlib.sha256(game_id.encode()).digest()
    bg = tuple(38 + v % 90 for v in digest[:3]); accent = tuple(125 + v % 120 for v in digest[3:6])
    image = Image.new('RGB', (256,256), bg); draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((12,12,244,244), radius=47, outline=accent, width=8)
    size = 64 if len(label)<=3 else 51
    face = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',size)
    draw.text((128,128),label,font=face,anchor='mm',fill=(255,255,255))
    image.save(out,format='PNG',optimize=True)
