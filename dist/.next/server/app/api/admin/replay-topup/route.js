"use strict";(()=>{var a={};a.id=1426,a.ids=[1426],a.modules={55591:a=>{a.exports=require("https")},108128:a=>{a.exports=require("next/dist/server/runtime-reacts.external.js")},164939:a=>{a.exports=import("pg")},200261:a=>{a.exports=require("next/dist/shared/lib/router/utils/app-paths")},328354:a=>{a.exports=require("util")},330288:(a,b,c)=>{c.d(b,{Ny:()=>m,TQ:()=>l,i3:()=>e,j3:()=>k,tc:()=>f,vO:()=>g});var d=c(695261);let e={STANDARD_UPLOAD_ANALYSIS:10,AI_ANALYST_MESSAGE:1,REPORT_GENERATION:3,FORECAST:3,PROFITABILITY_ANALYSIS:15,EXISTING_REPORT_DOWNLOAD:0},f=.085,g=11.76470588235294,h=["standard_upload_analysis","ai_question","report_generation","forecast","profitability_analysis","existing_report_download","accountancy_analysis","prebookkeeping_analysis","document_extraction","embedding_ingestion","hybrid_retrieval","export_generation"],i=a=>({maxReservationCredits:a,variableCredits:()=>0}),j={standard_upload_analysis:{feature:"standard_upload_analysis",label:"Upload with standard analysis",baseCredits:e.STANDARD_UPLOAD_ANALYSIS,allowedPlans:["free","demo","pro","business","admin","superadmin"],...i(e.STANDARD_UPLOAD_ANALYSIS)},ai_question:{feature:"ai_question",label:"AI Analyst message",baseCredits:e.AI_ANALYST_MESSAGE,allowedPlans:["free","demo","pro","business","admin","superadmin"],...i(e.AI_ANALYST_MESSAGE)},report_generation:{feature:"report_generation",label:"Report generation",baseCredits:e.REPORT_GENERATION,allowedPlans:["free","demo","pro","business","admin","superadmin"],...i(e.REPORT_GENERATION)},forecast:{feature:"forecast",label:"Forecast",baseCredits:e.FORECAST,allowedPlans:["free","demo","pro","business","admin","superadmin"],...i(e.FORECAST)},profitability_analysis:{feature:"profitability_analysis",label:"Profitability analysis",baseCredits:e.PROFITABILITY_ANALYSIS,allowedPlans:["pro","business","admin","superadmin"],...i(e.PROFITABILITY_ANALYSIS)},existing_report_download:{feature:"existing_report_download",label:"Existing report download",baseCredits:e.EXISTING_REPORT_DOWNLOAD,allowedPlans:["free","demo","pro","business","admin","superadmin"],...i(e.EXISTING_REPORT_DOWNLOAD)},accountancy_analysis:{feature:"accountancy_analysis",label:"Accountancy analysis",baseCredits:15,allowedPlans:["business","admin","superadmin"],...i(15)},prebookkeeping_analysis:{feature:"prebookkeeping_analysis",label:"Pre-bookkeeping analysis",baseCredits:15,allowedPlans:["business","admin","superadmin"],...i(15)},document_extraction:{feature:"document_extraction",label:"Document extraction",baseCredits:10,allowedPlans:["business","admin","superadmin"],...i(10)},embedding_ingestion:{feature:"embedding_ingestion",label:"Embedding ingestion",baseCredits:1,allowedPlans:["pro","business","admin","superadmin"],...i(1)},hybrid_retrieval:{feature:"hybrid_retrieval",label:"Hybrid retrieval",baseCredits:1,allowedPlans:["free","demo","pro","business","admin","superadmin"],...i(1)},export_generation:{feature:"export_generation",label:"Export generation",baseCredits:5,allowedPlans:["free","demo","pro","business","admin","superadmin"],...i(5)}};function k(a){return h.includes(a)?a:"ai_chat"===a?"ai_question":"dataset_analysis"===a||"standard_analysis"===a||"data_insight"===a||"dashboard_generation"===a||"multi_dataset_analysis"===a||"dataset_upload"===a||"file_upload"===a||"retail_analysis"===a?"standard_upload_analysis":"forecast_analysis"===a?"forecast":"report_download"===a?"existing_report_download":"mcp_tool_invocation"===a?"hybrid_retrieval":"standard_upload_analysis"}function l(a,b={}){let c=j[k(a)],d=Math.max(1,b.modelMultiplier??1),e=Math.ceil((c.baseCredits+c.variableCredits(b))*d);return Math.max(0,Math.min(c.maxReservationCredits,e))}function m(a,b){let c="admin"===a||"superadmin"===a?a:(0,d.EF)(a).tier;return j[k(b)].allowedPlans.includes(c)}},419121:a=>{a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},455511:a=>{a.exports=require("crypto")},529294:a=>{a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},579646:a=>{a.exports=require("child_process")},594735:a=>{a.exports=require("events")},606555:(a,b,c)=>{c.d(b,{EA:()=>f,Jj:()=>g,eu:()=>h,xL:()=>i});var d=c(489208);let e=process.env.EMAIL_FROM||"UseClevr <no-reply@useclevr.com>";async function f(a){let{to:b,planName:c,billingInterval:d,amount:e,currency:f,activatedAt:g,nextBillingDate:h,dashboardUrl:i}=a,k=`Your ${c} subscription is now active`,l=new Intl.NumberFormat("en-US",{style:"currency",currency:f}).format(e),m=`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="margin: 0; color: #0ea5e9;">UseClevr</h1>
  </div>

  <h2 style="color: #1a1a1a;">Your ${c} subscription is now active!</h2>

  <p>Thank you for subscribing to UseClevr ${c}. Your subscription has been successfully activated.</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Plan</td>
        <td style="padding: 8px 0; font-weight: 600;">${c}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Billing</td>
        <td style="padding: 8px 0;">${d}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Amount</td>
        <td style="padding: 8px 0;">${l}/${"monthly"===d?"month":"year"}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Activated</td>
        <td style="padding: 8px 0;">${new Date(g).toLocaleDateString()}</td>
      </tr>
      ${h?`
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Next billing</td>
        <td style="padding: 8px 0;">${new Date(h).toLocaleDateString()}</td>
      </tr>
      `:""}
    </table>
  </div>

  <p>Your UseClevr subscription gives you access to AI-powered business analytics that transforms your business data into KPIs, visualizations, trends, and actionable insights. Available features depend on your selected plan.</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${i}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Go to Dashboard</a>
  </div>

  <p style="color: #64748b; font-size: 14px;">
    You can manage your subscription at any time from your <a href="${i}" style="color: #0ea5e9;">subscription settings</a>.
  </p>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

  <p style="color: #94a3b8; font-size: 12px;">
    This email was sent to ${b}. If you have questions, contact us at support@useclevr.com.
  </p>
</body>
</html>
`;return j({to:b,subject:k,html:m,text:`
Your ${c} subscription is now active!

Thank you for subscribing to UseClevr ${c}. Your subscription has been successfully activated.

Plan: ${c}
Billing: ${d}
Amount: ${l}/${"monthly"===d?"month":"year"}
Activated: ${new Date(g).toLocaleDateString()}
${h?`Next billing: ${new Date(h).toLocaleDateString()}`:""}

Your UseClevr subscription gives you access to AI-powered business analytics that transforms your business data into KPIs, visualizations, trends, and actionable insights.

Go to your dashboard: ${i}

You can manage your subscription at any time from your subscription settings.
`,emailType:"subscription_activation"})}async function g(a){let{to:b,planName:c,canceledAt:d,datasetsPreserved:e,purchasedCreditsPreserved:f,dashboardUrl:g}=a,h=`Your ${c} subscription has been cancelled`,i=`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="margin: 0; color: #0ea5e9;">UseClevr</h1>
  </div>

  <h2 style="color: #1a1a1a;">Subscription Cancelled</h2>

  <p>Your ${c} subscription has been cancelled. Your account has been transitioned to the Free plan.</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Previous Plan</td>
        <td style="padding: 8px 0; font-weight: 600;">${c}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Cancelled</td>
        <td style="padding: 8px 0;">${new Date(d).toLocaleDateString()}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Datasets</td>
        <td style="padding: 8px 0;">${e?"Preserved":"Removed"}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Purchased Credits</td>
        <td style="padding: 8px 0;">${f?"Preserved":"Removed"}</td>
      </tr>
    </table>
  </div>

  <p>Your existing datasets have been preserved. You can continue to use UseClevr with the Free plan, which includes:</p>
  <ul>
    <li>Up to 2 datasets</li>
    <li>5,000 rows per dataset</li>
    <li>Basic AI analysis features</li>
  </ul>

  <p>Your purchased credits (if any) remain available for use.</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${g}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Go to Dashboard</a>
  </div>

  <p style="color: #64748b; font-size: 14px;">
    We hope you enjoyed your time on the ${c} plan. You're welcome to upgrade again anytime from your <a href="${g}" style="color: #0ea5e9;">subscription settings</a>.
  </p>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

  <p style="color: #94a3b8; font-size: 12px;">
    This email was sent to ${b}. If you have questions, contact us at support@useclevr.com.
  </p>
</body>
</html>
`;return j({to:b,subject:h,html:i,text:`
Subscription Cancelled

Your ${c} subscription has been cancelled. Your account has been transitioned to the Free plan.

Previous Plan: ${c}
Cancelled: ${new Date(d).toLocaleDateString()}
Datasets: ${e?"Preserved":"Removed"}
Purchased Credits: ${f?"Preserved":"Removed"}

Your existing datasets have been preserved. You can continue to use UseClevr with the Free plan, which includes up to 2 datasets, 5,000 rows per dataset, and basic AI analysis features.

Your purchased credits (if any) remain available for use.

Go to your dashboard: ${g}

We hope you enjoyed your time on the ${c} plan. You're welcome to upgrade again anytime.
`,emailType:"subscription_cancellation"})}async function h(a){let{to:b,planName:c,currentPeriodEnd:d,dashboardUrl:e}=a,f=`Your ${c} subscription will cancel at period end`,g=`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="margin: 0; color: #0ea5e9;">UseClevr</h1>
  </div>

  <h2 style="color: #1a1a1a;">Subscription Cancellation Scheduled</h2>

  <p>Your ${c} subscription is scheduled to cancel at the end of your billing period.</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Current Plan</td>
        <td style="padding: 8px 0; font-weight: 600;">${c}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Access Until</td>
        <td style="padding: 8px 0;">${new Date(d).toLocaleDateString()}</td>
      </tr>
    </table>
  </div>

  <p>Your ${c} benefits will remain active until ${new Date(d).toLocaleDateString()}. After that, your account will transition to the Free plan.</p>

  <p>You can cancel this scheduled cancellation anytime before the period ends.</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${e}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Go to Dashboard</a>
  </div>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

  <p style="color: #94a3b8; font-size: 12px;">
    This email was sent to ${b}. If you have questions, contact us at support@useclevr.com.
  </p>
</body>
</html>
`;return j({to:b,subject:f,html:g,text:`
Subscription Cancellation Scheduled

Your ${c} subscription is scheduled to cancel at the end of your billing period.

Current Plan: ${c}
Access Until: ${new Date(d).toLocaleDateString()}

Your ${c} benefits will remain active until ${new Date(d).toLocaleDateString()}. After that, your account will transition to the Free plan.

You can cancel this scheduled cancellation anytime before the period ends.

Go to your dashboard: ${e}
`,emailType:"subscription_cancellation_scheduled"})}async function i(a){let{to:b,creditsGranted:c,amount:d,currency:e,purchasedAt:f,providerPaymentId:g,dashboardUrl:h,receiptUrl:i,invoicePdfUrl:k,invoiceUrl:l,newPurchasedBalance:m}=a,n=new Intl.NumberFormat("en-US",{style:"currency",currency:e}).format(d),o=`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="margin: 0; color: #0ea5e9;">UseClevr</h1>
  </div>

  <h2 style="color: #1a1a1a;">Credits Added Successfully</h2>

  <p>Thank you for your purchase! ${c.toLocaleString()} credits have been added to your UseClevr account.</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Credits Added</td>
        <td style="padding: 8px 0; font-weight: 600; font-size: 18px;">${c.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Amount Paid</td>
        <td style="padding: 8px 0; font-weight: 600;">${n}</td>
      </tr>
      ${"number"==typeof m?`
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Purchased Credit Balance</td>
        <td style="padding: 8px 0; font-weight: 600;">${m.toLocaleString()} credits</td>
      </tr>
      `:""}
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Date</td>
        <td style="padding: 8px 0;">${new Date(f).toLocaleDateString()}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #64748b;">Reference</td>
        <td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${g}</td>
      </tr>
    </table>
  </div>

  <p><strong>Important:</strong> Purchased credits are non-refundable and do not expire. They are available immediately and will be used after your monthly included credits are exhausted.</p>

  ${i||k||l?`
  <p style="color: #64748b; font-size: 14px;">Your payment documentation from Stripe:</p>
  <ul style="color: #64748b; font-size: 14px; padding-left: 20px;">
    ${i?`<li><a href="${i}" style="color: #0ea5e9;">View Stripe receipt</a></li>`:""}
    ${k?`<li><a href="${k}" style="color: #0ea5e9;">Download invoice PDF (Invoice / Rechnung)</a></li>`:""}
    ${l?`<li><a href="${l}" style="color: #0ea5e9;">View invoice</a></li>`:""}
  </ul>
  `:`
  <p style="color: #64748b; font-size: 14px;">Your Stripe payment receipt and invoice are available from your subscription settings on the dashboard.</p>
  `}

  <div style="text-align: center; margin: 30px 0;">
    <a href="${h}" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Go to Dashboard</a>
  </div>

  <p style="color: #64748b; font-size: 14px;">
    You can view your purchase history and manage your account from your <a href="${h}" style="color: #0ea5e9;">subscription settings</a>.
  </p>

  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

  <p style="color: #94a3b8; font-size: 12px;">
    This email was sent to ${b}. If you have questions, contact us at support@useclevr.com.
  </p>
</body>
</html>
`;return j({to:b,subject:"Your UseClevr credit purchase is confirmed",html:o,text:`
Credits Added Successfully

Thank you for your purchase! ${c.toLocaleString()} credits have been added to your UseClevr account.

Credits Added: ${c.toLocaleString()}
Amount Paid: ${n}
${"number"==typeof m?`Purchased Credit Balance: ${m.toLocaleString()} credits
`:""}Date: ${new Date(f).toLocaleDateString()}
Reference: ${g}

Important: Purchased credits are non-refundable and do not expire. They are available immediately and will be used after your monthly included credits are exhausted.

Payment documentation from Stripe:
${i?`View Stripe receipt: ${i}
`:""}${k?`Download invoice PDF (Invoice / Rechnung): ${k}
`:""}${l?`View invoice: ${l}
`:""}
Go to your dashboard: ${h}

You can view your purchase history and manage your account from your subscription settings.
`,emailType:"credit_purchase",from:"UseClevr <no-reply@useclevr.com>"})}async function j(a){let b=process.env.RESEND_API_KEY?.trim();if(!b)return"console"===process.env.EMAIL_PROVIDER?((0,d.cY)(`[Email] ${a.emailType} email (console mode)`,{to:a.to,subject:a.subject}),{success:!0}):(console.error(`[Email] ${a.emailType} failed: RESEND_API_KEY not configured`),{success:!1,error:"RESEND_API_KEY not configured"});try{let c=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${b}`,"Content-Type":"application/json"},body:JSON.stringify({from:a.from||e,to:a.to,subject:a.subject,text:a.text,html:a.html})}),d=await c.json().catch(()=>({})),f="string"==typeof d?.id?d.id:"";if(console.warn(`[Email] ${a.emailType} result`,{status:c.status,ok:c.ok,messageIdReturned:!!f}),!c.ok){let b=d?.message||d?.error||`HTTP ${c.status}`;return console.error(`[Email] ${a.emailType} failed:`,b),{success:!1,error:b}}return{success:!0,messageId:f}}catch(c){let b=c instanceof Error?c.message:"Unknown error";return console.error(`[Email] ${a.emailType} exception:`,b),{success:!1,error:b}}}},663033:a=>{a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},710846:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},738678:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.r(b),c.d(b,{POST:()=>l,dynamic:()=>m});var e=c(893148),f=c(115438),g=c(519572),h=c(138574),i=c(285297),j=c(489208),k=a([e,i]);[e,i]=k.then?(await k)():k;let m="force-dynamic";async function l(a){let b=await (0,e.j2)(),c=b?.user,d=String(c?.role??""),k=!!(c?.id&&(0,f.zX)(c.id))||"superadmin"===d||"admin"===d;if(!c?.id||!c?.email)return h.NextResponse.json({error:"Unauthorized"},{status:401});if(!k)return h.NextResponse.json({error:"Forbidden"},{status:403});let l=await a.json().catch(()=>({})),m="string"==typeof l.sessionId?l.sessionId.trim():"",n="string"==typeof l.paymentIntentId?l.paymentIntentId.trim():"";if(!m&&!n)return h.NextResponse.json({error:"Provide either sessionId (cs_...) or paymentIntentId (pi_...)"},{status:400});let o=process.env.STRIPE_SECRET_KEY;if(!o)return h.NextResponse.json({error:"Stripe not configured"},{status:500});let p=new g.A(o,{}),q=null;try{if(m){if(!m.startsWith("cs_"))return h.NextResponse.json({error:"sessionId must be a Stripe Checkout Session ID starting with cs_"},{status:400});q=await p.checkout.sessions.retrieve(m,{expand:["payment_intent"]})}else if(n)try{let a=await p.paymentIntents.retrieve(n);return(0,j.cY)("[replay-topup] PaymentIntent validated",{id:a.id,amount:a.amount,currency:a.currency,status:a.status,paymentStatus:a.payment_status??a.status}),h.NextResponse.json({success:!1,processed:!1,synced:!1,reason:`PaymentIntent ${n} is valid (${a.amount} ${a.currency}, status: ${a.status}). To recover credits, call this endpoint again with sessionId (cs_...) instead of paymentIntentId.`,diagnostics:{paymentIntentId:a.id,amount:a.amount,currency:a.currency,status:a.status}})}catch(a){return(0,j.AO)("[replay-topup] Failed to retrieve PaymentIntent:",a),h.NextResponse.json({error:"Failed to retrieve PaymentIntent",details:a instanceof Error?a.message:String(a)},{status:500})}}catch(a){return(0,j.AO)("[replay-topup] Failed to retrieve Stripe session:",a),h.NextResponse.json({error:"Failed to retrieve Stripe session",details:a instanceof Error?a.message:String(a)},{status:500})}if(!q)return h.NextResponse.json({error:"Could not retrieve checkout session"},{status:500});let r={sessionId:q.id,mode:q.mode,paymentStatus:q.payment_status,amountTotal:q.amount_total,currency:q.currency,customerId:q.customer,clientReferenceId:q.client_reference_id,metadata:q.metadata,lineItemCount:Array.isArray(q.line_items)?q.line_items.length:0,createdAt:q.created,livemode:q.livemode};if((0,j.cY)("[replay-topup] Session diagnostics",r),"payment"!==q.mode)return h.NextResponse.json({error:"Not a payment-mode checkout session",diagnostics:r},{status:400});if("paid"!==q.payment_status)return h.NextResponse.json({error:"Session not paid",paymentStatus:q.payment_status,diagnostics:r},{status:400});let s="string"==typeof q.payment_intent?q.payment_intent:q.payment_intent&&"object"==typeof q.payment_intent?q.payment_intent.id:null;if(s)try{let a=await p.paymentIntents.retrieve(s),b="string"==typeof a.latest_charge?a.latest_charge:a.latest_charge?.id??null;if(b){let a=await p.charges.retrieve(b);if(a.amount_refunded>0)return(0,j.cY)("[replay-topup] Refused replay of refunded payment",{sessionId:q.id,chargeId:b,amountRefunded:a.amount_refunded,chargeAmount:a.amount}),h.NextResponse.json({success:!1,processed:!1,synced:!1,reason:`Payment is refunded (${a.amount_refunded} of ${a.amount} refunded). Refunded payments are never replayed into credits.`,diagnostics:r},{status:409})}}catch(a){return(0,j.AO)("[replay-topup] Failed to verify refund state:",a),h.NextResponse.json({error:"Could not verify payment refund state — refusing to replay.",details:a instanceof Error?a.message:String(a)},{status:500})}let t={id:`evt_replay_${Date.now()}`,object:"event",api_version:"2022-08-01",created:Math.floor(Date.now()/1e3),type:"checkout.session.completed",data:{object:q},livemode:q.livemode??!1,pending_webhooks:0,request:null},u=await (0,i.h)(t);return h.NextResponse.json({success:u.processed,processed:u.processed,synced:u.synced,creditsIssued:u.creditsIssued,duplicate:u.duplicate,reason:u.reason,diagnostics:r})}d()}catch(a){d(a)}})},744870:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},781630:a=>{a.exports=require("http")},903295:a=>{a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},977598:a=>{a.exports=require("node:crypto")},986439:a=>{a.exports=require("next/dist/shared/lib/no-fallback-error.external")},994092:(a,b,c)=>{c.r(b),c.d(b,{handler:()=>z,patchFetch:()=>y,routeModule:()=>u,serverHooks:()=>x,workAsyncStorage:()=>v,workUnitAsyncStorage:()=>w});var d=c(564844),e=c(205480),f=c(931879),g=c(652511),h=c(938393),i=c(238449),j=c(200261),k=c(392427),l=c(139077),m=c(465751),n=c(911908),o=c(594802),p=c(275480),q=c(773178),r=c(170159),s=c(986439),t=c(794485);let u=new d.AppRouteRouteModule({definition:{kind:e.RouteKind.APP_ROUTE,page:"/api/admin/replay-topup/route",pathname:"/api/admin/replay-topup",filename:"route",bundlePath:"app/api/admin/replay-topup/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/home/runner/work/useclevr-production-2026/useclevr-production-2026/src/app/api/admin/replay-topup/route.ts",nextConfigOutput:"standalone",userland:()=>c(738678),...{}}),{workAsyncStorage:v,workUnitAsyncStorage:w,serverHooks:x}=u;function y(){return(0,f.patchFetch)({workAsyncStorage:v,workUnitAsyncStorage:w})}async function z(a,b,c){c.requestMeta&&(0,g.setRequestMeta)(a,c.requestMeta),u.isDev&&(0,g.addRequestMeta)(a,"devRequestTimingInternalsEnd",process.hrtime.bigint());let d="/api/admin/replay-topup/route";"/index"===d&&(d="/");let f=await u.prepare(a,b,{srcPage:d,multiZoneDraftMode:!1});if(!f)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:v,deploymentId:w,params:x,nextConfig:y,parsedUrl:z,isDraftMode:A,prerenderManifest:B,routerServerContext:C,isOnDemandRevalidate:D,revalidateOnlyGenerated:E,resolvedPathname:F,clientReferenceManifest:G,serverActionsManifest:H}=f,I=(0,j.normalizeAppPath)(d),J=!!(B.dynamicRoutes[I]||B.routes[F]),K=async()=>((null==C?void 0:C.render404)?await C.render404(a,b,z,!1):b.end("This page could not be found"),null);if(J&&!A){let a=!!B.routes[F],b=B.dynamicRoutes[I];if(b&&!1===b.fallback&&!a){if(y.adapterPath)return await K();throw new s.NoFallbackError}}let L=null;!J||u.isDev||A||(L="/index"===(L=F)?"/":L);let M=!0===u.isDev||!J,N=J&&!M;H&&G&&(0,i.setManifestsSingleton)({page:d,clientReferenceManifest:G,serverActionsManifest:H});let O=a.method||"GET",P=(0,h.getTracer)(),Q=P.getActiveScopeSpan(),R=!!(null==C?void 0:C.isWrappedByNextServer),S=!!(0,g.getRequestMeta)(a,"minimalMode"),T=(0,g.getRequestMeta)(a,"incrementalCache")||await u.getIncrementalCache(a,y,B,S);null==T||T.resetRequestCache(),globalThis.__incrementalCache=T;let U={params:x,previewProps:B.preview,renderOpts:{experimental:{authInterrupts:!!y.experimental.authInterrupts,useCacheTimeout:y.experimental.useCacheTimeout},cacheComponents:!!y.cacheComponents,validationLevel:y.experimental.instantInsights.validationLevel,supportsDynamicResponse:M,incrementalCache:T,hmrRefreshHash:(0,g.getRequestMeta)(a,"hmrRefreshHash"),cacheLifeProfiles:y.cacheLife,staticPageGenerationTimeout:y.staticPageGenerationTimeout,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d,e)=>u.onRequestError(a,b,d,e,C)},sharedContext:{buildId:v,deploymentId:w}},V=new k.NodeNextRequest(a),W=new k.NodeNextResponse(b),X=l.NextRequestAdapter.fromNodeNextRequest(V,(0,l.signalFromNodeResponse)(b)),Y=async({previousCacheEntry:e})=>{try{if(!S&&D&&E&&!e)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let d=await u.handle(X,U);a.fetchMetrics=U.renderOpts.fetchMetrics;let f=U.renderOpts.pendingWaitUntil;f&&c.waitUntil&&(c.waitUntil(f),f=void 0);let g=U.renderOpts.collectedTags;if(!J)return await (0,o.I)(V,W,d,f),null;{let a=await d.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(d.headers);g&&(b[r.NEXT_CACHE_TAGS_HEADER]=g),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==U.renderOpts.collectedRevalidate&&!(U.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&U.renderOpts.collectedRevalidate,e=void 0===U.renderOpts.collectedExpire||U.renderOpts.collectedExpire>=r.INFINITE_CACHE?!1!==c&&c>0?y.expireTime:void 0:U.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:d.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:e}}}}catch(b){throw(null==e?void 0:e.isStale)&&await u.onRequestError(a,b,{routerKind:"App Router",routePath:d,routeType:"route",revalidateReason:(0,n.getRevalidateReason)({isStaticGeneration:N,isOnDemandRevalidate:D})},!1,C),b}},Z=async(d,f)=>{try{var g,i;let d=await u.handleResponse({req:a,nextConfig:y,cacheKey:L,routeKind:e.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:B,isRoutePPREnabled:!1,isOnDemandRevalidate:D,revalidateOnlyGenerated:E,responseGenerator:Y,waitUntil:c.waitUntil,isMinimalMode:S});if(!J)return;if((null==d||null==(g=d.value)?void 0:g.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(i=d.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});S||b.setHeader("x-nextjs-cache",D?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),A&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let f=(0,p.fromNodeOutgoingHttpHeaders)(d.value.headers);S&&J||f.delete(r.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||b.getHeader("Cache-Control")||f.get("Cache-Control")||f.set("Cache-Control",(0,q.getCacheControlHeader)(d.cacheControl)),await (0,o.I)(V,W,new Response(d.value.body,{headers:f,status:d.value.status||200}));return}catch(b){if(b instanceof s.NoFallbackError||await u.onRequestError(a,b,{routerKind:"App Router",routePath:I,routeType:"route",revalidateReason:(0,n.getRevalidateReason)({isStaticGeneration:N,isOnDemandRevalidate:D})},!1,C),J)throw b;await (0,o.I)(V,W,new Response(null,{status:500}));return}finally{(()=>{if(!d)return;let a=b.statusCode;d.setAttributes({"http.status_code":a,"next.rsc":!1}),a&&a>=500&&(d.setStatus({code:h.SpanStatusCode.ERROR}),d.setAttribute("error.type",a.toString()));let c=P.getRootSpanAttributes();if(!c)return;if(c.get("next.span_type")!==m.BaseServerSpan.handleRequest)return console.warn(`Unexpected root span type '${c.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=c.get("next.route")||I,g=`${O} ${e}`;d.setAttributes({"next.route":e,"http.route":e,"next.span_name":g}),d.updateName(g),f&&f!==d&&(f.setAttribute("http.route",e),f.updateName(g))})()}};if(R&&Q)await Z(Q,void 0);else{let b=P.getActiveScopeSpan();await P.withPropagatedContext(a.headers,()=>P.trace(m.BaseServerSpan.handleRequest,{spanName:`${O} ${d}`,kind:h.SpanKind.SERVER,attributes:{"http.method":O,"http.target":a.url}},a=>Z(a,b)),void 0,!R)}}}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[1083,8574,2969,1415,518,2982,5147,9572,5284,3148,3053,384,5981,7002],()=>b(b.s=994092));module.exports=c})();