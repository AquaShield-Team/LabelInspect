"""
Barcode Reader — Detección y decodificación de códigos de barras
Soporta: Code128, EAN-13, EAN-8, QR Code, Code39, ITF, etc.
"""
import cv2
import numpy as np


def read_barcodes_from_image(image_bytes):
    """
    Detecta y decodifica códigos de barras en la imagen.
    Usa pyzbar si está disponible, sino intenta con OpenCV.
    
    Retorna: lista de dicts con data, type, rect
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return []

    results = []

    # Intento 1: pyzbar (más preciso, soporta más formatos)
    try:
        from pyzbar import pyzbar
        barcodes = pyzbar.decode(img)
        for bc in barcodes:
            results.append({
                'data': bc.data.decode('utf-8', errors='replace'),
                'type': bc.type,
                'rect': {
                    'x': bc.rect.left, 'y': bc.rect.top,
                    'w': bc.rect.width, 'h': bc.rect.height
                },
                'source': 'pyzbar'
            })
        if results:
            return results
    except ImportError:
        pass  # pyzbar no instalado, usar fallback

    # Intento 2: OpenCV BarcodeDetector (disponible desde OpenCV 4.8+)
    try:
        detector = cv2.barcode.BarcodeDetector()
        retval, decoded_info, decoded_type, points = detector.detectAndDecode(img)
        if retval and decoded_info:
            for i, info in enumerate(decoded_info):
                if info:
                    results.append({
                        'data': info,
                        'type': decoded_type[i] if decoded_type else 'UNKNOWN',
                        'rect': _points_to_rect(points[i]) if points is not None else {},
                        'source': 'opencv'
                    })
    except (AttributeError, cv2.error):
        pass  # OpenCV barcode module no disponible

    # Intento 3: Probar con imagen procesada (escala de grises + contraste)
    if not results:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        # Convertir a color para pyzbar
        enhanced_color = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)

        try:
            from pyzbar import pyzbar
            barcodes = pyzbar.decode(enhanced_color)
            for bc in barcodes:
                results.append({
                    'data': bc.data.decode('utf-8', errors='replace'),
                    'type': bc.type,
                    'rect': {
                        'x': bc.rect.left, 'y': bc.rect.top,
                        'w': bc.rect.width, 'h': bc.rect.height
                    },
                    'source': 'pyzbar-enhanced'
                })
        except ImportError:
            pass

    return results


def _points_to_rect(points):
    """Convierte array de 4 puntos a rect {x, y, w, h}"""
    if points is None or len(points) < 4:
        return {}
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return {
        'x': int(min(xs)), 'y': int(min(ys)),
        'w': int(max(xs) - min(xs)), 'h': int(max(ys) - min(ys))
    }
