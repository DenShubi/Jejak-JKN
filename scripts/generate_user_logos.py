import base64
import os
from PIL import Image

brand_dir = 'public/brand'
os.makedirs(brand_dir, exist_ok=True)

# 1. Full logo
with open('public/brand/jejak-jkn-logo.png', 'rb') as f:
    logo_b64 = base64.b64encode(f.read()).decode('utf-8')

im_logo = Image.open('public/brand/jejak-jkn-logo.png')
w_logo, h_logo = im_logo.size

svg_logo = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w_logo} {h_logo}" width="100%" height="100%">
  <image href="data:image/png;base64,{logo_b64}" width="{w_logo}" height="{h_logo}" />
</svg>'''

with open('public/brand/jejak-jkn-logo.svg', 'w', encoding='utf-8') as f:
    f.write(svg_logo)

# 2. Standalone mark
with open('public/brand/jejak-jkn-mark.png', 'rb') as f:
    mark_b64 = base64.b64encode(f.read()).decode('utf-8')

im_mark = Image.open('public/brand/jejak-jkn-mark.png')
w_mark, h_mark = im_mark.size

svg_mark = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w_mark} {h_mark}" width="100%" height="100%">
  <image href="data:image/png;base64,{mark_b64}" width="{w_mark}" height="{h_mark}" />
</svg>'''

with open('public/brand/jejak-jkn-mark.svg', 'w', encoding='utf-8') as f:
    f.write(svg_mark)

# 3. Favicon SVG
svg_fav = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <image href="data:image/png;base64,{mark_b64}" x="1" y="1" width="30" height="30" preserveAspectRatio="xMidYMid meet" />
</svg>'''

with open('public/brand/jejak-jkn-favicon.svg', 'w', encoding='utf-8') as f:
    f.write(svg_fav)

# 4. Dark mode horizontal lockup SVG
with open('public/brand/jejak-jkn-logo-dark.png', 'rb') as f:
    dark_b64 = base64.b64encode(f.read()).decode('utf-8')

im_dark = Image.open('public/brand/jejak-jkn-logo-dark.png')
w_dark, h_dark = im_dark.size

svg_dark = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w_dark} {h_dark}" width="100%" height="100%">
  <image href="data:image/png;base64,{dark_b64}" width="{w_dark}" height="{h_dark}" />
</svg>'''

with open('public/brand/jejak-jkn-logo-horizontal-dark.svg', 'w', encoding='utf-8') as f:
    f.write(svg_dark)

# 5. Light mode horizontal lockup SVG
with open('public/brand/jejak-jkn-logo-horizontal-light.svg', 'w', encoding='utf-8') as f:
    f.write(svg_logo)

print("Successfully generated SVG assets from user's custom logo!")
