"""
OpenCV Image Processor — Pre-procesamiento de etiquetas escaneadas
Pipeline: Escala → Grises → Deskew → Denoise → Binarización → Sharpen
"""
import cv2
import numpy as np
import math


def preprocess_label_image(image_bytes):
    """
    Pipeline completo de pre-procesamiento para mejorar la lectura OCR.
    Recibe: bytes de imagen (PNG/JPEG)
    Retorna: bytes de imagen procesada (PNG)
    """
    # Decodificar imagen
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("No se pudo decodificar la imagen")

    # 1. Escalar si es muy pequeña (mejora OCR)
    h, w = img.shape[:2]
    if max(h, w) < 1500:
        scale = 2.0
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # 2. Escala de grises
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 3. Deskew — corregir inclinación
    gray = _deskew(gray)

    # 4. Denoising — eliminar ruido
    gray = cv2.fastNlMeansDenoising(gray, h=12, templateWindowSize=7, searchWindowSize=21)

    # 5. Mejora de contraste (CLAHE)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    # 6. Binarización adaptativa
    binary = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31, 10
    )

    # 7. Operaciones morfológicas — cerrar huecos en letras
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    # Codificar resultado
    _, encoded = cv2.imencode('.png', binary)
    return encoded.tobytes()


def _deskew(image):
    """Corrige la inclinación del texto en la imagen"""
    # Detectar ángulo con Hough Lines
    edges = cv2.Canny(image, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100,
                            minLineLength=100, maxLineGap=10)

    if lines is None or len(lines) < 5:
        return image

    # Calcular ángulo promedio
    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
        # Solo considerar ángulos cercanos a horizontal
        if abs(angle) < 15:
            angles.append(angle)

    if not angles:
        return image

    median_angle = np.median(angles)

    # Solo corregir si la desviación es significativa
    if abs(median_angle) < 0.5:
        return image

    # Rotar
    h, w = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    rotated = cv2.warpAffine(image, M, (w, h),
                              flags=cv2.INTER_CUBIC,
                              borderMode=cv2.BORDER_REPLICATE)
    return rotated


def extract_text_ocr(image_bytes):
    """
    Intenta OCR con pytesseract si está disponible.
    Si no está instalado, retorna cadena vacía (el frontend usa su propio OCR).
    """
    try:
        import pytesseract
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        text = pytesseract.image_to_string(img, lang='eng',
                                            config='--psm 6 --oem 3')
        return text
    except ImportError:
        # pytesseract no instalado — frontend usará Tesseract.js
        return ''
    except Exception:
        return ''
