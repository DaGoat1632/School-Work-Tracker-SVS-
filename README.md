# Schedi

A student planner with a Weekly dashboard: add your work and life first, then generate a plan for **today, tomorrow, next week, and the week after**.

## Launch on Vercel (share with friends)

GitHub Pages cannot host this app. Use [Vercel](https://vercel.com/new) (free Hobby plan).

1. Sign in with GitHub at [vercel.com/new](https://vercel.com/new)
2. Import `DaGoat1632/School-Work-Tracker-SVS-`
3. Framework: **Next.js**, production branch: **`main`**
4. Optional: **Settings → Environment Variables** → `ANTHROPIC_API_KEY` (Claude study plans). Without it, plans still generate locally.
5. Click **Deploy**, then share the `*.vercel.app` URL

Each friend keeps their own homework in their browser. They will not see yours.

## Run it locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Data stays in the browser.

## Flow

1. **Add work** — homework, projects, quizzes, tests  
2. **Extracurricular / Sports / Other** — clubs, games, school, jobs, family  
3. **Weekly → Generate plan** — fills free time around fixed events  
4. **Check off** blocks as you finish; rebuild when something changes  

## Tabs

- Weekly  
- Add work  
- Extracurricular  
- Sports & games  
- Other  
- Homework  
- Settings  
