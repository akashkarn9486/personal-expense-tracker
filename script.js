/***********************
 * Expense Tracker JS
 * Features:
 * - Add/edit/delete transactions
 * - LocalStorage persistence
 * - Search/filter/sort
 * - Monthly view selector
 * - Charts (Category pie + 14-day trend)
 * - Export CSV / Import CSV
 * - JSON backup/restore
 * - Quick-add shortcuts
 * - Budget tracking with alerts
 * - Light/Dark theme
 ***********************/

// App state
const LS_KEY = 'expense_tracker_data_v1';
let state = {tx: [], budget: {}, categories: [], settings: {theme:'light'}};

// DOM
const form = document.getElementById('expense-form');
const descIn = document.getElementById('desc');
const amtIn = document.getElementById('amount');
const dateIn = document.getElementById('date');
const catIn = document.getElementById('category');
const payIn = document.getElementById('payment');
const tagIn = document.getElementById('tag');
const repeatIn = document.getElementById('repeat');
const txTable = document.querySelector('#tx-table tbody');
const monthTotalEl = document.getElementById('month-total');
const monthCountEl = document.getElementById('month-count');
const monthView = document.getElementById('monthView');
const filterCat = document.getElementById('filter-cat');
const searchIn = document.getElementById('search');
const sortBy = document.getElementById('sort-by');
const exportBtn = document.getElementById('export-csv');
const importBtn = document.getElementById('import-csv');
const importFile = document.getElementById('import-file');
const budgetIn = document.getElementById('budget');
const setBudgetBtn = document.getElementById('set-budget');
const budgetRemaining = document.getElementById('budget-remaining');
const resetBtn = document.getElementById('reset-data');
const quickBtns = document.querySelectorAll('[data-quick]');
const toggleThemeBtn = document.getElementById('toggle-theme');
const downloadJson = document.getElementById('download-json');
const uploadJson = document.getElementById('upload-json');
const jsonFile = document.getElementById('json-file');
const monthSelector = monthView;

// Charts
let catChart, trendChart;

// Helpers
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function save(){localStorage.setItem(LS_KEY, JSON.stringify(state));}
function load(){
  const raw = localStorage.getItem(LS_KEY);
  if(raw){
    try{state = JSON.parse(raw);}catch(e){console.error('corrupt');}
  }
  // ensure arrays exist
  state.tx = state.tx || [];
  state.budget = state.budget || {};
  state.settings = state.settings || {theme:'light'};
  applyTheme();
}

function applyTheme(){
  document.body.setAttribute('data-theme', state.settings.theme || 'light');
  toggleThemeBtn.textContent = state.settings.theme === 'light' ? 'Dark' : 'Light';
}

function format(n){return Number(n).toFixed(2)}

// Setup months dropdown (past 12 months)
function setupMonths(){
  const now = new Date();
  monthSelector.innerHTML = '';
  for(let i=0;i<18;i++){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const val = d.toISOString().slice(0,7);
    const label = d.toLocaleString(undefined, {month:'short', year:'numeric'});
    const opt = document.createElement('option'); opt.value = val; opt.textContent = label;
    monthSelector.appendChild(opt);
  }
  // auto-select current month
  monthSelector.value = new Date().toISOString().slice(0,7);
}

// Render categories in filters
function refreshCategories(){
  const cats = new Set(state.tx.map(t=>t.category));
  const arr = Array.from(cats).filter(Boolean);
  // ensure default categories exist
  ['Food','Transport','Groceries','Bills','Entertainment','Health','Other'].forEach(c=>arr.indexOf(c)===-1 && arr.push(c));
  filterCat.innerHTML = '<option value="all">All categories</option>' + arr.map(c=>`<option value="${c}">${c}</option>`).join('');
  // replace category select values
  catIn.innerHTML = arr.map(c=>`<option value="${c}">${c}</option>`).join('');
}

// Add a transaction
function addTransaction(tx){
  tx.id = tx.id || uid();
  if(!tx.date) tx.date = new Date().toISOString().slice(0,10);
  state.tx.push(tx);
  save(); render();
}

// Delete
function deleteTx(id){ state.tx = state.tx.filter(t=>t.id!==id); save(); render(); }

// Edit inline (simple amount edit)
function editTx(id, data){ const idx=state.tx.findIndex(t=>t.id===id); if(idx>-1){ state.tx[idx]=Object.assign({},state.tx[idx],data); save(); render(); }}

// Get transactions for selected month
function txForMonth(month){ // month in YYYY-MM
  return state.tx.filter(t=>t.date && t.date.startsWith(month));
}

// Render table
function render(){
  refreshCategories();
  const month = monthSelector.value;
  const visible = txForMonth(month);

  // search filter
  const q = searchIn.value.trim().toLowerCase();
  let list = visible.filter(t=>{
    if(filterCat.value!=='all' && t.category!==filterCat.value) return false;
    if(!q) return true;
    return (t.description||'').toLowerCase().includes(q) || (t.tag||'').toLowerCase().includes(q) || String(t.amount).includes(q);
  });

  // sort
  const s = sortBy.value;
  list.sort((a,b)=>{
    if(s==='date_desc') return b.date.localeCompare(a.date);
    if(s==='date_asc') return a.date.localeCompare(b.date);
    if(s==='amount_desc') return b.amount - a.amount;
    if(s==='amount_asc') return a.amount - b.amount;
    return 0;
  });

  // table
  txTable.innerHTML = '';
  list.forEach(t=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.date}</td>
      <td><div style="display:flex;flex-direction:column"><strong>${escapeHtml(t.description||'')}</strong><span class="muted" style="font-size:12px">${t.payment||''}</span></div></td>
      <td>${escapeHtml(t.category||'')}</td>
      <td>${escapeHtml(t.tag||'')}</td>
      <td>₹ ${format(t.amount)}</td>
      <td style="text-align:right"><button data-id="${t.id}" class="ghost small">Edit</button>&nbsp;<button data-del="${t.id}" class="ghost small">Del</button></td>`;
    txTable.appendChild(tr);
  });

  // totals
  const total = visible.reduce((s,t)=>s + Number(t.amount||0),0);
  monthTotalEl.textContent = format(total);
  monthCountEl.textContent = visible.length;

  // budget remaining
  const b = Number(state.budget[month]||0);
  if(b>0){
    budgetRemaining.textContent = `₹ ${format(b - total)}`;
    budgetRemaining.className = (total> b) ? 'danger' : 'success';
  } else {
    budgetRemaining.textContent = '-'; budgetRemaining.className='';
  }

  // stats
  const big = visible.slice().sort((a,b)=>b.amount-a.amount)[0];
  document.getElementById('big-expense').textContent = big ? `${big.description} — ₹ ${format(big.amount)}` : '-';
  // top tag
  const tagCounts = {};
  visible.forEach(t=>{ if(t.tag) tagCounts[t.tag] = (tagCounts[t.tag]||0)+1; });
  const topTag = Object.keys(tagCounts).sort((a,b)=>tagCounts[b]-tagCounts[a])[0] || '-';
  document.getElementById('top-tag').textContent = topTag;
  // avg daily
  const daysInMonth = new Date(month.split('-')[0], Number(month.split('-')[1]), 0).getDate();
  document.getElementById('avg-daily').textContent = `₹ ${format(total / daysInMonth)}`;

  // charts
  renderCharts(visible);
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[c]); }

// Charts
function renderCharts(list){
  const byCat = {};
  list.forEach(t=> byCat[t.category] = (byCat[t.category]||0) + Number(t.amount||0));
  const labels = Object.keys(byCat);
  const values = labels.map(l=>byCat[l]);

  if(!catChart){
    const ctx = document.getElementById('catChart').getContext('2d');
    catChart = new Chart(ctx, {type:'pie',data:{labels, datasets:[{data:values}]}, options:{plugins:{legend:{position:'bottom'}}}});
  } else { catChart.data.labels = labels; catChart.data.datasets[0].data = values; catChart.update(); }

  // trend for last 14 days
  const end = new Date();
  const arr = [];
  for(let i=13;i>=0;i--){ const d = new Date(end); d.setDate(end.getDate()-i); arr.push(d); }
  const xLabels = arr.map(d=>d.toISOString().slice(0,10));
  const sums = xLabels.map(day=> list.filter(t=>t.date===day).reduce((s,t)=>s+Number(t.amount||0),0));
  if(!trendChart){
    const ctx2 = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(ctx2, {type:'bar', data:{labels:xLabels,datasets:[{label:'Daily spend',data:sums}]}, options:{plugins:{legend:{display:false}}}});
  } else { trendChart.data.labels = xLabels; trendChart.data.datasets[0].data = sums; trendChart.update(); }
}

// CSV export
function exportCSV(){
  const month = monthSelector.value;
  const txs = txForMonth(month);
  const header = ['id','date','description','amount','category','payment','tag','repeat'];
  const rows = txs.map(t=>header.map(h=>`"${String(t[h]??'').replace(/"/g,'""')}"`).join(','));
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `expenses-${month}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// CSV import (simple)
function importCSVFile(file){
  const r = new FileReader();
  r.onload = e => {
    const txt = e.target.result;
    const lines = txt.split(/\r?\n/).filter(Boolean);
    const header = lines.shift().split(',').map(h=>h.replace(/(^\"|\"$)/g,''));
    lines.forEach(line=>{
      // naive CSV parse
      const parts = line.split(',').map(c=>c.replace(/^\"|\"$/g,'').replace(/\"\"/g,'"'));
      const obj = {};
      header.forEach((h,i)=> obj[h]=parts[i]);
      const tx = {id:obj.id||uid(), date: obj.date || new Date().toISOString().slice(0,10), description: obj.description, amount: Number(obj.amount||0), category: obj.category||'Other', payment: obj.payment||'', tag: obj.tag||'', repeat: obj.repeat||'none'};
      state.tx.push(tx);
    });
    save(); render();
  };
  r.readAsText(file);
}

// JSON backup
function downloadJSON(){ const blob=new Blob([JSON.stringify(state, null, 2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='expense-backup.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function restoreJSON(file){ const r=new FileReader(); r.onload=e=>{ try{ state = JSON.parse(e.target.result); save(); render(); }catch(err){alert('Invalid JSON');} }; r.readAsText(file); }

// clear
function resetData(){ if(confirm('Clear all local data?')){ state = {tx:[], budget:{}, settings:{theme:'light'}}; save(); render(); }}

// initialize
function init(){
  load(); setupMonths();
  // set date default
  dateIn.value = new Date().toISOString().slice(0,10);

  // bind events
  form.addEventListener('submit', e=>{ e.preventDefault(); const tx={description:descIn.value, amount: Number(amtIn.value)||0, date:dateIn.value, category:catIn.value, payment:payIn.value, tag:tagIn.value, repeat:repeatIn.value}; addTransaction(tx);
    // handle repeat: create a few future occurrences for convenience
    if(repeatIn.value !== 'none'){
      const freq = repeatIn.value;
      let next = new Date(tx.date);
      for(let i=0;i<3;i++){ // create 3 future instances
        if(freq==='daily') next.setDate(next.getDate()+1);
        if(freq==='weekly') next.setDate(next.getDate()+7);
        if(freq==='monthly') next.setMonth(next.getMonth()+1);
        addTransaction(Object.assign({},tx,{date: next.toISOString().slice(0,10)}));
      }
    }
    // reset
    descIn.value=''; amtIn.value=''; tagIn.value=''; repeatIn.value='none';
  });

  monthSelector.addEventListener('change', render);
  filterCat.addEventListener('change', render);
  searchIn.addEventListener('input', ()=>{ setTimeout(render,150); });
  sortBy.addEventListener('change', render);
  exportBtn.addEventListener('click', exportCSV);
  importBtn.addEventListener('click', ()=> importFile.click());
  importFile.addEventListener('change', e=>{ if(e.target.files.length) importCSVFile(e.target.files[0]); importFile.value=''; });
  setBudgetBtn.addEventListener('click', ()=>{ const m = monthSelector.value; state.budget[m] = Number(budgetIn.value)||0; save(); render(); });
  resetBtn.addEventListener('click', resetData);
  document.addEventListener('click', e=>{
    if(e.target.dataset.del) deleteTx(e.target.dataset.del);
    if(e.target.dataset.id){ // edit button: quick inline prompt
      const id = e.target.dataset.id; const tx = state.tx.find(t=>t.id===id); if(!tx) return;
      const newAmt = prompt('Edit amount (₹)', tx.amount); const newDesc = prompt('Edit description', tx.description);
      editTx(id, {amount: Number(newAmt||tx.amount), description: newDesc||tx.description});
    }
  });

  quickBtns.forEach(b=> b.addEventListener('click', ()=>{ const obj = JSON.parse(b.dataset.quick); addTransaction(Object.assign({date: new Date().toISOString().slice(0,10)}, obj)); }));

  toggleThemeBtn.addEventListener('click', ()=>{ state.settings.theme = state.settings.theme === 'light' ? 'dark' : 'light'; applyTheme(); save(); });

  downloadJson.addEventListener('click', downloadJSON);
  uploadJson.addEventListener('click', ()=> jsonFile.click());
  jsonFile.addEventListener('change', e=>{ if(e.target.files.length) restoreJSON(e.target.files[0]); jsonFile.value=''; });

  // handle reset local on first-time empty
  if(!localStorage.getItem(LS_KEY)){
    // sample data
    const today = new Date().toISOString().slice(0,10);
    addTransaction({description:'Sample: Coffee', amount:45, date:today, category:'Food', payment:'Cash', tag:'sample'});
    addTransaction({description:'Sample: Grocery', amount:350, date:today, category:'Groceries', payment:'Card', tag:'sample'});
  }

  // populate filters and render
  render();
}

init();

// utility: simple polyfill for months dropdown when user changes locale
(function setInitialBudgetInput(){ budgetIn.value = ''; })();