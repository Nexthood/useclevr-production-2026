"use strict";exports.id=2202,exports.ids=[2202],exports.modules={292202:(a,b,c)=>{c.d(b,{G3:()=>k,Iv:()=>l,Ws:()=>j,YK:()=>f,c:()=>g,iY:()=>h,kn:()=>i,mE:()=>m});var d=c(949006),e=c(645810);async function f(a,b=[],c){let g=a.toLowerCase();if(0===b.length)try{b=await (0,e.YD)()}catch{b=[]}(0,d.cY)("[QueryEngine] Available columns:",b);let h=b.find(a=>/revenue|income|sales/i.test(a))||"net_revenue",i=b.find(a=>/profit|earnings|net.*income/i.test(a));b.find(a=>/cost|expense|cogs/i.test(a));let j=b.find(a=>/region|territory|area/i.test(a))||"region",k=b.find(a=>/country/i.test(a))||"country",l=b.find(a=>/product|item|sku/i.test(a))||"product_category",m=b.find(a=>/customer|client/i.test(a));b.find(a=>/date|month|year|time/i.test(a));let q=b.find(a=>/quantity|qty/i.test(a))||"quantity",r=b.some(a=>/revenue|income|sales/i.test(a)),s=b.some(a=>/profit|earnings|net.*income/i.test(a));b.some(a=>/cost|expense|cogs/i.test(a));let t=b.some(a=>/region|territory|area/i.test(a)),u=b.some(a=>/country/i.test(a)),v=b.some(a=>/product|item|sku|category/i.test(a));if(b.some(a=>/customer|client/i.test(a)),b.some(a=>/date|month|year|time/i.test(a)),/investment.*(activity|changed|change|over time|period)|how many investments.*(over time|by period)|capital.*deployed.*(over time|period)/i.test(g)){let a=c?n(c,"investment_date"):b.find(a=>/investment[_\s-]*date|invested[_\s-]*date|deal[_\s-]*date|funding[_\s-]*date/i.test(a)),d=c?n(c,"invested_amount"):b.find(a=>/invested[_\s-]*amount|investment[_\s-]*amount|capital[_\s-]*deployed/i.test(a));if(a)return`
        SELECT ${a}, COUNT(*) AS investment_count${d?`, SUM(${d}) AS capital_deployed`:""}
        FROM dataset
        GROUP BY ${a}
        ORDER BY ${a}
      `}if(/most.*profitable|top.*region|top.*area|best.*region/i.test(g)){if(t&&r)return`
        SELECT ${j}, SUM(${h}) AS total_revenue
        FROM dataset
        GROUP BY ${j}
        ORDER BY total_revenue DESC
        LIMIT 10
      `;if(u&&r)return`
        SELECT ${k}, SUM(${h}) AS total_revenue
        FROM dataset
        GROUP BY ${k}
        ORDER BY total_revenue DESC
        LIMIT 10
      `}if(/by region|per region|revenue.*region|profit.*region/i.test(g)&&t&&r)return`
        SELECT ${j}, SUM(${h}) AS total_revenue
        FROM dataset
        GROUP BY ${j}
        ORDER BY total_revenue DESC
      `;if(/trend|growth|over time|by month|by year/i.test(g)){var w,x,y,z;let a,d,e=b.find(a=>/month/i.test(a))||b.find(a=>/date/i.test(a)),f=r?h:s?i:null;if(e&&f&&(!c||(w=c,x=f,y=e,a=o(w,x),d=o(w,y),!a||!d||("portfolio_company_annual_revenue"===a?(z=y,/^(revenue_period|reporting_period|fiscal_period|financial_period|period_end|year|fiscal_year)$/i.test(z.toLowerCase().trim().replace(/[\s-]+/g,"_").replace(/[^a-z0-9_]/g,""))&&"investment_date"!==d):"investment_date"!==d||!p.has(a)))))return`
        SELECT ${e}, SUM(${f}) AS ${f}
        FROM dataset
        GROUP BY ${e}
        ORDER BY ${e}
      `}if(/top.*product|best.*product|most.*sold|top.*item|by product/i.test(g)){if(v&&r)return`
        SELECT ${l}, SUM(${h}) AS total_revenue
        FROM dataset
        GROUP BY ${l}
        ORDER BY total_revenue DESC
        LIMIT 10
      `;if(v)return`
        SELECT ${l}, COUNT(*) AS count
        FROM dataset
        GROUP BY ${l}
        ORDER BY count DESC
        LIMIT 10
      `}if(/customer|client|segment/i.test(g)&&m&&r)return`
        SELECT ${m}, SUM(${h}) AS total_revenue
        FROM dataset
        GROUP BY ${m}
        ORDER BY total_revenue DESC
        LIMIT 20
      `;if(/summary|overview|total|total revenue|how much/i.test(g)&&r)return`SELECT SUM(${h}) AS total_revenue FROM dataset`;if(/average|mean|avg/i.test(g)&&r)return`SELECT AVG(${h}) AS avg_revenue FROM dataset`;if(/how many|count|number of/i.test(g))return"SELECT COUNT(*) AS total_count FROM dataset";if(/worst|lowest|underperform|declin/i.test(g)){if(v&&r)return`
        SELECT ${l}, SUM(${h}) AS total_revenue
        FROM dataset
        GROUP BY ${l}
        ORDER BY total_revenue ASC
        LIMIT 10
      `;if(t&&r)return`
        SELECT ${j}, SUM(${h}) AS total_revenue
        FROM dataset
        GROUP BY ${j}
        ORDER BY total_revenue ASC
        LIMIT 10
      `}if(/breakdown|distribution|composition|by country|by region/i.test(g)){if(t)return`
        SELECT ${j}, SUM(${h||q}) AS value
        FROM dataset
        GROUP BY ${j}
        ORDER BY value DESC
      `;if(u)return`
        SELECT ${k}, SUM(${h||q}) AS value
        FROM dataset
        GROUP BY ${k}
        ORDER BY value DESC
      `;if(v)return`
        SELECT ${l}, COUNT(*) AS count
        FROM dataset
        GROUP BY ${l}
        ORDER BY count DESC
      `}if(/channel|source|acquisition|utm/i.test(g)){let a=b.find(a=>/channel|source|utm/i.test(a));if(a&&r)return`
        SELECT ${a}, SUM(${h}) AS total_revenue
        FROM dataset
        GROUP BY ${a}
        ORDER BY total_revenue DESC
      `}return"SELECT * FROM dataset LIMIT 50"}function g(a,b){let c=a.toLowerCase();return/trend|over time|month|year|growth|increase/i.test(c)?"line":/distribution|breakdown|composition|percentage/i.test(c)&&b.length<=8?"pie":/top|most|best|worst|lowest|by region|by product/i.test(c)||/order by.*desc|order by.*asc/i.test(c)&&b.length<=15?"bar":"table"}function h(a){if(!a||0===a.length)return null;let b=a[0],c=Object.keys(b),d=["revenue","profit","sales","amount","total","count","value","sum"];for(let a of c){let b=a.toLowerCase();if(d.some(a=>b.includes(a)))return a}for(let a of c)if("number"==typeof b[a])return a;return c[c.length-1]}function i(a,b){let c=b.map(a=>a.toLowerCase());return a.find(a=>{let b=a.toLowerCase();return c.some(a=>b.includes(a)||a.includes(b))})||null}function j(a){if(null==a||""===a)return 0;if("number"==typeof a)return a;let b=String(a).replace(/[€$¥£C$A₹CHF₽]/g,"").replace(/\s/g,""),c=b.lastIndexOf("."),d=b.lastIndexOf(","),e=parseFloat(b=d>c?b.replace(/\./g,"").replace(",","."):c>d&&-1!==d?b.replace(/,/g,""):-1!==d&&-1===c?b.replace(",","."):b.replace(/,/g,""));return isNaN(e)?0:e}function k(a){return a>=1e6?`${(a/1e6).toFixed(2)}M`:a>=1e3?`${(a/1e3).toFixed(2)}K`:`${a.toLocaleString("en-US",{maximumFractionDigits:2})}`}function l(a){return`${a.toFixed(2)}%`}function m(a,b,c,d=!0){let e={},f=0;for(let d of a){let a=d[b]||"Unknown",g=j(d[c]);e[a]=(e[a]||0)+g,f+=g}return Object.entries(e).map(([a,b])=>({name:a,value:b,pct:f>0?b/f*100:0})).sort((a,b)=>d?b.value-a.value:a.value-b.value)}function n(a,b){return a.concepts.find(a=>a.concept===b&&"confirmed"===a.status)?.sourceColumn??null}function o(a,b){return a.concepts.find(a=>a.sourceColumn===b&&"confirmed"===a.status)?.concept??null}let p=new Set(["revenue","gross_sales","net_sales","gross_profit","operating_profit","net_profit","gmv","marketplace_revenue","subscription_revenue","mrr","arr","portfolio_company_annual_revenue"])},645810:(a,b,c)=>{c.d(b,{YD:()=>g,bv:()=>h});var d=c(949006);let e=[],f=[];async function g(a="dataset"){return f}function h(a,b=e){(0,d.cY)("[DatasetEngine-JS] Running query:",a);let c=a.toLowerCase().trim(),f=[];if(!c.includes("select")||!c.includes("from"))return b.slice(0,100);let g=c.includes("group by");c.includes("order by"),c.includes("limit");let i=c.match(/select\s+(.+?)\s+from/i),j=i?i[1].split(",").map(a=>a.trim()):["*"],k=c.match(/group\s+by\s+(\w+)/i),l=k?k[1].replace(/['"]/g,""):null,m=c.match(/order\s+by\s+(\w+)(?:\s+(desc|asc))?/i),n=m?m[1].replace(/['"]/g,""):null,o=m&&"desc"===m[2],p=c.match(/limit\s+(\d+)/i),q=p?parseInt(p[1]):100;if(g&&l){let a={};b.forEach(b=>{let c=String(b[l]||"unknown");a[c]||(a[c]=[]),a[c].push(b)}),f=Object.entries(a).map(([a,b])=>{let c={};return c[l]=a,j.forEach(a=>{if("*"!==a&&a!==l)if(a.toUpperCase().includes("COUNT"))c[a]=b.length;else{let d=a.match(/(sum|avg|max|min)\((\w+)\)/i);if(d){let[,e,f]=d,g=b.map(a=>a[f]).filter(a=>"number"==typeof a);if(g.length>0)switch(e.toLowerCase()){case"sum":c[a]=Math.round(100*g.reduce((a,b)=>a+b,0))/100;break;case"avg":c[a]=Math.round(g.reduce((a,b)=>a+b,0)/g.length*100)/100;break;case"max":c[a]=Math.max(...g);break;case"min":c[a]=Math.min(...g)}}}}),c})}else f=b.slice(0,q);return n&&f.length>0&&f.sort((a,b)=>{let c=a[n],d=b[n];return"number"==typeof c&&"number"==typeof d?o?d-c:c-d:o?String(d).localeCompare(String(c)):String(c).localeCompare(String(d))}),f.slice(0,q)}}};