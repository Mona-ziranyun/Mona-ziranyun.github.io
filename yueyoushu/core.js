export const STORAGE_KEY = 'yueyoushu-ledger-v1';
export const MAX_CENTS = 99999999999;
export function defaultCategories() {
  return [
    ['clothing','衣（打扮）',['衣服','裤子','鞋子','发饰','发胶','美发','护肤']],
    ['food','食',['买菜','聚餐','点外卖']],
    ['housing','住',['房租','水费','电费','取暖费']],
    ['transport','行',['电动车','打车','地铁','公交']],
    ['pets','宠物',['狗粮','驱虫','宠物用品']],
    ['electronics','电子产品',['AI','电脑租赁','其他会员','话费']],
    ['relationships','人情',['父母生活费','朋友结婚办事','生日礼物']]
  ].map(([id,name,items])=>({id,name,items:items.map((name,i)=>({id:`${id}_${i}`,name}))}));
}
export function categoryLabel(data,row) {
  const category=data.categories?.find(c=>c.id===row.categoryId);
  if(!category)return {name:'待分类',item:'',label:'待分类'};
  const item=category.items.find(i=>i.id===row.itemId)?.name||'';
  return {name:category.name,item,label:category.name+(item?' / '+item:'')};
}
export function suggestCategory(categories,text) {
  const raw=String(text||'').trim();
  const aliases={'外卖':'点外卖','云租电脑':'电脑租赁','给父母生活费':'父母生活费'};
  const target=aliases[raw]||raw;
  for(const c of categories){const item=c.items.find(i=>i.name===target);if(item)return {categoryId:c.id,itemId:item.id};}
  return {categoryId:null,itemId:null};
}
export const pad = n => String(n).padStart(2, '0');
export function localDate(date = new Date()) { return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`; }
export function monthShift(month, offset) { const [y,m] = month.split('-').map(Number); const d = new Date(y,m-1+offset,1); return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; }
export function validMonth(value) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0,4)) >= 1900 && Number(value.slice(0,4)) <= 2200; }
export function validDate(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !validMonth(value.slice(0,7))) return false; const [y,m,d] = value.split('-').map(Number); return d>=1 && d<=new Date(y,m,0).getDate(); }
export function toCents(value) { const s=String(value).trim(); if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('金额需大于 0，最多保留两位小数'); const [a,b='']=s.split('.'); const cents=Number(a)*100+Number(b.padEnd(2,'0')); if (!Number.isSafeInteger(cents)||cents<=0||cents>MAX_CENTS) throw new Error('请输入有效金额（最多 999,999,999.99 元）'); return cents; }
export function toBalanceCents(value) { const s=String(value).trim();return /^0+(?:\.0{1,2})?$/.test(s)?0:toCents(s); }
export function dueDate(month, day) { const [y,m] = month.split('-').map(Number); return `${month}-${pad(Math.min(day,new Date(y,m,0).getDate()))}`; }
export function recurrenceEnd(startMonth,mode,count) {
  if(!validMonth(startMonth))throw new Error('请选择有效的起始月份');
  if(mode==='ongoing')return null;
  if(mode!=='limited'||!Number.isInteger(count)||count<1||count>1200)throw new Error('持续月数需为 1–1200 之间的整数');
  const endMonth=monthShift(startMonth,count-1);if(!validMonth(endMonth))throw new Error('结束月份超出支持范围');return endMonth;
}
export function monthCount(start,end) { const a=start.split('-').map(Number),b=end.split('-').map(Number);return (b[0]-a[0])*12+b[1]-a[1]+1; }
export function hasRuleOverlap(rules,candidate) { return rules.some(r=>r.id!==candidate.id&&r.name===candidate.name&&r.day===candidate.day&&(!r.endMonth||r.endMonth>=r.startMonth)&&(!r.endMonth||r.endMonth>=candidate.startMonth)&&(!candidate.endMonth||r.startMonth<=candidate.endMonth)); }
export function fixedForMonth(data, month, today=localDate()) {
  return data.rules.filter(r=>r.startMonth<=month && (!r.endMonth||r.endMonth>=month)).map(rule=>{
    const key=`${rule.id}:${month}`; const state=data.occurrences[key]||{}; const date=dueDate(month,rule.day);
    return {id:key,ruleId:rule.id,date,note:rule.name,amountCents:state.amountCents??rule.amountCents,categoryId:rule.categoryId??null,itemId:rule.itemId??null,kind:'fixed',paid:state.paid===true,status:state.paid?'已付':date<today?'到期待付':date===today?'今日待付':'待付',day:rule.day};
  });
}
export function monthData(data, month, today=localDate()) {
  const entries=data.entries.filter(e=>e.date.startsWith(month)).map(e=>({...e,kind:'daily',paid:e.paid!==false,status:e.paid===false?'待支付':'已支出'}));
  const fixed=fixedForMonth(data,month,today); const rows=[...entries,...fixed].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  const sum=list=>list.reduce((s,e)=>s+e.amountCents,0); const paid=sum(rows.filter(e=>e.paid)); const pending=sum(rows.filter(e=>!e.paid));
  return {entries,fixed,rows,paid,pending,total:paid+pending,fixedTotal:sum(fixed),count:rows.length};
}
export function groupDays(rows) {
  const groups=new Map();
  for(const row of rows){if(!groups.has(row.date))groups.set(row.date,{date:row.date,rows:[],total:0,paid:0,pending:0});const g=groups.get(row.date);g.rows.push(row);g.total+=row.amountCents;g[row.paid?'paid':'pending']+=row.amountCents;}
  return [...groups.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
export function categorySummary(data,month,basis='paid',today=localDate()) {
  const m=monthData(data,month,today),rows=basis==='expected'?m.rows:m.rows.filter(r=>r.paid);
  const groups=data.categories.map(c=>({id:c.id,name:c.name,amount:0,count:0,paid:0,pending:0,items:[]}));
  const unclassified={id:null,name:'待分类',amount:0,count:0,paid:0,pending:0,items:[]};
  const index=new Map(groups.map(c=>[c.id,c]));index.set(null,unclassified);
  for(const row of rows){const g=index.get(row.categoryId??null)||unclassified;g.amount+=row.amountCents;g.count++;g[row.paid?'paid':'pending']+=row.amountCents;
    let sub=g.items.find(i=>i.id===(row.itemId??null));if(!sub){sub={id:row.itemId??null,name:categoryLabel(data,row).item||(g.id?'未细分项目':'待分类'),amount:0,count:0};g.items.push(sub);}sub.amount+=row.amountCents;sub.count++;
  }
  if(unclassified.count)groups.push(unclassified);
  const total=rows.reduce((s,r)=>s+r.amountCents,0);
  for(const g of groups){g.share=total?g.amount/total:0;g.items.sort((a,b)=>b.amount-a.amount);}
  return {groups,total,count:rows.length,unclassified,paid:m.paid,pending:m.pending,expected:m.total};
}
export function parseBatch(text, year) {
  const entries=[], errors=[];
  text.split(/\r?\n/).forEach((raw,index)=>{
    const line=raw.trim(); if(!line) return;
    const match=line.match(/^(?:(\d{4})[-/.年])?(\d{1,2})[-/.月](\d{1,2})(?:日)?[\s,，]+(?:[¥￥]\s*)?(\d+(?:\.\d+)?)(?:元)?(?:[\s,，]+(.*))?$/);
    if(!match) {errors.push({line:index+1,message:'请按「日期 金额 备注」填写'});return;}
    const date=`${match[1]||year}-${pad(match[2])}-${pad(match[3])}`;
    if(!validDate(date)){errors.push({line:index+1,message:'日期不存在或超出 1900–2200 年'});return;}
    try { entries.push({date,amountCents:toCents(match[4]),note:(match[5]||'日常支出').trim().slice(0,100)}); }
    catch(e){errors.push({line:index+1,message:e.message});}
  }); return {entries,errors};
}
export function defaultFunds() { return {balanceCents:null,updatedDate:null,balanceTracking:null,receivables:[]}; }
export function receivableRemaining(record) { return record.amountCents-record.repayments.reduce((s,r)=>s+r.amountCents,0); }
export function setEntryPaid(entry,paid,today=localDate()) {
  if(typeof paid!=='boolean'||!validDate(today))throw new Error('付款状态不正确');
  const previouslyPaid=entry.paid!==false;entry.paid=paid;
  if(paid&&!previouslyPaid)entry.paidDate=today;
  if(!paid)delete entry.paidDate;
  return entry;
}
function balancePayments(data,date,today) {
  const payments=data.entries.filter(e=>e.paid!==false&&(e.paidDate||e.date)>=date&&(e.paidDate||e.date)<=today).map(e=>({key:`entry:${e.id}`,amountCents:e.amountCents}));
  const rules=new Map(data.rules.map(r=>[r.id,r]));
  for(const [key,state] of Object.entries(data.occurrences)){
    if(!state.paid)continue;const split=key.lastIndexOf(':'),rule=rules.get(key.slice(0,split));if(!rule)continue;
    const paidDate=state.paidDate||dueDate(key.slice(split+1),rule.day);
    if(paidDate>=date&&paidDate<=today)payments.push({key:`fixed:${key}`,amountCents:state.amountCents??rule.amountCents});
  }
  return payments;
}
export function balanceCheckpoint(data,balanceCents,date,basis='current',today=localDate()) {
  if(!Number.isSafeInteger(balanceCents)||balanceCents<0||balanceCents>MAX_CENTS)throw new Error('请输入有效的余额');
  if(!validDate(date)||date>today)throw new Error('余额日期不能晚于今天');
  if(!['start','current'].includes(basis))throw new Error('请选择余额的扣减起点');
  return {balanceCents,updatedDate:date,balanceTracking:{basis,includedPayments:basis==='current'?balancePayments(data,date,today):[]}};
}
export function fundsSummary(data,today=localDate()) {
  const funds=data.funds||defaultFunds(),tracking=funds.balanceTracking;
  const sum=rows=>rows.reduce((s,r)=>s+r.amountCents,0);
  const deductedCents=funds.balanceCents!==null&&tracking?sum(balancePayments(data,funds.updatedDate,today))-sum(tracking.includedPayments):0;
  return {balanceCents:funds.balanceCents===null?null:funds.balanceCents-deductedCents,updatedDate:funds.updatedDate,autoBalance:!!tracking,deductedCents,receivableTotal:funds.receivables.reduce((s,r)=>s+receivableRemaining(r),0),pendingCount:funds.receivables.filter(r=>receivableRemaining(r)>0).length};
}
export function emptyData() { return {version:4,entries:[],rules:[],occurrences:{},categories:defaultCategories(),funds:defaultFunds()}; }
export function validateData(raw) {
  if(!raw||![1,2,3,4].includes(raw.version)||!Array.isArray(raw.entries)||!Array.isArray(raw.rules)||!raw.occurrences||typeof raw.occurrences!=='object'||Array.isArray(raw.occurrences)) throw new Error('备份格式不正确');
  if(raw.entries.length>100000||raw.rules.length>10000)throw new Error('备份数据过大');
  const ids=new Set(); const amount=n=>Number.isSafeInteger(n)&&n>0&&n<=MAX_CENTS; const str=s=>typeof s==='string'&&s.length>0&&s.length<=100; const id=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(s);
  const categories=raw.version===1?defaultCategories():raw.categories;
  if(!Array.isArray(categories)||categories.length>100||!categories.length)throw new Error('分类库格式不正确');
  const categoryIds=new Set(),categoryNames=new Set();
  for(const c of categories){if(!id(c.id)||categoryIds.has(c.id)||!str(c.name)||categoryNames.has(c.name)||!Array.isArray(c.items)||c.items.length>1000)throw new Error('分类库有无效或重复的分类');categoryIds.add(c.id);categoryNames.add(c.name);const itemIds=new Set(),names=new Set();for(const i of c.items){if(!id(i.id)||itemIds.has(i.id)||!str(i.name)||names.has(i.name))throw new Error('分类项目无效或重复');itemIds.add(i.id);names.add(i.name);}}
  const classification=row=>{
    if(raw.version===1)return suggestCategory(categories,row.note||row.name);
    const categoryId=row.categoryId??null,itemId=row.itemId??null;
    if(categoryId===null){if(itemId!==null)throw new Error('项目缺少所属分类');return {categoryId:null,itemId:null};}
    const category=categories.find(c=>c.id===categoryId);if(!category||(itemId!==null&&!category.items.some(i=>i.id===itemId)))throw new Error('账目引用了不存在的分类或项目');return {categoryId,itemId};
  };
  for(const e of raw.entries){if(!id(e.id)||ids.has(e.id)||!validDate(e.date)||!amount(e.amountCents)||!str(e.note)||(e.paid!==undefined&&typeof e.paid!=='boolean')||(e.paidDate!==undefined&&(!validDate(e.paidDate)||e.paid===false)))throw new Error('备份中有无效或重复的账单');ids.add(e.id);}
  ids.clear();
  for(const r of raw.rules){if(!id(r.id)||ids.has(r.id)||!str(r.name)||!amount(r.amountCents)||!Number.isInteger(r.day)||r.day<1||r.day>31||!validMonth(r.startMonth)||(r.endMonth!==null&&!validMonth(r.endMonth)))throw new Error('备份中有无效的固定支出');ids.add(r.id);}
  const occurrences=Object.create(null);
  for(const [key,state] of Object.entries(raw.occurrences)){const split=key.lastIndexOf(':');if(!ids.has(key.slice(0,split))||!validMonth(key.slice(split+1))||!state||typeof state.paid!=='boolean'||(state.amountCents!==undefined&&!amount(state.amountCents))||(state.paidDate!==undefined&&!validDate(state.paidDate)))throw new Error('备份中有无效的付款状态');occurrences[key]={paid:state.paid,...(state.amountCents!==undefined?{amountCents:state.amountCents}:{}),...(state.paidDate!==undefined?{paidDate:state.paidDate}:{})};}
  const funds=raw.funds===undefined?defaultFunds():raw.funds;
  if(!funds||Array.isArray(funds)||!(funds.balanceCents===null||Number.isSafeInteger(funds.balanceCents)&&funds.balanceCents>=0&&funds.balanceCents<=MAX_CENTS)||!(funds.updatedDate===null||validDate(funds.updatedDate))||(funds.balanceCents!==null&&!funds.updatedDate)||!Array.isArray(funds.receivables)||funds.receivables.length>10000)throw new Error('资金记录格式不正确');
  const tracking=funds.balanceTracking??null;
  if(tracking!==null){
    if(!tracking||Array.isArray(tracking)||funds.balanceCents===null||!['start','current'].includes(tracking.basis)||!Array.isArray(tracking.includedPayments)||tracking.includedPayments.length>200000||(tracking.basis==='start'&&tracking.includedPayments.length))throw new Error('余额扣减记录格式不正确');
    const keys=new Set();for(const p of tracking.includedPayments){if(!p||typeof p.key!=='string'||!(/^(?:entry:[a-zA-Z0-9_-]{1,100}|fixed:[a-zA-Z0-9_-]{1,100}:\d{4}-(?:0[1-9]|1[0-2]))$/.test(p.key))||keys.has(p.key)||!amount(p.amountCents))throw new Error('余额扣减记录无效或重复');keys.add(p.key);}
  }
  const receivableIds=new Set();
  for(const r of funds.receivables){if(!id(r.id)||receivableIds.has(r.id)||!str(r.name)||!amount(r.amountCents)||!validDate(r.date)||typeof r.note!=='string'||r.note.length>100||!Array.isArray(r.repayments)||r.repayments.length>10000)throw new Error('待收回记录格式不正确');receivableIds.add(r.id);const repayments=new Set();for(const p of r.repayments){if(!id(p.id)||repayments.has(p.id)||!amount(p.amountCents)||!validDate(p.date))throw new Error('收款记录格式不正确');repayments.add(p.id);}if(receivableRemaining(r)<0)throw new Error('收回金额不能超过待收回总额');}
  return {version:4,entries:raw.entries.map(e=>({id:e.id,date:e.date,amountCents:e.amountCents,note:e.note,...(e.paid!==undefined?{paid:e.paid}:{}),...(e.paidDate!==undefined?{paidDate:e.paidDate}:{}),...classification(e)})),rules:raw.rules.map(r=>({id:r.id,name:r.name,amountCents:r.amountCents,day:r.day,startMonth:r.startMonth,endMonth:r.endMonth,...classification(r)})),occurrences,categories:categories.map(c=>({id:c.id,name:c.name,items:c.items.map(i=>({id:i.id,name:i.name}))})),funds:{balanceCents:funds.balanceCents,updatedDate:funds.updatedDate,balanceTracking:tracking?{basis:tracking.basis,includedPayments:tracking.includedPayments.map(p=>({key:p.key,amountCents:p.amountCents}))}:null,receivables:funds.receivables.map(r=>({id:r.id,name:r.name,amountCents:r.amountCents,date:r.date,note:r.note,repayments:r.repayments.map(p=>({id:p.id,date:p.date,amountCents:p.amountCents}))}))}};
}
