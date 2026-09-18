---
title: "180,000 Players, Reimagined: How MFL is Transforming Its Game World Using Generative AI"
source: https://news.playmfl.com/articles/180000-players-reimagined-how-mfl-is-transforming-its-game-world-using-generative-ai
fetched: 2026-09-18
official: true
---

![180,000 Players, Reimagined: How MFL is Transforming Its Game World Using Generative AI](https://news.playmfl.com/_next/image?url=https%3A%2F%2Fmiro.medium.com%2Fv2%2Fresize%3Afit%3A800%2F0*ItClC4Cg6BdMBi5o.gif&w=3840&q=75&dpl=dpl_7ePanGkvNxQrwXZwv838j6Nd5djz)

[Back to articles](https://news.playmfl.com/articles)

# 180,000 Players, Reimagined: How MFL is Transforming Its Game World Using Generative AI

LucasJuly 30, 20254 min read

At MFL, we just re-generated every single player in our universe — 180,000 in total — over the span of just 3–4 days, using a highly…

---

### 180,000 Players, Reimagined: How MFL is Transforming Its Game World Using Generative AI

At MFL, we just re-generated every single player in our universe — 180,000 in total — over the span of just 3–4 days, using a highly complex generative AI pipeline running across 100+ cloud GPU pods. But this sprint was only the final stage. The real work — the workflows, tools, experiments, dead ends, breakthroughs — had been in motion for months.

![](https://news.playmfl.com/_next/image?url=https%3A%2F%2Fmiro.medium.com%2Fv2%2Fresize%3Afit%3A800%2F0*ItClC4Cg6BdMBi5o.gif&w=1920&q=75&dpl=dpl_7ePanGkvNxQrwXZwv838j6Nd5djz)

We didn’t do it to chase a trend. We did it because our universe needed it.

---

### 🎯 Why We Did It

Until now, MFL players were stylized and cartoonish. It served its purpose — but it also limited how real the game could feel. This overhaul was about immersion.  
We wanted a world that feels lived-in, with players that could believably exist in real football culture. Photorealism isn’t just about visuals — it changes perception. It makes MFL feel **professional**. It sharpens **first impressions**. And crucially, it **opens the door to a future of dynamic storytelling** and customization: custom jerseys, player aging, AI-generated video content… Have you been on the *internet* lately? This opens up a world where our players will someday be able to give post-match interviews, have their own social media accounts, appear in ads or interact directly with their in-game agents and managers.

---

### ⚙️ The Workflow: 400+ Nodes of Controlled Chaos

Behind the scenes, we built a sprawling pipeline of over 400 interconnected processing units (or “nodes”) — each fulfilling a specific role in the system, like individual gears in a finely tuned machine — generate characters that look real, fast, and at scale.

**The entire pipeline was built using open source tools.** No third-party black boxes. No rented AI APIs. Every part of the system is ours — from prompt generation to post-processing. That gives us full control, total flexibility, and zero dependency on proprietary models.

![](https://news.playmfl.com/_next/image?url=https%3A%2F%2Fmiro.medium.com%2Fv2%2Fresize%3Afit%3A800%2F1*yIFZwWif_ppXiJR_zsixmQ.png&w=1920&q=75&dpl=dpl_7ePanGkvNxQrwXZwv838j6Nd5djz)

Every image passed through multiple stages: It started with a prompt engine. A smart script that randomized player traits like their body type, hairstyle, expression, and more, to build a believable, varied universe from structured randomness.

These prompts were fed to **over 100 high-end GPU pods**, which generated base portraits with anatomical accuracy and regional diversity.

From there, a **facial refinement pass** gave each player a bit more soul — polishing expressions, fixing inconsistencies, and anchoring the emotional realism of each image. And then came the kits (i.e. the jerseys they wear).

We built our own **in-house 3D kit generation tool**, which allowed us to design hundreds of club shirts using custom patterns, textures, and fictional brand logos. Those kits were passed back into the pipeline, and applied in a multi-step process: First, we used a segmentation model to detect the original shirt in the image, and then an advanced outpainting workflow to perform the clothing change.

Logos — small details are the first thing to break down in AI generations — were enhanced in a separate detail pass. And a second queue of GPU pods ran background removal in parallel, outputting transparent images ready for the MFL platform.

Final quality control was handled in two layers: an **automated check** for obvious errors, followed by a **human review team** working inside a custom moderation panel we built. Rejected images were auto-regenerated. No manual fixes, no bottlenecks.

### 📊 The Result

On the surface, it means MFL is going from cartoonish to cinematic. But in reality, it means so much more than that.

We re-rendered 180,000 footballers, each one linked to their real in-game identity, fully isolated on transparent backgrounds, and ready to be used not just in the game UI — but in video, audio, social, and any other format we dream up in the future.

![](https://news.playmfl.com/_next/image?url=https%3A%2F%2Fmiro.medium.com%2Fv2%2Fresize%3Afit%3A800%2F1*_KCk4BtNW3gMcJxWPM7f_A.png&w=1920&q=75&dpl=dpl_7ePanGkvNxQrwXZwv838j6Nd5djz)

The result is a world that truly reflects the essence of MFL: one that feels alive, like a breathing, dynamic parallel universe. One with lore. With identity. With continuity. And a system flexible enough to let us evolve every one of those players season after season — from teenage prodigy to retiring legend.

By [Lucas](https://medium.com/@LucasMFL) on [July 30, 2025](https://medium.com/p/750f91467ce2).

[Canonical link](https://medium.com/@LucasMFL/180-000-players-reimagined-how-mfl-is-transforming-its-game-world-using-generative-ai-750f91467ce2)

Exported from [Medium](https://medium.com) on March 19, 2026.

Share this article

[Share on X](https://twitter.com/intent/tweet?text=180%2C000%20Players%2C%20Reimagined%3A%20How%20MFL%20is%20Transforming%20Its%20Game%20World%20Using%20Generative%20AI%0A%0Ahttps%3A%2F%2Fnews.playmfl.com%2Farticles%2F180000-players-reimagined-how-mfl-is-transforming-its-game-world-using-generative-ai)
