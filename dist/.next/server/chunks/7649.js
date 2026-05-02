"use strict";exports.id=7649,exports.ids=[7649],exports.modules={4252:(a,b,c)=>{c.d(b,{Fy:()=>i,YD:()=>h,bv:()=>j,ky:()=>g});var d=c(19284);let e=[],f=[];function g(a){e=a,f=Object.keys(a[0]||{}),(0,d.cY)("[DatasetEngine] Data loaded:",e.length,"rows,",f.length,"columns")}async function h(a="dataset"){return f}function i(){return{rowCount:e.length,columnCount:f.length,columns:f}}function j(a){(0,d.cY)("[DatasetEngine-JS] Running query:",a);let b=a.toLowerCase().trim(),c=[];if(!b.includes("select")||!b.includes("from"))return e.slice(0,100);let f=b.includes("group by");b.includes("order by"),b.includes("limit");let g=b.match(/select\s+(.+?)\s+from/i),h=g?g[1].split(",").map(a=>a.trim()):["*"],i=b.match(/group\s+by\s+(\w+)/i),j=i?i[1].replace(/['"]/g,""):null,k=b.match(/order\s+by\s+(\w+)(?:\s+(desc|asc))?/i),l=k?k[1].replace(/['"]/g,""):null,m=k&&"desc"===k[2],n=b.match(/limit\s+(\d+)/i),o=n?parseInt(n[1]):100;if(f&&j){let a={};e.forEach(b=>{let c=String(b[j]||"unknown");a[c]||(a[c]=[]),a[c].push(b)}),c=Object.entries(a).map(([a,b])=>{let c={};return c[j]=a,h.forEach(a=>{if("*"!==a&&a!==j)if(a.toUpperCase().includes("COUNT"))c[a]=b.length;else{let d=a.match(/(sum|avg|max|min)\((\w+)\)/i);if(d){let[,e,f]=d,g=b.map(a=>a[f]).filter(a=>"number"==typeof a);if(g.length>0)switch(e.toLowerCase()){case"sum":c[a]=Math.round(100*g.reduce((a,b)=>a+b,0))/100;break;case"avg":c[a]=Math.round(g.reduce((a,b)=>a+b,0)/g.length*100)/100;break;case"max":c[a]=Math.max(...g);break;case"min":c[a]=Math.min(...g)}}}}),c})}else c=e.slice(0,o);return l&&c.length>0&&c.sort((a,b)=>{let c=a[l],d=b[l];return"number"==typeof c&&"number"==typeof d?m?d-c:c-d:m?String(d).localeCompare(String(c)):String(c).localeCompare(String(d))}),c.slice(0,o)}},14588:(a,b,c)=>{Object.defineProperty(b,"I",{enumerable:!0,get:function(){return g}});let d=c(62692),e=c(40997),f=c(30278);async function g(a,b,c,g){if((0,d.isNodeNextResponse)(b)){var h;b.statusCode=c.status,b.statusMessage=c.statusText;let d=["set-cookie","www-authenticate","proxy-authenticate","vary"];null==(h=c.headers)||h.forEach((a,c)=>{if("x-middleware-set-cookie"!==c.toLowerCase())if("set-cookie"===c.toLowerCase())for(let d of(0,f.splitCookiesString)(a))b.appendHeader(c,d);else{let e=void 0!==b.getHeader(c);(d.includes(c.toLowerCase())||!e)&&b.appendHeader(c,a)}});let{originalResponse:i}=b;c.body&&"HEAD"!==a.method?await (0,e.pipeToNodeResponse)(c.body,i,g):i.end()}}},25271:(a,b,c)=>{c.d(b,{c:()=>g,iY:()=>h,YK:()=>f,od:()=>i});var d=c(19284),e=c(4252);async function f(a,b=[]){let c=a.toLowerCase();if(0===b.length)try{b=await (0,e.YD)()}catch{b=[]}(0,d.cY)("[QueryEngine] Available columns:",b);let g=b.find(a=>/revenue|income|sales/i.test(a))||"net_revenue",h=b.find(a=>/profit|earnings|net.*income/i.test(a));b.find(a=>/cost|expense|cogs/i.test(a));let i=b.find(a=>/region|territory|area/i.test(a))||"region",j=b.find(a=>/country/i.test(a))||"country",k=b.find(a=>/product|item|sku/i.test(a))||"product_category",l=b.find(a=>/customer|client/i.test(a));b.find(a=>/date|month|year|time/i.test(a));let m=b.find(a=>/quantity|qty/i.test(a))||"quantity",n=b.some(a=>/revenue|income|sales/i.test(a)),o=b.some(a=>/profit|earnings|net.*income/i.test(a));b.some(a=>/cost|expense|cogs/i.test(a));let p=b.some(a=>/region|territory|area/i.test(a)),q=b.some(a=>/country/i.test(a)),r=b.some(a=>/product|item|sku|category/i.test(a));if(b.some(a=>/customer|client/i.test(a)),b.some(a=>/date|month|year|time/i.test(a)),/most.*profitable|top.*region|top.*area|best.*region/i.test(c)){if(p&&n)return`
        SELECT ${i}, SUM(${g}) AS total_revenue
        FROM dataset
        GROUP BY ${i}
        ORDER BY total_revenue DESC
        LIMIT 10
      `;if(q&&n)return`
        SELECT ${j}, SUM(${g}) AS total_revenue
        FROM dataset
        GROUP BY ${j}
        ORDER BY total_revenue DESC
        LIMIT 10
      `}if(/by region|per region|revenue.*region|profit.*region/i.test(c)&&p&&n)return`
        SELECT ${i}, SUM(${g}) AS total_revenue
        FROM dataset
        GROUP BY ${i}
        ORDER BY total_revenue DESC
      `;if(/trend|growth|over time|by month|by year/i.test(c)){let a=b.find(a=>/month/i.test(a))||b.find(a=>/date/i.test(a)),c=n?g:o?h:null;if(a&&c)return`
        SELECT ${a}, SUM(${c}) AS ${c}
        FROM dataset
        GROUP BY ${a}
        ORDER BY ${a}
      `}if(/top.*product|best.*product|most.*sold|top.*item|by product/i.test(c)){if(r&&n)return`
        SELECT ${k}, SUM(${g}) AS total_revenue
        FROM dataset
        GROUP BY ${k}
        ORDER BY total_revenue DESC
        LIMIT 10
      `;if(r)return`
        SELECT ${k}, COUNT(*) AS count
        FROM dataset
        GROUP BY ${k}
        ORDER BY count DESC
        LIMIT 10
      `}if(/customer|client|segment/i.test(c)&&l&&n)return`
        SELECT ${l}, SUM(${g}) AS total_revenue
        FROM dataset
        GROUP BY ${l}
        ORDER BY total_revenue DESC
        LIMIT 20
      `;if(/summary|overview|total|total revenue|how much/i.test(c)&&n)return`SELECT SUM(${g}) AS total_revenue FROM dataset`;if(/average|mean|avg/i.test(c)&&n)return`SELECT AVG(${g}) AS avg_revenue FROM dataset`;if(/how many|count|number of/i.test(c))return"SELECT COUNT(*) AS total_count FROM dataset";if(/worst|lowest|underperform|declin/i.test(c)){if(r&&n)return`
        SELECT ${k}, SUM(${g}) AS total_revenue
        FROM dataset
        GROUP BY ${k}
        ORDER BY total_revenue ASC
        LIMIT 10
      `;if(p&&n)return`
        SELECT ${i}, SUM(${g}) AS total_revenue
        FROM dataset
        GROUP BY ${i}
        ORDER BY total_revenue ASC
        LIMIT 10
      `}if(/breakdown|distribution|composition|by country|by region/i.test(c)){if(p)return`
        SELECT ${i}, SUM(${g||m}) AS value
        FROM dataset
        GROUP BY ${i}
        ORDER BY value DESC
      `;if(q)return`
        SELECT ${j}, SUM(${g||m}) AS value
        FROM dataset
        GROUP BY ${j}
        ORDER BY value DESC
      `;if(r)return`
        SELECT ${k}, COUNT(*) AS count
        FROM dataset
        GROUP BY ${k}
        ORDER BY count DESC
      `}if(/channel|source|acquisition|utm/i.test(c)){let a=b.find(a=>/channel|source|utm/i.test(a));if(a&&n)return`
        SELECT ${a}, SUM(${g}) AS total_revenue
        FROM dataset
        GROUP BY ${a}
        ORDER BY total_revenue DESC
      `}return"SELECT * FROM dataset LIMIT 50"}function g(a,b){let c=a.toLowerCase();return/trend|over time|month|year|growth|increase/i.test(c)?"line":/distribution|breakdown|composition|percentage/i.test(c)&&b.length<=8?"pie":/top|most|best|worst|lowest|by region|by product/i.test(c)||/order by.*desc|order by.*asc/i.test(c)&&b.length<=15?"bar":"table"}function h(a){if(!a||0===a.length)return null;let b=a[0],c=Object.keys(b),d=["revenue","profit","sales","amount","total","count","value","sum"];for(let a of c){let b=a.toLowerCase();if(d.some(a=>b.includes(a)))return a}for(let a of c)if("number"==typeof b[a])return a;return c[c.length-1]}function i(a){let b=(a||"").toLowerCase();return["how many","how much","total","sum","average","avg","mean","highest","lowest","maximum","minimum","max","min","top","bottom","most","least","count","number of","percentage","profit","revenue","sales","margin","region","country","product","category","segment","channel"].some(a=>b.includes(a))}},37757:(a,b,c)=>{a.exports=c(44870)},42392:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{$e:()=>n,Xg:()=>o,YB:()=>m,vD:()=>l});var e=c(19284),f=c(46564),g=c(22057),h=c(25074),i=c(91791),j=c(37726),k=a([f]);f=(k.then?(await k)():k)[0];let o=2,p={analysisCount:0,total:o,subscriptionTier:"free",canAnalyze:!0,limitReached:!1};async function l(a){if((0,j.zX)(a))return{analysisCount:0,total:0,subscriptionTier:"superadmin",canAnalyze:!0,limitReached:!1};if(!a||(0,j.ub)(a))return p;let b=(0,f.L)();if(!b)return p;try{let[c,d]=await Promise.all([b.query.profiles.findFirst({where:(0,h.eq)(g.profiles.userId,a),columns:{subscriptionTier:!0}}),b.select({value:(0,i.U9)()}).from(g.datasets).where((0,h.eq)(g.datasets.userId,a))]),e=d[0]?.value||0,f=Math.min(e,o),j=c?.subscriptionTier||"free",k="pro"===j;return{analysisCount:f,total:o,subscriptionTier:j,canAnalyze:k||f<o,limitReached:!k&&f>=o}}catch(a){return(0,e.AO)("[USAGE] Failed to load analyst credits:",a),p}}async function m(a){if(!a||(0,j.ub)(a))return l(a);let b=(0,f.L)();if(!b)return p;let c=await l(a);try{return await b.update(g.profiles).set({analysisCount:c.analysisCount,updatedAt:new Date}).where((0,h.eq)(g.profiles.userId,a)),c}catch(a){return(0,e.AO)("[USAGE] Failed to consume analyst credit:",a),c}}async function n(a){return await l(a)}d()}catch(a){d(a)}})},91791:(a,b,c)=>{c.d(b,{U9:()=>e});var d=c(25738);function e(a){return(0,d.ll)`count(${a||d.ll.raw("*")})`.mapWith(Number)}}};