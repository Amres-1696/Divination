#!/usr/bin/env python3
"""把正文字体思源宋体（Noto Serif SC）裁成两份放进仓库，不再从 Google Fonts 加载（国内基本连不上）。

- fonts/NotoSerifSC-subset.woff2：本站源码里出现过的字（卦辞、爻辞、卦象白话、界面文字），每次都加载。
- fonts/NotoSerifSC-ext.woff2：GB2312 一级字库（3755 个常用字）里除去上面那份的字。
  它只在 fonts/NotoSerifSC-ext.css 里按 unicode-range 声明，页面上真的出现这些字
  （用户自己写的问题、AI 解读）时浏览器才去下载，平时不占流量。

两份都是可变字体，字重只留 400–700（页面用到 400、600 和 <b> 的粗体）。
改了文案、出现新字之后要重新跑一遍，否则新字会去用扩展字库或者系统宋体；回归测试会检查这一点。

用法：
    pip install fonttools brotli
    python tools/subset-text-font.py "/path/to/NotoSerifSC[wght].ttf"
    python tools/stamp-versions.py

原字体在 https://github.com/google/fonts/tree/main/ofl/notoserifsc ，SIL OFL 1.1 授权（fonts/OFL-NotoSerifSC.txt）。
"""
import glob, os, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, 'fonts')
CORE = os.path.join(FONTS, 'NotoSerifSC-subset.woff2')
EXT = os.path.join(FONTS, 'NotoSerifSC-ext.woff2')
EXT_CSS = os.path.join(FONTS, 'NotoSerifSC-ext.css')
CHARS = os.path.join(FONTS, 'NotoSerifSC-subset.chars.txt')
SOURCES = ['index.html', 'style.css', 'data.js'] + sorted(
    os.path.relpath(p, ROOT) for p in glob.glob(os.path.join(ROOT, 'js', '*.js')))
WGHT = (400, 400, 700)   # 最细、默认、最粗


def strip_comments(rel, text):
    if rel.endswith('.html'):
        return re.sub(r'<!--.*?-->', '', text, flags=re.S)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    if rel.endswith('.js'):
        text = re.sub(r'(^|\s)//.*$', '', text, flags=re.M)
    return text


def core_chars():
    chars = set(chr(c) for c in range(0x20, 0x7f))
    chars.update('，。、；：？！“”‘’「」『』《》（）〈〉【】—…·　')
    for rel in SOURCES:
        with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
            text = strip_comments(rel, f.read())
        chars.update(ch for ch in text if ord(ch) > 0x7f and not ch.isspace())
    return chars


def gb2312_level1():
    chars = set()
    for hi in range(0xB0, 0xD8):
        for lo in range(0xA1, 0xFF):
            try:
                chars.add(bytes([hi, lo]).decode('gb2312'))
            except UnicodeDecodeError:
                pass
    return chars


def unicode_range(chars):
    cps = sorted(ord(c) for c in chars)
    spans, start, prev = [], cps[0], cps[0]
    for cp in cps[1:]:
        if cp == prev + 1:
            prev = cp
            continue
        spans.append((start, prev))
        start = prev = cp
    spans.append((start, prev))
    return ','.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a, b in spans)


def build(src, chars, out):
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.hinting = False
    opts.layout_features = ['*']
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]   # 保留版权和授权信息
    opts.notdef_outline = True
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=[ord(ch) for ch in chars])
    sub.subset(font)
    font = instancer.instantiateVariableFont(font, {'wght': WGHT})
    subset.save_font(font, out, opts)
    return os.path.getsize(out) / 1024


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    cmap = TTFont(src, lazy=True).getBestCmap()
    want = core_chars()
    have = sorted(ch for ch in want if ord(ch) in cmap)
    missing = sorted(ch for ch in want if ord(ch) not in cmap)
    ext = sorted((ch for ch in gb2312_level1() - set(have) if ord(ch) in cmap), key=ord)

    core_kb = build(src, have, CORE)
    ext_kb = build(src, ext, EXT)

    with open(EXT_CSS, 'w', encoding='utf-8') as f:
        f.write('/* tools/subset-text-font.py 生成，不要手改。\n'
                '   常用字里本站源码没用到的那部分思源宋体：只有页面上出现这些字（用户写的问题、AI 解读）时才下载。 */\n'
                '@font-face {\n'
                '  font-family: "Noto Serif SC";\n'
                '  src: url("NotoSerifSC-ext.woff2?v=") format("woff2");\n'
                f'  font-weight: {WGHT[0]} {WGHT[2]};\n'
                '  font-style: normal;\n'
                '  font-display: swap;\n'
                f'  unicode-range: {unicode_range(ext)};\n'
                '}\n')

    # 第一行：裁进常用那份的非 ASCII 字；第二行：想要但原字体里没有的字。回归测试拿来核对有没有冒出新字
    with open(CHARS, 'w', encoding='utf-8') as f:
        f.write(''.join(ch for ch in have if ord(ch) > 0x7f) + '\n' + ''.join(missing) + '\n')

    print(f'本站用字 {len(have)} 个 → {os.path.relpath(CORE, ROOT)}（{core_kb:.0f} KB）')
    print(f'扩展常用字 {len(ext)} 个 → {os.path.relpath(EXT, ROOT)}（{ext_kb:.0f} KB，按需加载）')
    if missing:
        print(f'原字体里没有、会退回系统字体的 {len(missing)} 个：' + ''.join(missing))
    print('记得再运行 python tools/stamp-versions.py 更新版本号')


if __name__ == '__main__':
    main()
