# Street Urban Barber

Street Urban Barber is a mobile appointment booking application for a modern urban barbershop. It allows customers to browse services, schedule a haircut session, and make secure online payments — reducing waiting times and improving shop efficiency.

This app is built for **a single barbershop** (no barber selection required). Users simply choose a service, pick an available time slot, and confirm their appointment. Payments are processed through **Paystack**, and authentication is managed using **Supabase**.

---

## 🚀 Features (MVP)

| Feature | Description |
|--------|-------------|
| User Authentication | Email/Password + Google Sign-In powered by Supabase Auth |
| View Services | Users can browse available haircut and grooming services with pricing |
| Book Appointment | Choose a service, date, and available time slot |
| Online Payments | Paystack integration for secure card & mobile money payments |
| Appointment History | View upcoming and past appointments with status updates |
| Admin Access | The barbershop can view daily bookings (admin role) |

---

## 🛠️ Tech Stack

| Layer | Technology |
|------|------------|
| Frontend | React Native (Expo) |
| Backend & Database | Supabase (PostgreSQL + Auth + Storage) |
| Authentication | Supabase Auth (Email + Google OAuth) |
| Payments | Paystack Inline Checkout / WebView |
| Navigation | React Navigation |
| State Management | React Query / Zustand (optional) |

---

## 🧱 Database Schema (Supabase)

### **`profiles`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | matches Supabase user ID |
| full_name | text | user name |
| phone | text | optional |
| role | text | 'user' or 'admin' |

### **`services`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | service id |
| name | text | service title |
| price | numeric | cost in GHS |
| duration | integer | minutes (used for time slot calculations) |
| image_url | text | optional |

### **`appointments`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | appointment id |
| user_id | uuid | references profiles.id |
| service_id | uuid | references services.id |
| date | date | selected date |
| time_slot | text | "10:00 AM", etc. |
| status | enum | pending, confirmed, cancelled, completed |
| payment_status | enum | paid, unpaid |

### **`payments`** (optional)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | payment id |
| booking_id | uuid | references appointments.id |
| amount | numeric | total amount |
| provider_ref | text | Paystack transaction ref |

---

## 🔌 Environment Setup

Create a `.env` file in the project root:

SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=public-anon-key

PAYSTACK_PUBLIC_KEY=pk_live_or_test_key
PAYSTACK_SECRET_KEY=sk_live_or_test_key (only used in backend)


> **Important:** Never put `PAYSTACK_SECRET_KEY` in the app itself — use a Supabase Edge Function or your backend to verify payments.

---

## ▶️ Run the Project

```sh
npm install
npx expo start
```
📌 Roadmap (Future Enhancements)

Push notifications for reminders

Loyalty / reward points

Ratings & reviews

Haircut photo gallery

Walk-in queue system

Admin dashboard web panel

🤝 Contributing

Pull requests are welcome. Open an issue for major changes.

📄 License

MIT License


--- This is the test changed by bismark