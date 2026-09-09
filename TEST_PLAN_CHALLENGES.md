# Ordo Challenges — User Testing Guide

> How to test the challenge feature as a real user would. Work through each scenario on the website or app, noting anything that feels wrong, confusing, or broken.

---

## Before you start

1. **Sign up** for an account (or use two accounts — a "host" and a "friend" — to test pairing and joining).
2. Go to the **Community** screen. You should see the challenge section with a create form and a code-entry field.

---

## 1. Creating a Challenge

### 1a. Create a normal public challenge

1. In the challenge name field, type **"30 days of study"**.
2. Leave the category as **"Any category"**.
3. Leave visibility as **"Public"**.
4. Leave days at **30** and minimum at **30**.
5. Tap **Create**.

✅ **Expected:** You see the new challenge appear in the list below the form, with a green **Active** badge and a progress bar showing "Day 0 / 30". A toast says "Created — you are the first member."

### 1b. Create a private challenge

1. Create another challenge, but this time toggle visibility to **"Invite code only"**.
2. Tap **Create**.

✅ **Expected:** The challenge appears with a lock icon and a copyable invite code button. Toast says "Created. Share the invite code to let people in."

### 1c. What happens if you leave the name empty and tap Create?

✅ **Expected:** Nothing happens — the button is disabled or the form is blocked.

### 1d. Check that you're automatically a member

✅ **Expected:** The challenge you created should show "You" as the first member, and you should see **Leave** and **Leaderboard** buttons.

---

## 2. Finding Challenges

### 2a. See challenges from other users

1. Switch to a different account (or ask a friend to log in).
2. Open Community and look at the challenge list.

✅ **Expected:** Public challenges from other users appear in the list. Private challenges from others do **not** appear.

### 2b. Check how challenge status is shown

✅ **Expected:** Each challenge has one of four badges:
- **Active** (green/primary color) — currently running
- **Upcoming** (muted) — hasn't started yet
- **Completed** (muted) — ended and scored
- **Cancelled** (red) — cancelled by the owner

### 2c. Verify progress updates

1. Join a challenge and log some days in the app.
2. Check the progress bar and text on the challenge card.

✅ **Expected:** Shows "Day X / Y" and, once the window opens, a percentage next to it like "Day 5 / 30 · 42%". If no days are logged yet, it shows just "Day 0 / 30" with no percentage.

---

## 3. Joining a Challenge

### 3a. Join a public challenge

1. Find an active public challenge in the list.
2. Tap **Join**.

✅ **Expected:** The button changes to **Leave**. A toast says "Joined. Rank is by score — nobody sees what your days contain."

### 3b. Try joining the same challenge again

✅ **Expected:** The Join button should not appear anymore — you're already a member.

### 3c. Try joining a finished challenge

✅ **Expected:** You can't join a challenge that has ended. No Join button appears if the status is Completed or Cancelled.

### 3d. Join a private challenge using a code

1. Get the invite code from a friend who created a private challenge.
2. Paste it into the code field at the bottom of the challenge list.
3. Tap **Join**.

✅ **Expected:** The challenge appears in your list and its leaderboard opens automatically.

### 3e. Try joining with a wrong code

✅ **Expected:** An error toast says "Could not join with that code".

---

## 4. The Leaderboard

### 4a. Open a leaderboard

1. Tap **Leaderboard** on any challenge you've joined.

✅ **Expected:** A list appears showing up to 5 ranked members plus your own row. Each row shows a rank number (#1, #2, etc.), a name, and a percentage score.

### 4b. Check what the leaderboard shows

- If you're in the top 5, you appear there.
- If you're not in the top 5, you still see your own row separately.
- Someone who left still appears, marked "(left)", with their score preserved.

✅ **Expected:** The leaderboard never shows blank and always includes you if you've joined. It shows the total number of members somewhere (e.g., "You are #3 of 5").

### 4c. Check your breakdown

✅ **Expected:** Below the leaderboard, you may see three percentages explaining your score:
- **Completion** — how much of each day you logged
- **Consistency** — how many days you met the minimum
- **Participation** — what fraction of days you logged anything at all

If the challenge hasn't opened yet, these show as "—" (not 0%).

---

## 5. Leaving and Cancelling

### 5a. Leave a challenge

1. Join a challenge, then tap **Leave**.

✅ **Expected:** Button changes back to **Join**. A toast says "Left the challenge — your score so far stays ranked." If you open the leaderboard again, you still appear with "(left)" and your score.

### 5b. As the owner, cancel a challenge

1. Create a challenge, then tap **Cancel** (only visible to the owner on Active or Upcoming challenges).

✅ **Expected:** A toast says "Cancelled. It will not be scored." The badge changes to **Cancelled**. The challenge still appears in the list but can't be joined.

### 5c. Check what happens when the owner cancels

1. Have a friend join your challenge.
2. Cancel it as the owner.
3. Have your friend open the leaderboard.

✅ **Expected:** Your friend still sees their row, but the score is empty (no result). No one's score is 0 — it's just blank, meaning "no result."

---

## 6. Invite Codes

### 6a. Create a private challenge and copy the code

1. Create a private challenge.
2. Look at the challenge card — an invite code button appears.
3. Tap it to copy.

✅ **Expected:** The code is copied to clipboard and a toast says "Invite code copied". The code is 8 characters using easy-to-read letters (no confusing O/0/I/1/L).

### 6b. Share the code with someone who doesn't have an account

✅ **Expected:** They can still use the code to join. The app doesn't tell the creator whether the invited person has an account or not.

---

## 7. End-to-End Scenarios

### 7a. Complete challenge lifecycle (the main path)

1. **Alice** creates a 7-day public challenge called "Week of habits".
2. **Bob** joins from the challenge list.
3. Both log their daily blocks over the week.
4. Alice checks the leaderboard — she can see Bob's score and her own.
5. The week ends. The next time the cron job runs, scores are frozen.
6. Alice opens the leaderboard again — scores are now final and won't change.

✅ **Expected:** Everything works smoothly. Final scores are locked, marked with "final" on the leaderboard.

### 7b. Private challenge with a friend

1. Alice creates a private challenge.
2. She copies the invite code and sends it to Bob.
3. Bob pastes the code and joins.
4. Bob can now see the challenge and its leaderboard.

✅ **Expected:** Bob can only see this challenge because he has the code. Other users can't see it at all.

### 7c. Late joiner

1. Alice creates a 30-day challenge and logs 25 days.
2. Bob joins on day 26.

✅ **Expected:** Bob's score is only calculated on days 26–30. He doesn't get credit (or blame) for the days he wasn't there.

### 7d. Owner leaves mid-challenge

1. Alice creates a challenge and Bob joins.
2. Alice cancels the challenge.

✅ **Expected:** The challenge shows as Cancelled. Bob can see his progress but there's no final score. Alice can't cancel twice — it's already done.

---

## 8. What Should *Never* Happen

Test these and flag anything that does:

| Don't expect this | What you'd see |
|---|---|
| **Can't join a challenge you already joined** | The Join button should never appear when you're already a member |
| **Can't join a completed or cancelled challenge** | No Join button on finished challenges |
| **Can't see someone else's private challenge without their code** | Private challenges should be completely invisible |
| **Leaderboard never goes blank** | Even if the network is slow, the leaderboard should eventually show or show an error, not an empty screen |
| **Leaving doesn't erase your score** | After leaving, your score is still visible on the leaderboard, marked "(left)" |
| **Cancel doesn't show a score of 0** | Cancelled challenges show "no result" — not 0% for everyone |
| **Your daily data is private** | The leaderboard only shows names and scores — no task details, no categories, no routine |
| **Can't trick the system by re-joining** | Leaving and rejoining doesn't reset your joined date |

---

## 9. Mobile vs Web — Check Both

Test the same scenarios on both platforms:

- **Mobile (Flutter):** Community screen with pull-to-refresh, challenge cards stacked vertically, buttons at the bottom of each card.
- **Web (React):** Community view with side-by-side layout, tabs for pairing and challenges, same create/join/leaderboard flow.

✅ **Expected:** The behavior is the same on both. The only differences should be layout (how things look on a phone vs a screen).

---

## 10. Common Things to Look Out For

- **Progress bar shows 0% with no percentage** — that's normal if you haven't logged any days yet. Once you log, it updates.
- **"—" instead of 0% in the breakdown** — this means the challenge window hasn't opened yet. Not a bug.
- **Score is null, not 0** — same as above. A null means "nothing happened yet." A 0 would mean "you failed."
- **The code field auto-capitalizes** — paste a code and it should uppercase automatically.
- **Status badges change color based on state** — green for active, muted for upcoming/completed, red for cancelled.
- **Pull to refresh** on mobile reloads peers, pairing requests, and challenges all at once.

---

*Tested against: challenge system in the Ordo app. Covers creation, joining, scoring, leaderboards, leaving/cancelling, invite codes, and edge cases.*
