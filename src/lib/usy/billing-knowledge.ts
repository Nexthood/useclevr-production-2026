import type { SupportedUsyLanguage, UsyUsageContext } from "@/lib/usy/types";

/**
 * 13. Usy billing & credit knowledge
 *
 * Deterministic product/billing knowledge so Usy follows exactly the same
 * authoritative subscription and credit rules as the backend:
 * backend entitlement/credit rules → UI → Usy. These three layers must never
 * contradict each other.
 *
 * Usy derives every billing answer from the caller-provided usage context
 * (the same state the backend/UI expose). It never invents balances,
 * subscription status, refund status, or billing history, and it never
 * promises or claims that a refund has been approved.
 */

export const usyBillingKnowledgeRules = {
  freeCannotPurchaseTopUps:
    "Free users cannot purchase new credit top-ups.",
  paidCanPurchaseTopUps:
    "Pro and Business users can purchase additional credits.",
  purchasedNeverExpire:
    "Purchased credits do not expire.",
  purchasedSurvivePlanChanges:
    "Purchased credits survive cancellation, downgrade, and plan changes.",
  freeKeepsPurchasedUsable:
    "A user who becomes Free may continue using already purchased credits until exhausted, but cannot buy more until upgrading to Pro or Business.",
  includedBeforePurchased:
    "Included credits are consumed before purchased credits.",
  cancellationKeepsPaidPeriod:
    "Normal cancellation keeps Pro/Business active until the end of the already-paid billing period.",
  cancellationIsNotRefund:
    "Cancellation and refund are different operations.",
  subscriptionStatusIsSeparateFromInvoiceStatus:
    "Subscription status, invoice/payment status, included plan credits, and purchased/top-up credits are separate billing concepts.",
  refundedInvoiceDoesNotCancelSubscription:
    "A refunded subscription invoice does not automatically cancel the subscription. If Stripe still reports the subscription as active, the user remains Pro/Business until the subscription actually terminates.",
  refundedInvoiceKeepsPurchasedCredits:
    "Purchased credits are preserved when a user later becomes Free; a refund does not automatically remove purchased credits.",
  refundsHandledCentrally:
    "Customers cannot self-issue refunds. Refund requests are handled/reviewed centrally by UseClevr.",
  topUpRefundsDifferFromSubscriptionRefunds:
    "Credit-top-up refunds and subscription refunds are separate billing concepts.",
  neverPromiseRefundApproval:
    "Usy must never promise or claim that a refund has been approved.",
  zeroCreditsGuidance:
    "When usable credits reach zero: Free → upgrade to Pro/Business. Pro/Business → Add Credits.",
  useActualState:
    "Usy must use the user's actual plan/credit state when available and must not invent balances, subscription status, refund status or billing history.",
} as const;

export type UsyBillingTier = "free" | "pro" | "business" | "unlimited" | "unknown";

export type UsyBillingState = {
  tier: UsyBillingTier;
  canPurchaseTopUps: boolean;
  zeroUsableCredits: boolean;
  hasLiveState: boolean;
};

/**
 * Derives the billing state from the caller-provided usage context only.
 * Missing context yields tier "unknown" — Usy then explains that it cannot
 * see live plan data instead of inventing balances or status.
 */
export function resolveUsyBillingState(usage?: UsyUsageContext | null): UsyBillingState {
  if (!usage || (!usage.subscriptionTier && !usage.unlimited)) {
    return { tier: "unknown", canPurchaseTopUps: false, zeroUsableCredits: false, hasLiveState: false };
  }

  if (usage.unlimited) {
    return { tier: "unlimited", canPurchaseTopUps: false, zeroUsableCredits: false, hasLiveState: true };
  }

  const tier = usage.subscriptionTier === "pro" || usage.subscriptionTier === "business"
    ? usage.subscriptionTier
    : "free";
  const canPurchaseTopUps = tier === "pro" || tier === "business";
  const zeroUsableCredits = usage.limitReached === true
    || (typeof usage.availableCredits === "number"
      ? usage.availableCredits <= 0
      : typeof usage.remainingCredits === "number"
        ? usage.remainingCredits <= 0
        : false);

  return { tier, canPurchaseTopUps, zeroUsableCredits, hasLiveState: true };
}

type BillingCopy = Record<SupportedUsyLanguage, {
  topUpPaid: string
  topUpFree: string
  topUpUnknown: string
  refund: string
  cancellation: string
  downgrade: string
  zeroCreditsFree: string
  zeroCreditsPaid: string
  zeroCreditsUnknown: string
  overviewFree: string
  overviewPaid: string
  overviewUnknown: string
}>

const billingCopy: BillingCopy = {
  english: {
    topUpFree: "Credit top-ups are available on the Pro and Business plans only. On Free you cannot buy additional credits — upgrade to Pro or Business to purchase them.",
    topUpPaid: "You can purchase additional credits any time from the billing settings via Add Credits.",
    topUpUnknown: "Credit top-ups are available on the Pro and Business plans. You can review your options in the billing settings.",
    refund:
      "Refunds are not self-service. Refund requests are reviewed centrally by UseClevr. I can never promise any refund outcome, and I never confirm refund decisions. Cancellation and refund are different operations: canceling keeps your paid plan until the end of the already-paid billing period, while a refund reverses a payment. Subscription status and invoice/payment status are separate: a refunded subscription invoice does not automatically cancel the subscription. If the subscription is still active, you remain Pro or Business until it actually terminates, and your purchased credits are preserved. For a refund request, contact the Billing team via the support form.",
    cancellation:
      "A normal cancellation keeps Pro or Business active until the end of the already-paid billing period. After that the account moves to Free: included credits reset to the Free allowance, while purchased credits are preserved, do not expire, and remain usable until exhausted. Cancellation and refund are different operations — a refund request is reviewed centrally by UseClevr.",
    downgrade:
      "If your account becomes Free, your purchased credits are preserved: they do not expire, they survive downgrades and plan changes, and you can keep using them until they are exhausted. You cannot buy new top-ups on Free — upgrading to Pro or Business unlocks purchasing again.",
    zeroCreditsFree:
      "Your usable credits are exhausted. Upgrade to Pro or Business to get more included credits — credit top-ups can be purchased on those plans.",
    zeroCreditsPaid:
      "Your usable credits are exhausted. Use the Add Credits option in Billing to purchase additional credits — purchased credits do not expire.",
    zeroCreditsUnknown:
      "I cannot see your live credit balance. Open Billing to review your current credits and options.",
    overviewFree:
      "You are on Free: you cannot purchase credit top-ups. Your purchased credits are preserved, do not expire, remain usable until exhausted, and included credits are always consumed before purchased credits.",
    overviewPaid:
      "You can purchase additional credit top-ups at any time. Purchased credits do not expire, survive downgrades and plan changes, and are consumed after your included credits.",
    overviewUnknown:
      "I cannot see your live plan or credit state. You can review your plan, credits, and purchase options in the Billing settings. Purchased credits never expire, survive downgrades and plan changes, and are consumed after included credits.",
  },
  german: {
    topUpFree: "Credit-Top-ups sind nur in den Plänen Pro und Business verfügbar. Auf Free kannst du keine zusätzlichen Credits kaufen — wechsle zu Pro oder Business, um Credits zu erwerben.",
    topUpPaid: "Du kannst jederzeit zusätzliche Credits über die Billing-Einstellungen erwerben (Add Credits).",
    topUpUnknown: "Credit-Top-ups sind in den Plänen Pro und Business verfügbar. Deine aktuellen Optionen siehst du in den Billing-Einstellungen.",
    refund:
      "Rückerstattungen sind nicht als Selbstservice möglich. Refund-Anfragen werden zentral von UseClevr geprüft. Ich kann niemals einen Rückerstattungsausgang zusagen und bestätige keine Rückerstattungsentscheidungen. Kündigung und Rückerstattung sind unterschiedliche Vorgänge: Eine Kündigung hält Pro oder Business bis zum Ende der bereits bezahlten Abrechnungsperiode aktiv, während eine Rückerstattung eine Zahlung zurückbucht. Abostatus und Rechnungs-/Zahlungsstatus sind getrennt: Eine erstattete Aborechnung bedeutet nicht automatisch, dass das Abonnement gekündigt ist. Solange das Abonnement aktiv bleibt, bleibst du Pro oder Business, bis es tatsächlich endet, und deine gekauften Credits bleiben erhalten. Für eine Rückerstattungsanfrage kontaktiere das Billing-Team über den Support.",
    cancellation:
      "Eine normale Kündigung hält Pro oder Business bis zum Ende der bereits bezahlten Abrechnungsperiode aktiv. Danach wechselt das Konto auf Free: enthaltene Credits werden auf das Free-Kontingent zurückgesetzt, gekaufte Credits bleiben erhalten, verfallen nicht und bleiben nutzbar. Kündigung und Rückerstattung sind unterschiedliche Vorgänge — Refund-Anfragen werden zentral von UseClevr geprüft.",
    downgrade:
      "Wird dein Konto Free, bleiben deine gekauften Credits erhalten: Sie verfallen nicht, überstehen Downgrades und Planwechsel und bleiben nutzbar, bis sie aufgebraucht sind. Neue Top-ups kannst du erst wieder nach einem Upgrade auf Pro oder Business kaufen.",
    zeroCreditsFree:
      "Deine nutzbaren Credits sind aufgebraucht. Wechsle zu Pro oder Business, um weitere enthaltene Credits zu erhalten — Credit-Top-ups kannst du erst nach dem Upgrade kaufen.",
    zeroCreditsPaid:
      "Deine nutzbaren Credits sind aufgebraucht. Nutze Add Credits in den Billing-Einstellungen — gekaufte Credits verfallen nicht.",
    zeroCreditsUnknown:
      "Ich kann deinen aktuellen Credit-Stand nicht sehen. Öffne die Billing-Einstellungen, um deine Credits und Optionen zu prüfen.",
    overviewFree:
      "Du bist im Free-Plan: Credit-Top-ups kannst du nicht kaufen. Deine gekauften Credits bleiben erhalten, verfallen nicht, bleiben bis zur Aufbrauchung nutzbar, und enthaltene Credits werden immer vor gekauften verbraucht.",
    overviewPaid:
      "Du kannst jederzeit zusätzliche Credits kaufen. Gekaufte Credits verfallen nicht, überstehen Downgrades und Planwechsel und werden erst nach deinen enthaltenen Credits verbraucht.",
    overviewUnknown:
      "Ich kann deinen aktuellen Plan- und Credit-Stand nicht sehen. Plan, Credits und Kaufoptionen findest du in den Billing-Einstellungen. Gekaufte Credits verfallen nicht, überstehen Downgrades und Planwechsel und werden erst nach enthaltenen Credits verbraucht.",
  },
  dutch: {
    topUpFree: "Credit-top-ups zijn alleen beschikbaar in de Pro- en Business-plannen. Op Free kun je geen extra credits kopen — upgrade naar Pro of Business om credits aan te kopen.",
    topUpPaid: "Je kunt op elk moment extra credits kopen via de billing-instellingen (Add Credits).",
    topUpUnknown: "Credit-top-ups zijn beschikbaar in de Pro- en Business-plans. Je actuele opties zie je in de billing-instellingen.",
    refund:
      "Terugbetalingen zijn geen selfservice. Refund-verzoeken worden centraal door UseClevr beoordeeld. Ik kan nooit een terugbetalingsuitkomst beloven en bevestig geen terugbetalingsbeslissingen. Opzeggen en terugbetalen zijn verschillende handelingen: opzeggen houdt Pro of Business actief tot het einde van de reeds betaalde factuurperiode, terwijl een terugbetaling een betaling ongedaan maakt. Abonnementsstatus en factuur-/betalingsstatus zijn gescheiden: een terugbetaalde abonnementsfactuur betekent niet automatisch dat het abonnement is opgezegd. Zolang het abonnement actief blijft, blijf je Pro of Business tot het daadwerkelijk eindigt, en je gekochte credits blijven bewaard. Voor een refund-verzoek neem je contact op met het Billing-team via support.",
    cancellation:
      "Een normale opzegging houdt Pro of Business actief tot het einde van de reeds betaalde factuurperiode. Daarna gaat het account naar Free: inbegrepen credits worden gereset naar de Free-toelage, terwijl gekochte credits bewaard blijven, niet vervallen en bruikbaar blijven. Opzeggen en terugbetalen zijn verschillende handelingen — refund-verzoeken worden centraal door UseClevr beoordeeld.",
    downgrade:
      "Wordt je account Free, dan blijven je gekochte credits bewaard: ze verlopen niet, overleven downgrades en planwijzigingen en blijven bruikbaar tot ze op zijn. Nieuwe top-ups kun je pas weer kopen na een upgrade naar Pro of Business.",
    zeroCreditsFree:
      "Je bruikbare credits zijn op. Upgrade naar Pro of Business voor meer inbegrepen credits — credit-top-ups kun je pas na de upgrade kopen.",
    zeroCreditsPaid:
      "Je bruikbare credits zijn op. Gebruik Add Credits in Billing — gekochte credits verlopen niet.",
    zeroCreditsUnknown:
      "Ik kan je huidige creditsaldo niet zien. Open de billing-instellingen om je credits en opties te bekijken.",
    overviewFree:
      "Je zit op Free: je kunt geen credit-top-ups kopen. Je gekochte credits blijven bewaard, verlopen niet, blijven bruikbaar tot ze op zijn, en inbegrepen credits worden altijd vóór gekochte credits verbruikt.",
    overviewPaid:
      "Je kunt op elk moment extra credits kopen. Gekochte credits verlopen niet, overleven downgrades en planwijzigingen en worden pas na je inbegrepen credits verbruikt.",
    overviewUnknown:
      "Ik kan je huidige plan- en creditstatus niet zien. Je plan, credits en aankoopopties vind je in de billing-instellingen. Gekochte credits verlopen niet, overleven downgrades en planwijzigingen en worden pas na inbegrepen credits verbruikt.",
  },
  spanish: {
    topUpFree: "Las recargas de créditos solo están disponibles en los planes Pro y Business. En Free no puedes comprar créditos adicionales — mejora a Pro o Business para comprarlos.",
    topUpPaid: "Puedes comprar créditos adicionales en cualquier momento desde la facturación (Add Credits).",
    topUpUnknown: "Las recargas de créditos están disponibles en los planes Pro y Business. Revisa tus opciones en la facturación.",
    refund:
      "Los reembolsos no son de autoservicio. Las solicitudes de reembolso las revisa centralmente UseClevr. Yo nunca puedo prometer el resultado de un reembolso ni confirmo decisiones de reembolso. La cancelación y el reembolso son operaciones distintas: cancelar mantiene Pro o Business activo hasta el final del periodo ya pagado, mientras que un reembolso revierte un pago. El estado de la suscripción y el de la factura/pago son independientes: una factura de suscripción reembolsada no cancela automáticamente la suscripción. Mientras la suscripción siga activa, permaneces Pro o Business hasta que finalice de verdad, y tus créditos comprados se conservan. Para una solicitud de reembolso, contacta al equipo de Facturación vía soporte.",
    cancellation:
      "Una cancelación normal mantiene Pro o Business activo hasta el final del periodo ya pagado. Después la cuenta pasa a Free: los créditos incluidos se restablecen a la asignación Free, mientras que los créditos comprados se conservan, no expiran y siguen utilizables. Cancelar y reembolsar son operaciones distintas: las solicitudes de reembolso las revisa centralmente UseClevr.",
    downgrade:
      "Si tu cuenta pasa a Free, tus créditos comprados se conservan: no expiran, sobreviven a degradaciones y cambios de plan, y puedes seguir usándolos hasta agotarlos. No puedes comprar nuevas recargas hasta mejorar a Pro o Business.",
    zeroCreditsFree:
      "Tus créditos utilizables se agotaron. Mejora a Pro o Business para obtener más créditos incluidos — las recargas de créditos solo pueden comprarse después de la mejora.",
    zeroCreditsPaid:
      "Tus créditos utilizables se agotaron. Usa Add Credits en la facturación — los créditos comprados no caducan.",
    zeroCreditsUnknown:
      "No puedo ver tu saldo de créditos actual. Abre la facturación para revisar tus créditos y opciones.",
    overviewFree:
      "Estás en Free: no puedes comprar recargas de créditos. Tus créditos comprados se conservan, no expiran, siguen utilizables hasta agotarse, y los créditos incluidos siempre se consumen antes que los comprados.",
    overviewPaid:
      "Puedes comprar créditos adicionales en cualquier momento. Los créditos comprados no expiran, sobreviven a degradaciones y cambios de plan, y se consumen después de tus créditos incluidos.",
    overviewUnknown:
      "No puedo ver el estado actual de tu plan y tus créditos. Puedes revisar tu plan, créditos y opciones de compra en la facturación. Los créditos comprados no expiran, sobreviven a degradaciones y cambios de plan, y se consumen después de los incluidos.",
  },
  hungarian: {
    topUpFree: "A kreditfeltöltés csak a Pro és Business csomagokban érhető el. Free csomaggal nem vásárolhatsz plusz krediteket — válts Pro-ra vagy Business-ra a vásárláshoz.",
    topUpPaid: "Bármikor vásárolhatsz további krediteket a számlázási beállításokban (Add Credits).",
    topUpUnknown: "A kreditfeltöltés a Pro és Business csomagokban érhető el. Aktuális lehetőségeidet a számlázási beállításokban látod.",
    refund:
      "A visszatérítés nem önkiszolgáló. A refund-kérelmeket központilag a UseClevr bírálja el. Én soha nem ígérem meg a visszatérítés eredményét, és nem erősítek meg visszatérítési döntéseket. A lemondás és a visszatérítés különböző műveletek: a lemondás a már kifizetett számlázási időszak végéig aktívan tartja a Pro vagy Business csomagot, míg a visszatérítés egy fizetést von vissza. Az előfizetés állapota és a számla/fizetés állapota külön válik: egy visszatérített előfizetési számla nem jelenti automatikusan az előfizetés lemondását. Amíg az előfizetés aktív marad, Pro vagy Business maradsz, amíg tényleg le nem jár, és a megvásárolt krediteid megmaradnak. Refund-kérelmet a Billing csapatnak nyújthatsz be a supporton keresztül.",
    cancellation:
      "A normál lemondás a már kifizetett számlázási időszak végéig aktívan tartja a Pro vagy Business csomagot. Utána a fiók Free-re vált: az inkluzív kreditek a Free keretre állnak vissza, a megvásárolt kreditek megmaradnak, nem járnak le és használhatók maradnak. A lemondás és a visszatérítés különböző műveletek — a refund-kérelmeket központilag a UseClevr bírálja el.",
    downgrade:
      "Ha a fiókod Free lesz, a megvásárolt krediteid megmaradnak: nem járnak le, túlélik a downgrade-et és a csomagváltást, és addig használhatók, amíg el nem fogynak. Új kreditfeltöltést csak Pro vagy Business frissítés után vásárolhatsz.",
    zeroCreditsFree:
      "A használható krediteid elfogytak. Válts Pro-ra vagy Business-ra több inkluzív kreditért — a kreditfeltöltést csak a váltás után vásárolhatod meg.",
    zeroCreditsPaid:
      "A használható krediteid elfogytak. Használd az Add Credits lehetőséget a számlázásban — a megvásárolt kreditek nem járnak le.",
    zeroCreditsUnknown:
      "Nem látom az aktuális kredit-egyenlegedet. Nyisd meg a számlázást a krediteid és lehetőségeid áttekintéséhez.",
    overviewFree:
      "Free csomagon vagy: kreditfeltöltést nem vásárolhatsz. A megvásárolt krediteid megmaradnak, nem járnak le, a felhasználásukig használhatók, és az inkluzív kreditek mindig a megvásároltak előtt fogyannak.",
    overviewPaid:
      "Bármikor vásárolhatsz további krediteket. A megvásárolt kreditek nem járnak le, túlélik a leminősítést és a csomagváltást, és csak az inkluzív kreditek elfogyasztása után fogyasztódnak.",
    overviewUnknown:
      "Nem látom az aktuális csomag- és kreditállapotodat. A csomagod, krediteid és vásárlási lehetőségeid a számlázási beállításokban ellenőrizhetők. A megvásárolt kreditek nem járnak le, túlélik a leminősítést és a csomagváltást, és az inkluzív kreditek után fogyasztódnak.",
  },
  romanian: {
    topUpFree: "Reîncărcările de credite sunt disponibile doar în planurile Pro și Business. Pe Free nu poți cumpăra credite suplimentare — fă upgrade la Pro sau Business pentru a le cumpăra.",
    topUpPaid: "Poți cumpăra credite suplimentare oricând din facturare (Add Credits).",
    topUpUnknown: "Reîncărcările de credite sunt disponibile în planurile Pro și Business. Opțiunile tale actuale sunt vizibile în secțiunea de facturare.",
    refund:
      "Rambursările nu sunt la liber. Solicitările de rambursare sunt analizate central de UseClevr. Eu nu pot niciodată promite rezultatul unei rambursări și nu confirm deciziile de rambursare. Anularea și rambursarea sunt operațiuni diferite: anularea menține Pro sau Business activ până la finalul perioadei deja plătite, în timp ce rambursarea anulează o plată. Starea abonamentului și starea facturii/plății sunt separate: o factură de abonament rambursată nu anulează automat abonamentul. Cât timp abonamentul rămâne activ, rămâi Pro sau Business până când se încheie efectiv, iar creditele cumpărate se păstrează. Pentru o solicitare de rambursare, contactează echipa de facturare prin suport.",
    cancellation:
      "Anularea normală menține Pro sau Business activ până la finalul perioadei deja plătite. După aceea contul trece pe Free: creditele incluse se resetează la alocarea Free, iar creditele cumpărate se păstrează, nu expiră și rămân utilizabile. Anularea și rambursarea sunt operațiuni diferite — solicitările de rambursare sunt analizate central de UseClevr.",
    downgrade:
      "Dacă contul tău devine Free, creditele cumpărate se păstrează: nu expiră, supraviețuiesc downgrade-urilor și schimbărilor de plan și rămân utilizabile până se epuizează. Nu poți cumpăra reîncărcări noi până nu treci la Pro sau Business.",
    zeroCreditsFree:
      "Creditele utilizabile s-au epuizat. Treci la Pro sau Business pentru credite incluse suplimentare — reîncărcările de credite pot fi cumpărate doar după trecere.",
    zeroCreditsPaid:
      "Creditele utilizabile s-au epuizat. Folosește Add Credits din facturare — creditele cumpărate nu expiră.",
    zeroCreditsUnknown:
      "Nu îmi pot vedea soldul actual de credite. Deschide secțiunea de facturare pentru a-ți verifica creditele și opțiunile.",
    overviewFree:
      "Ești pe Free: nu poți cumpăra reîncărcări de credite. Creditele cumpărate se păstrează, nu expiră, rămân utilizabile până se epuizează, iar creditele incluse sunt întotdeauna consumate înaintea celor cumpărate.",
    overviewPaid:
      "Poți cumpăra credite suplimentare oricând. Creditele cumpărate nu expiră, supraviețuiesc downgrade-urilor și schimbărilor de plan și se consumă după creditele incluse.",
    overviewUnknown:
      "Nu pot vedea starea actuală a planului și a creditelor. Îți poți verifica planul, creditele și opțiunile de cumpărare în setările de facturare. Creditele cumpărate nu expiră, supraviețuiesc downgrade-urilor și schimbărilor de plan și se consumă după cele incluse.",
  },
} as const;


export function buildUsyBillingOverviewAnswer(usage: UsyUsageContext | null | undefined, language: SupportedUsyLanguage): string {
  const state = resolveUsyBillingState(usage);
  if (state.tier === "free") return billingCopy[language].overviewFree;
  if (state.tier === "pro" || state.tier === "business") return billingCopy[language].overviewPaid;
  return billingCopy[language].overviewUnknown;
}

export function buildUsyTopUpAnswer(usage: UsyUsageContext | null | undefined, language: SupportedUsyLanguage): string {
  const state = resolveUsyBillingState(usage);
  if (state.tier === "free") return billingCopy[language].topUpFree;
  if (state.tier === "pro" || state.tier === "business") return billingCopy[language].topUpPaid;
  return billingCopy[language].topUpUnknown;
}

export function buildUsyRefundAnswer(_usage: UsyUsageContext | null | undefined, language: SupportedUsyLanguage): string {
  return billingCopy[language].refund;
}

const subscriptionStatusCopy: Record<SupportedUsyLanguage, string> = {
  english:
    "Subscription status and invoice/payment status are separate: your subscription tier decides which plan features and included credits are active, while an invoice records a payment event such as paid or refunded. Included plan credits and purchased/top-up credits are tracked separately, with included credits consumed before purchased credits. A refunded subscription invoice does not automatically cancel the subscription: if the subscription is still active, you remain Pro or Business until it actually terminates. I state only the status visible in your account and never invent billing events.",
  german:
    "Abostatus und Rechnungs-/Zahlungsstatus sind getrennt: Deine Abostufe bestimmt, welche Planfunktionen und enthaltenen Credits aktiv sind, während eine Rechnung ein Zahlungsereignis wie bezahlt oder erstattet abbildet. Enthaltene Plan-Credits und gekaufte Top-up-Credits werden getrennt geführt, wobei enthaltene Credits vor gekauften verbraucht werden. Eine erstattete Aborechnung kündigt das Abonnement nicht automatisch: Solange das Abonnement aktiv ist, bleibst du Pro oder Business, bis es tatsächlich endet. Ich nenne nur den in deinem Konto sichtbaren Status und erfinde keine Billing-Ereignisse.",
  dutch:
    "Abonnementsstatus en factuur-/betalingsstatus zijn gescheiden: je abonnementsniveau bepaalt welke planfuncties en inbegrepen credits actief zijn, terwijl een factuur een betalingsgebeurtenis zoals betaald of terugbetaald vastlegt. Inbegrepen plancredits en gekochte top-up-credits worden apart bijgehouden, waarbij inbegrepen credits vóór gekochte credits worden verbruikt. Een terugbetaalde abonnementsfactuur zegt het abonnement niet automatisch op: zolang het abonnement actief is, blijf je Pro of Business tot het daadwerkelijk eindigt. Ik noem alleen de status die in je account zichtbaar is en verzin geen factuurgebeurtenissen.",
  spanish:
    "El estado de la suscripción y el de la factura/pago son independientes: tu nivel de suscripción determina qué funciones del plan y créditos incluidos están activos, mientras que una factura registra un evento de pago como pagada o reembolsada. Los créditos incluidos del plan y los créditos comprados/recarga se registran por separado, y los incluidos se consumen antes que los comprados. Una factura de suscripción reembolsada no cancela automáticamente la suscripción: mientras siga activa, permaneces Pro o Business hasta que finalice de verdad. Solo indico el estado visible en tu cuenta y nunca invento eventos de facturación.",
  hungarian:
    "Az előfizetés állapota és a számla/fizetés állapota különválik: az előfizetési szinted határozza meg, mely csomagfunkciók és inkluzív kreditek aktívak, míg a számla egy fizetési eseményt rögzít, például kifizetve vagy visszatérítve. Az inkluzív csomagkrediteket és a megvásárolt/feltöltött krediteket külön vezetjük, és az inkluzív kreditek fogyognak először. Egy visszatérített előfizetési számla nem mondja fel automatikusan az előfizetést: amíg az előfizetés aktív, Pro vagy Business maradsz, amíg tényleg le nem jár. Csak a fiókodban látható állapotot mondom meg, és nem találok ki számlázási eseményeket.",
  romanian:
    "Starea abonamentului și starea facturii/plății sunt separate: nivelul abonamentului tău decide ce funcții de plan și credite incluse sunt active, în timp ce o factură înregistrează un eveniment de plată, precum plătită sau rambursată. Creditele incluse în plan și creditele cumpărate/reîncărcabile se urmăresc separat, iar cele incluse se consumă înaintea celor cumpărate. O factură de abonament rambursată nu anulează automat abonamentul: cât timp abonamentul rămâne activ, rămâi Pro sau Business până când se încheie efectiv. Menționez doar starea vizibilă în contul tău și nu inventez evenimente de facturare.",
};

export function buildUsySubscriptionStatusAnswer(_usage: UsyUsageContext | null | undefined, language: SupportedUsyLanguage): string {
  return subscriptionStatusCopy[language];
}

export function buildUsyCancellationAnswer(usage: UsyUsageContext | null | undefined, language: SupportedUsyLanguage): string {
  return billingCopy[language].cancellation;
}

export function buildUsyDowngradeAnswer(_usage: UsyUsageContext | null | undefined, language: SupportedUsyLanguage): string {
  return billingCopy[language].downgrade;
}

export function buildUsyZeroCreditsAnswer(usage: UsyUsageContext | null | undefined, language: SupportedUsyLanguage): string {
  const state = resolveUsyBillingState(usage);
  if (!state.hasLiveState || state.tier === "unknown") return billingCopy[language].zeroCreditsUnknown;
  if (state.tier === "free") return billingCopy[language].zeroCreditsFree;
  if (state.tier === "unlimited") return billingCopy[language].zeroCreditsUnknown;
  return billingCopy[language].zeroCreditsPaid;
}

export function buildUsyPurchasedRulesAnswer(language: SupportedUsyLanguage): string {
  const purchasedRules: Record<SupportedUsyLanguage, string> = {
    english: "Included credits are consumed before purchased credits. Purchased credits do not expire and survive downgrades and plan changes.",
    german: "Enthaltene Credits werden vor gekauften Credits verbraucht. Gekaufte Credits verfallen nicht und überstehen Downgrades und Planwechsel.",
    dutch: "Inbegrepen credits worden vóór gekochte credits verbruikt. Gekochte credits vervallen niet en overleven downgrades en planwijzigingen.",
    spanish: "Los créditos incluidos se consumen antes que los créditos comprados. Los créditos comprados no caducan y sobreviven a degradaciones y cambios de plan.",
    hungarian: "Az inkluzív kreditek a megvásároltak előtt fogyannak el. A megvásárolt kreditek nem járnak le, és túlélik a leminősítést és a csomagváltást.",
    romanian: "Creditele incluse sunt consumate înaintea celor cumpărate. Creditele cumpărate nu expiră și supraviețuiesc downgrade-urilor și schimbărilor de plan.",
  };
  return purchasedRules[language];
}

const creditCountLocales: Record<SupportedUsyLanguage, string> = {
  english: "en-US",
  german: "de-DE",
  dutch: "nl-NL",
  spanish: "es-ES",
  hungarian: "hu-HU",
  romanian: "ro-RO",
};

/**
 * Formats credit/dataset counts with the locale-appropriate separator
 * (1,500 / 1.500) so answers stay deterministic in every language.
 */
export function formatUsyCreditCount(count: number, language: SupportedUsyLanguage): string {
  return count.toLocaleString(creditCountLocales[language]);
}
