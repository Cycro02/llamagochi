#!/usr/bin/env python3
"""
generate_llama_sprites.py – Genera pixel art de llama para llamagochi

Produce:
  sprites/llama_egg.png    (32×32)
  sprites/llama_baby.png   (32×32)
  sprites/llama_child.png  (32×32)
  sprites/llama_teen.png   (32×32)
  sprites/llama_adult.png  (32×32)
  sprites/llama_elder.png  (32×32)
  sprites/icon_sun.png     (16×16)
  sprites/icon_cloud.png   (16×16)
  sprites/icon_cold.png    (16×16)
  sprites/icon_hot.png     (16×16)
  sprites/icon_rain.png    (16×16)

Convención de colores:
  BODY     = (238,238,238) → se tintará en runtime por especie
  TRANSP   = (255,  0,255) → transparente (magenta)
  OUTLINE  = (  0,  0,  0) → contornos/ojos
  WHITE    = (255,255,255) → highlights fijos
  CHEEK    = (255,180,180) → cachetes rosados
"""

from PIL import Image
from pathlib import Path

BODY    = (238, 238, 238)
TRANSP  = (255,   0, 255)
OUTLINE = (  0,   0,   0)
WHITE   = (255, 255, 255)
CHEEK   = (255, 180, 180)

OUT_DIR = Path(__file__).parent.parent / "sprites"
OUT_DIR.mkdir(exist_ok=True)


def new_img(w, h):
    img = Image.new("RGBA", (w, h), (255, 0, 255, 255))
    return img


def px(img, x, y, color):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), color + (255,))


def rect(img, x, y, w, h, color):
    for dy in range(h):
        for dx in range(w):
            px(img, x + dx, y + dy, color)


def save(img, name):
    path = OUT_DIR / name
    # Convierte magenta a transparente real
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    for yy in range(img.height):
        for xx in range(img.width):
            c = img.getpixel((xx, yy))
            if c[:3] == TRANSP:
                out.putpixel((xx, yy), (255, 0, 255, 255))  # mantener magenta para img_to_progmem
            else:
                out.putpixel((xx, yy), c)
    out.save(str(path))
    print(f"✓ {name}")


# ─── LLAMA EGG (32×32) ────────────────────────────────────────────────────────
def make_egg():
    img = new_img(32, 32)
    # Huevo: cuerpo ovalado 14×18 centrado en (16,18)
    cx, cy = 15, 18
    for dy in range(-9, 10):
        for dx in range(-7, 8):
            # Elipse: (dx/7)^2 + (dy/9)^2 <= 1
            if (dx*dx*81 + dy*dy*49) <= 49*81:
                px(img, cx+dx, cy+dy, BODY)
    # Contorno del huevo
    for dy in range(-9, 10):
        for dx in range(-7, 8):
            if abs((dx*dx*81 + dy*dy*49) - 49*81) < 400:
                if (dx*dx*81 + dy*dy*49) <= 49*81:
                    # borde exterior
                    pass
    # Contorno simple: un pixel alrededor
    for dy in range(-10, 11):
        for dx in range(-8, 9):
            in_egg = (dx*dx*81 + dy*dy*49) <= 49*81
            in_inner = ((dx-0)*(dx-0)*81 + (dy-0)*(dy-0)*49) <= (7*9-2)**2
            if in_egg:
                # check if neighbor is outside
                neighbors_outside = False
                for ddx, ddy in [(-1,0),(1,0),(0,-1),(0,1)]:
                    nx_, ny_ = dx+ddx, dy+ddy
                    if (nx_*nx_*81 + ny_*ny_*49) > 49*81:
                        neighbors_outside = True
                if neighbors_outside:
                    px(img, cx+dx, cy+dy, OUTLINE)

    # Orejitas puntiagudas arriba
    # Oreja izquierda: punta en (11,6), base en (10-11, 9)
    for y, xs in [(6,[11]),(7,[10,11]),(8,[10,11]),(9,[10,11])]:
        for x in xs:
            px(img, x, y, BODY)
    # Contorno oreja izquierda
    for pos in [(11,6),(10,7),(10,8),(10,9),(12,7),(12,8),(11,9)]:
        px(img, pos[0], pos[1], OUTLINE)

    # Oreja derecha: punta en (20,6)
    for y, xs in [(6,[20]),(7,[20,21]),(8,[20,21]),(9,[20,21])]:
        for x in xs:
            px(img, x, y, BODY)
    for pos in [(20,6),(21,7),(21,8),(21,9),(19,7),(19,8),(20,9)]:
        px(img, pos[0], pos[1], OUTLINE)

    # Ojitos
    px(img, 13, 17, OUTLINE)
    px(img, 13, 18, OUTLINE)
    px(img, 18, 17, OUTLINE)
    px(img, 18, 18, OUTLINE)
    # Brillo en ojos
    px(img, 14, 17, WHITE)
    px(img, 19, 17, WHITE)
    # Boquita
    px(img, 15, 22, OUTLINE)
    px(img, 16, 23, OUTLINE)
    px(img, 17, 22, OUTLINE)

    save(img, "llama_egg.png")


# ─── LLAMA BABY (32×32) ───────────────────────────────────────────────────────
def make_baby():
    img = new_img(32, 32)
    # Cuerpo redondo pequeño: 10×9 en (11,18)
    rect(img, 11, 18, 11, 9, BODY)
    # Esquinas redondeadas del cuerpo
    for pos in [(11,18),(21,18),(11,26),(21,26)]:
        px(img, pos[0], pos[1], TRANSP)
    # Contorno cuerpo
    for x in range(12, 21):
        px(img, x, 17, OUTLINE)
        px(img, x, 27, OUTLINE)
    for y in range(18, 27):
        px(img, 10, y, OUTLINE)
        px(img, 22, y, OUTLINE)
    for pos in [(11,18),(21,18),(11,26),(21,26)]:
        px(img, pos[0], pos[1], OUTLINE)

    # Cabeza: 9×8 centrada en (16,11)
    rect(img, 12, 7, 9, 8, BODY)
    for pos in [(12,7),(20,7),(12,14),(20,14)]:
        px(img, pos[0], pos[1], TRANSP)
    # Contorno cabeza
    for x in range(13, 20):
        px(img, x, 6, OUTLINE)
        px(img, x, 15, OUTLINE)
    for y in range(7, 15):
        px(img, 11, y, OUTLINE)
        px(img, 21, y, OUTLINE)

    # Cuello corto 3px
    rect(img, 14, 15, 5, 3, BODY)
    for x in range(14, 19):
        px(img, x, 14, OUTLINE)
    px(img, 13, 15, OUTLINE)
    px(img, 13, 16, OUTLINE)
    px(img, 13, 17, OUTLINE)
    px(img, 19, 15, OUTLINE)
    px(img, 19, 16, OUTLINE)
    px(img, 19, 17, OUTLINE)

    # Orejas
    rect(img, 13, 3, 3, 5, BODY)
    for pos in [(13,3),(15,3)]:
        px(img, pos[0], pos[1], OUTLINE)
    px(img, 12, 4, OUTLINE); px(img, 12, 5, OUTLINE); px(img, 12, 6, OUTLINE)
    px(img, 16, 4, OUTLINE); px(img, 16, 5, OUTLINE); px(img, 16, 6, OUTLINE)
    px(img, 14, 2, OUTLINE)

    rect(img, 18, 3, 3, 5, BODY)
    px(img, 18, 3, OUTLINE); px(img, 20, 3, OUTLINE)
    px(img, 17, 4, OUTLINE); px(img, 17, 5, OUTLINE); px(img, 17, 6, OUTLINE)
    px(img, 21, 4, OUTLINE); px(img, 21, 5, OUTLINE); px(img, 21, 6, OUTLINE)
    px(img, 19, 2, OUTLINE)

    # Ojos grandes
    rect(img, 13, 9, 3, 3, OUTLINE)
    rect(img, 14, 10, 1, 1, WHITE)
    rect(img, 18, 9, 3, 3, OUTLINE)
    rect(img, 19, 10, 1, 1, WHITE)

    # Cachetes rosados
    px(img, 12, 12, CHEEK); px(img, 13, 13, CHEEK)
    px(img, 19, 12, CHEEK); px(img, 20, 13, CHEEK)

    # Patitas (4)
    for lx in [12, 15, 18, 21]:  # solo 4 patas
        rect(img, lx, 27, 2, 3, BODY)
        px(img, lx, 30, OUTLINE)
        px(img, lx+1, 30, OUTLINE)
        px(img, lx-1, 27, OUTLINE)
        px(img, lx+2, 27, OUTLINE)

    # Patitas delanteras (2 pares)
    for lx in [12, 19]:
        rect(img, lx, 27, 2, 3, BODY)
        px(img, lx-1, 28, OUTLINE); px(img, lx+2, 28, OUTLINE)
        px(img, lx, 30, OUTLINE); px(img, lx+1, 30, OUTLINE)

    save(img, "llama_baby.png")


# ─── LLAMA CHILD (32×32) ──────────────────────────────────────────────────────
def make_child():
    img = new_img(32, 32)
    # Cuerpo 12×8
    rect(img, 10, 19, 12, 8, BODY)
    for x in range(11, 22): px(img, x, 18, OUTLINE); px(img, x, 27, OUTLINE)
    for y in range(19, 27): px(img, 9, y, OUTLINE); px(img, 22, y, OUTLINE)

    # Cuello 4×5
    rect(img, 14, 13, 5, 6, BODY)
    for x in range(14, 19): px(img, x, 12, OUTLINE)
    for y in range(13, 19): px(img, 13, y, OUTLINE); px(img, 19, y, OUTLINE)

    # Cabeza 10×8
    rect(img, 12, 5, 10, 8, BODY)
    for x in range(13, 22): px(img, x, 4, OUTLINE); px(img, x, 13, OUTLINE)
    for y in range(5, 13): px(img, 11, y, OUTLINE); px(img, 22, y, OUTLINE)

    # Orejas puntiagudas
    for dy, w in enumerate([1,2,2,3]):
        for dx in range(w):
            px(img, 12-w+dx+1, 4-dy, BODY)
            px(img, 21+dx, 4-dy, BODY)
    # Contorno orejas
    for y in range(1, 5):
        px(img, 11, y, OUTLINE); px(img, 24, y, OUTLINE)

    # Ojos
    rect(img, 14, 7, 2, 3, OUTLINE)
    px(img, 14, 8, WHITE)
    rect(img, 19, 7, 2, 3, OUTLINE)
    px(img, 19, 8, WHITE)

    # Nariz
    px(img, 16, 11, OUTLINE); px(img, 17, 11, OUTLINE)
    px(img, 16, 12, OUTLINE); px(img, 17, 12, OUTLINE)

    # Cachetes
    px(img, 13, 10, CHEEK); px(img, 20, 10, CHEEK)

    # Patitas
    for lx in [11, 14, 17, 20]:
        rect(img, lx, 27, 2, 4, BODY)
        for pos in [(lx-1,28),(lx+2,28),(lx,31),(lx+1,31)]:
            px(img, pos[0], pos[1], OUTLINE)

    # Cola pequeña
    rect(img, 21, 21, 3, 2, BODY)
    px(img, 20, 21, OUTLINE); px(img, 24, 21, OUTLINE)
    px(img, 21, 20, OUTLINE); px(img, 22, 20, OUTLINE)

    save(img, "llama_child.png")


# ─── LLAMA TEEN (32×32) ───────────────────────────────────────────────────────
def make_teen():
    img = new_img(32, 32)
    # Cuerpo 13×9
    rect(img, 9, 20, 13, 9, BODY)
    for x in range(10, 22): px(img, x, 19, OUTLINE); px(img, x, 29, OUTLINE)
    for y in range(20, 29): px(img, 8, y, OUTLINE); px(img, 22, y, OUTLINE)

    # Cuello largo 4×8
    rect(img, 13, 11, 5, 9, BODY)
    for x in range(13, 18): px(img, x, 10, OUTLINE)
    for y in range(11, 20): px(img, 12, y, OUTLINE); px(img, 18, y, OUTLINE)

    # Cabeza 10×7
    rect(img, 12, 4, 10, 7, BODY)
    for x in range(13, 22): px(img, x, 3, OUTLINE); px(img, x, 11, OUTLINE)
    for y in range(4, 11): px(img, 11, y, OUTLINE); px(img, 22, y, OUTLINE)

    # Orejas altas
    for y, xs in [(0,[13,14]),(1,[12,13,14,15]),(2,[12,13,14,15]),(3,[12,13,14,15])]:
        for x in xs: px(img, x, y, BODY)
    for y, xs in [(0,[19,20]),(1,[19,20,21,22]),(2,[19,20,21,22]),(3,[19,20,21,22])]:
        for x in xs: px(img, x, y, BODY)
    # Contorno orejas
    for y in range(4):
        px(img, 11, y, OUTLINE); px(img, 16, y, OUTLINE)
        px(img, 18, y, OUTLINE); px(img, 23, y, OUTLINE)

    # Ojos
    rect(img, 14, 6, 2, 2, OUTLINE)
    px(img, 14, 6, WHITE)
    rect(img, 19, 6, 2, 2, OUTLINE)
    px(img, 19, 6, WHITE)

    # Nariz
    rect(img, 15, 9, 3, 2, OUTLINE)

    # Cachetes
    px(img, 13, 8, CHEEK); px(img, 21, 8, CHEEK)

    # Patitas
    for lx in [10, 13, 16, 19]:
        rect(img, lx, 29, 2, 3, BODY)
        px(img, lx-1, 30, OUTLINE); px(img, lx+2, 30, OUTLINE)
        px(img, lx, 32, OUTLINE); px(img, lx+1, 32, OUTLINE)

    # Cola
    rect(img, 21, 22, 4, 3, BODY)
    for pos in [(20,22),(25,22),(21,21),(22,21),(20,23),(25,24)]:
        px(img, pos[0], pos[1], OUTLINE)

    save(img, "llama_teen.png")


# ─── LLAMA ADULT (32×32) ──────────────────────────────────────────────────────
def make_adult():
    img = new_img(32, 32)
    # Cuerpo 14×10
    rect(img, 8, 19, 14, 10, BODY)
    for x in range(9, 22): px(img, x, 18, OUTLINE); px(img, x, 29, OUTLINE)
    for y in range(19, 29): px(img, 7, y, OUTLINE); px(img, 22, y, OUTLINE)

    # Cuello largo y estrecho 4×10
    rect(img, 13, 8, 5, 11, BODY)
    for x in range(13, 18): px(img, x, 7, OUTLINE)
    for y in range(8, 19): px(img, 12, y, OUTLINE); px(img, 18, y, OUTLINE)

    # Cabeza 10×7
    rect(img, 12, 1, 10, 7, BODY)
    for x in range(13, 22): px(img, x, 0, OUTLINE); px(img, x, 8, OUTLINE)
    for y in range(1, 8): px(img, 11, y, OUTLINE); px(img, 22, y, OUTLINE)

    # Hocico prominente
    rect(img, 14, 5, 6, 4, BODY)
    for x in range(14, 20): px(img, x, 4, OUTLINE); px(img, x, 9, OUTLINE)
    for y in range(5, 9): px(img, 13, y, OUTLINE); px(img, 20, y, OUTLINE)

    # Orejas largas características de llama
    for y in range(5):
        w = max(1, 3-y//2)
        for dx in range(w):
            px(img, 12+dx, y-5+5, BODY)
            px(img, 20+dx, y-5+5, BODY)
    # Contorno orejas
    for y in range(5):
        px(img, 11, y, OUTLINE); px(img, 15, y, OUTLINE)
        px(img, 19, y, OUTLINE); px(img, 23, y, OUTLINE)

    # Ojos expresivos
    rect(img, 13, 2, 3, 3, OUTLINE)
    px(img, 13, 2, WHITE); px(img, 14, 2, WHITE)
    rect(img, 19, 2, 3, 3, OUTLINE)
    px(img, 19, 2, WHITE); px(img, 20, 2, WHITE)

    # Fosas nasales
    px(img, 15, 7, OUTLINE); px(img, 18, 7, OUTLINE)

    # Boca / labio inferior
    for x in range(15, 19): px(img, x, 8, OUTLINE)

    # Cachetes
    px(img, 12, 4, CHEEK); px(img, 21, 4, CHEEK)

    # Patitas con pezuña
    for lx in [9, 12, 15, 18]:
        rect(img, lx, 29, 2, 3, BODY)
        px(img, lx-1, 30, OUTLINE); px(img, lx+2, 30, OUTLINE)
        # Pezuña
        rect(img, lx, 32, 2, 1, OUTLINE)

    # Cola esponjosa
    rect(img, 21, 21, 5, 4, BODY)
    for pos in [(20,21),(26,21),(20,22),(26,22),(21,20),(22,20),(23,20),(24,20),(21,25),(25,25)]:
        px(img, pos[0], pos[1], OUTLINE)
    # Textura cola
    px(img, 22, 21, WHITE); px(img, 23, 22, WHITE); px(img, 24, 21, WHITE)

    save(img, "llama_adult.png")


# ─── LLAMA ELDER (32×32) ──────────────────────────────────────────────────────
def make_elder():
    img = new_img(32, 32)
    # Cuerpo encorvado más bajo 13×9
    rect(img, 9, 21, 13, 8, BODY)
    for x in range(10, 22): px(img, x, 20, OUTLINE); px(img, x, 29, OUTLINE)
    for y in range(21, 29): px(img, 8, y, OUTLINE); px(img, 22, y, OUTLINE)

    # Cuello curvo/encorvado
    # Segmento inferior (vertical)
    rect(img, 14, 14, 4, 7, BODY)
    for y in range(14, 21): px(img, 13, y, OUTLINE); px(img, 18, y, OUTLINE)
    # Segmento superior (inclinado hacia adelante)
    rect(img, 12, 8, 4, 7, BODY)
    for y in range(8, 15): px(img, 11, y, OUTLINE); px(img, 16, y, OUTLINE)
    for x in range(12, 16): px(img, x, 7, OUTLINE)

    # Cabeza más pequeña (anciana) 9×6
    rect(img, 10, 2, 9, 6, BODY)
    for x in range(11, 19): px(img, x, 1, OUTLINE); px(img, x, 8, OUTLINE)
    for y in range(2, 8): px(img, 9, y, OUTLINE); px(img, 19, y, OUTLINE)

    # Orejas caídas (arqueadas hacia abajo)
    for y, xs in [(0,[11,12]),(1,[10,11,12]),(2,[10,11])]:
        for x in xs: px(img, x, y, BODY)
    for pos in [(9,0),(13,0),(9,1),(9,2),(13,1),(12,3)]:
        px(img, pos[0], pos[1], OUTLINE)

    for y, xs in [(0,[17,18]),(1,[17,18,19]),(2,[18,19])]:
        for x in xs: px(img, x, y, BODY)
    for pos in [(16,0),(20,0),(16,1),(20,1),(16,2),(20,2),(17,3)]:
        px(img, pos[0], pos[1], OUTLINE)

    # Cejas blancas (mechón de anciana)
    for x in range(11, 14): px(img, x, 2, WHITE)
    for x in range(16, 19): px(img, x, 2, WHITE)

    # Ojos cansados/semicerrados
    rect(img, 11, 4, 2, 2, OUTLINE)
    px(img, 11, 3, OUTLINE); px(img, 12, 3, OUTLINE)  # párpado
    rect(img, 16, 4, 2, 2, OUTLINE)
    px(img, 16, 3, OUTLINE); px(img, 17, 3, OUTLINE)

    # Arrugas
    px(img, 10, 5, OUTLINE); px(img, 9, 6, OUTLINE)  # arruga izquierda
    px(img, 19, 5, OUTLINE); px(img, 20, 6, OUTLINE)  # arruga derecha

    # Nariz
    px(img, 13, 6, OUTLINE); px(img, 15, 6, OUTLINE)

    # Bigote blanco
    for x in range(10, 13): px(img, x, 7, WHITE)
    for x in range(16, 19): px(img, x, 7, WHITE)

    # Patitas con articulaciones (más lentas, más gruesas)
    for lx in [10, 13, 16, 19]:
        rect(img, lx, 29, 2, 3, BODY)
        px(img, lx-1, 30, OUTLINE); px(img, lx+2, 30, OUTLINE)
        rect(img, lx, 32, 2, 1, OUTLINE)

    # Cola pequeña con mechón blanco
    rect(img, 21, 23, 4, 3, BODY)
    px(img, 20, 23, OUTLINE); px(img, 25, 23, OUTLINE)
    px(img, 22, 22, WHITE); px(img, 23, 22, WHITE)  # mechón blanco

    save(img, "llama_elder.png")


# ─── ICON SUN (16×16) ─────────────────────────────────────────────────────────
def make_icon_sun():
    YELLOW = (255, 200, 0)
    img = new_img(16, 16)
    # Círculo central 6×6
    for y in range(5, 11):
        for x in range(5, 11):
            if (x-7)**2 + (y-7)**2 <= 9:
                px(img, x, y, YELLOW)
    # Contorno del círculo
    for y in range(4, 12):
        for x in range(4, 12):
            if 7 <= (x-7)**2 + (y-7)**2 <= 14:
                px(img, x, y, OUTLINE)
    # 8 rayos
    rays = [(7,0),(7,1),(14,0),(15,7),(14,14),(7,15),(7,14),(0,7),(0,0),(0,14)]
    for rx, ry in [(7,0),(7,1),(14,1),(14,7),(14,13),(7,14),(1,13),(1,7),(1,1)]:
        px(img, rx, ry, YELLOW)
    # Rayos cardinales
    for i in range(2, 5): px(img, 7, i, YELLOW)
    for i in range(10, 13): px(img, 7, i, YELLOW)
    for i in range(2, 5): px(img, i, 7, YELLOW)
    for i in range(10, 13): px(img, i, 7, YELLOW)
    # Rayos diagonales
    for i in range(2, 4):
        px(img, 7-i, 7-i, YELLOW); px(img, 7+i, 7-i, YELLOW)
        px(img, 7-i, 7+i, YELLOW); px(img, 7+i, 7+i, YELLOW)
    save(img, "icon_sun.png")


# ─── ICON CLOUD (16×16) ───────────────────────────────────────────────────────
def make_icon_cloud():
    LGRAY = (180, 180, 180)
    img = new_img(16, 16)
    # Nube: 3 círculos solapados
    cloud_px = set()
    for cx, cy, r in [(5,9,4),(9,7,5),(12,10,3),(3,11,3)]:
        for y in range(cy-r, cy+r+1):
            for x in range(cx-r, cx+r+1):
                if (x-cx)**2 + (y-cy)**2 <= r*r:
                    cloud_px.add((x,y))
    for x, y in cloud_px:
        if 0 <= x < 16 and 0 <= y < 16:
            px(img, x, y, WHITE)
    # Sombra (desplazada 1px abajo-derecha)
    for x, y in cloud_px:
        nx, ny = x+1, y+1
        if 0 <= nx < 16 and 0 <= ny < 16 and (nx,ny) not in cloud_px:
            px(img, nx, ny, LGRAY)
    # Contorno
    for x, y in cloud_px:
        for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
            nx, ny = x+dx, y+dy
            if (nx,ny) not in cloud_px and 0 <= nx < 16 and 0 <= ny < 16:
                px(img, nx, ny, OUTLINE)
    save(img, "icon_cloud.png")


# ─── ICON COLD (16×16) ────────────────────────────────────────────────────────
def make_icon_cold():
    BLUE = (0, 128, 255)
    LBLUE = (150, 200, 255)
    img = new_img(16, 16)
    # Eje vertical
    for y in range(1, 15): px(img, 7, y, BLUE)
    # Eje horizontal
    for x in range(1, 15): px(img, x, 7, BLUE)
    # Ejes diagonales
    for i in range(1, 6):
        px(img, 7-i, 7-i, BLUE); px(img, 7+i, 7-i, BLUE)
        px(img, 7-i, 7+i, BLUE); px(img, 7+i, 7+i, BLUE)
    # Centro
    rect(img, 6, 6, 3, 3, BLUE)
    px(img, 7, 7, LBLUE)
    # Puntas de los ejes
    for pos in [(7,0),(7,14),(0,7),(14,7)]:
        px(img, pos[0], pos[1], LBLUE)
    # Ramitas en los ejes (a distancia 3)
    for base, d1, d2 in [((7,4),(6,3),(8,3)),((7,10),(6,11),(8,11)),
                          ((4,7),(3,6),(3,8)),((10,7),(11,6),(11,8))]:
        for p in [d1, d2]: px(img, p[0], p[1], BLUE)
    save(img, "icon_cold.png")


# ─── ICON HOT (16×16) ─────────────────────────────────────────────────────────
def make_icon_hot():
    RED   = (220,  50,   0)
    LRED  = (255, 140,  80)
    DGRAY = ( 80,  80,  80)
    img = new_img(16, 16)
    # Termómetro: tubo (rect 3×10 centrado en x=7)
    rect(img, 6, 2, 4, 10, DGRAY)
    rect(img, 7, 3, 2, 8, TRANSP)  # interior vacío
    # Mercurio (llena desde abajo)
    rect(img, 7, 6, 2, 6, RED)
    # Bulbo abajo
    for y in range(12, 16):
        for x in range(4, 12):
            if (x-7)**2 + (y-13)**2 <= 9:
                px(img, x, y, RED)
    # Contorno bulbo
    for y in range(11, 16):
        for x in range(3, 12):
            if 7 <= (x-7)**2 + (y-13)**2 <= 13:
                px(img, x, y, OUTLINE)
    # Contorno tubo
    for y in range(2, 12):
        px(img, 5, y, OUTLINE); px(img, 10, y, OUTLINE)
    for x in range(6, 10): px(img, x, 2, OUTLINE)
    # Marcas de temperatura
    for y in [5, 7, 9]: px(img, 11, y, LRED)
    save(img, "icon_hot.png")


# ─── ICON RAIN (16×16) ────────────────────────────────────────────────────────
def make_icon_rain():
    BLUE  = ( 50, 100, 220)
    LBLUE = (120, 180, 255)
    LGRAY = (160, 160, 160)
    img = new_img(16, 16)
    # Nube pequeña en la parte superior
    cloud_px = set()
    for cx, cy, r in [(4,5,3),(8,4,4),(11,5,3)]:
        for y in range(cy-r, cy+r+1):
            for x in range(cx-r, cx+r+1):
                if (x-cx)**2 + (y-cy)**2 <= r*r:
                    cloud_px.add((x,y))
    for x, y in cloud_px:
        if 0 <= x < 16 and 0 <= y < 16:
            px(img, x, y, LGRAY)
    # Contorno nube
    for x, y in cloud_px:
        for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
            nx, ny = x+dx, y+dy
            if (nx,ny) not in cloud_px and 0 <= nx < 16 and 0 <= ny < 16:
                px(img, nx, ny, OUTLINE)
    # 3 gotas de lluvia
    drops = [(4,10),(8,11),(12,10)]
    for gx, gy in drops:
        # Gota: óvalo 2×4
        rect(img, gx, gy, 2, 3, BLUE)
        px(img, gx, gy-1, BLUE)  # punta
        px(img, gx-1, gy+1, OUTLINE); px(img, gx+2, gy+1, OUTLINE)
        px(img, gx, gy+3, OUTLINE); px(img, gx+1, gy+3, OUTLINE)
        px(img, gx, gy-1, LBLUE)  # brillo
    save(img, "icon_rain.png")


if __name__ == "__main__":
    print(f"Generando sprites en {OUT_DIR}/")
    make_egg()
    make_baby()
    make_child()
    make_teen()
    make_adult()
    make_elder()
    make_icon_sun()
    make_icon_cloud()
    make_icon_cold()
    make_icon_hot()
    make_icon_rain()
    print("¡Listo! 11 sprites generados.")
