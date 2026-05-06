"use strict";(()=>{var a={};a.id=276,a.ids=[276],a.modules={261:a=>{a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},19121:a=>{a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},29294:a=>{a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},44870:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{a.exports=require("crypto")},63033:a=>{a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},64321:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.r(b),c.d(b,{handler:()=>y,patchFetch:()=>x,routeModule:()=>z,serverHooks:()=>C,workAsyncStorage:()=>A,workUnitAsyncStorage:()=>B});var e=c(37757),f=c(25578),g=c(34953),h=c(77193),i=c(19355),j=c(61919),k=c(261),l=c(96705),m=c(47599),n=c(9193),o=c(73370),p=c(14588),q=c(30278),r=c(20748),s=c(25357),t=c(86439),u=c(40723),v=c(84076),w=a([v]);v=(w.then?(await w)():w)[0];let z=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/chat/route",pathname:"/api/chat",filename:"route",bundlePath:"app/api/chat/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/home/csaba/Documents/Useclever-2026/src/app/api/chat/route.ts",nextConfigOutput:"standalone",userland:v,...{}}),{workAsyncStorage:A,workUnitAsyncStorage:B,serverHooks:C}=z;function x(){return(0,g.patchFetch)({workAsyncStorage:A,workUnitAsyncStorage:B})}async function y(a,b,c){c.requestMeta&&(0,h.setRequestMeta)(a,c.requestMeta),z.isDev&&(0,h.addRequestMeta)(a,"devRequestTimingInternalsEnd",process.hrtime.bigint());let d="/api/chat/route";"/index"===d&&(d="/");let e=await z.prepare(a,b,{srcPage:d,multiZoneDraftMode:!1});if(!e)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:g,params:v,nextConfig:w,parsedUrl:x,isDraftMode:y,prerenderManifest:A,routerServerContext:B,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,resolvedPathname:E,clientReferenceManifest:F,serverActionsManifest:G}=e,H=(0,k.normalizeAppPath)(d),I=!!(A.dynamicRoutes[H]||A.routes[E]),J=async()=>((null==B?void 0:B.render404)?await B.render404(a,b,x,!1):b.end("This page could not be found"),null);if(I&&!y){let a=!!A.routes[E],b=A.dynamicRoutes[H];if(b&&!1===b.fallback&&!a){if(w.adapterPath)return await J();throw new t.NoFallbackError}}let K=null;!I||z.isDev||y||(K=E,K="/index"===K?"/":K);let L=!0===z.isDev||!I,M=I&&!L;G&&F&&(0,j.setManifestsSingleton)({page:d,clientReferenceManifest:F,serverActionsManifest:G});let N=a.method||"GET",O=(0,i.getTracer)(),P=O.getActiveScopeSpan(),Q=!!(null==B?void 0:B.isWrappedByNextServer),R=!!(0,h.getRequestMeta)(a,"minimalMode"),S=(0,h.getRequestMeta)(a,"incrementalCache")||await z.getIncrementalCache(a,w,A,R);null==S||S.resetRequestCache(),globalThis.__incrementalCache=S;let T={params:v,previewProps:A.preview,renderOpts:{experimental:{authInterrupts:!!w.experimental.authInterrupts},cacheComponents:!!w.cacheComponents,supportsDynamicResponse:L,incrementalCache:S,cacheLifeProfiles:w.cacheLife,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d,e)=>z.onRequestError(a,b,d,e,B)},sharedContext:{buildId:g}},U=new l.NodeNextRequest(a),V=new l.NodeNextResponse(b),W=m.NextRequestAdapter.fromNodeNextRequest(U,(0,m.signalFromNodeResponse)(b));try{let e,g=async a=>z.handle(W,T).finally(()=>{if(!a)return;a.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let c=O.getRootSpanAttributes();if(!c)return;if(c.get("next.span_type")!==n.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${c.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let f=c.get("next.route");if(f){let b=`${N} ${f}`;a.setAttributes({"next.route":f,"http.route":f,"next.span_name":b}),a.updateName(b),e&&e!==a&&(e.setAttribute("http.route",f),e.updateName(b))}else a.updateName(`${N} ${d}`)}),h=async e=>{var h,i;let j=async({previousCacheEntry:f})=>{try{if(!R&&C&&D&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let d=await g(e);a.fetchMetrics=T.renderOpts.fetchMetrics;let h=T.renderOpts.pendingWaitUntil;h&&c.waitUntil&&(c.waitUntil(h),h=void 0);let i=T.renderOpts.collectedTags;if(!I)return await (0,p.I)(U,V,d,T.renderOpts.pendingWaitUntil),null;{let a=await d.blob(),b=(0,q.toNodeOutgoingHttpHeaders)(d.headers);i&&(b[s.NEXT_CACHE_TAGS_HEADER]=i),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==T.renderOpts.collectedRevalidate&&!(T.renderOpts.collectedRevalidate>=s.INFINITE_CACHE)&&T.renderOpts.collectedRevalidate,e=void 0===T.renderOpts.collectedExpire||T.renderOpts.collectedExpire>=s.INFINITE_CACHE?void 0:T.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:d.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:e}}}}catch(b){throw(null==f?void 0:f.isStale)&&await z.onRequestError(a,b,{routerKind:"App Router",routePath:d,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:M,isOnDemandRevalidate:C})},!1,B),b}},k=await z.handleResponse({req:a,nextConfig:w,cacheKey:K,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:A,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,responseGenerator:j,waitUntil:c.waitUntil,isMinimalMode:R});if(!I)return null;if((null==k||null==(h=k.value)?void 0:h.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==k||null==(i=k.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});R||b.setHeader("x-nextjs-cache",C?"REVALIDATED":k.isMiss?"MISS":k.isStale?"STALE":"HIT"),y&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let l=(0,q.fromNodeOutgoingHttpHeaders)(k.value.headers);return R&&I||l.delete(s.NEXT_CACHE_TAGS_HEADER),!k.cacheControl||b.getHeader("Cache-Control")||l.get("Cache-Control")||l.set("Cache-Control",(0,r.getCacheControlHeader)(k.cacheControl)),await (0,p.I)(U,V,new Response(k.value.body,{headers:l,status:k.value.status||200})),null};Q&&P?await h(P):(e=O.getActiveScopeSpan(),await O.withPropagatedContext(a.headers,()=>O.trace(n.BaseServerSpan.handleRequest,{spanName:`${N} ${d}`,kind:i.SpanKind.SERVER,attributes:{"http.method":N,"http.target":a.url}},h),void 0,!Q))}catch(b){if(b instanceof t.NoFallbackError||await z.onRequestError(a,b,{routerKind:"App Router",routePath:H,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:M,isOnDemandRevalidate:C})},!1,B),I)throw b;return await (0,p.I)(U,V,new Response(null,{status:500})),null}}d()}catch(a){d(a)}})},64939:a=>{a.exports=import("pg")},84076:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.r(b),c.d(b,{POST:()=>y});var e=c(19284),f=c(6796),g=c(37920),h=c(46564),i=c(22057),j=c(25074),k=c(42392),l=c(37726),m=c(25271),n=c(85461),o=a([g,h,k]);function p(a){if(!a)return a;for(let b of(a=(a=(a=a.replace(/(\d+\.\d{3,})%/g,a=>parseFloat(a).toFixed(2)+"%")).replace(/(\d+\.\d{3,})(\s*%)/g,(a,b,c)=>parseFloat(b).toFixed(2)+c)).replace(/\b(\d{4,})\b/g,a=>a.startsWith("19")||a.startsWith("20")||a.includes(",")?a:Number(a).toLocaleString("en-US")),[{from:"group_by",to:"grouped by"},{from:"dataset rows",to:"items"},{from:"records",to:"items"},{from:"aggregation",to:"analysis"},{from:"SQL",to:""},{from:"select",to:""}]))a=a.replace(RegExp(b.from,"gi"),b.to);return a}async function q(a,b){(0,e.cY)("[STRICT_SQL] Generating SQL for question:",b);let c=await h.db.query.datasets.findFirst({where:(0,j.eq)(i.datasets.id,a)});if(!c)return{success:!1,error:"Dataset not found"};let d=c.data||[],f=c.columns||[];if(0===d.length)return{success:!1,error:"Dataset has no data"};(0,e.cY)("[STRICT_SQL] Dataset:",c.name,"- Rows:",d.length,"- Columns:",f.length);let g=b.toLowerCase(),k="",l=null,m=a=>f.find(b=>a.some(a=>b.toLowerCase().includes(a)));try{if(g.includes("how many row")||g.includes("count row")||g.includes("number of row"))k="SELECT COUNT(*) as count FROM dataset",l={count:d.length,operation:"count"};else if(g.includes("total")||g.includes("sum")||g.includes("revenue")||g.includes("sales")){let a=m(["revenue","sales","amount","total","price","cost"]);if(a){let b=d.reduce((b,c)=>b+(parseFloat(c[a])||0),0);k=`SELECT SUM(${a}) as total FROM dataset`,l={total:b,column:a,operation:"sum"}}}else if(g.includes("average")||g.includes("avg")||g.includes("mean")){let a=m(["revenue","sales","amount","price","cost","profit"]);if(a){let b=d.map(b=>parseFloat(b[a])||0),c=b.reduce((a,b)=>a+b,0)/b.length;k=`SELECT AVG(${a}) as average FROM dataset`,l={average:c,column:a,operation:"avg"}}}else if(g.includes("region")||g.includes("country")||g.includes("product")||g.includes("channel")||g.includes("segment")||g.includes("category")||g.includes("highest")||g.includes("lowest")||g.includes("most")||g.includes("top")||g.includes("best")||g.includes("worst")||g.includes("least")||g.includes("brings")||g.includes("generates")||g.includes("produces")){let a=m(["region","country","product","category","segment","channel","source","medium","campaign","customer","industry","area","zone"]),b=m(["revenue","sales","profit","amount","total","value","income"]);if((0,e.cY)("[STRICT_SQL] GROUP BY - groupCol:",a,"valueCol:",b),a&&b){let c={},e=0;for(let f of d){let d=f[a]||"Unknown",g=parseFloat(f[b])||0;c[d]=(c[d]||0)+g,e+=g}let f=Object.entries(c).map(([a,b])=>({name:a,value:b,pct:e>0?b/e*100:0})).sort((a,b)=>b.value-a.value);k=`SELECT ${a}, SUM(${b}) as total FROM dataset GROUP BY ${a}`,l={type:"group_by",groupBy:a,value:b,data:f,operation:"group_by"}}}else if(g.includes("minimum")||g.includes("maximum")||g.includes("lowest")||g.includes("highest")){let a=m(["revenue","sales","profit","amount","price","cost","quantity","units"]);if(a){let b=d.map(b=>parseFloat(b[a])||0),c=Math.min(...b),e=Math.max(...b),f=g.includes("minimum")||g.includes("lowest");k=`SELECT ${f?"MIN":"MAX"}(${a}) as result FROM dataset`,l={[f?"minimum":"maximum"]:f?c:e,column:a,operation:f?"min":"max"}}}else if(g.includes("profit")&&(g.includes("margin")||g.includes("percentage"))){let a=m(["revenue","sales","amount"]),b=m(["cost","unit_cost"]);if(a&&b){let c=0,e=0;for(let f of d)c+=parseFloat(f[a])||0,e+=parseFloat(f[b])||0;let f=c>0?(c-e)/c*100:0;k="SELECT ((SUM(revenue) - SUM(cost)) / SUM(revenue)) * 100 as margin FROM dataset",l={profitMargin:f,revenue:c,cost:e,operation:"margin"}}}if((0,e.cY)("[STRICT_SQL] Generated SQL:",k),(0,e.cY)("[STRICT_SQL] Result:",JSON.stringify(l)?.slice(0,200)),!k||!l)return{success:!1,error:"Could not generate SQL for this question type"};return{success:!0,sql:k,result:l}}catch(a){return(0,e.AO)("[STRICT_SQL] Error:",a.message),{success:!1,error:a.message}}}async function r(a){if(!a)return{valid:!1,error:"No datasetId provided"};let b=await h.db.query.datasets.findFirst({where:(0,j.eq)(i.datasets.id,a)});return b?{valid:!0,dataset:b}:{valid:!1,error:"Dataset not found"}}[g,h,k]=o.then?(await o)():o;let z=new Map;function s(a,b,c={}){let d={...b,...c,action:a,timestamp:new Date().toISOString(),...c.question&&{question:c.question.slice(0,200),isAnalytical:/\b(how many|how much|total|sum|count|average|avg|top|highest|lowest|minimum|maximum|revenue|profit|region|currency|list|distinct|group by|analyze)\b/i.test(c.question)},...c.sql&&{sql:c.sql.slice(0,500)},...void 0!==c.executionTime&&{executionTimeMs:c.executionTime},...void 0!==c.success&&{success:c.success}};(0,e.cY)(`[CHAT] ${a}:`,JSON.stringify(d))}function t(a,b){for(let c of({country:[/country/i,/nation/i,/market/i],region:[/region/i,/continent/i,/area/i,/zone/i],product:[/product/i,/item/i,/sku/i,/goods/i,/merchandise/i],channel:[/channel/i,/source/i,/medium/i,/platform/i],category:[/category/i,/type/i,/segment/i,/industry/i],revenue:[/revenue/i,/sales/i,/amount/i,/total/i,/income/i,/value/i],quantity:[/quantity/i,/qty/i,/units/i,/count/i,/orders/i]})[b]){let b=a.find(a=>c.test(a));if(b)return b}return null}function u(a,b,c){let d={};for(let e of a){let a=e[b]||"Unknown",f=x(e[c]);d[a]=(d[a]||0)+f}return Object.entries(d).map(([a,b])=>({name:a,value:b})).sort((a,b)=>b.value-a.value).slice(0,10)}function v(a){return a>=1e6?`${(a/1e6).toFixed(2)}M`:a>=1e3?`${(a/1e3).toFixed(2)}K`:`${a.toLocaleString("en-US",{maximumFractionDigits:2})}`}function w(a){return`${a.toFixed(2)}%`}function x(a){if(null==a||""===a)return 0;if("number"==typeof a)return a;let b=String(a).replace(/[€$¥£C$A₹CHF₽]/g,"").replace(/\s/g,""),c=b.lastIndexOf("."),d=b.lastIndexOf(",");b=d>c?b.replace(/\./g,"").replace(",","."):c>d&&-1!==d?b.replace(/,/g,""):-1!==d&&-1===c?b.replace(",","."):b.replace(/,/g,"");let e=parseFloat(b);return isNaN(e)?0:e}async function y(a){let b=null;try{let{messages:c,datasetId:d,processedData:o}=await a.json();if(!c||!Array.isArray(c))return f.NextResponse.json({success:!1,error:"Invalid request: messages array required"},{status:400});let y=c[c.length-1]?.content||"",A=/\b(how many|how much|total|sum|count|average|avg|top|highest|lowest|minimum|maximum|revenue|profit|region|currency|list|distinct|group by|analyze)\b/i.test(y);if(A&&!d)return(0,e.cY)("[CHAT] REJECTED: Analytical query without datasetId"),f.NextResponse.json({success:!1,error:"No active dataset selected or invalid dataset ID",reason:"Please select an active dataset before asking analytical questions"},{status:400});let B=await (0,g.j2)(),C=B?.user?.id;if(C&&!(0,l.ub)(C)){let a=await (0,k.vD)(C);if(a.limitReached)return(0,e.cY)("[CHAT] REJECTED: Free limit reached"),f.NextResponse.json({success:!1,error:"Free limit reached",message:"You've used your 2 included Analyst credits. Subscribe to Pro or top up your balance to continue.",upgradeRequired:!0,analysisCount:a.analysisCount,creditsRemaining:0},{status:403})}if(d){(0,e.cY)("[CHAT] Validating datasetId:",d);let a=await h.db.query.datasets.findFirst({where:(0,j.eq)(i.datasets.id,d)});if(!a)return(0,e.cY)("[CHAT] REJECTED: Dataset not found:",d),f.NextResponse.json({success:!1,error:"No active dataset selected or invalid dataset ID",reason:"Dataset not found"},{status:400});(0,e.cY)("[CHAT] Dataset validated:",a.name,"- rows:",a.rowCount)}else(0,e.cY)("[CHAT] No datasetId - non-analytical query allowed");let D=d||"no-dataset";(0,e.cY)("[CHAT] Incoming message:",y),(0,e.cY)("[CHAT] Dataset ID:",d);let E=function(a,b){let c=Date.now(),d=z.get(a);if(d){if(c-d.lastTime>6e4)return z.set(a,{count:1,lastTime:c,lastMessage:b}),{allowed:!0};if(d.lastMessage===b&&d.count>=5)return{allowed:!1,message:"Chat blocked: Same message repeated 5+ times. Please rephrase your question."};z.set(a,{count:d.count+1,lastTime:c,lastMessage:b})}else z.set(a,{count:1,lastTime:c,lastMessage:b});return{allowed:!0}}(D+":"+y.slice(0,50),y);if(!E.allowed)return s("LOOP_DETECTED",{sessionKey:D,message:y.slice(0,50)}),f.NextResponse.json({success:!1,error:E.message},{status:429});s("AI_CALL_INITIATED",{datasetId:d,messageLength:y.length});let F=A||(0,m.od)(y);if(d&&F){(0,e.cY)("[CHAT] Question requires verified computation (analytical detected:",A,", computation:",(0,m.od)(y),")");let a=await r(d);if(!a.valid)return f.NextResponse.json({success:!1,error:"No active dataset selected or invalid ID",reason:a.error},{status:400});(0,e.cY)("[STRICT_SQL] Executing strict SQL for:",y);let b=await q(d,y);if(!b.success){(0,e.cY)("[STRICT_SQL] Failed:",b.error);let a=await h.db.query.datasets.findFirst({where:(0,j.eq)(i.datasets.id,d)}),c=a?.columns||[];return f.NextResponse.json({error:"Unable to compute this question from the dataset",reason:b.error||"No matching computation pattern found",availableColumns:c,suggestion:"Try asking about: total revenue, average sales, count of rows, top products by revenue, or rephrase your question to match available columns: "+c.slice(0,10).join(", ")},{status:400})}(0,e.cY)("[STRICT_SQL] Success! Result:",JSON.stringify(b.result).slice(0,200));let c=(0,n.vw)({success:!0,computed_value:b.result.count||b.result.total||b.result.average||b.result.data||b.result.minimum||b.result.maximum||b.result.profitMargin||0,operation:b.result.operation,row_count:a.dataset?.rowCount},y),g=await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.GEMINI_API_KEY}`},body:JSON.stringify({model:"gemini-2.5-flash",messages:[{role:"system",content:n.ZF},{role:"user",content:c}],temperature:.3,max_tokens:500})});if(g.ok){let a=await g.json(),c=a.choices?.[0]?.message?.content||"",d=p(c);return f.NextResponse.json({success:!0,content:d,role:"assistant",verified:!0,computation:{operation:b.result.operation,sql:b.sql,result:b.result}})}}let G=null,H=[];if(o&&Array.isArray(o)&&o.length>0)(0,e.cY)("[CHAT] Using processed data from frontend:",o.length,"rows"),H=o.slice(0,50);else if(d){(0,e.cY)("[CHAT] Fetching dataset from database...");let a=await h.db.query.datasets.findFirst({where:(0,j.eq)(i.datasets.id,d)});if(a){G={id:a.id,name:a.name,rowCount:a.rowCount,columnCount:a.columnCount,columns:a.columns},(0,e.cY)("[CHAT] Dataset found:",G.name,"-",G.rowCount,"rows");let b=a.data||[];H=(function(a){if(!a||0===a.length)return a;let b=a[0],c=Object.keys(b),d=/price|amount|revenue|cost|total|profit|sales|value|qty|quantity/i,f=c.filter(a=>d.test(a));return(0,e.cY)("[NORMALIZE] Detected monetary columns:",f),a.map(a=>{let b={...a};for(let c of f){let d=a[c];"string"==typeof d&&/[€$¥£C$A₹CHF₽]/.test(d)&&(b[c]=x(d),(0,e.cY)(`[NORMALIZE] ${c}: "${d}" -> ${b[c]}`))}return b})})(b).slice(0,50),(0,e.cY)("[CHAT] Fetched and normalized",H.length,"sample rows for context")}else(0,e.cY)("[CHAT] Dataset not found in database")}["generate report","create report","export report","download report","make pdf","create presentation","create powerpoint","create word document","export excel","investor report","management report","board report","executive summary document","export document","investor deck","branded report","executive presentation","detailed board report"].some(a=>y.toLowerCase().includes(a));let I=`You are Clevr, elite AI analyst for startup founders and investors.

Your ONLY rule for analytical/numeric questions: ALWAYS compute using available data – no excuses, no "need more data", no "not supported".

For ANY question with ROAS, CAC, LTV, profit, margin, revenue attribution, channel performance, campaign ROI:

1. Use utm_source, utm_medium, utm_campaign for attribution when available.
2. Calculate ROAS as: ROAS = SUM(net_revenue) / SUM(estimated_ad_spend) per channel
   - If no direct ad_spend: use proxy (e.g. 10% of net_revenue as estimated cost, or average CPA from known data)
3. Calculate CAC as: total marketing_cost / new customers acquired per channel
4. Calculate LTV as: average net_revenue per customer * estimated lifespan (use 12 months default if unknown)
5. Profit: (unit_price * quantity) - discount_amount - tax - shipping - refund_amount
6. Margin %: (Profit / Gross Revenue) * 100

ALWAYS generate and EXECUTE real SQL to compute it (use datasetId from request).

If calculation impossible (no revenue, no quantity, no attribution columns):
Return ONLY: { error: "Calculation not possible – dataset lacks required columns (revenue, quantity, utm, etc.)" }

NEVER say:
- "no cost data"
- "need ad spend"
- "cannot calculate ROAS"
- "operation not supported"
- "upload dataset with..."

Response structure:
- Direct answer first (e.g. "Best ROAS is Google Ads with 4.2x")
- Breakdown/table with real numbers
- Founder action: "Double budget on X, kill Y"
- If visualization: suggest chart type

IMPORTANT: Compute ROAS, CAC, LTV, profit, margin using available columns. Use proxies if needed. NEVER refuse with 'need more data' if calculation possible. Execute SQL first. If impossible, return exact error.

Accuracy overrides fluency.
Never guess or approximate.
Never hallucinate.

IMPORTANT DOCUMENT GENERATION RULE:
If user requests: generate report, create report, download report, export report, make PDF, create presentation, PowerPoint, Word document, Excel summary, investor report, board report, management report

You MUST return ONLY valid JSON. No markdown. No explanations. No commentary. No extra text.

FORMAT DETECTION:
- PDF → "format": "pdf"
- PowerPoint/slides/presentation → "format": "ppt"
- Word/document → "format": "docx"
- Excel/spreadsheet → "format": "xlsx"
Default: "format": "pdf"

PLAN LOGIC:
- If user asks for: investor deck, branded report, executive presentation, detailed board report → "report_type": "pro"
- Otherwise → "report_type": "standard"

REQUIRED OUTPUT STRUCTURE:
{
  "action": "generate_report",
  "format": "pdf | ppt | docx | xlsx",
  "report_type": "standard | pro",
  "title": "Professional report title",
  "executive_summary": "3-6 sentence executive overview",
  "kpis": [
    {
      "name": "KPI name",
      "value": "value",
      "insight": "short interpretation"
    }
  ],
  "sections": [
    {
      "title": "Section title",
      "content": "Detailed structured business analysis"
    }
  ],
  "charts": [
    {
      "type": "bar | line | pie | table",
      "title": "Chart title",
      "x_axis": "column name",
      "y_axis": "column name",
      "reason": "why this chart is relevant"
    }
  ],
  "recommendations": [
    "Actionable recommendation 1",
    "Actionable recommendation 2"
  ]
}

CRITICAL: Return ONLY JSON. No markdown. No backticks. No explanations. No text outside JSON.

IMPORTANT: When users ask data questions (e.g., "highest revenue by country", "top products by sales"), you MUST:
1. Automatically detect relevant columns (e.g., Country, Revenue_USD, Product)
2. Perform aggregation (SUM) on the data provided
3. Sort results and return the TOP entity with exact values
4. Give a CONCISE answer with the result

Example responses:
- "USA has the highest revenue with $5,413,650 (88% of total)"
- "Excavator Titan 3000 is the top product with $2,981,507 in sales"

RESPONSE STYLE:
- Keep answers SHORT and DIRECT (1-2 sentences max)
- Always include the exact value and currency formatting (e.g., $1,234,567)
- Include percentage of total when relevant
- NEVER explain how to do the analysis - just give the answer

IMPORTANT RESTRICTIONS:
1. You MUST respond with TEXT ONLY - never execute commands
2. Do NOT attempt to run code, scripts, or any tools
3. Do NOT trigger any analysis or processing
4. Answer questions based on the provided data only
5. Never mention that you're an AI or machine learning model
6. Always respond in plain English with clear, helpful answers

MISSING DATA HANDLING:
If user asks for a metric that cannot be calculated because required columns are missing:
Return ONLY: { error: "Calculation not possible – dataset lacks required columns (revenue, quantity, utm, etc.)" }

NEVER refuse with "need more data" if calculation is possible using available columns and proxies.
Always try to compute using proxies or estimates if exact data is missing.

Example for profit without cost data:
- Use (unit_price * quantity) - discount_amount as estimated profit
- Return the calculation with note: "Estimated profit (excluding cost data)"

Always offer next steps and alternative insights.`;if(G||H.length>0){let a=G?.columns||Object.keys(H[0]||{}),b=function(a,b){let c=[],d=t(b,"country"),e=t(b,"region"),f=t(b,"product"),g=t(b,"channel");t(b,"category");let h=t(b,"revenue");if(!h)return"";if(d){let b=u(a,d,h);if(b.length>0){let a=b.reduce((a,b)=>a+b.value,0),d=b[0];c.push(`TOP COUNTRY: ${d.name} - ${v(d.value)} (${w(d.value/a*100)} of total)`),c.push(`Country rankings: ${b.slice(0,5).map((a,b)=>`${b+1}. ${a.name}: ${v(a.value)}`).join(", ")}`)}}if(e){let b=u(a,e,h);if(b.length>0){let a=b.reduce((a,b)=>a+b.value,0),d=b[0];c.push(`TOP REGION: ${d.name} - ${v(d.value)} (${w(d.value/a*100)} of total)`),c.push(`Region rankings: ${b.slice(0,5).map((a,b)=>`${b+1}. ${a.name}: ${v(a.value)}`).join(", ")}`)}}if(f){let b=u(a,f,h);if(b.length>0){let a=b.reduce((a,b)=>a+b.value,0),d=b[0];c.push(`TOP PRODUCT: ${d.name} - ${v(d.value)} (${w(d.value/a*100)} of total)`),c.push(`Product rankings: ${b.slice(0,5).map((a,b)=>`${b+1}. ${a.name}: ${v(a.value)}`).join(", ")}`)}}if(g){let b=u(a,g,h);if(b.length>0){let a=b.reduce((a,b)=>a+b.value,0),d=b[0];c.push(`TOP CHANNEL: ${d.name} - ${v(d.value)} (${w(d.value/a*100)} of total)`)}}return c.join("\n")}(H,a);G?I+=`

DATASET OVERVIEW:
- Name: ${G.name}
- Total Rows: ${G.rowCount}
- Columns: ${a.join(", ")}

AGGREGATED INSIGHTS (pre-computed for you):
${b}

Use these pre-computed insights to answer questions DIRECTLY. When asked about top performing entities, reference the rankings above.`:I+=`

AGGREGATED INSIGHTS:
${b}

Use these rankings to answer questions directly.`}else I+=`

No dataset is currently loaded. Ask the user to upload a CSV file first.`;if(I+=`

Remember: Respond with TEXT ONLY. Do not execute any commands or tools.`,(0,e.cY)("[GEMINI] API Key present:",!!process.env.GEMINI_API_KEY),!process.env.GEMINI_API_KEY)return f.NextResponse.json({success:!1,error:"AI service not configured. Please contact support."});let J=await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.GEMINI_API_KEY}`},body:JSON.stringify({model:"gemini-2.5-flash",messages:[{role:"system",content:I},...c],temperature:.3,max_tokens:1500})});if((0,e.cY)("[GEMINI] Status:",J.status),!J.ok){let a=await J.text();return(0,e.AO)("[GEMINI ERROR]",J.status,a),f.NextResponse.json({success:!1,error:`AI service error: ${J.status}`},{status:J.status})}let K=await J.json(),L=K.choices?.[0]?.message?.content||"";return(0,e.cY)("[GEMINI] Response received:",L.slice(0,100)),s("AI_CALL_COMPLETE",{datasetId:d,responseLength:L.length}),b={success:!0,content:p(L),role:"assistant"},f.NextResponse.json(b)}catch(a){return(0,e.AO)("[CHAT CRASH]",{message:a.message,stack:a.stack?.slice(0,500)}),f.NextResponse.json({success:!1,error:a.message||"An unexpected error occurred. Please try again."},{status:500})}}d()}catch(a){d(a)}})},85461:(a,b,c)=>{c.d(b,{ZF:()=>d,vw:()=>e});let d=`You are an explanation engine for data analytics results.

🚨 STRICT RESPONSE RULES - ALWAYS FOLLOW:

1. Format numbers with thousand separators.
   Example: 74403 → 74,403

2. Percentages must have maximum 2 decimal places.
   Example: 24.68178696894002% → 24.68%

3. If user asks for TOP result, return only the single best result.
   Do NOT list all items unless explicitly asked for ranking.

4. Never display technical database terms.
   Replace: group_by → grouped by
   Replace: records → items
   Replace: dataset rows → items
   Replace: aggregation → analysis

Your job is to explain what the verified result means in plain language.
Do not speculate. Do not add context not provided in the result.

If the result contains "data" array, extract exact values from each item.
If the result is a single value, state it exactly as provided.`;function e(a,b){return a.success?`ORIGINAL QUESTION:
${b}

VERIFIED RESULT:
${JSON.stringify({computed_value:a.computed_value,column:a.column,operation:a.operation,row_count:a.row_count,metadata:a.metadata},null,2)}

Generate a clear, concise explanation of this result. Use the exact numbers provided. Do not compute or estimate anything.`:`ORIGINAL QUESTION:
${b}

ERROR:
${a.error?.userMessage||"An error occurred during computation"}

Explain to the user that the computation could not be completed and suggest they try a different question.`}},86439:a=>{a.exports=require("next/dist/shared/lib/no-fallback-error.external")}};var b=require("../../../webpack-runtime.js");b.C(a);var c=b.X(0,[4657,6796,817,4819,7841,4349,7700,7649],()=>b(b.s=64321));module.exports=c})();