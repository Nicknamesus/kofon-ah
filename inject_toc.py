"""Add a Table of Contents to the existing engineering-manual .docx files.

The English root copy and the Chinese translation have no builder script —
they were produced / translated by hand — so we inject the TOC field directly
into each file instead of regenerating it, preserving all existing content.

Run:  python inject_toc.py
"""
from __future__ import annotations

import os

from docx import Document

from toc_util import add_toc_before_first_heading

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)

# (path, TOC title) — title localised per document.
TARGETS = [
    (os.path.join(_ROOT, "Kofon_Chatbot_Engineering_Manual.docx"), "Contents"),
    (os.path.join(_ROOT, "Kofon_Chatbot_Engineering_Manual_Chinese.docx"), "目录"),
    (os.path.join(_HERE, "Kofon_Chatbot_Engineering_Manual.docx"), "Contents"),
]

# Chinese placeholder so the un-refreshed field reads naturally in that copy.
_ZH_PLACEHOLDER = "右键点击此处并选择“更新域”（或按 Ctrl+A 后按 F9）以生成目录。"


def main() -> None:
    for path, title in TARGETS:
        if not os.path.exists(path):
            print(f"skip (not found): {path}")
            continue
        doc = Document(path)
        placeholder = _ZH_PLACEHOLDER if title == "目录" else None
        if add_toc_before_first_heading(doc, title=title, placeholder=placeholder):
            doc.save(path)
            print(f"added TOC -> {path}")
        else:
            print(f"skipped (already has a TOC, or no Heading 1): {path}")


if __name__ == "__main__":
    main()
