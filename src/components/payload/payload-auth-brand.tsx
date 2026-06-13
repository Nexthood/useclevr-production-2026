import "./payload-auth-brand.css"
import { PayloadThemeToggle } from "./payload-theme-toggle"
import { TailwindThemeSync } from "./payload-theme-sync"

const TEST_SUBDOMAIN = "test.useclevr.com"

function getIsTestSubdomain(): boolean {
  if (typeof window === "undefined") return false
  return window.location.hostname === TEST_SUBDOMAIN || window.location.hostname.startsWith("test.")
}

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
        <span>Content admin</span>
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
  const isTestSubdomain = getIsTestSubdomain()
  return (
    <div className="payload-useclevr-auth">
      <div className="payload-useclevr-auth__theme">
        <PayloadThemeToggle />
      </div>
      <nav className="payload-useclevr-auth__tabs" aria-label="Account access">
        <span aria-current="page">Sign in</span>
        <a href="/login?tab=signup" target="_parent">
          Sign up
        </a>
      </nav>
      <p>Sign in to manage UseClevr public content.</p>
      {isTestSubdomain && (
        <div className="payload-useclevr-credentials">
          <p className="payload-useclevr-credentials__title">Test accounts:</p>
          <div className="payload-useclevr-credentials__list">
            <div>
              <span className="font-medium">Base:</span>{" "}
              <span className="payload-useclevr-credentials__mono">base@useclevr.app / 12345678</span>
            </div>
            <div>
              <span className="font-medium">Superadmin:</span>{" "}
              <span className="payload-useclevr-credentials__mono">superadmin@useclevr.app / 12345678</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
