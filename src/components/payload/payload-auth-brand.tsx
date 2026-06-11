import "./payload-auth-brand.css"

const TEST_SUBDOMAIN = "test.useclevr.com"

function getIsTestSubdomain(): boolean {
  if (typeof window === "undefined") return false
  return window.location.hostname === TEST_SUBDOMAIN || window.location.hostname.startsWith("test.")
}

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
  const isTestSubdomain = getIsTestSubdomain()
  return (
    <div className="payload-useclevr-auth">
      <p>Manage public news, FAQs, and legal pages.</p>
      <nav>
        <a href="/login" target="_parent">Sign in to UseClevr</a>
        <a href="/login?tab=signup" target="_parent">Sign up</a>
      </nav>
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
