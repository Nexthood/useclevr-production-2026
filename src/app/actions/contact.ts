"use server"

import { createTicket } from "@/lib/support/ticket-store"

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : ""
}

export async function submitContactRequest(formData: FormData) {
  const name = clean(formData.get("name"))
  const email = clean(formData.get("email")).toLowerCase()
  const company = clean(formData.get("company"))
  const message = clean(formData.get("message"))
  const requestType = clean(formData.get("requestType")) || "Demo request"

  if (!name || !email || !message) {
    return { error: "Name, email, and message are required." }
  }

  if (!email.includes("@")) {
    return { error: "Enter a valid email address." }
  }

  await createTicket({
    userId: `public:${email}`,
    userEmail: email,
    subject: `${requestType}: ${name}${company ? `, ${company}` : ""}`,
    message,
    category: requestType,
    priority: requestType === "Sales question" ? "urgent" : "normal",
  })

  return { success: true }
}
