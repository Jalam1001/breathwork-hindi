# BreathWork: research notes

These are breathing techniques **discussed on the Huberman Lab podcast** and in related published research. BreathWork is an independent app. Huberman Lab and Stanford are not affiliated with it and do not endorse it. Nothing here is medical advice.

## Primary sources
- Balban MY, Neri E, Kogon MM, … Spiegel D, Huberman AD. *Brief structured respiration practices enhance mood and reduce physiological arousal.* Cell Reports Medicine 4(1):100895, 2023. https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947/ (NCT05304000). This was a 1-month remote RCT of daily 5-minute practices. Cyclic sighing produced the largest improvement in positive affect and the largest drop in respiratory rate, and it beat mindfulness meditation on mood (p < 0.05).
- Stanford Medicine summary: https://med.stanford.edu/news/insights/2023/02/cyclic-sighing-can-help-breathe-away-anxiety.html
- Huberman Lab newsletter, "Breathwork Protocols for Health, Focus & Stress": https://www.hubermanlab.com/newsletter/breathwork-protocols-for-health-focus-stress
- Huberman Lab Daily Blueprint (cyclic hyperventilation and physiological sigh, with safety notes): https://www.hubermanlab.com/daily-blueprint
- Episode "Tools for Managing Stress & Anxiety" (physiological sigh; longer or more vigorous exhales slow the heart rate via the sinoatrial node and respiratory sinus arrhythmia): https://www.hubermanlab.com/episode/tools-for-managing-stress-and-anxiety
- Episode "Dr. Jack Feldman: Breathing for Mental & Physical Health & Performance" (physiological sighs, box breathing, cyclic hyperventilation, nasal breathing): https://www.hubermanlab.com/episode/dr-jack-feldman-breathing-for-mental-physical-health-and-performance
- Episode "How to Breathe Correctly for Optimal Health, Mood, Learning & Performance" (box breathing and the CO₂ tolerance test): https://www.hubermanlab.com/episode/how-to-breathe-correctly-for-optimal-health-mood-learning-and-performance
- Resonance breathing and HRV: https://pmc.ncbi.nlm.nih.gov/articles/PMC8924557/ (6–6.5 breaths/min was optimal in that cohort; cites Lin et al. for 5.5 breaths/min with equal inhale and exhale).

## Techniques in the app and their timing

| # | Technique | Purpose | App timing (default) | What the sources say |
|---|---|---|---|---|
| 1 | Cyclic sighing | Calm | Inhale 3 s, top-up inhale 1 s, exhale 6 s (10 s cycle, 6/min). Slower option: 3.5 / 1.5 / 7 s. Default 5 min | Double inhale (nose), long full exhale (mouth), repeated for 5 min (Balban 2023). The sources give no seconds; they only say the second inhale is shorter and the exhale long and slow. **The seconds are the app's own choice.** |
| 2 | Physiological sigh (quick reset) | Calm | 1–5 sighs (default 3) at the same timing | "1–3 physiological sighs" to calm down in real time (newsletter; Stress & Anxiety episode) |
| 3 | Box breathing | Focus | Inhale, hold, exhale, hold at 4 s each (also 3, 5, 8 s) | Equal sides. Side length comes from the CO₂ tolerance test: under 20 s → 3–4 s, 25–45 s → 5–6 s, 50–75 s+ → 8–10 s (Balban 2023 protocol, newsletter) |
| 4 | Extended exhale | Calm | Inhale 4 s, exhale 8 s (also 3/6) | Exhales longer than inhales slow the heart rate (Stress & Anxiety episode). The 1:2 ratio is the app's choice. |
| 5 | Resonance / coherent breathing | Calm | 5.5 s in, 5.5 s out (≈5.45/min); also 5/5 (6/min) | Around 5.5–6 breaths/min gives the largest HRV oscillation (PMC8924557). Popularized by James Nestor, who has also been a Huberman Lab guest. Not part of the Stanford trial. |
| 6 | 4-7-8 breathing | Sleep | Inhale 4, hold 7, exhale 8 | Dr. Andrew Weil's technique. A popular long-exhale pattern. **Not** from the Stanford trial, and not a protocol Huberman has prescribed. Included as a wind-down option. |
| 7 | Cyclic hyperventilation with retention | Energy | Per round: 30 × (1.5 s in, 1 s out), exhale fully 3 s, hold empty 15 s (or 30 s), recovery inhale 4 s, relax 4 s. 1–5 rounds, default 3 (≈5 min). Breaths 20/25/30 | Balban 2023: 30 deep breaths (passive exhale), exhale fully, 15 s empty hold, 3 rounds in 5 min. Huberman newsletter and Blueprint: 20–25 breaths, 15–30 s hold, up to 5 min. Warnings: never near water, sit or lie down, caution with panic or anxiety. |

Timed sessions use **whole breath cycles only**. A session never ends mid-breath, so the actual length is `floor(minutes × 60 / cycle) × cycle`, with at least one cycle. The app shows the real length before you start. Example: 5 min of 4-second box breathing is 18 cycles, or 4:48.

Nasal breathing is built into the instructions as guidance ("inhale through the nose"), not as a separate timed technique.
