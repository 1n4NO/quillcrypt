"""Rasterize the canonical Quillcrypt mark for browser-extension manifests.

The SVG remains the source of truth. The extension ships PNGs because Chrome's
manifest icon support requires raster images, while Firefox also displays them
consistently across the extension surfaces.
"""

from __future__ import annotations

import copy
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SOURCE = REPOSITORY_ROOT / "logo" / "quillcrypt-mark.svg"
OUT = Path(__file__).resolve().parents[1] / "icons"
SIZES = (16, 48, 128)
BACKGROUND = "#131313"
ACCENT = "#f5c542"
SVG_NS = "http://www.w3.org/2000/svg"
SVG_TAG = f"{{{SVG_NS}}}svg"

ET.register_namespace("", SVG_NS)


def themed_svg(source: bytes) -> bytes:
    """Create a raster-only themed wrapper around the canonical mark SVG.

    The source logo intentionally uses ``currentColor`` so it can adapt to
    its usage site. Extension icons need a stable dark-and-amber treatment,
    so the source's geometry is preserved while the raster render supplies
    that context.
    """

    source_root = ET.fromstring(source)
    view_box = source_root.attrib.get("viewBox")
    if not view_box:
        raise ValueError(f"{SOURCE} must define a viewBox")

    try:
        _, _, view_width, view_height = (float(value) for value in view_box.split())
    except ValueError as exc:
        raise ValueError(f"{SOURCE} has an invalid viewBox: {view_box!r}") from exc

    root = ET.Element(SVG_TAG, {
        "viewBox": view_box,
        "width": str(view_width),
        "height": str(view_height),
    })
    ET.SubElement(root, f"{{{SVG_NS}}}rect", {
        "x": "0",
        "y": "0",
        "width": str(view_width),
        "height": str(view_height),
        "fill": BACKGROUND,
    })

    inherited_attributes = {
        key: value
        for key, value in source_root.attrib.items()
        if key not in {"viewBox", "width", "height"}
    }
    inherited_attributes["color"] = ACCENT
    group = ET.SubElement(root, f"{{{SVG_NS}}}g", inherited_attributes)
    for child in list(source_root):
        group.append(copy.deepcopy(child))

    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def render_with_cairosvg(svg: bytes, output: Path, size: int) -> bool:
    try:
        import cairosvg  # type: ignore
    except ImportError:
        return False

    cairosvg.svg2png(
        bytestring=svg,
        write_to=str(output),
        output_width=size,
        output_height=size,
    )
    return True


def render_with_command(svg: bytes, output: Path, size: int) -> str | None:
    """Use an installed native SVG rasterizer when CairoSVG is unavailable."""

    commands = []
    if shutil.which("sips"):
        commands.append(("sips", ["-s", "format", "png", "-z", str(size), str(size)]))
    if shutil.which("rsvg-convert"):
        commands.append(("rsvg-convert", ["-w", str(size), "-h", str(size)]))
    image_magick = shutil.which("magick") or shutil.which("convert")
    if image_magick:
        commands.append((image_magick, ["-background", "none", "-resize", f"{size}x{size}"]))

    if not commands:
        return None

    with tempfile.TemporaryDirectory(prefix="quillcrypt-icons-") as temporary_directory:
        source_path = Path(temporary_directory) / "quillcrypt-mark.svg"
        source_path.write_bytes(svg)

        executable, arguments = commands[0]
        if executable == "sips":
            command = [executable, *arguments, str(source_path), "--out", str(output)]
        elif executable == "rsvg-convert":
            command = [executable, *arguments, "-o", str(output), str(source_path)]
        else:
            command = [executable, str(source_path), *arguments, str(output)]

        completed = subprocess.run(command, capture_output=True, text=True, check=False)
        if completed.returncode != 0:
            details = (completed.stderr or completed.stdout).strip()
            raise RuntimeError(f"{executable} failed to rasterize {SOURCE}: {details}")

    return executable


def rasterize(svg: bytes, output: Path, size: int) -> str:
    if render_with_cairosvg(svg, output, size):
        return "cairosvg"

    renderer = render_with_command(svg, output, size)
    if renderer:
        return renderer

    raise RuntimeError(
        "No SVG rasterizer found. Install CairoSVG or an SVG-capable native "
        "rasterizer (sips, rsvg-convert, or ImageMagick)."
    )


def main() -> None:
    source = SOURCE.read_bytes()
    rendered_source = themed_svg(source)
    OUT.mkdir(parents=True, exist_ok=True)

    renderer = None
    for size in SIZES:
        renderer = renderer or rasterize(rendered_source, OUT / f"icon-{size}.png", size)

    print(f"Rasterized {SOURCE} to {', '.join(str(size) for size in SIZES)}px PNGs using {renderer}.")


if __name__ == "__main__":
    main()
