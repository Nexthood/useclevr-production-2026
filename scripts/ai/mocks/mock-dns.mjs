const PUBLIC_ADDRESS = "93.184.216.34"

export async function lookup(hostname, options) {
  return [{ address: PUBLIC_ADDRESS, family: 4 }]
}

export async function resolve() {
  return [PUBLIC_ADDRESS]
}
