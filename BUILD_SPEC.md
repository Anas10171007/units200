# AMPcap — Build Spec v1 (replaces the 24 open questions for the first build)

Source: Final_Validated_PRD.md, Appendix C proposals, with the changes below. **Team must approve before the demo.**

## Decisions
| OQ | Decision for v1 |
|---|---|
| 03 dates | Opening reading + date (from last bill), reading dates, next bill date. |
| 17 forecast | used = current − opening; rate = used ÷ days elapsed; projected = used + rate × days left; range = used + rate × left × (1 ± band). |
| 04 confidence | Low: < 7 days elapsed. Medium: ≥ 7 days. High: ≥ 15 days and ≥ 2 readings. One level lower if the last reading is > 7 days old. Band: Low ±30%, Medium ±20%, High ±10%. Heuristic, not calibrated. |
| 16 outdated | Last reading older than 7 days (team heuristic, not an official rule). |
| 14 validity | Reject non-numeric, negative, bad/future dates, dates outside the cycle or before the last reading. Lower than last reading → ask: mistyped or meter replaced. |
| 15 meter replaced | New baseline on the new meter. Old-meter units count only if the user gives the old final reading. Meters are never subtracted from each other. |
| 18 comparison | Unrounded values. 200 exactly is not over. Status: Safe / Watch (range can pass 200) / Over-risk (forecast > 200) / Already over (used > 200). |
| 20 mandatory warning | Persistent banner on Home whenever status is not Safe. Cannot be switched off. |
| 24 guidance | Daily budget: (200 − used) ÷ days left. |
| 08/01/02/13 billing | No tariffs and no Rs estimates. Neutral note: rules can change, confirm with your electricity company. News reports (Oct 2026) say the six-month rule may change; get NEPRA sources before any claim. |
| 12 images | Out of v1. |
| 23 platform | Android (Expo), no login, data stored on the device. |

## Not built yet (next)
Custom thresholds (150/170/190), what-if appliances, edit/delete readings, date picker, Urdu, history detail.
