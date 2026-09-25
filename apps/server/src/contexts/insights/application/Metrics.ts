// Dashboard / report metrics computed from live comments (PRD FR-6, FR-7).
// Days are Asia/Jakarta calendar days; days without comments are returned as zeros.

import { client } from '@replyra/db';

const RISK = ['toxic', 'hate', 'threat', 'sensitive'];

export interface DailyTrendRow {
  day: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  risk: number;
  spam: number;
  autoReplied: number;
  manualReplied: number;
}

/** Comments per day for the last `days` days (oldest first). Buckets match the dashboard summary:
 *  risk (toxic/hate/threat/sensitive) and spam first, then sentiment. */
export async function dailyTrend(workspaceId: string, days = 14): Promise<DailyTrendRow[]> {
  const rows = await client<DailyTrendRow[]>`
    with days as (
      select generate_series(
        (now() at time zone 'Asia/Jakarta')::date - (${days}::int - 1),
        (now() at time zone 'Asia/Jakarta')::date,
        interval '1 day'
      )::date as day
    ),
    c as (
      select (cm.commented_at at time zone 'Asia/Jakarta')::date as day, cl.sentiment, cl.risk_label, r.source, r.sent_at
      from comments cm
      left join classifications cl on cl.comment_id = cm.id
      left join replies r on r.comment_id = cm.id
      where cm.workspace_id = ${workspaceId}
        and cm.commented_at >= ((now() at time zone 'Asia/Jakarta')::date - (${days}::int - 1)) at time zone 'Asia/Jakarta'
    )
    select to_char(d.day, 'YYYY-MM-DD') as day,
      count(c.day)::int as total,
      count(*) filter (where c.risk_label = any(${RISK}))::int as risk,
      count(*) filter (where c.risk_label = 'spam')::int as spam,
      count(*) filter (where coalesce(c.risk_label, 'none') = 'none' and c.sentiment = 'positive')::int as positive,
      count(*) filter (where coalesce(c.risk_label, 'none') = 'none' and c.sentiment = 'negative')::int as negative,
      count(*) filter (where c.day is not null and coalesce(c.risk_label, 'none') = 'none' and coalesce(c.sentiment, 'neutral') = 'neutral')::int as neutral,
      count(*) filter (where c.source = 'auto' and c.sent_at is not null)::int as "autoReplied",
      count(*) filter (where c.source in ('human_approved', 'human_written') and c.sent_at is not null)::int as "manualReplied"
    from days d
    left join c on c.day = d.day
    group by d.day
    order by d.day`;
  return rows.map((r) => ({ ...r }));
}

/** Posts with the most comments in the window, with the share of positive comments. */
export async function topPosts(workspaceId: string, days = 30, limit = 5) {
  return client<Array<{ id: string; caption: string | null; mediaUrl: string | null; permalink: string | null; commentCount: number; positiveRatio: number }>>`
    select p.id, p.caption, p.media_url as "mediaUrl", p.permalink,
      count(cm.id)::int as "commentCount",
      coalesce(avg(case when cl.sentiment = 'positive' then 1.0 else 0.0 end), 0)::float as "positiveRatio"
    from comments cm
    join posts p on p.id = cm.post_id
    left join classifications cl on cl.comment_id = cm.id
    where cm.workspace_id = ${workspaceId}
      and cm.commented_at >= now() - make_interval(days => ${days}::int)
    group by p.id
    order by "commentCount" desc
    limit ${limit}`;
}

/** Median seconds from comment to sent reply over the last `days` days; null when nothing was sent. */
export async function medianResponseSec(workspaceId: string, days = 30): Promise<number | null> {
  const [row] = await client<Array<{ median: number | null }>>`
    select percentile_cont(0.5) within group (order by extract(epoch from (r.sent_at - cm.commented_at)))::float as median
    from replies r
    join comments cm on cm.id = r.comment_id
    where cm.workspace_id = ${workspaceId}
      and r.sent_at is not null
      and r.sent_at >= cm.commented_at
      and cm.commented_at >= now() - make_interval(days => ${days}::int)`;
  return row?.median == null ? null : Math.round(row.median);
}
