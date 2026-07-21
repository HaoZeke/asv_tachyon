"""Sphinx config for asv-tachyon docs (modern ASV results UI)."""

from __future__ import annotations

try:
    from asv_tachyon._version import version as release
except Exception:  # pragma: no cover
    release = "0.3.0"

project = "asv-tachyon"
copyright = "2026, Rohit Goswami"
author = "Rohit Goswami"
version = release

extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.napoleon",
    "sphinx.ext.viewcode",
    "sphinx_sitemap",
]

templates_path = ["_templates"]
exclude_patterns = []
html_theme = "shibuya"
html_static_path = ["_static"]
html_baseurl = "https://haozeke.github.io/asv_tachyon/"
html_logo = "../../branding/logo/asv_tachyon_logo.png"
html_favicon = "_static/favicon.svg"
html_title = "asv-tachyon"
html_theme_options = {
    "accent_color": "teal",
    "github_url": "https://github.com/HaoZeke/asv_tachyon",
    "globaltoc_expand_depth": 1,
}
html_css_files = ["custom.css"]
html_copy_source = False
sitemap_url_scheme = "{link}"
