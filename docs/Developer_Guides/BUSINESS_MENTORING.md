# Business Mentoring Developer Guide

Backend implementation for the Business Mentoring feature.

## Database Schema

```sql
-- Mentoring sessions table
CREATE TABLE MentoringSession (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES "User"(id),
  mentorId TEXT REFERENCES "User"(id),
  type TEXT NOT NULL, -- 'fundraising', 'growth', 'operations', 'financial', 'product'
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
  scheduledAt TIMESTAMP,
  duration INTEGER, -- minutes
  notes TEXT,
  recordingUrl TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Mentorship subscriptions
ALTER TABLE Profile ADD COLUMN mentorshipUsed INTEGER DEFAULT 0;
```

## API Routes

| Method | Endpoint                      | Description                    |
| ------ | ----------------------------- | ------------------------------ |
| GET    | `/api/mentoring/sessions`     | List user's mentoring sessions |
| POST   | `/api/mentoring/sessions`     | Book a new mentoring session   |
| GET    | `/api/mentoring/experts`      | List available expert mentors  |
| PATCH  | `/api/mentoring/sessions/:id` | Update session status or notes |

## Integration Points

- AI tracing records mentoring session context in `aiInteractionTraces` for follow-up questions
- Dashboard widget shows next scheduled session
- Progress tracking integrates with business profile completion
- Calendar sync available through third-party providers
