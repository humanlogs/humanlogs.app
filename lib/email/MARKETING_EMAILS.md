# Marketing Email System

This document explains how the marketing email system works for new users.

## Overview

The marketing email system sends a series of 3 emails to new users:

1. **Welcome Email** (sent immediately upon signup)
2. **Follow-up Email** (sent 1 week after signup)
3. **Discount Email** (sent 2 weeks after follow-up, 3 weeks total)

The system automatically stops sending emails if:

- The user has paid for a plan (credits > 100 or creditsUsed > 100)
- The sequence is complete (3 emails sent)

## Email Schedule

```
Day 0:  User signs up → Welcome email sent immediately
Day 7:  Follow-up email ("How is it going?")
Day 21: Discount email ("Still looking around?" with 30% discount code: 30LOGS)
```

## Database Schema

The following fields track the marketing email state in the `User` model:

- `marketingEmailStep`: Integer tracking which email the user should receive next
  - `0`: No emails sent yet (new users start here)
  - `1`: Welcome email sent
  - `2`: Follow-up email sent
  - `99`: Sequence complete or skipped (no more emails)

- `lastMarketingEmailAt`: Timestamp of when the last marketing email was sent

## Files

### Templates

- [`lib/email/email-templates-marketing.ts`](../lib/email/email-templates-marketing.ts)
  - `getWelcomeMarketingEmailTemplate()` - Welcome email
  - `getFollowUpEmailTemplate()` - Follow-up email (1 week)
  - `getDiscountEmailTemplate()` - Discount email (3 weeks)

### Service

- [`lib/email/marketing-email-service.ts`](../lib/email/marketing-email-service.ts)
  - `sendWelcomeMarketingEmail()` - Send welcome email and update step to 1
  - `sendFollowUpMarketingEmail()` - Send follow-up email and update step to 2
  - `sendDiscountMarketingEmail()` - Send discount email and update step to 99
  - `processMarketingEmails()` - Main function run by cron job

### Cron Job

- [`lib/utils/cron-jobs.ts`](../lib/utils/cron-jobs.ts)
  - Runs daily at 10:00 AM
  - Calls `processMarketingEmails()` to send scheduled emails

### Integration

- [`lib/auth/local-auth.ts`](../lib/auth/local-auth.ts)
  - `registerLocal()` function sends welcome email after creating new user

## How It Works

### 1. User Signup

When a user signs up, the `registerLocal()` function:

1. Creates the user in the database (with `marketingEmailStep = 0`)
2. Immediately calls `sendWelcomeMarketingEmail()`
3. Updates `marketingEmailStep` to `1` and sets `lastMarketingEmailAt`

### 2. Daily Cron Job

Every day at 10:00 AM, `processMarketingEmails()`:

1. Finds users with `marketingEmailStep = 1` and `lastMarketingEmailAt >= 7 days ago`
   - Checks if they should stop receiving emails (paid user)
   - Sends follow-up email
   - Updates `marketingEmailStep` to `2`

2. Finds users with `marketingEmailStep = 2` and `lastMarketingEmailAt >= 14 days ago`
   - Checks if they should stop receiving emails (paid user)
   - Sends discount email with code `30LOGS`
   - Updates `marketingEmailStep` to `99` (completed)

### 3. Stopping Emails

Users automatically stop receiving emails if:

- They upgrade to a paid plan (detected by `credits > 100` or `creditsUsed > 100`)
- Their `marketingEmailStep` is set to `99`

When a paid user is detected, their `marketingEmailStep` is updated to `99` to prevent future emails.

## Migration

The migration [`20260419153644_add_marketing_email_fields`](../prisma/migrations/20260419153644_add_marketing_email_fields/migration.sql) ensures that:

- Existing users before the migration are set to `marketingEmailStep = 99`
- This prevents existing users from receiving marketing emails
- Only new users (created after the migration) will enter the email sequence

## Customization

### Changing Email Content

Edit the templates in [`lib/email/email-templates-marketing.ts`](../lib/email/email-templates-marketing.ts)

### Changing Schedule

Modify the time calculations in [`lib/email/marketing-email-service.ts`](../lib/email/marketing-email-service.ts):

- `oneWeekAgo` - Time between welcome and follow-up
- `twoWeeksAgo` - Time between follow-up and discount

### Changing Cron Schedule

Edit the schedule in [`lib/utils/cron-jobs.ts`](../lib/utils/cron-jobs.ts):

- Current: `"0 10 * * *"` (daily at 10:00 AM)
- Format: `"minute hour day month weekday"`

### Changing Stop Criteria

Edit the `shouldStopMarketingEmails()` function in [`lib/email/marketing-email-service.ts`](../lib/email/marketing-email-service.ts)

## Testing

### Manual Testing

You can manually trigger the marketing email processing:

```typescript
import { processMarketingEmails } from "@/lib/email/marketing-email-service";

await processMarketingEmails();
```

### Testing Individual Emails

```typescript
import {
  sendWelcomeMarketingEmail,
  sendFollowUpMarketingEmail,
  sendDiscountMarketingEmail,
} from "@/lib/email/marketing-email-service";

// Test welcome email
await sendWelcomeMarketingEmail(userId, email, name);

// Test follow-up email
await sendFollowUpMarketingEmail(userId, email, name);

// Test discount email
await sendDiscountMarketingEmail(userId, email, name);
```

## Monitoring

Check the server logs for marketing email activity:

- `[Marketing Email] Sent welcome email to user@example.com`
- `[Marketing Email] Processing scheduled marketing emails...`
- `[Marketing Email] Found X users for step 2 (follow-up)`
- `[CRON] Marketing email processing completed`

## Email Content Summary

### 1. Welcome Email

- Subject: "Welcome to HumanLogs – Let's get you started!"
- Content inspired by landing page hero and features
- Quick start guide (tutorial → upload → edit)
- List of key features
- Invitation to provide feedback

### 2. Follow-up Email (1 week)

- Subject: "How's your transcription experience going?"
- More details about platform features
- Emphasis on privacy, speed, and editing capabilities
- Invitation to share needs and get help

### 3. Discount Email (3 weeks)

- Subject: "🎁 30% off your HumanLogs subscription"
- Exclusive discount code: `30LOGS`
- Benefits of upgrading
- Last email in the series
- Strong call-to-action with personal touch
