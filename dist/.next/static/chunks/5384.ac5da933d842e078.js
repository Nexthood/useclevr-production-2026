"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[5384],{13003:(e,s,n)=>{n.d(s,{N0:()=>i,WL:()=>t,hh:()=>o});let t={compare:"Compare Free vs Pro",pro:"Upgrade to Pro",business:"Business Plans",billing:"Billing & Invoices"};function u(e,s=2){return Number.isFinite(e)&&"number"==typeof e?e:s}function i(e=2){let s=u(e);return`You've used all ${s} included upload credits.

Successful uploads permanently consume upload credits.

Deleting datasets does not restore credits.

Upgrade to Pro or Business to continue uploading files.`}function o(e={}){let s=u(e.limit),n=u(e.used,s),t=u(e.remaining,0);return{title:"Free upload limit reached",message:i(s),inlineMessage:function(e=2){let s=u(e);return`You've used all ${s} included upload credits. Successful uploads permanently consume upload credits. Deleting datasets does not restore credits. Upgrade to Pro or Business to continue uploading files.`}(s),usageLabel:`${u(n)} / ${u(s)} upload credits used`,used:n,limit:s,remaining:t}}}}]);