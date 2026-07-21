"""CLI: serve and install the modern ASV results UI over a published html_dir."""

from __future__ import annotations

import argparse
import functools
import http.server
import os
import shutil
import sys
import webbrowser
from pathlib import Path


def _static_dir() -> Path:
    here = Path(__file__).resolve().parent
    # Packaged assets
    packaged = here / "static"
    if packaged.is_dir() and (packaged / "index.html").exists():
        return packaged
    # Dev tree: web/dist after vite build
    dev = here.parent.parent / "web" / "dist"
    if dev.is_dir() and (dev / "index.html").exists():
        return dev
    raise SystemExit(
        "asv-tachyon UI assets not found. From a checkout run: "
        "cd web && npm install && npm run build"
    )


def cmd_serve(html_dir: Path, host: str, port: int, open_browser: bool) -> int:
    html_dir = html_dir.resolve()
    if not (html_dir / "index.json").exists():
        raise SystemExit(f"No index.json in {html_dir} (run `asv publish` first)")

    ui = _static_dir()

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(html_dir), **kwargs)

        def translate_path(self, path: str) -> str:
            # Prefer UI assets for app shell; data files stay in html_dir
            clean = path.split("?", 1)[0].split("#", 1)[0]
            if clean in ("/", "/index.html") or clean.startswith("/assets/"):
                rel = "index.html" if clean in ("/", "/index.html") else clean.lstrip("/")
                candidate = ui / rel
                if candidate.exists():
                    return str(candidate)
            return super().translate_path(path)

        def log_message(self, fmt: str, *args) -> None:
            sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    # SPA fallback: unknown paths that aren't data still get index.html from UI
    class SPAHandler(Handler):
        def do_GET(self):  # noqa: N802
            path = self.path.split("?", 1)[0]
            # data / graphs always from html_dir
            if (
                path.startswith("/graphs/")
                or path.endswith(".json")
                or path.endswith(".xml")
                or path.startswith("/assets/")
                or path in ("/", "/index.html")
            ):
                return super().do_GET()
            # hash routes: serve SPA
            self.path = "/index.html"
            return super().do_GET()

    httpd = http.server.ThreadingHTTPServer((host, port), SPAHandler)
    url = f"http://{host}:{port}/"
    print(f"asv-tachyon serving {html_dir}")
    print(f"  UI assets: {ui}")
    print(f"  {url}")
    if open_browser:
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    return 0


def cmd_install(html_dir: Path, backup: bool) -> int:
    """Copy modern UI into an asv publish output, keeping graphs/ + *.json."""
    html_dir = html_dir.resolve()
    if not (html_dir / "index.json").exists():
        raise SystemExit(f"No index.json in {html_dir} (run `asv publish` first)")
    ui = _static_dir()

    # Backup legacy index if present
    legacy = html_dir / "index.html"
    if backup and legacy.exists() and not (html_dir / "index.legacy.html").exists():
        shutil.copy2(legacy, html_dir / "index.legacy.html")

    # Copy SPA shell
    shutil.copy2(ui / "index.html", html_dir / "index.html")
    assets_src = ui / "assets"
    assets_dst = html_dir / "assets"
    if assets_dst.exists():
        shutil.rmtree(assets_dst)
    if assets_src.exists():
        shutil.copytree(assets_src, assets_dst)

    # Optional favicon from UI public/
    for name in ("favicon.svg", "favicon.ico"):
        src = ui / name
        if src.exists():
            shutil.copy2(src, html_dir / name)

    print(f"Installed asv-tachyon UI into {html_dir}")
    print("  Kept index.json, graphs/, regressions.json from asv publish")
    print("  Open with any static server, or: asv-tachyon serve", html_dir)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="asv-tachyon",
        description="Modern web UI for airspeed velocity published results",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_serve = sub.add_parser("serve", help="Serve modern UI over an asv html_dir")
    p_serve.add_argument(
        "html_dir",
        nargs="?",
        default=".",
        type=Path,
        help="Directory from `asv publish` (default: .)",
    )
    p_serve.add_argument("--host", default="127.0.0.1")
    p_serve.add_argument("--port", "-p", type=int, default=8765)
    p_serve.add_argument("--open", action="store_true", help="Open browser")

    p_install = sub.add_parser(
        "install",
        help="Write modern UI files into html_dir (drop-in replace of legacy index.html)",
    )
    p_install.add_argument("html_dir", type=Path, help="asv publish output directory")
    p_install.add_argument(
        "--no-backup",
        action="store_true",
        help="Do not keep index.legacy.html",
    )

    args = parser.parse_args(argv)
    if args.cmd == "serve":
        return cmd_serve(args.html_dir, args.host, args.port, args.open)
    if args.cmd == "install":
        return cmd_install(args.html_dir, backup=not args.no_backup)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
