# Oasis Care Beta Demo Script (7 minutes)

## Setup (10 seconds)
- Open browser to http://localhost:3000
- Demo token ready: `Authorization: Bearer DEMO_SHOW`

## 1. Enter Demo Mode (10 seconds)
- Navigate to dashboard 
- Click "Enter Demo" button (stores demo token)
- Page reloads with demo authentication

## 2. Dashboard Overview + Counters (90 seconds)
- **Point out key metrics**: 
  - "Visits Booked Today" (shows real count from seed data)
  - "Visits Finished Today" (shows completed visits)
  - Note placeholder metrics (Carers on Duty, Med Alerts)
- **Scroll through Recent Activity**:
  - Shows live activity feed with timestamps
  - Different status types (completed, in_progress, scheduled, conflict)
  - Real client and carer names from seed data

## 3. Create a Visit (60 seconds)
- Navigate to `/visits/new`
- **Fill form**:
  - Select client: "Margaret Thompson"
  - Select carer: "Sarah Johnson" 
  - Set time: Today 4:00 PM - 5:00 PM
  - Add notes: "Demo visit - medication check and wellness assessment"
- **Submit form** → Show success toast
- Mention validation and overlap prevention (backend enforced)

## 4. Basic Validation/Overlap Prevention (60 seconds)
- **Try overlapping visit**:
  - Same carer, overlapping time slot
  - Show validation error message
- **Explain business logic**:
  - Carers cannot have overlapping visits
  - System prevents double-booking
  - Real-time availability checking

## 5. Mark Visit Complete + Add Notes (60 seconds)
- Navigate to `/visits` 
- Find today's visit
- Click "View" on active visit
- **Complete visit**:
  - Mark tasks as completed
  - Add completion notes: "All medications administered successfully. Client in good spirits."
  - Update status to "Completed"

## 6. Clients List + Search (45 seconds)
- Navigate to `/clients`
- **Show client directory**:
  - 5 demo clients with London addresses
  - Contact information (email/phone)
  - Last visit and next visit dates
- **Test search**:
  - Type "Margaret" → filters to matching client
  - Clear search → shows all clients again

## 7. Metrics Page + Wrap (30 seconds)
- Navigate to `/admin/metrics`
- **Show system status**:
  - API Online (port 4000)
  - Database Connected (PostgreSQL + pgvector, port 5434)
  - Demo mode indicators
- **Raw metrics data**: Show prometheus-style output
- **Wrap up**: "This concludes our beta demo. The system is ready for stakeholder review and feedback."

---

**Total Time: ~6 minutes 25 seconds**

## Demo Notes
- All data is seeded demo data (5 clients, 4 carers, 12 visits)
- Authentication bypassed for demo (Bearer DEMO_* tokens)
- Both API (port 4000) and Web (port 3000) should be running
- Demo highlights core care management workflows
