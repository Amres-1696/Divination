#!/usr/bin/env python3
"""把 index.html 和 style.css 里每个本地文件地址后面的 ?v= 换成该文件内容的哈希。

浏览器按地址缓存，文件改了而 ?v= 没改，用户就会拿到旧文件。以前是手写日期，容易忘、合并时还会冲突；
现在改完代码跑一下这个脚本就行，没改的文件版本号不变。回归测试会检查版本号和文件内容是否对得上。

用法：
    python tools/stamp-versions.py
"""
import hashlib, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = re.compile(r'((?:src|href)="|url\(")([\w./-]+)\?v=[\w-]*(")')


def digest(rel):
    with open(os.path.join(ROOT, rel), 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]


def stamp(rel):
    path = os.path.join(ROOT, rel)
    with open(path, encoding='utf-8') as f:
        text = f.read()
    base = os.path.dirname(rel)
    new = REF.sub(lambda m: f'{m.group(1)}{m.group(2)}?v={digest(os.path.normpath(os.path.join(base, m.group(2))))}{m.group(3)}', text)
    if new != text:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new)
    return len(REF.findall(text))


if __name__ == '__main__':
    # style.css 引用字体，index.html 又引用 style.css：先盖 style.css，它的哈希才是最终的
    n = stamp('style.css') + stamp('index.html')
    print(f'{n} 处版本号已按内容更新')
