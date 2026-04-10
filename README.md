# 🚢 AQUASHIELD · Label Inspect v3.1

**Auditoría automática de etiquetas de exportación** — Herramienta offline que cruza el RDD (Requerimiento de Datos para Despacho) contra las evidencias de etiquetas para verificar el cumplimiento documental.

---

## ✨ Funcionalidades

| Feature | Descripción |
|---|---|
| 📂 **Dropzone Único** | Arrastra todos los archivos (RDD + evidencias). El sistema auto-detecta el maestro |
| 🔍 **Motor OCR** | Extrae texto de PDFs nativos y escaneados usando Tesseract.js (100% offline) |
| 🧠 **Cerebro** | Mapeo persistente SERNAP → Planta correcta. Corrige automáticamente el RDD |
| 📊 **Historial** | Guarda un resumen de cada auditoría para seguimiento de tendencias |
| ⚠️ **Validación de Fechas** | Compara fecha del RDD vs etiqueta, marca discrepancias |
| 📄 **Desglose por Evidencia** | Muestra cuántos lotes encontró cada archivo |
| ⬇️ **Excel Unificado** | Un solo archivo con 3 hojas: RDD Corregido, Auditoría Completa, Faltantes |
| ✉️ **Borrador de Correo** | Genera email profesional con el resumen de la auditoría |
| 🖨️ **Vista de Impresión** | CSS optimizado para imprimir directamente desde el navegador |
| ⌨️ **Atajos** | `Ctrl+Enter` = Auditar · `Esc` = Cerrar modales |

## 🚀 Inicio Rápido

### Opción 1: Doble clic (Windows)
```
Abrir Label Inspect.bat
```
Esto inicia un servidor local en `http://localhost:8085` y abre la app automáticamente.

### Opción 2: Cualquier servidor HTTP local
```bash
# Python
python -m http.server 8085

# VS Code
# Instalar extensión "Live Server" → click derecho en index.html → Open with Live Server
```

> ⚠️ **Importante**: La app necesita un servidor HTTP local para que el OCR (Tesseract.js) funcione. No abrir `index.html` directamente como archivo.

## 📁 Estructura

```
LabelInspect/
├── index.html          → Interfaz principal
├── styles.css          → Estilos (dark mode, glassmorphism)
├── app.js              → Motor de auditoría (937 líneas)
├── lib/                → Tesseract.js offline
│   ├── tesseract.min.js
│   ├── worker.min.js
│   ├── tesseract-core-simd.wasm.js
│   └── eng.traineddata.gz
└── Abrir Label Inspect.bat  → Lanzador Windows
```

## 🛠️ Stack

- **HTML5 / CSS3 / JavaScript ES6+** — Zero dependencies, zero build step
- **[SheetJS](https://sheetjs.com/)** — Lectura/escritura de Excel
- **[PDF.js](https://mozilla.github.io/pdf.js/)** — Extracción de texto nativo de PDFs
- **[Tesseract.js](https://tesseract.projectnaptha.com/)** — OCR local offline
- **[Mammoth.js](https://github.com/mwilliamson/mammoth.js)** — Extracción de texto Word
- **localStorage** — Persistencia del Cerebro e Historial

## 📋 Cómo Usar

1. **Ejecuta** `Abrir Label Inspect.bat`
2. **Arrastra** el archivo RDD (.xlsx) y las evidencias (PDF/Word/Excel) al dropzone
3. **Click** en 🚀 Ejecutar Auditoría (o `Ctrl+Enter`)
4. **Revisa** los resultados: métricas, desglose por planta, tabla de faltantes
5. **Descarga** el Excel unificado con el botón ⬇️

### 🧠 Cerebro (opcional)
- Click en `🧠 Cerebro` para agregar asociaciones SERNAP → Nombre correcto de planta
- Los datos persisten en el navegador (localStorage)
- Usa **Exportar/Importar** para respaldo y compartir configuración entre equipos

## 📸 Preview

La interfaz usa un diseño dark mode con glassmorphism, métricas animadas e indicadores por color:
- **🟢 Verde** = Verificado
- **🔴 Rojo** = Faltante (con animación de pulso)
- **🟡 Amarillo** = Advertencia de fecha

## 🔒 Privacidad

- **100% offline** — No envía datos a internet
- Todos los archivos se procesan localmente en el navegador
- El OCR se ejecuta usando WebAssembly, no servicios cloud

---

**AQUASHIELD** · Equipo de Comercio Exterior · Aquachile
