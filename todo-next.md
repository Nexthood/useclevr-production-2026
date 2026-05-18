# TODO Next

1. Done: Keep the public brand spelling as UseClevr everywhere.

2. Done: Use the current local runtime target and package manager in local setup, CI, and production install scripts.

3. Done: Show the main dashboard settings pages, including profile, preferences, business, subscription, checkout, billing, credits, and payment setup.

4. Done: Show business-profile progress in the dashboard topbar.

5. Done: Show Hybrid AI Lite for Pro and Hybrid AI MEGA for Business in the plan prompts.

6. Done: Keep Kilo project settings in the repo and allow workspace commands through the project configuration.

7. Done: Add dashboard support tickets, customer FAQ, super-admin FAQ, and public billing FAQ.

8. Mostly done: Improve contrast on the signup page and common dashboard buttons; run a final visual pass across login, signup, pricing, checkout, settings, and dashboard in light and dark themes.

9. Partial: Referral links, QR codes, click counts, signup counts, paid counts, and reward totals exist; connect referrals to real account signup and paid subscription events.

10. Partial: Referral rewards are visible as counters; add super-admin settings for referral credit rules, including 5 referrals for 1 credit.

11. Partial: Plan and checkout settings exist; make public plan prices, plan copy, discounts, and checkout totals read from the super-admin settings.

12. Not done: Add a super-admin customer dashboard with totals, customer list, signup date, last login, referral source, plan status, login count, and customer activity.

13. Not done: Add editable customer levels with five levels, interaction goals, page visits, uploads, credit use, login goals, and credit rewards.

14. Not done: Add discount management for free discounts, 10 percent discounts, referral discounts, and clear stacking rules.

15. Production risk: Move tickets, referral events, billing settings, and support notes from temporary file storage into the database.

16. Production risk: Make referral signup and paid events idempotent so refreshes, retries, or replayed payment events cannot grant duplicate rewards.

17. Production risk: Block self-referrals, repeated referral abuse, fake signups, and paid-event fraud before issuing credits.

18. Production risk: Reconcile payment-provider events after downtime so access, invoices, failed payments, and plan changes stay correct.

19. Production risk: Add clear behavior for checkout abandonment, downgrade timing, plan proration, refunds, and expired cards.

20. Product risk: Decide how credits expire, how level rewards are backfilled, and whether credits can be removed after refunds or cancellations.

21. Product risk: Add privacy rules for referred-user lists so customers only see safe referral details.

22. Data risk: Test empty uploads, huge CSV files, malformed rows, missing headers, unusual currencies, and mixed time zones.

23. AI risk: Keep AI answers tied to uploaded data and clearly handle cases where the dataset cannot answer the question.

24. Access risk: Verify every super-admin page redirects regular users and that user tickets cannot be opened by other users.

25. Deployment risk: Keep the generated production bundle, hosting config, healthcheck, runtime version, and environment setup aligned.

26. Accessibility risk: Check keyboard focus, modal focus traps, color contrast, long labels, small screens, and sidebar/topbar overflow.

27. CMS idea: Consider a lightweight Next.js CMS path so public pages, pricing copy, FAQs, plan descriptions, and marketing sections can be edited from admin instead of code.

28. CMS migration suggestion: Start with a database-backed content table and admin editor for FAQs and plan copy, then add preview, publish history, role-based editing, and cached public rendering.
