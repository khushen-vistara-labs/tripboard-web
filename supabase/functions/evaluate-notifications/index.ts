import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { budgetThresholdForPercent, lowWalletThreshold, preferenceAllows } from "../_shared/notification-rules.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
const vapidSubject = Deno.env.get("VAPID_SUBJECT");
const scheduleSecret = Deno.env.get("NOTIFICATION_SCHEDULE_SECRET");
const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

if (vapidPublic && vapidPrivate && vapidSubject) webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

type Candidate = { type: string; entityId?: string; title: string; body: string; dedupeKey: string; url: string };

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!scheduleSecret) return Response.json({ error: "Notification scheduler is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${scheduleSecret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const { data: trips, error: tripError } = await admin.from("trips").select("id, name, timezone, overdue_grace_minutes").is("archived_at", null);
  if (tripError) return Response.json({ error: tripError.message }, { status: 500 });
  let created = 0; let pushed = 0;

  for (const trip of trips ?? []) {
    const local = zonedParts(now, trip.timezone);
    const [itemsResult, bookingsResult, membersResult, preferencesResult, budgetsResult, spendingResult, walletsResult] = await Promise.all([
      admin.from("itinerary_items").select("id, title, date, planned_start_time, planned_end_time, expected_duration_minutes, recommended_departure_time, status").eq("trip_id", trip.id).eq("date", local.date).eq("status", "PLANNED"),
      admin.from("bookings").select("id, title, starts_at, status").eq("trip_id", trip.id).in("status", ["PLACEHOLDER", "CONFIRMED"]),
      admin.from("trip_members").select("user_id").eq("trip_id", trip.id).is("removed_at", null),
      admin.from("notification_preferences").select("user_id,morning_summary,leave_soon,overdue_item,end_of_day,budget_warning,booking_reminder,low_wallet").eq("trip_id", trip.id),
      admin.from("budgets").select("id, budget_scope, category, date, amount, currency").eq("trip_id", trip.id),
      admin.from("financial_transactions").select("transaction_type, occurred_at, category, consumption_amount, consumption_currency").eq("trip_id", trip.id).is("voided_at", null).in("transaction_type", ["PURCHASE", "PURCHASE_REFUND"]),
      admin.from("stored_value_balances").select("account_id,name,currency,balance").eq("trip_id", trip.id),
    ]);
    if (itemsResult.error || bookingsResult.error || membersResult.error || preferencesResult.error || budgetsResult.error || spendingResult.error || walletsResult.error) continue;
    const candidates: Candidate[] = [];

    if (local.minutes >= 420 && local.minutes < 480) {
      const firstDeparture = (itemsResult.data ?? []).map((item) => item.recommended_departure_time).filter(Boolean).sort()[0];
      candidates.push({ type: "MORNING_SUMMARY", title: `${trip.name} today`, body: `${itemsResult.data?.length ?? 0} things planned.${firstDeparture ? ` First departure at ${displayTime(firstDeparture)}.` : ""}`, dedupeKey: `morning:${local.date}`, url: "/today" });
    }

    for (const item of itemsResult.data ?? []) {
      if (item.recommended_departure_time) {
        const departure = timeToMinutes(item.recommended_departure_time); const until = departure - local.minutes;
        if (until >= 15 && until <= 25) candidates.push({ type: "LEAVE_SOON", entityId: item.id, title: "Leave soon", body: `Leave in approximately ${until} minutes for ${item.title}.`, dedupeKey: `leave:${item.id}:${local.date}:${Math.floor(departure / 15)}`, url: "/today" });
      }
      const deadline = item.planned_end_time ? timeToMinutes(item.planned_end_time) : item.planned_start_time ? timeToMinutes(item.planned_start_time) + (item.expected_duration_minutes ?? 0) : null;
      if (deadline !== null && local.minutes > deadline + trip.overdue_grace_minutes) candidates.push({ type: "OVERDUE_ITEM", entityId: item.id, title: "Still unresolved", body: `${item.title} has not been marked completed.`, dedupeKey: `overdue:${item.id}:${local.date}:${Math.floor(local.minutes / 120)}`, url: "/plan" });
    }

    for (const booking of bookingsResult.data ?? []) {
      if (!booking.starts_at) continue;
      const until = (new Date(booking.starts_at).getTime() - now.getTime()) / 60000;
      if (until >= 30 && until <= 60) candidates.push({ type: "BOOKING_REMINDER", entityId: booking.id, title: "Booking coming up", body: `${booking.title} is coming up. Your reference and ticket are ready.`, dedupeKey: `booking:${booking.id}:60m`, url: `/bookings?open=${booking.id}` });
    }

    if (local.minutes >= 1290 && local.minutes < 1350) {
      candidates.push({ type: "END_OF_DAY", title: "Review today", body: `${itemsResult.data?.length ?? 0} itinerary items still need a decision. Mark done, move, skip, or leave unresolved.`, dedupeKey: `review:${local.date}`, url: "/plan" });
    }

    for (const budget of budgetsResult.data ?? []) {
      const spent = (spendingResult.data ?? []).reduce((sum, transaction) => {
        if (transaction.consumption_currency !== budget.currency) return sum;
        if (budget.budget_scope === "CATEGORY" && (transaction.category ?? "Miscellaneous") !== budget.category) return sum;
        if (budget.budget_scope === "DAILY" && zonedParts(new Date(transaction.occurred_at), trip.timezone).date !== budget.date) return sum;
        const value = Number(transaction.consumption_amount ?? 0);
        return sum + (transaction.transaction_type === "PURCHASE_REFUND" ? -value : value);
      }, 0);
      const percent = Number(budget.amount) > 0 ? spent / Number(budget.amount) * 100 : 0;
      const threshold = budgetThresholdForPercent(percent);
      if (!threshold) continue;
      const label = budget.budget_scope === "CATEGORY" ? `${budget.category ?? "Category"} budget` : budget.budget_scope === "DAILY" ? `Daily budget for ${budget.date}` : "Trip budget";
      candidates.push({ type: "BUDGET_WARNING", entityId: budget.id, title: threshold === 100 ? "Budget reached" : "Budget at 80%", body: `${label} is ${Math.round(percent)}% used (${budget.currency} ${spent.toFixed(2)} of ${Number(budget.amount).toFixed(2)}).`, dedupeKey: `budget:${budget.id}:${threshold}`, url: "/money#budgets" });
    }

    for (const wallet of walletsResult.data ?? []) {
      const balance = Number(wallet.balance ?? 0); const threshold = lowWalletThreshold(wallet.currency);
      if (balance <= 0 || balance > threshold) continue;
      candidates.push({ type: "LOW_WALLET", entityId: wallet.account_id, title: `${wallet.name} is running low`, body: `${wallet.currency} ${balance.toFixed(2)} remains. Consider topping up before the next activity.`, dedupeKey: `low-wallet:${wallet.account_id}:${local.date}`, url: "/money#accounts" });
    }

    for (const member of membersResult.data ?? []) {
      const preference = (preferencesResult.data ?? []).find((row) => row.user_id === member.user_id);
      for (const candidate of candidates) {
        if (!preferenceAllows(candidate.type, preference)) continue;
        if (candidate.entityId && !["BUDGET_WARNING", "LOW_WALLET"].includes(candidate.type)) {
          const { data: current } = await admin.from(candidate.type === "BOOKING_REMINDER" ? "bookings" : "itinerary_items").select("status").eq("id", candidate.entityId).maybeSingle();
          if (!current || current.status === "COMPLETED" || current.status === "CANCELLED" || current.status === "USED") continue;
        }
        const { data: inserted } = await admin.from("notifications").upsert({ trip_id: trip.id, user_id: member.user_id, type: candidate.type, entity_id: candidate.entityId, title: candidate.title, body: candidate.body, dedupe_key: candidate.dedupeKey }, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }).select("id");
        if (!inserted?.length) continue;
        created += 1;
        if (vapidPublic && vapidPrivate && vapidSubject) {
          const { data: subscriptions } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", member.user_id);
          for (const subscription of subscriptions ?? []) {
            try {
              await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: candidate.title, body: candidate.body, url: candidate.url, dedupeKey: candidate.dedupeKey }));
              pushed += 1;
            } catch (error) {
              console.error("Push delivery failed", { endpointHost: safeHost(subscription.endpoint), error: error instanceof Error ? error.message : "unknown" });
            }
          }
        }
      }
    }
  }
  return Response.json({ evaluatedAt: now.toISOString(), notificationsCreated: created, pushesSent: pushed });
});

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function timeToMinutes(value: string) { const [hours, minutes] = value.slice(0, 5).split(":").map(Number); return hours * 60 + minutes; }
function displayTime(value: string) { const minutes = timeToMinutes(value); const hour = Math.floor(minutes / 60); return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`; }
function safeHost(endpoint: string) { try { return new URL(endpoint).host; } catch { return "invalid"; } }
