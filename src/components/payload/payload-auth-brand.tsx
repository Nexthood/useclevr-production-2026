import Link from "next/link"

import "./payload-auth-brand.css"

export function PayloadAdminLogo() {
  return (
    <div className="payload-useclevr-logo" aria-label="UseClevr content admin">
      <img
        src="/assets/images/logos/useclevr-wordmark-dark.png"
        alt="UseClevr"
        className="payload-useclevr-logo__image payload-useclevr-logo__image--light"
      />
      <img
        src="/assets/images/logos/useclevr-wordmark-light.png"
        alt="UseClevr"
        className="payload-useclevr-logo__image payload-useclevr-logo__image--dark"
      />
      <span>Content admin</span>
    </div>
  )
}

export function PayloadLoginIntro() {
  return (
    <div className="payload-useclevr-auth">
      <p>Manage public news, FAQs, and legal pages.</p>
      <nav aria-label="UseClevr account links">
        <Link href="/login?tab=signup">Create an app account</Link>
        <Link href="/login">Use app sign in</Link>
      </nav>
    </div>
  )
}
