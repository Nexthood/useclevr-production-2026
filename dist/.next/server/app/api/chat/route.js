"use strict";(()=>{var a={};a.id=276,a.ids=[276],a.modules={261:a=>{a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},19121:a=>{a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},29294:a=>{a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},44870:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{a.exports=require("crypto")},63033:a=>{a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},86439:a=>{a.exports=require("next/dist/shared/lib/no-fallback-error.external")},95994:(a,b,c)=>{c.r(b),c.d(b,{handler:()=>T,patchFetch:()=>S,routeModule:()=>O,serverHooks:()=>R,workAsyncStorage:()=>P,workUnitAsyncStorage:()=>Q});var d={};c.r(d),c.d(d,{POST:()=>N});var e=c(37757),f=c(25578),g=c(34953),h=c(77193),i=c(19355),j=c(61919),k=c(261),l=c(96705),m=c(47599),n=c(9193),o=c(73370),p=c(14588),q=c(30278),r=c(20748),s=c(25357),t=c(86439),u=c(40723),v=c(19284),w=c(6796),x=c(47355),y=c(46564),z=c(22057),A=c(93518),B=c(25271);let C=`You are an explanation engine for data analytics results.

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
If the result is a single value, state it exactly as provided.`;function D(a){if(!a)return a;for(let b of(a=(a=(a=a.replace(/(\d+\.\d{3,})%/g,a=>parseFloat(a).toFixed(2)+"%")).replace(/(\d+\.\d{3,})(\s*%)/g,(a,b,c)=>parseFloat(b).toFixed(2)+c)).replace(/\b(\d{4,})\b/g,a=>a.startsWith("19")||a.startsWith("20")||a.includes(",")?a:Number(a).toLocaleString("en-US")),[{from:"group_by",to:"grouped by"},{from:"dataset rows",to:"items"},{from:"records",to:"items"},{from:"aggregation",to:"analysis"},{from:"SQL",to:""},{from:"select",to:""}]))a=a.replace(RegExp(b.from,"gi"),b.to);return a}async function E(a,b){(0,v.cY)("[STRICT_SQL] Generating SQL for question:",b);let c=await y.db.query.datasets.findFirst({where:(0,A.eq)(z.datasets.id,a)});if(!c)return{success:!1,error:"Dataset not found"};let d=c.data||[],e=c.columns||[];if(0===d.length)return{success:!1,error:"Dataset has no data"};(0,v.cY)("[STRICT_SQL] Dataset:",c.name,"- Rows:",d.length,"- Columns:",e.length);let f=b.toLowerCase(),g="",h=null,i=a=>e.find(b=>a.some(a=>b.toLowerCase().includes(a)));try{if(f.includes("how many row")||f.includes("count row")||f.includes("number of row"))g="SELECT COUNT(*) as count FROM dataset",h={count:d.length,operation:"count"};else if(f.includes("total")||f.includes("sum")||f.includes("revenue")||f.includes("sales")){let a=i(["revenue","sales","amount","total","price","cost"]);if(a){let b=d.reduce((b,c)=>b+(parseFloat(c[a])||0),0);g=`SELECT SUM(${a}) as total FROM dataset`,h={total:b,column:a,operation:"sum"}}}else if(f.includes("average")||f.includes("avg")||f.includes("mean")){let a=i(["revenue","sales","amount","price","cost","profit"]);if(a){let b=d.map(b=>parseFloat(b[a])||0),c=b.reduce((a,b)=>a+b,0)/b.length;g=`SELECT AVG(${a}) as average FROM dataset`,h={average:c,column:a,operation:"avg"}}}else if(f.includes("region")||f.includes("country")||f.includes("product")||f.includes("channel")||f.includes("segment")||f.includes("category")||f.includes("highest")||f.includes("lowest")||f.includes("most")||f.includes("top")||f.includes("best")||f.includes("worst")||f.includes("least")||f.includes("brings")||f.includes("generates")||f.includes("produces")){let a=i(["region","country","product","category","segment","channel","source","medium","campaign","customer","industry","area","zone"]),b=i(["revenue","sales","profit","amount","total","value","income"]);if((0,v.cY)("[STRICT_SQL] GROUP BY - groupCol:",a,"valueCol:",b),a&&b){let c={},e=0;for(let f of d){let d=f[a]||"Unknown",g=parseFloat(f[b])||0;c[d]=(c[d]||0)+g,e+=g}let f=Object.entries(c).map(([a,b])=>({name:a,value:b,pct:e>0?b/e*100:0})).sort((a,b)=>b.value-a.value);g=`SELECT ${a}, SUM(${b}) as total FROM dataset GROUP BY ${a}`,h={type:"group_by",groupBy:a,value:b,data:f,operation:"group_by"}}}else if(f.includes("minimum")||f.includes("maximum")||f.includes("lowest")||f.includes("highest")){let a=i(["revenue","sales","profit","amount","price","cost","quantity","units"]);if(a){let b=d.map(b=>parseFloat(b[a])||0),c=Math.min(...b),e=Math.max(...b),i=f.includes("minimum")||f.includes("lowest");g=`SELECT ${i?"MIN":"MAX"}(${a}) as result FROM dataset`,h={[i?"minimum":"maximum"]:i?c:e,column:a,operation:i?"min":"max"}}}else if(f.includes("profit")&&(f.includes("margin")||f.includes("percentage"))){let a=i(["revenue","sales","amount"]),b=i(["cost","unit_cost"]);if(a&&b){let c=0,e=0;for(let f of d)c+=parseFloat(f[a])||0,e+=parseFloat(f[b])||0;let f=c>0?(c-e)/c*100:0;g="SELECT ((SUM(revenue) - SUM(cost)) / SUM(revenue)) * 100 as margin FROM dataset",h={profitMargin:f,revenue:c,cost:e,operation:"margin"}}}if((0,v.cY)("[STRICT_SQL] Generated SQL:",g),(0,v.cY)("[STRICT_SQL] Result:",JSON.stringify(h)?.slice(0,200)),!g||!h)return{success:!1,error:"Could not generate SQL for this question type"};return{success:!0,sql:g,result:h}}catch(a){return(0,v.AO)("[STRICT_SQL] Error:",a.message),{success:!1,error:a.message}}}async function F(a){if(!a)return{valid:!1,error:"No datasetId provided"};let b=await y.db.query.datasets.findFirst({where:(0,A.eq)(z.datasets.id,a)});return b?{valid:!0,dataset:b}:{valid:!1,error:"Dataset not found"}}let G=new Map;function H(a,b,c={}){let d={...b,...c,action:a,timestamp:new Date().toISOString(),...c.question&&{question:c.question.slice(0,200),isAnalytical:/\b(how many|how much|total|sum|count|average|avg|top|highest|lowest|minimum|maximum|revenue|profit|region|currency|list|distinct|group by|analyze)\b/i.test(c.question)},...c.sql&&{sql:c.sql.slice(0,500)},...void 0!==c.executionTime&&{executionTimeMs:c.executionTime},...void 0!==c.success&&{success:c.success}};(0,v.cY)(`[CHAT] ${a}:`,JSON.stringify(d))}function I(a,b){for(let c of({country:[/country/i,/nation/i,/market/i],region:[/region/i,/continent/i,/area/i,/zone/i],product:[/product/i,/item/i,/sku/i,/goods/i,/merchandise/i],channel:[/channel/i,/source/i,/medium/i,/platform/i],category:[/category/i,/type/i,/segment/i,/industry/i],revenue:[/revenue/i,/sales/i,/amount/i,/total/i,/income/i,/value/i],quantity:[/quantity/i,/qty/i,/units/i,/count/i,/orders/i]})[b]){let b=a.find(a=>c.test(a));if(b)return b}return null}function J(a,b,c){let d={};for(let e of a){let a=e[b]||"Unknown",f=M(e[c]);d[a]=(d[a]||0)+f}return Object.entries(d).map(([a,b])=>({name:a,value:b})).sort((a,b)=>b.value-a.value).slice(0,10)}function K(a){return a>=1e6?`${(a/1e6).toFixed(2)}M`:a>=1e3?`${(a/1e3).toFixed(2)}K`:`${a.toLocaleString("en-US",{maximumFractionDigits:2})}`}function L(a){return`${a.toFixed(2)}%`}function M(a){if(null==a||""===a)return 0;if("number"==typeof a)return a;let b=String(a).replace(/[€$¥£C$A₹CHF₽]/g,"").replace(/\s/g,""),c=b.lastIndexOf("."),d=b.lastIndexOf(","),e=parseFloat(b=d>c?b.replace(/\./g,"").replace(",","."):c>d&&-1!==d?b.replace(/,/g,""):-1!==d&&-1===c?b.replace(",","."):b.replace(/,/g,""));return isNaN(e)?0:e}async function N(a){let b=null;try{let{messages:d,datasetId:e,processedData:f}=await a.json();if(!d||!Array.isArray(d))return w.NextResponse.json({success:!1,error:"Invalid request: messages array required"},{status:400});let g=d[d.length-1]?.content||"",h=/\b(how many|how much|total|sum|count|average|avg|top|highest|lowest|minimum|maximum|revenue|profit|region|currency|list|distinct|group by|analyze)\b/i.test(g);if(h&&!e)return(0,v.cY)("[CHAT] REJECTED: Analytical query without datasetId"),w.NextResponse.json({success:!1,error:"No active dataset selected or invalid dataset ID",reason:"Please select an active dataset before asking analytical questions"},{status:400});let i=await (0,x.j2)(),j=i?.user?.id;if(j&&"demo-user-id"!==j){let a=await y.db.query.profiles.findFirst({where:(0,A.eq)(z.profiles.userId,j)});if(a&&"pro"!==a.subscriptionTier){let b=a.analysisCount||0;if(b>=2)return(0,v.cY)("[CHAT] REJECTED: Free limit reached"),w.NextResponse.json({success:!1,error:"Free limit reached",message:"You've used your 2 included Analyst credits. Subscribe to Pro or top up your balance to continue.",upgradeRequired:!0,analysisCount:b,creditsRemaining:0},{status:403})}}if(e){(0,v.cY)("[CHAT] Validating datasetId:",e);let a=await y.db.query.datasets.findFirst({where:(0,A.eq)(z.datasets.id,e)});if(!a)return(0,v.cY)("[CHAT] REJECTED: Dataset not found:",e),w.NextResponse.json({success:!1,error:"No active dataset selected or invalid dataset ID",reason:"Dataset not found"},{status:400});(0,v.cY)("[CHAT] Dataset validated:",a.name,"- rows:",a.rowCount)}else(0,v.cY)("[CHAT] No datasetId - non-analytical query allowed");let k=e||"no-dataset";(0,v.cY)("[CHAT] Incoming message:",g),(0,v.cY)("[CHAT] Dataset ID:",e);let l=function(a,b){let c=Date.now(),d=G.get(a);if(d){if(c-d.lastTime>6e4)return G.set(a,{count:1,lastTime:c,lastMessage:b}),{allowed:!0};if(d.lastMessage===b&&d.count>=5)return{allowed:!1,message:"Chat blocked: Same message repeated 5+ times. Please rephrase your question."};G.set(a,{count:d.count+1,lastTime:c,lastMessage:b})}else G.set(a,{count:1,lastTime:c,lastMessage:b});return{allowed:!0}}(k+":"+g.slice(0,50),g);if(!l.allowed)return H("LOOP_DETECTED",{sessionKey:k,message:g.slice(0,50)}),w.NextResponse.json({success:!1,error:l.message},{status:429});H("AI_CALL_INITIATED",{datasetId:e,messageLength:g.length});let m=h||(0,B.od)(g);if(e&&m){var c;(0,v.cY)("[CHAT] Question requires verified computation (analytical detected:",h,", computation:",(0,B.od)(g),")");let a=await F(e);if(!a.valid)return w.NextResponse.json({success:!1,error:"No active dataset selected or invalid ID",reason:a.error},{status:400});(0,v.cY)("[STRICT_SQL] Executing strict SQL for:",g);let b=await E(e,g);if(!b.success){(0,v.cY)("[STRICT_SQL] Failed:",b.error);let a=await y.db.query.datasets.findFirst({where:(0,A.eq)(z.datasets.id,e)}),c=a?.columns||[];return w.NextResponse.json({error:"Unable to compute this question from the dataset",reason:b.error||"No matching computation pattern found",availableColumns:c,suggestion:"Try asking about: total revenue, average sales, count of rows, top products by revenue, or rephrase your question to match available columns: "+c.slice(0,10).join(", ")},{status:400})}(0,v.cY)("[STRICT_SQL] Success! Result:",JSON.stringify(b.result).slice(0,200));let d=(c={success:!0,computed_value:b.result.count||b.result.total||b.result.average||b.result.data||b.result.minimum||b.result.maximum||b.result.profitMargin||0,operation:b.result.operation,row_count:a.dataset?.rowCount},c.success?`ORIGINAL QUESTION:
${g}

VERIFIED RESULT:
${JSON.stringify({computed_value:c.computed_value,column:c.column,operation:c.operation,row_count:c.row_count,metadata:c.metadata},null,2)}

Generate a clear, concise explanation of this result. Use the exact numbers provided. Do not compute or estimate anything.`:`ORIGINAL QUESTION:
${g}

ERROR:
${c.error?.userMessage||"An error occurred during computation"}

Explain to the user that the computation could not be completed and suggest they try a different question.`),f=await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.GEMINI_API_KEY}`},body:JSON.stringify({model:"gemini-2.5-flash",messages:[{role:"system",content:C},{role:"user",content:d}],temperature:.3,max_tokens:500})});if(f.ok){let a=await f.json(),c=a.choices?.[0]?.message?.content||"",d=D(c);return w.NextResponse.json({success:!0,content:d,role:"assistant",verified:!0,computation:{operation:b.result.operation,sql:b.sql,result:b.result}})}}let n=null,o=[];if(f&&Array.isArray(f)&&f.length>0)(0,v.cY)("[CHAT] Using processed data from frontend:",f.length,"rows"),o=f.slice(0,50);else if(e){(0,v.cY)("[CHAT] Fetching dataset from database...");let a=await y.db.query.datasets.findFirst({where:(0,A.eq)(z.datasets.id,e)});if(a){n={id:a.id,name:a.name,rowCount:a.rowCount,columnCount:a.columnCount,columns:a.columns},(0,v.cY)("[CHAT] Dataset found:",n.name,"-",n.rowCount,"rows");let b=a.data||[];o=(function(a){if(!a||0===a.length)return a;let b=Object.keys(a[0]),c=/price|amount|revenue|cost|total|profit|sales|value|qty|quantity/i,d=b.filter(a=>c.test(a));return(0,v.cY)("[NORMALIZE] Detected monetary columns:",d),a.map(a=>{let b={...a};for(let c of d){let d=a[c];"string"==typeof d&&/[€$¥£C$A₹CHF₽]/.test(d)&&(b[c]=M(d),(0,v.cY)(`[NORMALIZE] ${c}: "${d}" -> ${b[c]}`))}return b})})(b).slice(0,50),(0,v.cY)("[CHAT] Fetched and normalized",o.length,"sample rows for context")}else(0,v.cY)("[CHAT] Dataset not found in database")}["generate report","create report","export report","download report","make pdf","create presentation","create powerpoint","create word document","export excel","investor report","management report","board report","executive summary document","export document","investor deck","branded report","executive presentation","detailed board report"].some(a=>g.toLowerCase().includes(a));let p=`You are Clevr, elite AI analyst for startup founders and investors.

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

Always offer next steps and alternative insights.`;if(n||o.length>0){let a=n?.columns||Object.keys(o[0]||{}),b=function(a,b){let c=[],d=I(b,"country"),e=I(b,"region"),f=I(b,"product"),g=I(b,"channel");I(b,"category");let h=I(b,"revenue");if(!h)return"";if(d){let b=J(a,d,h);if(b.length>0){let a=b.reduce((a,b)=>a+b.value,0),d=b[0];c.push(`TOP COUNTRY: ${d.name} - ${K(d.value)} (${L(d.value/a*100)} of total)`),c.push(`Country rankings: ${b.slice(0,5).map((a,b)=>`${b+1}. ${a.name}: ${K(a.value)}`).join(", ")}`)}}if(e){let b=J(a,e,h);if(b.length>0){let a=b.reduce((a,b)=>a+b.value,0),d=b[0];c.push(`TOP REGION: ${d.name} - ${K(d.value)} (${L(d.value/a*100)} of total)`),c.push(`Region rankings: ${b.slice(0,5).map((a,b)=>`${b+1}. ${a.name}: ${K(a.value)}`).join(", ")}`)}}if(f){let b=J(a,f,h);if(b.length>0){let a=b.reduce((a,b)=>a+b.value,0),d=b[0];c.push(`TOP PRODUCT: ${d.name} - ${K(d.value)} (${L(d.value/a*100)} of total)`),c.push(`Product rankings: ${b.slice(0,5).map((a,b)=>`${b+1}. ${a.name}: ${K(a.value)}`).join(", ")}`)}}if(g){let b=J(a,g,h);if(b.length>0){let a=b.reduce((a,b)=>a+b.value,0),d=b[0];c.push(`TOP CHANNEL: ${d.name} - ${K(d.value)} (${L(d.value/a*100)} of total)`)}}return c.join("\n")}(o,a);n?p+=`

DATASET OVERVIEW:
- Name: ${n.name}
- Total Rows: ${n.rowCount}
- Columns: ${a.join(", ")}

AGGREGATED INSIGHTS (pre-computed for you):
${b}

Use these pre-computed insights to answer questions DIRECTLY. When asked about top performing entities, reference the rankings above.`:p+=`

AGGREGATED INSIGHTS:
${b}

Use these rankings to answer questions directly.`}else p+=`

No dataset is currently loaded. Ask the user to upload a CSV file first.`;if(p+=`

Remember: Respond with TEXT ONLY. Do not execute any commands or tools.`,(0,v.cY)("[GEMINI] API Key present:",!!process.env.GEMINI_API_KEY),!process.env.GEMINI_API_KEY)return w.NextResponse.json({success:!1,error:"AI service not configured. Please contact support."});let q=await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.GEMINI_API_KEY}`},body:JSON.stringify({model:"gemini-2.5-flash",messages:[{role:"system",content:p},...d],temperature:.3,max_tokens:1500})});if((0,v.cY)("[GEMINI] Status:",q.status),!q.ok){let a=await q.text();return(0,v.AO)("[GEMINI ERROR]",q.status,a),w.NextResponse.json({success:!1,error:`AI service error: ${q.status}`},{status:q.status})}let r=await q.json(),s=r.choices?.[0]?.message?.content||"";if((0,v.cY)("[GEMINI] Response received:",s.slice(0,100)),H("AI_CALL_COMPLETE",{datasetId:e,responseLength:s.length}),h&&j&&"demo-user-id"!==j)try{let a=await y.db.query.profiles.findFirst({where:(0,A.eq)(z.profiles.userId,j)});if(a&&"pro"!==a.subscriptionTier){let c=(a.analysisCount||0)+1;await y.db.update(z.profiles).set({analysisCount:c}).where((0,A.eq)(z.profiles.userId,j)),b.analysisCount=c}}catch(a){(0,v.AO)("[CHAT] Failed to increment usage:",a)}return b={success:!0,content:D(s),role:"assistant"},w.NextResponse.json(b)}catch(a){return(0,v.AO)("[CHAT CRASH]",{message:a.message,stack:a.stack?.slice(0,500)}),w.NextResponse.json({success:!1,error:a.message||"An unexpected error occurred. Please try again."},{status:500})}}let O=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/chat/route",pathname:"/api/chat",filename:"route",bundlePath:"app/api/chat/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/home/csaba/Documents/Useclever-2026/src/app/api/chat/route.ts",nextConfigOutput:"standalone",userland:d,...{}}),{workAsyncStorage:P,workUnitAsyncStorage:Q,serverHooks:R}=O;function S(){return(0,g.patchFetch)({workAsyncStorage:P,workUnitAsyncStorage:Q})}async function T(a,b,c){c.requestMeta&&(0,h.setRequestMeta)(a,c.requestMeta),O.isDev&&(0,h.addRequestMeta)(a,"devRequestTimingInternalsEnd",process.hrtime.bigint());let d="/api/chat/route";"/index"===d&&(d="/");let e=await O.prepare(a,b,{srcPage:d,multiZoneDraftMode:!1});if(!e)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:g,params:v,nextConfig:w,parsedUrl:x,isDraftMode:y,prerenderManifest:z,routerServerContext:A,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D,clientReferenceManifest:E,serverActionsManifest:F}=e,G=(0,k.normalizeAppPath)(d),H=!!(z.dynamicRoutes[G]||z.routes[D]),I=async()=>((null==A?void 0:A.render404)?await A.render404(a,b,x,!1):b.end("This page could not be found"),null);if(H&&!y){let a=!!z.routes[D],b=z.dynamicRoutes[G];if(b&&!1===b.fallback&&!a){if(w.adapterPath)return await I();throw new t.NoFallbackError}}let J=null;!H||O.isDev||y||(J="/index"===(J=D)?"/":J);let K=!0===O.isDev||!H,L=H&&!K;F&&E&&(0,j.setManifestsSingleton)({page:d,clientReferenceManifest:E,serverActionsManifest:F});let M=a.method||"GET",N=(0,i.getTracer)(),P=N.getActiveScopeSpan(),Q=!!(null==A?void 0:A.isWrappedByNextServer),R=!!(0,h.getRequestMeta)(a,"minimalMode"),S=(0,h.getRequestMeta)(a,"incrementalCache")||await O.getIncrementalCache(a,w,z,R);null==S||S.resetRequestCache(),globalThis.__incrementalCache=S;let T={params:v,previewProps:z.preview,renderOpts:{experimental:{authInterrupts:!!w.experimental.authInterrupts},cacheComponents:!!w.cacheComponents,supportsDynamicResponse:K,incrementalCache:S,cacheLifeProfiles:w.cacheLife,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d,e)=>O.onRequestError(a,b,d,e,A)},sharedContext:{buildId:g}},U=new l.NodeNextRequest(a),V=new l.NodeNextResponse(b),W=m.NextRequestAdapter.fromNodeNextRequest(U,(0,m.signalFromNodeResponse)(b));try{let e,g=async a=>O.handle(W,T).finally(()=>{if(!a)return;a.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let c=N.getRootSpanAttributes();if(!c)return;if(c.get("next.span_type")!==n.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${c.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let f=c.get("next.route");if(f){let b=`${M} ${f}`;a.setAttributes({"next.route":f,"http.route":f,"next.span_name":b}),a.updateName(b),e&&e!==a&&(e.setAttribute("http.route",f),e.updateName(b))}else a.updateName(`${M} ${d}`)}),h=async e=>{var h,i;let j=async({previousCacheEntry:f})=>{try{if(!R&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let d=await g(e);a.fetchMetrics=T.renderOpts.fetchMetrics;let h=T.renderOpts.pendingWaitUntil;h&&c.waitUntil&&(c.waitUntil(h),h=void 0);let i=T.renderOpts.collectedTags;if(!H)return await (0,p.I)(U,V,d,T.renderOpts.pendingWaitUntil),null;{let a=await d.blob(),b=(0,q.toNodeOutgoingHttpHeaders)(d.headers);i&&(b[s.NEXT_CACHE_TAGS_HEADER]=i),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==T.renderOpts.collectedRevalidate&&!(T.renderOpts.collectedRevalidate>=s.INFINITE_CACHE)&&T.renderOpts.collectedRevalidate,e=void 0===T.renderOpts.collectedExpire||T.renderOpts.collectedExpire>=s.INFINITE_CACHE?void 0:T.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:d.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:e}}}}catch(b){throw(null==f?void 0:f.isStale)&&await O.onRequestError(a,b,{routerKind:"App Router",routePath:d,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:L,isOnDemandRevalidate:B})},!1,A),b}},k=await O.handleResponse({req:a,nextConfig:w,cacheKey:J,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:z,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:j,waitUntil:c.waitUntil,isMinimalMode:R});if(!H)return null;if((null==k||null==(h=k.value)?void 0:h.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==k||null==(i=k.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});R||b.setHeader("x-nextjs-cache",B?"REVALIDATED":k.isMiss?"MISS":k.isStale?"STALE":"HIT"),y&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let l=(0,q.fromNodeOutgoingHttpHeaders)(k.value.headers);return R&&H||l.delete(s.NEXT_CACHE_TAGS_HEADER),!k.cacheControl||b.getHeader("Cache-Control")||l.get("Cache-Control")||l.set("Cache-Control",(0,r.getCacheControlHeader)(k.cacheControl)),await (0,p.I)(U,V,new Response(k.value.body,{headers:l,status:k.value.status||200})),null};Q&&P?await h(P):(e=N.getActiveScopeSpan(),await N.withPropagatedContext(a.headers,()=>N.trace(n.BaseServerSpan.handleRequest,{spanName:`${M} ${d}`,kind:i.SpanKind.SERVER,attributes:{"http.method":M,"http.target":a.url}},h),void 0,!Q))}catch(b){if(b instanceof t.NoFallbackError||await O.onRequestError(a,b,{routerKind:"App Router",routePath:G,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:L,isOnDemandRevalidate:B})},!1,A),H)throw b;return await (0,p.I)(U,V,new Response(null,{status:500})),null}}}};var b=require("../../../webpack-runtime.js");b.C(a);var c=b.X(0,[4657,6796,107,9117,4819,7841,4349,4615,7824],()=>b(b.s=95994));module.exports=c})();