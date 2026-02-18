const recapBtn = document.getElementById('recapBtn');
const clearBtn = document.getElementById('clearBtn');
const reader = document.getElementById('reader');
const readerTitle = document.getElementById('readerTitle');
const progressText = document.getElementById('progressText');
const readScope = document.getElementById('readScope');
const summaryEl = document.getElementById('summary');
const keywordsEl = document.getElementById('keywords');
const leadEl = document.getElementById('lead');
const pageIndicator = document.getElementById('pageIndicator');
const prevZone = document.getElementById('prevZone');
const nextZone = document.getElementById('nextZone');
const recapModal = document.getElementById('recapModal');
const closeModal = document.getElementById('closeModal');

let fullText = '';
let pages = [];
let pageIndex = 0;

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.js';

for (const btn of document.querySelectorAll('[data-sample]')) {
  btn.addEventListener('click', async () => {
    const name = btn.getAttribute('data-sample');
    const res = await fetch(`samples/${encodeURIComponent(name)}`);
    if (!res.ok) {
      alert('Failed to load book. Please confirm the file exists in samples/.');
      return;
    }
    const blob = await res.blob();
    const file = new File([blob], name, { type: blob.type });
    await handleFile(file);
  });
}

prevZone.addEventListener('click', () => flipPage(-1));
nextZone.addEventListener('click', () => flipPage(1));
recapBtn.addEventListener('click', openRecap);
closeModal.addEventListener('click', () => recapModal.classList.add('hidden'));

async function handleFile(file) {
  resetUI();
  readerTitle.textContent = `Loaded: ${file.name}`;
  if (file.name.endsWith('.txt')) {
    const text = await file.text();
    loadText(text);
  } else if (file.name.endsWith('.pdf')) {
    const text = await pdfToText(file);
    loadText(text);
  } else if (file.name.endsWith('.epub')) {
    const text = await epubToText(file);
    loadText(text);
  } else {
    alert('Unsupported file type');
  }
}

function resetUI() {
  recapBtn.disabled = true;
  clearBtn.disabled = true;
  summaryEl.textContent = '—';
  keywordsEl.textContent = '—';
  leadEl.textContent = '—';
  progressText.textContent = 'Progress: 0%';
  readScope.textContent = 'Read: 0 chars';
  reader.textContent = '';
  pages = [];
  pageIndex = 0;
  pageIndicator.textContent = '1 / 1';
}

clearBtn.addEventListener('click', () => {
  readerTitle.textContent = 'Select a book to start reading';
  resetUI();
});

function loadText(text) {
  fullText = sanitize(text);
  pages = paginate(fullText, 900);
  pageIndex = 0;
  renderPage();
  recapBtn.disabled = false;
  clearBtn.disabled = false;
  updateProgress();
}

function renderPage() {
  const page = pages[pageIndex] || '';
  reader.textContent = page;
  pageIndicator.textContent = `${pageIndex + 1} / ${pages.length || 1}`;
  updateProgress();
}

function flipPage(dir) {
  if (!pages.length) return;
  const next = Math.min(Math.max(0, pageIndex + dir), pages.length - 1);
  if (next === pageIndex) return;
  pageIndex = next;
  renderPage();
}

function updateProgress() {
  if (!pages.length) return;
  const readChars = pages.slice(0, pageIndex + 1).join('').length;
  const progress = Math.min(1, readChars / fullText.length);
  progressText.textContent = `Progress: ${Math.round(progress * 100)}%`;
  readScope.textContent = `Read: ${readChars} chars`;
}

function openRecap() {
  if (!pages.length) return;
  const currentText = pages.slice(0, pageIndex + 1).join('');
  const { summary, keywords, lead } = summarize(currentText);
  summaryEl.textContent = summary || '—';
  keywordsEl.innerHTML = keywords.length ? keywords.map(k => `<span>${k}</span>`).join('') : '—';
  leadEl.textContent = lead || '—';
  recapModal.classList.remove('hidden');
}

function sanitize(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function paginate(text, size) {
  const pages = [];
  for (let i = 0; i < text.length; i += size) {
    pages.push(text.slice(i, i + size));
  }
  return pages;
}

function summarize(text) {
  const sentences = text.split(/(?<=[.!?])\s*/).filter(Boolean);
  const freq = wordFreq(text);
  const scored = sentences.map(s => ({ s, score: scoreSentence(s, freq) }))
    .sort((a,b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.s.trim());

  const keywords = Object.entries(freq)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);

  return {
    summary: scored.join(' '),
    keywords,
    lead: scored[0] || ''
  };
}

function wordFreq(text) {
  const tokens = tokenize(text);
  const stop = new Set(['the','a','an','and','or','but','if','then','so','because','as','of','to','in','on','for','with','by','at','from','into','out','about','over','under','this','that','these','those','is','are','was','were','be','been','being','it','its','their','they','them','we','you','he','she','his','her','not','no','can','could','should','would','may','might','will','just','more','most','some','any','each','other']);
  const freq = {};
  for (const t of tokens) {
    if (stop.has(t)) continue;
    freq[t] = (freq[t] || 0) + 1;
  }
  return freq;
}

function tokenize(text) {
  const cleaned = text.replace(/[\d\p{P}\p{S}]/gu, ' ');
  const hasSpaces = /\s/.test(cleaned);
  if (hasSpaces) {
    return cleaned.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  }
  const chars = cleaned.replace(/\s+/g, '');
  const grams = [];
  for (let i = 0; i < chars.length - 1; i++) {
    const gram = chars.slice(i, i + 2);
    grams.push(gram);
  }
  return grams;
}

function scoreSentence(sentence, freq) {
  const tokens = tokenize(sentence);
  return tokens.reduce((sum, t) => sum + (freq[t] || 0), 0);
}

async function pdfToText(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 12); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(' ') + '\n';
  }
  return text;
}

async function epubToText(file) {
  const buffer = await file.arrayBuffer();
  const book = ePub(buffer);
  await book.ready;
  const spine = book.spine;
  let text = '';
  for (let i = 0; i < Math.min(spine.items.length, 10); i++) {
    const item = spine.items[i];
    const doc = await item.load(book.load.bind(book));
    text += doc.body.textContent + '\n';
    item.unload();
  }
  return text;
}
