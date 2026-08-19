from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "icons"


def icon(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), (19, 19, 19, 255))
    draw = ImageDraw.Draw(image)
    scale = size / 64
    gold = (245, 197, 66, 255)

    def point(x, y):
        return (round(x * scale), round(y * scale))

    width = max(1, round(2.5 * scale))
    draw.line([point(32, 6), point(24, 14), point(18, 24), point(18, 28), point(24, 34), point(32, 34), point(40, 34), point(46, 28), point(46, 24), point(40, 14), point(32, 6)], fill=gold, width=width, joint="curve")
    draw.line([point(32, 10), point(32, 58)], fill=gold, width=width)
    draw.line([point(32, 44), point(25, 44)], fill=gold, width=width)
    draw.line([point(32, 52), point(26, 52)], fill=gold, width=width)
    radius = 1.6 * scale
    draw.ellipse([point(32 - 1.6, 19 - 1.6), point(32 + 1.6, 19 + 1.6)], fill=gold)
    return image


for size in (16, 48, 128):
    icon(size).save(OUT / f"icon-{size}.png", format="PNG", optimize=True)
