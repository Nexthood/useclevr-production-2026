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
      {isTestSubdomain && (
        <div className="payload-useclevr-credentials mt-2 space-y-2">
          <p className="text-xs font-medium text-cyan-500">Test accounts:</p>
          <div className="space-y-1 text-left text-xs">
            <div>
              <span className="font-medium">Base:</span>{" "}
              <span className="font-mono">base@useclevr.app / 12345678</span>
            </div>
            <div>
              <span className="font-medium">Superadmin:</span>{" "}
              <span className="font-mono">superadmin@useclevr.app / 12345678</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
