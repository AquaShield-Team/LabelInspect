// ===============================================================
// 0. LOGIN GATE — Acceso con clave compartida
// ===============================================================

const ACCESS_HASH = '6b5d1e4a7c8f2e3d9a0b4c5f8e7d6c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7';

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + '_aquashield_salt_2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Pre-compute the correct hash on first load
let CORRECT_HASH = '';
(async () => {
    CORRECT_HASH = await hashPassword('aquashield2026');
})();

// Check if already authenticated
if (localStorage.getItem('aquashield_auth') === 'true') {
    document.getElementById('login-gate').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
}

document.getElementById('login-btn').addEventListener('click', async () => {
    const pwd = document.getElementById('login-password').value;
    const hash = await hashPassword(pwd);
    if (hash === CORRECT_HASH) {
        localStorage.setItem('aquashield_auth', 'true');
        document.getElementById('login-gate').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
    } else {
        document.getElementById('login-error').style.display = 'block';
        document.getElementById('login-password').value = '';
        document.getElementById('login-password').focus();
    }
});

document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
});

/**
 * AQUASHIELD · Label Inspect v4.0
 * Motor de auditoría híbrido: client-side + backend OpenCV/Barcode
 * Dropzone único · Cerebro SERNAP→Planta · Historial · OpenCV · Barcode · QR
 */

pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── Backend Detection ─────────────────────────────────────────────────────────
let backendAvailable = false;
let backendCapabilities = [];

async function detectBackend() {
    try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
            const data = await res.json();
            backendAvailable = true;
            backendCapabilities = data.capabilities || [];
            console.log(`[BACKEND] ✅ v${data.version} — OpenCV ${data.opencv}`);
            const badge = document.getElementById('backend-badge');
            if (badge) { badge.style.display = 'inline-flex'; badge.title = `OpenCV ${data.opencv}`; }
            const qrBtn = document.getElementById('btn-qr');
            if (qrBtn) qrBtn.style.display = 'inline-flex';
        }
    } catch (e) {
        backendAvailable = false;
        console.log('[BACKEND] ⚠️ No disponible — modo standalone (Tesseract.js)');
    }
}
detectBackend();

// ── State ─────────────────────────────────────────────────────────────────────
let rddFile = null;
let evidenciaFiles = [];
let auditResults = [];
let rddLotes = [];
let originalWorkbook = null;   // para RDD corregido
let bestSheetName = '';
let bestSkipRows = 0;
let rddHeaders = [];
let rddDataRows = [];
let colIdxMap = {};

// ── Cerebro (localStorage) ────────────────────────────────────────────────────
function getCerebro() {
    try { return JSON.parse(localStorage.getItem('aquashield_cerebro') || '{}'); }
    catch { return {}; }
}
function saveCerebro(data) {
    localStorage.setItem('aquashield_cerebro', JSON.stringify(data));
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const dropAll         = document.getElementById('dropzone-all');
const inputAll        = document.getElementById('input-all');
const allFilenamesEl  = document.getElementById('all-filenames');
const btnAuditar      = document.getElementById('btn-auditar');
const progressCont    = document.getElementById('progress-container');
const progressLabel   = document.getElementById('progress-label');
const progressFill    = document.getElementById('progress-fill');
const resultsSection  = document.getElementById('results-section');

// ── Dropzone único ────────────────────────────────────────────────────────────
['dragenter', 'dragover'].forEach(e =>
    dropAll.addEventListener(e, ev => { ev.preventDefault(); dropAll.classList.add('drag-over'); }));
['dragleave', 'drop'].forEach(e =>
    dropAll.addEventListener(e, ev => { ev.preventDefault(); dropAll.classList.remove('drag-over'); }));

dropAll.addEventListener('drop', ev => classifyFiles(ev.dataTransfer.files));
dropAll.addEventListener('click', () => inputAll.click());
inputAll.addEventListener('change', () => classifyFiles(inputAll.files));

function classifyFiles(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;

    // Classify: RDD = first Excel that looks like RDD, rest = evidencias
    rddFile = null;
    evidenciaFiles = [];

    for (const f of files) {
        const name = f.name.toLowerCase();
        const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv');
        const isRDD = isExcel && (name.includes('rdd') || name.includes('pkl') || name.includes('pedido'));

        if (!rddFile && isRDD) {
            rddFile = f;
        } else if (!rddFile && isExcel && !name.includes('etiq')) {
            // If no explicit RDD, first Excel that isn't clearly an etiqueta
            rddFile = f;
        } else {
            evidenciaFiles.push(f);
        }
    }

    // If still no RDD and we have excels, take the first one
    if (!rddFile) {
        const excelIdx = files.findIndex(f => {
            const n = f.name.toLowerCase();
            return n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.csv');
        });
        if (excelIdx >= 0) {
            rddFile = files[excelIdx];
            evidenciaFiles = files.filter((_, i) => i !== excelIdx);
        }
    }

    // Render summary
    let summary = '';
    if (rddFile) {
        summary += `📋 RDD: <strong>${rddFile.name}</strong><br>`;
    }
    if (evidenciaFiles.length > 0) {
        const evNames = evidenciaFiles.map(f => f.name);
        if (evNames.length <= 3) {
            summary += evNames.map(n => `📦 ${n}`).join('<br>');
        } else {
            summary += evNames.slice(0, 2).map(n => `📦 ${n}`).join('<br>');
            summary += `<br><span style="color:var(--text-muted)">+ ${evNames.length - 2} más…</span>`;
        }
    }
    allFilenamesEl.innerHTML = summary;
    dropAll.classList.add('file-loaded');
    btnAuditar.disabled = !rddFile;
}

// ── Mode Tabs ─────────────────────────────────────────────────────────────────
document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const mode = tab.dataset.mode;
        document.getElementById('upload-section').style.display = mode === 'audit' ? '' : 'none';
        document.getElementById('rdd-section').style.display = mode === 'rdd' ? '' : 'none';
        document.getElementById('results-section').style.display = 'none';
    });
});

// ── RDD-only Dropzone ─────────────────────────────────────────────────────────
let rddOnlyFile = null;
const dropRdd = document.getElementById('dropzone-rdd');
const inputRdd = document.getElementById('input-rdd');
const rddFilenameEl = document.getElementById('rdd-filename');
const btnCorregir = document.getElementById('btn-corregir');

['dragenter', 'dragover'].forEach(e =>
    dropRdd.addEventListener(e, ev => { ev.preventDefault(); dropRdd.classList.add('drag-over'); }));
['dragleave', 'drop'].forEach(e =>
    dropRdd.addEventListener(e, ev => { ev.preventDefault(); dropRdd.classList.remove('drag-over'); }));

dropRdd.addEventListener('drop', ev => handleRddOnly(ev.dataTransfer.files));
dropRdd.addEventListener('click', () => inputRdd.click());
inputRdd.addEventListener('change', () => handleRddOnly(inputRdd.files));

function handleRddOnly(fileList) {
    const files = Array.from(fileList);
    const excel = files.find(f => {
        const n = f.name.toLowerCase();
        return n.endsWith('.xlsx') || n.endsWith('.xls');
    });
    if (!excel) return;
    rddOnlyFile = excel;
    rddFilenameEl.innerHTML = '<strong>' + excel.name + '</strong>';
    dropRdd.classList.add('file-loaded');
    btnCorregir.disabled = false;
}

btnCorregir.addEventListener('click', async () => {
    if (!rddOnlyFile) return;
    progressCont.style.display = 'block';
    setProgress('Leyendo RDD...', 20);
    try {
        const data = await readFileAsArrayBuffer(rddOnlyFile);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const cerebro = getCerebro();
        const pedido = (rddOnlyFile.name.match(/\d{6,}/) || ['RDD'])[0];
        
        setProgress('Aplicando correcciones del Cerebro...', 50);
        const wb = XLSX.utils.book_new();

        // Hoja 1: Tabla resumen
        const tablaSheet = buildTablaFromWorkbook(workbook, cerebro);
        XLSX.utils.book_append_sheet(wb, tablaSheet, 'Tabla');

        // Hoja 2: RDD Corregido (Sheet1 / hoja con mas datos)
        let dataSheetName = workbook.SheetNames.find(n => n.toLowerCase() !== 'hoja1') || workbook.SheetNames[0];
        const wsCopy = workbook.Sheets[dataSheetName];
        const allRows = XLSX.utils.sheet_to_json(wsCopy, { header: 1, defval: null, raw: false });
        
        // Find planta/sernap columns in data sheet
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(10, allRows.length); i++) {
            const row = allRows[i];
            if (row && row.some(c => String(c || '').toLowerCase().includes('planta'))) { headerRowIdx = i; break; }
        }
        const headers = allRows[headerRowIdx] ? allRows[headerRowIdx].map(h => String(h || '').trim().toLowerCase()) : [];
        const pIdx = headers.findIndex(h => h.includes('planta') || h.includes('centro'));
        const sIdx = headers.findIndex(h => h.includes('sernap'));
        
        if (pIdx >= 0 && sIdx >= 0 && Object.keys(cerebro).length > 0) {
            let lastS = '';
            for (let i = headerRowIdx + 1; i < allRows.length; i++) {
                const row = allRows[i];
                if (!row) continue;
                const rawS = row[sIdx];
                if (rawS != null && String(rawS).trim()) lastS = String(rawS).replace(/\.0+$/, '').trim();
                if (lastS && cerebro[lastS]) row[pIdx] = cerebro[lastS];
            }
        }
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(allRows), 'RDD Corregido');

        setProgress('Generando Excel...', 90);
        XLSX.writeFile(wb, 'RDD_Corregido_' + pedido + '.xlsx');
        setProgress('¡Descarga lista!', 100);
        setTimeout(() => { progressCont.style.display = 'none'; }, 1500);
    } catch (err) {
        console.error(err);
        setProgress('Error: ' + err.message, 0);
    }
});


// ── Main trigger ──────────────────────────────────────────────────────────────
btnAuditar.addEventListener('click', async () => {
    if (!rddFile) return;
    resultsSection.style.display = 'none';
    progressCont.style.display = 'block';
    setProgress('Leyendo archivo RDD…', 10);

    try {
        rddLotes = await procesarRDD(rddFile);
        setProgress(`${rddLotes.length} lotes encontrados. Procesando evidencias…`, 30);

        let etiquetas = [];
        if (evidenciaFiles.length > 0) {
            etiquetas = await extraerEtiquetas(evidenciaFiles, rddLotes);
        }
        setProgress('Cruzando datos…', 85);

        auditResults = cruzarDatos(rddLotes, etiquetas);
        setProgress('Renderizando…', 95);

        renderResults(auditResults);
        saveToHistorial(auditResults);
        setProgress('¡Listo!', 100);
        setTimeout(() => { progressCont.style.display = 'none'; }, 600);

        document.getElementById('btn-nueva').style.display = 'inline-flex';
        document.getElementById('upload-section').style.display = 'none';
    } catch (err) {
        progressLabel.textContent = `❌ Error: ${err.message}`;
        progressFill.style.width = '100%';
        progressFill.style.background = 'var(--red)';
        console.error(err);
    }
});

// ── Nueva Auditoría ───────────────────────────────────────────────────────────
document.getElementById('btn-nueva').addEventListener('click', () => {
    rddFile = null; evidenciaFiles = []; auditResults = []; rddLotes = [];
    originalWorkbook = null;
    allFilenamesEl.innerHTML = '';
    dropAll.classList.remove('file-loaded');
    inputAll.value = '';
    btnAuditar.disabled = true;
    resultsSection.style.display = 'none';
    progressCont.style.display = 'none';
    progressFill.style.width = '0%';
    progressFill.style.background = '';
    document.getElementById('upload-section').style.display = 'block';
    document.getElementById('btn-nueva').style.display = 'none';
});

function setProgress(label, pct) {
    progressLabel.textContent = label;
    progressFill.style.width = pct + '%';
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. PROCESADOR RDD
// ═════════════════════════════════════════════════════════════════════════════

const SCORE_KEYWORDS = [
    'l.productivo/tracecode', 'tracecode', 'trace', 'l.productivo', 'productivo',
    'lote', 'fecha de proceso', 'fecha proceso', 'fecha', 'planta elaboradora',
    'planta', 'sernap', 'descripci', 'description', 'fecha caducidad', 'caducidad'
];

function scoreColumns(headers) {
    const joined = headers.map(h => String(h).toLowerCase()).join(' ');
    return SCORE_KEYWORDS.reduce((s, kw) => s + (joined.includes(kw) ? 1 : 0), 0);
}

function detectColumn(headers, keywords) {
    for (const kw of keywords) {
        for (const h of headers) {
            if (String(h).trim().toLowerCase() === kw.toLowerCase()) return h;
        }
    }
    for (const kw of keywords) {
        for (const h of headers) {
            if (String(h).trim().toLowerCase().includes(kw.toLowerCase())) return h;
        }
    }
    return null;
}

async function procesarRDD(file) {
    const data = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    originalWorkbook = workbook; // guardar para RDD corregido

    let bestScore = -1;
    for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName];
        const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
        for (let skip = 0; skip < Math.min(10, allRows.length); skip++) {
            const headerRow = allRows[skip];
            if (!headerRow || headerRow.length < 2) continue;
            const hdrs = headerRow.map(h => String(h ?? '').trim());
            const score = scoreColumns(hdrs);
            if (score > bestScore) { bestScore = score; bestSheetName = sheetName; bestSkipRows = skip; }
        }
    }

    if (bestScore === 0) throw new Error('No se encontró fila de encabezado válida en el RDD.');
    console.log(`[RDD] sheet="${bestSheetName}" skip=${bestSkipRows} score=${bestScore}`);

    const ws = workbook.Sheets[bestSheetName];
    const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
    rddHeaders = allRows[bestSkipRows].map(h => String(h ?? '').trim());
    rddDataRows = allRows.slice(bestSkipRows + 1);

    const colPlanta    = detectColumn(rddHeaders, ['planta elaboradora', 'elaboradora', 'planta', 'centro', 'nombre 2']);
    const colSernap    = detectColumn(rddHeaders, ['sernap planta', 'sernap']);
    const colDesc      = detectColumn(rddHeaders, ['descripción', 'descripcion', 'description', 'descrip']);
    const colLote      = detectColumn(rddHeaders, ['l.productivo/tracecode', 'tracecode', 'trace code', 'l.productivo', 'lote', 'productivo']);
    const colFecha     = detectColumn(rddHeaders, ['fecha de proceso', 'fecha proceso', 'process date']);
    const colCaducidad = detectColumn(rddHeaders, ['fecha caducidad', 'caducidad', 'vencimiento', 'best before']);

    if (!colLote) throw new Error(`No se encontró columna de Lote. Columnas: ${rddHeaders.join(', ')}`);

    colIdxMap = {};
    [['Planta', colPlanta], ['SERNAP', colSernap], ['Descripcion', colDesc],
     ['Lote', colLote], ['Fecha', colFecha], ['Fecha_Caducidad', colCaducidad]]
        .forEach(([key, col]) => { if (col) colIdxMap[key] = rddHeaders.indexOf(col); });

    console.log('[RDD] Columns:', colIdxMap);

    // Cerebro: cargar correcciones
    const cerebro = getCerebro();

    let lastPlanta = '', lastSernap = '', lastDesc = '';
    const lotes = [];
    const seenKeys = {};

    for (const row of rddDataRows) {
        const loteRaw = row[colIdxMap['Lote']];
        if (loteRaw == null) continue;
        const lote = String(loteRaw).trim().replace(/\.0+$/, '');
        if (!lote || lote.toLowerCase() === 'nan' || lote.toLowerCase().includes('total')) continue;
        if (!/^\d+/.test(lote)) continue;

        const fecha = colIdxMap.Fecha != null ? formatDate(row[colIdxMap.Fecha]) : '';
        const compositeKey = lote + '|' + fecha;
        if (seenKeys[compositeKey]) continue;

        // Forward fill Planta
        const planta = colIdxMap.Planta != null ? row[colIdxMap.Planta] : null;
        if (planta != null && String(planta).trim()) lastPlanta = String(planta).trim();

        // Forward fill SERNAP
        const sernap = colIdxMap.SERNAP != null ? row[colIdxMap.SERNAP] : null;
        if (sernap != null && String(sernap).trim()) lastSernap = String(sernap).replace(/\.0+$/, '').trim();

        const desc = colIdxMap.Descripcion != null ? row[colIdxMap.Descripcion] : null;
        if (desc != null && String(desc).trim()) lastDesc = String(desc).trim();

        const caducidad = colIdxMap.Fecha_Caducidad != null ? formatDate(row[colIdxMap.Fecha_Caducidad]) : '';

        // Aplicar cerebro: si el SERNAP existe en el cerebro, usar el nombre correcto
        let plantaFinal = lastPlanta;
        const sernapClean = lastSernap.replace(/\.0+$/, '');
        if (cerebro[sernapClean]) {
            plantaFinal = cerebro[sernapClean];
        }

        seenKeys[compositeKey] = true;
        lotes.push({
            Planta: plantaFinal, SERNAP: sernapClean,
            Descripcion: lastDesc, Lote: lote, Fecha: fecha, Fecha_Caducidad: caducidad
        });
    }

    console.log(`[RDD] Lotes únicos: ${lotes.length}`);
    return lotes;
}

const MESES = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

function formatDate(val) {
    if (val == null) return '';
    if (val instanceof Date) {
        return val.getDate().toString().padStart(2, '0') + '.' +
               (val.getMonth() + 1).toString().padStart(2, '0') + '.' + val.getFullYear();
    }
    const s = String(val).trim();
    if (!s || s === 'nan' || s === 'None' || s === 'undefined') return '';
    const n = Number(s);
    if (!isNaN(n) && n > 30000 && n < 60000) {
        const dt = new Date((n - 25569) * 86400000);
        return dt.getDate().toString().padStart(2, '0') + '.' +
               (dt.getMonth() + 1).toString().padStart(2, '0') + '.' + dt.getFullYear();
    }
    return s;
}

function normalizarFecha(s) {
    if (!s) return s;
    const m = s.match(/^(\d{1,2})[.\s\/\-]([A-Za-z]{3})[.\s\/\-](\d{4})$/);
    if (m) { const mes = MESES[m[2].toLowerCase()] || m[2]; return m[1].padStart(2, '0') + '.' + mes + '.' + m[3]; }
    return s;
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. EXTRACTOR ETIQUETAS
// ═════════════════════════════════════════════════════════════════════════════

async function extraerEtiquetas(files, lotesConocidos) {
    const lotesSet = new Set(lotesConocidos.map(l => l.Lote));
    const resultados = [];

    for (let f = 0; f < files.length; f++) {
        const file = files[f];
        const name = file.name.toLowerCase();
        setProgress(`Procesando evidencia ${f + 1}/${files.length}: ${file.name}…`,
            30 + Math.round(f / files.length * 50));

        try {
            let texto = '';
            if (name.endsWith('.pdf')) {
                texto = await extractTextFromPDF(file, f, files.length);
            } else if (name.endsWith('.docx')) {
                texto = await extractTextFromDocx(file);
            } else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
                texto = await extractTextFromExcel(file);
            }

            console.log(`[EVIDENCE] ${file.name} — ${texto.length} chars:`, texto.substring(0, 300));

            // A) Regex: TRACING CODE
            const lotesRegex = [...texto.matchAll(/TRACING[\s\-_]*CODE[\s:\-\n]*([\d]{6,12})/gi)];
            const fechasRegex = [...texto.matchAll(/PRODUCTION[\s\-_]*DATE[\s:\-\n]*([\d]{1,2}[.\/ \-](?:[A-Za-z]{3}|\d{1,2})[.\/ \-]\d{4})/gi)];
            const lotesEncontrados = new Set();

            for (let i = 0; i < lotesRegex.length; i++) {
                const lote = lotesRegex[i][1].trim();
                const fecha = i < fechasRegex.length ? normalizarFecha(fechasRegex[i][1].trim()) : 'No detectada';
                resultados.push({ Lote: lote, Fecha_Etiqueta: fecha, Origen: file.name });
                lotesEncontrados.add(lote);
            }

            // A.5) Barcodes detectados por backend (inyectados como BARCODE_TYPE: data)
            const barcodeRegex = [...texto.matchAll(/BARCODE_\w+:\s*([\d]{6,12})/g)];
            for (const bc of barcodeRegex) {
                const lote = bc[1].trim();
                if (!lotesEncontrados.has(lote)) {
                    const fechaCercana = buscarFechaCercana(texto, lote);
                    resultados.push({
                        Lote: lote,
                        Fecha_Etiqueta: fechaCercana || 'Detectado por barcode',
                        Origen: file.name + ' [BC]'
                    });
                    lotesEncontrados.add(lote);
                }
            }

            // B) Búsqueda directa de lotes conocidos
            for (const loteConocido of lotesSet) {
                if (lotesEncontrados.has(loteConocido)) continue;
                if (texto.includes(loteConocido)) {
                    const fechaCercana = buscarFechaCercana(texto, loteConocido);
                    resultados.push({
                        Lote: loteConocido,
                        Fecha_Etiqueta: fechaCercana || 'Detectado por código',
                        Origen: file.name
                    });
                    lotesEncontrados.add(loteConocido);
                }
            }
        } catch (e) { console.warn(`Error leyendo ${file.name}:`, e); }
    }

    console.log(`[EVIDENCE] Total etiquetas: ${resultados.length}`);
    return resultados;
}

function buscarFechaCercana(texto, lote) {
    const idx = texto.indexOf(lote);
    if (idx < 0) return null;
    const ventana = texto.substring(Math.max(0, idx - 300), idx + 300);
    const m1 = ventana.match(/(\d{1,2})[.\s\/\-]([A-Za-z]{3})[.\s\/\-](\d{4})/);
    if (m1) return normalizarFecha(m1[0]);
    const m2 = ventana.match(/(\d{1,2})[.\s\/\-](\d{1,2})[.\s\/\-](\d{4})/);
    if (m2) return m2[0];
    return null;
}

// ── PDF: nativo + OCR (híbrido: backend OpenCV o Tesseract.js) ────────────────
async function extractTextFromPDF(file, fileIdx, totalFiles) {
    const data = await readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let fullText = '';
    let ocrWorker = null;
    let totalBarcodes = 0;

    // SIEMPRE crear Tesseract worker (se usa como fallback o para OCR de imagen procesada)
    if (typeof Tesseract !== 'undefined') {
        try {
            const baseUrl = location.href.replace(/\/[^\/]*$/, '/');
            ocrWorker = await Tesseract.createWorker('eng', 1, {
                workerPath: baseUrl + 'lib/worker.min.js',
                corePath: baseUrl + 'lib/tesseract-core-simd.wasm.js',
                langPath: baseUrl + 'lib',
                logger: () => {}
            });
        } catch (e) { ocrWorker = null; }
    }

    for (let i = 1; i <= pdf.numPages; i++) {
        const modeLabel = backendAvailable ? 'OpenCV+OCR' : 'OCR';
        setProgress(`${modeLabel} página ${i}/${pdf.numPages} de ${file.name}…`,
            30 + Math.round((fileIdx / totalFiles + i / pdf.numPages / totalFiles) * 50));

        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const nativeText = content.items.map(it => it.str).join(' ');

        if (nativeText.trim().length > 50) {
            fullText += nativeText + '\n';
        } else {
            // Renderizar página a canvas
            const viewport = page.getViewport({ scale: 2.5 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;

            if (backendAvailable) {
                // ── MODO HÍBRIDO: OpenCV pre-procesa + Tesseract.js lee ──
                try {
                    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
                    const formData = new FormData();
                    formData.append('image', blob, `page_${i}.png`);

                    const res = await fetch('/api/process-image', { method: 'POST', body: formData });
                    const result = await res.json();

                    if (result.success) {
                        // Barcodes detectados por OpenCV
                        if (result.barcodes && result.barcodes.length > 0) {
                            for (const bc of result.barcodes) {
                                fullText += `BARCODE_${bc.type}: ${bc.data}\n`;
                                totalBarcodes++;
                            }
                            console.log(`[BACKEND] Pág ${i}: ${result.barcodes.length} barcode(s)`);
                        }

                        // Si el backend hizo OCR exitoso, usar ese texto
                        if (result.ocr_text && result.ocr_text.trim().length > 20) {
                            fullText += result.ocr_text + '\n';
                        }
                        // Si no, usar la imagen pre-procesada con Tesseract.js
                        else if (result.processed_image && ocrWorker) {
                            console.log(`[HYBRID] Pág ${i}: OpenCV pre-procesó → Tesseract.js OCR`);
                            const imgEl = new Image();
                            const imgLoaded = new Promise((resolve, reject) => {
                                imgEl.onload = resolve;
                                imgEl.onerror = reject;
                            });
                            imgEl.src = 'data:image/png;base64,' + result.processed_image;
                            await imgLoaded;

                            // Dibujar imagen procesada en canvas para Tesseract.js
                            const cvs = document.createElement('canvas');
                            cvs.width = imgEl.naturalWidth;
                            cvs.height = imgEl.naturalHeight;
                            cvs.getContext('2d').drawImage(imgEl, 0, 0);

                            try {
                                const ocrResult = await ocrWorker.recognize(cvs);
                                fullText += ocrResult.data.text + '\n';
                            } catch (e) { /* skip */ }
                        }
                        // Último fallback: OCR sobre canvas original
                        else if (ocrWorker) {
                            try {
                                const ocrResult = await ocrWorker.recognize(canvas);
                                fullText += ocrResult.data.text + '\n';
                            } catch (e) { /* skip */ }
                        }
                    }
                } catch (e) {
                    console.warn(`[BACKEND] Error pág ${i}, fallback a Tesseract.js:`, e);
                    if (ocrWorker) {
                        try {
                            const ocrResult = await ocrWorker.recognize(canvas);
                            fullText += ocrResult.data.text + '\n';
                        } catch (e2) { /* skip */ }
                    }
                }
            } else if (ocrWorker) {
                // ── MODO STANDALONE: Tesseract.js directo ──
                try {
                    const result = await ocrWorker.recognize(canvas);
                    fullText += result.data.text + '\n';
                } catch (e) { /* skip */ }
            }
        }
    }

    if (totalBarcodes > 0) console.log(`[BACKEND] Total barcodes en ${file.name}: ${totalBarcodes}`);
    if (ocrWorker) { try { await ocrWorker.terminate(); } catch (e) {} }
    return fullText;
}

async function _ocrFallback(canvas, existingWorker) {
    let worker = existingWorker;
    if (!worker && typeof Tesseract !== 'undefined') {
        const baseUrl = location.href.replace(/\/[^\/]*$/, '/');
        worker = await Tesseract.createWorker('eng', 1, {
            workerPath: baseUrl + 'lib/worker.min.js',
            corePath: baseUrl + 'lib/tesseract-core-simd.wasm.js',
            langPath: baseUrl + 'lib',
            logger: () => {}
        });
    }
    if (worker) {
        try { const r = await worker.recognize(canvas); return r.data.text; }
        catch (e) { return ''; }
    }
    return '';
}

async function extractTextFromDocx(file) {
    const data = await readFileAsArrayBuffer(file);
    return (await mammoth.extractRawText({ arrayBuffer: data })).value;
}

async function extractTextFromExcel(file) {
    const data = await readFileAsArrayBuffer(file);
    const wb = XLSX.read(data, { type: 'array' });
    return wb.SheetNames.map(n => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n');
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. CRUCE
// ═════════════════════════════════════════════════════════════════════════════

function cruzarDatos(lotesRequeridos, etiquetas) {
    const etiqByLote = {};
    for (const e of etiquetas) {
        if (!etiqByLote[e.Lote]) etiqByLote[e.Lote] = [];
        etiqByLote[e.Lote].push(e);
    }
    return lotesRequeridos.map(req => {
        const match = (etiqByLote[req.Lote] || [])[0] || null;
        let fechaWarn = '';
        if (match && match.Fecha_Etiqueta && req.Fecha) {
            // Comparar fechas si ambas existen y tienen formato numérico
            const fRDD = req.Fecha.replace(/\D/g, '');
            const fEtiq = match.Fecha_Etiqueta.replace(/\D/g, '');
            if (fRDD.length >= 6 && fEtiq.length >= 6 && fRDD !== fEtiq) {
                fechaWarn = '⚠️';
            }
        }
        return {
            Planta: req.Planta, SERNAP: req.SERNAP, Descripcion: req.Descripcion,
            Lote: req.Lote, Fecha: req.Fecha, Fecha_Caducidad: req.Fecha_Caducidad,
            Fecha_Etiqueta: match ? (fechaWarn + ' ' + match.Fecha_Etiqueta).trim() : '',
            Origen: match ? match.Origen : '',
            Estado: match ? '✅ OK' : '🔴 FALTANTE'
        };
    });
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. RENDER
// ═════════════════════════════════════════════════════════════════════════════

const DISPLAY_HEADERS = [
    { key: 'Planta',          label: 'Planta Elaboradora' },
    { key: 'SERNAP',          label: 'SERNAP' },
    { key: 'Descripcion',     label: 'Descripción' },
    { key: 'Lote',            label: 'L.Productivo / TraceCode' },
    { key: 'Fecha',           label: 'Fecha de Proceso' },
    { key: 'Fecha_Caducidad', label: 'Fecha Caducidad' },
    { key: 'Fecha_Etiqueta',  label: 'Fecha en Etiqueta' },
    { key: 'Origen',          label: 'Documento Fuente' },
    { key: 'Estado',          label: 'Estado' }
];

function renderResults(data) {
    const pedidoMatch = rddFile.name.match(/\d{6,}/);
    const pedido = pedidoMatch ? pedidoMatch[0] : 'Desconocido';
    const total = data.length;
    const totalOK = data.filter(r => r.Estado.includes('✅')).length;
    const totalFalt = total - totalOK;
    const pct = total > 0 ? Math.round(totalOK / total * 100) : 0;
    const ahora = new Date();
    const timestamp = ahora.toLocaleDateString('es-CL') + ' ' +
        ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    document.getElementById('pedido-card').innerHTML = `
        <div class="pedido-item"><div class="label">Pedido de Ventas</div><div class="value">${pedido}</div></div>
        <div class="pedido-item"><div class="label">Archivo Maestro</div><div class="value">${rddFile.name}</div></div>
        <div class="pedido-item"><div class="label">Evidencias</div><div class="value">${evidenciaFiles.length} archivos</div></div>
        <div class="pedido-item"><div class="label">Lotes Únicos</div><div class="value">${total}</div></div>
        <div class="pedido-item"><div class="label">Fecha Auditoría</div><div class="value">${timestamp}</div></div>
    `;

    document.getElementById('metrics-grid').innerHTML = `
        <div class="metric-card"><div class="metric-label">📦 Etiquetas Totales</div><div class="metric-value">${total}</div></div>
        <div class="metric-card success"><div class="metric-label">✅ Con Etiqueta</div><div class="metric-value">${totalOK}</div></div>
        <div class="metric-card danger ${totalFalt > 0 ? 'has-items' : ''}"><div class="metric-label">🔴 Faltantes</div><div class="metric-value">${totalFalt}</div></div>
        <div class="metric-card ${pct === 100 ? 'success' : ''}"><div class="metric-label">📊 Cumplimiento</div><div class="metric-value">${pct}%</div></div>
    `;

    document.getElementById('success-banner').style.display = totalFalt === 0 ? 'block' : 'none';

    // Resumen por Planta
    const plantaMap = {};
    for (const row of data) {
        const p = row.Planta || 'Sin planta';
        if (!plantaMap[p]) plantaMap[p] = { ok: 0, falt: 0 };
        if (row.Estado.includes('✅')) plantaMap[p].ok++; else plantaMap[p].falt++;
    }
    document.getElementById('planta-summary').innerHTML = Object.entries(plantaMap).map(([name, c]) => {
        const cls = c.falt > 0 ? 'has-falt' : 'all-ok';
        return `<div class="planta-chip ${cls}">
            <span>${c.falt > 0 ? '🏭' : '✅'}</span>
            <span class="chip-name">${name}</span>
            <span class="chip-stats"><span class="chip-ok">✅ ${c.ok}</span><span class="chip-falt">🔴 ${c.falt}</span></span>
        </div>`;
    }).join('');

    // Sort
    data.sort((a, b) => (a.Planta || '').localeCompare(b.Planta || '') || (a.Lote || '').localeCompare(b.Lote || ''));

    // Desglose por evidencia
    const evMap = {};
    for (const row of data) {
        if (row.Origen) {
            evMap[row.Origen] = (evMap[row.Origen] || 0) + 1;
        }
    }
    // Agregar evidencias sin matches
    for (const f of evidenciaFiles) {
        if (!evMap[f.name]) evMap[f.name] = 0;
    }
    const fechaWarnings = data.filter(r => r.Fecha_Etiqueta && r.Fecha_Etiqueta.includes('⚠️')).length;

    let evHTML = Object.entries(evMap).map(([name, count]) => {
        const cls = count > 0 ? 'ev-found' : 'ev-empty';
        return `<div class="ev-chip ${cls}">
            <span class="ev-name" title="${name}">📄 ${name}</span>
            <span class="ev-count">${count} match${count !== 1 ? 'es' : ''}</span>
        </div>`;
    }).join('');
    if (fechaWarnings > 0) {
        evHTML += `<div class="ev-chip" style="border-color:rgba(245,158,11,0.3)">
            <span class="ev-name">⚠️ Fechas distintas</span>
            <span class="ev-count" style="background:rgba(245,158,11,0.15);color:#f59e0b;">${fechaWarnings}</span>
        </div>`;
    }
    document.getElementById('evidence-breakdown').innerHTML = evHTML;

    // Tabs
    const faltantes = data.filter(r => r.Estado.includes('🔴'));
    const verificados = data.filter(r => r.Estado.includes('✅'));
    const faltHeaders = DISPLAY_HEADERS.filter(h =>
        ['Planta', 'SERNAP', 'Descripcion', 'Lote', 'Fecha', 'Fecha_Caducidad'].includes(h.key));

    document.getElementById('tab-btn-faltantes').textContent = `🔴 Faltantes (${faltantes.length})`;
    document.getElementById('tab-btn-verificados').textContent = `✅ Verificados (${verificados.length})`;

    if (faltantes.length > 0) {
        renderTable('thead-faltantes', 'tbody-faltantes', faltantes, faltHeaders, true);
    } else {
        document.getElementById('thead-faltantes').innerHTML = '';
        document.getElementById('tbody-faltantes').innerHTML =
            `<tr><td colspan="${faltHeaders.length}" class="tab-empty">🎉 ¡No hay faltantes!</td></tr>`;
    }

    if (verificados.length > 0) {
        renderTable('thead-verificados', 'tbody-verificados', verificados, DISPLAY_HEADERS, false);
    } else {
        document.getElementById('thead-verificados').innerHTML = '';
        document.getElementById('tbody-verificados').innerHTML =
            `<tr><td colspan="${DISPLAY_HEADERS.length}" class="tab-empty">Sin coincidencias aún</td></tr>`;
    }

    resultsSection.style.display = 'block';
    setTimeout(() => resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

function renderTable(theadId, tbodyId, data, headers, applyRowClass) {
    document.getElementById(theadId).innerHTML = '<tr>' + headers.map(h => `<th>${h.label}</th>`).join('') + '</tr>';
    document.getElementById(tbodyId).innerHTML = data.map(row => {
        const isFaltante = row.Estado && row.Estado.includes('🔴');
        const cls = applyRowClass && isFaltante ? ' class="row-faltante"' : '';
        const cells = headers.map(h => {
            const val = row[h.key] ?? '';
            if (h.key === 'Estado') return `<td class="${isFaltante ? 'estado-faltante' : 'estado-ok'}">${val}</td>`;
            if (h.key === 'Fecha_Etiqueta' && String(val).includes('⚠️')) return `<td class="fecha-warn">${val}</td>`;
            return `<td>${val}</td>`;
        }).join('');
        return `<tr${cls}>${cells}</tr>`;
    }).join('');
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
});

// ═════════════════════════════════════════════════════════════════════════════

// ── Build Tabla Sheet (pivot-style from Hoja1 of RDD) ─────────────────────────
function buildTablaFromWorkbook(workbook, cerebro) {
    // Find the summary sheet (Hoja1) - the one with "Pedido de Ventas"
    let summarySheetName = null;
    let dataSheetName = null;
    
    for (const sn of workbook.SheetNames) {
        const ws = workbook.Sheets[sn];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
        if (rows.length > 0 && rows[0] && String(rows[0][0] || '').toLowerCase().includes('pedido')) {
            summarySheetName = sn;
        } else if (rows.length > 100) {
            dataSheetName = sn;
        }
    }

    // If we found the summary sheet, use its structure
    if (summarySheetName) {
        const ws = workbook.Sheets[summarySheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
        
        // Apply cerebro corrections
        // Find header row
        let headerRow = -1;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
            if (rows[i] && rows[i].some(c => String(c || '').toLowerCase().includes('planta'))) {
                headerRow = i;
                break;
            }
        }
        
        if (headerRow >= 0) {
            const hdrs = rows[headerRow].map(h => String(h || '').trim().toLowerCase());
            const pIdx = hdrs.findIndex(h => h.includes('planta') && !h.includes('sernap'));
            const sIdx = hdrs.findIndex(h => h.includes('sernap'));
            
            if (pIdx >= 0 && sIdx >= 0 && Object.keys(cerebro).length > 0) {
                let lastS = '';
                for (let i = headerRow + 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row) continue;
                    // Skip total row
                    if (String(row[0] || '').toLowerCase().includes('total')) continue;
                    const rawS = row[sIdx];
                    if (rawS != null && String(rawS).trim()) lastS = String(rawS).replace(/\.0+$/, '').trim();
                    if (lastS && cerebro[lastS]) row[pIdx] = cerebro[lastS];
                }
            }
        }
        
        return XLSX.utils.aoa_to_sheet(rows);
    }

    // Fallback: build tabla from data sheet
    if (!dataSheetName) dataSheetName = workbook.SheetNames[0];
    return buildTablaFromDataSheet(workbook.Sheets[dataSheetName], cerebro);
}

function buildTablaFromDataSheet(ws, cerebro) {
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
    
    // Detect headers
    let headerRow = 0;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
        if (rows[i] && rows[i].some(c => String(c || '').toLowerCase().includes('planta'))) {
            headerRow = i; break;
        }
    }
    const headers = rows[headerRow] ? rows[headerRow].map(h => String(h || '').trim().toLowerCase()) : [];
    const pIdx = headers.findIndex(h => h.includes('planta') || h.includes('centro'));
    const sIdx = headers.findIndex(h => h.includes('sernap'));
    const dIdx = headers.findIndex(h => h.includes('descripci'));
    const lIdx = headers.findIndex(h => h.includes('productivo') || h.includes('tracecode') || h.includes('lote'));
    const fIdx = headers.findIndex(h => h.includes('fecha') && h.includes('proceso'));
    const cIdx = headers.findIndex(h => h.includes('caducidad') || h.includes('vencimiento'));
    const cajIdx = headers.findIndex(h => h.includes('caja'));
    const knIdx = headers.findIndex(h => h.includes('neto'));
    const kbIdx = headers.findIndex(h => h.includes('bruto'));

    // Build grouped data: Planta -> Desc -> Lotes
    const groups = {};
    let lastP = '', lastS = '', lastD = '';
    
    for (let i = headerRow + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const lote = lIdx >= 0 ? String(row[lIdx] || '').trim().replace(/\.0+$/, '') : '';
        if (!lote || !/^\d+/.test(lote)) continue;
        if (String(row[0] || '').toLowerCase().includes('total')) continue;

        if (pIdx >= 0 && row[pIdx] && String(row[pIdx]).trim()) lastP = String(row[pIdx]).trim();
        if (sIdx >= 0 && row[sIdx] && String(row[sIdx]).trim()) lastS = String(row[sIdx]).replace(/\.0+$/, '').trim();
        if (dIdx >= 0 && row[dIdx] && String(row[dIdx]).trim()) lastD = String(row[dIdx]).trim();

        let plantaFinal = lastP;
        if (lastS && cerebro[lastS]) plantaFinal = cerebro[lastS];

        const key = lastS + '|' + lastD;
        if (!groups[key]) groups[key] = { planta: plantaFinal, sernap: lastS, desc: lastD, lotes: [] };
        groups[key].lotes.push({
            lote: lote,
            fecha: fIdx >= 0 ? String(row[fIdx] || '') : '',
            caducidad: cIdx >= 0 ? String(row[cIdx] || '') : '',
            cajas: cajIdx >= 0 ? Number(row[cajIdx]) || 0 : 0,
            kgNeto: knIdx >= 0 ? Number(row[knIdx]) || 0 : 0,
            kgBruto: kbIdx >= 0 ? Number(row[kbIdx]) || 0 : 0
        });
    }

    // Build AOA
    const aoa = [];
    aoa.push(['Pedido de Ventas', '', '', '', '', '', '', '', '']);
    aoa.push(['Nombre del Cliente', '', '', '', '', '', '', '', '']);
    aoa.push([]);
    aoa.push(['', '', '', '', '', '', 'Valores', '', '']);
    aoa.push(['Planta Elaboradora', 'SERNAP Planta Elaboradora', 'Descripción', 'L.Productivo/TraceCode', 'Fecha de proceso', 'Fecha Caducidad', 'Suma de Cantidad de Cajas', 'Suma de Kilos Netos', 'Suma de Kilos Brutos']);
    
    let totalCajas = 0, totalKN = 0, totalKB = 0;
    let isFirstPlanta = true;
    let prevPlanta = '';

    for (const g of Object.values(groups)) {
        let isFirstInGroup = true;
        for (const l of g.lotes) {
            const plantaCell = (g.planta !== prevPlanta) ? g.planta : '';
            const sernapCell = (g.planta !== prevPlanta) ? g.sernap : '';
            const descCell = isFirstInGroup ? g.desc : '';
            
            aoa.push([plantaCell, sernapCell, descCell, l.lote, l.fecha, l.caducidad, l.cajas, l.kgNeto, Math.round(l.kgBruto * 1000) / 1000]);
            totalCajas += l.cajas;
            totalKN += l.kgNeto;
            totalKB += l.kgBruto;
            isFirstInGroup = false;
            prevPlanta = g.planta;
        }
    }

    aoa.push(['Total general', '', '', '', '', '', totalCajas, totalKN, Math.round(totalKB * 1000) / 1000]);
    return XLSX.utils.aoa_to_sheet(aoa);
}

// 5. DOWNLOADS
// ═════════════════════════════════════════════════════════════════════════════

// Descarga unificada: RDD Corregido + Auditoría + Faltantes
document.getElementById('btn-download').addEventListener('click', () => {
    if (!auditResults.length) return;
    const pedido = (rddFile.name.match(/\d{6,}/) || ['Pedido'])[0];
    const wb = XLSX.utils.book_new();

    // ── Hoja 0: Tabla resumen ─────────────────────────────────────────────
    if (originalWorkbook) {
        const tablaSheet = buildTablaFromWorkbook(originalWorkbook, getCerebro());
        XLSX.utils.book_append_sheet(wb, tablaSheet, 'Tabla');
    }

    // ── Hoja 1: RDD Corregido ──────────────────────────────────────────────
    if (originalWorkbook) {
        const cerebro = getCerebro();
        const ws = originalWorkbook.Sheets[bestSheetName];
        const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

        const plantaIdx = colIdxMap.Planta;
        const sernapIdx = colIdxMap.SERNAP;

        if (plantaIdx != null && sernapIdx != null && Object.keys(cerebro).length > 0) {
            let lastSernap = '';
            for (let i = bestSkipRows + 1; i < allRows.length; i++) {
                const row = allRows[i];
                if (!row) continue;
                const rawSernap = row[sernapIdx];
                if (rawSernap != null && String(rawSernap).trim()) {
                    lastSernap = String(rawSernap).replace(/\.0+$/, '').trim();
                }
                if (lastSernap && cerebro[lastSernap]) {
                    row[plantaIdx] = cerebro[lastSernap];
                }
            }
        }

        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(allRows), 'RDD Corregido');
    }

    // ── Hoja 2: Auditoría Completa ─────────────────────────────────────────
    XLSX.utils.book_append_sheet(wb, buildSheet(auditResults, DISPLAY_HEADERS), 'Auditoría Completa');

    // ── Hoja 3: Faltantes (si hay) ─────────────────────────────────────────
    const faltantes = auditResults.filter(r => r.Estado.includes('🔴'));
    if (faltantes.length > 0) {
        const faltHeaders = DISPLAY_HEADERS.filter(h =>
            ['Planta', 'SERNAP', 'Descripcion', 'Lote', 'Fecha', 'Fecha_Caducidad'].includes(h.key));
        XLSX.utils.book_append_sheet(wb, buildSheet(faltantes, faltHeaders), 'Faltantes');
    }

    XLSX.writeFile(wb, `LabelInspect_${pedido}.xlsx`);
});

function buildSheet(data, headers) {
    const aoa = [headers.map(h => h.label)];
    for (const row of data) aoa.push(headers.map(h => row[h.key] ?? ''));
    return XLSX.utils.aoa_to_sheet(aoa);
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. BUSCADOR
// ═════════════════════════════════════════════════════════════════════════════

document.getElementById('search-input').addEventListener('input', e => {
    const query = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.tab-content tbody tr').forEach(tr => {
        if (!query) { tr.style.display = ''; return; }
        tr.style.display = tr.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. COPIAR FALTANTES
// ═════════════════════════════════════════════════════════════════════════════

document.getElementById('btn-copiar').addEventListener('click', () => {
    const faltantes = auditResults.filter(r => r.Estado.includes('🔴'));
    if (!faltantes.length) { alert('✅ No hay faltantes.'); return; }

    const pedido = (rddFile.name.match(/\d{6,}/) || ['N/A'])[0];
    let texto = `ETIQUETAS FALTANTES — Pedido ${pedido}\nTotal: ${faltantes.length}\n${'─'.repeat(50)}\n`;

    const porPlanta = {};
    for (const f of faltantes) { const p = f.Planta || 'Sin planta'; (porPlanta[p] = porPlanta[p] || []).push(f); }
    for (const [planta, lotes] of Object.entries(porPlanta)) {
        texto += `\n🏭 ${planta} (${lotes.length})\n`;
        for (const l of lotes) texto += `   • Lote ${l.Lote} | ${l.Fecha} | ${l.Descripcion || ''}\n`;
    }

    navigator.clipboard.writeText(texto).then(() => {
        const btn = document.getElementById('btn-copiar');
        btn.classList.add('copied'); btn.textContent = '✅ ¡Copiado!';
        setTimeout(() => { btn.classList.remove('copied'); btn.textContent = '📋 Copiar Faltantes'; }, 2000);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. BORRADOR CORREO
// ═════════════════════════════════════════════════════════════════════════════

document.getElementById('btn-email').addEventListener('click', () => {
    const faltantes = auditResults.filter(r => r.Estado.includes('🔴'));
    const total = auditResults.length;
    const totalOK = total - faltantes.length;
    const pedido = (rddFile.name.match(/\d{6,}/) || ['N/A'])[0];
    const pct = total > 0 ? Math.round(totalOK / total * 100) : 0;

    let body = `Estimados,\n\nSe informa el resultado de la auditoría de etiquetas para el Pedido de Ventas ${pedido}.\n\n`;
    body += `RESUMEN:\n• Total de lotes: ${total}\n• Verificados: ${totalOK}\n• Faltantes: ${faltantes.length}\n• Cumplimiento: ${pct}%\n`;

    if (faltantes.length > 0) {
        body += `\nDETALLE FALTANTES:\n${'─'.repeat(45)}\n`;
        const porPlanta = {};
        for (const f of faltantes) { const p = f.Planta || 'Sin planta'; (porPlanta[p] = porPlanta[p] || []).push(f); }
        for (const [planta, lotes] of Object.entries(porPlanta)) {
            body += `\n${planta} (SERNAP: ${lotes[0].SERNAP || 'N/A'}) — ${lotes.length} faltante(s)\n`;
            for (const l of lotes) body += `   Lote: ${l.Lote} | Fecha: ${l.Fecha} | Caducidad: ${l.Fecha_Caducidad || 'N/A'}\n`;
        }
    } else {
        body += `\n✅ Todas las etiquetas fueron verificadas exitosamente.\n`;
    }
    body += `\nSaludos cordiales,\nEquipo AQUASHIELD`;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-box"><h3>✉️ Borrador — Pedido ${pedido}</h3>
        <textarea id="email-body">${body}</textarea>
        <div class="modal-actions"><button class="btn-modal-close" id="modal-close">Cerrar</button>
        <button class="btn-modal-copy" id="modal-copy">📋 Copiar</button></div></div>`;
    document.body.appendChild(overlay);

    document.getElementById('modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('modal-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(document.getElementById('email-body').value).then(() => {
            document.getElementById('modal-copy').textContent = '✅ ¡Copiado!';
            setTimeout(() => { document.getElementById('modal-copy').textContent = '📋 Copiar'; }, 2000);
        });
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. CEREBRO — Modal CRUD
// ═════════════════════════════════════════════════════════════════════════════

const cerebroModal = document.getElementById('cerebro-modal');

document.getElementById('btn-cerebro').addEventListener('click', () => {
    renderCerebroList();
    cerebroModal.style.display = 'flex';
});

document.getElementById('cerebro-close').addEventListener('click', () => { cerebroModal.style.display = 'none'; });
cerebroModal.addEventListener('click', e => { if (e.target === cerebroModal) cerebroModal.style.display = 'none'; });

// Agregar
document.getElementById('cerebro-btn-add').addEventListener('click', () => {
    const sernap = document.getElementById('cerebro-sernap').value.trim().replace(/\.0+$/, '');
    const planta = document.getElementById('cerebro-planta').value.trim();
    if (!sernap || !planta) { alert('Completa ambos campos.'); return; }

    const cerebro = getCerebro();
    cerebro[sernap] = planta;
    saveCerebro(cerebro);

    document.getElementById('cerebro-sernap').value = '';
    document.getElementById('cerebro-planta').value = '';
    renderCerebroList();
});

function renderCerebroList() {
    const cerebro = getCerebro();
    const entries = Object.entries(cerebro);
    const list = document.getElementById('cerebro-list');

    if (entries.length === 0) {
        list.innerHTML = '<div class="cerebro-empty">🧠 Sin datos. Agrega asociaciones SERNAP → Planta arriba.</div>';
        return;
    }

    list.innerHTML = entries.map(([sernap, planta]) => `
        <div class="cerebro-row">
            <span class="cr-sernap">${sernap}</span>
            <span class="cr-planta">${planta}</span>
            <button class="cr-delete" data-sernap="${sernap}" title="Eliminar">✕</button>
        </div>
    `).join('');

    // Delete handlers
    list.querySelectorAll('.cr-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const cerebro = getCerebro();
            delete cerebro[btn.dataset.sernap];
            saveCerebro(cerebro);
            renderCerebroList();
        });
    });
}

// Exportar
document.getElementById('cerebro-export').addEventListener('click', () => {
    const cerebro = getCerebro();
    const blob = new Blob([JSON.stringify(cerebro, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cerebro_aquashield.json'; a.click();
    URL.revokeObjectURL(url);
});

// Importar
document.getElementById('cerebro-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        const imported = JSON.parse(text);
        const cerebro = getCerebro();
        Object.assign(cerebro, imported);
        saveCerebro(cerebro);
        renderCerebroList();
        alert(`✅ ${Object.keys(imported).length} entradas importadas.`);
    } catch (err) {
        alert('❌ Error al importar: ' + err.message);
    }
    e.target.value = '';
});

// ═════════════════════════════════════════════════════════════════════════════
// 10. HISTORIAL DE AUDITORÍAS
// ═════════════════════════════════════════════════════════════════════════════

function getHistorial() {
    try { return JSON.parse(localStorage.getItem('aquashield_historial') || '[]'); }
    catch { return []; }
}

function saveToHistorial(results) {
    const historial = getHistorial();
    const total = results.length;
    const ok = results.filter(r => r.Estado.includes('✅')).length;
    const falt = total - ok;
    const pct = total > 0 ? Math.round(ok / total * 100) : 0;
    const pedido = (rddFile.name.match(/\d{6,}/) || ['N/A'])[0];
    const ahora = new Date();

    historial.unshift({
        fecha: ahora.toLocaleDateString('es-CL'),
        hora: ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        pedido,
        archivo: rddFile.name,
        total, ok, falt, pct,
        evidencias: evidenciaFiles.length
    });

    // Mantener solo las últimas 50 auditorías
    if (historial.length > 50) historial.length = 50;
    localStorage.setItem('aquashield_historial', JSON.stringify(historial));
}

// Modal historial
const historialModal = document.getElementById('historial-modal');

document.getElementById('btn-historial').addEventListener('click', () => {
    renderHistorialList();
    historialModal.style.display = 'flex';
});

document.getElementById('historial-close').addEventListener('click', () => { historialModal.style.display = 'none'; });
historialModal.addEventListener('click', e => { if (e.target === historialModal) historialModal.style.display = 'none'; });

document.getElementById('historial-clear').addEventListener('click', () => {
    if (confirm('¿Eliminar todo el historial?')) {
        localStorage.removeItem('aquashield_historial');
        renderHistorialList();
    }
});

function renderHistorialList() {
    const historial = getHistorial();
    const list = document.getElementById('historial-list');

    if (historial.length === 0) {
        list.innerHTML = '<div class="historial-empty">📊 Sin auditorías registradas aún.</div>';
        return;
    }

    list.innerHTML = historial.map(h => {
        let pctCls = 'pct-low';
        if (h.pct === 100) pctCls = 'pct-100';
        else if (h.pct >= 80) pctCls = 'pct-mid';

        return `<div class="historial-row">
            <span class="hist-date">${h.fecha}<br>${h.hora}</span>
            <span class="hist-pedido">PV ${h.pedido}</span>
            <span class="hist-stats">✅ ${h.ok} · 🔴 ${h.falt} · 📦 ${h.total} lotes · 📄 ${h.evidencias} evid.</span>
            <span class="hist-pct ${pctCls}">${h.pct}%</span>
        </div>`;
    }).join('');
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. ATAJOS DE TECLADO
// ═════════════════════════════════════════════════════════════════════════════

document.addEventListener('keydown', e => {
    // Ctrl + Enter → Ejecutar auditoría
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (!btnAuditar.disabled) btnAuditar.click();
    }

    // Esc → Cerrar modales
    if (e.key === 'Escape') {
        if (cerebroModal.style.display === 'flex') cerebroModal.style.display = 'none';
        if (historialModal.style.display === 'flex') historialModal.style.display = 'none';
        // Cerrar modal de correo si existe
        const emailOverlay = document.querySelector('.modal-overlay:not(#cerebro-modal):not(#historial-modal)');
        if (emailOverlay && emailOverlay.style.display !== 'none') emailOverlay.remove();
    }
});

// ═════════════════════════════════════════════════════════════════════════════
// 12. QR DE VERIFICACIÓN
// ═════════════════════════════════════════════════════════════════════════════

document.getElementById('btn-qr')?.addEventListener('click', async () => {
    if (!auditResults.length || !backendAvailable) return;

    const total = auditResults.length;
    const totalOK = auditResults.filter(r => r.Estado.includes('✅')).length;
    const totalFalt = total - totalOK;
    const pct = total > 0 ? Math.round(totalOK / total * 100) : 0;
    const pedido = (rddFile.name.match(/\d{6,}/) || ['N/A'])[0];

    try {
        const res = await fetch('/api/generate-qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pedido, total, ok: totalOK, faltantes: totalFalt, pct })
        });
        const data = await res.json();

        if (data.success) {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `<div class="modal-box modal-qr">
                <h3>📱 QR de Verificación — PV ${pedido}</h3>
                <p class="modal-desc">Escanea este código para verificar el resumen de la auditoría.</p>
                <div class="qr-preview"><img src="${data.qr_image}" alt="QR Auditoría"></div>
                <div class="qr-summary">
                    <span>📦 ${total} lotes</span> · <span>✅ ${totalOK}</span> · <span>🔴 ${totalFalt}</span> · <span>📊 ${pct}%</span>
                </div>
                <div class="modal-actions">
                    <a href="${data.qr_image}" download="QR_PV${pedido}.png" class="btn-modal-copy">💾 Guardar QR</a>
                    <button class="btn-modal-close" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
                </div>
            </div>`;
            overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
            document.body.appendChild(overlay);
        }
    } catch (e) {
        console.error('[QR] Error:', e);
    }
});