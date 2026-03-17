#!/usr/bin/env python3
"""
img_to_progmem.py – Convierte imágenes PNG en arrays C++ PROGMEM para ESP32

Uso:
  python img_to_progmem.py sprite.png --name spr_fire_baby --width 32 --height 32
  python img_to_progmem.py sprites/ --all --width 32 --height 32

Genera:
  sprites/spr_fire_baby.h con el array en formato RGB565 para TFT_eSPI

Color transparente: magenta puro (255, 0, 255) → 0xF81F en RGB565
"""

import argparse
import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERROR: Instala Pillow primero: pip install Pillow")
    sys.exit(1)


def rgb_to_rgb565(r, g, b):
    """Convierte RGB888 a RGB565 (16 bits)"""
    r5 = (r >> 3) & 0x1F
    g6 = (g >> 2) & 0x3F
    b5 = (b >> 3) & 0x1F
    return (r5 << 11) | (g6 << 5) | b5


def image_to_progmem(img_path: Path, var_name: str, width: int, height: int) -> str:
    """Convierte una imagen PNG en un array C++ PROGMEM"""
    img = Image.open(img_path).convert("RGBA").resize((width, height), Image.NEAREST)

    pixels = []
    for y in range(height):
        for x in range(width):
            r, g, b, a = img.getpixel((x, y))
            if a < 128:
                # Transparente → 0xF81F (magenta)
                pixels.append(0xF81F)
            elif r == 255 and g == 0 and b == 255:
                # Magenta explícito → transparente
                pixels.append(0xF81F)
            else:
                pixels.append(rgb_to_rgb565(r, g, b))

    # Generar código C++
    lines = [
        f"// Auto-generado por img_to_progmem.py",
        f"// Fuente: {img_path.name}",
        f"// Tamaño: {width}x{height} píxeles, RGB565",
        f"// Transparente: 0xF81F (magenta)",
        f"",
        f"const uint16_t PROGMEM {var_name}[] = {{",
    ]

    # 8 valores por línea
    for i in range(0, len(pixels), 8):
        chunk = pixels[i:i+8]
        hex_str = ", ".join(f"0x{v:04X}" for v in chunk)
        lines.append(f"  {hex_str},")

    lines.append("};")
    lines.append(f"// Total: {len(pixels)} píxeles ({len(pixels)*2} bytes)")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Convierte PNG a arrays PROGMEM para ESP32")
    parser.add_argument("input", help="Imagen PNG o directorio de sprites")
    parser.add_argument("--name", "-n", default=None, help="Nombre de la variable C++")
    parser.add_argument("--width",  "-W", type=int, default=32, help="Ancho del sprite (default: 32)")
    parser.add_argument("--height", "-H", type=int, default=32, help="Alto del sprite (default: 32)")
    parser.add_argument("--output", "-o", default=None, help="Directorio de salida (default: mismo que entrada)")
    parser.add_argument("--all", "-a", action="store_true", help="Procesar todos los PNG del directorio")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output) if args.output else input_path.parent

    if input_path.is_dir() and args.all:
        # Procesar todos los PNG del directorio
        png_files = list(input_path.glob("*.png"))
        if not png_files:
            print(f"No se encontraron PNG en {input_path}")
            sys.exit(1)

        for png in png_files:
            var_name = "spr_" + png.stem.lower().replace("-", "_").replace(" ", "_")
            code = image_to_progmem(png, var_name, args.width, args.height)
            out_file = output_dir / (var_name + ".h")
            out_file.write_text(code)
            print(f"✓ {png.name} → {out_file.name} ({var_name})")

    elif input_path.is_file():
        var_name = args.name or ("spr_" + input_path.stem.lower())
        code = image_to_progmem(input_path, var_name, args.width, args.height)
        out_file = output_dir / (var_name + ".h")
        out_file.write_text(code)
        print(f"✓ {input_path.name} → {out_file.name} ({var_name})")
        print(f"  Tamaño: {args.width}x{args.height} = {args.width*args.height*2} bytes")

    else:
        print(f"ERROR: '{args.input}' no es un archivo PNG ni directorio válido")
        sys.exit(1)


if __name__ == "__main__":
    main()
