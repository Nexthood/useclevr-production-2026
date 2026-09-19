"use strict";exports.id=7887,exports.ids=[7887],exports.modules={47887:(a,b,c)=>{c.a(a,async(a,d)=>{try{c.d(b,{$K:()=>r,uZ:()=>q,w:()=>p});var e=c(912345),f=c(895284),g=c(99694),h=c(259275),i=c(22489),j=c(981977),k=c(665448),l=c(165727),m=c(519572),n=c(606555),o=a([f,g,h]);[f,g,h]=o.then?(await o)():o;let C=null,D=new Set(["checkout.session.completed","customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"]),E=new Set(["canceled","incomplete_expired","unpaid","past_due"]),F=new Set(["canceled","incomplete_expired","unpaid","past_due","ended"]);async function p(a){if(!D.has(a.type))return{synced:!1,reason:`Unhandled event type: ${a.type}`};if(console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] event_received",{eventType:a.type,eventId:a.id,eventCreated:a.created}),"checkout.session.completed"===a.type){let b=await s(a.data.object);return console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] checkout_completed",{synced:b.synced,reason:b.reason}),b}let b=a.data.object;return console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] subscription_event",{eventType:a.type,subscriptionId:b.id,customerId:y(b.customer),stripeStatus:b.status,metadataHasUserId:!!b.metadata?.userId,metadataHasUserEmail:!!b.metadata?.userEmail,metadataHasSubscriptionTier:!!b.metadata?.subscriptionTier}),t(b,a.type)}async function q(a){return s(a)}async function r(a,b,c){return t(a,b,c)}async function s(a){if(console.warn("[SUBSCRIPTION_RECOVERY] checkout_session_sync_started",{sessionId:a.id,mode:a.mode,paymentStatus:a.payment_status,hasSubscription:!!a.subscription,metadataHasUserId:!!a.metadata?.userId,metadataHasSubscriptionTier:!!a.metadata?.subscriptionTier}),"subscription"!==a.mode)return{synced:!1,reason:`Checkout mode is ${a.mode||"unknown"}.`};let b=y(a.customer),c=y(a.subscription),d=a.client_reference_id||a.metadata?.userId||null,h=a.customer_details?.email||a.customer_email||a.metadata?.userEmail||null;if(console.warn("[SUBSCRIPTION_RECOVERY] checkout_session_identifiers",{customerId:b,subscriptionId:c,userId:d,userEmail:h,lookupStrategy:d?"client_reference_id":"metadata_userId"}),!b)return{synced:!1,reason:"Checkout session has no customer ID."};let l=(0,f.L)();if(!l)return{synced:!1,reason:"Database unavailable."};let o={stripeCustomerId:b,updatedAt:new Date};c&&(o.stripeSubscriptionId=c);let p=null;if(c)p=await (function(){if(C)return C;let a=process.env.STRIPE_SECRET_KEY;if(!a)throw Error("STRIPE_SECRET_KEY is not configured.");return C=new m.A(a,{})})().subscriptions.retrieve(c),v(o,p,a.metadata);else{let b=w(a.metadata);b&&(o.subscriptionTier=b)}let q=await u({customerId:b,userId:d,userEmail:h});if(q)console.warn("[SUBSCRIPTION_RECOVERY] checkout_session_profile_found",{profileId:q.id,currentDBTier:q.subscriptionTier,stripeCustomerIdPresent:!!q.stripeCustomerId}),await l.update(j.profiles).set(o).where((0,k.eq)(j.profiles.id,q.id));else{if(!d)return{synced:!1,reason:`No profile for Stripe customer ${b}.`};let a=await l.query.users.findFirst({where:(0,k.eq)(j.users.id,d),columns:{id:!0,email:!0,name:!0}});if(!a)return{synced:!1,reason:`No user for checkout reference ${d}.`};await l.insert(j.profiles).values({id:`profile_${(0,e.A)()}`,userId:d,email:h||a.email,fullName:a.name,...o})}let r=d||q?.userId;if(r&&await x(r,o.subscriptionTier,q?.subscriptionTier),!r)return{synced:!0};await (0,g.L1)({userId:r,userEmail:h||q?.email,type:"subscribed",feature:"subscription",title:"Checkout completed",description:p?`Subscription status is ${p.status}.`:"Stripe checkout completed.",metadata:{stripeCustomerId:b,stripeSubscriptionId:c,stripeSessionId:a.id}});let s=o.subscriptionTier,t=q?.subscriptionTier||null;if(("free"===t||null===t)&&("pro"===s||"business"===s)&&p&&h){let a=q?.userId||d;if(a){let b=await z({email:h,userId:a},"activation");if(b.shouldSend){let b=process.env.NEXT_PUBLIC_APP_URL||"https://useclevr.com/app",c=(0,i.Fg)(p.items.data[0]?.price?.id||""),d=p.items.data[0]?.price?.unit_amount?p.items.data[0].price.unit_amount/100:"business"===s?80:40,e=p.items.data[0]?.price?.currency||"eur",f=p.current_period_end?new Date(1e3*p.current_period_end).toISOString():void 0;(await (0,n.EA)({to:h,planName:"business"===s?"Business":"Pro",billingInterval:"yearly"===c?"yearly":"monthly",amount:d,currency:e.toUpperCase(),activatedAt:new Date().toISOString(),nextBillingDate:f,dashboardUrl:`${b}/app/settings/subscription`})).success&&await A(a,"activation")}else console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] checkout_activation_email_skipped_idempotent",{userId:a,reason:b.reason})}}return{synced:!0}}async function t(a,b,c){var d;if(console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] sync_started",{eventType:b,subscriptionId:a.id}),null==a.customer)return console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] sync_failed",{reason:"no_customer_id"}),{synced:!1,reason:"Subscription event has no customer ID."};let e=y(a.customer);if(!e)return console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] sync_failed",{reason:"invalid_customer_id"}),{synced:!1,reason:"Subscription event has no customer ID."};let h=a.status,l=a.metadata?.userId||null,m=a.metadata?.userEmail||null,n=(0,f.L)();if(!n)return console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] sync_failed",{reason:"database_unavailable"}),{synced:!1,reason:"Database unavailable."};let o=await u({customerId:e,userId:l,userEmail:m});if(!o&&c&&(o=await u({customerId:e,userId:c,userEmail:m})),!o)return console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] profile_not_found",{customerId:e,userIdFromMetadata:l,userEmailFromMetadata:m,authenticatedUserId:c}),{synced:!1,reason:`No profile for customer ${e}`};let p=o.subscriptionTier,q=a.items.data[0]?.price?.id??null,r=q?(0,i._Q)(q):null,s=w(a.metadata);console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] profile_found",{profileId:o.id,userId:o.userId,currentDBTier:p,stripeCustomerIdPresent:!!o.stripeCustomerId,stripeSubscriptionIdPresent:!!o.stripeSubscriptionId,subscriptionStatus:h,stripePriceId:q,mappedUseClevrTier:r,metadataTier:s,eventType:b});let t={stripeCustomerId:e,stripeSubscriptionId:a.id,stripeStatus:h,updatedAt:new Date};v(t,a,void 0,b);let z=!!(t.stripeCustomerId||t.stripeSubscriptionId);console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] db_update",{dbUpdateAttempted:z,previousTier:p,newTier:t.subscriptionTier,stripeStatus:t.stripeStatus,eventType:b});let A=o.id;await n.update(j.profiles).set(t).where((0,k.eq)(j.profiles.id,A));let C=t.subscriptionTier??p;console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] db_update_succeeded",{tierAfterUpdate:C,previousTier:p,eventType:b}),await x(o.userId,t.subscriptionTier,o.subscriptionTier),console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] billing_access_refreshed",{previousTier:p,newTier:C,tierChanged:C!==p,eventType:b});let D=await B({previousTier:p,newTier:C,profile:o,sub:a,eventType:b});return await (0,g.L1)({userId:o.userId,userEmail:o.email,type:C!==p?"subscription_changed":"subscription_updated",feature:"subscription",title:(d=b,"customer.subscription.deleted"===d?"Subscription ended":"customer.subscription.updated"===d?"Subscription updated":"Subscription started"),description:`Subscription status is ${h}.`,metadata:{stripeStatus:h,stripePriceId:t.stripePriceId??null,stripeSubscriptionId:a.id,previousTier:p,newTier:C}}),console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] sync_completed",{finalResolvedEntitlementTier:C,previousTier:p,tierChanged:C!==p,synced:!0,eventType:b,emailSent:D.sent,emailError:D.error}),{synced:!0}}async function u({customerId:a,userId:b,userEmail:c}){let d=(0,f.L)();if(!d)return null;if(b){let e=await d.query.profiles.findFirst({where:(0,k.eq)(j.profiles.userId,b)});if(e)return e;if(a){let c=await d.query.profiles.findFirst({where:(0,k.Uo)((0,k.eq)(j.profiles.stripeCustomerId,a),(0,k.eq)(j.profiles.userId,b))});if(c)return c}if(c){let a=await d.query.profiles.findFirst({where:(0,k.Uo)((0,k.eq)(j.profiles.email,c),(0,k.eq)(j.profiles.userId,b))});if(a)return a}return null}return a?d.query.profiles.findFirst({where:(0,k.eq)(j.profiles.stripeCustomerId,a)}):c?d.query.profiles.findFirst({where:(0,k.eq)(j.profiles.email,c)}):null}function v(a,b,c,d){let e=b.items.data[0]?.price.id??null,f="current_period_end"in b&&"number"==typeof b.current_period_end?new Date(1e3*b.current_period_end):null;a.stripeStatus=b.status,e&&(a.stripePriceId=e);let g="customer.subscription.deleted"===d;if(g||F.has(b.status))a.subscriptionTier="free",console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] subscription_terminated",{eventType:d,subscriptionId:b.id,status:b.status,isDeletedEvent:g,resolvedTier:"free"});else{var h;let d=(e?(h=e,(0,i._Q)(h)):null)||w(b.metadata)||w(c);d&&(a.subscriptionTier=d),E.has(b.status)&&(a.subscriptionTier="free")}f&&(a.stripeCurrentPeriodEnd=f)}function w(a){let b=a?.subscriptionTier||a?.tier||a?.plan||a?.billingPlanId||a?.productId||null;if(!b)return null;let c=b.trim().toLowerCase();return"business"===c||"business_monthly"===c||"business_annual"===c?"business":"pro"===c||"pro_monthly"===c||"pro_annual"===c?"pro":null}async function x(a,b,c){("free"===b||"pro"===b||"business"===b)&&b!==c&&await (0,h.L9)(a,b),(0,l.revalidatePath)("/app"),(0,l.revalidatePath)("/app/settings"),(0,l.revalidatePath)("/app/settings/subscription"),(0,l.revalidatePath)("/app/settings/checkout"),(0,l.revalidatePath)("/app/upload"),(0,l.revalidatePath)("/app/datasets"),(0,l.revalidatePath)("/app/accountancy"),(0,l.revalidatePath)("/app/prebookkeeping")}function y(a){return a?"string"==typeof a?a:a.id||null:null}async function z(a,b){let c=(0,f.L)();if(!c)return{shouldSend:!0,reason:"no_db"};let d=await c.query.profiles.findFirst({where:(0,k.eq)(j.profiles.userId,a.userId),columns:{lastSubscriptionActivationEmailSent:!0,lastSubscriptionCancellationEmailSent:!0,lastSubscriptionCancellationScheduledEmailSent:!0}});if(!d)return{shouldSend:!0,reason:"no_profile"};let e=new Date,g=new Date(e.getTime()-3e5);if("activation"===b){if(d.lastSubscriptionActivationEmailSent&&d.lastSubscriptionActivationEmailSent>g)return{shouldSend:!1,reason:"recently_sent"}}else if("cancellation"===b){if(d.lastSubscriptionCancellationEmailSent&&d.lastSubscriptionCancellationEmailSent>g)return{shouldSend:!1,reason:"recently_sent"}}else if("cancellation_scheduled"===b&&d.lastSubscriptionCancellationScheduledEmailSent&&d.lastSubscriptionCancellationScheduledEmailSent>g)return{shouldSend:!1,reason:"recently_sent"};return{shouldSend:!0,reason:"ok"}}async function A(a,b){let c=(0,f.L)();c&&await c.update(j.profiles).set({[({activation:"lastSubscriptionActivationEmailSent",cancellation:"lastSubscriptionCancellationEmailSent",cancellation_scheduled:"lastSubscriptionCancellationScheduledEmailSent"})[b]]:new Date}).where((0,k.eq)(j.profiles.userId,a))}async function B(a){let{previousTier:b,newTier:c,profile:d,sub:e,eventType:f}=a,g=d.email;if(!g)return console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] email_skipped_no_email",{userId:d.userId}),{sent:!1,error:"no_email"};let h=process.env.NEXT_PUBLIC_APP_URL||"https://useclevr.com/app",j=b!==c&&void 0!==c,k="customer.subscription.updated"===f&&!0===e.cancel_at_period_end&&("pro"===c||"business"===c);if(j&&("free"===b||null===b)&&("pro"===c||"business"===c)){let a=await z(d,"activation");if(!a.shouldSend)return console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] activation_email_skipped_idempotent",{userId:d.userId,reason:a.reason}),{sent:!1,error:a.reason};let b="business"===c?"Business":"Pro",f=(0,i.Fg)(e.items.data[0]?.price?.id||""),j=e.items.data[0]?.price?.unit_amount?e.items.data[0].price.unit_amount/100:"business"===c?80:40,k=e.items.data[0]?.price?.currency||"eur",l=e.current_period_end?new Date(1e3*e.current_period_end).toISOString():void 0,m=await (0,n.EA)({to:g,planName:b,billingInterval:"yearly"===f?"yearly":"monthly",amount:j,currency:k.toUpperCase(),activatedAt:new Date().toISOString(),nextBillingDate:l,dashboardUrl:`${h}/app/settings/subscription`});return m.success&&await A(d.userId,"activation"),console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] activation_email_sent",{success:m.success,error:m.error,planName:b,to:g.substring(0,3)+"***"}),{sent:m.success,error:m.error}}if(j&&("pro"===b||"business"===b)&&"free"===c){let a=await z(d,"cancellation");if(!a.shouldSend)return console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] cancellation_email_skipped_idempotent",{userId:d.userId,reason:a.reason}),{sent:!1,error:a.reason};let c=await (0,n.Jj)({to:g,planName:"business"===b?"Business":"Pro",canceledAt:new Date().toISOString(),datasetsPreserved:!0,purchasedCreditsPreserved:!0,dashboardUrl:`${h}/app/settings/subscription`});return c.success&&await A(d.userId,"cancellation"),console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] cancellation_email_sent",{success:c.success,error:c.error,planName:b,to:g.substring(0,3)+"***"}),{sent:c.success,error:c.error}}if(k){let a=await z(d,"cancellation_scheduled");if(!a.shouldSend)return console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] scheduled_cancellation_email_skipped_idempotent",{userId:d.userId,reason:a.reason}),{sent:!1,error:a.reason};let b=await (0,n.eu)({to:g,planName:"business"===c?"Business":"Pro",currentPeriodEnd:e.current_period_end?new Date(1e3*e.current_period_end).toISOString():new Date().toISOString(),dashboardUrl:`${h}/app/settings/subscription`});return b.success&&await A(d.userId,"cancellation_scheduled"),console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] scheduled_cancellation_email_sent",{success:b.success,error:b.error,planName:c,to:g.substring(0,3)+"***"}),{sent:b.success,error:b.error}}return console.warn("[STRIPE_SUBSCRIPTION_LIFECYCLE] email_not_required",{previousTier:b,newTier:c,eventType:f,tierChanged:j}),{sent:!1,error:"not_required"}}d()}catch(a){d(a)}})},606555:(a,b,c)=>{c.d(b,{EA:()=>f,Jj:()=>g,eu:()=>h,xL:()=>i});var d=c(489208);let e=process.env.EMAIL_FROM||"UseClevr <no-reply@useclevr.com>";async function f(a){let{to:b,planName:c,billingInterval:d,amount:e,currency:f,activatedAt:g,nextBillingDate:h,dashboardUrl:i}=a,k=`Your ${c} subscription is now active`,l=new Intl.NumberFormat("en-US",{style:"currency",currency:f}).format(e),m=`
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
`,emailType:"credit_purchase",from:"UseClevr <no-reply@useclevr.com>"})}async function j(a){let b=process.env.RESEND_API_KEY?.trim();if(!b)return"console"===process.env.EMAIL_PROVIDER?((0,d.cY)(`[Email] ${a.emailType} email (console mode)`,{to:a.to,subject:a.subject}),{success:!0}):(console.error(`[Email] ${a.emailType} failed: RESEND_API_KEY not configured`),{success:!1,error:"RESEND_API_KEY not configured"});try{let c=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${b}`,"Content-Type":"application/json"},body:JSON.stringify({from:a.from||e,to:a.to,subject:a.subject,text:a.text,html:a.html})}),d=await c.json().catch(()=>({})),f="string"==typeof d?.id?d.id:"";if(console.warn(`[Email] ${a.emailType} result`,{status:c.status,ok:c.ok,messageIdReturned:!!f}),!c.ok){let b=d?.message||d?.error||`HTTP ${c.status}`;return console.error(`[Email] ${a.emailType} failed:`,b),{success:!1,error:b}}return{success:!0,messageId:f}}catch(c){let b=c instanceof Error?c.message:"Unknown error";return console.error(`[Email] ${a.emailType} exception:`,b),{success:!1,error:b}}}}};