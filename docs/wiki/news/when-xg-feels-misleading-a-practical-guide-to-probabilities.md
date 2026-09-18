---
title: "When xG Feels Misleading: A Practical Guide to Probabilities…"
source: https://news.playmfl.com/articles/when-xg-feels-misleading-a-practical-guide-to-probabilities
fetched: 2026-09-18
official: true
---

![When xG Feels Misleading: A Practical Guide to Probabilities…](https://news.playmfl.com/_next/image?url=https%3A%2F%2Fmiro.medium.com%2Fv2%2Fresize%3Afit%3A800%2F1*-mh5hgJWCtntZ6iozwoDQg.png&w=3840&q=75&dpl=dpl_7ePanGkvNxQrwXZwv838j6Nd5djz)

[Back to articles](https://news.playmfl.com/articles)

# When xG Feels Misleading: A Practical Guide to Probabilities…

LucasMay 19, 202510 min read

… and how they apply to MFL.

---

### When xG Feels Misleading: A Practical Guide to Probabilities…

… and how they apply to MFL.

![](https://news.playmfl.com/_next/image?url=https%3A%2F%2Fmiro.medium.com%2Fv2%2Fresize%3Afit%3A800%2F1*-mh5hgJWCtntZ6iozwoDQg.png&w=1920&q=75&dpl=dpl_7ePanGkvNxQrwXZwv838j6Nd5djz)

Everyone loves a bit of Wikipedia (what do you mean, no?), so let’s start with that.

> “The expected goals metric is generally calculated by determining the likelihood of a shot being scored based on various factors, taken from the moment before the player shoots. These factors may vary depending on the statistical model, but include the distance to the goal, angle, shot type, and other contextual factors.   
> Each shot is then given a probabilistic value, representing how many times that shot is likely to be scored based on similar shots. For example, a shot with a value of .3 goals is likely to be scored about 3 out of every 10 times.”

xG isn’t without its flaws, though. It’s a powerful metric, but it has its blind spots. It estimates the likelihood of scoring, but it doesn’t factor in how the chance was created or how well the shot was struck. Over a single match (IRL or in MFL), xG alone can tell a very incomplete story. Still, it’s better than just staring at the final scoreline.

Regardless, it’s easy to treat an expected‑goals number as a promise, and be surprised (let’s stick with *surprised* here…) when the scoreline doesn’t match. But xG don’t guarantee goals, they just predict them: the more matches you look at, the closer reality comes to that average.

**MFL S5 data** (we’ve taken the first 25,369 matches here) lines up with those swings, but actually shows *fewer* shock results than a classic Poisson forecast. Here’s how it all works.

> ***Poi-what?*** *The Poisson model is* *a simple way to turn any xG into odds of 0, 1, 2+ goals. It’s widely used to predict xG and in the world of probabilities & sports-betting in general.  
> Think of each shot as a dice roll: the xG number is the average “score” of all those rolls. The* ***Poisson model*** *asks this:* If a team’s total xG is λ, what are the odds they end on 0, 1, 2… goals?

> **\_But why?  
> \_***It isn’t perfect, but it’s a useful tool because it strips away human context and just asks: if football were purely about the number of chances and their average quality, what would happen? That gives us a baseline to compare against. Poisson can predict “upsets” at a similar clip we see in real stadiums and in MFL. It’s more of a reality check than a crystal ball.*

---

### 1. Common myths:

***🚫 Myth:*** *“If I create 1.2 xG I* should *score once.”****✅ Truth:*** You leave with zero goals **30%** of the time at 1.2 xG according to Poisson, and **28.38%** of the time in MFL S5.

***🚫 Myth:*** *“Winning the xG battle 3‑1 pretty much guarantees victory.”****✅ Truth:*** With 3.0 vs 1.0 xG you still drop points in about **1 match in 4.** (draw + loss combined)

---

### 2. Quick‑Reference Tables

#### 2.1 Goal-scoring odds for any xG

*Poisson Formula (“Model” in below table):* `_P(k)=e^(–λ) λ^k / k!_`\_  
MFL data: Season 5 matches played so far\_

![](https://news.playmfl.com/_next/image?url=https%3A%2F%2Fmiro.medium.com%2Fv2%2Fresize%3Afit%3A800%2F1*zUfGZk2RvlLc2G4RRekFOA.png&w=1920&q=75&dpl=dpl_7ePanGkvNxQrwXZwv838j6Nd5djz)

#### What this tells us

- **When chances are almost zero** (xG near 0), the simple model says you’ll be goalless about 9 times out of 10. In MFL that happens a little bit more often – 94% of the time.
- **With a few clear looks** (xG around 1), the model and MFL line up almost perfectly: teams fail to score 37% of the time and hit exactly one about 40% of the time.
- **When you really pile on the chances** (xG ≈2.5–3), the model expects a 0-goal night in 5–8% of games – but in MFL that only happens 1–4% of the time. In other words, your strikers are a touch deadlier than the pure forecast.

> Note: Grouping 2.25–2.75 together means some matches actually had 2.3, some 2.7 xG, so a little swing is expected. That, and even in real-world leagues you’d see small deviations from the simple model – this is perfectly normal!

#### 2.2 Outcome probabilities for head-to-head

Classic Poisson vs MFL S5 for a few common (and not so common) scoreline forecasts:

![](https://news.playmfl.com/_next/image?url=https%3A%2F%2Fmiro.medium.com%2Fv2%2Fresize%3Afit%3A800%2F1*PMWiXugPvyAjngrOE54pow.png&w=1920&q=75&dpl=dpl_7ePanGkvNxQrwXZwv838j6Nd5djz)

### Takeaways

- **Tight games** (1 vs 0.8, 1.2 vs 1.0):  
   Poisson and MFL both split win/draw/loss roughly one-third each.
- **Medium edges** (1.6 vs 1.0, 1.8 vs 1.0):  
  Poisson says the favorite wins about 50–56% of the time; in MFL it’s slightly higher (54–61%).
- **Clear dominance** (2.0–2.6 vs low xG):  
  Poisson predicts a 65–76% win rate; MFL actually leans more into the favorite, winning 71–83%.
- **Blowouts** (3.0–4.0 vs 1.0):  
  Small sample size alert 🚨 but Poisson still allows more draws/upsets in this range overall

These extra examples show that **across the board**, MFL’s outcomes mirror what a simple Poisson xG → goal model would predict – just with a slight boost for favorites compared to the model. In other words, there were **fewer upsets in MFL during Season 5 thus far** than the pure mathematical forecast.

---

### 3. Bite-size examples

#### Example A : 0.8 xG, didn’t score

- Poisson says: 45 % chance.
- MFL S5: **47.84% chance.**

Some would say being surprised by this is like flipping a coin and being surprised by tails.

#### Example B: 2.5 xG and you “only” net one.

- Poisson: **20%**. Happens once every five games.
- MFL S5: **15.54%.**

#### Example C: With 2.5 xG, what are the odds of scoring 0, 1 or 2+ goals?

**→ Poisson predicts:** 0 goals ~ 8% | 1 goal ~ 20% | 2+ goals ~ 72%  
**→ MFL S5 saw:** 0 goals ~ 3.9% | 1 goal ~ 15.9% | 2+ goals ~ 80.2%

Remember: one or two games is a tiny sample. Variance (yep, I waited this long to use the v-word!) is a feature of football, not a bug.

---

### 4. Variance is Natural

Even when two teams have the exact same overall strength and use identical tactics, results can still vary wildly. The heatmap below shows the outcomes of 100 random simulated MFL matches under those conditions. Over an entire season, variance naturally tends to shrink.

![](https://news.playmfl.com/_next/image?url=https%3A%2F%2Fmiro.medium.com%2Fv2%2Fresize%3Afit%3A800%2F1*1kXQnYY429rSIh6-cTvLZA.png&w=1920&q=75&dpl=dpl_7ePanGkvNxQrwXZwv838j6Nd5djz)

And here’s another one of these, just swapping formations (both teams still have the same formation, just a different one)

![](https://news.playmfl.com/_next/image?url=https%3A%2F%2Fmiro.medium.com%2Fv2%2Fresize%3Afit%3A800%2F1*TzKLlzXxX0Ar-vB3YQvewQ.png&w=1920&q=75&dpl=dpl_7ePanGkvNxQrwXZwv838j6Nd5djz)

---

### 5. xG Fairness

What’s xG Fairness? Put simply:

- If the score follows xG perfectly → Fairness = 1.0 (perfectly balanced… say the line… say the line…)
- If the score deviates completely from the xG → Fairness = Low

We took a small sample size of 392 IRL matches and noted their published fairness on [xgscore.com](http://xgscore.com) (a great place to learn about xG and regularly find worse upsets than your latest one) to compare them to the matches played in MFL S5 so far. Here’s what we got:

![](https://news.playmfl.com/_next/image?url=https%3A%2F%2Fmiro.medium.com%2Fv2%2Fresize%3Afit%3A800%2F1*wUiTAOk7-dxv_K8P7Sf7dw.png&w=1920&q=75&dpl=dpl_7ePanGkvNxQrwXZwv838j6Nd5djz)

The main takeaway is that MFL’s balance of one-sided vs tight games tracks real football very closely, and is better than in previous seasons.   
We’d like to see more matches end at around 1, and less around 0.7, though, and will be working to that end.

#### Top xG Upsets

Let’s compare the top 10 xG upsets in arguably the top competition IRL – the Champions League, and the Platinum + Diamond Divisions combined in MFL. For that, we’ve again applied the exact same xG Fairness formula to both samples.

![](https://news.playmfl.com/_next/image?url=https%3A%2F%2Fmiro.medium.com%2Fv2%2Fresize%3Afit%3A800%2F1*mc3aEB2XW5L21JfRc0jRlw.png&w=1920&q=75&dpl=dpl_7ePanGkvNxQrwXZwv838j6Nd5djz)

The top 10 xG upsets across the Champions League (IRL) and the MFL Diamond & Platinum divisions

As you can see, with nearly the same sample size, the results are comparable, with the UCL producing slightly tougher beats overall.

### 6. Key Takeaways

1. xG describes averages, not guarantees.
2. **MFL is less random and tracks closer to xG than pure Poisson.** Fewer giant upsets, fewer goalless woes.
3. Small samples lie. **Big samples beat luck.** Over longer periods, variance smooths out and quality wins out.

---

### 7. Frustration.

I want add more of a personal note here.

I think I have a decent idea of how frustrating it can be. Honestly, if I were in your place, putting in the hours, building a squad, watching your team create more chances, more xG, and still somehow lose, I would be frustrated too. I would probably be venting if that happened multiple times. I might even get really mad at times. Like, *intense-visions-of-punching-the-monitor* mad. It is a helpless feeling, and I don’t blame anyone for expressing that.

When you are on the wrong side of variance, being told “you were unlucky” does not help much. It feels like you are being dismissed, especially when you feel like you played it right. You want a reason. You want to know what you could have done differently. And you definitely can’t reload that save to try again (shoutout to all FM players who‘ve shamelessly replayed a Cup final sixteen times – raise your hand if that’s you✋). Something tells me that’s exactly what it often feels like to be a manager.

Sometimes it’s tempting to say “the engine is broken.” I get why. It is a way to explain something that feels unfair. And I will be the first to say, this engine is not perfect. There are things we want to improve. Goalkeeper mistakes are too common, defensive positioning isn’t ideal, there are edge cases that do not feel right – those are real issues, and we are aware of them. We are doing our best to improve on these *right now.*

At the same time, I want to be honest with you. Even if we built the most realistic engine in the world with alien-sourced quantum mega-computers, one that mimicked real football down to the tiniest of details, you would still have matches that made no sense in your mind. It would for sure look and feel more realistic, but you would still have 3 xG games ending in zero goals. You would still lose matches where you feel like you did everything right. Because that is what football is. And if anything, the more realistic it gets, the more chaos creeps in. It’s not broken.

I want to be honest about something else too. I think the engine/simulation, when put in context, is amazing. It was built from scratch, almost single-handedly, up to this point, in under two years. Not perfect, but amazing. Especially when you step back and see what has been achieved with so little time, by so few people. I see how hard it is to build something like this, and it gives me a lot of pride and humility to be involved in it.

The objective improvements that come to it each season often fly under the radar. Did you notice you can now see the direction the ball is going when controlled or shot? That players turn their bodies? The added variety in goal-scoring opportunities? How defenders drop back on goal kicks when you set your tactics to play it short? These small changes may not stand out at first, but they are part of what realism looks like in a simulation like this.

Even as we work toward a version of MFL where smart managers have even more ways to shine, it will always be football. There will always be bad beats, unlucky losses, moments that make you want to scream. And maybe that is part of what makes the wins feel real too.

None of this is meant to take away from your feedback. We want to hear the frustration. We need to hear the cases that feel off. I can tell you on behalf of the entire team that we are grateful every time someone cares enough to tell us what they think is wrong. You are helping shape this game. My only ask is that you take a moment before hitting send and ask yourself, “Will this be helpful to anyone?” “Am I being fair?”

We are thankful for every single one of you who keeps showing up, who gives a damn, even when it feels unfair. Truly. This thing only works because of you, and because you care enough to be frustrated in the first place.

*– Lucas*

By [Lucas](https://medium.com/@LucasMFL) on [May 19, 2025](https://medium.com/p/9240b21b48d2).

[Canonical link](https://medium.com/@LucasMFL/when-xg-feels-misleading-a-practical-guide-to-probabilities-9240b21b48d2)

Exported from [Medium](https://medium.com) on March 19, 2026.

Share this article

[Share on X](https://twitter.com/intent/tweet?text=When%20xG%20Feels%20Misleading%3A%20A%20Practical%20Guide%20to%20Probabilities%E2%80%A6%0A%0Ahttps%3A%2F%2Fnews.playmfl.com%2Farticles%2Fwhen-xg-feels-misleading-a-practical-guide-to-probabilities)
