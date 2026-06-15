import "./payload-auth-brand.css"
import { PayloadThemeToggle } from "./payload-theme-toggle"
import { TailwindThemeSync } from "./payload-theme-sync"

export function PayloadAdminLogo() {
  return (
    <>
      <TailwindThemeSync />
      <a className="payload-useclevr-logo" href="/app" target="_parent" aria-label="Open UseClevr dashboard">
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
        <span>Operator admin</span>
      </a>
    </>
  )
}

export function PayloadDashboardLink() {
  return (
    <a className="payload-useclevr-dashboard-link" href="/app" target="_parent">
      Back to dashboard
    </a>
  )
}

export function PayloadLoginIntro() {
  return (
    <div className="payload-useclevr-auth">
      <div className="payload-useclevr-auth__theme">
        <PayloadThemeToggle />
      </div>
      <nav className="payload-useclevr-auth__tabs" aria-label="Account access">
        <span aria-current="page">Sign in</span>
        <a href="/login?tab=signin" target="_parent">
          Dashboard login
        </a>
      </nav>
      <p>Sign in to manage UseClevr content and product operations.</p>
    </div>
  )
}
