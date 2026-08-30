import type { ChecklistItem, ItineraryItem, Trip } from "../../types/domain";
import type { FinancialEvent, PaymentAccount } from "../money/domain";

export const demoTrip: Trip = {
  id: "demo-trip",
  name: "Hong Kong + Macau",
  startDate: "2026-12-24",
  endDate: "2027-01-03",
  timezone: "Asia/Hong_Kong",
  baseCurrency: "INR",
};

export const demoItinerary: ItineraryItem[] = [
  { id: "ngong-ping", tripId: demoTrip.id, date: "2026-12-28", title: "Ngong Ping 360", description: "Cable car to Ngong Ping Village · Booking ready", type: "booking", plannedStartTime: "09:30", plannedEndTime: "10:40", recommendedDepartureTime: "08:15", expectedDurationMinutes: 70, priority: "MUST", status: "PLANNED", sequence: 1, bookingId: "booking-ngong", mapsUrl: "https://maps.google.com/?q=Ngong+Ping+360", transportInstructions: "MTR to Tung Chung, Exit B. Walk 5 minutes to the cable car terminal." },
  { id: "buddha", tripId: demoTrip.id, date: "2026-12-28", title: "Tian Tan Buddha", description: "Climb the steps and explore the plateau", type: "attraction", plannedStartTime: "10:45", expectedDurationMinutes: 45, priority: "MUST", status: "PLANNED", sequence: 2, mapsUrl: "https://maps.google.com/?q=Tian+Tan+Buddha" },
  { id: "po-lin", tripId: demoTrip.id, date: "2026-12-28", title: "Po Lin Monastery", type: "attraction", plannedStartTime: "12:15", expectedDurationMinutes: 45, priority: "WANT", status: "PLANNED", sequence: 3 },
  { id: "tai-o", tripId: demoTrip.id, date: "2026-12-28", title: "Tai O fishing village", type: "activity", plannedStartTime: "14:30", plannedEndTime: "16:30", expectedDurationMinutes: 120, priority: "MUST", status: "PLANNED", sequence: 4, mapsUrl: "https://maps.google.com/?q=Tai+O", transportInstructions: "Take bus 21 from Ngong Ping; check the final return bus before exploring." },
  { id: "boat", tripId: demoTrip.id, date: "2026-12-28", title: "Tai O boat ride", type: "activity", plannedStartTime: "15:15", expectedDurationMinutes: 30, priority: "WANT", status: "PLANNED", sequence: 5 },
  { id: "street-food", tripId: demoTrip.id, date: "2026-12-28", title: "Tai O street food", type: "food", plannedStartTime: "16:00", expectedDurationMinutes: 35, priority: "WANT", status: "PLANNED", sequence: 6 },
  { id: "sunset", tripId: demoTrip.id, date: "2026-12-28", title: "Sunset at the harbour", type: "rest", plannedStartTime: "17:30", expectedDurationMinutes: 45, priority: "OPTIONAL", status: "PLANNED", sequence: 7 },
  { id: "peak", tripId: demoTrip.id, date: "2026-12-25", title: "Victoria Peak", type: "attraction", plannedStartTime: "16:30", plannedEndTime: "19:00", priority: "MUST", status: "COMPLETED", sequence: 1, completedAt: "2026-12-25T10:55:00Z" },
  { id: "monster", tripId: demoTrip.id, date: "2027-01-01", title: "Monster Building", type: "attraction", plannedStartTime: "10:30", expectedDurationMinutes: 45, priority: "WANT", status: "MOVED", sequence: 2 },
  { id: "ferry", tripId: demoTrip.id, date: "2026-12-30", title: "Ferry to Macau", type: "booking", plannedStartTime: "09:00", plannedEndTime: "10:10", recommendedDepartureTime: "07:45", priority: "MUST", status: "PLANNED", sequence: 1, bookingId: "booking-ferry" },
  { id: "ruins", tripId: demoTrip.id, date: "2026-12-31", title: "Ruins of St. Paul's", type: "attraction", plannedStartTime: "10:00", expectedDurationMinutes: 60, priority: "MUST", status: "PLANNED", sequence: 1 },
];

export const demoChecklist: ChecklistItem[] = [
  { id: "egg-tart", tripId: demoTrip.id, title: "Egg tart", kind: "FOOD", priority: "MUST", targetCount: 1, completedCount: 1, plannedDay: "2026-12-24", status: "COMPLETED", neighbourhood: "Tsim Sha Tsui", rating: 5, favourite: true },
  { id: "pineapple-bun", tripId: demoTrip.id, title: "Pineapple bun", kind: "FOOD", priority: "MUST", targetCount: 1, completedCount: 1, plannedDay: "2026-12-25", status: "COMPLETED", neighbourhood: "Mong Kok", rating: 4 },
  { id: "fish-balls", tripId: demoTrip.id, title: "Curry fish balls", kind: "FOOD", priority: "WANT", targetCount: 1, completedCount: 0, plannedDay: "2026-12-28", status: "PLANNED", neighbourhood: "Tai O" },
  { id: "egg-waffle", tripId: demoTrip.id, title: "Egg waffle", kind: "FOOD", priority: "MUST", targetCount: 1, completedCount: 0, plannedDay: "2026-12-28", status: "PLANNED", neighbourhood: "Tai O" },
  { id: "french-toast", tripId: demoTrip.id, title: "Hong Kong French toast", kind: "FOOD", priority: "WANT", targetCount: 1, completedCount: 0, plannedDay: "2026-12-29", status: "PLANNED", neighbourhood: "Central" },
  { id: "star-ferry", tripId: demoTrip.id, title: "Ride the Star Ferry", kind: "EXPERIENCE", priority: "MUST", targetCount: 1, completedCount: 0, plannedDay: "2026-12-29", status: "PLANNED" },
  { id: "tai-o-boat", tripId: demoTrip.id, title: "Tai O boat ride", kind: "EXPERIENCE", priority: "WANT", targetCount: 1, completedCount: 0, plannedDay: "2026-12-28", status: "PLANNED", neighbourhood: "Tai O" },
  { id: "victoria-peak", tripId: demoTrip.id, title: "Victoria Peak", kind: "PLACE", priority: "MUST", targetCount: 1, completedCount: 1, status: "COMPLETED", neighbourhood: "The Peak" },
  { id: "ruins-place", tripId: demoTrip.id, title: "Ruins of St. Paul's", kind: "PLACE", priority: "MUST", targetCount: 1, completedCount: 0, plannedDay: "2026-12-31", status: "PLANNED", neighbourhood: "Historic Centre" },
  { id: "jade-market", tripId: demoTrip.id, title: "Jade Market", kind: "SHOPPING", priority: "OPTIONAL", targetCount: 1, completedCount: 0, status: "PLANNED", neighbourhood: "Yau Ma Tei" },
];

export interface DemoBooking {
  id: string;
  title: string;
  type: string;
  provider: string;
  reference: string;
  startsAt: string;
  status: string;
  files: { name: string; kind: string; path?: string }[];
}

export interface DemoPlace {
  id: string;
  name: string;
  neighbourhood: string;
  category: string;
  address: string;
  mapsUrl?: string;
  priority: "MUST" | "WANT" | "OPTIONAL";
}

export const demoPlaces: DemoPlace[] = [
  { id: "ngong-ping", name: "Ngong Ping 360", neighbourhood: "Lantau", category: "Attraction", address: "11 Tat Tung Road, Tung Chung", mapsUrl: "https://maps.google.com/?q=Ngong+Ping+360", priority: "MUST" },
  { id: "buddha", name: "Tian Tan Buddha", neighbourhood: "Lantau", category: "Landmark", address: "Ngong Ping Road, Lantau Island", mapsUrl: "https://maps.google.com/?q=Tian+Tan+Buddha", priority: "MUST" },
  { id: "po-lin", name: "Po Lin Monastery", neighbourhood: "Lantau", category: "Temple", address: "Ngong Ping Plateau, Lantau Island", priority: "WANT" },
  { id: "tai-o", name: "Tai O Fishing Village", neighbourhood: "Tai O", category: "Neighbourhood", address: "Tai O, Lantau Island", mapsUrl: "https://maps.google.com/?q=Tai+O", priority: "MUST" },
  { id: "peak", name: "Victoria Peak", neighbourhood: "The Peak", category: "Viewpoint", address: "Peak Road, Hong Kong Island", priority: "MUST" },
  { id: "monster", name: "Monster Building", neighbourhood: "Quarry Bay", category: "Architecture", address: "1028 King's Road, Quarry Bay", priority: "WANT" },
  { id: "ruins", name: "Ruins of St. Paul's", neighbourhood: "Historic Centre", category: "Landmark", address: "Company of Jesus Square, Macau", priority: "MUST" },
];

export const demoBookings: DemoBooking[] = [
  { id: "booking-ngong", title: "Ngong Ping 360", type: "Cable car", provider: "Ngong Ping 360", reference: "NP360-48271", startsAt: "2026-12-28T01:30:00Z", status: "Confirmed", files: [{ name: "Cable car tickets.pdf", kind: "PDF" }] },
  { id: "booking-ferry", title: "Hong Kong → Macau", type: "Ferry", provider: "TurboJET", reference: "TJ-093842", startsAt: "2026-12-30T01:00:00Z", status: "Confirmed", files: [{ name: "Ferry QR codes.png", kind: "QR" }] },
  { id: "booking-disney", title: "Hong Kong Disneyland", type: "Theme park", provider: "Disney", reference: "HKDL-226491", startsAt: "2026-12-27T01:30:00Z", status: "Used", files: [{ name: "Disney tickets.pdf", kind: "PDF" }] },
];

export const demoAccounts: PaymentAccount[] = [
  { id: "hdfc", name: "HDFC Regalia •••• 1234", accountClass: "EXTERNAL_SOURCE", currency: "INR", openingBalance: "0" },
  { id: "icici", name: "ICICI Card •••• 4821", accountClass: "EXTERNAL_SOURCE", currency: "INR", openingBalance: "0" },
  { id: "inr-cash", name: "INR Cash", accountClass: "EXTERNAL_SOURCE", currency: "INR", openingBalance: "0" },
  { id: "octopus-1", name: "Octopus 1", accountClass: "STORED_VALUE", currency: "HKD", openingBalance: "0" },
  { id: "octopus-2", name: "Octopus 2", accountClass: "STORED_VALUE", currency: "HKD", openingBalance: "0" },
  { id: "hkd-cash", name: "HKD Cash", accountClass: "STORED_VALUE", currency: "HKD", openingBalance: "0" },
  { id: "mop-cash", name: "MOP Cash", accountClass: "STORED_VALUE", currency: "MOP", openingBalance: "0" },
];

const base = (id: string, type: FinancialEvent["type"], description: string, hour: string) => ({ id, idempotencyKey: id, type, description, occurredAt: `2026-12-28T${hour}:00+08:00` }) as const;
export const demoFinancialEvents: FinancialEvent[] = [
  { ...base("fund-1", "FUND_WALLET", "HDFC → Octopus 1", "08:02"), sourceAccountId: "hdfc", destinationAccountId: "octopus-1", destinationAmount: "500", destinationCurrency: "HKD", settledInrAmount: "5500", settlementStatus: "SETTLED" },
  { ...base("fund-2", "FUND_WALLET", "ICICI → Octopus 2", "08:04"), sourceAccountId: "icici", destinationAccountId: "octopus-2", destinationAmount: "400", destinationCurrency: "HKD", settledInrAmount: "4410", settlementStatus: "SETTLED" },
  { ...base("exchange-1", "CASH_EXCHANGE", "INR cash → HKD cash", "08:08"), sourceAccountId: "inr-cash", destinationAccountId: "hkd-cash", sourceAmount: "10000", sourceCurrency: "INR", destinationAmount: "900", destinationCurrency: "HKD", settledInrAmount: "10000", settlementStatus: "SETTLED" },
  { ...base("mtr", "PURCHASE", "MTR to Tung Chung", "08:28"), sourceAccountId: "octopus-1", sourceAmount: "24", sourceCurrency: "HKD", consumptionAmount: "24", consumptionCurrency: "HKD", category: "Transport", merchant: "MTR" },
  { ...base("breakfast", "PURCHASE", "Breakfast", "08:45"), sourceAccountId: "hkd-cash", sourceAmount: "86", sourceCurrency: "HKD", consumptionAmount: "86", consumptionCurrency: "HKD", category: "Food", merchant: "Australia Dairy Company" },
  { ...base("cable", "PURCHASE", "Cable car tickets", "09:10"), sourceAccountId: "hdfc", sourceAmount: "270", sourceCurrency: "HKD", consumptionAmount: "270", consumptionCurrency: "HKD", category: "Attractions", settledInrAmount: "2980", settlementStatus: "SETTLED" },
  { ...base("snacks", "PURCHASE", "Tai O snacks", "11:15"), sourceAccountId: "octopus-2", sourceAmount: "58", sourceCurrency: "HKD", consumptionAmount: "58", consumptionCurrency: "HKD", category: "Food" },
];
