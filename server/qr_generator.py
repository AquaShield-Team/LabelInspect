"""
QR Generator — Sello de verificación de auditoría
Genera código QR con resumen de auditoría para verificación rápida
"""
import qrcode
import io
import hashlib
import json
from datetime import datetime


def generate_audit_qr(audit_data):
    """
    Genera un código QR con el resumen de la auditoría.
    
    audit_data debe contener:
        - pedido: str
        - total: int
        - ok: int
        - faltantes: int
        - pct: int
        
    Retorna: bytes de imagen PNG del QR
    """
    now = datetime.now()

    payload = {
        'app': 'AQUASHIELD-LabelInspect',
        'v': '4.0',
        'pedido': str(audit_data.get('pedido', 'N/A')),
        'fecha': now.strftime('%Y-%m-%d %H:%M'),
        'total': int(audit_data.get('total', 0)),
        'ok': int(audit_data.get('ok', 0)),
        'falt': int(audit_data.get('faltantes', 0)),
        'pct': int(audit_data.get('pct', 0)),
    }

    # Hash de integridad (para verificar que el QR no fue alterado)
    raw = json.dumps(payload, sort_keys=True)
    payload['hash'] = hashlib.sha256(raw.encode()).hexdigest()[:12]

    # Texto legible para el QR
    qr_text = (
        f"AQUASHIELD · Label Inspect\n"
        f"Pedido: {payload['pedido']}\n"
        f"Fecha: {payload['fecha']}\n"
        f"Lotes: {payload['total']} total\n"
        f"Verificados: {payload['ok']} ✅\n"
        f"Faltantes: {payload['falt']} {'🔴' if payload['falt'] > 0 else ''}\n"
        f"Cumplimiento: {payload['pct']}%\n"
        f"Hash: {payload['hash']}"
    )

    # Generar QR
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=3,
    )
    qr.add_data(qr_text)
    qr.make(fit=True)

    # Colores AQUASHIELD
    qr_img = qr.make_image(fill_color='#0a1628', back_color='#e0f0ff')

    # Convertir a bytes
    buf = io.BytesIO()
    qr_img.save(buf, format='PNG')
    buf.seek(0)
    return buf.read()
