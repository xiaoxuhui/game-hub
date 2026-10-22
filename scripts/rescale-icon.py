#!/usr/bin/env python3
"""Box-downscale a PNG icon to 512px, keeping it byte-reproducible.

Reads 8-bit RGB/RGBA PNGs with any of the five filter types (icons produced by
other tooling are not filter-free), then averages f x f blocks with premultiplied
alpha so transparent edges do not bleed dark fringes. No third-party dependency.
"""
import struct
import sys
import zlib


def decode(path):
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit("%s: not a PNG" % path)
    pos, idat, head = 8, bytearray(), None
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        tag = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        if tag == b"IHDR":
            head = struct.unpack(">IIBB", body[:10])
        elif tag == b"IDAT":
            idat += body
        elif tag == b"IEND":
            break
        pos += 12 + length
    width, height, depth, ctype = head
    if depth != 8 or ctype not in (2, 6):
        raise SystemExit("%s: expects 8-bit RGB or RGBA, got depth=%d type=%d"
                         % (path, depth, ctype))
    channels = 4 if ctype == 6 else 3
    raw = zlib.decompress(bytes(idat))
    stride = width * channels
    rows, prev = [], bytearray(stride)
    pos = 0
    for _ in range(height):
        ftype = raw[pos]
        line = bytearray(raw[pos + 1:pos + 1 + stride])
        pos += 1 + stride
        if ftype == 1:
            for i in range(channels, stride):
                line[i] = (line[i] + line[i - channels]) & 0xFF
        elif ftype == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ftype == 3:
            for i in range(stride):
                left = line[i - channels] if i >= channels else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif ftype == 4:
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                b = prev[i]
                c = prev[i - channels] if i >= channels else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                line[i] = (line[i] + pred) & 0xFF
        elif ftype != 0:
            raise SystemExit("%s: bad filter %d" % (path, ftype))
        rows.append(line)
        prev = line
    if channels == 3:
        rows = [bytearray(b for i in range(0, len(r), 3)
                          for b in (r[i], r[i + 1], r[i + 2], 255)) for r in rows]
    return width, height, rows


def write_png(path, width, height, rows):
    raw = bytearray()
    for row in rows:
        raw.append(0)
        raw += row

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    blob = (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
            + chunk(b"IEND", b""))
    open(path, "wb").write(blob)
    return len(blob)


def downscale(rows, width, height, factor):
    out_w, out_h = width // factor, height // factor
    area = factor * factor
    out = []
    for y in range(out_h):
        band = rows[y * factor:(y + 1) * factor]
        line = bytearray()
        for x in range(out_w):
            tr = tg = tb = ta = 0
            for row in band:
                base = x * factor * 4
                for k in range(factor):
                    i = base + k * 4
                    alpha = row[i + 3]
                    tr += row[i] * alpha
                    tg += row[i + 1] * alpha
                    tb += row[i + 2] * alpha
                    ta += alpha
            if ta:
                line += bytes((tr // ta, tg // ta, tb // ta, ta // area))
            else:
                line += bytes((0, 0, 0, 0))
        out.append(line)
    return out_w, out_h, out


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit("usage: rescale-icon.py <in.png> <out.png> [factor]")
    factor = int(sys.argv[3]) if len(sys.argv) > 3 else 2
    w, h, rows = decode(sys.argv[1])
    ow, oh, scaled = downscale(rows, w, h, factor)
    size = write_png(sys.argv[2], ow, oh, scaled)
    alphas = {row[i] for row in scaled for i in range(3, len(row), 4)}
    print("%s  %dx%d -> %dx%d  %d bytes  alpha=%s"
          % (sys.argv[2], w, h, ow, oh, size,
             "opaque" if alphas == {255} else "%d values" % len(alphas)))
