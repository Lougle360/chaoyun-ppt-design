(() => {
  'use strict';
  const data = window.CHAOYUN_STYLES;
  const $ = (id) => document.getElementById(id);
  if (!Array.isArray(data) || !data.length) { $('result-summary').textContent = '风格资料未加载，请确认 styles-data.js 与网页位于同一目录。'; return; }
  const byId = new Map(data.map(s => [s.id, s]));
  const scenes = ['教学培训','工作汇报','商业提案','产品介绍','品牌传播','研究分析','个人分享','文化创意'];
  const capacityOrder = ['少量重点','精简3—5要点','3—5要点','中等要点','结构化较多要点'];
  const pageSize = 24, storageKey = 'chaoyun-style-atlas:favorites:v1';
  let favorites = new Set(), persistent = true, timer, activeId = null, returnFocus = null;
  try { const saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(saved)) favorites = new Set(saved.filter(id => byId.has(id))); } catch { persistent = false; }
  const state = { q:'', scene:'', category:'', capacity:'', saved:false, sort:'id', page:1 };
  let filtered = data.slice();
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label = s => `${s.id} ${s.name}`;
  const matches = s => {
    const terms = state.q.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return terms.every(term => /^\d{1,3}$/.test(term) ? Number(term) === Number(s.id) : s.search.includes(term)) &&
      (!state.scene || s.scenes.includes(state.scene)) && (!state.category || s.categories.includes(state.category)) &&
      (!state.capacity || s.capacity.includes(state.capacity)) && (!state.saved || favorites.has(s.id));
  };
  function toast(message) { const target=$('detail-dialog').open?$('detail-dialog'):document.body;target.appendChild($('toast'));$('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(timer); timer = setTimeout(() => $('toast').classList.remove('visible'), 2600); }
  function syncSaved() { $('saved-count').textContent = favorites.size; $('saved-top').setAttribute('aria-pressed', String(state.saved)); $('saved-toggle').setAttribute('aria-pressed', String(state.saved)); }
  function toggleFavorite(id) {
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    try { localStorage.setItem(storageKey, JSON.stringify([...favorites])); } catch { persistent = false; }
    const saved = favorites.has(id);
    toast(persistent ? (saved ? '已收藏，下次打开仍可查看' : '已取消收藏') : '已更新本次收藏；当前浏览器不能持久保存');
    render(); if (activeId) updateFavoriteButton();
  }
  function renderScenes() {
    $('scene-filters').innerHTML = ['', ...scenes].map(scene => `<button class="scene-chip" data-scene="${scene}" aria-pressed="${state.scene === scene}">${scene || '全部风格'}<span>${scene ? data.filter(s=>s.scenes.includes(scene)).length : data.length}</span></button>`).join('');
  }
  function card(s) {
    const intensity = Math.min(3, Math.ceil((capacityOrder.indexOf(s.capacity[0])+1)/2));
    const bars = `<span class="capacity-dot" aria-hidden="true">${[1,2,3].map(i=>`<i class="${i <= intensity ? 'on' : ''}"></i>`).join('')}</span>`;
    return `<article class="style-card" data-id="${s.id}"><div class="card-visual"><button data-open="${s.id}" aria-label="查看 ${escapeHtml(label(s))} 详情"><img src="${escapeHtml(s.thumbnail)}" alt="${escapeHtml(s.name)}风格预览" loading="lazy" decoding="async" width="720" height="450"><span class="id-pill">NO. ${s.id}</span><span class="open-hint">查看风格 ↗</span></button></div><div class="card-body"><div class="card-title-row"><button class="card-title" data-open="${s.id}">${escapeHtml(s.name)}</button><button class="favorite-button" data-save="${s.id}" aria-label="${favorites.has(s.id) ? '取消收藏' : '收藏'} ${escapeHtml(label(s))}" aria-pressed="${favorites.has(s.id)}">${favorites.has(s.id) ? '♥' : '♡'}</button></div><p class="card-description">${escapeHtml(s.description)}</p><div class="tags">${s.tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div><div class="card-bottom"><span class="scene">${escapeHtml(s.scenes.join(' / '))}</span><span class="capacity">${bars}${escapeHtml(s.capacity.join(' / '))}</span></div></div></article>`;
  }
  function render() {
    filtered = data.filter(matches).sort(state.sort === 'name' ? (a,b)=>a.name.localeCompare(b.name,'zh-CN') : (a,b)=>Number(a.id)-Number(b.id));
    const totalPages = Math.max(1, Math.ceil(filtered.length/pageSize)); state.page = Math.min(state.page,totalPages);
    const start = (state.page-1)*pageSize, shown = filtered.slice(start,start+pageSize);
    $('gallery').innerHTML = shown.map(card).join('');
    $('empty-state').hidden = filtered.length !== 0;
    const noFavorites = state.saved && favorites.size === 0;
    $('empty-title').textContent = noFavorites ? '还没有收藏风格' : '没有找到匹配的风格';
    $('empty-description').textContent = noFavorites ? '点卡片右上方的爱心，把喜欢的风格留在这里。' : '试试更短的关键词，或放宽场景、类别与容量条件。';
    $('result-summary').innerHTML = `<strong>${filtered.length}</strong> 种${state.saved ? '收藏' : ''}风格${filtered.length ? ` <span>· 当前展示 ${start+1}–${start+shown.length}</span>` : ''}`;
    $('reset').hidden = !(state.q || state.scene || state.category || state.capacity || state.saved);
    $('pagination').hidden = totalPages <= 1;
    $('pagination').innerHTML = `<button data-page="${state.page-1}" ${state.page===1?'disabled':''} aria-label="上一页">←</button>${Array.from({length:totalPages},(_,i)=>i+1).map(p=>`<button data-page="${p}" ${state.page===p?'aria-current="page"':''} aria-label="第 ${p} 页">${p}</button>`).join('')}<button data-page="${state.page+1}" ${state.page===totalPages?'disabled':''} aria-label="下一页">→</button><small>每页 ${pageSize} 种 · 共 ${totalPages} 页</small>`;
    renderScenes(); syncSaved();
  }
  function reset() { Object.assign(state,{q:'',scene:'',category:'',capacity:'',saved:false,page:1}); $('search').value=''; $('category').value=''; $('capacity').value=''; render(); }
  function updateFavoriteButton() { const saved = favorites.has(activeId); $('save-detail').textContent = saved ? '♥ 已收藏' : '♡ 收藏风格'; $('save-detail').setAttribute('aria-pressed',String(saved)); }
  function navigationIds() { return filtered.some(s=>s.id===activeId) ? filtered.map(s=>s.id) : data.map(s=>s.id); }
  function openDetail(id, changeHash=true) {
    const s = byId.get(id); if(!s) return;
    if (!$('detail-dialog').open) returnFocus = document.activeElement;
    activeId=id;
    $('detail-image').src=s.image; $('detail-image').alt=`${s.name}完整风格示例`;
    $('original-link').href=s.image; $('original-text-link').href=s.image;
    $('detail-kicker').textContent=`STYLE ${s.id} / ${s.categories.join(' · ')}`;
    $('detail-title').textContent=s.name; $('detail-description').textContent=s.description;
    $('detail-tags').innerHTML=s.tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('');
    const facts=[['主要场景',s.scenes],['推荐用途',s.useCases],['正文容量',s.capacity],['内容结构',s.structures],['页面组织',s.layouts],['素材形式',s.materials]];
    $('detail-facts').innerHTML=facts.map(([k,v])=>`<dt>${k}</dt><dd>${escapeHtml(v.join(' · '))}</dd>`).join('');
    $('detail-prompt').textContent=s.prompt; $('detail-evidence').textContent=s.evidence;
    document.querySelectorAll('#detail-dialog details').forEach(el=>el.open=false);
    updateFavoriteButton();
    const ids=navigationIds(),index=ids.indexOf(id); $('detail-position').textContent=`${index+1} / ${ids.length} 种${filtered.some(s=>s.id===id)?'当前结果':'风格'}`;
    $('previous-detail').disabled=index<=0; $('next-detail').disabled=index>=ids.length-1;
    if(!$('detail-dialog').open){$('detail-dialog').showModal();document.body.classList.add('modal-open');}
    $('detail-dialog').scrollTop=0;
    if(changeHash) history.replaceState(null,'',`#style=${id}`);
  }
  function navigateDetail(offset) { const ids=navigationIds(),index=ids.indexOf(activeId),next=ids[index+offset]; if(next)openDetail(next); }
  async function copyText(text, success) {
    try { if(!navigator.clipboard)throw new Error('clipboard unavailable'); await navigator.clipboard.writeText(text); toast(success); }
    catch { $('copy-fallback').value=text; $('copy-dialog').showModal(); $('copy-fallback').focus(); $('copy-fallback').select(); }
  }
  function instruction(s) { return `请使用 $chaoyun-ppt-design，采用 ${s.id}「${s.name}」风格，为我提供的文章制作 PPT。请先整理内容覆盖大纲，再按该风格确认页面方案。\n\n文章内容：\n[在此粘贴文章或附上文件]`; }
  $('total-count').textContent=data.length; $('catalog-total').textContent=data.length;
  ['001','002','009'].forEach((id,i)=>{$(`hero-${'abc'[i]}`).src=byId.get(id).thumbnail;});
  const categories=[...new Set(data.flatMap(s=>s.categories))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
  $('category').innerHTML += categories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)} · ${data.filter(s=>s.categories.includes(c)).length}</option>`).join('');
  $('capacity').innerHTML += capacityOrder.map(c=>`<option value="${c}">${c}</option>`).join('');
  $('search').addEventListener('input',()=>{state.q=$('search').value;state.page=1;render();});
  $('scene-filters').addEventListener('click',e=>{const el=e.target.closest('[data-scene]');if(el){state.scene=el.dataset.scene;state.page=1;render();}});
  ['category','capacity','sort'].forEach(key=>$(key).addEventListener('change',()=>{state[key]=$(key).value;state.page=1;render();}));
  ['saved-top','saved-toggle'].forEach(id=>$(id).addEventListener('click',()=>{state.saved=!state.saved;state.page=1;render();if(id==='saved-top')$('catalog').scrollIntoView({behavior:'smooth'});}));
  $('reset').addEventListener('click',reset); $('empty-reset').addEventListener('click',reset);
  $('gallery').addEventListener('click',e=>{const open=e.target.closest('[data-open]'),save=e.target.closest('[data-save]');if(open)openDetail(open.dataset.open);if(save)toggleFavorite(save.dataset.save);});
  $('pagination').addEventListener('click',e=>{const el=e.target.closest('[data-page]');if(el&&!el.disabled){state.page=Number(el.dataset.page);render();$('catalog').scrollIntoView({behavior:'smooth'});}});
  $('save-detail').addEventListener('click',()=>toggleFavorite(activeId));
  $('copy-instruction').addEventListener('click',()=>copyText(instruction(byId.get(activeId)),'使用指令已复制，可以粘贴到 Codex'));
  $('copy-prompt').addEventListener('click',()=>copyText(byId.get(activeId).prompt,'完整风格提示词已复制'));
  $('close-copy').addEventListener('click',()=>$('copy-dialog').close());
  $('close-detail').addEventListener('click',()=>$('detail-dialog').close());
  $('detail-dialog').addEventListener('click',e=>{if(e.target===$('detail-dialog')){const r=$('detail-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('detail-dialog').close();}});
  $('detail-dialog').addEventListener('close',()=>{activeId=null;document.body.classList.remove('modal-open');document.body.appendChild($('toast'));$('toast').classList.remove('visible');if(location.hash.startsWith('#style='))history.replaceState(null,'',location.pathname+location.search+'#catalog');if(returnFocus?.isConnected)returnFocus.focus();else $('search').focus();});
  $('previous-detail').addEventListener('click',()=>navigateDetail(-1));$('next-detail').addEventListener('click',()=>navigateDetail(1));
  window.addEventListener('hashchange',()=>{const match=location.hash.match(/^#style=(\d{1,3})$/);if(match)openDetail(match[1].padStart(3,'0'),false);else if($('detail-dialog').open)$('detail-dialog').close();});
  document.addEventListener('keydown',e=>{const editing=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName);if(e.key==='/'&&!editing&&!$('detail-dialog').open){e.preventDefault();$('search').focus();}if($('detail-dialog').open&&!$('copy-dialog').open&&!editing){if(e.key==='ArrowLeft'){e.preventDefault();navigateDetail(-1);}if(e.key==='ArrowRight'){e.preventDefault();navigateDetail(1);}}});
  window.addEventListener('storage',e=>{if(e.key===storageKey){try{const ids=JSON.parse(e.newValue||'[]');if(Array.isArray(ids)){favorites=new Set(ids.filter(id=>byId.has(id)));render();if(activeId)updateFavoriteButton();}}catch{}}});
  render();const initial=location.hash.match(/^#style=(\d{1,3})$/);if(initial)openDetail(initial[1].padStart(3,'0'),false);
})();
