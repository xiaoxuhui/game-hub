#!/usr/bin/env python3
"""Generate 512x512 game icons as PNG without any third-party dependency.

Draws flat geometric symbols whose palette and silhouette come from each game's
own page, then writes a truecolour+alpha PNG by hand (zlib + CRC). Shapes use
signed distance fields so edges get one pixel of analytic antialiasing.
"""
import math
import os
import struct
import zlib

SIZE = 512


# --- PNG output -------------------------------------------------------------

def write_png(path, pixels):
    stride = SIZE * 4
    raw = bytearray()
    for y in range(SIZE):
        raw.append(0)  # filter type 0
        raw += pixels[y * stride:(y + 1) * stride]

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)
    blob = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))
    with open(path, "wb") as fh:
        fh.write(blob)
    return len(blob)


# --- distance fields (negative inside) --------------------------------------

def sd_circle(cx, cy, r):
    return lambda x, y: math.hypot(x - cx, y - cy) - r


def sd_rrect(cx, cy, hw, hh, r):
    def f(x, y):
        qx = abs(x - cx) - (hw - r)
        qy = abs(y - cy) - (hh - r)
        ax, ay = max(qx, 0.0), max(qy, 0.0)
        return math.hypot(ax, ay) + min(max(qx, qy), 0.0) - r
    return f


def sd_capsule(x1, y1, x2, y2, r):
    dx, dy = x2 - x1, y2 - y1
    length2 = dx * dx + dy * dy

    def f(x, y):
        if length2 == 0.0:
            t = 0.0
        else:
            t = ((x - x1) * dx + (y - y1) * dy) / length2
            t = 0.0 if t < 0.0 else (1.0 if t > 1.0 else t)
        return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)) - r
    return f


def union(*fns):
    return lambda x, y: min(f(x, y) for f in fns)


def subtract(a, b):
    return lambda x, y: max(a(x, y), -b(x, y))


def intersect(a, b):
    return lambda x, y: max(a(x, y), b(x, y))


# --- canvas -----------------------------------------------------------------

class Canvas:
    def __init__(self, background):
        self.px = bytearray(bytes(background + (255,)) * (SIZE * SIZE))

    def fill(self, sdf, color, box=None):
        """Composite `color` where sdf < 0, honouring 1px antialiasing."""
        x0, y0, x1, y1 = box or (0, 0, SIZE, SIZE)
        x0, y0 = max(0, int(x0) - 2), max(0, int(y0) - 2)
        x1, y1 = min(SIZE, int(x1) + 2), min(SIZE, int(y1) + 2)
        r, g, b = color
        px = self.px
        for y in range(y0, y1):
            row = y * SIZE * 4
            for x in range(x0, x1):
                a = 0.5 - sdf(x + 0.5, y + 0.5)
                if a <= 0.0:
                    continue
                if a > 1.0:
                    a = 1.0
                i = row + x * 4
                if a >= 1.0:
                    px[i], px[i + 1], px[i + 2], px[i + 3] = r, g, b, 255
                else:
                    inv = 1.0 - a
                    px[i] = int(px[i] * inv + r * a + 0.5)
                    px[i + 1] = int(px[i + 1] * inv + g * a + 0.5)
                    px[i + 2] = int(px[i + 2] * inv + b * a + 0.5)
                    px[i + 3] = 255


def rgb(hexstr):
    h = hexstr.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


# --- the four icons ---------------------------------------------------------

def icon_memory_demo(path):
    """配对练习: 3x2 card board, one matched pair turned face up."""
    c = Canvas(rgb("#101827"))
    cw, gap, r = 130, 16, 26
    half = cw / 2
    x0 = (SIZE - (3 * cw + 2 * gap)) / 2
    y0 = (SIZE - (2 * cw + gap)) / 2
    faces = {(0, 0), (2, 1)}  # diagonal pair, already matched
    for j in range(2):
        for i in range(3):
            cx = x0 + half + i * (cw + gap)
            cy = y0 + half + j * (cw + gap)
            if (i, j) in faces:
                c.fill(sd_rrect(cx, cy, half, half, r), rgb("#f5c76d"),
                       (cx - half, cy - half, cx + half, cy + half))
                for dx in (-30, 30):
                    c.fill(sd_circle(cx + dx, cy, 13), rgb("#101827"),
                           (cx + dx - 13, cy - 13, cx + dx + 13, cy + 13))
            else:
                c.fill(sd_rrect(cx, cy, half, half, r), rgb("#2d4160"),
                       (cx - half, cy - half, cx + half, cy + half))
                c.fill(sd_rrect(cx, cy, half - 4, half - 4, r - 4),
                       rgb("#223147"),
                       (cx - half, cy - half, cx + half, cy + half))
    return write_png(path, c.px)


def icon_red_green(path):
    """红绿变换: bit grid stepping from all red toward all green."""
    c = Canvas(rgb("#f5f7fb"))
    cell, gap, r = 88, 12, 16
    half = cell / 2
    x0 = (SIZE - (4 * cell + 3 * gap)) / 2
    y0 = x0
    red, green = rgb("#e83434"), rgb("#18c94b")
    for row in range(4):
        on = row + 1  # bottom rows are greener: the transformation flows down
        for col in range(4):
            cx = x0 + half + col * (cell + gap)
            cy = y0 + half + row * (cell + gap)
            color = green if col >= 4 - on else red
            c.fill(sd_rrect(cx, cy, half, half, r), color,
                   (cx - half, cy - half, cx + half, cy + half))
    return write_png(path, c.px)


def icon_logic_circuit(path):
    """逻辑工坊: NAND gate, the page brand mark and the game's starting point."""
    c = Canvas(rgb("#10171d"))
    mint = rgb("#91e6be")
    lead = 7.0
    # input leads
    for y in (214, 298):
        c.fill(sd_capsule(75, y, 165, y, lead), mint, (68, y - 10, 172, y + 10))
    # gate body: flat left edge plus the right half of the output arc. The arc
    # must be clipped at the centre line, otherwise the full disc is wider than
    # the rectangle and its corners poke out as two ears.
    right_half = intersect(sd_circle(241, 256, 116), lambda x, y: 241 - x)
    c.fill(union(sd_rrect(203, 256, 38, 116, 0), right_half), mint,
           (163, 138, 361, 374))
    # inversion bubble and output lead
    c.fill(subtract(sd_circle(380, 256, 23), sd_circle(380, 256, 11)), mint,
           (355, 231, 405, 281))
    c.fill(sd_capsule(403, 256, 437, 256, lead), mint, (395, 248, 445, 264))
    return write_png(path, c.px)


def icon_traffic_planner(path):
    """路流 FLOW: the page's own brand mark — green tile with the road glyph."""
    c = Canvas(rgb("#121c1b"))
    green, ink = rgb("#b7e894"), rgb("#203525")
    c.fill(sd_rrect(256, 256, 180, 180, 100), green, (72, 72, 440, 440))
    s = 240.0 / 24.0
    stroke = 1.75 * s / 2.0

    def X(u):
        return 256 + (u - 12) * s

    def Y(v):
        return 256 + (v - 12) * s

    segs = [((7, 3), (4, 21)), ((17, 3), (20, 21)),
            ((12, 3), (12, 7)), ((12, 10), (12, 14)), ((12, 17), (12, 21))]
    for (u1, v1), (u2, v2) in segs:
        box = (min(X(u1), X(u2)) - 10, min(Y(v1), Y(v2)) - 10,
               max(X(u1), X(u2)) + 10, max(Y(v1), Y(v2)) + 10)
        c.fill(sd_capsule(X(u1), Y(v1), X(u2), Y(v2), stroke), ink, box)
    return write_png(path, c.px)


ICONS = {
    "memory-demo": icon_memory_demo,
    "red-green-puzzle": icon_red_green,
    "logic-circuit": icon_logic_circuit,
    "traffic-planner": icon_traffic_planner,
}

if __name__ == "__main__":
    import sys
    outdir = sys.argv[1] if len(sys.argv) > 1 else "icons-out"
    os.makedirs(outdir, exist_ok=True)
    only = sys.argv[2:] or list(ICONS)
    for name in only:
        path = os.path.join(outdir, name + ".png")
        size = ICONS[name](path)
        print("%-20s %7d bytes  %.1f KiB" % (name, size, size / 1024.0))
