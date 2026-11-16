#!/usr/bin/env python3
"""给后台页 admin.html 裁一份站酷小薇子集，输出 fonts/ZCOOLXiaoWei-admin.woff2。

后台页用展示字的地方：界面文字、数字、六十四卦的卦名和卦辞。
所以收的是 admin.html 里出现过的字，加上 data.js 里每一卦的卦名和卦辞。
改了 admin.html 的文案、出现新字之后重新跑一遍，否则新字会退回系统宋体。

用法：
    pip install fonttools brotli
    python tools/subset-admin-font.py /path/to/ZCOOLXiaoWei-Regular.ttf

原字体在 https://github.com/google/fonts/tree/main/ofl/zcoolxiaowei ，SIL OFL 1.1 授权。
"""
import os, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'fonts', 'ZCOOLXiaoWei-admin.woff2')


def wanted_chars():
    chars = set(chr(c) for c in range(0x20, 0x7f))
    chars.update('，。、；：？！“”‘’「」『』《》（）—…　')
    with open(os.path.join(ROOT, 'admin.html'), encoding='utf-8') as f:
        text = re.sub(r'<!--.*?-->', '', f.read(), flags=re.S)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    text = re.sub(r'(^|\s)//.*$', '', text, flags=re.M)
    chars.update(ch for ch in text if ord(ch) > 0x7f and not ch.isspace())
    with open(os.path.join(ROOT, 'data.js'), encoding='utf-8') as f:
        for name, ci in re.findall(r"^\s*\['([^']*)', '([^']*)', '[^']*', '[^']*', '[^']*'\]", f.read(), flags=re.M):
            chars.update(name + ci)
    return chars


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    cmap = TTFont(src, lazy=True).getBestCmap()
    want = wanted_chars()
    have = sorted(ch for ch in want if ord(ch) in cmap)
    missing = sorted(ch for ch in want if ord(ch) not in cmap and not ch.isspace())

    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(opts)
    sub.populate(text=''.join(have))
    sub.subset(font)
    subset.save_font(font, OUT, opts)
    print(f'{len(have)} 个字，{os.path.getsize(OUT) // 1024} KB -> {os.path.relpath(OUT, ROOT)}')
    if missing:
        print('原字体里没有、会退回正文字体的字：' + ''.join(missing))


if __name__ == '__main__':
    main()
