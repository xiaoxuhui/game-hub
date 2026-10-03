from pathlib import Path
import xml.etree.ElementTree as ET
import sys

if len(sys.argv) != 2:
    raise SystemExit('Usage: python render-preview.py <independent-checkout-root>')
root = Path(sys.argv[1]).resolve()
ns = '{http://schemas.android.com/apk/res/android}'

def paths(resource):
    result = []
    for item in ET.parse(root / resource).getroot():
        a = item.attrib
        color = a.get(ns + 'fillColor', '#00000000')
        fill = 'none' if color == '#00000000' else color
        attrs = {'d': a[ns + 'pathData'], 'fill': fill}
        for android_name, svg_name in [('strokeColor', 'stroke'), ('strokeWidth', 'stroke-width'), ('strokeLineCap', 'stroke-linecap'), ('strokeLineJoin', 'stroke-linejoin'), ('fillType', 'fill-rule')]:
            if ns + android_name in a:
                value = a[ns + android_name]
                attrs[svg_name] = 'evenodd' if value == 'evenOdd' else value
        result.append('<path ' + ' '.join(f'{key}="{value}"' for key, value in attrs.items()) + '/>')
    return ''.join(result)

legacy = paths('android/app/src/main/res/mipmap-anydpi/ic_launcher.xml')
mono = paths('android/app/src/main/res/drawable/ic_launcher_monochrome.xml')
svg = lambda contents: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">' + contents + '</svg>'
mono_svg = svg('<rect width="108" height="108" fill="#E0EBE4"/><g style="color:#184C3A">' + mono.replace('#FFFFFF', '#184C3A') + '</g>')
cards = [('普通 / 矢量', svg(legacy), ''), ('自适应 / 圆形', svg(legacy), 'circle'), ('单色主题 / 镂空', mono_svg, 'circle')]
html = '''<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;padding:32px;background:#F1F4F8;font-family:Arial,"Microsoft YaHei",sans-serif;color:#172335}h1{margin:0;font-size:26px}p{margin:10px 0 22px;color:#5D6A7D;font-size:14px}.row{display:flex;gap:24px}.card{width:320px;background:white;border-radius:18px;padding:22px;text-align:center}.icon{width:220px;height:220px;margin:0 auto 20px;border-radius:45px;overflow:hidden}.circle{border-radius:50%}svg{display:block;width:100%;height:100%}.label{font-weight:bold;font-size:18px}.small{display:flex;justify-content:center;align-items:center;gap:16px;margin:18px 0 0}.tiny{width:48px;height:48px;border-radius:11px;overflow:hidden}.tiny.circle{border-radius:50%}.note{margin-top:22px;font-size:13px;color:#657187}
</style><h1>游戏大厅 · 新图标</h1><p>游戏入口与手柄；预览直接渲染 Android 矢量路径。大图与实际 48px 小图。</p><div class="row">'''
for label, image, cls in cards:
    html += f'<div class="card"><div class="icon {cls}">{image}</div><div class="label">{label}</div><div class="small"><div class="tiny {cls}">{image}</div><span>48 px</span></div></div>'
html += '</div><div class="note">形状与主题为视觉模拟；真实 Android 启动器验证单独记录。</div>'
(root / '.build/icon-preview.html').write_text(html, encoding='utf8')
(root / '.build/icon-actual-vector.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 108 108">' + legacy + '</svg>', encoding='utf8')
