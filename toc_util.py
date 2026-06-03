"""Shared helper: insert a real Word Table-of-Contents field into a .docx.

Both `build_manual.py` (canonical builder) and `inject_toc.py` (one-off
injector for the hand-edited / translated copies) use this so the TOC looks
and behaves identically everywhere.

The TOC is a native Word field (`{ TOC \\o "1-3" \\h \\z \\u }`), not a static
list, so it tracks the Heading 1/2/3 styles already used throughout the manual
and recomputes its page numbers whenever the document is opened or the field is
refreshed (right-click -> Update Field, or Ctrl+A then F9). We also set the
document-level `updateFields` flag so Word refreshes it automatically on open.
"""
from __future__ import annotations

from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

NAVY = "132178"
GREY = "5A6473"


def _toc_elements(title: str, placeholder: str):
    """Build the (title, field, page-break) paragraph elements for the TOC."""
    ns = nsdecls("w")

    # "Contents" heading — deliberately NOT a Heading style, so the TOC does
    # not list itself. Styled by hand to match the manual's H1 look.
    title_p = parse_xml(
        f'<w:p {ns}>'
        f'<w:pPr><w:spacing w:before="240" w:after="160"/></w:pPr>'
        f'<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>'
        f'<w:b/><w:color w:val="{NAVY}"/><w:sz w:val="40"/></w:rPr>'
        f'<w:t xml:space="preserve">{title}</w:t></w:r>'
        f'</w:p>'
    )

    # The TOC field itself. The text between `separate` and `end` is the
    # placeholder shown until the field is updated.
    field_p = parse_xml(
        f'<w:p {ns}>'
        f'<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>'
        f'<w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r>'
        f'<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
        f'<w:r><w:rPr><w:i/><w:color w:val="{GREY}"/></w:rPr>'
        f'<w:t xml:space="preserve">{placeholder}</w:t></w:r>'
        f'<w:r><w:fldChar w:fldCharType="end"/></w:r>'
        f'</w:p>'
    )

    pagebreak_p = parse_xml(
        f'<w:p {ns}><w:r><w:br w:type="page"/></w:r></w:p>'
    )

    return title_p, field_p, pagebreak_p


def _enable_update_on_open(document) -> None:
    """Tell Word to refresh fields (and thus the TOC) when the file opens."""
    settings = document.settings.element
    el = settings.find(qn("w:updateFields"))
    if el is None:
        el = OxmlElement("w:updateFields")
        settings.insert(0, el)
    el.set(qn("w:val"), "true")


def add_toc_before_first_heading(document, title="Contents", placeholder=None):
    """Insert a TOC (title + field + page break) before the first Heading 1.

    Returns True if inserted, False if no Heading 1 was found.
    """
    if placeholder is None:
        placeholder = (
            "Right-click here and choose “Update Field” "
            "(or press Ctrl+A then F9) to build the table of contents."
        )

    # Idempotency: bail out if a TOC field is already present.
    for instr in document.element.body.iter(qn("w:instrText")):
        if instr.text and "TOC" in instr.text:
            return False

    anchor = None
    for p in document.paragraphs:
        if p.style is not None and p.style.name == "Heading 1":
            anchor = p._p
            break
    if anchor is None:
        return False

    title_p, field_p, pagebreak_p = _toc_elements(title, placeholder)
    # addprevious keeps document order: title, field, page break, <Heading 1>
    anchor.addprevious(title_p)
    anchor.addprevious(field_p)
    anchor.addprevious(pagebreak_p)

    _enable_update_on_open(document)
    return True
