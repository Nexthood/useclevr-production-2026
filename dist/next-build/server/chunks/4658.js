"use strict";exports.id=4658,exports.ids=[4658],exports.modules={292202:(a,b,c)=>{c.d(b,{G3:()=>k,Iv:()=>l,Ws:()=>j,YK:()=>f,c:()=>g,iY:()=>h,kn:()=>i,mE:()=>m});var d=c(949006),e=c(645810);async function f(a,b=[]){let c=a.toLowerCase();if(0===b.length)try{b=await (0,e.YD)()}catch{b=[]}(0,d.cY)("[QueryEngine] Available columns:",b);let g=b.find(a=>/revenue|income|sales/i.test(a))||"net_revenue",h=b.find(a=>/profit|earnings|net.*income/i.test(a));b.find(a=>/cost|expense|cogs/i.test(a));let i=b.find(a=>/region|territory|area/i.test(a))||"region",j=b.find(a=>/country/i.test(a))||"country",k=b.find(a=>/product|item|sku/i.test(a))||"product_category",l=b.find(a=>/customer|client/i.test(a));b.find(a=>/date|month|year|time/i.test(a));let m=b.find(a=>/quantity|qty/i.test(a))||"quantity",n=b.some(a=>/revenue|income|sales/i.test(a)),o=b.some(a=>/profit|earnings|net.*income/i.test(a));b.some(a=>/cost|expense|cogs/i.test(a));let p=b.some(a=>/region|territory|area/i.test(a)),q=b.some(a=>/country/i.test(a)),r=b.some(a=>/product|item|sku|category/i.test(a));if(b.some(a=>/customer|client/i.test(a)),b.some(a=>/date|month|year|time/i.test(a)),/most.*profitable|top.*region|top.*area|best.*region/i.test(c)){if(p&&n)return`
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
      `}return"SELECT * FROM dataset LIMIT 50"}function g(a,b){let c=a.toLowerCase();return/trend|over time|month|year|growth|increase/i.test(c)?"line":/distribution|breakdown|composition|percentage/i.test(c)&&b.length<=8?"pie":/top|most|best|worst|lowest|by region|by product/i.test(c)||/order by.*desc|order by.*asc/i.test(c)&&b.length<=15?"bar":"table"}function h(a){if(!a||0===a.length)return null;let b=a[0],c=Object.keys(b),d=["revenue","profit","sales","amount","total","count","value","sum"];for(let a of c){let b=a.toLowerCase();if(d.some(a=>b.includes(a)))return a}for(let a of c)if("number"==typeof b[a])return a;return c[c.length-1]}function i(a,b){let c=b.map(a=>a.toLowerCase());return a.find(a=>{let b=a.toLowerCase();return c.some(a=>b.includes(a)||a.includes(b))})||null}function j(a){if(null==a||""===a)return 0;if("number"==typeof a)return a;let b=String(a).replace(/[€$¥£C$A₹CHF₽]/g,"").replace(/\s/g,""),c=b.lastIndexOf("."),d=b.lastIndexOf(","),e=parseFloat(b=d>c?b.replace(/\./g,"").replace(",","."):c>d&&-1!==d?b.replace(/,/g,""):-1!==d&&-1===c?b.replace(",","."):b.replace(/,/g,""));return isNaN(e)?0:e}function k(a){return a>=1e6?`${(a/1e6).toFixed(2)}M`:a>=1e3?`${(a/1e3).toFixed(2)}K`:`${a.toLocaleString("en-US",{maximumFractionDigits:2})}`}function l(a){return`${a.toFixed(2)}%`}function m(a,b,c,d=!0){let e={},f=0;for(let d of a){let a=d[b]||"Unknown",g=j(d[c]);e[a]=(e[a]||0)+g,f+=g}return Object.entries(e).map(([a,b])=>({name:a,value:b,pct:f>0?b/f*100:0})).sort((a,b)=>d?b.value-a.value:a.value-b.value)}},645810:(a,b,c)=>{c.d(b,{YD:()=>g,bv:()=>h});var d=c(949006);let e=[],f=[];async function g(a="dataset"){return f}function h(a,b=e){(0,d.cY)("[DatasetEngine-JS] Running query:",a);let c=a.toLowerCase().trim(),f=[];if(!c.includes("select")||!c.includes("from"))return b.slice(0,100);let g=c.includes("group by");c.includes("order by"),c.includes("limit");let i=c.match(/select\s+(.+?)\s+from/i),j=i?i[1].split(",").map(a=>a.trim()):["*"],k=c.match(/group\s+by\s+(\w+)/i),l=k?k[1].replace(/['"]/g,""):null,m=c.match(/order\s+by\s+(\w+)(?:\s+(desc|asc))?/i),n=m?m[1].replace(/['"]/g,""):null,o=m&&"desc"===m[2],p=c.match(/limit\s+(\d+)/i),q=p?parseInt(p[1]):100;if(g&&l){let a={};b.forEach(b=>{let c=String(b[l]||"unknown");a[c]||(a[c]=[]),a[c].push(b)}),f=Object.entries(a).map(([a,b])=>{let c={};return c[l]=a,j.forEach(a=>{if("*"!==a&&a!==l)if(a.toUpperCase().includes("COUNT"))c[a]=b.length;else{let d=a.match(/(sum|avg|max|min)\((\w+)\)/i);if(d){let[,e,f]=d,g=b.map(a=>a[f]).filter(a=>"number"==typeof a);if(g.length>0)switch(e.toLowerCase()){case"sum":c[a]=Math.round(100*g.reduce((a,b)=>a+b,0))/100;break;case"avg":c[a]=Math.round(g.reduce((a,b)=>a+b,0)/g.length*100)/100;break;case"max":c[a]=Math.max(...g);break;case"min":c[a]=Math.min(...g)}}}}),c})}else f=b.slice(0,q);return n&&f.length>0&&f.sort((a,b)=>{let c=a[n],d=b[n];return"number"==typeof c&&"number"==typeof d?o?d-c:c-d:o?String(d).localeCompare(String(c)):String(c).localeCompare(String(d))}),f.slice(0,q)}},664658:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{C5:()=>l,Qx:()=>m,ZB:()=>k});var e=c(223474),f=c(755151),g=c(949006),h=c(292202),i=c(502178),j=a([e]);async function k(a,b,c){(0,g.cY)("[STRICT_SQL] Generating SQL metadata:",{datasetId:a,questionLength:b.length});let d=await e.db.query.datasets.findFirst({where:(0,i.Uo)((0,i.eq)(f.datasets.id,a),(0,i.eq)(f.datasets.userId,c))});if(!d)return{success:!1,error:"Dataset not found"};let j=d.data||[],k=d.columns||[];if(0===j.length&&(j=(await e.db.query.datasetRows.findMany({where:(0,i.eq)(f.datasetRows.datasetId,a),columns:{data:!0},orderBy:(a,{asc:b})=>[b(a.rowIndex)]})).map(a=>a.data)),0===j.length)return{success:!1,error:"Dataset has no data"};(0,g.cY)("[STRICT_SQL] Dataset metadata:",{datasetId:a,rowCount:j.length,columnCount:k.length});let l=b.toLowerCase(),m="",n=null;try{if(l.includes("how many row")||l.includes("count row")||l.includes("number of row"))m="SELECT COUNT(*) as count FROM dataset",n={count:j.length,operation:"count"};else if(l.includes("total")||l.includes("sum")||l.includes("revenue")||l.includes("sales")){let a=(0,h.kn)(k,["revenue","sales","amount","total","price","cost"]);if(a){let b=j.reduce((b,c)=>b+(parseFloat(c[a])||0),0);m=`SELECT SUM(${a}) as total FROM dataset`,n={total:b,column:a,operation:"sum"}}}else if(l.includes("average")||l.includes("avg")||l.includes("mean")){let a=(0,h.kn)(k,["revenue","sales","amount","price","cost","profit"]);if(a){let b=j.map(b=>parseFloat(b[a])||0),c=b.reduce((a,b)=>a+b,0)/b.length;m=`SELECT AVG(${a}) as average FROM dataset`,n={average:c,column:a,operation:"avg"}}}else if(l.includes("region")||l.includes("country")||l.includes("product")||l.includes("channel")||l.includes("segment")||l.includes("category")||l.includes("highest")||l.includes("lowest")||l.includes("most")||l.includes("top")||l.includes("best")||l.includes("worst")||l.includes("least")||l.includes("brings")||l.includes("generates")||l.includes("produces")){let a=(0,h.kn)(k,["region","country","product","category","segment","channel","source","medium","campaign","customer","industry","area","zone"]),b=(0,h.kn)(k,["revenue","sales","profit","amount","total","value","income"]);if((0,g.cY)("[STRICT_SQL] GROUP BY metadata:",{hasGroupColumn:!!a,hasValueColumn:!!b}),a&&b){let c=(0,h.mE)(j,a,b);m=`SELECT ${a}, SUM(${b}) as total FROM dataset GROUP BY ${a}`,n={type:"group_by",groupBy:a,value:b,data:c,operation:"group_by"}}}else if(l.includes("minimum")||l.includes("maximum")||l.includes("lowest")||l.includes("highest")){let a=(0,h.kn)(k,["revenue","sales","profit","amount","price","cost","quantity","units"]);if(a){let b=j.map(b=>parseFloat(b[a])||0),c=Math.min(...b),d=Math.max(...b),e=l.includes("minimum")||l.includes("lowest");m=`SELECT ${e?"MIN":"MAX"}(${a}) as result FROM dataset`,n={[e?"minimum":"maximum"]:e?c:d,column:a,operation:e?"min":"max"}}}else if(l.includes("profit")&&(l.includes("margin")||l.includes("percentage"))){let a=(0,h.kn)(k,["revenue","sales","amount"]),b=(0,h.kn)(k,["cost","unit_cost"]);if(a&&b){let c=0,d=0;for(let e of j)c+=parseFloat(e[a])||0,d+=parseFloat(e[b])||0;let e=c>0?(c-d)/c*100:0;m="SELECT ((SUM(revenue) - SUM(cost)) / SUM(revenue)) * 100 as margin FROM dataset",n={profitMargin:e,revenue:c,cost:d,operation:"margin"}}}if((0,g.cY)("[STRICT_SQL] Computation metadata:",{generatedSql:!!m,operation:n?.operation??null,resultKeys:n?Object.keys(n):[]}),!m||!n)return{success:!1,error:"Could not generate SQL for this question type"};return{success:!0,sql:m,result:n}}catch(a){return(0,g.AO)("[STRICT_SQL] Error:",a.message),{success:!1,error:a.message}}}function l(a,b){let c=[],d=(0,h.kn)(b,["country","nation","market"]),e=(0,h.kn)(b,["region","continent","area","zone"]),f=(0,h.kn)(b,["product","item","sku","goods"]),g=(0,h.kn)(b,["channel","source","medium","platform"]),i=(0,h.kn)(b,["revenue","sales","amount","total","income","value"]);if(!i)return"";if(d){let b=(0,h.mE)(a,d,i);if(b.length>0){let a=b[0];c.push(`TOP COUNTRY: ${a.name} - ${(0,h.G3)(a.value)} (${(0,h.Iv)(a.pct)} of total)`),c.push(`Country rankings: ${b.slice(0,5).map((a,b)=>`${b+1}. ${a.name}: ${(0,h.G3)(a.value)}`).join(", ")}`)}}if(e){let b=(0,h.mE)(a,e,i);if(b.length>0){let a=b[0];c.push(`TOP REGION: ${a.name} - ${(0,h.G3)(a.value)} (${(0,h.Iv)(a.pct)} of total)`),c.push(`Region rankings: ${b.slice(0,5).map((a,b)=>`${b+1}. ${a.name}: ${(0,h.G3)(a.value)}`).join(", ")}`)}}if(f){let b=(0,h.mE)(a,f,i);if(b.length>0){let a=b[0];c.push(`TOP PRODUCT: ${a.name} - ${(0,h.G3)(a.value)} (${(0,h.Iv)(a.pct)} of total)`),c.push(`Product rankings: ${b.slice(0,5).map((a,b)=>`${b+1}. ${a.name}: ${(0,h.G3)(a.value)}`).join(", ")}`)}}if(g){let b=(0,h.mE)(a,g,i);if(b.length>0){let a=b[0];c.push(`TOP CHANNEL: ${a.name} - ${(0,h.G3)(a.value)} (${(0,h.Iv)(a.pct)} of total)`)}}return c.join("\n")}function m(a){if(!a||0===a.length)return a;let b=a[0],c=Object.keys(b),d=/price|amount|revenue|cost|total|profit|sales|value|qty|quantity/i,e=c.filter(a=>d.test(a));return(0,g.cY)("[NORMALIZE] Detected monetary column metadata:",{monetaryColumnCount:e.length}),a.map(a=>{let b={...a};for(let c of e){let d=a[c];"string"==typeof d&&/[€$¥£C$A₹CHF₽]/.test(d)&&(b[c]=(0,h.Ws)(d),(0,g.cY)("[NORMALIZE] Converted monetary value metadata:",{column:c,sourceLength:d.length,converted:!0}))}return b})}e=(j.then?(await j)():j)[0],d()}catch(a){d(a)}})}};