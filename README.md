# 🚢 AQUASHIELD · Label Inspect v4.0

**Auditoría automática de etiquetas de exportación** — Herramienta que cruza el RDD contra las evidencias de etiquetas para verificar el cumplimiento documental. Ahora con **OpenCV** para pre-procesamiento de imágenes y **detección de códigos de barras**.

---

## 🌐 Acceso Rápido (SIN instalar nada)

**👉 [Abrir Label Inspect](https://aquashield-team.github.io/LabelInspect/) 👈**

Solo abre el enlace en cualquier navegador. Funciona inmediatamente, sin instalar nada.

> ⚠️ La versión web funciona con OCR básico (Tesseract.js). Para OpenCV + detección de barcodes, usa el launcher local.

---

## ✨ Funcionalidades

| Feature | Web | Local |
|---|:---:|:---:|
| 📂 **Dropzone Único** — Auto-detecta maestro RDD | ✅ | ✅ |
| 🔍 **OCR** — Extrae texto de PDFs escaneados | ✅ | ✅ |
| 🧠 **Cerebro** — Mapeo SERNAP → Planta | ✅ | ✅ |
| 📊 **Historial** — Seguimiento de auditorías | ✅ | ✅ |
| ⬇️ **Excel Unificado** — RDD + Auditoría + Faltantes | ✅ | ✅ |
| ✉️ **Borrador de Correo** | ✅ | ✅ |
| 🔬 **OpenCV** — Pre-procesamiento avanzado de imágenes | ❌ | ✅ |
| 📊 **Barcode** — Lectura directa de códigos de barras | ❌ | ✅ |
| 📱 **QR** — Genera QR de verificación de auditoría | ❌ | ✅ |

---

## 🚀 Inicio Rápido

### Opción 1: Web (recomendada para el equipo)
1. Abre **https://aquashield-team.github.io/LabelInspect/**
2. Ingresa la clave de acceso
3. Arrastra archivos y audita

### Opción 2: Local con OpenCV (requiere Python)
1. Descarga el ZIP desde GitHub → "Code" → "Download ZIP"
2. Extrae la carpeta
3. Doble clic en **`Abrir Label Inspect.bat`**
4. Se abre automáticamente en `http://localhost:8085`

> El launcher detecta automáticamente si puede iniciar el modo completo (Flask + OpenCV). Si no puede (sin Python o firewall bloqueando), inicia en modo básico automáticamente.

---

## 📁 Estructura

```
LabelInspect/
├── index.html              → Interfaz principal
├── styles.css              → Estilos (dark mode, glassmorphism)
├── app.js                  → Motor de auditoría híbrido
├── lib/                    → Tesseract.js offline
│   ├── tesseract.min.js
│   ├── worker.min.js
│   ├── tesseract-core-simd.wasm.js
│   └── eng.traineddata.gz
├── server/                 → Backend Python (OpenCV + Barcode + QR)
│   ├── app.py              → Flask API
│   ├── image_processor.py  → Pipeline OpenCV (7 etapas)
│   ├── barcode_reader.py   → Detector de códigos de barras
│   ├── qr_generator.py     → Generador QR de verificación
│   └── requirements.txt    → Dependencias Python
└── Abrir Label Inspect.bat → Lanzador Windows
```

## 🛠️ Stack

**Frontend (siempre disponible):**
- HTML5 / CSS3 / JavaScript ES6+
- [SheetJS](https://sheetjs.com/) — Lectura/escritura de Excel
- [PDF.js](https://mozilla.github.io/pdf.js/) — Extracción de texto de PDFs
- [Tesseract.js](https://tesseract.projectnaptha.com/) — OCR local
- [Mammoth.js](https://github.com/mwilliamson/mammoth.js) — Extracción Word

**Backend (modo local):**
- [Flask](https://flask.palletsprojects.com/) — API REST
- [OpenCV](https://opencv.org/) — Pre-procesamiento de imágenes
- [pyzbar](https://github.com/NaturalHistoryMuseum/pyzbar) — Lectura de barcodes
- [qrcode](https://github.com/lincolnloop/python-qrcode) — Generación QR

## 📋 Cómo Usar

1. **Abre** la app (web o launcher)
2. **Arrastra** el archivo RDD (.xlsx) y las evidencias (PDF/Word/Excel) al dropzone
3. **Click** en 🚀 Ejecutar Auditoría (o `Ctrl+Enter`)
4. **Revisa** los resultados: métricas, desglose por planta, tabla de faltantes
5. **Descarga** el Excel unificado con el botón ⬇️

### 🧠 Cerebro (opcional)
- Click en `🧠 Cerebro` para agregar asociaciones SERNAP → Nombre correcto de planta
- Los datos persisten en el navegador (localStorage)
- Usa **Exportar/Importar** para respaldo y compartir configuración entre equipos

## 🔒 Privacidad

- **100% local** — No envía datos a internet
- Todos los archivos se procesan en el navegador del usuario
- El OCR se ejecuta usando WebAssembly, no servicios cloud
- El backend OpenCV (si se usa) corre en localhost

---

**AQUASHIELD** · Equipo de Comercio Exterior · Aquachile
