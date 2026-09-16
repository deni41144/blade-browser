#!/usr/bin/env python3
"""
Генератор шрифта BladeBlood (OFL база Unbounded 800) с впаянными кровавыми каплями.
Создаёт три варианта (A — короткие, B — средние, C — длинные) и превью preview-ABC.png.
"""
import os
import shutil
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset
from fontTools.pens.ttGlyphPen import TTGlyphPen
from PIL import Image, ImageDraw, ImageFont

SRC_FONT = r"F:\firefox michael edition\FirefoxPortable\Data\profile\chrome\fonts\Unbounded[wght].ttf"
OUT_DIR = r"F:\firefox michael edition\TestReports\blood-font-preview"
CHROME_FONTS_DIR = r"F:\firefox michael edition\FirefoxPortable\Data\profile\chrome\fonts"

# Геометрия капель для каждого глифа: (xc, length_base, neck_w, waist_w, bulb_r, has_detached_dot)
DRIP_SPECS = {
    'zero': [
        (340, 160, 48, 24, 28, False),
        (595, 175, 48, 26, 30, False),
    ],
    'one': [
        (352, 240, 56, 28, 36, True),
    ],
    'two': [
        (180, 165, 46, 24, 28, False),
        (620, 190, 50, 26, 32, False),
    ],
    'three': [
        (430, 210, 52, 26, 34, False),
        (640, 145, 42, 22, 26, False),
    ],
    'four': [
        (617, 235, 54, 28, 36, False),
        (280, 150, 44, 22, 26, False),
    ],
    'five': [
        (415, 210, 52, 26, 34, False),
        (620, 150, 44, 22, 26, False),
    ],
    'six': [
        (460, 215, 52, 26, 34, False),
        (240, 160, 44, 22, 28, False),
    ],
    'seven': [
        (250, 245, 50, 24, 34, True),
    ],
    'eight': [
        (270, 170, 46, 24, 28, False),
        (640, 180, 48, 26, 30, False),
    ],
    'nine': [
        (360, 220, 52, 26, 34, False),
        (580, 140, 42, 20, 24, False),
    ],
    'colon': [
        (170, 120, 36, 18, 22, False),
    ],
}

def draw_drip_contour(pen, xc, y_top, length, neck_w, waist_w, bulb_r):
    """Рисует замкнутый контур органической стекающей капли по часовой стрелке."""
    y_bottom = y_top - length
    y_bulb = y_bottom + bulb_r
    y_waist = y_top - length * 0.42

    pen.moveTo((xc - neck_w / 2, y_top))
    pen.lineTo((xc + neck_w / 2, y_top))
    # Правая сторона: сужение к талии
    pen.qCurveTo(((xc + neck_w / 2 + xc + waist_w / 2) / 2, (y_top + y_waist) / 2), (xc + waist_w / 2, y_waist))
    # Правая сторона: расширение к округлой бульбе
    pen.qCurveTo((xc + waist_w / 2, y_bulb + bulb_r * 0.7), (xc + bulb_r, y_bulb))
    # Дно капли: плавное тяжёлое закругление
    pen.qCurveTo((xc + bulb_r, y_bottom + bulb_r * 0.15), (xc, y_bottom))
    pen.qCurveTo((xc - bulb_r, y_bottom + bulb_r * 0.15), (xc - bulb_r, y_bulb))
    # Левая сторона: сужение обратно к талии
    pen.qCurveTo((xc - waist_w / 2, y_bulb + bulb_r * 0.7), (xc - waist_w / 2, y_waist))
    # Левая сторона: подъём к основанию
    pen.qCurveTo(((xc - neck_w / 2 + xc - waist_w / 2) / 2, (y_top + y_waist) / 2), (xc - neck_w / 2, y_top))
    pen.closePath()

def draw_dot_contour(pen, xc, yc, r):
    """Рисует маленькую отделившуюся круглую каплю-точку под длинным потёком."""
    pen.moveTo((xc - r, yc))
    pen.qCurveTo((xc - r, yc + r), (xc, yc + r))
    pen.qCurveTo((xc + r, yc + r), (xc + r, yc))
    pen.qCurveTo((xc + r, yc - r), (xc, yc - r))
    pen.qCurveTo((xc - r, yc - r), (xc - r, yc))
    pen.closePath()

def build_variant(scale_factor, variant_name):
    """Создаёт инстанс шрифта с заданным масштабом длины капель."""
    font = TTFont(SRC_FONT)
    static_font = instancer.instantiateVariableFont(font, {"wght": 800})
    
    # Сабсет только под нужные глифы
    sub_opts = subset.Options()
    subsetter = subset.Subsetter(options=sub_opts)
    subsetter.populate(text="0123456789:- ")
    subsetter.subset(static_font)
    
    glyf = static_font["glyf"]
    cmap = static_font.getBestCmap()
    
    lowest_y = -17
    
    for ch, drips in DRIP_SPECS.items():
        gname = cmap.get(ord(':') if ch == 'colon' else ord(ch[0] if ch in '0123456789' else {'zero':'0','one':'1','two':'2','three':'3','four':'4','five':'5','six':'6','seven':'7','eight':'8','nine':'9'}[ch]))
        if not gname or gname not in glyf:
            continue
        g = glyf[gname]
        g.expand(glyf)
        
        pen = TTGlyphPen(None)
        for xc, length_base, neck_w, waist_w, bulb_r, has_dot in drips:
            actual_len = length_base * scale_factor
            actual_neck = neck_w * (0.85 + 0.15 * scale_factor)
            actual_waist = waist_w * (0.85 + 0.15 * scale_factor)
            actual_bulb = bulb_r * (0.85 + 0.15 * scale_factor)
            y_top = 12 # лёгкий нахлёст внутрь глифа
            
            draw_drip_contour(pen, xc, y_top, actual_len, actual_neck, actual_waist, actual_bulb)
            lowest_y = min(lowest_y, y_top - actual_len)
            
            if has_dot:
                dot_y = y_top - actual_len - 38 * scale_factor
                dot_r = 12 * scale_factor
                draw_dot_contour(pen, xc, dot_y, dot_r)
                lowest_y = min(lowest_y, dot_y - dot_r)
        
        drop_glyph = pen.glyph()
        if drop_glyph.numberOfContours > 0:
            offset = len(g.coordinates)
            g.coordinates.extend(drop_glyph.coordinates)
            g.flags.extend(drop_glyph.flags)
            for ep in drop_glyph.endPtsOfContours:
                g.endPtsOfContours.append(ep + offset)
            g.numberOfContours += drop_glyph.numberOfContours
            g.recalcBounds(glyf)
    
    # Расширяем descender метрики, чтобы ОС и движок не резали свисающие капли
    safe_descent = int(min(-350, lowest_y - 40))
    static_font["OS/2"].sTypoDescender = safe_descent
    static_font["hhea"].descent = safe_descent
    static_font["OS/2"].usWinDescent = abs(safe_descent) + 20
    static_font["head"].yMin = min(static_font["head"].yMin, safe_descent)
    
    # Имя шрифта
    name_table = static_font["name"]
    full_name = f"BladeBlood {variant_name}"
    ps_name = f"BladeBlood-{variant_name}"
    for record in name_table.names:
        if record.nameID == 1:  # Family
            record.string = "BladeBlood"
        elif record.nameID == 4: # Full Name
            record.string = full_name
        elif record.nameID == 6: # PostScript Name
            record.string = ps_name
            
    out_path = os.path.join(OUT_DIR, f"BladeBlood-{variant_name}.ttf")
    static_font.save(out_path)
    print(f"[{variant_name}] Сохранён: {out_path} (lowest_y={lowest_y}, safe_descent={safe_descent})")
    return out_path

def generate_preview(font_paths):
    """Генерирует сравнительный PNG-файл для визуального ревью владельцем."""
    img_w = 1600
    row_h = 360
    total_h = row_h * len(font_paths) + 120
    img = Image.new("RGBA", (img_w, total_h), (10, 10, 12, 255))
    draw = ImageDraw.Draw(img)
    
    # Системный шрифт для подписей (фолбэк arial или default)
    try:
        lbl_font = ImageFont.truetype("arial.ttf", 26)
        desc_font = ImageFont.truetype("arial.ttf", 18)
    except Exception:
        lbl_font = ImageFont.load_default()
        desc_font = ImageFont.load_default()
        
    y_offset = 50
    descriptions = {
        "A": "ВАРИАНТ A: Короткие и деликатные капли (аккуратный horror-потёк, 80-160 units)",
        "B": "ВАРИАНТ B [ДЕФОЛТ]: Сбалансированные средние капли (выразительные капли-сосульки, 140-250 units)",
        "C": "ВАРИАНТ C: Длинные драматичные капли (густая стекающая кровь, 200-350 units)"
    }
    
    for var_key in ["A", "B", "C"]:
        fpath = font_paths[var_key]
        font_digits = ImageFont.truetype(fpath, 105)
        font_clock = ImageFont.truetype(fpath, 145)
        
        # Подпись варианта
        draw.text((60, y_offset), descriptions[var_key], fill=(220, 220, 230, 255), font=lbl_font)
        
        # Ряд 1: цифры 0123456789
        blood_color = (168, 15, 15, 255)
        draw.text((60, y_offset + 45), "0 1 2 3 4 5 6 7 8 9", fill=blood_color, font=font_digits)
        
        # Ряд 2: часы 23:47
        draw.text((1050, y_offset + 30), "23:47", fill=blood_color, font=font_clock)
        
        # Разделительная линия
        draw.line([(40, y_offset + row_h - 20), (img_w - 40, y_offset + row_h - 20)], fill=(40, 40, 50, 255), width=1)
        
        y_offset += row_h

    preview_path = os.path.join(OUT_DIR, "preview-ABC.png")
    img.save(preview_path)
    print(f"Превью сохранено: {preview_path}")
    return preview_path

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(CHROME_FONTS_DIR, exist_ok=True)
    
    paths = {
        "A": build_variant(0.65, "A"),
        "B": build_variant(1.0, "B"),
        "C": build_variant(1.45, "C"),
    }
    
    # Копируем вариант B как дефолтный BladeBlood-Regular.ttf в chrome/fonts/
    default_target = os.path.join(CHROME_FONTS_DIR, "BladeBlood-Regular.ttf")
    shutil.copyfile(paths["B"], default_target)
    print(f"Дефолтный вариант B скопирован в: {default_target}")
    
    generate_preview(paths)

if __name__ == "__main__":
    main()
