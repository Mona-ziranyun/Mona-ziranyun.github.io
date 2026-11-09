import {STORAGE_KEY,localDate,monthShift,validMonth,validDate,toCents,monthData,parseBatch,emptyData,validateData,groupDays,categoryLabel,suggestCategory,categorySummary,recurrenceEnd,monthCount,toBalanceCents,fundsSummary,receivableRemaining,hasRuleOverlap,balanceCheckpoint,setEntryPaid} from './core.js?v=4';
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const paths={chart:'M4 20V4M4 20h17M8 16v-4M13 16V8M18 16V5',folder:'M3 7V4h6l3 3h9v13H3z',grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',list:'M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01',repeat:'M4 8h13l-4-4M20 16H7l4 4M20 5v5M4 19v-5',download:'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',upload:'M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5',plus:'M12 5v14M5 12h14',left:'m14 6-6 6 6 6',right:'m10 6 6 6-6 6',down:'m6 9 6 6 6-6',wallet:'M4 5h14v4M4 5a2 2 0 0 0 0 4h16v12H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm16 8h-5v4h5M16 15h.01',calendar:'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h3M8 17h3',paste:'M9 4H5v17h14V4h-4M9 3h6v4H9zM8 12h8M8 16h5',search:'M20 20l-5-5M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14',info:'M12 11v6M12 7h.01M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0',x:'m6 6 12 12M6 18 18 6','arrow-up-right':'M6 18 18 6M6 6h12v12',edit:'m15 4 5 5M4 20l5-1L21 7l-5-5L4 14z',trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',home:'m3 11 9-8 9 8M5 10v11h14V10M9 21v-8h6v8',check:'m5 12 4 4L19 6'};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.list}"/></svg>`;
const icons=()=>$$('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon)});
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(cents,sign=true)=>(sign?'¥':'')+(cents/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const shortDate=date=>`${Number(date.slice(5,7))}月${Number(date.slice(8))}日`;
const monthLabel=month=>`${month.slice(0,4)}年 ${Number(month.slice(5))}月`;
const id=()=>globalThis.crypto?.randomUUID?.()||`e${Date.now()}_${Math.random().toString(36).slice(2)}`;
let today=localDate(),month=today.slice(0,7),data=emptyData(),view='overview',filter='all',categoryFilter='all',reportBasis='paid',page=0,editing=null,adjusting=null,loadError='',unreadableRaw=null;
try{const raw=localStorage.getItem(STORAGE_KEY);if(raw){unreadableRaw=raw;const parsed=JSON.parse(raw);data=validateData(parsed);if(parsed.version===1){try{if(!localStorage.getItem(STORAGE_KEY+'-before-categories'))localStorage.setItem(STORAGE_KEY+'-before-categories',raw);}catch{}}unreadableRaw=null;}}catch(e){loadError='已有账目无法读取，请先下载备份或恢复有效备份。';}
let toastTimer,selectedDay=null,classifying=null,customTarget=null,ruleAutoCategory=true,editingPeriod=null,editingReceivable=null,repaying=null;
const pickerStates={};
const excludedMonthCategories=new Set();
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4300);}
function save(next,allowRecovery=false){if(loadError&&!allowRecovery){toast(loadError);return false;}try{const clean=validateData(next);localStorage.setItem(STORAGE_KEY,JSON.stringify(clean));data=clean;loadError='';unreadableRaw=null;render();return true;}catch(e){toast(e.name==='QuotaExceededError'?'浏览器空间不足，请先下载备份。账目尚未保存。':`保存失败：${e.message}`);return false;}}
function clone(){return JSON.parse(JSON.stringify(data));}
function openDialog(selector){const dialog=$(selector);dialog.showModal();return dialog;}
function updateEntryPaymentHint(){const paid=$('input[name="entry-payment"]:checked').value==='paid';$('#entry-payment-hint').textContent=paid?'已实际付款，计入已支出并更新余额。':'只记这一次，不会每月重复；实际付款后再点“确认已付”，现在不扣余额。';$('#entry-submit').textContent=paid?'保存这一笔':'保存待支付';}
function entryOpen(entry=null,preferredDate=null){editing=entry?.id||null;$('#entry-title').textContent=entry?'修改这一笔':'记下这一笔';$('#entry-amount').value=entry?(entry.amountCents/100).toFixed(2):'';$('#entry-date').value=entry?.date||preferredDate||(month===today.slice(0,7)?today:`${month}-01`);$('#entry-note').value=entry?.note||'';$('#entry-error').textContent='';$(`input[name="entry-payment"][value="${entry?.paid===false?'pending':'paid'}"]`).checked=true;updateEntryPaymentHint();setPicker('entry',entry||{});openDialog('#entry-dialog');$('#entry-amount').focus();}
function ruleOpen(){const form=$('#fixed-form');form.reset();$('#rule-name').value='房租';$('#rule-day').value='25';$('#rule-start').value=month;$('#rule-error').textContent='';ruleAutoCategory=true;updateDuration('rule');setPicker('rule',suggestCategory(data.categories,'房租'));openDialog('#fixed-dialog');$('#rule-amount').focus();}
function confirmAction(title,message,label,action){$('#confirm-title').textContent=title;$('#confirm-message').textContent=message;$('#confirm-action').textContent=label;$('#confirm-action').onclick=()=>{if(action()!==false)$('#confirm-dialog').close();};openDialog('#confirm-dialog');}
function actionButtons(row){return row.kind==='fixed'?`<button class="row-action" data-action="adjust" data-id="${esc(row.id)}" aria-label="调整${esc(row.note)}当月金额" title="调整当月金额">${icon('edit')}</button>`:`<button class="row-action" data-action="edit" data-id="${esc(row.id)}" aria-label="修改${esc(row.note)}" title="修改">${icon('edit')}</button><button class="row-action" data-action="delete" data-id="${esc(row.id)}" aria-label="删除${esc(row.note)}" title="删除">${icon('trash')}</button>`;}
function entryPaymentButton(row){return row.kind==='daily'&&(!row.paid||row.paidDate)?`<button class="entry-payment-button" data-action="toggle-entry" data-id="${esc(row.id)}" aria-label="${row.paid?'撤销':'确认'}${esc(row.note)}已付">${row.paid?'撤销已付':'确认已付'}</button>`:'';}
function billRows(rows){return `<table class="bill-table"><thead><tr><th>支出事项</th><th class="amount-col">金额</th><th class="action-col">操作</th></tr></thead><tbody>${rows.map(row=>`<tr><td><span class="bill-note">${esc(row.note)}</span><span class="bill-meta ${row.paid?'':'pending'}">${row.kind==='fixed'?'固定支出 · ':''}${esc(row.status)}</span><button class="category-chip ${row.categoryId?'':'unclassified'}" data-action="classify" data-id="${esc(row.id)}" aria-label="设置${esc(row.note)}的分类">${esc(categoryLabel(data,row).label)}</button>${entryPaymentButton(row)}</td><td class="amount-col">${money(row.amountCents)}</td><td class="action-col">${actionButtons(row)}</td></tr>`).join('')}</tbody></table>`;}
function render(){
  today=localDate();const m=monthData(data,month,today);
  $('#month-picker').value=month;$('#month-label').textContent=monthLabel(month);$('#month-watermark').textContent=month.slice(5);$('#this-month').hidden=month===today.slice(0,7);
  $('#selected-view-month').textContent=`当前月份 · ${monthLabel(month)}`;
  $('#prev-month').disabled=month==='1900-01';$('#next-month').disabled=month==='2200-12';
  $('#total-amount').textContent=money(m.total,false);$('#paid-amount').textContent=money(m.paid);$('#pending-amount').textContent=money(m.pending);
  const paidRows=m.rows.filter(r=>r.paid),pending=m.rows.filter(r=>!r.paid);$('#mobile-total-detail').textContent=`已支出 ${money(m.paid)}  ·  待支付 ${money(m.pending)}`;$('#paid-caption').textContent=paidRows.length?`${paidRows.length} 笔已支出 · 已记账或已确认付款`:'本月还没有已付账单';
  $('#pending-caption').textContent=pending.length?`${pending.length} 笔待支付 · 付款后记得确认`:'本月没有待支付的账目';$('#paid-track').style.width=`${m.total?m.paid/m.total*100:0}%`;
  const prev=monthData(data,monthShift(month,-1),today);
  $('#comparison').textContent=!m.count?'从第一笔开始，了解你的开销':!prev.count?'每一笔记录，都是生活的足迹':prev.total===m.total?'与上月开销持平':`比上月${m.total>prev.total?'多':'少'} ${money(Math.abs(m.total-prev.total))} · 按预计开销比较`;
  renderCalendar(m);renderDay();renderMonthlyDetails(m);
  renderFunds();refreshCategories();renderMonthCategoryCalculator();$('#bill-count').textContent=m.count;renderBills(m);renderFixed(m);renderRules();renderReport();
  $('#storage-label').textContent=loadError?'数据需恢复':'保存在当前浏览器';
  icons();
}
function renderMonthlyDetails(m){
  const paid=m.rows.filter(r=>r.paid),pending=m.rows.filter(r=>!r.paid);
  const rows=list=>list.length?list.map(r=>`<div class="summary-expense-row"><div><b>${esc(r.note)}</b><small>${esc(r.date)} · ${esc(categoryLabel(data,r).label)}${r.kind==='fixed'?' · 每月固定':!r.paid?' · 单次待支付':''}</small></div><div class="summary-expense-payment"><strong>${money(r.amountCents)}</strong>${!r.paid?`<button class="paid-toggle" data-action="${r.kind==='fixed'?'toggle':'toggle-entry'}" data-id="${esc(r.id)}" aria-label="确认${esc(r.note)}已付">确认已付</button>`:''}</div></div>`).join(''):'<div class="empty-state"><p>本月还没有这类账目。</p></div>';
  $('#paid-summary-list').innerHTML=rows(paid);$('#pending-summary-list').innerHTML=rows(pending);
}
function renderBills(m){
  const query=$('#search').value.trim().toLowerCase();const rows=m.rows.filter(r=>(filter==='all'||r.kind===filter)&&(categoryFilter==='all'||(categoryFilter==='uncategorized'?!r.categoryId:r.categoryId===categoryFilter))&&(!query||r.note.toLowerCase().includes(query)));
  const days=groupDays(rows),perPage=7;page=Math.min(page,Math.max(0,Math.ceil(days.length/perPage)-1));
  if(!rows.length){$('#bills-list').innerHTML=`<div class="empty-state"><div class="empty-drawing">${icon('wallet')}</div><h3>${m.count?'没有找到对应的账单':'这个月，还等你写下第一笔'}</h3><p>${m.count?'试试切换类型，或换个搜索词':'只要日期和金额，日合计、月合计就交给这里。'}</p>${m.count?'':'<button class="text-button" data-action="add">记下第一笔 '+icon('right')+'</button>'}</div>`;}
  else{$('#bills-list').innerHTML=days.slice(page*perPage,(page+1)*perPage).map(g=>`<div class="daily-group"><div class="daily-heading"><div><b>${shortDate(g.date)}</b><span>${g.rows.length} 笔${g.date===today?' · 今天':''}</span></div><div class="daily-sum"><small>日合计${g.pending?' · 预计':''}</small><strong>${money(g.total)}</strong></div></div>${g.pending?`<div class="daily-payment-info">已花 ${money(g.paid)}<span>待付 ${money(g.pending)}</span></div>`:''}${billRows(g.rows)}</div>`).join('');}
  $('#table-footer').innerHTML=`<span>${rows.length} 笔 · ${days.length} 个记账日${filter!=='all'||categoryFilter!=='all'||query?' · 当前筛选':''}</span>${days.length>perPage?`<div class="pager"><button data-page="-1" aria-label="上一页" ${page===0?'disabled':''}>‹</button>${page+1} / ${Math.ceil(days.length/perPage)}<button data-page="1" aria-label="下一页" ${(page+1)*perPage>=days.length?'disabled':''}>›</button></div>`:`<span>月合计 ${money(rows.reduce((s,r)=>s+r.amountCents,0))}</span>`}`;
}
function renderCalendar(m){
  const groups=new Map(groupDays(m.rows).map(g=>[g.date,g]));const [y,mo]=month.split('-').map(Number),first=(new Date(y,mo-1,1).getDay()+6)%7,days=new Date(y,mo,0).getDate(),cells=Math.ceil((first+days)/7)*7;
  $('#calendar-grid').innerHTML=Array.from({length:cells},(_,index)=>{
    const day=index-first+1;if(day<1||day>days){const adjacent=new Date(y,mo-1,day);return `<div class="calendar-cell adjacent" aria-hidden="true"><span class="calendar-date">${adjacent.getDate()}</span></div>`;}
    const date=`${month}-${String(day).padStart(2,'0')}`,g=groups.get(date),isToday=date===today;
    return `<div class="calendar-cell ${isToday?'is-today':''} ${selectedDay===date?'is-selected':''} ${g?'has-expense':''} ${g?.pending?'has-pending':''} ${index%7>4?'weekend':''}" data-calendar-date="${date}"><button type="button" class="calendar-day-view" data-date="${date}" aria-expanded="${selectedDay===date}" aria-controls="selected-day-panel" aria-label="${date}${isToday?' 今天':''}，日合计${money(g?.total||0)}${g?.pending?'，其中待付'+money(g.pending):''}，点击查看当天明细"><span class="calendar-date">${day}${isToday?'<span class="today-mark">今天</span>':''}</span><strong class="calendar-amount">${g?(g.total%100===0?'¥'+(g.total/100).toLocaleString('zh-CN'):money(g.total)):'¥0'}</strong><span class="calendar-meta">${g?g.pending?`待付 ${money(g.pending)}`:`${g.rows.length} 笔支出`:''}</span></button><button type="button" class="calendar-add" data-add-date="${date}" aria-label="给${date}记一笔" title="给${shortDate(date)}记一笔">${icon('plus')}</button></div>`;
  }).join('');
  $('#calendar-month-total').textContent=`月合计 ${money(m.total)}`;
}
function renderDay(){
  $('#selected-day-panel').hidden=!selectedDay;if(!selectedDay)return;const m=monthData(data,selectedDay.slice(0,7),today),rows=m.rows.filter(r=>r.date===selectedDay),g=groupDays(rows)[0]||{total:0,paid:0,pending:0};const [y,mo,d]=selectedDay.split('-').map(Number),weekday=['周日','周一','周二','周三','周四','周五','周六'][new Date(y,mo-1,d).getDay()];
  $('#day-title').textContent=`${shortDate(selectedDay)} · ${weekday}`;$('#day-total-label').textContent=g.pending?'日合计 · 含待付':'日合计';$('#day-total').textContent=money(g.total);$('#day-paid').textContent=`已支出 ${money(g.paid)}`;$('#day-pending').textContent=g.pending?`待付 ${money(g.pending)}`:'';
  $('#day-bills').innerHTML=rows.length?billRows(rows)+rows.filter(r=>r.kind==='fixed').map(r=>`<div class="day-fixed-action"><span>${esc(r.note)}</span><button class="paid-toggle ${r.paid?'is-paid':''}" data-action="toggle" data-id="${esc(r.id)}">${r.paid?'已付 ✓ · 点击撤销':'标记已付'}</button></div>`).join(''):'<div class="empty-state"><p>这一天还没有记录，记下第一笔吧。</p></div>';
}
function renderFixed(m){
  $('#fixed-list').innerHTML=m.fixed.length?m.fixed.sort((a,b)=>a.date.localeCompare(b.date)).map(r=>`<div class="fixed-row"><div class="fixed-day">${Number(r.date.slice(8))}<span>${Number(month.slice(5))}月</span></div><div class="fixed-info"><b>${esc(r.note)}</b><small>${r.paid?'每月固定 · 本月已付':`${shortDate(r.date)} · ${esc(r.status)}`}</small><button class="category-chip fixed-category-chip" data-action="classify" data-id="${esc(r.id)}">${esc(categoryLabel(data,r).label)}</button></div><div class="fixed-right"><strong>${money(r.amountCents)}</strong><button class="paid-toggle ${r.paid?'is-paid':''}" data-action="toggle" data-id="${esc(r.id)}" aria-label="${r.paid?'撤销':'确认'}${esc(r.note)}已付">${r.paid?'已付 ✓':'标记已付'}</button></div></div>`).join(''):`<div class="fixed-empty"><div class="fixed-illustration">${icon('home')}</div><h3>每月 25 号，<br>让房租准时出现在账本里。</h3><p>填一次金额，之后每个月自动帮你算。</p><button data-action="new-rule">设置我的房租 ${icon('right')}</button></div>`;
}
function renderRules(){
  $('#rules-list').innerHTML=data.rules.length?data.rules.map(r=>{const ended=r.endMonth&&r.endMonth<month;const period=r.endMonth?monthCount(r.startMonth,r.endMonth)>0?`持续 ${monthCount(r.startMonth,r.endMonth)} 个月 · 至 ${monthLabel(r.endMonth)}`:`${monthLabel(monthShift(r.endMonth,1))}起停用`:'长期持续';return `<div class="rule-card ${ended?'stopped':''}"><div class="rule-icon">${icon('repeat')}</div><div class="rule-copy"><h3>${esc(r.name)}</h3><button class="category-chip" data-action="classify-rule" data-id="${esc(r.id)}">${esc(categoryLabel(data,r).label)}</button><p>每月 ${r.day} 号 · ${monthLabel(r.startMonth)}起<br>${period}</p></div><strong>${money(r.amountCents)}</strong><div class="rule-manage-actions"><button class="text-button" data-action="edit-period" data-id="${esc(r.id)}">持续时间</button>${ended?'<span class="tag">已结束</span>':`<button class="text-button" data-action="stop" data-id="${esc(r.id)}">停用</button>`}</div></div>`;}).join(''):'<div class="empty-state"><p>还没有固定支出。设置后，就会从起始月份自动列入日合计和月合计。</p></div>';
}
function setView(next){if(next!=='overview'){selectedDay=null;renderDay();renderCalendar(monthData(data,month,today));}view=next;document.body.className=`view-${view}`;const titles={overview:['每一天，都心里有数','一张日历，看清每天花了多少。','月度看板'],bills:['每一天，花在哪里','按天算合计，按月看全部。','支出明细'],fixed:['固定的开销，提前有数','房租、话费、会员，设好一次，每月不漏。','固定支出'],report:['这个月，钱花在哪里','用你自己的分类，看清每个方面的开销。','月度总结'],categories:['我的生活，我来分类','只保留你需要的分类，跟着生活慢慢补充。','我的分类库']};$('#view-title').innerHTML=`${titles[view][0]}<span>。</span>`;$('#view-subtitle').textContent=titles[view][1];$('#breadcrumb-view').textContent=titles[view][2];$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#rules-section').hidden=view!=='fixed';$('#report-panel').hidden=view!=='report';$('#categories-panel').hidden=view!=='categories';}
function setMonth(next){if(!validMonth(next))return;if(next!==month)selectedDay=null;month=next;page=0;render();}
function batchPreview(){const year=Number($('#batch-year').value);let parsed={entries:[],errors:[]};if(!Number.isInteger(year)||year<1900||year>2200)parsed.errors.push({line:'',message:'请填写 1900–2200 之间的年份'});else parsed=parseBatch($('#batch-text').value,year);const sum=parsed.entries.reduce((s,e)=>s+e.amountCents,0);$('#batch-error').textContent=parsed.errors.slice(0,6).map(e=>`${e.line?'第 '+e.line+' 行：':''}${e.message}`).join('\n');$('#batch-preview').innerHTML=parsed.entries.length?`<b>识别到 ${parsed.entries.length} 笔 · 合计 ${money(sum)}</b>${parsed.entries.slice(0,4).map(e=>`<div class="preview-line"><span>${esc(e.date)} · ${esc(e.note)}</span><span>${money(e.amountCents)}</span></div>`).join('')}${parsed.entries.length>4?`<small>另外还有 ${parsed.entries.length-4} 笔</small>`:''}`:'';$('#batch-submit').disabled=!parsed.entries.length||!!parsed.errors.length;$('#batch-submit').textContent=parsed.errors.length?'请先修正格式，再一起保存':parsed.entries.length?`保存 ${parsed.entries.length} 笔开销`:'先填写你的开销';return parsed;}
const downloadsReady=window.claude?.use?window.claude.use('downloads').catch(()=>null):Promise.resolve(null);
async function download(content,filename,type){const d=await downloadsReady;if(d){try{await d.save({filename,data:new Blob([content],{type})});}catch(e){if(e?.code!=='declined')toast('无法保存文件：'+(e?.message||'当前页面不支持下载'));}return;}const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function csvCell(value){let s=String(value);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
const percent=n=>(n*100).toFixed(1)+'%';
const categoryColors=['#91ad76','#d7ad7a','#89a9a0','#a7a2bf','#c6a67c','#87a6b1','#c99591'];
function setPicker(prefix,row={}){
  const c=data.categories.find(c=>c.id===row.categoryId);const itemId=c?.items.some(i=>i.id===row.itemId)?row.itemId:null;
  pickerStates[prefix]={categoryId:c?.id??null,itemId};fillPicker(prefix);
}
function getPicker(prefix){return {...(pickerStates[prefix]||{categoryId:null,itemId:null})};}
function fillPicker(prefix){
  const state=getPicker(prefix),category=data.categories.find(c=>c.id===state.categoryId);const select=$(`#${prefix}-category`),items=$(`#${prefix}-item`);if(!select||!items)return;
  select.innerHTML='<option value="">稍后分类（待分类）</option>'+data.categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')+'<option value="__custom__">＋ 自定义一级分类…</option>';select.value=category?.id||'';
  items.innerHTML='<option value="">不细分项目</option>'+(category?category.items.map(i=>`<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')+'<option value="__custom__">＋ 自定义项目…</option>':'');items.value=state.itemId||'';items.disabled=!category;
}
function refreshCategories(){
  for(const prefix of ['entry','rule','batch','adjust','classify'])fillPicker(prefix);
  $('#bills-category-filter').innerHTML='<option value="all">所有分类</option>'+data.categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')+'<option value="uncategorized">待分类</option>';$('#bills-category-filter').value=categoryFilter;
  $('#category-library').innerHTML=data.categories.map((c,i)=>`<article class="library-card"><div class="library-card-title"><span style="--category-color:${categoryColors[i%categoryColors.length]}">${esc(c.name)}</span><button class="row-action" data-category-action="rename-category" data-category="${esc(c.id)}" aria-label="重命名${esc(c.name)}">${icon('edit')}</button></div><div class="library-items">${c.items.map(item=>`<button data-category-action="rename-item" data-category="${esc(c.id)}" data-item="${esc(item.id)}" title="修改项目名称">${esc(item.name)}</button>`).join('')}<button class="library-add" data-category-action="add-item" data-category="${esc(c.id)}">＋ 自定义</button></div><p>${c.items.length} 个项目 · 点击名称可修改</p></article>`).join('');
}
function customOpen(type,categoryId=null,prefix=null,itemId=null){
  customTarget={type,categoryId,prefix,itemId};const category=data.categories.find(c=>c.id===categoryId),item=category?.items.find(i=>i.id===itemId);const rename=type.startsWith('rename');
  $('#custom-category-title').textContent=type.endsWith('category')?(rename?'修改分类名称':'自定义一级分类'):(rename?'修改项目名称':'自定义项目');
  $('#custom-category-description').textContent=category?`所属分类：${category.name}。${rename?'修改名称后，已有账目会使用新名称，金额不变。':'加入后，下次记账就能直接选择。'}`:'按你的实际生活命名，之后可以继续添加具体项目。';
  $('#custom-category-name').value=rename?(item?.name||category?.name||''):'';$('#custom-category-error').textContent='';openDialog('#custom-category-dialog');$('#custom-category-name').focus();
}
function classifyOpen(row){
  classifying={id:row.id,ruleId:row.ruleId,kind:row.kind};setPicker('classify',row);$('#classify-label').textContent=`${row.note} · ${money(row.amountCents)}`;
  $('#classify-scope').textContent=row.kind==='fixed'?'将分类应用到这项固定支出的所有月份，金额和付款状态保持原样。':'只修改这一笔的分类，金额和日期保持原样。';openDialog('#classify-dialog');
}
function reportInsights(summary){
  const lines=[];if(!summary.count){lines.push(reportBasis==='paid'?'本月还没有已付支出记录。':'本月还没有录入账目。');if(summary.pending)lines.push(`还有 ${money(summary.pending)} 待支付，可切换“预计含待支付”查看。`);return lines;}
  const largest=summary.groups.filter(g=>g.id&&g.amount).sort((a,b)=>b.amount-a.amount)[0];
  if(largest)lines.push(`已分类支出中，“${largest.name}”最多，为 ${money(largest.amount)}，占本月${reportBasis==='paid'?'已支出':'预计开销'}的 ${percent(largest.share)}。`);
  const previous=categorySummary(data,monthShift(month,-1),reportBasis,today);if(previous.count){const diff=summary.total-previous.total;lines.push(diff?`按同一统计口径，比上月${diff>0?'多':'少'} ${money(Math.abs(diff))}。`:'按同一统计口径，与上月持平。');}
  if(summary.unclassified.count)lines.push(`还有 ${summary.unclassified.count} 笔、${money(summary.unclassified.amount)} 待分类，已计入合计，补齐后分类占比会更完整。`);
  if(reportBasis==='paid'&&summary.pending)lines.push(`另有 ${money(summary.pending)} 待支付，没有算进已支出。`);
  if(!lines.length)lines.push(`本月已录入 ${summary.count} 笔，共 ${money(summary.total)}。`);return lines;
}
function renderReport(){
  const summary=categorySummary(data,month,reportBasis,today),insights=reportInsights(summary);$('#report-basis-label').textContent=reportBasis==='paid'?'本月已支出':'本月预计开销 · 含待支付';$('#report-total').textContent=money(summary.total);$('#report-record-count').textContent=`${summary.count} 笔记录 · ${monthLabel(month)}`;$('#report-insights').innerHTML=insights.map(line=>`<p>${esc(line)}</p>`).join('');
  $('#category-totals').innerHTML=summary.groups.map((g,i)=>`<details class="category-detail ${g.id?'':'category-unclassified'}"><summary><span class="category-summary-name"><i style="background:${categoryColors[i%categoryColors.length]}"></i>${esc(g.name)}<small>${g.count} 笔</small></span><span class="category-summary-bar"><i style="width:${g.share*100}%;background:${categoryColors[i%categoryColors.length]}"></i></span><strong>${money(g.amount)}</strong><span class="category-share">${percent(g.share)}</span><span class="category-chevron">⌄</span></summary><div class="category-detail-body">${g.items.length?g.items.map(item=>`<div class="category-item-total"><span>${esc(item.name)} <small>${item.count} 笔</small></span><strong>${money(item.amount)}</strong></div>`).join(''):'<p class="no-category-expense">这个月还没有这类支出。</p>'}${g.count?`<button class="text-button" data-show-category="${esc(g.id||'uncategorized')}">查看这类账单 ${icon('right')}</button>`:''}</div></details>`).join('');$('#category-grand-total').textContent=money(summary.total);
}
function initCategoryUI(){
  for(const prefix of ['entry','rule','batch','adjust','classify']){
    setPicker(prefix,{});
    $(`#${prefix}-category`).onchange=e=>{if(prefix==='rule')ruleAutoCategory=false;const selected=e.target.value;if(selected==='__custom__'){fillPicker(prefix);customOpen('add-category',null,prefix);return;}setPicker(prefix,{categoryId:selected||null});};
    $(`#${prefix}-item`).onchange=e=>{if(prefix==='rule')ruleAutoCategory=false;if(e.target.value==='__custom__'){fillPicker(prefix);customOpen('add-item',getPicker(prefix).categoryId,prefix);return;}pickerStates[prefix].itemId=e.target.value||null;};
  }
  $('#rule-name').oninput=()=>{if(ruleAutoCategory)setPicker('rule',suggestCategory(data.categories,$('#rule-name').value));};
  $('#new-category').onclick=()=>customOpen('add-category');
  $('#category-library').onclick=e=>{const b=e.target.closest('[data-category-action]');if(b)customOpen(b.dataset.categoryAction,b.dataset.category,null,b.dataset.item);};
  $('#custom-category-form').onsubmit=e=>{e.preventDefault();try{const name=$('#custom-category-name').value.trim();if(!name)throw new Error('请填写名称');const next=clone(),target=customTarget;let category=next.categories.find(c=>c.id===target.categoryId),categoryId=category?.id,itemId=null;
    if(target.type.endsWith('category')){if(next.categories.some(c=>c.name===name&&c.id!==categoryId))throw new Error('这个分类已经存在，可以直接选择');if(target.type==='add-category'){categoryId=id();next.categories.push({id:categoryId,name,items:[]});}else category.name=name;}
    else{if(!category)throw new Error('请先选择所属分类');if(category.items.some(i=>i.name===name&&i.id!==target.itemId))throw new Error('这个项目已经存在，可以直接选择');if(target.type==='add-item'){itemId=id();category.items.push({id:itemId,name});}else{itemId=target.itemId;category.items.find(i=>i.id===itemId).name=name;}}
    if(save(next)){if(target.prefix)setPicker(target.prefix,{categoryId,itemId});$('#custom-category-dialog').close();toast(target.type.startsWith('rename')?'名称已更新，账目金额不变':'已加入你的分类库，下次可直接选择');}
  }catch(error){$('#custom-category-error').textContent=error.message;}};
  $('#classify-form').onsubmit=e=>{e.preventDefault();const next=clone(),row=classifying?.kind==='fixed'?next.rules.find(r=>r.id===classifying.ruleId):next.entries.find(r=>r.id===classifying?.id);if(!row)return toast('这笔账目已不存在');Object.assign(row,getPicker('classify'));if(save(next)){$('#classify-dialog').close();toast('分类已保存，月度总结已更新');}};
  $('#bills-category-filter').onchange=e=>{categoryFilter=e.target.value;page=0;render();};
  $$('[data-basis]').forEach(b=>b.onclick=()=>{reportBasis=b.dataset.basis;$$('[data-basis]').forEach(x=>x.classList.toggle('active',x===b));renderReport();});
  $('#category-totals').onclick=e=>{const b=e.target.closest('[data-show-category]');if(b){categoryFilter=b.dataset.showCategory;filter='all';$('#search').value='';page=0;$$('[data-filter]').forEach(x=>x.classList.toggle('active',x.dataset.filter==='all'));setView('bills');render();}};
  $('#report-export').onclick=()=>{const summary=categorySummary(data,month,reportBasis,today);const lines=[`${monthLabel(month)} · 月有数月度总结`,`统计口径：${reportBasis==='paid'?'已支出（不含待付）':'预计开销（含待支付）'}`,`合计：${money(summary.total)}，${summary.count} 笔`,...summary.groups.map(g=>`${g.name}：${money(g.amount)}，占 ${percent(g.share)}，${g.count} 笔${g.items.length?'\n'+g.items.map(i=>`  ${i.name}：${money(i.amount)}（${i.count} 笔）`).join('\n'):''}`),'',...reportInsights(summary),'','仅基于已录入账目，未录入的消费未计入。'];download(lines.join('\n'),`月有数-${month}-月度分类总结.txt`,'text/plain;charset=utf-8');toast('月度分类总结已导出');};
}
function updateDuration(prefix){
  const limited=$(`input[name="${prefix}-duration"]:checked`).value==='limited';$(`#${prefix}-duration-details`).hidden=!limited;if(!limited)return;
  const start=prefix==='rule'?$('#rule-start').value:editingPeriod?.startMonth;
  try{const end=recurrenceEnd(start,'limited',Number($(`#${prefix}-months`).value));$(`#${prefix}-end-preview`).textContent=`从 ${monthLabel(start)}算第 1 个月，最后一次在 ${monthLabel(end)}。`;}
  catch(e){$(`#${prefix}-end-preview`).textContent=e.message;}
}
function periodOpen(rule){editingPeriod={id:rule.id,startMonth:rule.startMonth};$('#period-label').textContent=`${rule.name} · ${monthLabel(rule.startMonth)}开始，每月 ${rule.day} 号`;
  const limited=rule.endMonth&&monthCount(rule.startMonth,rule.endMonth)>0;$(`input[name="period-duration"][value="${limited?'limited':'ongoing'}"]`).checked=true;$('#period-months').value=limited?monthCount(rule.startMonth,rule.endMonth):3;$('#period-error').textContent='';updateDuration('period');openDialog('#period-dialog');
}
function initDurationUI(){
  for(const prefix of ['rule','period']){$$(`input[name="${prefix}-duration"]`).forEach(i=>i.onchange=()=>updateDuration(prefix));$(`#${prefix}-months`).oninput=()=>updateDuration(prefix);}
  $('#rule-start').oninput=()=>updateDuration('rule');
  $('#period-form').onsubmit=e=>{e.preventDefault();try{const endMonth=recurrenceEnd(editingPeriod.startMonth,$('input[name="period-duration"]:checked').value,Number($('#period-months').value));const next=clone();const rule=next.rules.find(r=>r.id===editingPeriod.id);if(!rule)throw new Error('固定支出已不存在');if(hasRuleOverlap(next.rules,{...rule,endMonth}))throw new Error('修改后会与另一项同名固定支出的月份重叠，请先检查');rule.endMonth=endMonth;if(save(next)){$('#period-dialog').close();toast(endMonth?`持续时间已更新，最后一期在 ${monthLabel(endMonth)}`:'已更新为长期持续');}}catch(error){$('#period-error').textContent=error.message;}};
}
function renderFunds(){
  const f=fundsSummary(data,today);$('#available-balance').textContent=f.balanceCents===null?'待设置':money(f.balanceCents);$('#available-balance').classList.toggle('balance-unset',f.balanceCents===null);$('#balance-updated').textContent=f.updatedDate?`余额基准日期：${f.updatedDate} · ${f.autoBalance?'记账后自动扣减':'待设置自动扣减'}`:'设置起始余额，之后记账自动扣减';$('#balance-open').innerHTML=`${f.balanceCents===null?'设置余额':f.autoBalance?'核对余额':'设置自动扣减'} ${icon('edit')}`;
  $('#receivable-total').textContent=money(f.receivableTotal);$('#receivable-caption').textContent=f.pendingCount?`${f.pendingCount} 笔待收回 · 未计入可用余额`:'单独记录，不计入目前可用余额';$('#receivable-dialog-total').textContent=money(f.receivableTotal);
  $('#receivable-list').innerHTML=data.funds.receivables.length?data.funds.receivables.map(r=>{const left=receivableRemaining(r),received=r.amountCents-left;return `<details class="receivable-record"><summary><span>${esc(r.name)}<small>${left?'待收回':'已收齐'}</small></span><strong>${money(left)}</strong></summary><div class="receivable-record-body"><p>${esc(r.date)}登记 · 原记 ${money(r.amountCents)} · 已收 ${money(received)}</p>${r.note?`<p>${esc(r.note)}</p>`:''}<div class="receivable-actions"><button class="text-button" data-fund-action="edit" data-id="${esc(r.id)}">修改记录</button>${left?`<button class="btn secondary" data-fund-action="repay" data-id="${esc(r.id)}">登记收回</button>`:''}</div>${r.repayments.map(p=>`<div class="repayment-line"><span>${esc(p.date)} 收回 ${money(p.amountCents)}</span><button class="text-button" data-fund-action="undo" data-id="${esc(r.id)}" data-repayment="${esc(p.id)}">撤销</button></div>`).join('')}</div></details>`;}).join(''):'<div class="empty-state"><div class="empty-drawing">'+icon('wallet')+'</div><h3>还没有登记待收回的款项</h3><p>记下对方和金额，分次收款也能算清楚。</p></div>';
}
function receivableOpen(record=null){editingReceivable=record?.id||null;$('#receivable-entry-title').textContent=record?'修改待收回记录':'新增待收回';$('#receivable-name').value=record?.name||'';$('#receivable-amount').value=record?(record.amountCents/100).toFixed(2):'';$('#receivable-date').value=record?.date||localDate();$('#receivable-note').value=record?.note||'';$('#receivable-amount-label').textContent=record?'原记待收回总额（含已收部分）':'目前还欠你多少';$('#receivable-error').textContent='';openDialog('#receivable-entry-dialog');}
function initFundsUI(){
  $('#balance-open').onclick=()=>{const f=fundsSummary(data,localDate());$('#balance-amount').value=f.balanceCents===null?'':(f.balanceCents/100).toFixed(2);$('#balance-date').value=f.autoBalance?localDate():f.updatedDate||localDate();$('#balance-basis').value=f.autoBalance?'current':'start';$('#balance-error').textContent='';openDialog('#balance-dialog');};
  $('#balance-form').onsubmit=e=>{e.preventDefault();try{const amount=toBalanceCents($('#balance-amount').value),date=$('#balance-date').value,next=clone();Object.assign(next.funds,balanceCheckpoint(next,amount,date,$('#balance-basis').value,localDate()));if(save(next)){$('#balance-dialog').close();toast('余额已更新，记账后会自动扣减');}}catch(error){$('#balance-error').textContent=error.message;}};
  $('#receivables-open').onclick=()=>openDialog('#receivables-dialog');$('#receivable-new').onclick=()=>receivableOpen();
  $('#receivable-entry-form').onsubmit=e=>{e.preventDefault();try{const name=$('#receivable-name').value.trim(),amountCents=toCents($('#receivable-amount').value),date=$('#receivable-date').value,note=$('#receivable-note').value.trim();if(!name)throw new Error('请填写对方或事项');if(!validDate(date))throw new Error('请选择有效记录日期');const next=clone();if(editingReceivable){const record=next.funds.receivables.find(r=>r.id===editingReceivable);if(!record)throw new Error('这条记录已不存在');if(amountCents<record.repayments.reduce((s,p)=>s+p.amountCents,0))throw new Error('原记总额不能小于已经登记收回的金额');Object.assign(record,{name,amountCents,date,note});}else next.funds.receivables.push({id:id(),name,amountCents,date,note,repayments:[]});if(save(next)){$('#receivable-entry-dialog').close();toast('待收回记录已保存');}}catch(error){$('#receivable-error').textContent=error.message;}};
  $('#receivable-list').onclick=e=>{const b=e.target.closest('[data-fund-action]');if(!b)return;const record=data.funds.receivables.find(r=>r.id===b.dataset.id);if(!record)return;
    if(b.dataset.fundAction==='edit')receivableOpen(record);
    if(b.dataset.fundAction==='repay'){repaying=record.id;$('#repayment-label').textContent=`${record.name} · 尚欠 ${money(receivableRemaining(record))}`;$('#repayment-amount').value=(receivableRemaining(record)/100).toFixed(2);$('#repayment-date').value=localDate();$('#repayment-error').textContent='';openDialog('#repayment-dialog');}
    if(b.dataset.fundAction==='undo'){const receipt=record.repayments.find(p=>p.id===b.dataset.repayment);if(receipt)confirmAction('撤销这次收款登记？',`${record.name} · ${receipt.date} · ${money(receipt.amountCents)}。撤销后，这笔金额会重新计入待收回。当前可用余额不变。`,'撤销登记',()=>{const next=clone();next.funds.receivables.find(r=>r.id===record.id).repayments=record.repayments.filter(p=>p.id!==receipt.id);if(save(next))toast('已撤销收款登记，待收回金额已更新');else return false;});}
  };
  $('#repayment-form').onsubmit=e=>{e.preventDefault();try{const next=clone(),record=next.funds.receivables.find(r=>r.id===repaying),amountCents=toCents($('#repayment-amount').value),date=$('#repayment-date').value;if(!record)throw new Error('这条待收回记录已不存在');if(amountCents>receivableRemaining(record))throw new Error('本次收回不能超过尚欠金额');if(!validDate(date))throw new Error('请选择有效到账日期');record.repayments.push({id:id(),amountCents,date});if(save(next)){$('#repayment-dialog').close();toast('已登记收回，待收回金额已减少');}}catch(error){$('#repayment-error').textContent=error.message;}};
}
function initCollapsiblePanels(){
  const preferenceKey=STORAGE_KEY+'-panels';let preferences={};
  try{const value=JSON.parse(localStorage.getItem(preferenceKey)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))preferences=value;}catch{}
  function wrap(node,id,title){
    const section=document.createElement('section');section.id=id;section.className='compact-fold-section';
    const heading=document.createElement('div');heading.className='section-heading compact-fold-heading';const copy=document.createElement('div');const h2=document.createElement('h2');h2.textContent=title;copy.append(h2);heading.append(copy);
    node.before(section);section.append(heading,node);return section;
  }
  const funds=wrap($('#funds-overview'),'funds-section','当前资金');const summary=wrap($('.summary-grid'),'monthly-summary-section','本月开销');
  summary.append($('#month-category-calculator'));
  const calculator=$('#month-category-calculator'),calculatorToggle=$('#month-category-fold');let calculatorCollapsed=typeof preferences['month-category-calculator']==='boolean'?preferences['month-category-calculator']:true;
  function applyCalculator(persist=false){calculator.hidden=calculatorCollapsed;calculatorToggle.setAttribute('aria-expanded',String(!calculatorCollapsed));calculatorToggle.setAttribute('aria-label',`${calculatorCollapsed?'展开':'收起'}勾选类别看本月合计`);calculatorToggle.innerHTML=`<span>${calculatorCollapsed?'展开明细':'收起明细'}</span>${icon('down')}`;if(persist){preferences['month-category-calculator']=calculatorCollapsed;try{localStorage.setItem(preferenceKey,JSON.stringify(preferences));}catch{}}}
  calculatorToggle.onclick=()=>{calculatorCollapsed=!calculatorCollapsed;applyCalculator(true);};applyCalculator();
  const panels=[
    [funds,'funds',false],[$('.calendar-panel'),'calendar',false],
    [$('#bills-panel'),'bills',true],[$('#fixed-panel'),'fixed',false],[$('#rules-section'),'rules',false],
    [$('.report-intro'),'report-summary',false],[$('.category-breakdown'),'category-breakdown',false],[$('#categories-panel'),'category-library',false]
  ];
  for(const [panel,key,defaultCollapsed] of panels){
    const header=panel.querySelector(':scope > .section-heading');const content=document.createElement('div');content.id=`fold-${key}`;content.className='fold-content';
    for(const child of [...panel.childNodes])if(child!==header)content.append(child);panel.append(content);panel.classList.add('collapsible-panel');
    const tools=document.createElement('div');tools.className='section-header-tools';for(const child of [...header.children].slice(1))tools.append(child);
    const toggle=document.createElement('button');toggle.type='button';toggle.className='section-fold-toggle';toggle.setAttribute('aria-controls',content.id);toggle.dataset.fold=key;tools.append(toggle);header.append(tools);
    const h2=header.querySelector('h2');const title=[...h2.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim()||h2.textContent.trim();let collapsed=typeof preferences[key]==='boolean'?preferences[key]:defaultCollapsed;
    function apply(persist=false){content.hidden=collapsed;panel.classList.toggle('is-collapsed',collapsed);toggle.setAttribute('aria-expanded',String(!collapsed));toggle.setAttribute('aria-label',`${collapsed?'展开':'收起'}${title}`);toggle.innerHTML=`<span>${collapsed?'展开':'收起'}</span>${icon('down')}`;
      if(persist){preferences[key]=collapsed;try{localStorage.setItem(preferenceKey,JSON.stringify(preferences));}catch{}}
    }
    toggle.onclick=()=>{collapsed=!collapsed;apply(true);};header.firstElementChild.classList.add('section-fold-title');header.firstElementChild.addEventListener('click',e=>{if(!e.target.closest('button,a,input,select')){collapsed=!collapsed;apply(true);}});apply();
  }
  for(const [selector,key] of [['#paid-summary-panel','paid-summary'],['#pending-summary-panel','pending-summary']]){const panel=$(selector);panel.open=preferences[key]===false;panel.addEventListener('toggle',()=>{preferences[key]=!panel.open;try{localStorage.setItem(preferenceKey,JSON.stringify(preferences));}catch{}});}
}
const monthCategoryKey=id=>id===null?'unclassified':'category:'+id;
function renderMonthCategoryTotal(){
  const summary=categorySummary(data,month,'expected',today),groups=summary.groups.filter(g=>!excludedMonthCategories.has(monthCategoryKey(g.id)));
  const sum=field=>groups.reduce((total,g)=>total+g[field],0);const all=data.categories.length+1,selected=all-[...excludedMonthCategories].filter(key=>key==='unclassified'||data.categories.some(c=>monthCategoryKey(c.id)===key)).length;
  $('#month-category-total').textContent=money(sum('amount'));$('#month-category-paid').textContent=`已支出 ${money(sum('paid'))}`;$('#month-category-pending').textContent=`待支付 ${money(sum('pending'))}`;$('#month-category-count').textContent=selected?`已勾选 ${selected} / ${all} 类`:'当前没有勾选任何类别';
}
function renderMonthCategoryCalculator(){
  const categories=[...data.categories.map(c=>({id:c.id,name:c.name})),{id:null,name:'待分类'}];
  $('#month-category-checkboxes').innerHTML=categories.map(c=>`<label class="month-category-option"><input type="checkbox" value="${esc(monthCategoryKey(c.id))}" ${excludedMonthCategories.has(monthCategoryKey(c.id))?'':'checked'}><span>${esc(c.name)}</span></label>`).join('');renderMonthCategoryTotal();
}
function initMonthCategoryCalculator(){
  $('#month-category-checkboxes').onchange=e=>{if(e.target.type!=='checkbox')return;if(e.target.checked)excludedMonthCategories.delete(e.target.value);else excludedMonthCategories.add(e.target.value);renderMonthCategoryTotal();};
  $('#month-category-all').onclick=()=>{excludedMonthCategories.clear();renderMonthCategoryCalculator();};
  $('#month-category-none').onclick=()=>{for(const c of data.categories)excludedMonthCategories.add(monthCategoryKey(c.id));excludedMonthCategories.add('unclassified');renderMonthCategoryCalculator();};
}
$('#rule-day').innerHTML=Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1} 号</option>`).join('');
$('#add-open').onclick=()=>entryOpen();$('#fixed-open').onclick=ruleOpen;$('#new-rule-open').onclick=ruleOpen;
$$('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('#prev-month').onclick=()=>setMonth(monthShift(month,-1));$('#next-month').onclick=()=>setMonth(monthShift(month,1));$('#this-month').onclick=()=>setMonth(localDate().slice(0,7));$('#month-picker').onchange=e=>setMonth(e.target.value);
$('#calendar-grid').onclick=e=>{const add=e.target.closest('[data-add-date]');if(add){entryOpen(null,add.dataset.addDate);return;}const b=e.target.closest('[data-date]');if(!b)return;selectedDay=selectedDay===b.dataset.date?null:b.dataset.date;renderCalendar(monthData(data,month,today));renderDay();icons();if(selectedDay)$('#selected-day-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});};
$('#day-close').onclick=()=>{const previous=selectedDay;selectedDay=null;renderCalendar(monthData(data,month,today));renderDay();$(`[data-date="${previous}"]`)?.focus({preventScroll:true});};
$('#day-add').onclick=()=>{if(selectedDay)entryOpen(null,selectedDay);};
$$('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;page=0;$$('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));render();});$('#search').oninput=()=>{page=0;render();};
$('#table-footer').onclick=e=>{const b=e.target.closest('[data-page]');if(b){page+=Number(b.dataset.page);render();}};
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action,key=b.dataset.id;if(action==='add')return entryOpen();if(action==='new-rule')return ruleOpen();if(action==='edit-period'){const rule=data.rules.find(r=>r.id===key);if(rule)periodOpen(rule);return;}if(action==='classify-rule'){const rule=data.rules.find(r=>r.id===key);if(rule)return classifyOpen({...rule,note:rule.name,kind:'fixed',ruleId:rule.id});return;}const row=monthData(data,month,today).rows.find(r=>r.id===key);
  if(action==='classify'&&row)classifyOpen(row);
  if(action==='edit'&&row){entryOpen(row);}
  if(action==='delete'&&row)confirmAction('删除这笔支出？',`${row.date} · ${row.note} · ${money(row.amountCents)}。删除后会重新计算日合计和月合计。`,'删除',()=>{const next=clone();next.entries=next.entries.filter(x=>x.id!==key);if(save(next))toast('已删除，合计已更新');else return false;});
  if(action==='toggle'&&row){const next=clone();next.occurrences[key]={...(next.occurrences[key]||{}),paid:!row.paid,...(!row.paid?{paidDate:localDate()}:{})};if(save(next))toast(row.paid?'已撤销付款，待付与余额已更新':'已确认付款，余额与日月合计已更新');}
  if(action==='toggle-entry'&&row?.kind==='daily'){const next=clone(),entry=next.entries.find(r=>r.id===key);if(!entry)return;setEntryPaid(entry,!row.paid,localDate());if(save(next))toast(row.paid?'已改回待支付，余额已更新':'已确认付款，余额已更新，预计总额没有重复增加');}
  if(action==='adjust'&&row){adjusting=key;setPicker('adjust',row);$('#adjust-label').textContent=`${monthLabel(month)} · ${row.note}`;$('#adjust-amount').value=(row.amountCents/100).toFixed(2);$('#adjust-error').textContent='';openDialog('#adjust-dialog');}
  if(action==='stop'){const rule=data.rules.find(r=>r.id===key);if(rule)confirmAction('停用这项固定支出？',`“${rule.name}”将从${monthLabel(month)}起不再列入开销。此前月份的账目保留。如果金额变化，你也可以停用后新增一项。`,'确认停用',()=>{const next=clone();next.rules.find(r=>r.id===key).endMonth=monthShift(month,-1);if(save(next))toast('已停用，此前月份保留');else return false;});}
});
$$('input[name="entry-payment"]').forEach(i=>i.onchange=updateEntryPaymentHint);
$('#entry-form').onsubmit=e=>{e.preventDefault();try{const date=$('#entry-date').value;if(!validDate(date))throw new Error('请选择有效日期');const amountCents=toCents($('#entry-amount').value),note=$('#entry-note').value.trim()||categoryLabel(data,getPicker('entry')).item||'日常支出',paid=$('input[name="entry-payment"]:checked').value==='paid';const classification=getPicker('entry');const next=clone();if(editing){const found=next.entries.find(r=>r.id===editing);if(!found)throw new Error('账单已不存在，请重新打开');Object.assign(found,{date,amountCents,note,...classification});setEntryPaid(found,paid,localDate());}else next.entries.push({id:id(),date,amountCents,note,paid,...classification});if(save(next)){setMonth(date.slice(0,7));$('#entry-dialog').close();toast(paid?'记好了，已支出与余额已更新':'已保存这一次待支付，确认付款后再扣余额');}}catch(error){$('#entry-error').textContent=error.message;}};
$('#fixed-form').onsubmit=e=>{e.preventDefault();try{const name=$('#rule-name').value.trim(),amountCents=toCents($('#rule-amount').value),day=Number($('#rule-day').value),startMonth=$('#rule-start').value;if(!name)throw new Error('请填写固定支出名称');if(!validMonth(startMonth))throw new Error('请选择起始月份');const next=clone(),endMonth=recurrenceEnd(startMonth,$('input[name="rule-duration"]:checked').value,Number($('#rule-months').value));if(hasRuleOverlap(next.rules,{name,day,startMonth,endMonth}))throw new Error('这段时间已有同名、同日期的固定支出，请检查，避免重复计算');next.rules.push({id:id(),name,amountCents,day,startMonth,endMonth,...getPicker('rule')});if(save(next)){setMonth(startMonth);$('#fixed-dialog').close();toast(`已设置：每月 ${day} 号，${name} ${money(amountCents)}`);}}catch(error){$('#rule-error').textContent=error.message;}};
$('#adjust-form').onsubmit=e=>{e.preventDefault();try{const amountCents=toCents($('#adjust-amount').value);const next=clone();const ruleId=monthData(data,month,today).fixed.find(r=>r.id===adjusting)?.ruleId;if(!ruleId)throw new Error('固定支出已不存在');Object.assign(next.rules.find(r=>r.id===ruleId),getPicker('adjust'));next.occurrences[adjusting]={...(next.occurrences[adjusting]||{}),paid:next.occurrences[adjusting]?.paid===true,amountCents};if(save(next)){$('#adjust-dialog').close();toast('当月金额已调整，其他月份保持原设置');}}catch(error){$('#adjust-error').textContent=error.message;}};
$('#batch-open').onclick=()=>{$('#batch-form').reset();$('#batch-year').value=Number(month.slice(0,4));setPicker('batch',{});batchPreview();openDialog('#batch-dialog');$('#batch-text').focus();};$('#batch-text').oninput=batchPreview;$('#batch-year').oninput=batchPreview;
$('#batch-form').onsubmit=e=>{e.preventDefault();const parsed=batchPreview();if(parsed.errors.length||!parsed.entries.length)return;const commit=()=>{const next=clone();next.entries.push(...parsed.entries.map(r=>({...r,id:id(),...getPicker('batch')})));if(save(next)){setMonth(parsed.entries[parsed.entries.length-1].date.slice(0,7));$('#batch-dialog').close();toast(`已记下 ${parsed.entries.length} 笔，日合计和月合计已更新`);return true;}return false;};const duplicates=parsed.entries.filter((x,i)=>data.entries.some(r=>r.date===x.date&&r.amountCents===x.amountCents&&r.note===x.note)||parsed.entries.slice(0,i).some(r=>r.date===x.date&&r.amountCents===x.amountCents&&r.note===x.note));if(duplicates.length)confirmAction('有可能重复的开销',`其中 ${duplicates.length} 笔与已有账单或本次输入的日期、金额、备注相同。如果确实是不同的消费，可以继续保存。`,'仍然保存',commit);else commit();};
$('#backup-open').onclick=$('#mobile-backup-open').onclick=()=>{$('#backup-error').textContent='';$('#import-preview').hidden=true;openDialog('#backup-dialog');};
$('#backup-export').onclick=()=>{download(unreadableRaw||JSON.stringify(data,null,2),`月有数-完整备份-${localDate()}.json`,'application/json;charset=utf-8');toast('已生成完整备份，请妥善保存');};
$('#backup-import').onclick=()=>$('#backup-file').click();
$('#backup-file').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;$('#backup-error').textContent='';$('#import-preview').hidden=true;try{if(file.size>25*1024*1024)throw new Error('请选择 25 MB 以内的备份文件');const imported=validateData(JSON.parse(await file.text()));$('#import-preview').hidden=false;$('#import-preview').innerHTML=`识别到 ${imported.entries.length} 笔日常支出、${imported.rules.length} 项固定支出、${imported.categories.length} 个分类。<br>恢复会替换当前浏览器的全部账目。建议先下载当前备份。<br><button class="btn danger" id="import-confirm">确认替换并恢复</button>`;$('#import-confirm').onclick=()=>{if(save(imported,true)){$('#backup-dialog').close();toast('已恢复备份');}};}catch(error){$('#backup-error').textContent=`无法导入：${error.message}`;}};
$('#export-csv').onclick=()=>{
  const m=monthData(data,month,today);if(!m.count)return toast('这个月还没有账单');
  const lines=[['日期','备注','类型','一级分类','具体项目','金额（元）','状态'],...m.rows.map(r=>[r.date,r.note,r.kind==='fixed'?'固定支出':'日常支出',categoryLabel(data,r).name,categoryLabel(data,r).item,(r.amountCents/100).toFixed(2),r.status]),[],['月合计（预计）',(m.total/100).toFixed(2)],['月合计（已支出）',(m.paid/100).toFixed(2)],['月合计（待付）',(m.pending/100).toFixed(2)],[],['每日合计','预计（元）','已支出（元）','待付（元）'],...groupDays(m.rows).map(g=>[g.date,(g.total/100).toFixed(2),(g.paid/100).toFixed(2),(g.pending/100).toFixed(2)])];
  for(const basis of ['paid','expected']){const summary=categorySummary(data,month,basis,today);lines.push([],['分类汇总',basis==='paid'?'已支出':'预计含待支付'],['分类','金额（元）','占比','笔数'],...summary.groups.map(g=>[g.name,(g.amount/100).toFixed(2),percent(g.share),g.count]));}
  download('\uFEFF'+lines.map(l=>l.map(csvCell).join(',')).join('\r\n'),`月有数-${month}-分类与日月合计.csv`,'text/csv;charset=utf-8');toast('已导出账单、日月合计和分类汇总');
};
window.addEventListener('storage',e=>{if(e.key!==STORAGE_KEY)return;try{data=e.newValue?validateData(JSON.parse(e.newValue)):emptyData();loadError='';render();toast('已同步此浏览器另一标签页的修改');}catch(error){loadError='另一标签页的账目格式异常，请先备份。';toast(loadError);}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
initCollapsiblePanels();initMonthCategoryCalculator();initCategoryUI();initDurationUI();initFundsUI();render();if(loadError)toast(loadError);
