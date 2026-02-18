(function(){
  if (window.__recapInjected) return;
  window.__recapInjected = true;

  const style = document.createElement('style');
  style.textContent = `
  .recap-fab{position:fixed;right:16px;bottom:80px;z-index:999999;background:#7dd3fc;color:#001;border:0;border-radius:24px;padding:10px 14px;font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,.35)}
  .recap-modal{position:fixed;inset:0;z-index:999998;background:rgba(0,0,0,.65);display:grid;place-items:center;padding:16px}
  .recap-card{background:#111318;color:#f5f5f5;max-width:520px;width:100%;border-radius:12px;padding:12px}
  .recap-card h3{margin:0 0 8px;color:#7dd3fc;font-size:14px}
  .recap-close{background:#2a3340;color:#fff;border:0;border-radius:8px;padding:6px 10px}
  .recap-kw span{display:inline-block;background:#1b2230;color:#dbeafe;border-radius:999px;padding:4px 8px;margin:3px 6px 0 0;font-size:12px}
  `;
  document.head.appendChild(style);

  const fab = document.createElement('button');
  fab.className = 'recap-fab';
  fab.textContent = 'Recap';
  document.body.appendChild(fab);

  function getVisibleText(){
    const text = document.body.innerText || '';
    return text.replace(/\s+/g,' ').trim();
  }

  function summarize(text){
    const sentences = text.split(/(?<=[.!?])\s*/).filter(Boolean);
    const freq = wordFreq(text);
    const scored = sentences.map(s=>({s,score:scoreSentence(s,freq)}))
      .sort((a,b)=>b.score-a.score)
      .slice(0,3)
      .map(x=>x.s.trim());
    const keywords = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([w])=>w);
    return {summary: scored.join(' '), keywords, lead: scored[0]||''};
  }

  function wordFreq(text){
    const tokens = tokenize(text);
    const stop = new Set(['the','a','an','and','or','but','if','then','so','because','as','of','to','in','on','for','with','by','at','from','into','out','about','over','under','this','that','these','those','is','are','was','were','be','been','being','it','its','their','they','them','we','you','he','she','his','her','not','no','can','could','should','would','may','might','will','just','more','most','some','any','each','other']);
    const freq = {};
    for (const t of tokens){ if (stop.has(t)) continue; freq[t]=(freq[t]||0)+1; }
    return freq;
  }
  function tokenize(text){
    const cleaned = text.replace(/[\d\p{P}\p{S}]/gu,' ');
    const hasSpaces = /\s/.test(cleaned);
    if (hasSpaces) return cleaned.toLowerCase().split(/\s+/).filter(t=>t.length>=2);
    const chars = cleaned.replace(/\s+/g,'');
    const grams=[]; for(let i=0;i<chars.length-1;i++){const g=chars.slice(i,i+2); grams.push(g)}
    return grams;
  }
  function scoreSentence(sentence,freq){
    return tokenize(sentence).reduce((s,t)=>s+(freq[t]||0),0);
  }

  function saveState(snippet){
    try{ localStorage.setItem('recap:last', JSON.stringify({snippet, t: Date.now(), url: location.href})); }catch(e){}
  }
  function loadState(){
    try{ const raw = localStorage.getItem('recap:last'); return raw?JSON.parse(raw):null; }catch(e){ return null; }
  }

  function showRecap(text){
    const {summary,keywords,lead} = summarize(text);
    const modal = document.createElement('div');
    modal.className = 'recap-modal';
    modal.innerHTML = `
      <div class="recap-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong>Recap</strong>
          <button class="recap-close">Close</button>
        </div>
        <h3>Quick Summary</h3><div>${summary||'—'}</div>
        <h3>Keywords</h3><div class="recap-kw">${keywords.map(k=>`<span>${k}</span>`).join('')||'—'}</div>
        <h3>Lead-in</h3><div>${lead||'—'}</div>
      </div>`;
    modal.querySelector('.recap-close').onclick = ()=>modal.remove();
    document.body.appendChild(modal);
  }

  fab.onclick = ()=>{
    const text = getVisibleText();
    if (!text) return alert('No readable text detected.');
    saveState(text.slice(0, 2000));
    showRecap(text.slice(0, 4000));
  };

  // auto recap on load if previous snippet exists
  const state = loadState();
  if (state && state.snippet) {
    const current = getVisibleText();
    const recapText = (state.snippet||'') + ' ' + current.slice(0, 2000);
    if (recapText.trim()) showRecap(recapText);
  }
})();
