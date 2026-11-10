#!/usr/bin/env python3
"""把站酷小薇（ZCOOL XiaoWei）裁成只含本站用到的字，输出 fonts/ZCOOLXiaoWei-subset.woff2。

页面上所有用展示字体的文字都写在源码里（卦名、卦辞、爻辞、界面文字），
所以把 index.html、style.css、data.js、js/*.js 里出现过的字都收进去就够了
（注释和「卦象」那段白话除外：前者不显示，后者用的是正文字体）。
改了文案、出现新字之后要重新跑一遍，否则新字会退回系统宋体；回归测试会检查这一点。

用法：
    pip install fonttools brotli
    python tools/subset-font.py /path/to/ZCOOLXiaoWei-Regular.ttf

原字体在 https://github.com/google/fonts/tree/main/ofl/zcoolxiaowei ，SIL OFL 1.1 授权。
"""
import glob, os, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'fonts', 'ZCOOLXiaoWei-subset.woff2')
CHARS = os.path.join(ROOT, 'fonts', 'ZCOOLXiaoWei-subset.chars.txt')
SOURCES = ['index.html', 'style.css', 'data.js'] + sorted(
    os.path.relpath(p, ROOT) for p in glob.glob(os.path.join(ROOT, 'js', '*.js')))


def strip_comments(rel, text):
    """注释不会显示在页面上，不用为它们带字。"""
    if rel.endswith('.html'):
        return re.sub(r'<!--.*?-->', '', text, flags=re.S)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    if rel.endswith('.js'):
        text = re.sub(r'(^|\s)//.*$', '', text, flags=re.M)   # 行注释；网址里的 :// 前面不是空白，不会误删
    return text


def wanted_chars():
    chars = set(chr(c) for c in range(0x20, 0x7f))          # ASCII
    chars.update('，。、；：？！“”‘’「」『』《》（）〈〉【】—…　')
    for rel in SOURCES:
        with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
            text = strip_comments(rel, f.read())
        if rel == 'data.js':
            # 每一卦的第五项是「卦象」那段白话，页面上用正文字体，不用展示字体
            text = re.sub(r"(\['[^']*', '[^']*', '[^']*', '[^']*', )'[^']*'\]", r"\1'']", text)
        chars.update(ch for ch in text if ord(ch) > 0x7f and not ch.isspace())
    return chars


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    cmap = TTFont(src, lazy=True).getBestCmap()
    want = wanted_chars()
    have = sorted(ch for ch in want if ord(ch) in cmap)
    missing = sorted(ch for ch in want if ord(ch) not in cmap)

    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]   # 保留版权和授权信息
    opts.notdef_outline = True
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=[ord(ch) for ch in have])
    sub.subset(font)
    subset.save_font(font, OUT, opts)

    # 第一行：裁进去的非 ASCII 字；第二行：想要但原字体里没有的字。
    # 回归测试拿这两行核对卦名、卦辞、爻辞和页面文字里有没有冒出新字
    with open(CHARS, 'w', encoding='utf-8') as f:
        f.write(''.join(ch for ch in have if ord(ch) > 0x7f) + '\n' + ''.join(missing) + '\n')

    print(f'{len(have)} 个字 → {os.path.relpath(OUT, ROOT)}（{os.path.getsize(OUT) / 1024:.0f} KB）')
    if missing:
        print(f'原字体里没有、会退回系统字体的 {len(missing)} 个：' + ''.join(missing))


if __name__ == '__main__':
    main()
