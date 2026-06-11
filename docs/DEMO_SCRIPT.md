# Demo video script (target 2:55)

A tight three minute film. Story first, product on screen the whole time. Record
Mission Control at 1080p, full screen, with the fan gateway and a Dynatrace tab
ready to cut to. Speak calmly and with intent. Every second earns its place.

Two safe ways to record the run: live against your Dynatrace tenant, or the
identical scripted replay (`?mock=1` on Mission Control, or `KEEPER_DEMO=1` on
the backend). Both look the same on camera.

---

## Shot list and voiceover

### 0:00 to 0:18  The stakes
**On screen:** a quick title card "Keeper", then cut to the World Cup fan gateway
status page, healthy, version v2.3.9. A counter or caption: "4.2M fans online.
Kickoff in 60 seconds."
**Voiceover:**
"It is the World Cup final. Four million fans are buying tickets, streaming the
match, and checking the score on one platform. At kickoff, a routine deploy
ships. And it is broken."

### 0:18 to 0:38  The turn
**On screen:** cut to Mission Control, status pill "Watching". Click **Start
Run**. The phase stepper lights up "Detect".
**Voiceover:**
"When a service breaks in production, a human has to notice, find the cause,
weigh the damage, fix it, and confirm the fix. That takes minutes you do not
have. Keeper is an agent that runs that entire loop, and never touches
production without your approval."

### 0:38 to 1:08  Detect and diagnose
**On screen:** the Activity feed streams Sentinel and Diagnostician lines. The
incident card appears, severity Critical. The recovery graph spikes from 70ms to
over 1300ms. The root cause panel fills in, confidence 92 percent, the bad
deploy highlighted. Briefly cut to the Dynatrace tab showing the logs or the
event.
**Voiceover:**
"Sentinel runs a Dynatrace Grail query and sees latency jump from seventy
milliseconds to over a second, with one in four requests failing. Diagnostician
pulls the change timeline, asks Davis CoPilot to correlate, and pins the spike
to the deploy that shipped seconds earlier. Every signal here comes through the
Dynatrace MCP server."

### 1:08 to 1:32  Impact
**On screen:** the Business Impact meter animates. Fans affected counts up,
revenue at risk ticks, the SLO error budget bar drains.
**Voiceover:**
"Strategist turns the raw signals into the language that matters: more than four
hundred thousand fans affected, thousands of dollars at risk every minute, and
the error budget for the whole tournament burning down in real time."

### 1:32 to 1:58  The human gate
**On screen:** the Remediation Plan card slides in with the rollback steps and a
low risk badge. The Approve and Reject buttons pulse. Pause on this. Then move
the cursor and click **Approve**.
**Voiceover:**
"Here is the part that matters. Keeper has a plan, a rollback to the last good
version. But it stops. It will not change production on its own. It waits for a
human. I approve."

### 1:58 to 2:24  Remediate and verify
**On screen:** phase moves to Remediate. Operator lines stream, "Executing the
rollback", "Posting to Dynatrace and Slack". The recovery graph drops back to
baseline. Phase moves to Verify, the checklist turns green one by one, the
"RECOVERED" stamp lands.
**Voiceover:**
"Operator rolls the deploy back and records the action in Dynatrace. Then
Verifier does what most automation skips. It re-queries Grail to confirm the
service actually recovered, instead of trusting the fix. Latency is back to
normal. Errors are gone."

### 2:24 to 2:44  The postmortem
**On screen:** phase moves to Report. The postmortem panel opens with the
rendered document. Cut to the Dynatrace tab showing the notebook that was filed.
**Voiceover:**
"Finally Scribe writes the postmortem, timeline, root cause, impact, and
prevention, and files it back into Dynatrace as a notebook, where the on-call
team already works."

### 2:44 to 2:55  Close
**On screen:** a clean end card: "Keeper. Built with Gemini 3.1 Pro, Google
Agent Development Kit, and Dynatrace." Tagline underneath: "The goalkeeper for
your production."
**Voiceover:**
"Detect, diagnose, decide, fix, verify, and document, in under a minute, with a
human in control. That is Keeper."

---

## Recording tips

- Do a full dry run first so the pacing of the live run matches your narration.
  Adjust `KEEPER_PACE_SECONDS` on the backend if you want beats slower or faster.
- Keep the cursor calm. The Approve click should feel deliberate.
- Have the Dynatrace tab pre-loaded on the logs view and the notebooks view so
  the cutaways are instant.
- Capture clean audio. A quiet room and a normal mic beat any music bed.
- Export at 1080p. Keep it under or right at three minutes.
